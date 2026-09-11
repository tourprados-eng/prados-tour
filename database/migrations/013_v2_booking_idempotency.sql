-- 013: Bloco C — checkout com validação e proteção contra duplicidade.
-- Adiciona um identificador de requisição do cliente (idempotência) às reservas.
-- O mesmo cliente + viagem + client_request_id resulta na MESMA reserva,
-- evitando duplicação por duplo clique, refresh ou retry da action.

alter table bookings
  add column if not exists client_request_id text;

create index if not exists bookings_client_request_idx
  on bookings (customer_id, trip_id, client_request_id)
  where client_request_id is not null;