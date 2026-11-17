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
  }

  function installStyles() {
    if (document.getElementById('ryusDetailCoverStyles')) return;
    const style = document.createElement('style');
    style.id = 'ryusDetailCoverStyles';
    style.textContent = `
      #tripDetailFeaturedCover {
        margin: 0 0 20px;
        padding: 13px;
        border: 1px solid #f0e5d9;
        border-radius: 20px;
        background: linear-gradient(135deg, #fff8e9 0%, #fff1ee 52%, #edf7fb 100%);
        box-shadow: 0 7px 20px rgba(76, 91, 112, .06);
      }
      #tripDetailFeaturedCover .featured-cover-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 0 2px 10px;
        color: #786b62;
        font-size: 12px;
        font-weight: 900;
      }
      #tripDetailFeaturedCover .featured-cover-note {
        color: #9a9290;
        font-size: 10px;
        font-weight: 600;
        text-align: right;
      }
      #tripDetailFeaturedCover .featured-cover-frame {
        display: grid;
        place-items: center;
        min-height: 190px;
        max-height: 430px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.9);
        border-radius: 14px;
        background: rgba(255,255,255,.72);
      }
      #tripDetailFeaturedCover img {
        display: block;
        width: 100%;
        height: min(56vh, 390px);
        min-height: 190px;
        object-fit: contain;
        border-radius: 13px;
      }
      #tripDetailFeaturedCover .featured-cover-placeholder {
        padding: 38px 15px;
        color: #9b9e9f;
        text-align: center;
        font-size: 13px;
        line-height: 1.7;
      }
      @media (max-width: 720px) {
        #tripDetailFeaturedCover { padding: 9px; margin-bottom: 15px; }
        #tripDetailFeaturedCover .featured-cover-frame { min-height: 155px; }
        #tripDetailFeaturedCover img { height: 34vh; min-height: 155px; }
        #tripDetailFeaturedCover .featured-cover-heading { font-size: 11px; }
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
      featured.setAttribute('aria-label', '여행 대표사진');
      featured.innerHTML = `
        <div class="featured-cover-heading">
          <span>🌟 여행 대표사진</span>
          <span class="featured-cover-note" id="tripDetailFeaturedNote"></span>
        </div>
        <div class="featured-cover-frame" id="tripDetailFeaturedFrame">
          <div class="featured-cover-placeholder">📷<br>대표사진을 불러오는 중입니다.</div>
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
    const selectedPhoto = tripPhotos.find(photo => String(photo.id) === String(trip.coverPhotoId));
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
