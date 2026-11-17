/*
 * CALF STATION · Firebase patch-success recorder v1 (Spark plan)
 * Loaded ONLY after a verified, browser-generated patch download begins.
 * This is an optional, nonblocking analytics module. It never handles ROM bytes.
 *
 * BEFORE UPLOADING: copy the Firebase Web API Key into FIREBASE_WEB_API_KEY.
 * The web API key is a public project identifier, NOT an Admin SDK private key.
 * NEVER paste a service account JSON or private key in this file.
 */
(function (w) {
  'use strict';
  if (w.CALF_PATCH_COUNTER_V1) return;

  var FIREBASE_WEB_API_KEY = 'AIzaSyA1q0Ps-T40L6KX97PHlWJn1f7s9hPfLGA';
  var CONFIG = {
    apiKey: FIREBASE_WEB_API_KEY,
    projectId: 'calf-station',
    authDomain: 'calf-station.firebaseapp.com',
    databaseURL: 'https://calf-station-default-rtdb.asia-southeast1.firebasedatabase.app'
  };
  var SDK_ROOT = 'https://www.gstatic.com/firebasejs/12.11.0/';
  var sdkPromise = null;
  var authReadyPromise = null;
  var running = Promise.resolve();
  var recentlySent = Object.create(null);

  function logError(error) {
    // Counter errors must never affect the main game patcher or its UI.
    console.warn('[CALF PATCH COUNT] 기록 실패 (패치 다운로드는 정상):',
      error && error.message ? error.message : String(error));
  }

  function getSdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = Promise.all([
      import(SDK_ROOT + 'firebase-app.js'),
      import(SDK_ROOT + 'firebase-auth.js'),
      import(SDK_ROOT + 'firebase-database.js')
    ]).then(function (modules) {
      var app = modules[0].initializeApp(CONFIG, 'calf-station-patch-counter-v1');
      var auth = modules[1].getAuth(app);
      var db = modules[2].getDatabase(app);
      return { app: app, auth: auth, db: db, authentication: modules[1], database: modules[2] };
    }).catch(function (error) {
      sdkPromise = null; // Allow a later retry if the CDN was unavailable.
      throw error;
    });
    return sdkPromise;
  }

  async function ensureAnonymousAuth(sdk) {
    if (!authReadyPromise) {
      authReadyPromise = (async function () {
        if (typeof sdk.auth.authStateReady === 'function') {
          await sdk.auth.authStateReady();
        }
        if (!sdk.auth.currentUser) {
          await sdk.authentication.signInAnonymously(sdk.auth);
        }
        if (!sdk.auth.currentUser || !sdk.auth.currentUser.isAnonymous) {
          throw new Error('Firebase 익명 인증이 활성화되지 않았습니다.');
        }
      })().catch(function (error) {
        authReadyPromise = null;
        throw error;
      });
    }
    return authReadyPromise;
  }

  function findIndex(items, postId) {
    if (!items || typeof items !== 'object') return null;
    var target = '/' + postId;
    var keys = Object.keys(items);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var item = items[key];
      if (item && typeof item === 'object' && String(item.postPath || '') === target) {
        // Existing Firebase schema uses items/0..24; keep exact storage key.
        return key;
      }
    }
    return null;
  }

  async function recordOnce(postId) {
    if (!/^([1-9][0-9]{0,7})$/.test(postId)) {
      throw new Error('게시글 번호 형식이 잘못됐습니다.');
    }
    if (FIREBASE_WEB_API_KEY === 'PASTE_FIREBASE_WEB_API_KEY_HERE' ||
        !/^AIza[A-Za-z0-9_-]{10,}$/.test(FIREBASE_WEB_API_KEY)) {
      throw new Error('Firebase Web API Key를 JS 맨 위에 입력해야 합니다.');
    }

    var sdk = await getSdk();
    await ensureAnonymousAuth(sdk);
    var dbApi = sdk.database;

    dbApi.goOnline(sdk.db);
    try {
      var itemsSnapshot = await dbApi.get(dbApi.ref(sdk.db, 'items'));
      var entryKey = findIndex(itemsSnapshot.val(), postId);
      if (entryKey === null) {
        throw new Error('해당 글이 Firebase items에 등록되지 않았습니다: /' + postId);
      }
      var counterRef = dbApi.ref(sdk.db, 'items/' + entryKey + '/trackedSuccesses');
      // Prefetch the initial value; transaction callbacks may otherwise receive null from local cache.
      var currentSnap = await dbApi.get(counterRef);
      if (!currentSnap.exists() || !Number.isSafeInteger(currentSnap.val()) || currentSnap.val() < 0) {
        throw new Error('기존 trackedSuccesses 값이 올바르지 않습니다.');
      }
var result = await dbApi.runTransaction(counterRef, function (current) {
    if (current === null) return currentSnap.val() + 1;

    if (!Number.isSafeInteger(current) || current < 0 || current >= Number.MAX_SAFE_INTEGER) {
        return;
    }
    return current + 1;
}, { applyLocally: false });
      if (!result.committed) throw new Error('카운터 트랜잭션이 반영되지 않았습니다.');
      // This tab must not keep the archive's previous 90-second snapshot after +1.
      try { sessionStorage.removeItem('calf-patch-count-readonly-v3'); } catch (_) {}
      console.info('[CALF PATCH COUNT] /' + postId + ' 누적 성공 +1, 자동 집계분:',
        result.snapshot.val());
      return result.snapshot.val();
    } finally {
      // Do NOT maintain an open Realtime Database socket after the transaction.
      dbApi.goOffline(sdk.db);
    }
  }

  function record(postId) {
    var id = String(postId == null ? '' : postId).trim();
    var now = Date.now();
    // Prevent accidental duplicate button clicks without suppressing later legitimate patches.
    if (recentlySent[id] && (now - recentlySent[id]) < 15000) {
      return Promise.resolve({ skippedDuplicate: true });
    }
    recentlySent[id] = now;
    var next = running.catch(function () {}).then(function () {
      return recordOnce(id);
    });
    running = next;
    return next.catch(function (error) {
      delete recentlySent[id];
      logError(error);
      return { error: String(error && error.message || error) };
    });
  }

  w.CALF_PATCH_COUNTER_V1 = { record: record };
})(window);
