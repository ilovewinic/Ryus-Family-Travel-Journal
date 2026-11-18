(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const localDate = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const idFor = prefix => prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  const state = { places: [], stays: [], map: null, markers: [], picker: null, pickerMarker: null, pickerTarget: null, pickerPoint: null, toastTimer: null };

  function toast(message) {
    const node = $('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
  }
  function tripById(id) {
    try {
      const data = JSON.parse(localStorage.getItem('familyTravelPreview_v2') || '{}');
      return (Array.isArray(data.trips) ? data.trips : []).find(item => String(item.id) === String(id)) || null;
    } catch (_) { return null; }
  }
  function allTrips() {
    try {
      const data = JSON.parse(localStorage.getItem('familyTravelPreview_v2') || '{}');
      return Array.isArray(data.trips) ? data.trips : [];
    } catch (_) { return []; }
  }
  function tripTitle(id) { return tripById(id)?.title || '여행 기록'; }
  function dateText(value) {
    if (!value) return '날짜 미입력';
    const parts = String(value).split('-');
    return parts.length === 3 ? parts[0] + '.' + parts[1] + '.' + parts[2] : value;
  }
  function dateRange(trip) {
    const start = trip?.date || '';
    const end = trip?.endDate || '';
    if (!start) return '여행 날짜 미입력';
    if (!end || end === start) return dateText(start);
    return dateText(start) + ' – ' + dateText(end);
  }
  function nightsBetween(start, end) {
    if (!start || !end) return 0;
    const a = new Date(start + 'T00:00:00');
    const b = new Date(end + 'T00:00:00');
    const days = Math.round((b - a) / 86400000);
    return Number.isFinite(days) && days > 0 ? days : 0;
  }
  function parentMode() { return typeof window.isFamilyPhotoParent === 'function' && window.isFamilyPhotoParent(); }

  function addNavigationAndViews() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || $('view-places')) return;
    sidebar.querySelectorAll('[data-home-scroll]').forEach(node => node.remove());
    const printNav = sidebar.querySelector('[data-view="prints"]');
    const navHTML =
      '<button class="nav" data-view="places"><span class="ico">📍</span>방문 장소</button>' +
      '<button class="nav" data-view="stays"><span class="ico">🏨</span>숙소 모아보기</button>' +
      '<button class="nav" data-view="map"><span class="ico">🗺️</span>여행 지도</button>' +
      '<button class="nav" data-view="stats"><span class="ico">📊</span>여행 통계</button>';
    if (printNav) printNav.insertAdjacentHTML('beforebegin', navHTML);
    else sidebar.insertAdjacentHTML('beforeend', navHTML);

    const main = document.querySelector('main');
    const anchor = main?.querySelector('.preview-banner');
    if (!main || !anchor) return;
    const views = document.createElement('div');
    views.innerHTML =
      '<section id="view-places" class="view trip-explorer-view">' +
        '<div class="toolbar"><div><h2>우리 가족이 다녀온 장소 📍</h2><p>관광지와 식당, 카페와 체험 장소를 여행별로 모아봐요.</p></div><span class="soft-pill" id="placeTotalPill">0곳</span></div>' +
        '<div class="explorer-summary" id="placesSummary"></div>' +
        '<div class="explorer-filter"><input id="placeSearch" type="search" placeholder="장소 이름이나 지역 검색" /><select id="placeCategoryFilter"><option value="all">모든 종류</option><option value="attraction">관광지</option><option value="restaurant">식당</option><option value="cafe">카페</option><option value="experience">체험</option><option value="shopping">쇼핑</option><option value="other">기타</option></select><select id="placeStatusFilter"><option value="visited">다녀온 곳</option><option value="planned">방문 예정</option><option value="all">전체</option></select></div>' +
        '<div id="allFamilyPlaces" class="explorer-card-grid"></div>' +
      '</section>' +
      '<section id="view-stays" class="view trip-explorer-view">' +
        '<div class="toolbar"><div><h2>우리 가족 숙소 모아보기 🏨</h2><p>여행마다 이용한 호텔과 펜션, 리조트를 한곳에서 확인해요.</p></div><span class="soft-pill" id="stayTotalPill">0곳</span></div>' +
        '<div class="explorer-summary" id="staysSummary"></div>' +
        '<div class="explorer-filter"><input id="staySearch" type="search" placeholder="숙소 이름이나 지역 검색" /></div>' +
        '<div id="allFamilyStays" class="explorer-card-grid"></div>' +
      '</section>' +
      '<section id="view-map" class="view trip-explorer-view">' +
        '<div class="toolbar"><div><h2>우리 가족 여행 지도 🗺️</h2><p>방문 장소와 숙소, 예전 여행의 대표 위치를 함께 살펴봐요.</p></div><button class="secondary" type="button" id="refreshFamilyMap">새로고침</button></div>' +
        '<div class="map-legend"><span>📍 방문 장소</span><span>🏨 숙소</span><span>🧳 기존 여행 대표 위치</span></div>' +
        '<div id="familyPlacesMap" class="family-places-map"></div>' +
        '<p class="map-help">장소별 위치를 지정하면 지도에 표시됩니다. 좌표가 없는 예전 기록은 기존 대표 위치로 표시됩니다.</p>' +
      '</section>' +
      '<section id="view-stats" class="view trip-explorer-view">' +
        '<div class="toolbar"><div><h2>우리 가족 여행 통계 📊</h2><p>얼마나 많이 떠났고, 어떤 곳을 좋아했는지 돌아봐요.</p></div></div>' +
        '<div id="familyTravelStats" class="family-travel-stats"></div>' +
      '</section>';
    while (views.firstElementChild) main.insertBefore(views.firstElementChild, anchor);
  }

  function addTripEditor() {
    const body = document.querySelector('#tripModal .modal-body');
    if (!body || $('tripEndDate')) return;
    const grid = body.querySelector('.form-grid');
    if (!grid) return;
    grid.insertAdjacentHTML('afterend',
      '<section class="trip-extra-panel">' +
        '<div class="trip-extra-heading"><div><h4>🗓️ 여행 일정과 동행 정보</h4><p>하루 여행은 시작일과 종료일을 같게 두면 됩니다.</p></div></div>' +
        '<div class="trip-extra-fields trip-general-fields">' +
          '<label><span>여행 종료일</span><input id="tripEndDate" type="date" /></label>' +
          '<label><span>이동수단</span><select id="tripTransport"><option value="">선택 안 함</option><option value="자가용">자가용</option><option value="대중교통">대중교통</option><option value="기차">기차</option><option value="비행기">비행기</option><option value="배">배</option><option value="도보·자전거">도보·자전거</option><option value="기타">기타</option></select></label>' +
        '</div>' +
        '<div class="companion-choice"><span class="extra-label">함께한 가족</span>' +
          '<label><input type="checkbox" name="tripCompanion" value="아빠" /> 아빠</label>' +
          '<label><input type="checkbox" name="tripCompanion" value="수호" /> 수호</label>' +
          '<label><input type="checkbox" name="tripCompanion" value="현아" /> 현아</label>' +
          '<label class="companion-other"><span>그 외 동행</span><input id="tripOtherCompanions" placeholder="이름을 입력해 주세요" /></label>' +
        '</div>' +
      '</section>' +
      '<section class="trip-extra-panel">' +
        '<div class="trip-extra-heading"><div><h4>📍 방문 장소 기록</h4><p>관광지·식당·카페·체험 등을 실제 방문 순서대로 추가하세요. 방문 예정도 따로 표시할 수 있어요.</p></div><button type="button" class="secondary" id="addTripPlaceRow">＋ 장소 추가</button></div>' +
        '<div id="tripPlaceEditorRows" class="trip-extra-row-list"></div>' +
        '<div class="trip-extra-empty" id="tripPlaceEmpty">아직 방문 장소를 추가하지 않았어요. 장소가 여러 곳이면 하나씩 추가해 보세요.</div>' +
      '</section>' +
      '<section class="trip-extra-panel">' +
        '<div class="trip-extra-heading"><div><h4>🏨 숙소 기록</h4><p>당일 여행은 비워두고, 숙소를 옮겼다면 숙박한 곳마다 추가하세요.</p></div><button type="button" class="secondary" id="addTripStayRow">＋ 숙소 추가</button></div>' +
        '<div id="tripStayEditorRows" class="trip-extra-row-list"></div>' +
        '<div class="trip-extra-empty" id="tripStayEmpty">숙박하지 않은 당일 여행이라면 이 항목은 비워두면 됩니다.</div>' +
      '</section>'
    );
    // The older single-location field now represents the broad destination/area.
    const placeLabel = grid.querySelector('label[for="tripPlace"]');
    const placeInput = $('tripPlace');
    if (placeLabel) placeLabel.textContent = '대표 지역 / 여행지 *';
    if (placeInput) {
      placeInput.placeholder = '예: 아산시, 강릉시, 서울특별시';
      placeInput.title = '여행 전체를 대표하는 도시나 지역을 입력해 주세요. 구체적인 방문 장소는 아래에서 여러 곳 추가할 수 있습니다.';
    }
  }

  function placeRowTemplate(item) {
    const row = document.createElement('article');
    row.className = 'trip-extra-item';
    row.dataset.kind = 'place';
    row.dataset.clientId = item.clientId || idFor('place');
    row.innerHTML =
      '<div class="trip-extra-item-head"><b>방문 장소</b><button type="button" class="extra-remove-button" data-remove-row>삭제</button></div>' +
      '<div class="trip-extra-fields">' +
        '<label class="wide"><span>장소 이름 *</span><input data-field="name" maxlength="120" placeholder="예: 공세리성당, 곡교천, 현지 맛집" /></label>' +
        '<label><span>종류</span><select data-field="category"><option value="attraction">관광지</option><option value="restaurant">식당</option><option value="cafe">카페</option><option value="experience">체험</option><option value="shopping">쇼핑</option><option value="other">기타</option></select></label>' +
        '<label><span>방문일</span><input data-field="visitDate" type="date" /></label>' +
        '<label><span>방문 시간</span><input data-field="visitTime" type="time" /></label>' +
        '<label><span>방문 상태</span><select data-field="status"><option value="visited">다녀왔어요</option><option value="planned">방문 예정</option></select></label>' +
        '<label class="wide"><span>주소 / 위치</span><input data-field="address" placeholder="예: 충남 아산시 ... " /></label>' +
        '<label><span>시·도 / 지역</span><input data-field="region" placeholder="예: 충청남도 아산시" /></label>' +
        '<label><span>별점</span><select data-field="rating"><option value="">평가 안 함</option><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></label>' +
        '<label class="wide"><span>기억할 내용</span><textarea data-field="memo" rows="2" maxlength="1000" placeholder="맛있었던 메뉴, 아이들 반응, 다시 가고 싶은 이유 등"></textarea></label>' +
      '</div>' +
      '<div class="place-coordinates"><span>지도 위치</span><input data-field="lat" inputmode="decimal" placeholder="위도" /><input data-field="lng" inputmode="decimal" placeholder="경도" /><button type="button" class="tiny-btn neutral" data-pick-location>지도에서 선택</button><label><input data-field="favorite" type="checkbox" /> 다시 가고 싶은 곳</label></div>';
    setRowValues(row, item);
    return row;
  }
  function stayRowTemplate(item) {
    const row = document.createElement('article');
    row.className = 'trip-extra-item';
    row.dataset.kind = 'stay';
    row.dataset.clientId = item.clientId || idFor('stay');
    row.innerHTML =
      '<div class="trip-extra-item-head"><b>숙소</b><button type="button" class="extra-remove-button" data-remove-row>삭제</button></div>' +
      '<div class="trip-extra-fields">' +
        '<label class="wide"><span>숙소 이름 *</span><input data-field="name" maxlength="120" placeholder="예: 태백호텔, 라마다 호텔" /></label>' +
        '<label><span>체크인 날짜 *</span><input data-field="checkIn" type="date" /></label>' +
        '<label><span>체크인 시간</span><input data-field="checkInTime" type="time" /></label>' +
        '<label><span>체크아웃 날짜 *</span><input data-field="checkOut" type="date" /></label>' +
        '<label><span>체크아웃 시간</span><input data-field="checkOutTime" type="time" /></label>' +
        '<label class="wide"><span>주소 / 위치</span><input data-field="address" placeholder="숙소 주소 또는 지역" /></label>' +
        '<label><span>시·도 / 지역</span><input data-field="region" placeholder="예: 강원도 태백시" /></label>' +
        '<label><span>별점</span><select data-field="rating"><option value="">평가 안 함</option><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></label>' +
        '<label class="wide"><span>숙소 메모</span><textarea data-field="memo" rows="2" maxlength="1000" placeholder="객실, 조식, 주차, 수영장, 아이들 만족도 등"></textarea></label>' +
      '</div>' +
      '<div class="stay-row-foot"><span data-night-count>숙박일 수를 계산합니다.</span><div class="place-coordinates"><input data-field="lat" inputmode="decimal" placeholder="위도" /><input data-field="lng" inputmode="decimal" placeholder="경도" /><button type="button" class="tiny-btn neutral" data-pick-location>지도에서 선택</button></div></div>';
    setRowValues(row, item);
    updateStayNights(row);
    return row;
  }
  function setRowValues(row, item) {
    Object.keys(item || {}).forEach(key => {
      const field = row.querySelector('[data-field="' + key + '"]');
      if (!field) return;
      if (field.type === 'checkbox') field.checked = !!item[key];
      else field.value = item[key] == null ? '' : item[key];
    });
  }
  function collectRows(containerId, kind) {
    return [...($(containerId)?.querySelectorAll('.trip-extra-item') || [])].map((row, index) => {
      const get = key => row.querySelector('[data-field="' + key + '"]');
      const val = key => get(key)?.value || '';
      const number = key => val(key) === '' ? '' : Number(val(key));
      if (kind === 'place') return {
        clientId: row.dataset.clientId || idFor('place'),
        name: val('name').trim(), category: val('category') || 'attraction',
        visitDate: val('visitDate') || $('tripDate')?.value || '',
        visitTime: val('visitTime'), sequence: index,
        status: val('status') || 'visited',
        address: val('address'), region: val('region'),
        lat: number('lat'), lng: number('lng'), memo: val('memo'),
        rating: val('rating'), favorite: !!get('favorite')?.checked
      };
      return {
        clientId: row.dataset.clientId || idFor('stay'),
        name: val('name').trim(), checkIn: val('checkIn'), checkInTime: val('checkInTime'),
        checkOut: val('checkOut'), checkOutTime: val('checkOutTime'),
        address: val('address'), region: val('region'),
        lat: number('lat'), lng: number('lng'), memo: val('memo'), rating: val('rating')
      };
    }).filter(item => item.name);
  }
  function updateStayNights(row) {
    const start = row.querySelector('[data-field="checkIn"]')?.value;
    const end = row.querySelector('[data-field="checkOut"]')?.value;
    const count = row.querySelector('[data-night-count]');
    if (count) count.textContent = nightsBetween(start, end) + '박 숙박';
  }
  function renderEditorRows(places, stays) {
    const placeHolder = $('tripPlaceEditorRows');
    const stayHolder = $('tripStayEditorRows');
    if (!placeHolder || !stayHolder) return;
    placeHolder.replaceChildren();
    stayHolder.replaceChildren();
    (places || []).forEach(item => placeHolder.appendChild(placeRowTemplate(item)));
    (stays || []).forEach(item => stayHolder.appendChild(stayRowTemplate(item)));
    $('tripPlaceEmpty').style.display = places?.length ? 'none' : '';
    $('tripStayEmpty').style.display = stays?.length ? 'none' : '';
  }
  function populateTripFields() {
    const id = $('editTripId')?.value || '';
    const trip = id ? tripById(id) : null;
    const end = $('tripEndDate');
    const start = $('tripDate');
    if (end) end.value = trip?.endDate || (trip ? '' : (start?.value || localDate()));
    if ($('tripTransport')) $('tripTransport').value = trip?.transport || '';
    const selected = new Set(Array.isArray(trip?.companions) ? trip.companions : []);
    document.querySelectorAll('input[name="tripCompanion"]').forEach(input => { input.checked = selected.has(input.value); });
    if ($('tripOtherCompanions')) $('tripOtherCompanions').value = [...selected].filter(name => !['아빠', '수호', '현아'].includes(name)).join(', ');
    renderEditorRows(state.places.filter(item => String(item.tripId) === String(id)), state.stays.filter(item => String(item.tripId) === String(id)));
  }

  function saveTripExtras(tripId, payload) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('familyTravelPreview_v2') || '{}'); } catch (_) {}
    saved.trips = Array.isArray(saved.trips) ? saved.trips : [];
    const trip = saved.trips.find(item => String(item.id) === String(tripId));
    if (trip) {
      trip.endDate = payload.endDate || '';
      trip.companions = payload.companions;
      trip.transport = payload.transport;
      localStorage.setItem('familyTravelPreview_v2', JSON.stringify(saved));
    }
  }

  function installTripForm() {
    const form = $('tripForm');
    if (!form || form.dataset.extraInstalled) return;
    form.dataset.extraInstalled = '1';
    form.addEventListener('submit', event => {
      if (!parentMode()) { event.preventDefault(); event.stopImmediatePropagation(); toast('부모 계정에서만 여행 기록을 수정할 수 있습니다.'); return; }
      // Let the existing save routine keep using the same stable trip id.
      if (!$('editTripId').value) $('editTripId').value = idFor('trip');
      const tripId = $('editTripId').value;
      const companions = [...document.querySelectorAll('input[name="tripCompanion"]:checked')].map(input => input.value);
      const custom = $('tripOtherCompanions')?.value.split(',').map(name => name.trim()).filter(Boolean) || [];
      const payload = {
        endDate: $('tripEndDate')?.value || $('tripDate')?.value || '',
        companions: [...new Set(companions.concat(custom))],
        transport: $('tripTransport')?.value || '',
        places: collectRows('tripPlaceEditorRows', 'place'),
        stays: collectRows('tripStayEditorRows', 'stay')
      };
      const invalidStay = payload.stays.find(item => !item.checkIn || !item.checkOut || item.checkOut < item.checkIn);
      if (invalidStay) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast('숙소의 체크인·체크아웃 날짜를 확인해 주세요.');
        return;
      }
      setTimeout(async () => {
        try {
          let ready = false;
          for (let attempt = 0; attempt < 80; attempt += 1) {
            if (tripById(tripId)) { ready = true; break; }
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          if (!ready) throw new Error('여행 기본 기록이 저장되지 않아 세부 내용을 연결하지 못했습니다.');
          saveTripExtras(tripId, payload);
          if (!parentMode() || typeof window.saveFamilyTripDetails !== 'function') {
            throw new Error('가족 클라우드 저장 기능을 찾지 못했습니다. 페이지를 새로고침해 주세요.');
          }
          await new Promise(resolve => setTimeout(resolve, 900));
          await window.saveFamilyTripDetails(tripId, payload);
          state.places = state.places.filter(item => String(item.tripId) !== String(tripId)).concat(payload.places.map(item => ({ ...item, tripId })));
          state.stays = state.stays.filter(item => String(item.tripId) !== String(tripId)).concat(payload.stays.map(item => ({ ...item, tripId })));
          renderExplorer();
          renderTripDetailExtras();
          toast('여행 일정과 방문 장소·숙소를 가족 기록에 저장했어요. 🌷');
        } catch (error) {
          console.error('[여행 세부 기록 저장]', error);
          toast(error.message || '여행 세부 기록 저장에 실패했습니다.');
          alert(error.message || '여행 세부 기록 저장에 실패했습니다.');
        }
      }, 100);
    }, true);

    $('addTripPlaceRow')?.addEventListener('click', () => {
      const existing = collectRows('tripPlaceEditorRows', 'place');
      existing.push({ clientId: idFor('place'), name: '', category: 'attraction', visitDate: $('tripDate')?.value || localDate(), status: 'visited' });
      renderEditorRows(existing, collectRows('tripStayEditorRows', 'stay'));
      $('tripPlaceEditorRows')?.lastElementChild?.querySelector('[data-field="name"]')?.focus();
    });
    $('addTripStayRow')?.addEventListener('click', () => {
      const existing = collectRows('tripPlaceEditorRows', 'place');
      const stays = collectRows('tripStayEditorRows', 'stay');
      stays.push({ clientId: idFor('stay'), name: '', checkIn: $('tripDate')?.value || localDate(), checkOut: $('tripEndDate')?.value || $('tripDate')?.value || localDate() });
      renderEditorRows(existing, stays);
      $('tripStayEditorRows')?.lastElementChild?.querySelector('[data-field="name"]')?.focus();
    });
    form.addEventListener('click', event => {
      const remove = event.target.closest('[data-remove-row]');
      if (remove) {
        const card = remove.closest('.trip-extra-item');
        const places = collectRows('tripPlaceEditorRows', 'place');
        const stays = collectRows('tripStayEditorRows', 'stay');
        if (card?.dataset.kind === 'place') {
          const index = [...$('tripPlaceEditorRows').children].indexOf(card);
          places.splice(index, 1);
        } else if (card?.dataset.kind === 'stay') {
          const index = [...$('tripStayEditorRows').children].indexOf(card);
          stays.splice(index, 1);
        }
        renderEditorRows(places, stays);
      }
      const pick = event.target.closest('[data-pick-location]');
      if (pick) {
        const card = pick.closest('.trip-extra-item');
        if (card) openCoordinatePicker(card);
      }
    });
    form.addEventListener('change', event => {
      if (event.target.matches('[data-field="checkIn"],[data-field="checkOut"]')) updateStayNights(event.target.closest('.trip-extra-item'));
    });
    $('tripDate')?.addEventListener('change', () => {
      if (!$('editTripId').value && $('tripEndDate') && !$('tripEndDate').value) $('tripEndDate').value = $('tripDate').value;
    });
  }

  function ensureCoordinatePicker() {
    if ($('familyCoordinatePicker')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="coordinate-picker-backdrop" id="familyCoordinatePicker">' +
        '<div class="coordinate-picker-card"><div class="coordinate-picker-head"><div><h3>📍 지도에서 장소 위치 지정</h3><p>지도를 눌러 정확한 위치를 선택해 주세요.</p></div><button type="button" class="close" id="closeCoordinatePicker">×</button></div>' +
        '<div id="familyCoordinateMap" class="coordinate-picker-map"></div><div class="coordinate-picker-foot"><span id="coordinatePickerText">지도에서 위치를 선택해 주세요.</span><div><button type="button" class="secondary" id="cancelCoordinatePicker">취소</button><button type="button" class="primary" id="saveCoordinatePicker">위치 적용</button></div></div></div>' +
      '</div>');
    $('closeCoordinatePicker').addEventListener('click', closeCoordinatePicker);
    $('cancelCoordinatePicker').addEventListener('click', closeCoordinatePicker);
    $('saveCoordinatePicker').addEventListener('click', () => {
      if (!state.pickerTarget || !state.pickerPoint) return toast('먼저 지도에서 위치를 선택해 주세요.');
      const lat = state.pickerTarget.querySelector('[data-field="lat"]');
      const lng = state.pickerTarget.querySelector('[data-field="lng"]');
      if (lat) lat.value = state.pickerPoint.lat.toFixed(6);
      if (lng) lng.value = state.pickerPoint.lng.toFixed(6);
      closeCoordinatePicker();
      toast('지도 위치를 기록했어요.');
    });
  }
  function openCoordinatePicker(target) {
    if (!window.L) return toast('지도를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
    ensureCoordinatePicker();
    state.pickerTarget = target;
    const latValue = Number(target.querySelector('[data-field="lat"]')?.value);
    const lngValue = Number(target.querySelector('[data-field="lng"]')?.value);
    const tripId = $('editTripId')?.value;
    const trip = tripById(tripId);
    const center = Number.isFinite(latValue) && Number.isFinite(lngValue) && latValue && lngValue
      ? [latValue, lngValue]
      : (trip?.lat && trip?.lng ? [Number(trip.lat), Number(trip.lng)] : [36.2, 127.8]);
    state.pickerPoint = Number.isFinite(latValue) && Number.isFinite(lngValue) && latValue && lngValue
      ? { lat: latValue, lng: lngValue } : null;
    $('familyCoordinatePicker').classList.add('open');
    if (!state.picker) {
      state.picker = L.map('familyCoordinateMap').setView(center, 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(state.picker);
      state.picker.on('click', event => {
        state.pickerPoint = event.latlng;
        if (state.pickerMarker) state.picker.removeLayer(state.pickerMarker);
        state.pickerMarker = L.marker(event.latlng).addTo(state.picker);
        $('coordinatePickerText').textContent = event.latlng.lat.toFixed(6) + ', ' + event.latlng.lng.toFixed(6);
      });
    } else {
      state.picker.setView(center, 8);
    }
    if (state.pickerMarker) { state.picker.removeLayer(state.pickerMarker); state.pickerMarker = null; }
    if (state.pickerPoint) {
      state.pickerMarker = L.marker([state.pickerPoint.lat, state.pickerPoint.lng]).addTo(state.picker);
      $('coordinatePickerText').textContent = state.pickerPoint.lat.toFixed(6) + ', ' + state.pickerPoint.lng.toFixed(6);
    } else $('coordinatePickerText').textContent = '지도에서 위치를 선택해 주세요.';
    setTimeout(() => state.picker.invalidateSize(), 100);
  }
  function closeCoordinatePicker() { $('familyCoordinatePicker')?.classList.remove('open'); state.pickerTarget = null; }

  function categoryLabel(category) {
    return ({ attraction: '관광지', restaurant: '식당', cafe: '카페', experience: '체험', shopping: '쇼핑', other: '기타' })[category] || '기타';
  }
  function locationLabel(item) { return item.region || item.address || tripById(item.tripId)?.region || tripById(item.tripId)?.place || ''; }
  function groupPlaces(rows) {
    const map = new Map();
    rows.forEach(item => {
      const key = [String(item.name || '').trim().toLowerCase(), String(item.region || '').trim().toLowerCase(), item.category || ''].join('|');
      if (!map.has(key)) map.set(key, { name: item.name, region: locationLabel(item), category: item.category, rows: [] });
      map.get(key).rows.push(item);
    });
    return [...map.values()].sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name, 'ko'));
  }
  function renderPlaces() {
    const search = ($('placeSearch')?.value || '').trim().toLowerCase();
    const category = $('placeCategoryFilter')?.value || 'all';
    const status = $('placeStatusFilter')?.value || 'visited';
    const selected = state.places.filter(item =>
      (status === 'all' || (item.status || 'visited') === status) &&
      (category === 'all' || item.category === category) &&
      (!search || [item.name, item.region, item.address, item.memo, tripTitle(item.tripId)].join(' ').toLowerCase().includes(search))
    );
    const visited = state.places.filter(item => (item.status || 'visited') === 'visited');
    $('placeTotalPill').textContent = visited.length + '회 방문 · ' + groupPlaces(visited).length + '곳';
    $('placesSummary').innerHTML =
      '<div><b>' + visited.length + '</b><span>방문 기록</span></div>' +
      '<div><b>' + groupPlaces(visited).length + '</b><span>서로 다른 장소</span></div>' +
      '<div><b>' + state.places.filter(item => item.favorite).length + '</b><span>다시 가고 싶은 곳</span></div>';
    const holder = $('allFamilyPlaces');
    if (!holder) return;
    const groups = groupPlaces(selected);
    holder.innerHTML = groups.length ? groups.map(group => {
      const latest = [...group.rows].sort((a, b) => String(b.visitDate || '').localeCompare(String(a.visitDate || '')))[0];
      const history = [...group.rows].sort((a, b) => String(b.visitDate || '').localeCompare(String(a.visitDate || ''))).slice(0, 4);
      return '<article class="explorer-card">' +
        '<div class="explorer-card-icon">' + ({attraction:'🏞️',restaurant:'🍽️',cafe:'☕',experience:'🎨',shopping:'🛍️',other:'📌'}[group.category] || '📌') + '</div>' +
        '<div class="explorer-card-copy"><div class="explorer-card-top"><span class="explorer-tag">' + categoryLabel(group.category) + '</span><b>' + group.rows.length + '회</b></div>' +
        '<h3>' + escapeHTML(group.name) + '</h3><p>' + escapeHTML(group.region || locationLabel(latest)) + '</p>' +
        '<div class="explorer-history">' + history.map(item => '<div><span>' + escapeHTML(dateText(item.visitDate || tripById(item.tripId)?.date)) + '</span><button type="button" data-trip-open="' + escapeHTML(item.tripId) + '">' + escapeHTML(tripTitle(item.tripId)) + ' 보기</button></div>').join('') + '</div>' +
        (latest?.favorite ? '<span class="favorite-note">♡ 다시 가고 싶은 곳</span>' : '') +
        '</div></article>';
    }).join('') : '<div class="explorer-empty">아직 등록된 장소가 없어요. 여행 기록에서 방문 장소를 추가해 보세요.</div>';
  }
  function renderStays() {
    const search = ($('staySearch')?.value || '').trim().toLowerCase();
    const filtered = state.stays.filter(item => !search || [item.name, item.region, item.address, item.memo, tripTitle(item.tripId)].join(' ').toLowerCase().includes(search));
    const groups = new Map();
    filtered.forEach(item => {
      const key = [String(item.name || '').trim().toLowerCase(), String(item.region || '').trim().toLowerCase()].join('|');
      if (!groups.has(key)) groups.set(key, { name: item.name, region: locationLabel(item), rows: [] });
      groups.get(key).rows.push(item);
    });
    const totalNights = state.stays.reduce((sum, item) => sum + nightsBetween(item.checkIn, item.checkOut), 0);
    $('stayTotalPill').textContent = state.stays.length + '회 숙박 · ' + totalNights + '박';
    $('staysSummary').innerHTML =
      '<div><b>' + state.stays.length + '</b><span>숙박 기록</span></div>' +
      '<div><b>' + groups.size + '</b><span>이용한 숙소</span></div>' +
      '<div><b>' + totalNights + '</b><span>총 숙박일</span></div>';
    $('allFamilyStays').innerHTML = groups.size ? [...groups.values()].sort((a, b) => b.rows.length - a.rows.length).map(group =>
      '<article class="explorer-card stay-explorer-card"><div class="explorer-card-icon">🏨</div><div class="explorer-card-copy"><div class="explorer-card-top"><span class="explorer-tag">숙소</span><b>' + group.rows.length + '회 이용</b></div>' +
      '<h3>' + escapeHTML(group.name) + '</h3><p>' + escapeHTML(group.region) + '</p>' +
      '<div class="explorer-history">' + [...group.rows].sort((a,b) => String(b.checkIn || '').localeCompare(String(a.checkIn || ''))).map(item =>
        '<div><span>' + escapeHTML(dateText(item.checkIn)) + ' – ' + escapeHTML(dateText(item.checkOut)) + ' · ' + nightsBetween(item.checkIn,item.checkOut) + '박</span><button type="button" data-trip-open="' + escapeHTML(item.tripId) + '">' + escapeHTML(tripTitle(item.tripId)) + ' 보기</button></div>'
      ).join('') + '</div></div></article>'
    ).join('') : '<div class="explorer-empty">아직 등록된 숙소가 없어요. 숙박한 여행 기록에서 숙소를 추가해 보세요.</div>';
  }

  function renderStats() {
    const trips = allTrips();
    const visited = state.places.filter(item => (item.status || 'visited') === 'visited');
    const categories = ['attraction','restaurant','cafe','experience','shopping','other'];
    const categoryRows = categories.map(category => ({ category, count: visited.filter(item => item.category === category).length })).filter(item => item.count);
    const regionMap = new Map();
    visited.forEach(item => {
      const region = locationLabel(item) || '지역 미입력';
      regionMap.set(region, (regionMap.get(region) || 0) + 1);
    });
    const seasons = new Map([['봄',0],['여름',0],['가을',0],['겨울',0]]);
    trips.forEach(trip => {
      const month = Number(String(trip.date || '').slice(5,7));
      const season = month >= 3 && month <= 5 ? '봄' : month >= 6 && month <= 8 ? '여름' : month >= 9 && month <= 11 ? '가을' : month ? '겨울' : '';
      if (season) seasons.set(season, seasons.get(season) + 1);
    });
    const companionMap = new Map();
    trips.forEach(trip => (trip.companions || []).forEach(name => companionMap.set(name, (companionMap.get(name) || 0) + 1)));
    const nights = state.stays.reduce((sum, stay) => sum + nightsBetween(stay.checkIn, stay.checkOut), 0);
    const topRegion = [...regionMap.entries()].sort((a,b) => b[1]-a[1])[0];
    $('familyTravelStats').innerHTML =
      '<div class="stats-metric-grid">' +
        '<article><span>🧳 여행 횟수</span><b>' + trips.length + '</b></article>' +
        '<article><span>📍 실제 방문 장소</span><b>' + visited.length + '</b></article>' +
        '<article><span>🏨 숙박 횟수</span><b>' + state.stays.length + '</b></article>' +
        '<article><span>🌙 총 숙박일</span><b>' + nights + '박</b></article>' +
      '</div>' +
      '<div class="stats-detail-grid">' +
        '<section class="stats-detail-card"><h3>장소 종류별 방문 기록</h3>' + (categoryRows.length ? categoryRows.map(item => '<div class="stats-bar-line"><span>' + categoryLabel(item.category) + '</span><div><i style="width:' + Math.max(5, item.count / Math.max(...categoryRows.map(row => row.count)) * 100) + '%"></i></div><b>' + item.count + '</b></div>').join('') : '<p class="explorer-empty">방문 장소를 기록하면 종류별 통계가 쌓여요.</p>') + '</section>' +
        '<section class="stats-detail-card"><h3>가장 많이 방문한 지역</h3>' + (regionMap.size ? [...regionMap.entries()].sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,count]) => '<div class="stats-rank-line"><span>' + escapeHTML(name) + '</span><b>' + count + '회</b></div>').join('') : '<p class="explorer-empty">장소에 지역을 입력하면 지역별 통계가 보여요.</p>') + '</section>' +
        '<section class="stats-detail-card"><h3>계절별 여행 횟수</h3><div class="season-stat-grid">' + [...seasons.entries()].map(([name,count]) => '<div><span>' + name + '</span><b>' + count + '</b></div>').join('') + '</div></section>' +
        '<section class="stats-detail-card"><h3>함께 여행한 가족</h3>' + (companionMap.size ? [...companionMap.entries()].sort((a,b) => b[1]-a[1]).map(([name,count]) => '<div class="stats-rank-line"><span>' + escapeHTML(name) + '</span><b>' + count + '회</b></div>').join('') : '<p class="explorer-empty">여행 기록에 동행자를 선택하면 함께한 횟수가 쌓여요.</p>') + '</section>' +
      '</div>' +
      '<p class="stats-disclaimer">방문 장소 통계는 ‘다녀왔어요’로 저장된 항목만 계산합니다. 방문 예정 장소는 실제 방문 횟수에 포함하지 않습니다.</p>';
  }

  function initMap() {
    if (state.map || !window.L || !$('familyPlacesMap')) return;
    state.map = L.map('familyPlacesMap', { scrollWheelZoom: false }).setView([36.2, 127.8], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(state.map);
    renderMap();
  }
  function renderMap() {
    if (!state.map) return;
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers = [];
    const points = [];
    state.places.filter(item => (item.status || 'visited') === 'visited' && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)) && item.lat !== '' && item.lng !== '').forEach(item => {
      points.push({ lat:Number(item.lat), lng:Number(item.lng), icon:'📍', name:item.name, sub:categoryLabel(item.category) + ' · ' + dateText(item.visitDate), tripId:item.tripId });
    });
    state.stays.filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)) && item.lat !== '' && item.lng !== '').forEach(item => {
      points.push({ lat:Number(item.lat), lng:Number(item.lng), icon:'🏨', name:item.name, sub:dateText(item.checkIn) + ' – ' + dateText(item.checkOut), tripId:item.tripId });
    });
    const tripsWithDetailedPins = new Set(points.map(point => String(point.tripId)));
    allTrips().filter(item => item.lat !== '' && item.lng !== '' && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))).forEach(item => {
      if (!tripsWithDetailedPins.has(String(item.id))) {
        points.push({ lat:Number(item.lat), lng:Number(item.lng), icon:'🧳', name:item.place || item.title, sub:dateRange(item), tripId:item.id });
      }
    });
    points.forEach(point => {
      const marker = L.marker([point.lat, point.lng]).addTo(state.map);
      marker.bindPopup('<div class="family-map-popup"><b>' + escapeHTML(point.icon + ' ' + point.name) + '</b><span>' + escapeHTML(point.sub) + '</span><button type="button" data-trip-open="' + escapeHTML(point.tripId) + '">' + escapeHTML(tripTitle(point.tripId)) + ' 기록 보기</button></div>');
      state.markers.push(marker);
    });
    if (points.length > 1) {
      state.map.fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng])).pad(0.16), { maxZoom: 12 });
    } else if (points.length === 1) state.map.setView([points[0].lat, points[0].lng], 12);
    else state.map.setView([36.2,127.8],7);
  }
  function renderExplorer() {
    renderPlaces();
    renderStays();
    renderStats();
    if (state.map) renderMap();
  }
  function openTripFromExplorer(id) {
    const nav = document.querySelector('[data-view="trips"]');
    if (nav) nav.click();
    setTimeout(() => {
      const cards = [...document.querySelectorAll('[data-trip-card]')];
      const card = cards.find(node => String(node.dataset.tripCard) === String(id));
      if (card) card.click();
      else toast('해당 여행 기록을 찾지 못했습니다. 여행 기록 목록을 새로고침해 주세요.');
    }, 180);
  }
  function renderTripDetailExtras() {
    const modal = $('tripDetailModal');
    const title = $('tripDetailTitle')?.textContent;
    if (!modal || !modal.classList.contains('open')) return;
    const id = modal.dataset.extraTripId || '';
    const trip = tripById(id);
    const info = $('tripDetailInfo');
    if (!info || !trip) return;
    let panel = $('tripDetailJourneyExtras');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'tripDetailJourneyExtras';
      panel.className = 'trip-detail-extra-panel';
      info.insertAdjacentElement('afterend', panel);
    }
    const places = state.places.filter(item => String(item.tripId) === String(id));
    const stays = state.stays.filter(item => String(item.tripId) === String(id));
    const companions = (trip.companions || []).join(', ');
    const dayGroups = new Map();
    places.forEach(item => {
      const date = item.visitDate || trip.date || '날짜 미입력';
      if (!dayGroups.has(date)) dayGroups.set(date, []);
      dayGroups.get(date).push(item);
    });
    panel.innerHTML =
      '<div class="detail-extra-heading"><h3>🗓️ 우리 가족의 여행 일정</h3><span>' + escapeHTML(dateRange(trip)) + '</span></div>' +
      '<div class="detail-extra-meta">' +
        '<span>🚙 ' + escapeHTML(trip.transport || '이동수단 미입력') + '</span>' +
        '<span>👨‍👩‍👧‍👦 ' + escapeHTML(companions || '동행자 미입력') + '</span>' +
      '</div>' +
      '<div class="detail-extra-section"><h4>📍 방문 장소 ' + places.length + '곳</h4>' +
        (places.length ? [...dayGroups.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([date,items]) =>
          '<div class="detail-day-group"><b>' + escapeHTML(dateText(date)) + '</b>' + items.sort((a,b) => Number(a.sequence||0)-Number(b.sequence||0)).map(item =>
            '<div class="detail-place-line"><span>' + (item.status === 'planned' ? '📝' : '📍') + '</span><div><b>' + escapeHTML(item.name) + '</b><small>' + categoryLabel(item.category) + (item.visitTime ? ' · ' + escapeHTML(item.visitTime) : '') + (item.status === 'planned' ? ' · 방문 예정' : '') + '</small>' + (item.memo ? '<p>' + escapeHTML(item.memo) + '</p>' : '') + '</div>' + (item.favorite ? '<em>♡</em>' : '') + '</div>'
          ).join('') + '</div>'
        ).join('') : '<p class="detail-extra-empty">아직 방문 장소를 추가하지 않았습니다.</p>') +
      '</div>' +
      '<div class="detail-extra-section"><h4>🏨 숙소 ' + stays.length + '곳</h4>' +
        (stays.length ? stays.map(item => '<div class="detail-stay-line"><b>' + escapeHTML(item.name) + '</b><span>' + escapeHTML(dateText(item.checkIn)) + ' – ' + escapeHTML(dateText(item.checkOut)) + ' · ' + nightsBetween(item.checkIn,item.checkOut) + '박</span>' + (item.memo ? '<p>' + escapeHTML(item.memo) + '</p>' : '') + '</div>').join('') : '<p class="detail-extra-empty">등록된 숙소가 없습니다. 당일 여행이면 비워두면 됩니다.</p>') +
      '</div>';
    modal.dataset.extraTripId = id;
  }
  function installObservers() {
    const tripModal = $('tripModal');
    if (tripModal) new MutationObserver(() => {
      if (tripModal.classList.contains('open')) setTimeout(populateTripFields, 80);
    }).observe(tripModal, { attributes: true, attributeFilter: ['class'] });

    const detailModal = $('tripDetailModal');
    if (detailModal) new MutationObserver(() => {
      if (detailModal.classList.contains('open')) {
        const id = window.__familyTravelLastOpenedTripId || '';
        if (id && tripById(id)) {
          detailModal.dataset.extraTripId = id;
          setTimeout(renderTripDetailExtras, 80);
        }
      } else {
        detailModal.dataset.extraTripId = '';
      }
    }).observe(detailModal, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('click', event => {
      const card = event.target.closest('[data-trip-card]');
      const mainMapTrip = event.target.closest('[data-open-trip]');
      if (card) window.__familyTravelLastOpenedTripId = card.dataset.tripCard;
      else if (mainMapTrip) window.__familyTravelLastOpenedTripId = mainMapTrip.dataset.openTrip;
      const open = event.target.closest('[data-trip-open]');
      if (open) { event.preventDefault(); openTripFromExplorer(open.dataset.tripOpen); }
      const view = event.target.closest('.nav[data-view]');
      if (view) setTimeout(() => {
        if (view.dataset.view === 'places') renderPlaces();
        if (view.dataset.view === 'stays') renderStays();
        if (view.dataset.view === 'stats') renderStats();
        if (view.dataset.view === 'map') { initMap(); if (state.map) setTimeout(() => state.map.invalidateSize(), 120); renderMap(); }
      }, 80);
      if (event.target.closest('#refreshFamilyMap')) { initMap(); renderMap(); }
      if (event.target.closest('#addTripList') || event.target.closest('#addTripTop')) setTimeout(populateTripFields, 80);
      if (event.target.closest('#editTripFromDetail')) setTimeout(populateTripFields, 120);
    });
    $('placeSearch')?.addEventListener('input', renderPlaces);
    $('placeCategoryFilter')?.addEventListener('change', renderPlaces);
    $('placeStatusFilter')?.addEventListener('change', renderPlaces);
    $('staySearch')?.addEventListener('input', renderStays);
  }

  async function loadDetails() {
    if (typeof window.loadFamilyTripDetails !== 'function') return;
    try {
      const result = await window.loadFamilyTripDetails();
      state.places = result.places || [];
      state.stays = result.stays || [];
      renderExplorer();
      if ($('tripDetailModal')?.classList.contains('open')) renderTripDetailExtras();
    } catch (error) {
      console.error('[가족 방문 장소·숙소 불러오기]', error);
      toast(error.message || '방문 장소와 숙소 기록을 불러오지 못했습니다.');
    }
  }
  window.refreshFamilyTripExplorer = loadDetails;

  function installRoleDisplay() {
    const child = document.body.classList.contains('auth-child') || !parentMode();
    if (child) {
      document.querySelectorAll('#addTripList,#addTripTop,#addTripPlaceRow,#addTripStayRow,#tripModal button[type="submit"],#deleteTripBtn,#editTripFromDetail').forEach(node => { node.style.display = 'none'; });
    }
  }
  function install() {
    addNavigationAndViews();
    addTripEditor();
    installTripForm();
    ensureCoordinatePicker();
    installObservers();
    if (window.__familyAuthReady && typeof window.__familyAuthReady.then === 'function') {
      window.__familyAuthReady.then(() => {
        installRoleDisplay();
        loadDetails();
      }).catch(error => console.warn('[가족 여행 확장]', error));
    } else {
      installRoleDisplay();
      loadDetails();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();