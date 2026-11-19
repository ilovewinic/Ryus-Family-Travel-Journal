(() => {
  'use strict';

  // Supabase login bridge + family-only travel upgrades.
  // This file replaces the existing ryus-family-travel-supabase-auth.js.
  const SUPABASE_URL = 'https://pccgvfmvzaqhxsinquiv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LS7tlROmDZ05etj_k-L7Cg_6d6_M5mk';
  const STORAGE_KEY = 'familyTravelPreview_v2';
  const PHOTO_DB_NAME = 'familyTravelPhotos_v2';
  const PHOTO_DB_STORE = 'originals';
  const WORKER_URL = 'https://ryus-family-photo.ilovewinic.workers.dev';

  let resolveAuthReady;
  window.__familyAuthReady = new Promise(resolve => { resolveAuthReady = resolve; });

  const style = document.createElement('style');
  style.textContent = `
    body.auth-pending .app { visibility:hidden; }
    #familyAuthGate{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#fff6e8,#fcebed 55%,#eaf6fb);font-family:ui-rounded,"Nunito Sans",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR",sans-serif;color:#28354b}
    #familyAuthGate[hidden]{display:none}
    .auth-card{width:min(420px,100%);padding:30px 27px;background:#fff;border:1px solid #eee7dc;border-radius:25px;box-shadow:0 18px 50px #65758b20}
    .auth-logo{width:58px;height:58px;margin:0 auto 13px;display:grid;place-items:center;border-radius:20px;background:linear-gradient(135deg,#ffd987,#ffaaa0);font-size:29px}
    .auth-card h2{text-align:center;margin:0 0 7px;font-size:22px;letter-spacing:-.7px}
    .auth-sub{text-align:center;color:#7a8798;font-size:12px;line-height:1.6;margin:0 0 22px}
    .auth-field{display:block;margin:12px 0}
    .auth-field span{display:block;margin:0 0 6px;font-size:11px;font-weight:800;color:#657286}
    .auth-field input{width:100%;padding:12px;border:1px solid #e8e9ec;border-radius:11px;font:inherit;font-size:13px;outline:none}
    .auth-field input:focus{border-color:#9bcce1;box-shadow:0 0 0 3px #dff1f9}
    .auth-submit{width:100%;margin-top:9px;padding:13px;border:0;border-radius:13px;background:#f28f83;color:white;font-weight:900;font-size:13px;cursor:pointer}
    .auth-links{display:flex;justify-content:center;gap:15px;margin-top:15px}
    .auth-link{border:0;background:none;color:#718096;text-decoration:underline;font-size:11px;cursor:pointer}
    #authMessage{min-height:18px;margin:12px 0 0;text-align:center;color:#b45f56;font-size:11px;line-height:1.5}
    .auth-user{display:flex;align-items:center;gap:8px}
    .auth-user-name{font-size:11px;color:#657286;font-weight:800}
    .auth-small-btn{border:1px solid #eee7dc;background:#fff;color:#657286;border-radius:999px;padding:8px 10px;font-size:10px;font-weight:800;cursor:pointer}
    body.auth-child #addTripTop,body.auth-child #addTripList,body.auth-child #deleteTripBtn,body.auth-child #tripFiles,body.auth-child #togglePicker{display:none!important}
    body.auth-child .hero-cta{display:none!important}
    body.auth-child #view-expenses,body.auth-child [data-view="expenses"]{display:none!important}
    body.auth-child .family-extra-panel{display:none!important}
    body.auth-child #tripForm input,body.auth-child #tripForm select,body.auth-child #tripForm textarea{pointer-events:none;background:#f6f7f8;color:#7a8798}
    body.auth-child #tripForm button[type="submit"]{display:none!important}
    body.auth-child #tripForm .modal-actions .right-actions .secondary{display:none!important}

    /* Travel journal enhancements */
    .trip-cover{display:flex!important;align-items:center!important;justify-content:center!important;background:linear-gradient(145deg,#fff7e7,#edf7fb)!important;overflow:hidden!important}
    .trip-cover img{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;background:transparent!important}
    .family-extra-panel{margin-top:18px;padding:17px;border:1px solid #eee7dc;border-radius:18px;background:linear-gradient(135deg,#fffdf8,#f8fcff)}
    .family-extra-panel h4{margin:0 0 6px;font-size:15px;color:#344258}
    .family-extra-help{margin:0 0 13px;color:#8792a1;font-size:11px;line-height:1.6}
    .cover-choice-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:9px}
    .cover-choice{padding:7px;border:2px solid #eee7dc;border-radius:13px;background:#fff;text-align:left;color:#59677a;min-width:0}
    .cover-choice.selected{border-color:#f28f83;background:#fff5f1;box-shadow:0 0 0 2px #f28f8320}
    .cover-choice img{display:block;width:100%;height:76px;object-fit:contain;background:#f7f8f8;border-radius:8px}
    .cover-choice span{display:block;margin-top:6px;font-size:10px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cover-choice small{display:block;margin-top:3px;color:#8a96a5;font-size:9px}
    .family-expense-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0}
    .family-expense-form label{display:block;font-size:10px;color:#778397;font-weight:800}
    .family-expense-form input,.family-expense-form select,.family-expense-form textarea{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #e7e9ed;border-radius:10px;background:white;color:#344258;font-size:12px;min-width:0}
    .family-expense-form .wide{grid-column:span 2}
    .family-expense-form .full{grid-column:1/-1}
    .family-expense-form button{grid-column:1/-1;justify-self:start;padding:10px 14px;border-radius:11px;background:#f28f83;color:white;font-size:11px;font-weight:900}
    .expense-total-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 13px}
    .expense-total-chip{padding:8px 11px;border-radius:12px;background:#fff3e8;color:#8a6942;font-size:11px;font-weight:900}
    .expense-entry-list{display:grid;gap:7px}
    .expense-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid #f0ece6;border-radius:12px;background:white}
    .expense-entry strong{display:block;font-size:12px;color:#3c4a60}
    .expense-entry small{display:block;margin-top:3px;font-size:10px;color:#8993a1;line-height:1.5}
    .expense-entry .expense-value{font-size:12px;font-weight:900;white-space:nowrap;color:#52677b;text-align:right}
    .expense-delete{margin-top:4px;padding:4px 7px;border-radius:8px;background:#fff0ec;color:#bd655b;font-size:9px}
    .expense-dashboard-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:15px}
    .expense-dashboard-head h2{margin:0;font-size:24px}
    .expense-dashboard-head p{margin:5px 0 0;color:#8792a1;font-size:12px}
    .expense-dashboard-totals{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
    .expense-dashboard-total{min-width:150px;padding:15px 17px;border-radius:16px;background:#fff;border:1px solid #eee7dc;box-shadow:0 5px 16px #58677a0b}
    .expense-dashboard-total span{display:block;color:#8993a1;font-size:10px}
    .expense-dashboard-total strong{display:block;margin-top:6px;font-size:19px;color:#3e5267}
    .expense-dashboard-list{display:grid;gap:8px}
    .expense-empty{padding:22px;border:1px dashed #e7e2da;border-radius:15px;color:#8993a1;text-align:center;font-size:12px;background:#fff}
    @media(max-width:720px){
      .family-expense-form{grid-template-columns:repeat(2,minmax(0,1fr))}
      .family-expense-form .wide{grid-column:span 2}
      .expense-dashboard-head{align-items:flex-start;flex-direction:column}
      .expense-entry{align-items:flex-start}
    }
  `;
  document.head.appendChild(style);
  document.body.classList.add('auth-pending');

  const gate = document.createElement('div');
  gate.id = 'familyAuthGate';
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">✈️</div>
      <h2>우리 가족 여행 앨범</h2>
      <p class="auth-sub">가족 계정으로 로그인해<br>함께한 여행의 추억을 만나보세요.</p>
      <form id="familyLoginForm">
        <label class="auth-field"><span>이메일</span><input id="familyEmail" type="email" autocomplete="username" required placeholder="등록한 이메일 주소"></label>
        <label class="auth-field"><span>비밀번호</span><input id="familyPassword" type="password" autocomplete="current-password" required placeholder="비밀번호"></label>
        <button class="auth-submit" id="familyLoginButton" type="submit">로그인하기</button>
      </form>
      <div class="auth-links"><button class="auth-link" id="familyResetButton" type="button">비밀번호 재설정 메일 받기</button></div>
      <p id="authMessage" role="status"></p>
    </div>`;
  document.body.appendChild(gate);

  const message = (text, good = false) => {
    const el = document.getElementById('authMessage');
    if (el) { el.textContent = text; el.style.color = good ? '#43856d' : '#b45f56'; }
  };
  const loadSupabase = () => new Promise((resolve, reject) => {
    if (window.supabase?.createClient) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = () => window.supabase?.createClient ? resolve() : reject(new Error('Supabase 라이브러리를 불러오지 못했습니다.'));
    s.onerror = () => reject(new Error('Supabase 연결 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });

  let client = null;
  let familyProfile = null;
  let syncing = false;
  let syncTimer = null;
  let activeDetailTripId = null;
  let homeExpensePhotoUrls = [];
  let coverRenderToken = 0;
  let cardCoverRenderToken = 0;
  const coverObjectURLs = new Map();
  let chooserObjectURLs = [];
  let representativeCropDraft = null;
  let representativeCropDrag = null;
  let activeRepresentativePhotoId = null;
  const photoDeletesInProgress = new Set();

  function localState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { trips: Array.isArray(value.trips) ? value.trips : [], photos: Array.isArray(value.photos) ? value.photos : [] };
    } catch (_) { return { trips: [], photos: [] }; }
  }
  function saveLocalState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      trips: Array.isArray(state.trips) ? state.trips : [],
      photos: Array.isArray(state.photos) ? state.photos : []
    }));
  }
  function getTripCoverPhotoIds(trip) {
    const raw = Array.isArray(trip?.coverPhotoIds)
      ? trip.coverPhotoIds
      : (trip?.coverPhotoId ? [trip.coverPhotoId] : []);
    return [...new Set(raw.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 3);
  }
  function isMissingCoverPhotoIdsColumn(error) {
    const message = String(error?.message || '') + ' ' + String(error?.details || '');
    return error?.code === '42703' || error?.code === 'PGRST204' ||
      /cover_photo_ids|schema cache|column .* does not exist/i.test(message);
  }
  async function updateTripCoverSelection(clientId, photoIds) {
    const ids = [...new Set((Array.isArray(photoIds) ? photoIds : []).map(String).filter(Boolean))].slice(0, 3);
    let multipleSynced = true;
    let result = await client.from('journals')
      .update({ cover_photo_id: ids[0] || null, cover_photo_ids: ids })
      .eq('client_id', String(clientId));
    if (result.error && isMissingCoverPhotoIdsColumn(result.error)) {
      multipleSynced = false;
      result = await client.from('journals')
        .update({ cover_photo_id: ids[0] || null })
        .eq('client_id', String(clientId));
      if (!result.error) console.warn('[대표사진 3장] SQL 확장 전이므로 첫 번째 대표사진만 클라우드에 저장됩니다.');
    }
    if (result.error) throw new Error('대표사진을 가족 계정에 저장하지 못했습니다: ' + result.error.message);
    return { ids, multipleSynced };
  }
  async function upsertJournalRowsCompat(rows, options = {}) {
    if (!rows.length) return { error: null };
    let result = await client.from('journals').upsert(rows, options);
    if (result.error && isMissingCoverPhotoIdsColumn(result.error)) {
      const legacyRows = rows.map(({ cover_photo_ids, ...row }) => row);
      result = await client.from('journals').upsert(legacyRows, options);
      if (!result.error) {
        console.warn('[대표사진 3장] Supabase에 cover_photo_ids 컬럼이 없습니다. 기존 대표사진 1장만 동기화 중입니다. SQL 확장을 실행해 주세요.');
      }
    }
    return result;
  }
  function toRow(t) {
    return {
      client_id: String(t.id),
      title: String(t.title || '제목 없는 여행'),
      location: String(t.place || '장소 미지정'),
      visit_date: t.date || new Date().toISOString().slice(0, 10),
      content: String(t.memo || ''),
      trip_type: t.type === 'overseas' ? 'overseas' : 'domestic',
      country: String(t.country || '대한민국'),
      region: t.region || null,
      latitude: t.lat === '' || t.lat == null ? null : Number(t.lat),
      longitude: t.lng === '' || t.lng == null ? null : Number(t.lng),
      cover_photo_id: getTripCoverPhotoIds(t)[0] || null,
      cover_photo_ids: getTripCoverPhotoIds(t),
      end_date: t.endDate || null,
      companions: Array.isArray(t.companions) ? t.companions : [],
      transport: t.transport || null
    };
  }
  function fromRow(r) {
    return {
      id: String(r.client_id || `legacy-${r.id}`),
      title: r.title || '',
      date: r.visit_date || '',
      type: r.trip_type || 'domestic',
      country: r.country || '대한민국',
      place: r.location || '',
      region: r.region || '',
      memo: r.content || '',
      lat: r.latitude == null ? '' : r.latitude,
      lng: r.longitude == null ? '' : r.longitude,
      coverPhotoId: (Array.isArray(r.cover_photo_ids) && r.cover_photo_ids.length ? r.cover_photo_ids[0] : r.cover_photo_id) || null,
      coverPhotoIds: [...new Set((Array.isArray(r.cover_photo_ids) && r.cover_photo_ids.length ? r.cover_photo_ids : (r.cover_photo_id ? [r.cover_photo_id] : [])).map(String))].slice(0, 3),
      endDate: r.end_date || '',
      companions: Array.isArray(r.companions) ? r.companions : [],
      transport: r.transport || ''
    };
  }

  const HOME_FEATURED_STORAGE_KEY = 'ryusFamilyHomeFeatureIds_v1';
  const HOME_FEATURED_CROPS_STORAGE_KEY = 'ryusFamilyHomeFeatureCrops_v1';
  function cleanHomeFeaturedIds(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 5);
  }
  function readLocalHomeFeaturedIds() {
    try { return cleanHomeFeaturedIds(JSON.parse(localStorage.getItem(HOME_FEATURED_STORAGE_KEY) || '[]')); }
    catch (_) { return []; }
  }
  window.loadFamilyHomeFeaturedIds = async function() {
    const localIds = readLocalHomeFeaturedIds();
    if (!client || !familyProfile) return localIds;
    const { data, error } = await client
      .from('family_home_settings')
      .select('featured_trip_ids')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      const message = String(error.message || '');
      if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(message)) {
        console.warn('[메인 대표 여행] 설정 테이블이 아직 없습니다. SQL 업그레이드 후 가족 기기 간 동기화가 가능합니다.');
        return localIds;
      }
      throw new Error('메인 대표 여행 설정을 불러오지 못했습니다: ' + message);
    }
    const ids = cleanHomeFeaturedIds(data?.featured_trip_ids);
    localStorage.setItem(HOME_FEATURED_STORAGE_KEY, JSON.stringify(ids));
    return ids;
  };
  window.saveFamilyHomeFeaturedIds = async function(values) {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 첫 화면 대표 여행을 변경할 수 있습니다.');
    const ids = cleanHomeFeaturedIds(values);
    if (ids.length > 5) throw new Error('첫 화면에는 최대 5개까지 선택할 수 있습니다.');
    const { error } = await client
      .from('family_home_settings')
      .upsert({
        id: 1,
        featured_trip_ids: ids,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(String(error.message || ''))) {
        throw new Error('가족 공통 대표 여행 설정 테이블이 아직 없습니다. 안내된 SQL을 Supabase에서 먼저 실행해 주세요.');
      }
      throw new Error('메인 대표 여행을 가족 계정에 저장하지 못했습니다: ' + error.message);
    }
    localStorage.setItem(HOME_FEATURED_STORAGE_KEY, JSON.stringify(ids));
    return ids;
  };
  function cleanHomeFeatureCrops(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const cleaned = {};
    Object.entries(values).forEach(([photoId, value]) => {
      if (!photoId || !value || typeof value !== 'object') return;
      const number = (candidate, fallback) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
      cleaned[String(photoId)] = {
        mode: value.mode === 'crop' ? 'crop' : 'full',
        x: clamp(number(value.x, 50), 0, 100),
        y: clamp(number(value.y, 50), 0, 100),
        zoom: clamp(number(value.zoom, 1), 1, 2.6)
      };
    });
    return cleaned;
  }
  function readLocalHomeFeatureCrops() {
    try {
      return cleanHomeFeatureCrops(JSON.parse(localStorage.getItem(HOME_FEATURED_CROPS_STORAGE_KEY) || '{}'));
    } catch (_) {
      return {};
    }
  }
  window.loadFamilyHomeFeaturedCrops = async function() {
    const localCrops = readLocalHomeFeatureCrops();
    if (!client || !familyProfile) return localCrops;
    const { data, error } = await client
      .from('family_home_settings')
      .select('featured_photo_crops')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204' ||
          /featured_photo_crops|schema cache|column .* does not exist/i.test(String(error.message || ''))) {
        console.warn('[대표사진 구도] Supabase 칸이 아직 없습니다. SQL 확장 후 가족 기기 간 동기화가 가능합니다.');
        return localCrops;
      }
      throw new Error('대표사진 구도를 불러오지 못했습니다: ' + error.message);
    }
    const crops = cleanHomeFeatureCrops(data?.featured_photo_crops || {});
    localStorage.setItem(HOME_FEATURED_CROPS_STORAGE_KEY, JSON.stringify(crops));
    return crops;
  };
  window.saveFamilyHomeFeaturedCrops = async function(values) {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 대표사진 구도를 변경할 수 있습니다.');
    const crops = cleanHomeFeatureCrops(values);
    localStorage.setItem(HOME_FEATURED_CROPS_STORAGE_KEY, JSON.stringify(crops));
    if (!client || !familyProfile) return { synced: false };
    const { error } = await client
      .from('family_home_settings')
      .upsert({
        id: 1,
        featured_trip_ids: readLocalHomeFeaturedIds(),
        featured_photo_crops: crops,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204' ||
          /featured_photo_crops|schema cache|column .* does not exist/i.test(String(error.message || ''))) {
        return { synced: false, reason: 'migration-required' };
      }
      throw new Error(error.message);
    }
    return { synced: true };
  };
  async function getFamilyProfile(userId) {
    const { data, error } = await client
      .from('family_members')
      .select('user_id,display_name,role')
      .eq('user_id', userId)
      .single();
    if (error) throw new Error('가족 계정 등록 정보를 확인하지 못했습니다: ' + error.message);
    if (!data || !['parent', 'child'].includes(data.role)) throw new Error('가족 계정 권한이 올바르지 않습니다.');
    return data;
  }
  // ---------- Multi-place itinerary and accommodation records ----------
  window.isFamilyPhotoParent = () => familyProfile?.role === 'parent';

  window.loadFamilyTripDetails = async function() {
    if (!client || !familyProfile) return { places: [], stays: [] };
    const [{ data: journals, error: journalError }, { data: places, error: placeError }, { data: stays, error: stayError }] = await Promise.all([
      client.from('journals').select('id,client_id'),
      client.from('journal_places').select('client_id,journal_id,name,category,visit_date,visit_time,sequence,address,region,latitude,longitude,memo,rating,is_favorite,visit_status,parent_place_client_id,cuisine_type,meal_type,ordered_menu,family_feedback,dad_rating,suho_rating,hyeonah_rating,revisit_recommendation').order('visit_date', { ascending: true }).order('sequence', { ascending: true }),
      client.from('journal_stays').select('client_id,journal_id,name,check_in,check_in_time,check_out,check_out_time,address,region,latitude,longitude,memo,rating,stay_type,related_place_client_id').order('check_in', { ascending: true })
    ]);
    if (journalError) throw new Error('여행 연결 정보를 읽지 못했습니다: ' + journalError.message);
    if (placeError) throw new Error('방문 장소를 불러오지 못했습니다: ' + placeError.message);
    if (stayError) throw new Error('숙소 기록을 불러오지 못했습니다: ' + stayError.message);
    const idMap = new Map((journals || []).map(row => [String(row.id), String(row.client_id)]));
    return {
      places: (places || []).filter(row => idMap.has(String(row.journal_id))).map(row => ({
        clientId: String(row.client_id), tripId: idMap.get(String(row.journal_id)),
        name: row.name || '', category: row.category || 'attraction',
        visitDate: row.visit_date || '', visitTime: row.visit_time || '',
        sequence: Number(row.sequence || 0), address: row.address || '',
        region: row.region || '', lat: row.latitude == null ? '' : Number(row.latitude),
        lng: row.longitude == null ? '' : Number(row.longitude), memo: row.memo || '',
        rating: row.rating == null ? '' : Number(row.rating), favorite: !!row.is_favorite,
        status: row.visit_status || 'visited',
        parentPlaceClientId: row.parent_place_client_id || '',
        cuisineType: row.cuisine_type || '', mealType: row.meal_type || '',
        orderedMenu: Array.isArray(row.ordered_menu) ? row.ordered_menu : [],
        familyFeedback: row.family_feedback || '',
        dadRating: row.dad_rating == null ? '' : Number(row.dad_rating),
        suhoRating: row.suho_rating == null ? '' : Number(row.suho_rating),
        hyeonahRating: row.hyeonah_rating == null ? '' : Number(row.hyeonah_rating),
        revisitRecommendation: !!row.revisit_recommendation
      })),
      stays: (stays || []).filter(row => idMap.has(String(row.journal_id))).map(row => ({
        clientId: String(row.client_id), tripId: idMap.get(String(row.journal_id)),
        name: row.name || '', checkIn: row.check_in || '', checkInTime: row.check_in_time || '',
        checkOut: row.check_out || '', checkOutTime: row.check_out_time || '',
        address: row.address || '', region: row.region || '',
        lat: row.latitude == null ? '' : Number(row.latitude),
        lng: row.longitude == null ? '' : Number(row.longitude),
        memo: row.memo || '', rating: row.rating == null ? '' : Number(row.rating),
        stayType: row.stay_type || '', relatedPlaceClientId: row.related_place_client_id || ''
      }))
    };
  };

  window.saveFamilyTripDetails = async function(tripId, payload = {}) {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 여행 세부 기록을 수정할 수 있습니다.');
    if (!client) throw new Error('가족 데이터 연결이 준비되지 않았습니다.');
    let journal = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { data, error } = await client.from('journals').select('id,client_id').eq('client_id', String(tripId)).maybeSingle();
      if (error) throw new Error('여행 기록을 연결하지 못했습니다: ' + error.message);
      if (data) { journal = data; break; }
      await delay(220);
    }
    if (!journal) throw new Error('여행 기본 정보를 클라우드에서 찾지 못했습니다. 여행 저장 후 잠시 뒤 다시 시도해 주세요.');

    const tripUpdate = {
      end_date: payload.endDate || null,
      companions: Array.isArray(payload.companions) ? [...new Set(payload.companions.map(String).filter(Boolean))] : [],
      transport: payload.transport || null
    };
    const { error: updateError } = await client.from('journals').update(tripUpdate).eq('id', journal.id);
    if (updateError) throw new Error('여행 기간·동행 정보를 저장하지 못했습니다: ' + updateError.message);

    async function replaceChildren(table, rows, kind) {
      const { data: existing, error: readError } = await client.from(table).select('client_id').eq('journal_id', journal.id);
      if (readError) throw new Error((kind === 'places' ? '방문 장소' : '숙소') + ' 기존 기록을 확인하지 못했습니다: ' + readError.message);
      const normalized = (Array.isArray(rows) ? rows : []).filter(row => String(row.name || '').trim()).map((row, index) => {
        const common = {
          client_id: String(row.clientId || row.client_id || (kind + '_' + Date.now().toString(36) + '_' + index + '_' + Math.random().toString(36).slice(2, 7))),
          journal_id: journal.id,
          name: String(row.name).trim(),
          address: row.address || null, region: row.region || null,
          latitude: row.lat === '' || row.lat == null ? null : Number(row.lat),
          longitude: row.lng === '' || row.lng == null ? null : Number(row.lng),
          memo: row.memo || null,
          rating: row.rating === '' || row.rating == null ? null : Number(row.rating)
        };
        if (kind === 'places') return {
          ...common, category: row.category || 'attraction',
          visit_date: row.visitDate || null, visit_time: row.visitTime || null,
          sequence: Number(row.sequence ?? index), is_favorite: !!row.favorite,
          visit_status: row.status === 'planned' ? 'planned' : 'visited',
          parent_place_client_id: row.parentPlaceClientId || null,
          cuisine_type: row.cuisineType || null, meal_type: row.mealType || null,
          ordered_menu: Array.isArray(row.orderedMenu) ? row.orderedMenu : [],
          family_feedback: row.familyFeedback || null,
          dad_rating: row.dadRating === '' || row.dadRating == null ? null : Number(row.dadRating),
          suho_rating: row.suhoRating === '' || row.suhoRating == null ? null : Number(row.suhoRating),
          hyeonah_rating: row.hyeonahRating === '' || row.hyeonahRating == null ? null : Number(row.hyeonahRating),
          revisit_recommendation: !!row.revisitRecommendation
        };
        return {
          ...common, check_in: row.checkIn, check_in_time: row.checkInTime || null,
          check_out: row.checkOut, check_out_time: row.checkOutTime || null,
          stay_type: row.stayType || null,
          related_place_client_id: row.relatedPlaceClientId || null
        };
      });

      const wanted = new Set(normalized.map(row => row.client_id));
      const obsolete = (existing || []).map(row => String(row.client_id)).filter(id => !wanted.has(id));
      if (obsolete.length) {
        const { error: deleteError } = await client.from(table).delete().eq('journal_id', journal.id).in('client_id', obsolete);
        if (deleteError) throw new Error((kind === 'places' ? '방문 장소' : '숙소') + ' 삭제 내용을 저장하지 못했습니다: ' + deleteError.message);
      }
      if (normalized.length) {
        const { error: upsertError } = await client.from(table).upsert(normalized, { onConflict: 'client_id' });
        if (upsertError) throw new Error((kind === 'places' ? '방문 장소' : '숙소') + ' 내용을 저장하지 못했습니다: ' + upsertError.message);
      }
      return normalized;
    }

    await replaceChildren('journal_places', payload.places, 'places');
    await replaceChildren('journal_stays', payload.stays, 'stays');
    return true;
  };

  async function loadDeletedTripIds() {
    const { data, error } = await client
      .from('deleted_journals')
      .select('client_id');
    if (error) throw new Error('삭제된 여행 기록 상태를 확인하지 못했습니다: ' + error.message);
    return new Set((data || []).map(row => String(row.client_id)));
  }
  async function loadCloudTrips(deletedIds = new Set()) {
    let result = await client
      .from('journals')
      .select('id,client_id,title,location,visit_date,content,trip_type,country,region,latitude,longitude,cover_photo_id,cover_photo_ids,end_date,companions,transport')
      .order('visit_date', { ascending: false });
    if (result.error && isMissingCoverPhotoIdsColumn(result.error)) {
      result = await client
        .from('journals')
        .select('id,client_id,title,location,visit_date,content,trip_type,country,region,latitude,longitude,cover_photo_id,end_date,companions,transport')
        .order('visit_date', { ascending: false });
      if (!result.error) console.warn('[대표사진 3장] SQL 확장 전이라 클라우드에서는 기존 대표사진 1장만 불러옵니다.');
    }
    if (result.error) throw new Error('가족 여행 기록을 불러오지 못했습니다: ' + result.error.message);
    return (result.data || []).filter(row => !deletedIds.has(String(row.client_id))).map(fromRow);
  }
  async function deleteLocalPhotoBlobs(photoIds) {
    if (!photoIds.length) return;
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(PHOTO_DB_NAME, 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_DB_STORE, 'readwrite');
        const store = tx.objectStore(PHOTO_DB_STORE);
        photoIds.forEach(id => store.delete(id));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('로컬 사진 파일 정리에 실패했습니다.'));
      });
      db.close();
    } catch (error) {
      console.warn('[여행 삭제] 이 기기의 사진 임시 파일 정리 실패:', error);
    }
  }
  async function migrateLocalTrips(deletedIds) {
    const current = localState();
    const safeTrips = current.trips.filter(t => !deletedIds.has(String(t.id)));
    if (safeTrips.length) {
      const rows = safeTrips.map(toRow);
      const { error } = await upsertJournalRowsCompat(rows, {
        onConflict: 'client_id',
        ignoreDuplicates: true
      });
      if (error) throw new Error('이 기기의 기존 여행 기록을 옮기지 못했습니다: ' + error.message);
    }
  }
  async function syncParentTrips() {
    if (!client || familyProfile?.role !== 'parent' || syncing) return;
    const current = localState();
    if (!current.trips.length) return;
    syncing = true;
    try {
      const deletedIds = await loadDeletedTripIds();
      const rows = current.trips.filter(t => !deletedIds.has(String(t.id))).map(toRow);
      if (!rows.length) return;
      const { error } = await upsertJournalRowsCompat(rows, { onConflict: 'client_id' });
      if (error) console.error('여행 기록 클라우드 저장 실패:', error.message);
    } catch (error) {
      console.error('여행 기록 동기화 실패:', error.message);
    } finally { syncing = false; }
  }
  function installLocalSync() {
    if (Storage.prototype.__familyTravelSyncInstalled) return;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (key === STORAGE_KEY && familyProfile?.role === 'parent' && !syncing) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => syncParentTrips(), 700);
      }
    };
    Storage.prototype.__familyTravelSyncInstalled = true;
  }

  function applyRoleUI() {
    const isChild = familyProfile.role === 'child';
    document.body.classList.toggle('auth-child', isChild);
    const expenseNav = document.querySelector('[data-view="expenses"]');
    if (expenseNav) expenseNav.style.display = isChild ? 'none' : '';
    const dot = document.querySelector('.profile-dot');
    if (dot) dot.textContent = isChild ? '🧒' : '👨‍👩‍👧';
    const actions = document.querySelector('.top-actions');
    if (actions && !document.getElementById('familyAuthActions')) {
      const area = document.createElement('div');
      area.id = 'familyAuthActions';
      area.className = 'auth-user';
      area.innerHTML = `
        <span class="auth-user-name"></span>
        <button type="button" class="auth-small-btn" id="familyPasswordChange">비밀번호 변경</button>
        <button type="button" class="auth-small-btn" id="familyLogout">로그아웃</button>`;
      actions.appendChild(area);
      document.getElementById('familyPasswordChange').addEventListener('click', changePassword);
      document.getElementById('familyLogout').addEventListener('click', logout);
    }
    const name = document.querySelector('.auth-user-name');
    if (name) name.textContent = `${familyProfile.display_name} · ${isChild ? '자녀' : '부모'}`;
    const banner = document.querySelector('.preview-banner');
    if (banner) banner.innerHTML = '<b>가족 계정 연결</b>여행 기록과 사진은 가족 계정에 저장·공유됩니다. 대표사진과 부모 전용 경비도 이곳에서 관리할 수 있습니다.';
    if (isChild) {
      const form = document.getElementById('tripForm');
      if (form) form.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
      const del = document.getElementById('deleteTripBtn');
      if (del) del.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
    } else {
      installParentEnhancements();
    }
  }

  function installFamilyCardCoverRenderer() {
    if (window.__ryusFamilyCardCoverRendererInstalled) return;
    window.__ryusFamilyCardCoverRendererInstalled = true;
    ['recentTrips', 'allTrips'].forEach(id => {
      const root = document.getElementById(id);
      if (root) new MutationObserver(() => {
        // Let the page finish its normal thumbnail hydration before applying a chosen cover.
        setTimeout(() => renderCardCovers().catch(console.warn), 450);
        // A second pass covers slower image decoding on phones or with large photos.
        setTimeout(() => renderCardCovers().catch(console.warn), 1300);
      }).observe(root, { childList: true, subtree: true });
    });
    setTimeout(() => renderCardCovers().catch(console.warn), 500);
  }

  async function enterApp(session) {
    message('가족 계정과 여행 기록을 확인하고 있습니다…', true);
    const user = session.user;
    familyProfile = await getFamilyProfile(user.id);
    let deletedIds = await loadDeletedTripIds();
    if (familyProfile.role === 'parent') await migrateLocalTrips(deletedIds);
    // Re-read tombstones after migration; stale local copies must never resurrect deleted trips.
    deletedIds = await loadDeletedTripIds();
    const cloudTrips = await loadCloudTrips(deletedIds);
    const current = localState();
    const deletedPhotoIds = current.photos
      .filter(p => deletedIds.has(String(p.tripId)))
      .map(p => String(p.id));
    const activeLocalTrips = current.trips.filter(t => !deletedIds.has(String(t.id)));
    const activeLocalPhotos = current.photos.filter(p => !deletedIds.has(String(p.tripId)));
    const merged = new Map(activeLocalTrips.map(t => [String(t.id), t]));
    cloudTrips.forEach(t => merged.set(String(t.id), t));
    const next = [...merged.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips: next, photos: activeLocalPhotos }));
    await deleteLocalPhotoBlobs(deletedPhotoIds);
    installLocalSync();
    applyRoleUI();
    installFamilyCardCoverRenderer();
    gate.hidden = true;
    document.body.classList.remove('auth-pending');
    if (familyProfile.role === 'parent') await syncParentTrips();
    resolveAuthReady();
  }

  function changePassword() {
    const first = prompt('새 비밀번호를 입력해 주세요. (최소 6자)');
    if (first === null) return;
    if (first.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.');
    const second = prompt('새 비밀번호를 한 번 더 입력해 주세요.');
    if (second === null) return;
    if (first !== second) return alert('두 비밀번호가 서로 다릅니다.');
    client.auth.updateUser({ password: first }).then(({ error }) => {
      if (error) alert('비밀번호 변경에 실패했습니다: ' + error.message);
      else alert('비밀번호를 변경했습니다.');
    });
  }
  async function logout() {
    const { error } = await client.auth.signOut();
    if (error) return alert('로그아웃에 실패했습니다: ' + error.message);
    familyProfile = null;
    document.body.classList.add('auth-pending');
    gate.hidden = false;
    document.getElementById('familyPassword').value = '';
    message('로그아웃했습니다.', true);
    document.getElementById('familyAuthActions')?.remove();
    document.body.classList.remove('auth-child');
  }

  // ---------- Parent-only representative photo and expense tools ----------
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const localDate = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const money = (value, currency) => `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(Number(value || 0))} ${currency || 'KRW'}`;
  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  async function getJournalRow(clientId, attempts = 4) {
    for (let i = 0; i < attempts; i += 1) {
      let result = await client.from('journals')
        .select('id,client_id,title,cover_photo_id,cover_photo_ids')
        .eq('client_id', String(clientId))
        .maybeSingle();
      if (result.error && isMissingCoverPhotoIdsColumn(result.error)) {
        result = await client.from('journals')
          .select('id,client_id,title,cover_photo_id')
          .eq('client_id', String(clientId))
          .maybeSingle();
      }
      if (result.error) throw new Error('여행 기록 서버 정보를 확인하지 못했습니다: ' + result.error.message);
      if (result.data) return result.data;
      if (i < attempts - 1) await delay(500);
    }
    return null;
  }
  function openPhotoDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(PHOTO_DB_NAME, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('사진 저장 공간을 열지 못했습니다.'));
    });
  }
  async function readLocalPhotoBlob(photoId) {
    const db = await openPhotoDB();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_DB_STORE, 'readonly');
        const req = tx.objectStore(PHOTO_DB_STORE).get(String(photoId));
        req.onsuccess = () => resolve(req.result?.blob || null);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  }
  function installParentEnhancements() {
    if (window.__ryusFamilyEnhancementsInstalled) return;
    window.__ryusFamilyEnhancementsInstalled = true;

    const existingPhotos = document.getElementById('existingPhotos');
    if (existingPhotos && !document.getElementById('representativePhotoChooser')) {
      const chooser = document.createElement('div');
      chooser.id = 'representativePhotoChooser';
      chooser.className = 'family-extra-panel';
      chooser.innerHTML = `
        <h4>📷 이 여행의 사진 관리</h4>
        <p class="family-extra-help">사진 미리보기는 전체가 보이도록 표시합니다. 이 여행에서 대표사진을 최대 3장까지 선택할 수 있으며, 선택한 사진은 첫 화면 큰 사진에서 차례로 보여줍니다. 각 사진별로 확대 위치와 배율을 따로 지정할 수 있습니다.</p>
        <div id="coverChoiceGrid" class="cover-choice-grid photo-manage-grid"></div>
        <section id="representativePhotoTray" class="photo-selected-tray" aria-live="polite"></section>
        <button type="button" class="secondary" id="clearCoverChoice" style="margin-top:10px">대표사진 모두 해제</button>`;
      chooser.addEventListener('click', event => {
        const modeButton = event.target.closest?.('[data-representative-crop-mode]');
        if (modeButton && representativeCropDraft) {
          representativeCropDraft.mode = modeButton.dataset.representativeCropMode === 'crop' ? 'crop' : 'full';
          if (representativeCropDraft.mode === 'crop' && Number(representativeCropDraft.zoom) <= 1.01) representativeCropDraft.zoom = 1.35;
          updateRepresentativeCropPreview();
          return;
        }
        if (event.target.closest?.('[data-reset-representative-crop]')) {
          if (representativeCropDraft) {
            representativeCropDraft.mode = 'full';
            representativeCropDraft.x = 50;
            representativeCropDraft.y = 50;
            representativeCropDraft.zoom = 1;
            updateRepresentativeCropPreview();
            notifyToast('처음 구도로 돌아갔습니다. 저장 버튼을 눌러 적용해 주세요.');
          }
          return;
        }
        const selectedPhoto = event.target.closest?.('[data-select-representative-crop]');
        if (selectedPhoto) {
          activeRepresentativePhotoId = String(selectedPhoto.dataset.selectRepresentativeCrop || '');
          renderRepresentativeChooser().catch(showEnhancementError);
          return;
        }
        if (event.target.closest?.('[data-save-representative-crop]')) {
          saveRepresentativePhotoCrop().catch(showEnhancementError);
        }
      });
      chooser.addEventListener('input', event => {
        if (!representativeCropDraft) return;
        if (event.target.matches?.('#representativeCropZoom')) representativeCropDraft.zoom = Number(event.target.value) || 1;
        if (event.target.matches?.('#representativeCropX')) representativeCropDraft.x = Number(event.target.value);
        if (event.target.matches?.('#representativeCropY')) representativeCropDraft.y = Number(event.target.value);
        if (event.target.matches?.('#representativeCropZoom, #representativeCropX, #representativeCropY')) updateRepresentativeCropPreview();
      });
      // Drag listeners are attached directly to each rendered crop preview for reliable touch handling.
      existingPhotos.insertAdjacentElement('afterend', chooser);
    }

    const modalBody = document.querySelector('#tripModal .modal-body');
    if (modalBody && !document.getElementById('tripExpensePanel')) {
      const panel = document.createElement('section');
      panel.id = 'tripExpensePanel';
      panel.className = 'family-extra-panel';
      panel.innerHTML = `
        <h4>🧾 이 여행의 경비</h4>
        <p class="family-extra-help">먼저 여행 기록을 저장한 뒤 수정 화면을 다시 열면 경비를 추가할 수 있습니다. 통화별 금액을 따로 합산합니다.</p>
        <div id="tripExpenseSummary" class="expense-total-row"></div>
        <div id="tripExpenseList" class="expense-entry-list"><div class="expense-empty">경비를 불러오는 중입니다.</div></div>
        <div id="expenseEntryForm" class="family-expense-form">
          <label>사용 날짜<input id="expenseDate" type="date"></label>
          <label>항목<select id="expenseCategory"><option>숙박</option><option>교통</option><option>식비</option><option>입장·체험</option><option>쇼핑</option><option>기타</option></select></label>
          <label class="wide">사용 내역<input id="expenseDescription" maxlength="100" placeholder="예: 호텔 1박, 점심 식사"></label>
          <label>금액<input id="expenseAmount" type="number" min="0.01" step="0.01" placeholder="0"></label>
          <label>통화<select id="expenseCurrency"><option value="KRW">KRW · 원</option><option value="JPY">JPY · 엔</option><option value="USD">USD · 달러</option><option value="EUR">EUR · 유로</option><option value="CNY">CNY · 위안</option><option value="TWD">TWD · 대만달러</option><option value="THB">THB · 바트</option><option value="VND">VND · 동</option><option value="HKD">HKD · 홍콩달러</option></select></label>
          <label>결제자<input id="expensePayer" maxlength="40" placeholder="예: 아빠, 엄마"></label>
          <label class="wide">메모<input id="expenseMemo" maxlength="200" placeholder="선택 사항"></label>
          <button type="button" id="addExpenseButton">＋ 경비 추가</button>
        </div>`;
      modalBody.appendChild(panel);
    }

    const detailInfo = document.getElementById('tripDetailInfo');
    if (detailInfo && !document.getElementById('tripDetailExpensePanel')) {
      const panel = document.createElement('section');
      panel.id = 'tripDetailExpensePanel';
      panel.className = 'family-extra-panel';
      panel.innerHTML = '<h4>🧾 여행 경비 요약</h4><div id="tripDetailExpenseSummary" class="expense-total-row"></div><div id="tripDetailExpenseList" class="expense-entry-list"></div>';
      detailInfo.insertAdjacentElement('afterend', panel);
    }

    const expenseView = document.getElementById('view-expenses');
    if (expenseView) {
      expenseView.innerHTML = `
        <div class="expense-dashboard-head"><div><h2>여행 경비 💰</h2><p>부모 계정에서만 조회하고 관리할 수 있습니다.</p></div><button type="button" class="secondary" id="refreshExpenseDashboard">새로고침 ↻</button></div>
        <div id="expenseDashboardTotals" class="expense-dashboard-totals"></div>
        <div id="expenseDashboardList" class="expense-dashboard-list"><div class="expense-empty">경비 내역을 불러오는 중입니다.</div></div>`;
    }

    const tripModal = document.getElementById('tripModal');
    if (tripModal) {
      new MutationObserver(() => {
        if (tripModal.classList.contains('open')) {
          setTimeout(() => {
            renderRepresentativeChooser().catch(console.error);
            renderTripExpenseEditor().catch(console.error);
          }, 100);
        }
      }).observe(tripModal, { attributes: true, attributeFilter: ['class'] });
    }
    const detailModal = document.getElementById('tripDetailModal');
    if (detailModal) {
      new MutationObserver(() => {
        if (detailModal.classList.contains('open')) {
          setTimeout(() => renderTripDetailExpenses(activeDetailTripId).catch(console.error), 80);
        }
      }).observe(detailModal, { attributes: true, attributeFilter: ['class'] });
    }

    document.addEventListener('click', event => {
      const card = event.target.closest?.('[data-trip-card]');
      const mapTrip = event.target.closest?.('[data-open-trip]');
      if (card) activeDetailTripId = card.dataset.tripCard;
      else if (mapTrip) activeDetailTripId = mapTrip.dataset.openTrip;
      if (event.target.closest?.('[data-view="expenses"]')) setTimeout(() => renderExpenseDashboard().catch(showEnhancementError), 80);
      if (event.target.closest?.('#refreshExpenseDashboard')) renderExpenseDashboard().catch(showEnhancementError);
      if (event.target.closest?.('#homeExpensesMore')) document.querySelector('[data-view="expenses"]')?.click();
      const removeButton = event.target.closest?.('[data-delete-expense]');
      if (removeButton) deleteExpense(removeButton).catch(showEnhancementError);
      if (event.target.closest?.('#clearCoverChoice')) setRepresentativePhoto(null).catch(showEnhancementError);
      const setCover = event.target.closest?.('[data-set-cover-photo]');
      if (setCover) setRepresentativePhoto(String(setCover.dataset.setCoverPhoto)).catch(showEnhancementError);
      const deleteTripPhoto = event.target.closest?.('[data-delete-trip-photo]');
      if (deleteTripPhoto) deleteTripPhotoFromEditor(String(deleteTripPhoto.dataset.deleteTripPhoto)).catch(showEnhancementError);
    }, true);

    const deleteTripButton = document.getElementById('deleteTripBtn');
    if (deleteTripButton) {
      // Capture before the original local-only delete handler, so the cloud cleanup is completed first.
      deleteTripButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteTripFromCloud().catch(showEnhancementError);
      }, true);
    }

    const addExpenseButton = document.getElementById('addExpenseButton');
    if (addExpenseButton) addExpenseButton.addEventListener('click', () => addTripExpense().catch(showEnhancementError));
    const expensePanel = document.getElementById('tripExpensePanel');
    if (expensePanel) expensePanel.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') event.preventDefault();
    });

    setTimeout(renderCardCovers, 500);
    setTimeout(() => renderHomeRecentExpenses().catch(showEnhancementError), 650);
  }

  function notifyToast(message) {
    const text = String(message ?? '');
    if (typeof window.showFamilyToast === 'function') {
      window.showFamilyToast(text);
      return;
    }
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(notifyToast.timer);
      notifyToast.timer = setTimeout(() => el.classList.remove('show'), 2300);
      return;
    }
    console.info('[가족 여행 알림]', text);
  }

  function showEnhancementError(error) {
    console.error('[가족 여행 기능]', error);
    alert(error?.message || '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }

  function readRepresentativeCropMap() {
    try {
      const value = JSON.parse(localStorage.getItem('ryusFamilyHomeFeatureCrops_v1') || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function getHomeHeroAspectRatio() {
    const heroRect = document.getElementById('homeFeaturedBanner')?.getBoundingClientRect();
    if (heroRect?.width > 0 && heroRect?.height > 0) return heroRect.width / heroRect.height;
    const hero = document.getElementById('homeFeaturedBanner');
    const heroStyle = hero ? getComputedStyle(hero) : null;
    const app = document.querySelector('.app');
    const appRect = app?.getBoundingClientRect();
    const appStyle = app ? getComputedStyle(app) : null;
    const appWidth = appRect?.width || window.innerWidth || 390;
    const horizontalPadding = appStyle
      ? (parseFloat(appStyle.paddingLeft) || 0) + (parseFloat(appStyle.paddingRight) || 0)
      : 20;
    const contentWidth = Math.max(280, appWidth - horizontalPadding);
    const mobile = window.innerWidth <= 720;
    const compact = window.innerWidth <= 850;
    const heroWidth = compact ? contentWidth : (contentWidth - 15) * (1.65 / (1.65 + 0.78));
    const heroHeight = (parseFloat(heroStyle?.height) || 0) || (mobile ? 230 : (compact ? 270 : 310));
    return heroWidth / heroHeight;
  }
  function normalizeRepresentativeCrop(value = {}) {
    const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
    const numeric = (candidate, fallback) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
    return {
      mode: value.mode === 'crop' ? 'crop' : 'full',
      x: clamp(numeric(value.x, 50), 0, 100),
      y: clamp(numeric(value.y, 50), 0, 100),
      zoom: clamp(numeric(value.zoom, 1), 1, 2.6)
    };
  }
  function attachRepresentativeCropDrag(preview) {
    if (!preview) return;
    const pointers = new Map();
    let gesture = null;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const rebaseGesture = () => {
      const points = [...pointers.entries()];
      if (points.length >= 2) {
        const a = points[0][1], b = points[1][1];
        const dx = b.x - a.x, dy = b.y - a.y;
        gesture = {
          type: 'pinch',
          distance: Math.max(1, Math.hypot(dx, dy)),
          zoom: Number(representativeCropDraft?.zoom) || 1,
          x: Number(representativeCropDraft?.x) || 50,
          y: Number(representativeCropDraft?.y) || 50,
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2
        };
      } else if (points.length === 1) {
        const [pointerId, point] = points[0];
        gesture = { type: 'drag', pointerId, x: point.x, y: point.y };
      } else {
        gesture = null;
      }
      representativeCropDrag = gesture;
    };
    const finishPointer = event => {
      if (event && pointers.has(event.pointerId)) pointers.delete(event.pointerId);
      rebaseGesture();
    };

    preview.style.touchAction = representativeCropDraft?.mode === 'crop' ? 'none' : 'pan-y';
    preview.addEventListener('pointerdown', event => {
      if (!representativeCropDraft || representativeCropDraft.mode !== 'crop') return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { preview.setPointerCapture(event.pointerId); } catch (_) {}
      rebaseGesture();
      event.preventDefault();
    });
    preview.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId) || !representativeCropDraft || representativeCropDraft.mode !== 'crop') return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const rect = preview.getBoundingClientRect();
      const zoom = Math.max(1, Number(representativeCropDraft.zoom) || 1);
      if (pointers.size >= 2) {
        const points = [...pointers.values()];
        const a = points[0], b = points[1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        if (!gesture || gesture.type !== 'pinch') rebaseGesture();
        const base = gesture;
        const nextZoom = clamp(base.zoom * distance / base.distance, 1, 2.6);
        const maxOffsetX = Math.max(1, rect.width * (nextZoom - 1) / 2);
        const maxOffsetY = Math.max(1, rect.height * (nextZoom - 1) / 2);
        representativeCropDraft.zoom = nextZoom;
        representativeCropDraft.x = clamp(base.x - (midX - base.midX) / maxOffsetX * 50, 0, 100);
        representativeCropDraft.y = clamp(base.y - (midY - base.midY) / maxOffsetY * 50, 0, 100);
      } else {
        if (!gesture || gesture.type !== 'drag') rebaseGesture();
        const point = pointers.get(event.pointerId);
        const base = gesture;
        const maxOffsetX = Math.max(1, rect.width * (zoom - 1) / 2);
        const maxOffsetY = Math.max(1, rect.height * (zoom - 1) / 2);
        const dx = point.x - base.x;
        const dy = point.y - base.y;
        representativeCropDraft.x = clamp(representativeCropDraft.x - dx / maxOffsetX * 50, 0, 100);
        representativeCropDraft.y = clamp(representativeCropDraft.y - dy / maxOffsetY * 50, 0, 100);
        gesture.x = point.x;
        gesture.y = point.y;
      }
      updateRepresentativeCropPreview();
      event.preventDefault();
    });
    preview.addEventListener('pointerup', finishPointer);
    preview.addEventListener('pointercancel', finishPointer);
    preview.addEventListener('lostpointercapture', finishPointer);
  }

  function updateRepresentativeCropPreview() {
    const draft = representativeCropDraft;
    const preview = document.getElementById('representativeCropPreview');
    const image = document.getElementById('representativeCropImage');
    const slider = document.getElementById('representativeCropZoom');
    const xSlider = document.getElementById('representativeCropX');
    const ySlider = document.getElementById('representativeCropY');
    const value = document.getElementById('representativeCropZoomValue');
    const xValue = document.getElementById('representativeCropXValue');
    const yValue = document.getElementById('representativeCropYValue');
    if (!draft || !preview || !image) return;
    const crop = normalizeRepresentativeCrop(draft);
    Object.assign(draft, crop);
    preview.classList.toggle('is-crop-mode', crop.mode === 'crop');
    preview.style.touchAction = crop.mode === 'crop' ? 'none' : 'pan-y';
    image.style.objectFit = crop.mode === 'crop' ? 'cover' : 'contain';
    image.style.objectPosition = '50% 50%';
    image.style.transformOrigin = 'center center';
    const translateX = (50 - crop.x) * (crop.zoom - 1);
    const translateY = (50 - crop.y) * (crop.zoom - 1);
    image.style.transform = crop.mode === 'crop'
      ? 'translate3d(' + translateX + '%, ' + translateY + '%, 0) scale(' + crop.zoom + ')'
      : 'none';
    if (slider) { slider.value = String(crop.zoom); slider.disabled = crop.mode !== 'crop'; }
    if (xSlider) { xSlider.value = String(crop.x); xSlider.disabled = crop.mode !== 'crop'; }
    if (ySlider) { ySlider.value = String(crop.y); ySlider.disabled = crop.mode !== 'crop'; }
    if (value) value.textContent = crop.zoom.toFixed(2) + '배';
    if (xValue) xValue.textContent = Math.round(crop.x) + '%';
    if (yValue) yValue.textContent = Math.round(crop.y) + '%';
    document.querySelectorAll('[data-representative-crop-mode]').forEach(button => {
      button.classList.toggle('active', button.dataset.representativeCropMode === crop.mode);
    });
    const hint = document.getElementById('representativeCropHint');
    if (hint) hint.textContent = crop.mode === 'crop'
      ? '한 손가락으로 사진을 옮기고, 두 손가락을 벌리거나 모아 확대·축소하세요. 아래 막대로도 미세 조정할 수 있습니다.'
      : '일부 확대를 누른 뒤 사진을 손가락으로 움직여 원하는 부분을 골라 주세요.';
  }

  async function saveRepresentativePhotoCrop() {
    if (!representativeCropDraft) return;
    const button = document.querySelector('[data-save-representative-crop]');
    if (button) button.disabled = true;
    try {
      const crop = normalizeRepresentativeCrop(representativeCropDraft);
      const crops = readRepresentativeCropMap();
      crops[String(representativeCropDraft.photoId)] = crop;
      localStorage.setItem('ryusFamilyHomeFeatureCrops_v1', JSON.stringify(crops));
      let synced = true;
      if (typeof window.saveFamilyHomeFeaturedCrops === 'function') {
        const result = await window.saveFamilyHomeFeaturedCrops(crops);
        synced = result?.synced !== false;
      }
      await window.refreshFamilyHomeFeaturedCropSettings?.();
      await renderRepresentativeChooser();
      if (synced) {
        notifyToast('대표사진 구도를 저장했습니다. 🌷');
      } else {
        notifyToast('이 기기에는 저장했습니다. 가족 기기 동기화는 Supabase SQL 설정 후 가능합니다.');
      }
    } catch (error) {
      console.error('[대표사진 구도 저장]', error);
      showEnhancementError(error);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function renderRepresentativeChooser() {
    const holder = document.getElementById('coverChoiceGrid');
    const tray = document.getElementById('representativePhotoTray');
    if (!holder || !tray) return;
    const token = ++coverRenderToken;
    chooserObjectURLs.forEach(url => URL.revokeObjectURL(url));
    chooserObjectURLs = [];
    representativeCropDrag = null;

    if (typeof window.loadFamilyHomeFeaturedCrops === 'function') {
      try { await window.loadFamilyHomeFeaturedCrops(); } catch (error) {
        console.warn('[대표사진 구도 불러오기]', error);
      }
    }

    const tripId = document.getElementById('editTripId')?.value || '';
    if (!tripId) {
      holder.innerHTML = '<div class="expense-empty">여행 기록을 먼저 저장해 주세요.</div>';
      tray.innerHTML = '<div class="photo-selected-empty">여행을 저장한 뒤 대표사진을 선택할 수 있습니다.</div>';
      representativeCropDraft = null;
      return;
    }
    const state = localState();
    const trip = state.trips.find(item => String(item.id) === String(tripId));
    const list = state.photos.filter(photo => String(photo.tripId) === String(tripId));
    if (!list.length) {
      holder.innerHTML = '<div class="expense-empty">아직 등록된 사진이 없습니다. 위에서 사진을 선택하고 여행 기록을 저장하면 여기에 표시됩니다.</div>';
      tray.innerHTML = '<div class="photo-selected-empty">사진을 대표사진으로 선택하면 이곳에서 확대 위치와 배율을 조절할 수 있습니다.</div>';
      representativeCropDraft = null;
      return;
    }

    const validPhotoIds = new Set(list.map(photo => String(photo.id)));
    const selectedIds = getTripCoverPhotoIds(trip).filter(id => validPhotoIds.has(String(id))).slice(0, 3);
    if (selectedIds.length !== getTripCoverPhotoIds(trip).length) {
      trip.coverPhotoIds = selectedIds;
      trip.coverPhotoId = selectedIds[0] || null;
      saveLocalState(state);
    }

    holder.innerHTML = '';
    const previewUrls = new Map();
    for (let index = 0; index < list.length; index += 1) {
      const photo = list[index];
      let blob = null;
      try { blob = await readLocalPhotoBlob(photo.id); } catch (_) {}
      if (!blob && typeof window.loadFamilyPhotoBlobById === 'function') {
        try { blob = await window.loadFamilyPhotoBlobById(photo.id); } catch (_) {}
      }
      if (token !== coverRenderToken) return;

      const selectedIndex = selectedIds.indexOf(String(photo.id));
      const isSelected = selectedIndex >= 0;
      const isDefaultDisplay = !selectedIds.length && index === 0;
      const card = document.createElement('article');
      card.className = 'photo-manage-card' + (isSelected ? ' is-selected' : '');

      const preview = document.createElement('div');
      preview.className = 'photo-manage-preview';
      if (blob) {
        const img = document.createElement('img');
        img.alt = photo.name || '여행 사진';
        img.loading = 'lazy';
        img.src = URL.createObjectURL(blob);
        chooserObjectURLs.push(img.src);
        previewUrls.set(String(photo.id), img.src);
        preview.appendChild(img);
      } else {
        const missing = document.createElement('span');
        missing.textContent = '사진을 불러오지 못했습니다';
        preview.appendChild(missing);
      }

      const details = document.createElement('div');
      details.className = 'photo-manage-details';
      const name = document.createElement('b');
      name.textContent = photo.name || '여행 사진';
      name.title = photo.name || '여행 사진';
      const status = document.createElement('small');
      status.textContent = isSelected
        ? '⭐ 대표사진 ' + (selectedIndex + 1) + ' / 3'
        : (isDefaultDisplay ? '기본 표시 사진' : '앨범 사진');
      details.append(name, status);

      const actions = document.createElement('div');
      actions.className = 'photo-manage-actions';
      const choose = document.createElement('button');
      choose.type = 'button';
      choose.className = 'photo-manage-set';
      choose.textContent = isSelected ? '선택 해제' : '대표사진 추가';
      choose.dataset.setCoverPhoto = String(photo.id);
      choose.disabled = !isSelected && selectedIds.length >= 3;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'photo-manage-delete';
      remove.textContent = '사진 삭제';
      remove.dataset.deleteTripPhoto = String(photo.id);

      actions.append(choose, remove);
      card.append(preview, details, actions);
      holder.appendChild(card);
    }

    const fallbackPhoto = list[0];
    const activeId = selectedIds.includes(String(activeRepresentativePhotoId))
      ? String(activeRepresentativePhotoId)
      : (selectedIds[0] || String(fallbackPhoto.id));
    const representative = list.find(photo => String(photo.id) === activeId) || fallbackPhoto;
    activeRepresentativePhotoId = String(representative.id);
    const imageUrl = previewUrls.get(String(representative.id));
    const cropMap = readRepresentativeCropMap();
    const crop = normalizeRepresentativeCrop(cropMap[String(representative.id)] || {});
    representativeCropDraft = {
      photoId: String(representative.id),
      mode: crop.mode, x: crop.x, y: crop.y, zoom: crop.zoom
    };

    const selectedChips = selectedIds.length
      ? selectedIds.map((id, selectedIndex) => {
          const photo = list.find(item => String(item.id) === id);
          if (!photo) return '';
          const url = previewUrls.get(id);
          return `<button type="button" class="photo-selected-chip ${id === activeId ? 'active' : ''}" data-select-representative-crop="${escapeHTML(id)}">
            ${url ? `<img src="${url}" alt="" />` : '<span>📷</span>'}
            <span><b>${selectedIndex + 1}번</b><small>${escapeHTML(photo.name || '여행 사진')}</small></span>
          </button>`;
        }).join('')
      : '<div class="photo-selected-empty-inline">아직 직접 선택한 대표사진이 없습니다. 첫 사진이 기본으로 표시됩니다.</div>';

    tray.innerHTML = `
      <div class="photo-selected-heading">
        <div><h5>⭐ 대표사진 미리보기 · ${selectedIds.length}/3장 선택</h5><p>${selectedIds.length ? '아래 사진을 눌러 각각의 구도를 따로 조절할 수 있습니다.' : '위 사진 중 최대 3장을 대표사진으로 추가해 주세요.'}</p></div>
        <span class="photo-selected-status">${selectedIds.length} / 3장</span>
      </div>
      <div class="photo-selected-chips">${selectedChips}</div>
      <div class="photo-selected-preview ${crop.mode === 'crop' ? 'is-crop-mode' : ''}" id="representativeCropPreview" aria-label="손가락으로 움직여 대표사진 구도를 조절하는 미리보기">
        ${imageUrl ? '<img id="representativeCropImage" alt="선택한 대표사진 미리보기" draggable="false" />' : '<span class="photo-selected-missing">사진 미리보기를 불러오지 못했습니다.</span>'}
        <span class="photo-selected-preview-label">메인 화면 대표사진 영역 · 손가락으로 이동</span>
      </div>
      <div class="photo-selected-controls">
        <div class="photo-selected-mode">
          <button type="button" data-representative-crop-mode="full" class="${crop.mode === 'full' ? 'active' : ''}">전체 사진</button>
          <button type="button" data-representative-crop-mode="crop" class="${crop.mode === 'crop' ? 'active' : ''}">일부 확대</button>
        </div>
        <label class="photo-selected-zoom">확대 배율 <b id="representativeCropZoomValue">${crop.zoom.toFixed(2)}배</b>
          <input type="range" id="representativeCropZoom" min="1" max="2.6" step="0.05" value="${crop.zoom}" ${crop.mode === 'crop' ? '' : 'disabled'} />
        </label>
        <label class="photo-selected-position">가로 위치 <b id="representativeCropXValue">${Math.round(crop.x)}%</b>
          <input type="range" id="representativeCropX" min="0" max="100" step="1" value="${crop.x}" ${crop.mode === 'crop' ? '' : 'disabled'} />
          <small>0 왼쪽 · 100 오른쪽</small>
        </label>
        <label class="photo-selected-position">세로 위치 <b id="representativeCropYValue">${Math.round(crop.y)}%</b>
          <input type="range" id="representativeCropY" min="0" max="100" step="1" value="${crop.y}" ${crop.mode === 'crop' ? '' : 'disabled'} />
          <small>0 위쪽 · 100 아래쪽</small>
        </label>
        <p id="representativeCropHint" class="photo-selected-hint">${crop.mode === 'crop' ? '사진을 드래그하거나 위치 조절 막대를 움직여 원하는 부분을 선택하세요.' : '사진 전체가 메인 화면에 보입니다.'}</p>
        <div class="photo-selected-actions" style="grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="secondary photo-selected-reset" data-reset-representative-crop style="min-height:36px;padding:8px 13px;border:1px solid #eadbd0;border-radius:10px;background:#fff9f1;color:#946e5b;font-size:10px;font-weight:900">구도 초기화</button><button type="button" class="photo-selected-save" data-save-representative-crop style="flex:1">이 사진의 구도 저장</button></div>
      </div>
    `;
    const selectedImage = document.getElementById('representativeCropImage');
    const cropPreview = document.getElementById('representativeCropPreview');
    if (cropPreview) {
      cropPreview.style.setProperty('aspect-ratio', String(getHomeHeroAspectRatio()), 'important');
      cropPreview.style.setProperty('max-height', 'none', 'important');
      attachRepresentativeCropDrag(cropPreview);
    }
    if (selectedImage && imageUrl) {
      selectedImage.src = imageUrl;
      updateRepresentativeCropPreview();
    }
  }

  async function deleteTripPhotoFromEditor(photoId) {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 사진을 삭제할 수 있습니다.');
    const id = String(photoId || '');
    if (!id || photoDeletesInProgress.has(id)) return;

    const tripId = document.getElementById('editTripId')?.value || '';
    const before = localState();
    const trip = before.trips.find(item => String(item.id) === String(tripId));
    const photo = before.photos.find(item => String(item.id) === id && String(item.tripId) === String(tripId));
    if (!trip || !photo) throw new Error('삭제할 사진을 현재 여행에서 찾지 못했습니다.');
    if (!confirm('이 사진을 가족 앨범에서 완전히 삭제할까요? 다른 가족 기기에서도 삭제됩니다.')) return;
    if (typeof window.deleteFamilyPhotoFromCloud !== 'function') {
      throw new Error('사진 삭제 서비스를 찾지 못했습니다. 다시 로그인한 뒤 시도해 주세요.');
    }

    photoDeletesInProgress.add(id);
    const photoSnapshot = { ...photo };
    const previousCoverIds = getTripCoverPhotoIds(trip);
    const wasRepresentative = previousCoverIds.includes(id);

    try {
      // Optimistic UI: remove the tile immediately while the cloud request continues.
      const optimistic = localState();
      optimistic.photos = optimistic.photos.filter(item => String(item.id) !== id);
      const optimisticTrip = optimistic.trips.find(item => String(item.id) === String(tripId));
      if (optimisticTrip) {
        const nextCoverIds = getTripCoverPhotoIds(optimisticTrip).filter(value => value !== id);
        optimisticTrip.coverPhotoIds = nextCoverIds;
        optimisticTrip.coverPhotoId = nextCoverIds[0] || null;
      }
      saveLocalState(optimistic);

      await window.refreshFamilyTravelHome?.();
      await renderRepresentativeChooser();
      await renderCardCovers();
      window.refreshFamilyTripDetail?.(tripId);
      notifyToast('사진을 화면에서 먼저 제거했습니다. 클라우드 정리 중…');

      if (wasRepresentative) await updateTripCoverSelection(tripId, previousCoverIds.filter(value => value !== id));

      await window.deleteFamilyPhotoFromCloud(id);
      await deleteLocalPhotoBlobs([id]);
      window.clearFamilyPhotoBlobCache?.(id);

      await window.refreshFamilyTravelHome?.();
      await renderRepresentativeChooser();
      await renderCardCovers();
      window.refreshFamilyTripDetail?.(tripId);
      notifyToast('사진을 가족 앨범에서 삭제했습니다.');
    } catch (error) {
      // Restore the local record if the server could not complete the deletion.
      const restored = localState();
      if (!restored.photos.some(item => String(item.id) === id)) {
        restored.photos.push(photoSnapshot);
      }
      const restoredTrip = restored.trips.find(item => String(item.id) === String(tripId));
      if (wasRepresentative && restoredTrip) {
        restoredTrip.coverPhotoIds = previousCoverIds;
        restoredTrip.coverPhotoId = previousCoverIds[0] || null;
      }
      saveLocalState(restored);

      if (wasRepresentative && previousCoverIds.length) {
        try { await updateTripCoverSelection(tripId, previousCoverIds); }
        catch (restoreError) { console.warn('[사진 삭제] 대표사진 연결 복원 실패', restoreError); }
      }

      await window.refreshFamilyTravelHome?.();
      await renderRepresentativeChooser();
      await renderCardCovers();
      window.refreshFamilyTripDetail?.(tripId);
      throw error;
    } finally {
      photoDeletesInProgress.delete(id);
    }
  }

  async function setRepresentativePhoto(photoId) {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 사진을 지정할 수 있습니다.');
    const tripId = document.getElementById('editTripId')?.value || '';
    if (!tripId) return;
    const state = localState();
    const trip = state.trips.find(item => String(item.id) === String(tripId));
    if (!trip) return;

    const currentIds = getTripCoverPhotoIds(trip);
    let nextIds = currentIds;
    if (photoId == null || String(photoId) === '') {
      nextIds = [];
      activeRepresentativePhotoId = null;
    } else {
      const id = String(photoId);
      if (!state.photos.some(photo => String(photo.id) === id && String(photo.tripId) === String(tripId))) {
        throw new Error('선택한 사진을 이 여행에서 찾지 못했습니다.');
      }
      if (currentIds.includes(id)) {
        nextIds = currentIds.filter(value => value !== id);
        if (activeRepresentativePhotoId === id) activeRepresentativePhotoId = nextIds[0] || null;
      } else {
        if (currentIds.length >= 3) {
          notifyToast('여행마다 대표사진은 최대 3장까지 선택할 수 있습니다.');
          return;
        }
        nextIds = [...currentIds, id];
        activeRepresentativePhotoId = id;
      }
    }

    trip.coverPhotoIds = nextIds;
    trip.coverPhotoId = nextIds[0] || null;
    saveLocalState(state);
    const coverSave = await updateTripCoverSelection(tripId, nextIds);
    if (!coverSave.multipleSynced && nextIds.length > 1) {
      notifyToast('이 기기에는 ' + nextIds.length + '장을 저장했습니다. 가족 기기에도 3장을 공유하려면 Supabase SQL 설정이 필요합니다.');
    }
    await window.refreshFamilyTravelHome?.();
    await renderRepresentativeChooser();
    await renderCardCovers();
    window.refreshFamilyTripDetail?.(tripId);
  }

  async function renderCardCovers() {
    if (!familyProfile) return;
    const passToken = ++cardCoverRenderToken;
    const state = localState();
    // Release URLs belonging to cards that were removed during a re-render.
    for (const [oldImage, oldUrl] of coverObjectURLs.entries()) {
      if (!oldImage.isConnected) {
        URL.revokeObjectURL(oldUrl);
        coverObjectURLs.delete(oldImage);
      }
    }

    for (const card of document.querySelectorAll('[data-trip-card]')) {
      const trip = state.trips.find(item => String(item.id) === String(card.dataset.tripCard));
      const cover = card.querySelector('.trip-cover');
      if (!trip || !cover) continue;

      const tripPhotos = state.photos.filter(photo => String(photo.tripId) === String(trip.id));
      const previousIds = getTripCoverPhotoIds(trip);
      const validIds = previousIds.filter(id => tripPhotos.some(photo => String(photo.id) === id));
      if (validIds.length !== previousIds.length) {
        trip.coverPhotoIds = validIds;
        trip.coverPhotoId = validIds[0] || null;
        saveLocalState(state);
        if (familyProfile.role === 'parent') {
          updateTripCoverSelection(trip.id, validIds)
            .catch(error => console.warn('[대표사진] 삭제된 사진 연결을 정리하지 못했습니다.', error.message));
        }
      }
      const chosenPhotoExists = validIds.length > 0;
      const displayPhoto = chosenPhotoExists
        ? tripPhotos.find(photo => String(photo.id) === String(validIds[0]))
        : tripPhotos[0];
      let img = cover.querySelector('img');

      if (!displayPhoto) {
        if (img) {
          const oldUrl = coverObjectURLs.get(img);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          coverObjectURLs.delete(img);
          img.remove();
        }
        if (!cover.querySelector('.cover-placeholder')) {
          const placeholder = document.createElement('div');
          placeholder.className = 'cover-placeholder';
          placeholder.textContent = trip.type === 'overseas' ? '🌏' : '🌿';
          cover.insertBefore(placeholder, cover.firstChild);
        }
        continue;
      }

      // The page's normal thumbnail already represents the first photo. Leave it
      // untouched unless the selected representative is different.
      if (img && img.dataset.coverOverride !== 'true' && String(img.dataset.photoId || '') === String(displayPhoto.id)) {
        img.style.objectFit = 'contain';
        continue;
      }

      let blob = null;
      try { blob = await readLocalPhotoBlob(displayPhoto.id); } catch (_) {}
      if (!blob && typeof window.loadFamilyPhotoBlobById === 'function') {
        try { blob = await window.loadFamilyPhotoBlobById(displayPhoto.id); } catch (_) {}
      }
      if (passToken !== cardCoverRenderToken) return;
      if (!blob) {
        // Do not leave a now-obsolete representative visible while a replacement loads.
        if (img?.dataset.coverOverride === 'true' && String(img.dataset.photoId || '') !== String(displayPhoto.id)) {
          const oldUrl = coverObjectURLs.get(img);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          coverObjectURLs.delete(img);
          img.remove();
          const placeholder = document.createElement('div');
          placeholder.className = 'cover-placeholder';
          placeholder.textContent = trip.type === 'overseas' ? '🌏' : '🌿';
          cover.insertBefore(placeholder, cover.firstChild);
        }
        continue;
      }

      if (!img) {
        cover.querySelector('.cover-placeholder')?.remove();
        img = document.createElement('img');
        img.alt = trip.title || '여행 대표사진';
        cover.insertBefore(img, cover.firstChild);
      }
      const oldUrl = coverObjectURLs.get(img);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(blob);
      coverObjectURLs.set(img, url);
      img.src = url;
      img.dataset.photoId = String(displayPhoto.id);
      img.dataset.coverRenderedPhotoId = String(displayPhoto.id);
      if (chosenPhotoExists) img.dataset.coverOverride = 'true';
      else delete img.dataset.coverOverride;
      img.style.objectFit = 'contain';
    }
  }

  async function getExpenseRows(journalId) {
    const { data, error } = await client.from('journal_expenses')
      .select('id,journal_id,expense_date,category,description,amount,currency,payer,memo,created_at')
      .eq('journal_id', journalId)
      .order('expense_date', { ascending: false });
    if (error) throw new Error('여행 경비를 불러오지 못했습니다: ' + error.message);
    return data || [];
  }
  function expenseTotals(rows) {
    const totals = new Map();
    rows.forEach(row => totals.set(row.currency || 'KRW', (totals.get(row.currency || 'KRW') || 0) + Number(row.amount || 0)));
    return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  function renderTotals(target, rows) {
    target.innerHTML = '';
    const totals = expenseTotals(rows);
    if (!totals.length) {
      target.innerHTML = '<span class="expense-total-chip">아직 등록된 경비가 없습니다</span>';
      return;
    }
    totals.forEach(([currency, value]) => {
      const chip = document.createElement('span');
      chip.className = 'expense-total-chip';
      chip.textContent = `합계 ${money(value, currency)}`;
      target.appendChild(chip);
    });
  }
  function expenseEntryHTML(row, tripTitle = '') {
    return `<div class="expense-entry"><div><strong>${escapeHTML(row.description || row.category || '경비')}</strong><small>${escapeHTML(row.expense_date || '')} · ${escapeHTML(row.category || '기타')}${tripTitle ? ' · ' + escapeHTML(tripTitle) : ''}${row.payer ? ' · 결제: ' + escapeHTML(row.payer) : ''}${row.memo ? '<br>' + escapeHTML(row.memo) : ''}</small></div><div><div class="expense-value">${escapeHTML(money(row.amount, row.currency))}</div>${row.id ? `<button type="button" class="expense-delete" data-delete-expense="${escapeHTML(row.id)}" data-journal-id="${escapeHTML(row.journal_id)}">삭제</button>` : ''}</div></div>`;
  }
  async function renderTripExpenseEditor() {
    const panel = document.getElementById('tripExpensePanel');
    if (!panel) return;
    if (familyProfile?.role !== 'parent') { panel.style.display = 'none'; return; }
    const tripId = document.getElementById('editTripId')?.value || '';
    const summary = document.getElementById('tripExpenseSummary');
    const list = document.getElementById('tripExpenseList');
    const form = document.getElementById('expenseEntryForm');
    if (document.getElementById('expenseDate')) document.getElementById('expenseDate').value = localDate();
    if (!tripId) {
      summary.innerHTML = '';
      list.innerHTML = '<div class="expense-empty">먼저 여행 기록을 저장해 주세요. 저장한 뒤 수정 화면을 다시 열면 경비를 추가할 수 있습니다.</div>';
      if (form) form.style.display = 'none';
      return;
    }
    if (form) form.style.display = '';
    try {
      const journal = await getJournalRow(tripId);
      if (!journal) {
        list.innerHTML = '<div class="expense-empty">여행 기록이 서버에 동기화된 뒤 경비를 입력할 수 있습니다.</div>';
        return;
      }
      const rows = await getExpenseRows(journal.id);
      renderTotals(summary, rows);
      list.innerHTML = rows.length ? rows.map(row => expenseEntryHTML(row)).join('') : '<div class="expense-empty">아직 등록된 경비가 없습니다. 아래에서 첫 지출을 추가해 보세요.</div>';
    } catch (error) {
      list.innerHTML = `<div class="expense-empty">${escapeHTML(error.message)}</div>`;
    }
  }
  async function addTripExpense() {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 경비를 등록할 수 있습니다.');
    const tripId = document.getElementById('editTripId')?.value || '';
    if (!tripId) throw new Error('먼저 여행 기록을 저장한 뒤 수정 화면에서 경비를 추가해 주세요.');
    const journal = await getJournalRow(tripId);
    if (!journal) throw new Error('여행 기록이 서버에 저장되지 않았습니다. 여행 기록을 먼저 저장한 뒤 다시 열어 주세요.');
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = Number(document.getElementById('expenseAmount').value);
    if (!description || !Number.isFinite(amount) || amount <= 0) throw new Error('사용 내역과 0보다 큰 금액을 입력해 주세요.');
    const row = {
      journal_id: journal.id,
      expense_date: document.getElementById('expenseDate').value || localDate(),
      category: document.getElementById('expenseCategory').value,
      description,
      amount,
      currency: document.getElementById('expenseCurrency').value || 'KRW',
      payer: document.getElementById('expensePayer').value.trim() || '가족',
      memo: document.getElementById('expenseMemo').value.trim() || null
    };
    const button = document.getElementById('addExpenseButton');
    button.disabled = true;
    try {
      const { error } = await client.from('journal_expenses').insert(row);
      if (error) throw new Error('경비를 저장하지 못했습니다: ' + error.message);
      document.getElementById('expenseDescription').value = '';
      document.getElementById('expenseAmount').value = '';
      document.getElementById('expensePayer').value = '';
      document.getElementById('expenseMemo').value = '';
      await renderTripExpenseEditor();
      await renderHomeRecentExpenses();
    } finally { button.disabled = false; }
  }
  async function deleteExpense(button) {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 경비를 삭제할 수 있습니다.');
    const id = button.dataset.deleteExpense;
    const journalId = button.dataset.journalId;
    if (!id || !confirm('이 경비 항목을 삭제할까요?')) return;
    const { error } = await client.from('journal_expenses').delete().eq('id', id).eq('journal_id', journalId);
    if (error) throw new Error('경비를 삭제하지 못했습니다: ' + error.message);
    await renderTripExpenseEditor();
    await renderTripDetailExpenses(activeDetailTripId);
    if (document.getElementById('view-expenses')?.classList.contains('active')) await renderExpenseDashboard();
    await renderHomeRecentExpenses();
  }
  async function renderTripDetailExpenses(tripId) {
    const panel = document.getElementById('tripDetailExpensePanel');
    const summary = document.getElementById('tripDetailExpenseSummary');
    const list = document.getElementById('tripDetailExpenseList');
    if (!panel || !summary || !list) return;
    if (familyProfile?.role !== 'parent' || !tripId) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    const journal = await getJournalRow(tripId, 2);
    if (!journal) { summary.innerHTML = ''; list.innerHTML = ''; return; }
    const rows = await getExpenseRows(journal.id);
    renderTotals(summary, rows);
    list.innerHTML = rows.length ? rows.map(row => expenseEntryHTML({ ...row, id: null })).join('') : '<div class="expense-empty">이 여행에 등록된 경비가 없습니다.</div>';
  }
  async function renderExpenseDashboard() {
    if (familyProfile?.role !== 'parent') return;
    const totalHolder = document.getElementById('expenseDashboardTotals');
    const listHolder = document.getElementById('expenseDashboardList');
    if (!totalHolder || !listHolder) return;
    listHolder.innerHTML = '<div class="expense-empty">경비를 불러오는 중입니다.</div>';
    const [{ data: expenses, error: expenseError }, { data: journals, error: journalError }, deletedIds] = await Promise.all([
      client.from('journal_expenses').select('id,journal_id,expense_date,category,description,amount,currency,payer,memo').order('expense_date', { ascending: false }),
      client.from('journals').select('id,title,client_id'),
      loadDeletedTripIds()
    ]);
    if (expenseError) throw new Error('전체 경비를 불러오지 못했습니다: ' + expenseError.message);
    if (journalError) throw new Error('여행 기록을 연결하지 못했습니다: ' + journalError.message);
    const activeJournals = (journals || []).filter(row => !deletedIds.has(String(row.client_id)));
    const activeJournalIds = new Set(activeJournals.map(row => String(row.id)));
    const activeExpenses = (expenses || []).filter(row => activeJournalIds.has(String(row.journal_id)));
    const titles = new Map(activeJournals.map(row => [String(row.id), row.title || '여행 기록']));
    renderTotals(totalHolder, activeExpenses);
    listHolder.innerHTML = activeExpenses.length
      ? activeExpenses.map(row => expenseEntryHTML(row, titles.get(String(row.journal_id)) || '')).join('')
      : '<div class="expense-empty">아직 등록된 여행 경비가 없습니다. 각 여행 기록의 수정 화면에서 경비를 추가할 수 있습니다.</div>';
  }

  async function renderHomeRecentExpenses() {
    if (familyProfile?.role !== 'parent') return;
    const holder = document.getElementById('homeRecentExpensesList');
    if (!holder) return;
    homeExpensePhotoUrls.forEach(url => URL.revokeObjectURL(url));
    homeExpensePhotoUrls = [];
    holder.innerHTML = '<div class="expense-empty">최근 여행 경비를 불러오고 있습니다.</div>';
    const [{ data: expenses, error: expenseError }, { data: journals, error: journalError }, deletedIds] = await Promise.all([
      client.from('journal_expenses').select('journal_id,category,amount,currency').order('expense_date', { ascending: false }),
      client.from('journals').select('id,title,client_id,visit_date,location,trip_type'),
      loadDeletedTripIds()
    ]);
    if (expenseError) throw new Error('최근 여행 경비를 불러오지 못했습니다: ' + expenseError.message);
    if (journalError) throw new Error('최근 여행 정보를 연결하지 못했습니다: ' + journalError.message);

    const activeJournalIds = new Set((journals || [])
      .filter(row => !deletedIds.has(String(row.client_id)))
      .map(row => String(row.id)));
    const byJournal = new Map();
    (expenses || []).forEach(row => {
      const id = String(row.journal_id);
      if (!activeJournalIds.has(id)) return;
      if (!byJournal.has(id)) byJournal.set(id, []);
      byJournal.get(id).push(row);
    });
    const recent = (journals || [])
      .filter(row => !deletedIds.has(String(row.client_id)) && byJournal.has(String(row.id)))
      .sort((a,b) => String(b.visit_date || '').localeCompare(String(a.visit_date || '')))
      .slice(0,3);

    if (!recent.length) {
      holder.innerHTML = '<div class="home-region-empty">아직 기록된 여행 경비가 없어요.<br>여행 기록 수정 화면에서 경비를 추가할 수 있습니다.</div>';
      return;
    }

    const formatAmount = (value, currency) => {
      const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(value || 0));
      return currency === 'KRW' ? '₩' + number : number + ' ' + currency;
    };
    const state = localState();
    const cards = await Promise.all(recent.map(async journal => {
      const rows = byJournal.get(String(journal.id)) || [];
      const totals = new Map();
      const categories = [];
      rows.forEach(row => {
        const currency = row.currency || 'KRW';
        totals.set(currency, (totals.get(currency) || 0) + Number(row.amount || 0));
        if (row.category && !categories.includes(row.category)) categories.push(row.category);
      });
      const totalLabel = [...totals.entries()].map(([currency,amount]) => formatAmount(amount,currency)).join('<br>');
      const categoryLabel = categories.slice(0,3).map(escapeHTML).join(' · ') || '지출 내역';
      const trip = state.trips.find(item => String(item.id) === String(journal.client_id));
      const tripPhotos = state.photos.filter(photo => String(photo.tripId) === String(journal.client_id));
      const coverIds = getTripCoverPhotoIds(trip);
      const cover = tripPhotos.find(photo => String(photo.id) === String(coverIds[0] || trip?.coverPhotoId || '')) || tripPhotos[0];
      let thumbnail = journal.trip_type === 'overseas' ? '🌏' : '🌿';
      if (cover) {
        try {
          const blob = await readLocalPhotoBlob(cover.id);
          if (blob) {
            const url = URL.createObjectURL(blob);
            homeExpensePhotoUrls.push(url);
            thumbnail = `<img src="${url}" alt="" />`;
          }
        } catch (error) {
          console.warn('[최근 여행 경비] 대표사진을 표시하지 못했습니다.', error);
        }
      }
      return `<article class="home-expense-item">
        <div class="home-expense-thumb" aria-hidden="true">${thumbnail}</div>
        <div class="home-expense-copy"><strong>${escapeHTML(journal.title || '가족 여행')}</strong><small>${escapeHTML(journal.visit_date || '')} · ${categoryLabel}</small></div>
        <div class="home-expense-amount">${totalLabel}</div>
      </article>`;
    }));
    holder.innerHTML = cards.join('');
  }
  window.refreshFamilyHomeRecentExpenses = () => renderHomeRecentExpenses();

  async function deleteTripFromCloud() {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 여행 기록을 삭제할 수 있습니다.');
    const tripId = document.getElementById('editTripId')?.value || '';
    if (!tripId) return;
    if (!confirm('이 여행과 연결된 사진·경비를 가족 기기에서 모두 삭제할까요? 삭제 후에는 다른 기기에서도 다시 나타나지 않습니다.')) return;
    const button = document.getElementById('deleteTripBtn');
    if (button) button.disabled = true;
    try {
      const { data: journal, error: journalError } = await client.from('journals')
        .select('id,client_id')
        .eq('client_id', String(tripId))
        .maybeSingle();
      if (journalError) throw new Error('여행 기록을 확인하지 못했습니다: ' + journalError.message);
      if (journal) {
        const { data: photoRows, error: photoError } = await client.from('journal_photos')
          .select('id,object_key')
          .eq('journal_id', journal.id);
        if (photoError) throw new Error('연결된 사진 목록을 확인하지 못했습니다: ' + photoError.message);
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) throw new Error('사진 서버 인증을 확인하지 못했습니다. 다시 로그인해 주세요.');
        for (const row of photoRows || []) {
          const response = await fetch(`${WORKER_URL}/${row.object_key}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
          });
          if (!response.ok && response.status !== 404) {
            const detail = await response.text().catch(() => '');
            throw new Error(`사진 파일 삭제에 실패했습니다 (${response.status}): ${detail.slice(0, 160)}`);
          }
        }
      }
      // One database transaction writes the tombstone and removes the journal,
      // expense rows and photo metadata together. A failed RPC leaves the trip retryable.
      const { error: deleteRpcError } = await client.rpc('delete_family_journal', { p_client_id: String(tripId) });
      if (deleteRpcError) throw new Error('여행 기록을 가족 기기에서 삭제하지 못했습니다: ' + deleteRpcError.message);

      const state = localState();
      const localPhotoIds = state.photos.filter(photo => String(photo.tripId) === String(tripId)).map(photo => String(photo.id));
      state.trips = state.trips.filter(trip => String(trip.id) !== String(tripId));
      state.photos = state.photos.filter(photo => String(photo.tripId) !== String(tripId));
      saveLocalState(state);
      await deleteLocalPhotoBlobs(localPhotoIds);
      alert('여행 기록과 연결된 사진·경비를 삭제했습니다. 다른 기기에서도 삭제 상태가 유지됩니다.');
      location.reload();
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function boot() {
    try {
      await loadSupabase();
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) {
        try { await enterApp(data.session); }
        catch (e) {
          message(e.message || '가족 계정 확인에 실패했습니다.');
          await client.auth.signOut();
        }
      }
    } catch (e) {
      message(e.message || '로그인 서비스를 시작하지 못했습니다.');
    }
  }
  document.getElementById('familyLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const button = document.getElementById('familyLoginButton');
    button.disabled = true; button.textContent = '로그인 중…';
    try {
      if (!client) throw new Error('로그인 서비스를 아직 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const email = document.getElementById('familyEmail').value.trim();
      const password = document.getElementById('familyPassword').value;
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await enterApp(data.session);
    } catch (err) {
      message(err.message || '로그인에 실패했습니다.');
    } finally {
      button.disabled = false; button.textContent = '로그인하기';
    }
  });
  document.getElementById('familyResetButton').addEventListener('click', async () => {
    if (!client) return message('로그인 서비스를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.');
    const email = document.getElementById('familyEmail').value.trim();
    if (!email) return message('먼저 이메일 주소를 입력해 주세요.');
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) message('재설정 메일 발송 실패: ' + error.message);
    else message('비밀번호 재설정 메일을 보냈습니다. 이메일을 확인해 주세요.', true);
  });
  boot();
})();
