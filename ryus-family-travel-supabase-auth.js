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
      cover_photo_id: t.coverPhotoId || null
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
      coverPhotoId: r.cover_photo_id || null
    };
  }
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
  async function loadDeletedTripIds() {
    const { data, error } = await client
      .from('deleted_journals')
      .select('client_id');
    if (error) throw new Error('삭제된 여행 기록 상태를 확인하지 못했습니다: ' + error.message);
    return new Set((data || []).map(row => String(row.client_id)));
  }
  async function loadCloudTrips(deletedIds = new Set()) {
    const { data, error } = await client
      .from('journals')
      .select('id,client_id,title,location,visit_date,content,trip_type,country,region,latitude,longitude,cover_photo_id')
      .order('visit_date', { ascending: false });
    if (error) throw new Error('가족 여행 기록을 불러오지 못했습니다: ' + error.message);
    return (data || []).filter(row => !deletedIds.has(String(row.client_id))).map(fromRow);
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
      const { error } = await client.from('journals').upsert(rows, {
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
      const { error } = await client.from('journals').upsert(rows, { onConflict: 'client_id' });
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
      const { data, error } = await client.from('journals')
        .select('id,client_id,title,cover_photo_id')
        .eq('client_id', String(clientId))
        .maybeSingle();
      if (error) throw new Error('여행 기록 서버 정보를 확인하지 못했습니다: ' + error.message);
      if (data) return data;
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
      chooser.innerHTML = '<h4>🌟 여행 대표사진</h4><p class="family-extra-help">카드에 표시할 사진을 이곳에서 따로 선택하세요. 별도 파일을 중복 저장하지 않고, 이 여행에 올린 사진 중 하나를 대표사진으로 지정합니다.</p><div id="coverChoiceGrid" class="cover-choice-grid"></div><button type="button" class="secondary" id="clearCoverChoice" style="margin-top:10px">대표사진 선택 해제</button>';
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

  function showEnhancementError(error) {
    console.error('[가족 여행 기능]', error);
    alert(error?.message || '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }

  async function renderRepresentativeChooser() {
    const holder = document.getElementById('coverChoiceGrid');
    if (!holder) return;
    const token = ++coverRenderToken;
    const tripId = document.getElementById('editTripId')?.value || '';
    if (!tripId) {
      holder.innerHTML = '<div class="expense-empty">여행 기록을 먼저 저장해 주세요. 사진을 추가한 뒤 수정 화면에서 대표사진을 지정할 수 있습니다.</div>';
      return;
    }
    const state = localState();
    const trip = state.trips.find(item => String(item.id) === String(tripId));
    const list = state.photos.filter(photo => String(photo.tripId) === String(tripId));
    if (!list.length) {
      holder.innerHTML = '<div class="expense-empty">이 여행에 등록된 사진이 없습니다. 사진을 추가하고 저장하면 대표사진을 고를 수 있습니다.</div>';
      return;
    }
    holder.innerHTML = '';
    for (const photo of list) {
      let blob = null;
      try { blob = await readLocalPhotoBlob(photo.id); } catch (_) {}
      if (token !== coverRenderToken) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cover-choice' + (String(trip?.coverPhotoId || '') === String(photo.id) ? ' selected' : '');
      const img = document.createElement('img');
      img.alt = photo.name || '여행 사진';
      if (blob) img.src = URL.createObjectURL(blob);
      else img.alt = '사진을 불러오지 못했습니다';
      const label = document.createElement('span');
      label.textContent = photo.name || '여행 사진';
      const note = document.createElement('small');
      note.textContent = String(trip?.coverPhotoId || '') === String(photo.id) ? '현재 대표사진' : '대표사진으로 선택';
      button.append(img, label, note);
      button.addEventListener('click', () => setRepresentativePhoto(photo.id).catch(showEnhancementError));
      holder.appendChild(button);
    }
  }

  async function setRepresentativePhoto(photoId) {
    if (familyProfile?.role !== 'parent') throw new Error('부모 계정에서만 대표사진을 변경할 수 있습니다.');
    const tripId = document.getElementById('editTripId')?.value || '';
    if (!tripId) return;
    const state = localState();
    const trip = state.trips.find(item => String(item.id) === String(tripId));
    if (!trip) return;
    if (photoId && !state.photos.some(photo => String(photo.id) === String(photoId) && String(photo.tripId) === String(tripId))) {
      throw new Error('선택한 사진을 이 여행에서 찾지 못했습니다.');
    }
    trip.coverPhotoId = photoId || null;
    saveLocalState(state);
    const journal = await getJournalRow(tripId, 2);
    if (journal) {
      const { error } = await client.from('journals').update({ cover_photo_id: photoId || null }).eq('id', journal.id);
      if (error) throw new Error('대표사진을 가족 계정에 저장하지 못했습니다: ' + error.message);
    }
    await window.refreshFamilyTravelHome?.();
    await renderRepresentativeChooser();
    renderCardCovers();
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
      const chosenPhotoExists = !!trip.coverPhotoId && tripPhotos.some(photo => String(photo.id) === String(trip.coverPhotoId));
      if (trip.coverPhotoId && !chosenPhotoExists) {
        trip.coverPhotoId = null;
        saveLocalState(state);
        if (familyProfile.role === 'parent') {
          client.from('journals').update({ cover_photo_id: null }).eq('client_id', String(trip.id))
            .then(({ error }) => { if (error) console.warn('[대표사진] 삭제된 사진 연결을 정리하지 못했습니다.', error.message); });
        }
      }

      const displayPhoto = chosenPhotoExists
        ? tripPhotos.find(photo => String(photo.id) === String(trip.coverPhotoId))
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
      const cover = tripPhotos.find(photo => String(photo.id) === String(trip?.coverPhotoId)) || tripPhotos[0];
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
