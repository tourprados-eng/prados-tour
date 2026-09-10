-- Prado's Tour / FASE 6 - ETAPA 2.2 (identidade alinhada à especificação)
-- Identidade obrigatória: primary #E84C91, secondary #F28C28, background #FFF9FC,
-- font Arial, font_size 16px. Não criar outro logo (mantém logoUrl/bannerUrl atuais).

begin;

update public.settings
set value = jsonb_set(
  jsonb_set(
    jsonb_set(value, '{background}', '"#FFF9FC"'),
    '{font}', '"Arial"'
  ),
  '{fontSize}', '"16"'
),
updated_at = now()
where key = 'brand';

commit;