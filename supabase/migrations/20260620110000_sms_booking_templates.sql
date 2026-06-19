-- SMS 템플릿 시드: 예약 확정 / 여행 완료
insert into public.sms_templates (title, body, category, variables, is_active, sort_order)
select
  '예약 확정 안내',
  '[더올투어 예약확정]
{{name}}님, 예약이 확정되었습니다.

예약번호: {{booking_number}}
상품: {{product_title}}
출발일: {{departure_date}}
인원: {{traveler_count}}명

감사합니다.',
  'booking_confirmed',
  '["name","booking_number","product_title","departure_date","traveler_count"]'::jsonb,
  true,
  10
where not exists (
  select 1 from public.sms_templates where category = 'booking_confirmed' and is_active = true
);

insert into public.sms_templates (title, body, category, variables, is_active, sort_order)
select
  '여행 완료 안내',
  '[더올투어 여행완료]
{{name}}님, 여행이 완료되었습니다.

예약번호: {{booking_number}}
{{reward_hint}}

감사합니다.',
  'trip_completed',
  '["name","booking_number","reward_hint","review_link"]'::jsonb,
  true,
  20
where not exists (
  select 1 from public.sms_templates where category = 'trip_completed' and is_active = true
);
