(() => {
  'use strict';

  // Supabase login bridge for the existing family travel journal.
  // Load this file after the page HTML has been parsed and BEFORE the main app script.
  const SUPABASE_URL = 'https://pccgvfmvzaqhxsinquiv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LS7tlROmDZ05etj_k-L7Cg_6d6_M5mk';
  const STORAGE_KEY = 'familyTravelPreview_v2';
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
    body.auth-child #tripForm input,body.auth-child #tripForm select,body.auth-child #tripForm textarea{pointer-events:none;background:#f6f7f8;color:#7a8798}
    body.auth-child #tripForm button[type="submit"]{display:none!important}
    body.auth-child #tripForm .modal-actions .right-actions .secondary{display:none!important}
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

  function localState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { trips: Array.isArray(value.trips) ? value.trips : [], photos: Array.isArray(value.photos) ? value.photos : [] };
    } catch (_) { return { trips: [], photos: [] }; }
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
      longitude: t.lng === '' || t.lng == null ? null : Number(t.lng)
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
      lng: r.longitude == null ? '' : r.longitude
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

  async function loadCloudTrips() {
    const { data, error } = await client
      .from('journals')
      .select('id,client_id,title,location,visit_date,content,trip_type,country,region,latitude,longitude')
      .order('visit_date', { ascending: false });
    if (error) throw new Error('가족 여행 기록을 불러오지 못했습니다: ' + error.message);
    return (data || []).map(fromRow);
  }

  async function migrateLocalTrips() {
    const current = localState();
    if (current.trips.length) {
      const rows = current.trips.map(toRow);
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
      const rows = current.trips.map(toRow);
      const { error } = await client.from('journals').upsert(rows, { onConflict: 'client_id' });
      if (error) console.error('여행 기록 클라우드 저장 실패:', error.message);
    } finally { syncing = false; }
  }

  function installLocalSync() {
    const originalSetItem = Storage.prototype.setItem;
    if (Storage.prototype.__familyTravelSyncInstalled) return;
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
    if (banner) banner.innerHTML = '<b>가족 계정 연결</b>여행 기록은 Supabase에 저장·공유됩니다. 사진 원본은 아직 이 기기에만 저장되며, Cloudflare R2 연결 후 가족 기기 간 공유가 적용됩니다.';
    if (isChild) {
      const form = document.getElementById('tripForm');
      if (form) {
        form.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
      }
      const del = document.getElementById('deleteTripBtn');
      if (del) del.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
    }
  }

  async function enterApp(session) {
    message('가족 계정과 여행 기록을 확인하고 있습니다…', true);
    const user = session.user;
    familyProfile = await getFamilyProfile(user.id);

    if (familyProfile.role === 'parent') await migrateLocalTrips();
    const cloudTrips = await loadCloudTrips();
    const current = localState();
    const merged = new Map(current.trips.map(t => [String(t.id), t]));
    cloudTrips.forEach(t => merged.set(String(t.id), t));
    const next = [...merged.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips: next, photos: current.photos }));

    installLocalSync();
    applyRoleUI();
    gate.hidden = true;
    document.body.classList.remove('auth-pending');
    if (familyProfile.role === 'parent') {
      // Save local-only records that were merged from this browser; cloud duplicates are ignored on first migration.
      await syncParentTrips();
    }
    resolveAuthReady();
  }

  async function changePassword() {
    const first = prompt('새 비밀번호를 입력해 주세요. (최소 6자)');
    if (first === null) return;
    if (first.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.');
    const second = prompt('새 비밀번호를 한 번 더 입력해 주세요.');
    if (second === null) return;
    if (first !== second) return alert('두 비밀번호가 서로 다릅니다.');
    const { error } = await client.auth.updateUser({ password: first });
    if (error) alert('비밀번호 변경에 실패했습니다: ' + error.message);
    else alert('비밀번호를 변경했습니다.');
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
