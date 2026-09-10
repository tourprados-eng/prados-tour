-- Prado's Tour / FASE 6 - ETAPA 1 (catálogo) - gerado automaticamente
-- store.json md5: 4d8d27feb20f50583e129c1a3c5260dc
-- Idempotente: INSERT ... ON CONFLICT (id) DO NOTHING/UPDATE. Sem DELETE. Sem auth.
-- bloqueio: trips excluídas=eb2b82d0-6b33-471d-abf7-aa29d0abf609,5a247a23-ebcf-4850-be01-62fa3c8dd346,f67bc481-68dd-4b7a-aa86-cf3675f71723 | seats com booking=3

begin;

-- 1) settings (brand / payment) — upsert por PK (key)
insert into public.settings (key, value, updated_at) values ('brand', '{"company_name":"Prado''s Tour","primary":"#E84C91","secondary":"#F28C28","background":"#FAF7F8","font":"Outfit","font_size":"16","whatsapp":"5511998639502","instagram":"pradostour","email":"contato@pradostour.com","logo_url":"/images/logo.png","banner_url":"/uploads/brand/banner-1788628198349.png","favicon_url":"/images/logo.png"}'::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.settings (key, value, updated_at) values ('payment', '{"pix_key":"11998639502","pix_total_discount":0.02,"card_whatsapp":true,"default_commission":0.1}'::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now();

-- 2) trips
insert into public.trips (id, name, slug, destination, category, date, departure_time, return_time, price_person, price_couple, total_seats, description, itinerary, included, not_included, rules, cancellation_policy, status, created_at, updated_at) values
  ('fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', 'Guarujá', 'guaruja', 'Guarujá - SP', 'Praia', '2026-09-20', '05:00', '19:30', 150, 280, 46, 'Dia de praia no Guarujá com embarque em pontos estratégicos da Grande São Paulo.', 'Embarque matinal → Praia → Tempo livre → Retorno à noite.', 'Ônibus executivo, monitor, kit boas-vindas.', 'Alimentação e cadeiras de praia.', 'Chegar com 20 minutos de antecedência no ponto.', 'Regras padrão Prado''s Tour.', 'PUBLICADA', '2026-09-05T03:14:00.830Z'::timestamptz, '2026-09-05T03:14:00.830Z'::timestamptz),
  ('2e940a0e-162f-4220-ad54-a443bd6930b9', 'Paraty Histórica', 'paraty-historica', 'Paraty - RJ', 'Turismo cultural', '2026-10-11', '23:00', '21:00', 220, 420, 40, 'City tour pelo centro histórico de Paraty com tempo livre e fotos.', 'Saída noturna → Centro histórico → Tempo livre → Retorno.', 'Transporte, monitor e mapa turístico.', 'Passeios de barco e refeições.', 'Calçado confortável recomendado.', 'Até 10 dias antes com análise administrativa.', 'PUBLICADA', '2026-09-05T03:14:00.830Z'::timestamptz, '2026-09-05T03:14:00.830Z'::timestamptz)
on conflict (id) do nothing;

-- 3) trip_images (ids determinísticos p/ idempotência)
insert into public.trip_images (id, trip_id, url, sort_order) values
  ('37390232-d1d4-4dfa-a7a2-b189fb20731c', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '/images/guaruja.png', 0),
  ('234ebd1e-06e0-4976-aa6b-7c50d6b571eb', '2e940a0e-162f-4220-ad54-a443bd6930b9', '/images/paraty.png', 0)
on conflict (id) do nothing;

-- 4) boarding_points
insert into public.boarding_points (id, name, address, latitude, longitude, observations, active) values
  ('fc489507-d3ed-405f-a725-fbe6dab5c5bd', 'SAN Fazendinha', 'Santana de Parnaíba - SP', -23.444, -46.918, 'Ponto de referência', true),
  ('1ed61a3a-0d8d-4fcc-84f2-222e4a0a4933', 'Anhanguera Parque Shopping', 'São Paulo - SP', -23.493, -46.761, 'Embarque na entrada principal', true),
  ('767f4983-2497-461c-9d8d-f98257c98486', 'Ginásio de Esportes do Polvilho', 'Cajamar - SP', -23.356, -46.876, 'Estacionamento amplo', true),
  ('34620c11-4686-40cb-ab40-78713f53c043', 'Barra Funda', 'São Paulo - SP', -23.525, -46.667, 'Tagipuru / Memorial da América Latina', true)
on conflict (id) do nothing;

-- 5) trip_boarding_points
insert into public.trip_boarding_points (id, trip_id, boarding_point_id, time) values
  ('c9380333-2df8-424d-a90b-7959a57624cc', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', 'fc489507-d3ed-405f-a725-fbe6dab5c5bd', '05:00'),
  ('fd91ead1-7e52-4315-a5f5-1d6ccf25613d', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '1ed61a3a-0d8d-4fcc-84f2-222e4a0a4933', '05:20'),
  ('75ae9093-66eb-4f2b-a82c-a49aef4b88da', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '767f4983-2497-461c-9d8d-f98257c98486', '05:35'),
  ('3ae08767-cb3b-4706-a7dd-f8ea2e46a885', '2e940a0e-162f-4220-ad54-a443bd6930b9', '1ed61a3a-0d8d-4fcc-84f2-222e4a0a4933', '23:00'),
  ('e1ec7514-ffbd-45e9-a276-5dd4b07e0bfd', '2e940a0e-162f-4220-ad54-a443bd6930b9', '34620c11-4686-40cb-ab40-78713f53c043', '23:40')
on conflict (id) do nothing;

-- 6) coupons
insert into public.coupons (id, code, type, value, usage_limit, valid_until, active) values
  ('47d998cd-4e29-4ba8-a870-1a1d7d9982c2', 'PRADOS10', 'PERCENTUAL', 10, 100, '2026-12-31T23:59:59.000Z'::timestamptz, true)
on conflict (id) do nothing;

-- 7) coupon_trips (0 no store atual)
select 1; -- nenhum vínculo coupon_trips

-- 8) seats (somente sem booking; 3 OCUPADOS vão na Etapa 2)
insert into public.seats (id, trip_id, seat_number, state, booking_id) values
  ('2c19eea0-a5a5-4e70-8389-5143584d0ce5', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '01', 'DISPONIVEL', NULL),
  ('2d9a9d29-c27f-47f6-8753-2581165901c7', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '02', 'DISPONIVEL', NULL),
  ('28316640-0a53-40cf-83a2-c44b7ff932b6', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '03', 'DISPONIVEL', NULL),
  ('c4f8d721-8fc0-4329-9dd3-303ae71e7271', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '04', 'DISPONIVEL', NULL),
  ('f7c1309a-3d94-4890-ac4c-da19ceb9e8ff', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '05', 'DISPONIVEL', NULL),
  ('86b08e0c-928d-44b0-903c-4ef7b5d141af', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '06', 'DISPONIVEL', NULL),
  ('f4ba991d-bd17-47af-b6b5-eb3f611703f5', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '07', 'DISPONIVEL', NULL),
  ('3ac28e3a-8c4e-4aee-9ef0-c220cc8922e2', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '08', 'DISPONIVEL', NULL),
  ('05382e0b-ae6f-42a4-bbf0-175be4e08718', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '09', 'DISPONIVEL', NULL),
  ('8bd909ac-def0-4b4d-b091-0e1f48bcea16', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '10', 'DISPONIVEL', NULL),
  ('8370b01a-48f0-444a-b789-3d52a9ab2f39', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '11', 'DISPONIVEL', NULL),
  ('5ec3c5a2-4bd4-4df1-bc5d-78ba5e63f4e1', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '12', 'DISPONIVEL', NULL),
  ('88e415a7-3682-4f55-9321-06c5cf3b5207', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '13', 'DISPONIVEL', NULL),
  ('47e32d1e-daf6-46e4-8d82-34e66fefe5c7', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '14', 'DISPONIVEL', NULL),
  ('169158b0-4180-4d92-9bb9-9b294fa98d43', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '15', 'DISPONIVEL', NULL),
  ('0282da9e-149e-4a6c-925f-1c1dfc6b3414', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '16', 'DISPONIVEL', NULL),
  ('e0c2adb1-4ad9-40f4-b0a9-074466e0ebdb', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '17', 'DISPONIVEL', NULL),
  ('e460dae5-f38f-4383-8237-8d8617a48b20', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '18', 'DISPONIVEL', NULL),
  ('e4cd8ddf-c1c1-427f-bf47-70b966fa8fc3', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '19', 'DISPONIVEL', NULL),
  ('261a8d6d-29d1-4f39-b0b6-c8c3336813df', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '20', 'DISPONIVEL', NULL),
  ('250a318b-2f06-430c-9b93-7e1ff63bbe8e', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '21', 'DISPONIVEL', NULL),
  ('eb31b8c6-7655-4b86-bdc1-fcb8ae899bcc', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '22', 'DISPONIVEL', NULL),
  ('a267d4b8-f097-4620-aae1-48bdb84c3503', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '23', 'DISPONIVEL', NULL),
  ('d3b5b2c5-f881-44a2-ab1d-9d748586de49', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '24', 'DISPONIVEL', NULL),
  ('1cfc2bda-9978-4130-a993-d6214e11884e', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '25', 'DISPONIVEL', NULL),
  ('7ee5ed43-523a-4df9-a6c5-71e6a6952c45', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '26', 'DISPONIVEL', NULL),
  ('da4027ea-3283-40fa-91a6-60361c3a57b5', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '27', 'DISPONIVEL', NULL),
  ('cbf4a0f1-7956-4dcc-961e-461eb59c1c34', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '28', 'DISPONIVEL', NULL),
  ('528203f1-face-4e3e-8fee-42970bf21854', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '29', 'DISPONIVEL', NULL),
  ('c8b37a0d-92cf-4915-b1aa-acdeaf0fa6b0', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '30', 'DISPONIVEL', NULL),
  ('8d2f2bf2-ce6d-46ee-bc92-128c59a10168', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '31', 'DISPONIVEL', NULL),
  ('59c92347-f462-4885-be85-40664494d845', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '32', 'DISPONIVEL', NULL),
  ('abb363cb-6761-4ae8-bd05-6c1df8fa36f9', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '33', 'DISPONIVEL', NULL),
  ('3e56d822-d8f2-4fbf-b83e-694d2cad86ff', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '34', 'DISPONIVEL', NULL),
  ('451338a0-3948-42cb-b666-c587371fc3ff', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '35', 'DISPONIVEL', NULL),
  ('34d6006d-e608-48fd-ab23-88cebd20286f', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '36', 'DISPONIVEL', NULL),
  ('7bdd8698-274b-46e8-aed8-f8195b82a6fb', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '37', 'DISPONIVEL', NULL),
  ('4af85244-5cb5-4095-ba1c-3acd7951771d', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '38', 'DISPONIVEL', NULL),
  ('5bacd86e-f049-4ca6-bd17-31e9fa904d52', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '39', 'DISPONIVEL', NULL),
  ('d4feacfa-3436-4d5e-9026-b4531d1c39a9', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '40', 'DISPONIVEL', NULL),
  ('a5d32e91-810e-4724-aa21-6f816d5760ab', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '41', 'DISPONIVEL', NULL),
  ('d3bf5e98-8b37-47ec-9937-631223a6e225', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '42', 'DISPONIVEL', NULL),
  ('7cb0f999-0a88-4ff1-90da-6bbfca7883e6', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '43', 'DISPONIVEL', NULL),
  ('1565f86a-eb9f-4bc9-bd5f-95d875427c20', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '44', 'DISPONIVEL', NULL),
  ('7e195b62-875a-4e77-b2f8-2894a9d0ef55', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '45', 'DISPONIVEL', NULL),
  ('73e32852-3cae-4342-9eef-d6d31047d77d', 'fe08b44a-4d86-4ba6-89c2-df227fbb1a3e', '46', 'DISPONIVEL', NULL),
  ('60bd4765-6a46-4cc6-be04-b8d78e52b976', '2e940a0e-162f-4220-ad54-a443bd6930b9', '01', 'DISPONIVEL', NULL),
  ('26fb0d2e-4bda-45f6-8e56-c23f25c19986', '2e940a0e-162f-4220-ad54-a443bd6930b9', '02', 'DISPONIVEL', NULL),
  ('4f5b0bbc-3e3b-4f75-8620-8c313c9c9b3b', '2e940a0e-162f-4220-ad54-a443bd6930b9', '03', 'DISPONIVEL', NULL),
  ('4f342d9a-0035-4db2-88be-7c75ff579a1c', '2e940a0e-162f-4220-ad54-a443bd6930b9', '04', 'DISPONIVEL', NULL),
  ('d25bc5d1-0550-46e6-a8ed-30bc745c182a', '2e940a0e-162f-4220-ad54-a443bd6930b9', '05', 'DISPONIVEL', NULL),
  ('34a24fb3-7567-4e82-99f4-8c99cec679d2', '2e940a0e-162f-4220-ad54-a443bd6930b9', '06', 'DISPONIVEL', NULL),
  ('408724e0-5ca1-4c0b-8c87-e65e15ba3086', '2e940a0e-162f-4220-ad54-a443bd6930b9', '07', 'DISPONIVEL', NULL),
  ('8a15e592-a226-42ac-a9e0-340e7216bb85', '2e940a0e-162f-4220-ad54-a443bd6930b9', '08', 'DISPONIVEL', NULL),
  ('eb97c1ed-365c-4872-b2f5-238776e5db02', '2e940a0e-162f-4220-ad54-a443bd6930b9', '09', 'DISPONIVEL', NULL),
  ('6e310b76-4d6d-4ec2-a7d4-5409de54e9f7', '2e940a0e-162f-4220-ad54-a443bd6930b9', '10', 'DISPONIVEL', NULL),
  ('8d17e78e-5dd8-4e45-8ce3-91ec2d8074e7', '2e940a0e-162f-4220-ad54-a443bd6930b9', '11', 'DISPONIVEL', NULL),
  ('c8f401e0-fa31-4133-b276-b59e354da689', '2e940a0e-162f-4220-ad54-a443bd6930b9', '12', 'DISPONIVEL', NULL),
  ('2f7a8145-31ff-4e3c-981e-0f1a7a8a0c8b', '2e940a0e-162f-4220-ad54-a443bd6930b9', '13', 'DISPONIVEL', NULL),
  ('5541a1ae-d691-48eb-9658-7e5d406b2775', '2e940a0e-162f-4220-ad54-a443bd6930b9', '14', 'DISPONIVEL', NULL),
  ('1c978eea-f15d-4a97-b405-8434a4f61ad4', '2e940a0e-162f-4220-ad54-a443bd6930b9', '15', 'DISPONIVEL', NULL),
  ('c82cb106-193e-4f0f-996d-ed7f61728636', '2e940a0e-162f-4220-ad54-a443bd6930b9', '16', 'DISPONIVEL', NULL),
  ('2a68325e-3336-4f3f-8b2e-24ab480172d0', '2e940a0e-162f-4220-ad54-a443bd6930b9', '17', 'DISPONIVEL', NULL),
  ('81155afd-e5ee-4e57-9c71-47f1148c0c05', '2e940a0e-162f-4220-ad54-a443bd6930b9', '18', 'DISPONIVEL', NULL),
  ('9977014e-1e74-4d95-a673-efb98b4951fd', '2e940a0e-162f-4220-ad54-a443bd6930b9', '19', 'DISPONIVEL', NULL),
  ('877ae00b-c721-40d0-b7b3-73b6dce7631f', '2e940a0e-162f-4220-ad54-a443bd6930b9', '20', 'DISPONIVEL', NULL),
  ('327cd9c8-416d-4f69-a2a1-643f454f572c', '2e940a0e-162f-4220-ad54-a443bd6930b9', '21', 'DISPONIVEL', NULL),
  ('5b39cdaa-b722-4cf8-b77d-df821e638afd', '2e940a0e-162f-4220-ad54-a443bd6930b9', '22', 'DISPONIVEL', NULL),
  ('dcc88652-8f9d-431e-8cc6-f6949878468b', '2e940a0e-162f-4220-ad54-a443bd6930b9', '23', 'DISPONIVEL', NULL),
  ('3679e423-2e66-4a25-8c85-a8b9bf53583b', '2e940a0e-162f-4220-ad54-a443bd6930b9', '24', 'DISPONIVEL', NULL),
  ('669b56f4-3de9-4958-866c-731c2e8aa0fe', '2e940a0e-162f-4220-ad54-a443bd6930b9', '25', 'DISPONIVEL', NULL),
  ('c0832100-cdae-44b4-bf88-5a181917a85e', '2e940a0e-162f-4220-ad54-a443bd6930b9', '26', 'DISPONIVEL', NULL),
  ('3f92d382-8269-4159-ba2c-d8bf0e1bb874', '2e940a0e-162f-4220-ad54-a443bd6930b9', '27', 'DISPONIVEL', NULL),
  ('55379373-0c7c-4c4e-9eb6-c449c2c0b522', '2e940a0e-162f-4220-ad54-a443bd6930b9', '28', 'DISPONIVEL', NULL),
  ('6f97a6b0-8e7e-473f-b3d3-da1aa37d00a8', '2e940a0e-162f-4220-ad54-a443bd6930b9', '29', 'DISPONIVEL', NULL),
  ('0c88c122-12e2-4a45-ac09-61dd6ff26d1a', '2e940a0e-162f-4220-ad54-a443bd6930b9', '30', 'DISPONIVEL', NULL),
  ('6bfd488c-0b46-4f07-929d-d18b23589537', '2e940a0e-162f-4220-ad54-a443bd6930b9', '31', 'DISPONIVEL', NULL),
  ('a30d911e-4ced-405e-b084-60cb372cfe6b', '2e940a0e-162f-4220-ad54-a443bd6930b9', '32', 'DISPONIVEL', NULL),
  ('0ef01452-aeb8-4d36-b8bd-3af48b45c932', '2e940a0e-162f-4220-ad54-a443bd6930b9', '33', 'DISPONIVEL', NULL),
  ('143ac24a-d6fc-4168-bd43-44cc6821c406', '2e940a0e-162f-4220-ad54-a443bd6930b9', '34', 'DISPONIVEL', NULL),
  ('14e3bd56-4e92-49c9-883c-ef0eb72c291c', '2e940a0e-162f-4220-ad54-a443bd6930b9', '35', 'DISPONIVEL', NULL),
  ('d04517ed-97f8-47d9-860b-6149ce2614fb', '2e940a0e-162f-4220-ad54-a443bd6930b9', '36', 'DISPONIVEL', NULL),
  ('32228d71-3dfe-4edf-8be4-6b0ec008a314', '2e940a0e-162f-4220-ad54-a443bd6930b9', '37', 'DISPONIVEL', NULL),
  ('f7b64d82-855a-4a26-8b22-3be1d22b847d', '2e940a0e-162f-4220-ad54-a443bd6930b9', '38', 'DISPONIVEL', NULL),
  ('db2fd182-1bbb-40e3-8242-0df0e00a8b61', '2e940a0e-162f-4220-ad54-a443bd6930b9', '39', 'DISPONIVEL', NULL),
  ('30fb5e3a-f1b9-489e-8c59-11dd4c7884bd', '2e940a0e-162f-4220-ad54-a443bd6930b9', '40', 'DISPONIVEL', NULL)
on conflict (id) do nothing;

commit;
