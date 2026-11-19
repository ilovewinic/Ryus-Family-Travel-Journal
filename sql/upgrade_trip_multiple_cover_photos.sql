-- 우리 가족 여행기록장: 여행별 대표사진 최대 3장 지원
-- 기존 cover_photo_id 값은 첫 번째 대표사진으로 보존합니다.
-- 기존 여행 기록, 사진 파일, 경비 등은 삭제하지 않습니다.
-- Supabase SQL Editor에서 한 번 실행해 주세요.

alter table public.journals
  add column if not exists cover_photo_ids text[] not null default '{}'::text[];

-- 기존에 대표사진을 지정했던 모든 여행은 첫 번째 사진으로 승계합니다.
update public.journals
set cover_photo_ids = array[cover_photo_id]
where cover_photo_id is not null
  and coalesce(array_length(cover_photo_ids, 1), 0) = 0;

-- cover_photo_ids만 기록된 경우에도 기존 화면과 호환되도록 첫 번째 값을 유지합니다.
update public.journals
set cover_photo_id = cover_photo_ids[1]
where cover_photo_id is null
  and coalesce(array_length(cover_photo_ids, 1), 0) > 0;

comment on column public.journals.cover_photo_ids is
  '여행별 대표사진 최대 3장의 photo ID 목록. cover_photo_id는 구버전 호환용 첫 번째 ID입니다.';

-- 대표사진별 확대 위치·배율을 가족 기기 간 공유하는 설정 칸도 함께 준비합니다.
-- 이미 추가한 경우에는 건너뛰므로 반복 실행해도 안전합니다.
alter table public.family_home_settings
  add column if not exists featured_photo_crops jsonb not null default '{}'::jsonb;

comment on column public.family_home_settings.featured_photo_crops is
  '대표 여행 사진별 메인 배너 구도 설정 (photo id -> mode, x, y, zoom)';
