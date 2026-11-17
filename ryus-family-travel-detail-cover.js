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
      #tripDetailFeaturedCover .featured-cover-frame {
        position: absolute;
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
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
        object-fit: cover;
        object-position: center;
        border-radius: 0;
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
