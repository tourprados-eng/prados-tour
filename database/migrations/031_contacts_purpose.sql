-- Finalidade dos contatos: cada função do site aponta para o número certo.
-- O conceito de "contato principal" deixa de ditar o roteamento; a finalidade
-- (suporte / reservas / geral) decide para qual número cada botão abre o
-- WhatsApp. A coluna é aditiva e com default para preservar a estrutura atual.

alter table public.contacts
  add column if not exists purpose text not null default 'geral';

-- 11971653517 = Suporte do site (preciso de ajuda)
update public.contacts
set purpose = 'suporte',
    name = 'Suporte do site',
    is_active = true,
    auto_message = 'Olá! Meu nome é [NOME DO CLIENTE]. Vim pelo site da Prado''s Tour e preciso de ajuda!'
where phone = '11971653517';

-- 11998639502 = Reservas e dúvidas (atendimento comercial). Tem que ficar ativo.
update public.contacts
set purpose = 'reservas',
    name = 'Reservas e dúvidas',
    is_active = true,
    is_primary = false,
    auto_message = 'Olá! Meu nome é [NOME DO CLIENTE]. Estou com dúvidas e gostaria de mais informações sobre as viagens da Prado''s Tour.'
where phone = '11998639502';