-- 우리가족 여행기록장: 방문 장소 트리 구조 및 맛집 전용 정보
-- 기존 방문 장소·숙소 데이터는 보존하고 선택형 컬럼만 추가합니다.
-- Supabase SQL Editor에서 한 번 실행해 주세요.

-- 관광지 아래에 주변 식당·카페 등을 연결하는 트리 관계
alter table public.journal_places
  add column if not exists parent_place_client_id text
    references public.journal_places(client_id) on delete set null;

create index if not exists journal_places_parent_place_idx
  on public.journal_places(parent_place_client_id);

-- 맛집·카페 전용 항목 (다른 종류의 장소에서는 비워 두어도 됩니다)
alter table public.journal_places
  add column if not exists cuisine_type text,
  add column if not exists meal_type text,
  add column if not exists ordered_menu text[] not null default '{}'::text[],
  add column if not exists family_feedback text,
  add column if not exists dad_rating smallint check (dad_rating between 1 and 5),
  add column if not exists suho_rating smallint check (suho_rating between 1 and 5),
  add column if not exists hyeonah_rating smallint check (hyeonah_rating between 1 and 5),
  add column if not exists revisit_recommendation boolean not null default false;

-- 숙소도 방문 장소 트리에 선택적으로 연결할 수 있게 합니다.
-- 연결하지 않으면 여행 전체의 숙소로 표시됩니다.
alter table public.journal_stays
  add column if not exists stay_type text,
  add column if not exists related_place_client_id text
    references public.journal_places(client_id) on delete set null;

create index if not exists journal_stays_related_place_idx
  on public.journal_stays(related_place_client_id);
