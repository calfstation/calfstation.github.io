/*
 CALF STATION · 누적 패치 표시 V3 · READ ONLY
 - Only /category/한글화; all other pages exit before any network request.
 - Existing HOME / NEXT / HISTORY / COMMENTS / PATCHER / CSS remain untouched.
 - Reads /patchStats.json (future canonical keyed model), falling back to
   /items.json (currently imported array model).
 - While Firebase is unavailable, displays the owner's 25 baseline estimates;
   no visitor count / patch success is incremented by this display script.
 - No SDK, realtime connection, cookie, or write request.
*/
(function () {
  'use strict';
  var pathname = location.pathname || '/';
  try { pathname = decodeURIComponent(pathname); } catch (_) {}
  if (pathname.replace(/\/+$/, '') !== '/category/한글화') return;
  if (window.__CALF_PATCH_COUNT_V3_STARTED__) return;
  window.__CALF_PATCH_COUNT_V3_STARTED__ = true;

  var ROOT = 'https://calf-station-default-rtdb.asia-southeast1.firebasedatabase.app';
  var ENDPOINTS = [ROOT + '/patchStats.json', ROOT + '/items.json'];
  var HOST_SELECTOR = '.calf-patch-category-archive-host';
  var CACHE_KEY = 'calf-patch-count-readonly-v3';
  var CACHE_LIFETIME_MS = 90 * 1000;
  var INITIAL = {"103":1157,"104":3695,"17":3517,"20":3105,"39":10540,"40":11781,"54":4263,"55":3872,"56":3654,"57":4032,"58":804,"6":2209,"61":1237,"65":4213,"66":4150,"75":3050,"76":3560,"8":2920,"80":5117,"81":4789,"86":975,"93":4345,"95":3870,"97":4654,"98":4879};
  var counts = Object.assign(Object.create(null), INITIAL);
  var host = null;
  var pending = false;
  var observer = null;
  var diagnostic = { status: 'initial-estimates', source: 'local', count: 25, requests: 0 };
  window.CALF_PATCH_COUNT_STATUS = diagnostic;

  function safeInt(value) {
    if (value == null || value === '') return null;
    var result = Number(value);
    return Number.isSafeInteger(result) && result >= 0 ? result : null;
  }
  function idFromPath(path) {
    var match = String(path == null ? '' : path).trim().match(/^\/?([0-9]+)\/?$/);
    return match ? match[1] : '';
  }
  function countRecords(value) {
    if (!value || typeof value !== 'object') return null;
    var src = value.patchStats || value.items || value;
    if (!src || typeof src !== 'object') return null;
    var result = Object.create(null);
    function put(entry, key) {
      if (!entry || typeof entry !== 'object') return;
      var id = idFromPath(entry.postPath || entry.path || entry.postId || entry.id || key);
      if (!id) return;
      var initial = safeInt(entry.initialEstimate);
      var increment = safeInt(entry.trackedSuccesses == null ? 0 : entry.trackedSuccesses);
      if (initial === null || increment === null) return;
      var total = initial + increment;
      if (Number.isSafeInteger(total)) result[id] = total;
    }
    if (Array.isArray(src)) src.forEach(function (entry) { put(entry, ''); });
    else Object.keys(src).forEach(function (key) { put(src[key], key); });
    return Object.keys(result).length ? result : null;
  }
  function cardId(link) {
    if (!link) return '';
    try {
      var u = new URL(link.getAttribute('href') || '', location.href);
      if (u.origin !== location.origin) return '';
      return idFromPath(u.pathname);
    } catch (_) { return ''; }
  }
  function paint() {
    pending = false;
    if (!host || !host.isConnected) return;
    host.querySelectorAll('a.calf-next-completed-card[href]').forEach(function (link) {
      var id = cardId(link);
      if (!id || !Object.prototype.hasOwnProperty.call(counts, id)) return;
      var line = link.querySelector('.calf-next-completed-meta');
      if (!line) return;
      var el = line.querySelector('[data-calf-patch-total-v3]');
      if (!el) {
        el = document.createElement('span');
        el.setAttribute('data-calf-patch-total-v3', '');
        el.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;margin-left:auto;padding:3px 7px;color:#fff;background:var(--red,#b22222);border:2px solid var(--gold,#d4af37);font-size:11px;font-weight:700;line-height:1.15;white-space:nowrap;flex-shrink:0;text-shadow:1px 1px 0 #000;box-shadow:1px 1px 0 rgba(0,0,0,.16)';
        el.title = '🎮 PRESS START! 추억의 플레이는 계속된다.';
        line.appendChild(el);
      }
      var text = '누적 패치 ' + counts[id].toLocaleString('ko-KR') + '회';
      if (el.textContent !== text) el.textContent = text;
    });
  }
  function schedulePaint() {
    if (pending || !host || !host.isConnected) return;
    pending = true;
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(paint);
    else window.setTimeout(paint, 0);
  }
  function loadCache() {
    try {
      var snapshot = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!snapshot || !snapshot.ts || Date.now() - snapshot.ts > CACHE_LIFETIME_MS) return null;
      return countRecords(snapshot.value);
    } catch (_) { return null; }
  }
  function saveCache(value) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(),value:value})); } catch (_) {}
  }
  function getOnce(url) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 3500) : null;
    diagnostic.requests += 1;
    return fetch(url, {
      method:'GET', mode:'cors', credentials:'omit', cache:'no-store',
      signal:ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).finally(function () { if (timer !== null) clearTimeout(timer); });
  }
  function readRemote() {
    // Data currently imported as root/items/0..24. Future projects may use patchStats/{postId}.
    function attempt(index) {
      if (index >= ENDPOINTS.length) {
        return Promise.reject(new Error('Both /patchStats and /items unavailable or unreadable'));
      }
      return getOnce(ENDPOINTS[index]).then(function (data) {
        var parsed = countRecords(data);
        if (!parsed) throw new Error('Empty or unknown Firebase data layout');
        counts = Object.assign(Object.create(null), INITIAL, parsed);
        diagnostic.status = 'firebase-ready';
        diagnostic.source = index === 0 ? 'patchStats' : 'items';
        diagnostic.count = Object.keys(parsed).length;
        saveCache(data);
        schedulePaint();
      }).catch(function (err) {
        if (index + 1 < ENDPOINTS.length) return attempt(index + 1);
        throw err;
      });
    }
    return attempt(0).catch(function (err) {
      diagnostic.status = 'firebase-unavailable';
      diagnostic.source = 'local-baseline-only';
      diagnostic.error = String(err && err.message || err);
      // Fallback seed stays visible. Browser console is the only place for diagnostics.
      console.warn('[CALF patch count] Firebase 조회 실패: 초기 추정치만 표시.', diagnostic.error);
    });
  }
  function mount() {
    host = document.querySelector(HOST_SELECTOR);
    if (!host) {
      diagnostic.status = 'archive-host-not-found';
      return; // No background Firebase request without a real archive host.
    }
    // Baseline appears after core archive renderer's first paint, independent of network.
    schedulePaint();
    observer = new MutationObserver(function (mutations) {
      // Archive updates its cards asynchronously using home-feed.json.
      if (mutations.some(function (m) { return m.type === 'childList'; })) schedulePaint();
    });
    observer.observe(host, {childList:true,subtree:true});
    // Avoid a permanent DOM observer on a long-lived page.
    setTimeout(function () { if (observer) observer.disconnect(); }, 45000);

    var cached = loadCache();
    if (cached) {
      counts = Object.assign(Object.create(null), INITIAL, cached);
      diagnostic.status = 'cache-ready';
      diagnostic.source = 'session';
      diagnostic.count = Object.keys(cached).length;
      schedulePaint();
      return;
    }
    readRemote();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
