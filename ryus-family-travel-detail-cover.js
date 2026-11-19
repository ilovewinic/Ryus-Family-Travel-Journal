(() => {
  'use strict';

  // Family Travel Journal: show the selected representative photo first
  // in the trip detail dialog. This file is intentionally independent of
  // the authentication, expense, and R2 sync bridges.
  const STORAGE_KEY = 'familyTravelPreview_v2';
  const PHOTO_DB_NAME = 'familyTravelPhotos_v2';
  const PHOTO_DB_STORE = 'originals';

  let activeTripId = null;
  let renderToken = 0;
  let currentObjectUrl = null;
  let renderTimer = null;

  const readState = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        trips: Array.isArray(value.trips) ? value.trips : [],
        photos: Array.isArray(value.photos) ? value.photos : []
      };
    } catch (error) {
      console.warn('[여행 대표사진 상세 표시] 기록을 읽지 못했습니다.', error);
      return { trips: [], photos: [] };
    }
  };

  function openPhotoDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(PHOTO_DB_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('사진 저장 공간을 열지 못했습니다.'));
    });
  }

  async function readPhotoBlob(photoId) {
    const db = await openPhotoDB();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(PHOTO_DB_STORE, 'readonly');
        const request = transaction.objectStore(PHOTO_DB_STORE).get(String(photoId));
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error || new Error('사진을 읽지 못했습니다.'));
      });
    } finally {
      db.close();
    }
  }

  function releaseObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    const backdrop = document.getElementById('tripDetailFeaturedBackdrop');
    if (backdrop) backdrop.style.backgroundImage = 'none';
  }

  function installStyles() {
    if (document.getElementById('ryusDetailCoverStyles')) return;
    const style = document.createElement('style');
    style.id = 'ryusDetailCoverStyles';
    style.textContent = `
      /* 여행 상세는 액자형 팝업 대신 화면을 가득 쓰는 몰입형 페이지로 표시 */
      #tripDetailModal {
        position: fixed;
        inset: 0;
        padding: 0;
        align-items: flex-start;
        justify-content: flex-start;
        overflow-y: auto;
        background: rgba(20, 29, 43, .94);
      }
      #tripDetailModal .modal {
        position: relative;
        width: 100%;
        max-width: none;
        min-height: 100vh;
        max-height: none;
        margin: 0;
        overflow: visible;
        border-radius: 0;
        box-shadow: none;
      }
      #tripDetailModal .modal-head {
        position: absolute;
        z-index: 8;
        top: 0;
        left: 0;
        right: 0;
        min-height: 118px;
        padding: 25px clamp(20px, 5vw, 72px) 42px;
        align-items: flex-start;
        color: #fff;
        border: 0;
        background: linear-gradient(180deg, rgba(13, 22, 36, .72), rgba(13, 22, 36, 0));
        pointer-events: none;
      }
      #tripDetailModal .modal-head > div { pointer-events: none; }
      #tripDetailModal .modal-head h3 {
        color: #fff;
        font-size: clamp(21px, 3vw, 34px);
        line-height: 1.25;
        letter-spacing: -.8px;
        text-shadow: 0 2px 14px rgba(0,0,0,.35);
      }
      #tripDetailModal .trip-detail-subtitle {
        color: rgba(255,255,255,.88);
        font-size: 12px;
        text-shadow: 0 1px 8px rgba(0,0,0,.45);
      }
      #tripDetailModal .modal-head .close {
        flex: 0 0 auto;
        pointer-events: auto;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,.5);
        border-radius: 50%;
        background: rgba(255,255,255,.88);
        color: #344258;
        font-size: 24px;
        box-shadow: 0 4px 16px rgba(0,0,0,.18);
      }
      #tripDetailModal .modal-body { padding: 0 0 12px; }
      #tripDetailFeaturedCover {
        position: relative;
        width: 100%;
        height: 100svh;
        min-height: 540px;
        margin: 0;
        padding: 0;
        overflow: hidden;
        border: 0;
        border-radius: 0;
        background: linear-gradient(135deg, #8fb8ca, #ddc8b7 55%, #7f9c91);
        box-shadow: none;
      }
      #tripDetailFeaturedCover::after {
        content: '';
        position: absolute;
        inset: 35% 0 0;
        z-index: 2;
        pointer-events: none;
        background: linear-gradient(180deg, transparent 0%, rgba(11, 19, 31, .12) 45%, rgba(11, 19, 31, .62) 100%);
      }
      #tripDetailFeaturedCover .featured-cover-heading { display: none; }
      /* 사진 전체는 원본 비율로 보여주고, 남는 공간은 같은 사진을 흐리게 확장해 채움 */
      #tripDetailFeaturedCover .featured-cover-backdrop {
        position: absolute;
        z-index: 0;
        inset: -28px;
        background-color: #59636b;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        filter: blur(30px) brightness(.68) saturate(.82);
        transform: scale(1.08);
        opacity: .98;
        pointer-events: none;
      }
      #tripDetailFeaturedCover .featured-cover-frame {
        position: absolute;
        z-index: 1;
        inset: 0;
        display: grid;
        place-items: center;
        min-height: 0;
        max-height: none;
        overflow: hidden;
        border: 0;
        border-radius: 0;
        background: transparent;
      }
      #tripDetailFeaturedCover img {
        position: absolute;
        z-index: 1;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
        object-fit: contain;
        object-position: center;
        border-radius: 0;
        filter: drop-shadow(0 8px 24px rgba(0,0,0,.14));
      }
      #tripDetailFeaturedCover .featured-cover-placeholder {
        position: relative;
        z-index: 3;
        padding: 38px 20px;
        color: rgba(255,255,255,.94);
        text-align: center;
        font-size: 15px;
        line-height: 1.8;
        text-shadow: 0 2px 12px rgba(0,0,0,.25);
      }
      #tripDetailFeaturedCover .featured-cover-bottom {
        position: absolute;
        z-index: 4;
        left: clamp(20px, 5vw, 72px);
        right: clamp(20px, 5vw, 72px);
        bottom: 30px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px;
        color: #fff;
        pointer-events: none;
      }
      #tripDetailFeaturedCover .featured-cover-note {
        max-width: 70%;
        color: rgba(255,255,255,.9);
        font-size: 11px;
        font-weight: 700;
        text-align: left;
        text-shadow: 0 1px 8px rgba(0,0,0,.55);
      }
      #tripDetailFeaturedCover .featured-cover-scroll {
        white-space: nowrap;
        color: rgba(255,255,255,.9);
        font-size: 11px;
        font-weight: 800;
        text-shadow: 0 1px 8px rgba(0,0,0,.55);
      }
      #tripDetailModal .trip-detail-info {
        max-width: 1120px;
        margin: 26px auto 28px;
        padding: 23px 26px;
        border: 1px solid #f1e8df;
        border-radius: 20px;
        background: linear-gradient(120deg, #fff8e8, #fff0ed, #eef7fb);
      }
      #tripDetailModal .trip-detail-gallery-head {
        max-width: 1160px;
        margin: 0 auto 13px;
        padding: 0 20px;
      }
      #tripDetailModal #tripDetailPhotos {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px 24px;
      }
      #tripDetailModal .modal-actions {
        position: relative;
        z-index: 5;
        background: #fff;
      }
      @media (max-width: 720px) {
        #tripDetailModal .modal-head {
          min-height: 102px;
          padding: 18px 16px 35px;
        }
        #tripDetailModal .modal-head h3 { font-size: 21px; padding-right: 6px; }
        #tripDetailModal .trip-detail-subtitle { font-size: 10px; }
        #tripDetailModal .modal-head .close { width: 38px; height: 38px; }
        #tripDetailFeaturedCover { height: 100svh; min-height: 500px; }
        #tripDetailFeaturedCover .featured-cover-bottom {
          left: 17px;
          right: 17px;
          bottom: 22px;
          align-items: flex-start;
          flex-direction: column;
          gap: 7px;
        }
        #tripDetailFeaturedCover .featured-cover-note { max-width: 100%; font-size: 10px; }
        #tripDetailFeaturedCover .featured-cover-scroll { font-size: 10px; }
        #tripDetailModal .trip-detail-info {
          margin: 17px 12px 22px;
          padding: 17px;
          border-radius: 16px;
        }
        #tripDetailModal .trip-detail-gallery-head { padding: 0 14px; }
        #tripDetailModal #tripDetailPhotos { padding: 0 12px 18px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFeaturedArea() {
    const modal = document.getElementById('tripDetailModal');
    const body = modal?.querySelector('.modal-body');
    if (!modal || !body) return null;

    let featured = document.getElementById('tripDetailFeaturedCover');
    if (!featured) {
      featured = document.createElement('section');
      featured.id = 'tripDetailFeaturedCover';
      featured.setAttribute('aria-label', '여행 대표사진 전체 화면');
      featured.innerHTML = `
        <div class="featured-cover-backdrop" id="tripDetailFeaturedBackdrop" aria-hidden="true"></div>
        <div class="featured-cover-frame" id="tripDetailFeaturedFrame">
          <div class="featured-cover-placeholder">📷<br>여행 사진을 불러오는 중입니다.</div>
        </div>
        <div class="featured-cover-bottom">
          <span class="featured-cover-note" id="tripDetailFeaturedNote"></span>
          <span class="featured-cover-scroll">아래로 스크롤해 여행 기록 보기 ↓</span>
        </div>`;
      body.insertBefore(featured, body.firstElementChild);
    }
    return featured;
  }

  function updateGallery(photoId, totalCount) {
    const grid = document.getElementById('tripDetailPhotos');
    const count = document.getElementById('tripDetailPhotoCount');
    if (!grid) return;

    const photoImages = [...grid.querySelectorAll('[data-open-photo]')];
    const coverImage = photoImages.find(element => String(element.dataset.openPhoto) === String(photoId));
    const coverCard = coverImage?.closest('.photo-card');
    if (coverCard) coverCard.remove();

    const remaining = grid.querySelectorAll('.photo-card').length;
    if (count) {
      count.textContent = totalCount > 0
        ? `총 ${totalCount}장 · 대표사진 ${photoId ? '포함' : '미지정'}`
        : '0장의 사진';
    }

    if (totalCount > 0 && remaining === 0) {
      grid.innerHTML = '<div class="detail-photo-empty">🌼 대표사진 외에 추가 사진은 아직 없습니다.</div>';
    }
  }

  async function renderFeaturedCover() {
    const token = ++renderToken;
    const featured = ensureFeaturedArea();
    if (!featured) return;

    const frame = document.getElementById('tripDetailFeaturedFrame');
    const note = document.getElementById('tripDetailFeaturedNote');
    if (!frame || !note) return;

    const state = readState();
    const trip = state.trips.find(item => String(item.id) === String(activeTripId));
    if (!trip) {
      releaseObjectUrl();
      note.textContent = '';
      frame.innerHTML = '<div class="featured-cover-placeholder">여행 기록을 찾지 못했습니다.</div>';
      return;
    }

    const tripPhotos = state.photos.filter(photo => String(photo.tripId) === String(trip.id));
    const selectedIds = Array.isArray(trip.coverPhotoIds) && trip.coverPhotoIds.length ? trip.coverPhotoIds.map(String) : (trip.coverPhotoId ? [String(trip.coverPhotoId)] : []);
    const selectedPhoto = tripPhotos.find(photo => selectedIds.includes(String(photo.id)));
    const fallbackPhoto = tripPhotos[0] || null;
    const photo = selectedPhoto || fallbackPhoto;

    if (!photo) {
      releaseObjectUrl();
      note.textContent = '아직 대표사진이 없습니다';
      frame.innerHTML = '<div class="featured-cover-placeholder">📷<br>이 여행에 등록된 사진이 없습니다.<br>여행 기록 수정에서 사진을 추가해 주세요.</div>';
      updateGallery(null, 0);
      return;
    }

    let blob = null;
    try {
      blob = await readPhotoBlob(photo.id);
      if (!blob && fallbackPhoto && String(fallbackPhoto.id) !== String(photo.id)) {
        blob = await readPhotoBlob(fallbackPhoto.id);
      }
    } catch (error) {
      console.warn('[여행 대표사진 상세 표시] 사진을 불러오지 못했습니다.', error);
    }
    if (token !== renderToken) return;

    if (!blob) {
      releaseObjectUrl();
      note.textContent = selectedPhoto ? '선택한 대표사진' : '첫 번째 사진';
      frame.innerHTML = '<div class="featured-cover-placeholder">사진 파일을 이 기기에서 불러오지 못했습니다.<br>잠시 후 새로고침해 주세요.</div>';
      updateGallery(photo.id, tripPhotos.length);
      return;
    }

    releaseObjectUrl();
    currentObjectUrl = URL.createObjectURL(blob);
    const backdrop = document.getElementById('tripDetailFeaturedBackdrop');
    if (backdrop) backdrop.style.backgroundImage = `url("${currentObjectUrl}")`;
    const image = document.createElement('img');
    image.src = currentObjectUrl;
    image.alt = `${trip.title || '여행'} 대표사진`;
    frame.replaceChildren(image);
    note.textContent = selectedPhoto ? '직접 선택한 사진' : '별도 지정이 없어 첫 번째 사진을 표시합니다';
    updateGallery(photo.id, tripPhotos.length);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => renderFeaturedCover().catch(error => {
      console.error('[여행 대표사진 상세 표시]', error);
    }), 90);
  }

  function install() {
    const modal = document.getElementById('tripDetailModal');
    if (!modal || modal.dataset.featuredCoverInstalled === 'true') return;
    modal.dataset.featuredCoverInstalled = 'true';
    installStyles();
    ensureFeaturedArea();
    installExpenseDashboard();

    // Capture the clicked trip before the page's own handler opens its detail dialog.
    document.addEventListener('click', event => {
      const card = event.target.closest?.('[data-trip-card]');
      const mapTrip = event.target.closest?.('[data-open-trip]');
      if (card) activeTripId = card.dataset.tripCard;
      else if (mapTrip) activeTripId = mapTrip.dataset.openTrip;
      if (card || mapTrip) scheduleRender();
    }, true);

    new MutationObserver(() => {
      if (modal.classList.contains('open')) {
        scheduleRender();
        // A second pass allows the original detail gallery to finish rendering first.
        setTimeout(() => renderFeaturedCover().catch(console.warn), 350);
      } else {
        activeTripId = null;
        renderToken += 1;
        releaseObjectUrl();
      }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });

    const closeButtons = ['closeTripDetail', 'closeTripDetailBottom'];
    closeButtons.forEach(id => document.getElementById(id)?.addEventListener('click', () => {
      activeTripId = null;
      renderToken += 1;
      releaseObjectUrl();
    }));
  }


  // ---------- Parent-only expense dashboard upgrade ----------
  // Uses the existing journal_expenses table and its current parent-only RLS.
  // No database migration is required for this presentation upgrade.
  const EXPENSE_API_URL = 'https://pccgvfmvzaqhxsinquiv.supabase.co';
  const EXPENSE_API_KEY = 'sb_publishable_LS7tlROmDZ05etj_k-L7Cg_6d6_M5mk';
  let expenseSnapshot = { journals: [], expenses: [] };
  let expenseActiveTripId = null;
  let expenseRefreshTimer = null;
  let expenseCoverRenderToken = 0;
  const expenseCoverObjectURLs = new Set();

  const expenseEscape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function expenseAccessToken() {
    const keys = ['sb-pccgvfmvzaqhxsinquiv-auth-token'];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.endsWith('-auth-token') && !keys.includes(key)) keys.push(key);
    }
    for (const key of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        const token = parsed.access_token || parsed.currentSession?.access_token;
        if (token) return token;
      } catch (_) {}
    }
    return '';
  }

  async function expenseApi(path) {
    const token = expenseAccessToken();
    if (!token) throw new Error('로그인 인증을 확인하지 못했습니다. 다시 로그인해 주세요.');
    const response = await fetch(`${EXPENSE_API_URL}/rest/v1/${path}`, {
      method: 'GET',
      headers: {
        apikey: EXPENSE_API_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`경비 데이터를 불러오지 못했습니다 (${response.status}): ${detail.slice(0, 180)}`);
    }
    return response.json();
  }

  async function isExpenseParent() {
    if (document.body.classList.contains('auth-child')) return false;
    const rows = await expenseApi('family_members?select=role');
    return Array.isArray(rows) && rows.some(row => row.role === 'parent');
  }

  function expenseFormat(value, currency = 'KRW') {
    const n = Number(value || 0);
    const formats = {
      KRW: ['₩', 0], JPY: ['¥', 0], USD: ['$', 2], EUR: ['€', 2],
      CNY: ['CN¥', 2], TWD: ['NT$', 0], THB: ['฿', 2], VND: ['₫', 0], HKD: ['HK$', 2]
    };
    const [symbol, digits] = formats[currency] || ['', 2];
    const formatted = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(n);
    return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
  }

  function expenseTotalsFor(rows) {
    const totals = new Map();
    rows.forEach(row => {
      const currency = row.currency || 'KRW';
      totals.set(currency, (totals.get(currency) || 0) + Number(row.amount || 0));
    });
    return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function expenseYearOf(row, journalById) {
    const journal = journalById.get(String(row.journal_id));
    return String(journal?.visit_date || row.expense_date || '').slice(0, 4);
  }

  function expenseCategoryEmoji(category) {
    return ({ '숙박': '🛏️', '교통': '🚗', '식비': '🍽️', '입장·체험': '🎟️', '쇼핑': '🛍️', '기타': '🧾' })[category] || '🧾';
  }

  function expenseCurrencyBadges(rows, prominent = false) {
    const totals = expenseTotalsFor(rows);
    if (!totals.length) return '<span class="expense-dash-muted">등록된 경비 없음</span>';
    return totals.map(([currency, amount]) =>
      `<span class="expense-dash-money${prominent ? ' is-prominent' : ''}">${expenseEscape(expenseFormat(amount, currency))}<small>${expenseEscape(currency)}</small></span>`
    ).join('');
  }

  function expenseFilteredData() {
    const year = document.getElementById('expenseYearFilter')?.value || 'all';
    const journalById = new Map(expenseSnapshot.journals.map(row => [String(row.id), row]));
    const rows = expenseSnapshot.expenses.filter(row => year === 'all' || expenseYearOf(row, journalById) === year);
    const grouped = new Map();
    rows.forEach(row => {
      const key = String(row.journal_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    const trips = [...grouped.entries()].map(([journalId, items]) => ({
      journal: journalById.get(journalId), rows: items
    })).filter(item => item.journal).sort((a, b) =>
      String(b.journal.visit_date || '').localeCompare(String(a.journal.visit_date || ''))
    );
    return { rows, trips, journalById };
  }

  function expenseInstallStyles() {
    if (document.getElementById('ryusExpenseDashboardStyles')) return;
    const style = document.createElement('style');
    style.id = 'ryusExpenseDashboardStyles';
    style.textContent = `
      #ryusExpenseDashboard { display:block; }
      .expense-dash-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin:3px 0 16px}
      .expense-dash-intro h2{margin:0;font-size:25px;letter-spacing:-.8px;color:#344258}
      .expense-dash-intro p{margin:5px 0 0;font-size:12px;color:#8792a1;line-height:1.6}
      .expense-dash-filter{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 16px;padding:12px 14px;border:1px solid #eee7dc;border-radius:15px;background:#fff}
      .expense-dash-filter label{font-size:11px;font-weight:800;color:#68778a}
      .expense-dash-filter select{border:1px solid #e8e9ec;border-radius:10px;background:#fff;padding:8px 10px;color:#526178;font-size:11px}
      .expense-dash-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:13px}
      .expense-dash-kpi{padding:14px 15px;border:1px solid #eee7dc;border-radius:16px;background:linear-gradient(135deg,#fff,#fffaf3);min-width:0}
      .expense-dash-kpi span{display:block;color:#8b95a3;font-size:10px;font-weight:700;margin-bottom:6px}
      .expense-dash-kpi strong{display:block;color:#344258;font-size:20px;letter-spacing:-.5px;overflow-wrap:anywhere}
      .expense-dash-total-grid{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:17px}
      .expense-dash-total{flex:1 1 180px;padding:14px 16px;border-radius:16px;border:1px solid #e7edf1;background:linear-gradient(125deg,#f1f9fc,#f8fbff)}
      .expense-dash-total small{display:block;color:#8191a2;font-size:10px;font-weight:800;margin-bottom:5px}
      .expense-dash-total strong{font-size:22px;color:#316b88;letter-spacing:-.4px}
      .expense-dash-section{margin:16px 0;padding:17px;border:1px solid #eee7dc;border-radius:18px;background:#fff;box-shadow:0 7px 20px rgba(74,83,105,.04)}
      .expense-dash-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px}
      .expense-dash-section-head h3{font-size:15px;margin:0;color:#3b4960}
      .expense-dash-section-head p{font-size:10px;color:#929baa;margin:4px 0 0}
      .expense-dash-category{display:grid;gap:11px}
      .expense-dash-cat-row{display:grid;grid-template-columns:minmax(90px,130px) minmax(80px,1fr) auto;align-items:center;gap:10px}
      .expense-dash-cat-name{font-size:11px;color:#59677a;font-weight:800;white-space:nowrap}
      .expense-dash-cat-track{height:9px;background:#f1f3f5;border-radius:999px;overflow:hidden}
      .expense-dash-cat-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#86c8d9,#f3b4a8)}
      .expense-dash-cat-value{font-size:10px;color:#657487;font-weight:800;white-space:nowrap;text-align:right}
      .expense-dash-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
      .expense-dash-trip{min-width:0;border:1px solid #eee7dc;border-radius:17px;background:linear-gradient(150deg,#fff 0%,#fffdf9 100%);overflow:hidden}
      .expense-dash-trip-head{padding:15px 16px 12px;display:flex;justify-content:space-between;gap:12px;align-items:center}
      .expense-dash-trip-cover{width:76px;height:76px;flex:0 0 76px;overflow:hidden;border-radius:13px;background:linear-gradient(135deg,#fff1da,#e9f5fb);display:grid;place-items:center;color:#b7a88f;font-size:25px}
      .expense-dash-trip-cover img{width:100%;height:100%;object-fit:cover;display:block}
      .expense-dash-trip-title{flex:1;min-width:0}
      .expense-dash-trip h4{margin:0 0 5px;font-size:14px;color:#344258;line-height:1.35}
      .expense-dash-trip-meta{font-size:10px;color:#8994a3;line-height:1.55}
      .expense-dash-trip-totals{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
      .expense-dash-trip-totals strong{font-size:15px;color:#3f7891;white-space:nowrap}
      .expense-dash-trip-totals small{font-size:9px;color:#98a2ae}
      .expense-dash-trip-cats{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 13px}
      .expense-dash-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 8px;border-radius:999px;background:#f4f7f8;color:#69788b;font-size:9px;font-weight:800}
      .expense-dash-trip details{border-top:1px solid #f0ece7;background:rgba(250,251,252,.75)}
      .expense-dash-trip summary{cursor:pointer;list-style:none;padding:11px 15px;color:#64758a;font-size:10px;font-weight:900}
      .expense-dash-trip summary::-webkit-details-marker{display:none}
      .expense-dash-trip summary:after{content:'＋';float:right;color:#9aa4b0}
      .expense-dash-trip details[open] summary:after{content:'－'}
      .expense-dash-expenses{padding:0 13px 10px}
      .expense-dash-expense{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:9px 2px;border-top:1px dashed #e9e9e9}
      .expense-dash-expense b{display:block;font-size:11px;color:#536176;margin-bottom:3px}
      .expense-dash-expense small{display:block;color:#929baa;font-size:9px;line-height:1.55}
      .expense-dash-expense-value{text-align:right;white-space:nowrap;font-size:11px;font-weight:900;color:#46566b}
      .expense-dash-expense-value button{display:block;margin:5px 0 0 auto;background:#fff0ec;color:#b96f66;border-radius:7px;padding:4px 7px;font-size:9px;font-weight:800}
      .expense-dash-empty{padding:25px 18px;text-align:center;border:1px dashed #e5e1dc;border-radius:15px;color:#909aaa;font-size:11px;line-height:1.7;background:#fff}
      .expense-dash-muted{font-size:10px;color:#9aa3ad}
      .expense-dash-money{display:inline-flex;align-items:baseline;gap:5px;padding:7px 10px;border:1px solid #e8edf1;border-radius:11px;background:#f8fbfd;font-size:13px;font-weight:900;color:#3e7189;white-space:nowrap}
      .expense-dash-money small{font-size:8px;color:#92a0ad;font-weight:800}
      .expense-dash-money.is-prominent{font-size:15px;padding:9px 12px}
      #familyExpenseHomePanel .expense-home-trip{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:10px 0;border-top:1px solid #f2eee8}
      #familyExpenseHomePanel .expense-home-trip b{display:block;font-size:11px;color:#536176}
      #familyExpenseHomePanel .expense-home-trip small{display:block;margin-top:3px;color:#98a2ae;font-size:9px}
      #familyExpenseHomePanel .expense-home-trip strong{font-size:11px;color:#3f7891;text-align:right;white-space:nowrap}
      .expense-dash-stats{margin:8px 0 18px;border:1px solid #eee7dc;border-radius:16px;background:#fff;overflow:hidden}
      .expense-dash-stats>summary{cursor:pointer;list-style:none;padding:14px 16px;color:#738094;font-size:11px;font-weight:900;background:linear-gradient(110deg,#fffaf3,#f7fbfd)}
      .expense-dash-stats>summary::-webkit-details-marker{display:none}
      .expense-dash-stats>summary:after{content:'통계 열기 ＋';float:right;color:#9aa4b0;font-size:10px}
      .expense-dash-stats[open]>summary:after{content:'접기 −'}
      .expense-dash-stats-body{padding:0 15px 15px}
      .expense-dash-stats-body .expense-dash-section{margin:14px 0 0;box-shadow:none}
      .expense-dash-filter-note{margin-left:auto;color:#9aa3ad;font-size:10px}
      #familyExpenseHomePanel .expense-home-action{width:100%;margin-top:9px;padding:10px 12px;border-radius:11px;background:#eff7fa;color:#4b7f96;font-size:10px;font-weight:900}
      #tripDetailExpensePanel .expense-detail-category{display:flex;flex-wrap:wrap;gap:7px;margin:7px 0 12px}
      #tripDetailExpensePanel .expense-detail-category span{padding:6px 9px;border-radius:10px;background:#f5f8fa;color:#647487;font-size:10px;font-weight:800}
      @media(max-width:900px){.expense-dash-cards{grid-template-columns:1fr}}
      @media(max-width:720px){.expense-dash-intro h2{font-size:21px}.expense-dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.expense-dash-kpi strong{font-size:17px}.expense-dash-section{padding:13px}.expense-dash-cat-row{grid-template-columns:88px minmax(45px,1fr) auto;gap:7px}.expense-dash-cat-name{font-size:10px}.expense-dash-cat-value{font-size:9px}.expense-dash-trip-head{padding:13px}.expense-dash-trip-cover{width:64px;height:64px;flex-basis:64px}.expense-dash-trip-cats{padding:0 13px 10px}.expense-dash-filter-note{margin-left:0;width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function loadExpenseSnapshot() {
    const [journals, expenses] = await Promise.all([
      expenseApi('journals?select=id,client_id,title,visit_date,location,trip_type,cover_photo_id&order=visit_date.desc'),
      expenseApi('journal_expenses?select=id,journal_id,expense_date,category,description,amount,currency,payer,memo,created_at&order=expense_date.desc')
    ]);
    expenseSnapshot = {
      journals: Array.isArray(journals) ? journals : [],
      expenses: Array.isArray(expenses) ? expenses : []
    };
    renderExpenseDashboardUpgrade();
    renderExpenseHomeSummary();
    renderExpenseDetailSummary();
  }

  function installExpenseDashboardShell() {
    const view = document.getElementById('view-expenses');
    if (view) {
      view.innerHTML = `
        <div id="ryusExpenseDashboard">
          <div class="expense-dash-intro">
            <div><h2>여행별 경비 🧳</h2><p>각 여행에서 사용한 비용을 따로 모아봅니다. 전체 합계는 필요할 때 통계에서 확인할 수 있어요.</p></div>
            <button type="button" class="secondary" id="expenseDashboardRefreshNew">새로고침 ↻</button>
          </div>
          <div class="expense-dash-filter">
            <label for="expenseYearFilter">여행 연도</label><select id="expenseYearFilter"><option value="all">전체 연도</option></select>
            <span class="expense-dash-filter-note">여행 날짜 기준으로 정렬됩니다.</span>
          </div>
          <section class="expense-dash-section">
            <div class="expense-dash-section-head"><div><h3>🌷 우리 가족 여행 기록</h3><p>카드를 펼치면 날짜별 지출 내역과 결제 정보를 볼 수 있습니다.</p></div><span class="soft-pill" id="expenseTripCountLabel">0개 여행</span></div>
            <div id="expenseDashboardList" class="expense-dash-cards"><div class="expense-dash-empty">경비를 불러오는 중입니다.</div></div>
          </section>
          <details class="expense-dash-stats">
            <summary>📊 전체 경비 통계 보기</summary>
            <div class="expense-dash-stats-body">
              <div class="expense-dash-filter" style="margin-top:12px">
                <label for="expenseCurrencyFilter">통계 통화</label><select id="expenseCurrencyFilter"><option value="all">전체 통화</option></select>
                <span class="expense-dash-filter-note">서로 다른 통화는 환산하거나 합산하지 않습니다.</span>
              </div>
              <div id="expenseDashboardTotals" class="expense-dash-total-grid"></div>
              <div id="expenseDashboardMeta" class="expense-dash-kpis"></div>
              <section class="expense-dash-section"><div class="expense-dash-section-head"><div><h3>항목별 지출 비중</h3><p>선택한 연도와 통화 안에서 비교합니다.</p></div></div><div id="expenseCategoryBreakdown" class="expense-dash-category"></div></section>
            </div>
          </details>
        </div>`;
    }

    const homeCandidates = [...document.querySelectorAll('#view-home .content-grid .side-panel')];
    const homePanel = homeCandidates.find(panel => panel.textContent.includes('부모 전용 경비')) || homeCandidates[1];
    if (homePanel) {
      homePanel.id = 'familyExpenseHomePanel';
      homePanel.innerHTML = `
        <h3>💛 최근 여행 경비</h3>
        <p class="hint">최근 다녀온 여행의 지출만 간단히 모아봤어요.</p>
        <div id="expenseHomeRecent"><span class="expense-dash-muted">경비를 불러오는 중입니다.</span></div>
        <button type="button" class="expense-home-action" id="expenseHomeOpen">여행별 경비 더 보기 →</button>`;
    }
    document.getElementById('expenseYearFilter')?.addEventListener('change', renderExpenseDashboardUpgrade);
    document.getElementById('expenseCurrencyFilter')?.addEventListener('change', renderExpenseDashboardUpgrade);
  }

  function renderExpenseDashboardUpgrade() {
    const totalsHolder = document.getElementById('expenseDashboardTotals');
    const metaHolder = document.getElementById('expenseDashboardMeta');
    const listHolder = document.getElementById('expenseDashboardList');
    const yearSelect = document.getElementById('expenseYearFilter');
    const currencySelect = document.getElementById('expenseCurrencyFilter');
    const categoryHolder = document.getElementById('expenseCategoryBreakdown');
    if (!listHolder || !yearSelect) return;

    const journalById = new Map(expenseSnapshot.journals.map(row => [String(row.id), row]));
    const years = [...new Set(expenseSnapshot.expenses
      .map(row => expenseYearOf(row, journalById))
      .filter(value => /^\d{4}$/.test(value)))].sort().reverse();
    const selectedYear = yearSelect.value || 'all';
    yearSelect.innerHTML = '<option value="all">전체 연도</option>' + years.map(year => `<option value="${year}">${year}년</option>`).join('');
    yearSelect.value = years.includes(selectedYear) || selectedYear === 'all' ? selectedYear : 'all';

    const { rows, trips } = expenseFilteredData();
    const tripCountLabel = document.getElementById('expenseTripCountLabel');
    if (tripCountLabel) tripCountLabel.textContent = `${trips.length}개 여행`;

    if (!trips.length) {
      listHolder.innerHTML = '<div class="expense-dash-empty" style="grid-column:1/-1">선택한 기간에는 등록된 여행 경비가 없습니다.<br>여행 기록의 수정 화면에서 경비를 추가할 수 있어요.</div>';
    } else {
      listHolder.innerHTML = trips.map(({ journal, rows: tripRows }) => {
        const cats = new Map();
        tripRows.forEach(row => {
          const key = `${row.category || '기타'}|${row.currency || 'KRW'}`;
          cats.set(key, (cats.get(key) || 0) + Number(row.amount || 0));
        });
        const badges = [...cats.entries()].sort((a,b)=>b[1]-a[1]).map(([key, amount]) => {
          const [category, currency] = key.split('|');
          return `<span class="expense-dash-chip">${expenseCategoryEmoji(category)} ${expenseEscape(category)} · ${expenseEscape(expenseFormat(amount,currency))}</span>`;
        }).join('');
        const meta = [journal.visit_date || '', journal.location || '', journal.trip_type === 'overseas' ? '해외여행' : '국내여행'].filter(Boolean).map(expenseEscape).join(' · ');
        const totals = expenseTotalsFor(tripRows).map(([currency, amount]) => `<strong>${expenseEscape(expenseFormat(amount,currency))}</strong><small>${expenseEscape(currency)}</small>`).join('');
        return `<article class="expense-dash-trip" data-expense-trip="${expenseEscape(journal.client_id || '')}">
          <div class="expense-dash-trip-head">
            <div class="expense-dash-trip-cover" data-expense-cover="${expenseEscape(journal.client_id || '')}" aria-hidden="true">${journal.trip_type === 'overseas' ? '🌏' : '🌿'}</div>
            <div class="expense-dash-trip-title"><h4>${expenseEscape(journal.title || '이름 없는 여행')}</h4><div class="expense-dash-trip-meta">${meta}<br>지출 ${tripRows.length}건</div></div>
            <div class="expense-dash-trip-totals">${totals}</div>
          </div>
          <div class="expense-dash-trip-cats">${badges}</div>
          <details><summary>상세 지출 내역 ${tripRows.length}건 펼쳐보기</summary><div class="expense-dash-expenses">${tripRows.map(row => `
            <div class="expense-dash-expense"><div><b>${expenseEscape(row.description || row.category || '경비')}</b><small>${expenseEscape(row.expense_date || '')} · ${expenseEscape(row.category || '기타')}${row.payer ? ' · 결제: ' + expenseEscape(row.payer) : ''}${row.memo ? '<br>' + expenseEscape(row.memo) : ''}</small></div><div><div class="expense-dash-expense-value">${expenseEscape(expenseFormat(row.amount,row.currency || 'KRW'))}</div><div class="expense-dash-expense-value"><button type="button" data-delete-expense="${expenseEscape(row.id)}" data-journal-id="${expenseEscape(row.journal_id)}">삭제</button></div></div></div>`).join('')}</div></details>
        </article>`;
      }).join('');
    }

    // Refresh local representative thumbnails without changing the shared photo records.
    hydrateExpenseTripCovers();

    // The aggregate figures and category chart are intentionally hidden until the user opens statistics.
    if (!totalsHolder || !metaHolder || !currencySelect || !categoryHolder) return;
    const currencies = [...new Set(rows.map(row => row.currency || 'KRW'))].sort();
    const oldCurrency = currencySelect.value || 'all';
    currencySelect.innerHTML = '<option value="all">전체 통화</option>' + currencies.map(currency => `<option value="${expenseEscape(currency)}">${expenseEscape(currency)}</option>`).join('');
    const preferredCurrency = currencies.includes('KRW') ? 'KRW' : (currencies[0] || 'all');
    currencySelect.value = currencies.includes(oldCurrency) ? oldCurrency : (currencies.length <= 1 ? 'all' : preferredCurrency);

    const currencyTotals = expenseTotalsFor(rows);
    totalsHolder.innerHTML = currencyTotals.length ? currencyTotals.map(([currency, amount]) => `
      <div class="expense-dash-total"><small>선택 기간 지출 · ${expenseEscape(currency)}</small><strong>${expenseEscape(expenseFormat(amount, currency))}</strong></div>`).join('') : '<div class="expense-dash-empty" style="width:100%">아직 등록된 여행 경비가 없습니다.</div>';

    const currencyForAverage = currencyTotals.map(([currency, amount]) => {
      const tripsWithCurrency = trips.filter(trip => trip.rows.some(row => (row.currency || 'KRW') === currency)).length;
      return `<span class="expense-dash-money">${expenseEscape(expenseFormat(tripsWithCurrency ? amount / tripsWithCurrency : 0, currency))}<small>/ 여행 1회 평균 · ${expenseEscape(currency)}</small></span>`;
    }).join('');
    metaHolder.innerHTML = `
      <div class="expense-dash-kpi"><span>경비가 기록된 여행</span><strong>${trips.length}회</strong></div>
      <div class="expense-dash-kpi"><span>지출 기록</span><strong>${rows.length}건</strong></div>
      <div class="expense-dash-kpi"><span>여행 1회 평균</span><div style="display:flex;flex-wrap:wrap;gap:5px">${currencyForAverage || '<span class="expense-dash-muted">-</span>'}</div></div>`;

    const chosenCurrency = currencySelect.value;
    const categoryRows = rows.filter(row => chosenCurrency === 'all' || (row.currency || 'KRW') === chosenCurrency);
    const categoryTotals = new Map();
    const categoryCurrencyTotals = new Map();
    categoryRows.forEach(row => {
      const category = row.category || '기타';
      const currency = row.currency || 'KRW';
      const key = `${category}|${currency}`;
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + Number(row.amount || 0));
      categoryCurrencyTotals.set(currency, (categoryCurrencyTotals.get(currency) || 0) + Number(row.amount || 0));
    });
    const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    categoryHolder.innerHTML = categories.length ? categories.map(([key, amount]) => {
      const [category, currency] = key.split('|');
      const categoryTotal = categoryCurrencyTotals.get(currency) || 0;
      const percent = categoryTotal ? Math.max(3, Math.round(amount / categoryTotal * 100)) : 0;
      return `<div class="expense-dash-cat-row"><span class="expense-dash-cat-name">${expenseCategoryEmoji(category)} ${expenseEscape(category)}</span><div class="expense-dash-cat-track"><div class="expense-dash-cat-fill" style="width:${percent}%"></div></div><span class="expense-dash-cat-value">${expenseEscape(expenseFormat(amount,currency))} · ${percent}%</span></div>`;
    }).join('') : '<div class="expense-dash-empty">선택한 기간에 집계할 지출이 없습니다.</div>';
  }

  async function hydrateExpenseTripCovers() {
    for (const url of expenseCoverObjectURLs) URL.revokeObjectURL(url);
    expenseCoverObjectURLs.clear();
    const state = readState();
    const token = ++expenseCoverRenderToken;
    const cards = [...document.querySelectorAll('#expenseDashboardList [data-expense-cover]')];
    for (const holder of cards) {
      const tripId = String(holder.dataset.expenseCover || '');
      const journal = expenseSnapshot.journals.find(row => String(row.client_id) === tripId);
      if (!journal) continue;
      const localTrip = state.trips.find(row => String(row.id) === tripId);
      const photos = state.photos.filter(row => String(row.tripId) === tripId);
      const coverId = journal.cover_photo_id || localTrip?.coverPhotoId;
      const photo = (coverId && photos.find(row => String(row.id) === String(coverId))) || photos[0];
      if (!photo) continue;
      try {
        const blob = await readPhotoBlob(photo.id);
        if (token !== expenseCoverRenderToken) return;
        if (!blob || !holder.isConnected || !document.getElementById('expenseDashboardList')?.contains(holder)) continue;
        const url = URL.createObjectURL(blob);
        expenseCoverObjectURLs.add(url);
        const img = document.createElement('img');
        img.src = url;
        img.alt = '여행 대표사진';
        holder.replaceChildren(img);
      } catch (error) {
        console.warn('[여행 경비 대표사진]', error);
      }
    }
  }

  function renderExpenseHomeSummary() {
    const recent = document.getElementById('expenseHomeRecent');
    if (!recent) return;
    const journalById = new Map(expenseSnapshot.journals.map(row => [String(row.id), row]));
    const grouped = new Map();
    expenseSnapshot.expenses.forEach(row => {
      const key = String(row.journal_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    const recentTrips = [...grouped.entries()].map(([id, rows]) => ({ journal: journalById.get(id), rows }))
      .filter(item => item.journal)
      .sort((a,b)=>String(b.journal.visit_date||'').localeCompare(String(a.journal.visit_date||'')))
      .slice(0,3);
    recent.innerHTML = recentTrips.length ? recentTrips.map(({journal,rows}) => `
      <div class="expense-home-trip"><div><b>${expenseEscape(journal.title || '여행 기록')}</b><small>${expenseEscape(journal.visit_date || '')} · 지출 ${rows.length}건</small></div><strong>${expenseTotalsFor(rows).map(([currency,amount])=>expenseEscape(expenseFormat(amount,currency))).join('<br>')}</strong></div>`).join('')
      : '<div class="expense-dash-empty">아직 여행 경비가 없습니다.<br>여행 수정 화면에서 지출을 기록하면 여기에 표시됩니다.</div>';
  }

  function renderExpenseDetailSummary() {
    if (!expenseActiveTripId) return;
    const panel = document.getElementById('tripDetailExpensePanel');
    const summary = document.getElementById('tripDetailExpenseSummary');
    const list = document.getElementById('tripDetailExpenseList');
    if (!panel || !summary || !list) return;
    const journal = expenseSnapshot.journals.find(row => String(row.client_id) === String(expenseActiveTripId));
    if (!journal) return;
    const rows = expenseSnapshot.expenses.filter(row => String(row.journal_id) === String(journal.id));
    summary.innerHTML = expenseCurrencyBadges(rows, true);
    const categoryTotals = new Map();
    rows.forEach(row => {
      const key = `${row.category || '기타'}|${row.currency || 'KRW'}`;
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + Number(row.amount || 0));
    });
    let categoryBox = document.getElementById('tripDetailExpenseCategories');
    if (!categoryBox) {
      categoryBox = document.createElement('div');
      categoryBox.id = 'tripDetailExpenseCategories';
      categoryBox.className = 'expense-detail-category';
      summary.insertAdjacentElement('afterend', categoryBox);
    }
    categoryBox.innerHTML = [...categoryTotals.entries()].sort((a,b)=>b[1]-a[1]).map(([key,amount]) => {
      const [category,currency] = key.split('|');
      return `<span>${expenseCategoryEmoji(category)} ${expenseEscape(category)} · ${expenseEscape(expenseFormat(amount,currency))}</span>`;
    }).join('');
    list.innerHTML = rows.length ? rows.map(row => `
      <div class="expense-entry"><div><strong>${expenseEscape(row.description || row.category || '경비')}</strong><small>${expenseEscape(row.expense_date || '')} · ${expenseEscape(row.category || '기타')}${row.payer ? ' · 결제: ' + expenseEscape(row.payer) : ''}${row.memo ? '<br>' + expenseEscape(row.memo) : ''}</small></div><div class="expense-value">${expenseEscape(expenseFormat(row.amount,row.currency || 'KRW'))}</div></div>`).join('')
      : '<div class="expense-empty">이 여행에 등록된 경비가 없습니다.</div>';
  }

  function scheduleExpenseRefresh(delay = 450) {
    clearTimeout(expenseRefreshTimer);
    expenseRefreshTimer = setTimeout(() => loadExpenseSnapshot().catch(error => {
      console.error('[가족 여행 경비 대시보드]', error);
    }), delay);
  }

  function installExpenseDashboard() {
    if (window.__ryusExpenseDashboardInstalled) return;
    window.__ryusExpenseDashboardInstalled = true;
    expenseInstallStyles();

    isExpenseParent().then(isParent => {
      if (!isParent) return;
      installExpenseDashboardShell();
      loadExpenseSnapshot().catch(error => {
        console.error('[가족 여행 경비 대시보드]', error);
        const holder = document.getElementById('expenseDashboardList');
        if (holder) holder.innerHTML = `<div class="expense-dash-empty">경비를 불러오지 못했습니다.<br>${expenseEscape(error.message || '')}</div>`;
      });
    }).catch(error => console.warn('[가족 여행 경비 권한 확인]', error));

    document.addEventListener('click', event => {
      const tripCard = event.target.closest?.('[data-trip-card]');
      const mapTrip = event.target.closest?.('[data-open-trip]');
      if (tripCard) expenseActiveTripId = tripCard.dataset.tripCard;
      else if (mapTrip) expenseActiveTripId = mapTrip.dataset.openTrip;

      if (event.target.closest?.('[data-view="expenses"]')) scheduleExpenseRefresh(240);
      if (event.target.closest?.('#expenseDashboardRefreshNew')) scheduleExpenseRefresh(0);
      if (event.target.closest?.('#expenseHomeOpen')) document.querySelector('[data-view="expenses"]')?.click();
      if (event.target.closest?.('[data-delete-expense]')) scheduleExpenseRefresh(850);
      if (event.target.closest?.('#addExpenseButton')) scheduleExpenseRefresh(900);
    }, true);

    const detailModal = document.getElementById('tripDetailModal');
    if (detailModal) {
      new MutationObserver(() => {
        if (detailModal.classList.contains('open')) {
          setTimeout(() => renderExpenseDetailSummary(), 260);
        } else {
          expenseActiveTripId = null;
        }
      }).observe(detailModal, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function waitForAuthAndInstall() {
    if (window.__familyAuthReady?.then) {
      window.__familyAuthReady.then(install).catch(error => {
        console.error('[여행 대표사진 상세 표시] 초기화 실패', error);
      });
    } else {
      document.addEventListener('DOMContentLoaded', install, { once: true });
    }
  }

  waitForAuthAndInstall();
})();
