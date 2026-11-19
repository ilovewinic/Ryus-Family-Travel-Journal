
/*
 * Ryus Family Travel Journal - Cloudflare R2 photo sync
 * Load after Supabase auth bridge and before the main app script.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://pccgvfmvzaqhxsinquiv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LS7tlROmDZ05etj_k-L7Cg_6d6_M5mk';
  const WORKER_URL = 'https://ryus-family-photo.ilovewinic.workers.dev';
  const STORAGE_KEY = 'familyTravelPreview_v2';
  const DB_NAME = 'familyTravelPhotos_v2';
  const DB_STORE = 'originals';
  const MAX_FILE_SIZE = 15 * 1024 * 1024;

  let accessToken = '';
  let familyRole = '';
  let readyForSync = false;
  let syncRunning = false;
  let syncTimer = null;
  const photoBlobCache = new Map();

  function readSavedState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        trips: Array.isArray(value.trips) ? value.trips : [],
        photos: Array.isArray(value.photos) ? value.photos : []
      };
    } catch (error) {
      console.warn('[R2 사진 연동] 기존 저장 데이터를 읽지 못했습니다.', error);
      return { trips: [], photos: [] };
    }
  }

  function saveStateDirect(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getAccessToken() {
    const exactKey = 'sb-pccgvfmvzaqhxsinquiv-auth-token';
    const candidates = [exactKey];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.endsWith('-auth-token') && !candidates.includes(key)) candidates.push(key);
    }
    for (const key of candidates) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        const token = parsed.access_token || parsed.currentSession?.access_token;
        if (token) return token;
      } catch (_) {}
    }
    return '';
  }

  async function rest(path, options = {}) {
    accessToken = getAccessToken() || accessToken;
    if (!accessToken) throw new Error('로그인 인증 정보를 찾지 못했습니다. 다시 로그인해 주세요.');

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.prefer) headers.Prefer = options.prefer;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase 요청 오류 (${response.status}): ${detail.slice(0, 240)}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function openPhotoDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) {
          request.result.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('사진 저장 공간을 열지 못했습니다.'));
    });
  }

  async function getLocalBlob(id) {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, 'readonly');
      const request = transaction.objectStore(DB_STORE).get(id);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function putLocalBlob(id, blob) {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put({ id, blob });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('사진 저장에 실패했습니다.'));
    });
  }

  async function deleteLocalBlob(id) {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).delete(String(id));
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error('기기 사진 캐시 삭제에 실패했습니다.')); };
    });
  }

  async function callWorker(key, method, blob) {
    accessToken = getAccessToken() || accessToken;
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (blob) headers['Content-Type'] = blob.type || 'image/jpeg';
    const response = await fetch(`${WORKER_URL}/${key}`, {
      method,
      headers,
      body: blob || undefined
    });
    if (!response.ok) {
      // DELETE is idempotent: if the object is already missing, continue
      // removing its Supabase metadata rather than leaving a ghost photo card.
      if (method === 'DELETE' && response.status === 404) return true;
      const detail = await response.text().catch(() => '');
      throw new Error(`사진 서버 오류 (${response.status}): ${detail.slice(0, 200)}`);
    }
    if (method === 'GET') return response.blob();
    return true;
  }

  function photoIdFromKey(objectKey, rowId) {
    const filePart = String(objectKey || '').split('/').pop() || '';
    const dash = filePart.indexOf('-');
    return dash > 0 ? filePart.slice(0, dash) : `r2_${rowId}`;
  }

  function safeFileName(name) {
    const cleaned = String(name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    return cleaned || 'photo';
  }

  async function getPhotoRows() {
    return await rest('journal_photos?select=id,journal_id,object_key,file_name,content_type,byte_size,sort_order,is_print_selected&order=sort_order.asc');
  }

  window.loadFamilyPhotoBlobById = async function(photoId) {
    const id = String(photoId || '');
    if (!id) return null;
    if (photoBlobCache.has(id)) return photoBlobCache.get(id);
    let blob = null;
    try { blob = await getLocalBlob(id); } catch (_) {}
    if (blob) return blob;

    const state = readSavedState();
    const photo = state.photos.find(item => String(item.id) === id);
    let objectKey = photo?.objectKey || '';
    if (!objectKey) {
      const rows = await getPhotoRows();
      const row = rows.find(item => photoIdFromKey(item.object_key, item.id) === id);
      objectKey = row?.object_key || '';
    }
    if (!objectKey) return null;

    blob = await callWorker(objectKey, 'GET');
    photoBlobCache.set(id, blob);
    try { await putLocalBlob(id, blob); }
    catch (error) { console.warn('[R2 사진 연동] 사진을 메모리 캐시에 보관합니다.', error); }
    return blob;
  };

  async function getJournalRows() {
    return await rest('journals?select=id,client_id');
  }

  async function getFamilyRole() {
    const rows = await rest('family_members?select=role&limit=1');
    if (!rows || !rows.length) throw new Error('가족 계정 권한을 확인하지 못했습니다.');
    return rows[0].role;
  }

  async function restoreRemotePhotos() {
    const [journals, rows] = await Promise.all([getJournalRows(), getPhotoRows()]);
    const clientIdByJournalId = new Map(journals.map(row => [String(row.id), String(row.client_id)]));
    const state = readSavedState();
    const photoById = new Map(state.photos.map(photo => [String(photo.id), photo]));
    let restored = 0;
    let failed = 0;

    for (let start = 0; start < rows.length; start += 3) {
      const batch = rows.slice(start, start + 3);
      await Promise.all(batch.map(async row => {
        const tripId = clientIdByJournalId.get(String(row.journal_id));
        if (!tripId) return;
        const photoId = photoIdFromKey(row.object_key, row.id);
        const metadata = {
          id: photoId,
          tripId,
          name: row.file_name || '여행 사진',
          printSelected: !!row.is_print_selected,
          type: row.content_type || 'image/jpeg',
          size: Number(row.byte_size || 0),
          objectKey: row.object_key
        };
        // Keep the album/card information even if this device cannot cache the file yet.
        photoById.set(photoId, metadata);
        try {
          let blob = null;
          try { blob = await getLocalBlob(photoId); } catch (_) {}
          if (!blob) blob = await callWorker(row.object_key, 'GET');
          metadata.type = row.content_type || blob.type || 'image/jpeg';
          metadata.size = Number(row.byte_size || blob.size || 0);
          try {
            await putLocalBlob(photoId, blob);
          } catch (storageError) {
            // A memory copy allows this session to display the photo on restrictive mobile storage.
            photoBlobCache.set(String(photoId), blob);
            console.warn('[R2 사진 연동] 기기 저장소 캐시는 생략하고 메모리에서 표시합니다.', storageError);
          }
          restored += 1;
        } catch (error) {
          failed += 1;
          console.warn('[R2 사진 연동] 사진 파일을 아직 내려받지 못했습니다:', row.object_key, error);
        }
      }));
    }

    state.photos = [...photoById.values()];
    saveStateDirect(state);
    return { journals, rows, restored, failed };
  }

  async function uploadOnePhoto(photo, journalId, sortOrder) {
    const blob = await getLocalBlob(photo.id);
    if (!blob) return null;
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error(`${photo.name || '사진'}: 15MB를 초과해 업로드하지 않았습니다.`);
    }

    const key = `photos/${journalId}/${photo.id}-${safeFileName(photo.name)}`;
    await callWorker(key, 'PUT', blob);
    try {
      await rest('journal_photos', {
        method: 'POST',
        prefer: 'return=minimal',
        body: {
          journal_id: Number(journalId),
          object_key: key,
          file_name: photo.name || '여행 사진',
          content_type: blob.type || photo.type || 'image/jpeg',
          byte_size: blob.size,
          sort_order: sortOrder,
          is_print_selected: !!photo.printSelected
        }
      });
    } catch (error) {
      await callWorker(key, 'DELETE').catch(() => {});
      throw error;
    }
    return key;
  }

  async function syncLocalPhotos() {
    if (familyRole !== 'parent' || syncRunning || !readyForSync) return;
    syncRunning = true;
    try {
      const state = readSavedState();
      let journals = await getJournalRows();
      let rows = await getPhotoRows();
      let journalIdByClientId = new Map(journals.map(row => [String(row.client_id), String(row.id)]));
      let rowByPhotoId = new Map(rows.map(row => [photoIdFromKey(row.object_key, row.id), row]));

      for (const photo of state.photos) {
        if (rowByPhotoId.has(String(photo.id))) continue;
        let journalId = journalIdByClientId.get(String(photo.tripId));
        for (let attempt = 0; !journalId && attempt < 3; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 900));
          journals = await getJournalRows();
          journalIdByClientId = new Map(journals.map(row => [String(row.id), String(row.client_id)]));
          journalId = journalIdByClientId.get(String(photo.tripId));
        }
        if (!journalId) {
          console.warn('[R2 사진 연동] 연결된 여행 기록을 아직 찾지 못했습니다:', photo.tripId);
          continue;
        }
        const sortOrder = state.photos.filter(item => String(item.tripId) === String(photo.tripId)).findIndex(item => String(item.id) === String(photo.id));
        try {
          const key = await uploadOnePhoto(photo, journalId, Math.max(0, sortOrder));
          if (key) rowByPhotoId.set(String(photo.id), { object_key: key, is_print_selected: !!photo.printSelected });
        } catch (error) {
          console.error('[R2 사진 연동] 사진 업로드 실패:', error);
          showMessage(error.message || '사진 업로드에 실패했습니다.');
        }
      }

      for (const photo of state.photos) {
        const row = rowByPhotoId.get(String(photo.id));
        if (!row || !!row.is_print_selected === !!photo.printSelected || !row.object_key) continue;
        try {
          await rest(`journal_photos?object_key=eq.${encodeURIComponent(row.object_key)}`, {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: { is_print_selected: !!photo.printSelected }
          });
          row.is_print_selected = !!photo.printSelected;
        } catch (error) {
          console.warn('[R2 사진 연동] 인화 후보 상태 동기화 실패:', error);
        }
      }
    } finally {
      syncRunning = false;
    }
  }

window.isFamilyPhotoParent = () => familyRole === 'parent';
  window.clearFamilyPhotoBlobCache = photoId => photoBlobCache.delete(String(photoId || ''));

  window.deleteFamilyPhotoFromCloud = async function(photoId) {
    if (familyRole !== 'parent') {
      throw new Error('부모 계정에서만 사진을 삭제할 수 있습니다.');
    }

    const rows = await getPhotoRows();
    const row = rows.find(item =>
      photoIdFromKey(item.object_key, item.id) === String(photoId)
    );

    if (!row) {
      photoBlobCache.delete(String(photoId));
      return true;
    }

    await callWorker(row.object_key, 'DELETE');

    await rest(
      `journal_photos?object_key=eq.${encodeURIComponent(row.object_key)}`,
      {
        method: 'DELETE',
        prefer: 'return=minimal'
      }
    );

    photoBlobCache.delete(String(photoId));
    return true;
  };

  // Remove only the exact user-reported filenames. This also handles stale local
  // copies and metadata rows that were left behind by an earlier partial deletion.
  window.deleteFamilyPhotosByFileNames = async function(fileNames) {
    if (familyRole !== 'parent') throw new Error('부모 계정에서만 사진 파일을 정리할 수 있습니다.');
    const normalizeName = value => String(value || '').normalize('NFC').trim().split('/').pop().toLowerCase();
    const targets = new Set((Array.isArray(fileNames) ? fileNames : []).map(normalizeName).filter(Boolean));
    if (!targets.size) return { deleted: 0, names: [] };

    const nameFromKey = objectKey => {
      const leaf = String(objectKey || '').split('/').pop() || '';
      const dash = leaf.indexOf('-');
      return dash > 0 ? leaf.slice(dash + 1) : leaf;
    };
    const rows = await getPhotoRows();
    const state = readSavedState();
    const matchesName = value => targets.has(normalizeName(value));

    const matchingRows = rows.filter(row =>
      matchesName(row.file_name) || matchesName(nameFromKey(row.object_key))
    );
    const matchingLocal = state.photos.filter(photo =>
      matchesName(photo.name) || matchesName(nameFromKey(photo.objectKey))
    );

    const keys = new Set();
    matchingRows.forEach(row => { if (row.object_key) keys.add(String(row.object_key)); });
    matchingLocal.forEach(photo => { if (photo.objectKey) keys.add(String(photo.objectKey)); });

    // Never claim success or erase metadata if we cannot locate the actual R2 key.
    if (!keys.size && (matchingRows.length || matchingLocal.length)) {
      throw new Error('대상 사진의 R2 저장 위치를 찾지 못했습니다. 사진 메타데이터를 보존했습니다.');
    }

    for (const key of keys) await callWorker(key, 'DELETE');

    for (const row of matchingRows) {
      await rest(
        `journal_photos?id=eq.${encodeURIComponent(row.id)}`,
        { method: 'DELETE', prefer: 'return=minimal' }
      );
      const photoId = photoIdFromKey(row.object_key, row.id);
      if (row.journal_id && photoId) {
        await rest(
          `journals?id=eq.${encodeURIComponent(row.journal_id)}&cover_photo_id=eq.${encodeURIComponent(photoId)}`,
          { method: 'PATCH', body: { cover_photo_id: null }, prefer: 'return=minimal' }
        );
      }
    }

    const ids = new Set([
      ...matchingRows.map(row => photoIdFromKey(row.object_key, row.id)),
      ...matchingLocal.map(photo => String(photo.id))
    ].filter(Boolean));

    if (ids.size || matchingLocal.length) {
      state.photos = state.photos.filter(photo =>
        !ids.has(String(photo.id)) &&
        !matchesName(photo.name) &&
        !matchesName(nameFromKey(photo.objectKey))
      );
      saveStateDirect(state);
      for (const id of ids) {
        photoBlobCache.delete(String(id));
        await deleteLocalBlob(id).catch(error => console.warn('[R2 사진 정리] 기기 캐시 삭제 실패:', error));
      }
    }

    return { deleted: keys.size, names: [...targets] };
  };
  
  function showMessage(message) {
    const banner = document.querySelector('.preview-banner');
    if (banner) {
      banner.innerHTML = `<b>사진 업로드 안내</b>${String(message).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}`;
    }
  }

  function installStorageWatcher() {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (key === STORAGE_KEY && readyForSync && familyRole === 'parent') {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          syncLocalPhotos().catch(error => {
            console.error('[R2 사진 연동] 자동 동기화 실패:', error);
            showMessage('사진 자동 동기화에 실패했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.');
          });
        }, 1400);
      }
    };
  }

  async function bootPhotoSync() {
    accessToken = getAccessToken();
    if (!accessToken) throw new Error('Supabase 로그인 토큰을 찾지 못했습니다.');
    familyRole = await getFamilyRole();
    const result = await restoreRemotePhotos();
    // User explicitly asked to remove these two exact image files. Clean both R2
    // objects and Supabase rows, then remove their local metadata/cache as well.
    if (familyRole === 'parent' && typeof window.deleteFamilyPhotosByFileNames === 'function') {
      try {
        const cleanup = await window.deleteFamilyPhotosByFileNames([
          '20261002_144615.jpg',
          'imshr_2026-11-13y11-54-51-898z.png'
        ]);
        if (cleanup.deleted > 0) {
          showMessage('요청하신 사진 파일 ' + cleanup.deleted + '개를 클라우드와 가족 앨범에서 정리했습니다.');
        }
      } catch (error) {
        console.error('[요청 사진 파일 정리]', error);
        showMessage('요청하신 사진 파일 정리 중 문제가 발생했습니다. ' + (error.message || '새로고침 후 다시 시도해 주세요.'));
      }
    }

    // Remote metadata was read successfully; a failed image fetch should not disable normal photo sync.
    readyForSync = true;
    installStorageWatcher();

    if (familyRole === 'parent') {
      setTimeout(() => {
        syncLocalPhotos().catch(error => {
          console.error('[R2 사진 연동] 초기 사진 업로드 실패:', error);
          showMessage('일부 사진을 클라우드에 올리지 못했습니다. 인터넷 연결을 확인해 주세요.');
        });
      }, 1200);
    }

    const banner = document.querySelector('.preview-banner');
    if (banner && result.failed === 0) {
      banner.innerHTML = '<b>가족 계정 연결</b>여행 기록과 사진은 Supabase·Cloudflare R2에 저장되어 가족 기기에서 함께 볼 수 있습니다. 부모 계정에서 사진을 추가하면 자동으로 공유됩니다.';
    } else if (result.failed > 0) {
      showMessage(`사진 ${result.restored}장은 불러왔지만 ${result.failed}장은 아직 내려받지 못했습니다. 새로고침하면 다시 시도합니다.`);
    }
  }

  if (window.__familyAuthReady && typeof window.__familyAuthReady.then === 'function') {
    window.__familyAuthReady = window.__familyAuthReady.then(async () => {
      try {
        await bootPhotoSync();
      } catch (error) {
        console.error('[R2 사진 연동] 초기화 실패:', error);
        showMessage('사진 클라우드 연결을 시작하지 못했습니다. 여행 기록은 기존 방식대로 열립니다. ' + (error.message || ''));
      }
    });
  } else {
    console.error('[R2 사진 연동] Supabase 인증 준비 상태를 찾지 못했습니다.');
  }
})();
