-- Seed de demonstração (ambiente de teste).
-- Contas web demo (modo local): senha Prados@123
-- admin@pradostour.com | vendedor@pradostour.com | monitor@pradostour.com
-- financeiro@pradostour.com | cliente@pradostour.com

insert into public.boarding_points(name,city,address,observations) values
('SAN Fazendinha','Santana de Parnaíba','Santana de Parnaíba - SP','Ponto de referência'),
('Anhanguera Parque Shopping','Cajamar','Cajamar - SP','Ponto de referência'),
('Ginásio de Esportes do Polvilho','Cajamar','Cajamar - SP','Ponto de referência'),
('Barra Funda','São Paulo','São Paulo - SP','Tagipuru / região do Memorial da América Latina')
on conflict do nothing;

insert into public.coupons(code,type,value,usage_limit,valid_until,active)
values ('PRADOS10','PERCENTUAL',10,100,'2026-12-31 23:59:59+00',true)
on conflict (code) do nothing;

insert into public.settings(key,value) values
('brand','{"company_name":"Prado''s Tour","primary":"#E84C91","secondary":"#F28C28","background":"#FFF8F4","font":"Outfit","font_size":"16","whatsapp":"5511998639502","instagram":"pradostour","email":"contato@pradostour.com"}'::jsonb),
('payment','{"pix_key":"11998639502","pix_total_discount":0.02,"card_whatsapp":true,"default_commission":0.10}'::jsonb)
on conflict(key) do update set value=excluded.value;
