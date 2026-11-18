(() => {
  'use strict';

  const JOURNAL_KEY = 'familyTravelPreview_v2';
  const FEATURE_KEY = 'ryusFamilyHomeFeatureIds_v1';
  const DB_NAME = 'familyTravelPhotos_v2';
  const DB_STORE = 'originals';
  const AUTO_DELAY = 5200;

  let root = null;
  let currentSignature = '';
  let renderToken = 0;
  let cardUrls = [];
  let pauseUntil = 0;
  let refreshQueued = false;

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function readJournal() {
    const state = readJSON(JOURNAL_KEY, {});
    return {
      trips: Array.isArray(state.trips) ? state.trips : [],
      photos: Array.isArray(state.photos) ? state.photos : []
    };
  }

  function featuredTrips(state) {
    const selected = readJSON(FEATURE_KEY, []);
    if (Array.isArray(selected) && selected.length) {
      const chosen = [...new Set(selected.map(String))]
        .map(id => state.trips.find(trip => String(trip.id) === id))
        .filter(Boolean)
        .slice(0, 5);
      if (chosen.length) return chosen;
    }
    return [...state.trips]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 5);
  }

  function representativePhoto(trip, photos) {
    const list = photos.filter(photo => String(photo.tripId) === String(trip.id));
    return list.find(photo => String(photo.id) === String(trip.coverPhotoId || '')) || list[0] || null;
  }

  function activeIndex() {
    const dots = document.getElementById('homeFeatureDots');
    const active = dots && dots.querySelector('[data-home-feature-dot].active');
    return active ? Math.max(0, Number(active.dataset.homeFeatureDot) || 0) : 0;
  }

  async function readBlobFromDB(photoId) {
    return new Promise(resolve => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, 1);
      } catch (_) {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) {
          request.result.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.close();
          resolve(null);
          return;
        }
        let tx;
        try {
          tx = db.transaction(DB_STORE, 'readonly');
          const get = tx.objectStore(DB_STORE).get(String(photoId));
          get.onsuccess = () => resolve(get.result && get.result.blob ? get.result.blob : null);
          get.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
          tx.onerror = () => { db.close(); resolve(null); };
        } catch (_) {
          db.close();
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  async function loadPhotoBlob(photoId) {
    if (!photoId) return null;
    if (typeof window.loadFamilyPhotoBlobById === 'function') {
      try {
        const blob = await window.loadFamilyPhotoBlobById(String(photoId));
        if (blob) return blob;
      } catch (error) {
        console.warn('[메인 대표사진 스택] 클라우드 사진을 불러오지 못했습니다.', error);
      }
    }
    return await readBlobFromDB(photoId);
  }

  function ensureRoot() {
    const banner = document.getElementById('homeFeaturedBanner');
    if (!banner) return null;
    if (root && root.isConnected) return root;
    root = document.getElementById('homeFeatureStack');
    if (!root) {
      root = document.createElement('div');
      root.id = 'homeFeatureStack';
      root.className = 'home-feature-stack';
      root.setAttribute('role', 'group');
      root.setAttribute('aria-label', '첫 화면 대표 여행 사진 모음');
      const copy = banner.querySelector('.home-feature-copy');
      if (copy) banner.insertBefore(root, copy);
      else banner.appendChild(root);
    }
    root.addEventListener('click', event => {
      const card = event.target.closest('[data-home-feature-stack-index]');
      if (!card) return;
      event.preventDefault();
      pauseUntil = Date.now() + 12000;
      const index = Number(card.dataset.homeFeatureStackIndex) || 0;
      const dot = document.querySelector('#homeFeatureDots [data-home-feature-dot="' + index + '"]');
      if (dot) dot.click();
      else document.getElementById('homeFeatureOpen')?.click();
    });
    return root;
  }

  function updateStackPositions() {
    if (!root) return;
    const cards = [...root.querySelectorAll('[data-home-feature-stack-index]')];
    const count = cards.length;
    if (!count) return;
    const current = Math.min(activeIndex(), count - 1);
    const half = Math.floor(count / 2);
    cards.forEach((card, index) => {
      let position = index - current;
      if (position > half) position -= count;
      if (position < -half) position += count;
      card.dataset.stackPosition = String(Math.max(-2, Math.min(2, position)));
      card.classList.toggle('is-current', index === current);
      card.setAttribute('aria-current', index === current ? 'true' : 'false');
    });
  }

  async function refreshStack(force) {
    const holder = ensureRoot();
    if (!holder) return;
    const state = readJournal();
    const trips = featuredTrips(state);
    const rows = trips.map(trip => ({
      trip,
      photo: representativePhoto(trip, state.photos)
    }));
    const signature = rows.map(row =>
      String(row.trip.id) + ':' +
      String(row.photo ? row.photo.id : '') + ':' +
      String(row.trip.title || '')
    ).join('|');

    if (!force && signature === currentSignature) {
      updateStackPositions();
      return;
    }

    currentSignature = signature;
    const token = ++renderToken;
    cardUrls.forEach(url => URL.revokeObjectURL(url));
    cardUrls = [];
    holder.innerHTML = '';

    const cards = await Promise.all(rows.map(async (row, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'home-feature-stack-card';
      card.dataset.homeFeatureStackIndex = String(index);
      card.setAttribute('aria-label', (row.trip.title || '가족 여행') + ' 대표사진 보기');

      const frame = document.createElement('span');
      frame.className = 'home-feature-stack-photo';

      if (row.photo) {
        const blob = await loadPhotoBlob(row.photo.id);
        if (token !== renderToken) return null;
        if (blob) {
          const image = document.createElement('img');
          image.alt = row.trip.title || '가족 여행 사진';
          const url = URL.createObjectURL(blob);
          cardUrls.push(url);
          image.src = url;
          frame.appendChild(image);
        } else {
          frame.textContent = '📷';
          frame.setAttribute('aria-label', '사진 파일을 불러오지 못했습니다');
        }
      } else {
        frame.textContent = row.trip.type === 'overseas' ? '🌏' : '🌿';
      }

      const title = document.createElement('span');
      title.className = 'home-feature-stack-title';
      title.textContent = row.trip.title || '우리 가족 여행';
      card.append(frame, title);
      return card;
    }));

    if (token !== renderToken) return;
    cards.forEach(card => { if (card) holder.appendChild(card); });
    holder.hidden = !cards.length;
    updateStackPositions();
  }

  function queueRefresh(force) {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      refreshStack(!!force).catch(error => console.warn('[메인 대표사진 스택]', error));
    }, 180);
  }

  function autoAdvance() {
    if (document.hidden || Date.now() < pauseUntil) return;
    const banner = document.getElementById('homeFeaturedBanner');
    if (!banner) return;
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches && banner.matches(':hover')) return;
    if (banner.contains(document.activeElement)) return;
    const settings = document.getElementById('homeFeaturedSettingsModal');
    const edit = document.getElementById('tripModal');
    const detail = document.getElementById('tripDetailModal');
    const lightbox = document.getElementById('lightbox');
    if (settings?.classList.contains('open') || edit?.classList.contains('open') ||
        detail?.classList.contains('open') || lightbox?.classList.contains('open')) return;
    const dots = document.querySelectorAll('#homeFeatureDots [data-home-feature-dot]');
    if (dots.length > 1) document.getElementById('homeFeatureNext')?.click();
  }

  function install() {
    const banner = document.getElementById('homeFeaturedBanner');
    const dots = document.getElementById('homeFeatureDots');
    const image = document.getElementById('homeFeatureImage');
    if (!banner || !dots || !image) return;

    ensureRoot();
    refreshStack(true).catch(error => console.warn('[메인 대표사진 스택]', error));

    const dotsObserver = new MutationObserver(() => queueRefresh(false));
    dotsObserver.observe(dots, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    const imageObserver = new MutationObserver(() => queueRefresh(false));
    imageObserver.observe(image, {
      attributes: true,
      attributeFilter: ['data-photo-id']
    });

    document.getElementById('homeFeaturePrev')?.addEventListener('click', () => {
      pauseUntil = Date.now() + 9000;
    });
    document.getElementById('homeFeatureNext')?.addEventListener('click', () => {
      pauseUntil = Date.now() + 9000;
    });
    dots.addEventListener('click', () => { pauseUntil = Date.now() + 9000; });

    document.getElementById('saveHomeFeaturedSettings')?.addEventListener('click', () => {
      setTimeout(() => queueRefresh(true), 700);
    });
    document.getElementById('homeFeaturedAuto')?.addEventListener('click', () => {
      setTimeout(() => queueRefresh(true), 300);
    });
    document.getElementById('tripForm')?.addEventListener('submit', () => {
      setTimeout(() => queueRefresh(true), 1300);
    });
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-set-cover-photo], [data-delete-trip-photo], #clearCoverChoice')) {
        setTimeout(() => queueRefresh(true), 900);
      }
    });
    window.addEventListener('storage', event => {
      if (event.key === JOURNAL_KEY || event.key === FEATURE_KEY) queueRefresh(true);
    });
    window.addEventListener('pageshow', () => queueRefresh(true));

    setInterval(autoAdvance, AUTO_DELAY);
    setTimeout(() => queueRefresh(true), 850);
  }

  if (window.__familyAuthReady && typeof window.__familyAuthReady.then === 'function') {
    window.__familyAuthReady.then(() => setTimeout(install, 250)).catch(error => {
      console.error('[메인 대표사진 스택] 인증 준비 실패', error);
    });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    setTimeout(install, 250);
  }
})();