/* MULTIPOLAR — ui/map.js
 * A stylised dot-grid world used as the situation board. The land mask is a
 * deliberately coarse 48×24 equirectangular grid: enough to read the continents
 * at phone size, not a cartographic product.
 */
(function (MP) {
  'use strict';

  const COLS = 48, ROWS = 24;
  /* row -> inclusive column ranges that count as land */
  const LAND = {
    1: [[11, 15], [17, 20], [33, 43]],
    2: [[3, 16], [17, 21], [24, 47]],
    3: [[2, 16], [17, 20], [22, 47]],
    4: [[3, 16], [22, 47]],
    5: [[6, 16], [22, 47]],
    6: [[7, 15], [22, 43]],
    7: [[8, 14], [22, 43]],
    8: [[9, 13], [21, 40]],
    9: [[10, 13], [21, 29], [33, 38]],
    10: [[12, 13], [22, 30], [34, 35], [37, 38]],
    11: [[13, 17], [22, 30], [37, 39]],
    12: [[14, 18], [25, 29], [37, 43]],
    13: [[14, 19], [25, 30], [38, 42]],
    14: [[14, 18], [25, 30], [39, 44]],
    15: [[14, 18], [26, 28], [39, 44]],
    16: [[14, 17], [26, 28], [39, 44], [47, 47]],
    17: [[14, 16], [43, 43], [46, 47]],
    18: [[14, 15]]
  };

  const W = 480, H = 240;
  const px = lon => (lon + 180) / 360 * W;
  const py = lat => (90 - lat) / 180 * H;

  function rungColor(r) {
    if (r >= 8) return '#ff4d4d';
    if (r >= 6) return '#ff7a3d';
    if (r >= 4) return '#ffb547';
    if (r >= 2) return '#ffe08a';
    return '#58c6ff';
  }

  function render(S, selectedId, onPick) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'map');
    svg.setAttribute('aria-label', 'World situation board');

    /* land */
    const g = document.createElementNS(NS, 'g');
    const cw = W / COLS, ch = H / ROWS;
    Object.keys(LAND).forEach(rk => {
      const r = +rk;
      LAND[rk].forEach(([a, b]) => {
        for (let c = a; c <= b; c++) {
          const d = document.createElementNS(NS, 'circle');
          d.setAttribute('cx', (c + 0.5) * cw);
          d.setAttribute('cy', (r + 0.5) * ch);
          d.setAttribute('r', 1.55);
          d.setAttribute('class', 'dot');
          g.appendChild(d);
        }
      });
    });
    svg.appendChild(g);

    /* theatre pins */
    MP.theaterList.forEach(id => {
      const T = MP.THEATERS[id], t = S.theaters[id];
      const x = px(T.lon), y = py(T.lat);
      const col = rungColor(t.rung);
      const size = 3 + t.rung * 0.55;

      const grp = document.createElementNS(NS, 'g');
      grp.setAttribute('class', 'pin' + (selectedId === id ? ' sel' : ''));

      const glow = document.createElementNS(NS, 'circle');
      glow.setAttribute('cx', x); glow.setAttribute('cy', y);
      glow.setAttribute('r', size + 4 + t.tension / 14);
      glow.setAttribute('fill', col);
      glow.setAttribute('class', 'glow');
      grp.appendChild(glow);

      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y);
      c.setAttribute('r', size);
      c.setAttribute('fill', col);
      grp.appendChild(c);

      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', x); ring.setAttribute('cy', y);
      ring.setAttribute('r', size + 2.5);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', selectedId === id ? '#fff' : col);
      ring.setAttribute('stroke-width', selectedId === id ? 1.4 : 0.7);
      ring.setAttribute('opacity', selectedId === id ? 1 : 0.55);
      ring.setAttribute('class', 'ring');
      grp.appendChild(ring);

      const hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('cx', x); hit.setAttribute('cy', y);
      hit.setAttribute('r', 15);
      hit.setAttribute('class', 'hit');
      grp.appendChild(hit);

      grp.addEventListener('click', () => onPick(id));
      svg.appendChild(grp);
    });

    return svg;
  }

  MP.map = { render, rungColor };
})(window.MP = window.MP || {});
