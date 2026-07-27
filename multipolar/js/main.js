/* MULTIPOLAR — main.js  (persistence + boot) */
(function (MP) {
  'use strict';

  const KEY = 'multipolar.save.v1';

  function quarterFn(t) {
    const q = ((t - 1) % 4) + 1, y = 2026 + Math.floor((t - 1) / 4);
    return 'Q' + q + ' ' + y;
  }

  MP.save = function (S) {
    try {
      const copy = Object.assign({}, S);
      delete copy.quarterOf;
      localStorage.setItem(KEY, JSON.stringify(copy));
    } catch (e) { /* private mode, quota — the game still plays, it just won't resume */ }
  };

  MP.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const S = JSON.parse(raw);
      if (!S || S.version !== 1 || !S.powers || !MP.POWERS[S.player]) return null;
      S.quarterOf = quarterFn;
      return S;
    } catch (e) { return null; }
  };

  MP.clearSave = function () {
    try { localStorage.removeItem(KEY); } catch (e) { }
  };

  document.addEventListener('DOMContentLoaded', function () {
    MP.ui.init();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }
  });
})(window.MP = window.MP || {});
