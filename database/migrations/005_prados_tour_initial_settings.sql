-- Prado's Tour / Supabase
-- ETAPA 4 OPCIONAL: configurações iniciais não sensíveis da aplicação.
-- Não é seed de usuários, reservas, pagamentos ou dados da store.
-- Pré-requisitos: etapas 002, 003 e 004 aplicadas com sucesso.

insert into public.settings(key, value)
values(
  'brand',
  '{"company_name":"Prado''s Tour","primary":"#E84C91","secondary":"#F28C28","background":"#FFF9FC","font":"Arial","font_size":"16","whatsapp":"5511998639502","instagram":"","email":""}'::jsonb
)
on conflict(key) do nothing;

insert into public.settings(key, value)
values(
  'payment',
  '{"pix_key":"11998639502","pix_total_discount":0.02,"card_whatsapp":true}'::jsonb
)
on conflict(key) do nothing;
