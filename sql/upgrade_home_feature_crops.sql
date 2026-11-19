-- 우리 가족 여행기록장: 메인 대표사진의 개인별 구도 설정
-- 기존 가족 공통 설정 및 여행/사진 데이터는 변경하거나 삭제하지 않습니다.
-- Supabase SQL Editor에서 한 번 실행해 주세요.

alter table public.family_home_settings
  add column if not exists featured_photo_crops jsonb not null default '{}'::jsonb;

comment on column public.family_home_settings.featured_photo_crops is
  '대표 여행 사진별 메인 배너 구도 설정 (photo id -> mode, x, y, zoom)';

grant select, insert, update
  on public.family_home_settings
  to authenticated;
