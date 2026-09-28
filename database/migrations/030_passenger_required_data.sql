-- 030_passenger_required_data.sql
--
-- REGRA CENTRAL DO SISTEMA: nenhuma reserva pode ser criada, confirmada ou
-- finalizada se QUALQUER passageiro estiver sem os dados obrigatórios
-- (nome completo, CPF, telefone, RG e data de nascimento) ou sem a declaração
-- de veracidade.
--
-- Esta migração é a última barreira, no próprio banco: mesmo que alguém
-- contorne a aplicação (upsert direto via PostgREST, RPC, script ou bug), o
-- Postgres recusa a gravação.
--
-- COMPATIBILIDADE (nada é apagado, nada quebra):
--  - `rg` e `data_declaration_at` são adicionados como NULL (colunas novas);
--  - linhas já existentes NÃO são revalidadas, podem continuar sendo
--    atualizadas/corrigidas livremente pela equipe;
--  - apenas linhas NOVAS precisam vir completas;
--  - uma linha que JÁ está completa nunca pode ser rebaixada a incompleta;
--  - uma reserva só entra em CONFIRMADA com todos os passageiros completos.
--    Reservas legadas CONFIRMADA/CONCLUIDA continuam editáveis normalmente.

begin;

-- ---------------------------------------------------------------------------
-- 1) Colunas novas
-- ---------------------------------------------------------------------------

alter table public.booking_passengers
  add column if not exists rg text,
  add column if not exists data_declaration_at timestamptz;

comment on column public.booking_passengers.rg is
  'RG do passageiro — obrigatório em toda reserva nova.';
comment on column public.booking_passengers.data_declaration_at is
  'Instante em que o passageiro aceitou a declaração de veracidade dos dados.';

-- RG, quando informado, não pode ser composed só de espaços.
alter table public.booking_passengers
  drop constraint if exists booking_passengers_rg_not_blank;
alter table public.booking_passengers
  add constraint booking_passengers_rg_not_blank
  check (rg is null or btrim(rg) <> '');

-- ---------------------------------------------------------------------------
-- 2) Predicado único de "passageiro completo" (usado pelos triggers)
-- ---------------------------------------------------------------------------

-- CPF matematicamente válido (11 dígitos + 2 dígitos verificadores).
create or replace function public.is_valid_cpf(p_cpf text)
  returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_sum integer := 0;
  v_rest integer;
  v_i integer;
begin
  if char_length(v_cpf) <> 11 then
    return false;
  end if;
  if v_cpf ~ '^([0-9])\1{10}$' then
    return false; -- 000.000.000-00, 111.111.111-11, ...
  end if;

  for v_i in 1..9 loop
    v_sum := v_sum + substring(v_cpf from v_i for 1)::integer * (11 - v_i);
  end loop;
  v_rest := mod(v_sum * 10, 11);
  if v_rest = 10 then
    v_rest := 0;
  end if;
  if v_rest <> substring(v_cpf from 10 for 1)::integer then
    return false;
  end if;

  v_sum := 0;
  for v_i in 1..10 loop
    v_sum := v_sum + substring(v_cpf from v_i for 1)::integer * (12 - v_i);
  end loop;
  v_rest := mod(v_sum * 10, 11);
  if v_rest = 10 then
    v_rest := 0;
  end if;

  return v_rest = substring(v_cpf from 11 for 1)::integer;
end;
$$;

comment on function public.is_valid_cpf(text) is
  'Validação matemática de CPF (11 dígitos + 2 dígitos verificadores).';

-- Nome completo: nome E sobrenome, com 2+ letras cada, sem números.
create or replace function public.is_full_name(p_name text)
  returns boolean
language sql
immutable
set search_path = public
as $$
  select (
    select count(*) >= 2
    from unnest(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+')) as parte
    where btrim(parte) <> ''
      and parte ~ '^[[:alpha:]][[:alpha:]'' -]*$'
      and char_length(regexp_replace(parte, '[^[:alpha:]]', '', 'g')) >= 2
  );
$$;

create or replace function public.booking_passenger_is_complete(
  p_name text,
  p_cpf text,
  p_phone text,
  p_rg text,
  p_birth_date date,
  p_declaration timestamptz
) returns boolean
language sql
immutable
set search_path = public
as $$
  select
    -- 1. nome completo verdadeiro
    public.is_full_name(p_name)
    -- 2. CPF válido
    and public.is_valid_cpf(p_cpf)
    -- 3. telefone/WhatsApp utilizável (DDD + número)
    and char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) between 10 and 13
    -- 4. RG
    and btrim(coalesce(p_rg, '')) <> ''
    -- 5. data de nascimento válida e não futura
    and p_birth_date is not null
    and p_birth_date between date '1900-01-01' and current_date
    -- 6. declaração de veracidade aceita
    and p_declaration is not null;
$$;

comment on function public.booking_passenger_is_complete(text, text, text, text, date, timestamptz) is
  'Verdadeiro quando o passageiro tem nome completo, CPF válido, telefone, RG, data de nascimento válida e a declaração de veracidade aceita.';

-- Atalho para validar uma linha da própria tabela.
create or replace function public.booking_passenger_row_is_complete(p_row public.booking_passengers)
  returns boolean
language sql
immutable
set search_path = public
as $$
  select public.booking_passenger_is_complete(
    p_row.name, p_row.cpf, p_row.phone, p_row.rg, p_row.birth_date, p_row.data_declaration_at
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) INSERT: passageiro novo precisa estar completo
-- ---------------------------------------------------------------------------

create or replace function public.enforce_booking_passenger_required_data()
  returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- O repositório faz upsert diferencial: quando a linha JÁ existe, o
  -- ON CONFLICT passa por aqui como UPDATE. Reservas antigas podem (e devem)
  -- continuar sendo atualizadas/corrigidas, mesmo sem RG.
  if exists (select 1 from public.booking_passengers bp where bp.id = new.id) then
    return new;
  end if;

  if not public.booking_passenger_row_is_complete(new) then
    raise exception using
      errcode = 'check_violation',
      message = 'PASSENGER_DATA_INCOMPLETE: é obrigatório preencher os dados completos de todos os passageiros: nome completo, CPF, telefone, RG e data de nascimento, e aceitar a declaração de veracidade.';
  end if;

  return new;
end;
$$;

drop trigger if exists booking_passengers_required_data_insert on public.booking_passengers;
create trigger booking_passengers_required_data_insert
  before insert on public.booking_passengers
  for each row execute function public.enforce_booking_passenger_required_data();

-- ---------------------------------------------------------------------------
-- 4) UPDATE: passageiro completo nunca pode ser rebaixado a incompleto
-- ---------------------------------------------------------------------------

create or replace function public.enforce_booking_passenger_not_degraded()
  returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.booking_passenger_row_is_complete(old)
     and not public.booking_passenger_row_is_complete(new) then
    raise exception using
      errcode = 'check_violation',
      message = 'PASSENGER_DATA_INCOMPLETE: é obrigatório preencher os dados completos de todos os passageiros: nome completo, CPF, telefone, RG e data de nascimento, e aceitar a declaração de veracidade.';
  end if;

  return new;
end;
$$;

drop trigger if exists booking_passengers_required_data_update on public.booking_passengers;
create trigger booking_passengers_required_data_update
  before update on public.booking_passengers
  for each row execute function public.enforce_booking_passenger_not_degraded();

-- ---------------------------------------------------------------------------
-- 5) Uma reserva só pode virar CONFIRMADA/CONCLUIDA com TODOS os passageiros
--    completos — e nunca pode ser criada já confirmada.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_booking_confirmation_passengers()
  returns trigger
  language plpgsql
  set search_path = public
as $$
declare
  v_total       integer;
  v_incomplete  integer;
  v_detalhes    text;
begin
  -- Uma reserva sempre nasce com pelo menos um passageiro reservado.
  if new.quantity is null or new.quantity < 1 then
    raise exception using
      errcode = 'check_violation',
      message = 'BOOKING_PASSENGERS_INCOMPLETE: a reserva deve ter ao menos 1 passageiro.';
  end if;

  -- INSERT: o app grava a reserva como PENDENTE e os passageiros em seguida,
  -- então um INSERT já confirmado/finalizado significa payload direto pela
  -- API tentando nascer paga — e sem passageiro nenhum. Bloqueia.
  --
  -- CUIDADO (armadilha do ON CONFLICT): em `INSERT ... ON CONFLICT DO UPDATE`
  -- o PostgreSQL dispara os triggers BEFORE INSERT da linha candidata ANTES de
  -- detectar o conflito. O repositório grava sempre por upsert, então um
  -- trigger que rejeitasse aqui derrubaria o update de QUALQUER reserva
  -- CONFIRMADA já existente (erro 23514 no webhook e no checkout). Por isso a
  -- linha existente é detectada e devolvida: quem valida a transição de status
  -- é o trigger BEFORE UPDATE, disparado logo em seguida pelo DO UPDATE.
  if tg_op = 'INSERT' then
    if exists (select 1 from public.bookings b where b.id = new.id) then
      return new;
    end if;
    if new.status in ('CONFIRMADA', 'CONCLUIDA') then
      raise exception using
        errcode = 'check_violation',
        message = 'BOOKING_PASSENGERS_INCOMPLETE: a reserva deve ser criada como PENDENTE, com todos os passageiros completos, antes de ser confirmada.';
    end if;
    return new;
  end if;

  -- UPDATE: a reserva só pode estar em estado fechado com TODOS os
  -- passageiros completos. Não há isenção para reserva legada já
  -- CONFIRMADA/CONCLUIDA: enquanto os dados não forem corrigidos, qualquer
  -- escrita que a mantenha/mantenha em estado fechado é rejeitada.
  if new.status not in ('CONFIRMADA', 'CONCLUIDA') then
    return new;
  end if;

  select
    count(*)::integer,
    count(*) filter (where not pendencias.ok)::integer,
    string_agg(
      format('Passageiro %s: dados incompletos ou CPF inválido', pendencias.ordem),
      ' | '
    ) filter (where not pendencias.ok)
  into v_total, v_incomplete, v_detalhes
  from (
    select
      row_number() over (order by bp.id) as ordem,
      public.booking_passenger_row_is_complete(bp) as ok
    from public.booking_passengers bp
    where bp.booking_id = new.id
  ) pendencias;

  -- Sem passageiro, com passageiro incompleto ou com a quantidade divergente:
  -- a reserva está incompleta e não pode ser confirmada nem finalizada.
  if v_incomplete > 0 or v_total <> new.quantity then
    raise exception using
      errcode = 'check_violation',
      message = 'BOOKING_PASSENGERS_INCOMPLETE: é obrigatório preencher os dados completos de todos os passageiros: nome completo, CPF, telefone, RG e data de nascimento, e aceitar a declaração de veracidade. (' ||
        coalesce(
          v_detalhes,
          format('reserva de %s passageiro(s) com %s passageiro(s) cadastrado(s)', new.quantity, v_total)
        ) || ')';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_confirmation_passengers on public.bookings;
create trigger bookings_confirmation_passengers
  before insert or update of status, quantity on public.bookings
  for each row execute function public.enforce_booking_confirmation_passengers();

-- ---------------------------------------------------------------------------
-- 6) Auditoria: view de reservas com pendência de dados (uso administrativo)
-- ---------------------------------------------------------------------------

create or replace view public.bookings_missing_passenger_data
  with (security_invoker = true)
  as
  select
    b.id                as booking_id,
    b.reference         as booking_reference,
    b.status            as booking_status,
    b.created_at        as booking_created_at,
    count(bp.id)        as total_passageiros,
    count(bp.id) filter (
      where not public.booking_passenger_row_is_complete(bp)
    )                as passageiros_incompletos
  from public.bookings b
  join public.booking_passengers bp on bp.booking_id = b.id
  group by b.id, b.reference, b.status, b.created_at
  having count(bp.id) filter (
    where not public.booking_passenger_row_is_complete(bp)
  ) > 0;

comment on view public.bookings_missing_passenger_data is
  'Reservas com ao menos um passageiro incompleto. Reservas antigas podem ser corrigidas; novas reservas nunca nascem incompletas.';

commit;
