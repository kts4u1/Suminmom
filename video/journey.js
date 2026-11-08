'use strict';
// "Road to Suminmom": a terrain flyover over Bukhansan, across the Han River, to the Bucheon office.
// renderAt(t) places the camera for second t and resolves once every tile of that frame is drawn,
// so the recorder can step through the clip frame by frame. ?fmt=h gives a 1920x1080 version.
(async function () {
  const QS = new URLSearchParams(location.search);
  const HZ = QS.get('fmt') === 'h';
  // the 3D map is drawn at reduced resolution (software rendering is slow); text overlays stay sharp
  const MAP_PR = parseFloat(QS.get('pr') || '0.6667');
  const W = HZ ? 1920 : 1080, H = HZ ? 1080 : 1920;
  document.documentElement.style.setProperty('--W', `${W}px`);
  document.documentElement.style.setProperty('--H', `${H}px`);
  document.getElementById('stage').classList.add(HZ ? 'fmt-h' : 'fmt-v');

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const E = {
    outCubic: (t) => 1 - (1 - t) ** 3,
    inCubic: (t) => t * t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  };
  const env = (t, a, b, fi = 0.6, fo = 0.5) => Math.min(E.outCubic(seg(t, a, a + fi)), 1 - E.inCubic(seg(t, b - fo, b)));
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  function tf(e, x = 0, y = 0, s = 1, o = 1, r = 0) {
    e.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(4)})${r ? ` rotate(${r.toFixed(2)}deg)` : ''}`;
    e.style.opacity = o.toFixed(3);
  }
  function rv(e, t, a, b, o = {}) {
    const { dx = 0, dy = 36, ds = 0, din = 0.7, dout = 0.45, ease = E.outCubic } = o;
    const pi = ease(seg(t, a, a + din));
    const po = b == null ? 0 : E.inCubic(seg(t, b - dout, b));
    tf(e, dx * (1 - pi), dy * (1 - pi) - 20 * po, 1 + ds * (1 - pi), clamp(pi) * (1 - po));
    return clamp(pi) * (1 - po);
  }

  const cfg = await (await fetch('config.json', { cache: 'no-store' })).json();
  const J = cfg.journey, D = cfg.data, OFF = D.office, TX = J.text, EXG = J.exaggeration;
  const DUR = J.duration, [F0, F1] = J.flight;
  await Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px Pretendard`, '가나다 123')));
  await Promise.all([document.fonts.load('700 40px Batang', '수민맘'), document.fonts.load('italic 500 40px Corm', 'Road')]);

  // ---------- flight path, in metres around the office ----------
  const MLAT = 111320, MLON = 111320 * Math.cos((OFF.lat * Math.PI) / 180);
  const toM = (lon, lat) => [(lon - OFF.lon) * MLON, (lat - OFF.lat) * MLAT];
  const toLL = (x, y) => [OFF.lon + x / MLON, OFF.lat + y / MLAT];
  const R = J.route.map(([lon, lat, alt, gnd]) => { const [x, y] = toM(lon, lat); return { x, y, alt, gnd }; });
  const END = R[R.length - 1];
  const HQ = { x: 0, y: 0, alt: END.alt, gnd: 23 };
  const PAST = { x: -END.x, y: -END.y, alt: END.alt, gnd: 23 }; // a point past the office, only for the look-ahead
  const P = [...R, HQ, PAST];
  const cr = (p0, p1, p2, p3, u) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  const SEG = 400, S = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < SEG; k++) {
      const u = k / SEG;
      S.push({ x: cr(p0.x, p1.x, p2.x, p3.x, u), y: cr(p0.y, p1.y, p2.y, p3.y, u), alt: cr(p0.alt, p1.alt, p2.alt, p3.alt, u), gnd: lerp(p1.gnd, p2.gnd, smooth(0, 1, u)) });
    }
  }
  S.push({ ...P[P.length - 1] });
  S[0].d = 0;
  for (let i = 1; i < S.length; i++) S[i].d = S[i - 1].d + Math.hypot(S[i].x - S[i - 1].x, S[i].y - S[i - 1].y);
  const L_ROUTE = S[(R.length - 1) * SEG].d, L_HQ = S[R.length * SEG].d;
  function at(d) {
    d = clamp(d, 0, S[S.length - 1].d);
    let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].d <= d) lo = m; else hi = m; }
    const a = S[lo], b = S[hi], u = b.d > a.d ? (d - a.d) / (b.d - a.d) : 0;
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), alt: lerp(a.alt, b.alt, u), gnd: lerp(a.gnd, b.gnd, u) };
  }
  const distAt = (t) => L_ROUTE * E.inOutSine(seg(t, F0, F1));
  // aim a little short of the office so its pin sits just above the frame centre,
  // leaving balanced room for the address card above and the info panel below
  const AIM = HZ ? 0 : 40;

  // camera position and look-at point for second t
  function camera(t) {
    if (t <= F1) {
      const d = distAt(t), c = at(d);
      const la = lerp(J.lookAhead, L_HQ - L_ROUTE - AIM, smooth(0.74, 1, d / L_ROUTE));
      const g = at(d + la);
      return { c, g: { x: g.x, y: g.y, alt: g.gnd * EXG } };
    }
    // after arriving, circle slowly around the office
    const k = E.inOutSine(seg(t, F1, DUR)), th = (-J.orbit * Math.PI / 180) * k;
    const x = END.x * Math.cos(th) - END.y * Math.sin(th), y = END.x * Math.sin(th) + END.y * Math.cos(th);
    const n = Math.hypot(x, y);
    return { c: { x, y, alt: END.alt - 50 * k }, g: { x: (x / n) * AIM, y: (y / n) * AIM, alt: HQ.gnd * EXG } };
  }
  const line = (d0, d1, step = 60) => {
    const c = [];
    for (let d = d0; d < d1; d += step) { const p = at(d); c.push(toLL(p.x, p.y)); }
    const p = at(d1); c.push(toLL(p.x, p.y));
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {} };
  };

  // ---------- map ----------
  const ORIGIN = location.origin;
  const map = new maplibregl.Map({
    container: 'map', interactive: false, attributionControl: false, fadeDuration: 0, maxPitch: 85,
    centerClampedToGround: false, pixelRatio: MAP_PR,
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    center: [OFF.lon, OFF.lat], zoom: 11,
    style: {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: [`${ORIGIN}/wb/{z}/{y}/{x}.jpg`], tileSize: 256, maxzoom: 18 },
        dem: { type: 'raster-dem', tiles: [`${ORIGIN}/dem/{z}/{x}/{y}.png`], tileSize: 256, encoding: 'terrarium', maxzoom: 12 },
        ahead: { type: 'geojson', data: line(0, L_HQ) },
      },
      layers: [
        { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 0, 'raster-brightness-min': 0.06, 'raster-saturation': 0.22, 'raster-contrast': 0.06 } },
        { id: 'glow', type: 'line', source: 'ahead', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFD3C9', 'line-width': HZ ? 18 : 22, 'line-blur': 8, 'line-opacity': 0.55 } },
        { id: 'path', type: 'line', source: 'ahead', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#E8877D', 'line-width': HZ ? 7 : 9, 'line-opacity': 0.95 } },
        { id: 'dash', type: 'line', source: 'ahead', layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': HZ ? 3 : 4, 'line-dasharray': [2, 2.5], 'line-opacity': 0.95 } },
      ],
      terrain: { source: 'dem', exaggeration: EXG },
      sky: { 'sky-color': '#9DCDF0', 'sky-horizon-blend': 0.55, 'horizon-color': '#FFE8DC', 'horizon-fog-blend': 0.6, 'fog-color': '#F7ECE6', 'fog-ground-blend': 0.55, 'atmosphere-blend': 0 },
    },
  });
  await new Promise((r) => map.once('load', r));
  map.setVerticalFieldOfView(HZ ? 42 : 62);
  const idle = () => new Promise((res) => {
    let done = false;
    const fin = () => { if (!done) { done = true; clearTimeout(to); res(); } };
    const to = setTimeout(fin, 45000);
    map.once('idle', fin);
    map.triggerRepaint();
  });

  // ---------- overlays ----------
  const svgo = (inner, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICON = {
    mountain: svgo('<path d="M2 20l6.5-11 4 6.5 2.5-4L22 20z"/><path d="M6.6 12.3l1.9 1.4 1.6-1.3"/>'),
    wave: svgo('<path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>'),
    pin: svgo('<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>'),
    needle: svgo('<path d="M4 20L18 6"/><ellipse cx="19.2" cy="4.8" rx="1.6" ry="1" transform="rotate(-45 19.2 4.8)"/><path d="M4 20c3-1 6-1 9 1s5 1 7-1" stroke-dasharray="2 2.4"/>'),
    truck: svgo('<rect x="2" y="6" width="12" height="10" rx="1.5"/><path d="M14 9h4l3 3.5V16h-7z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>'),
    phone: svgo('<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>'),
  };
  const ov = $('#ov'), ui = $('#ui');
  // petals and soft light after arriving
  const r = rng(29);
  const bok = Array.from({ length: 9 }, () => ({ x: r() * W, y: r() * H, s: 200 + r() * 360, c: ['255,222,210', '255,236,200', '255,246,236'][Math.floor(r() * 3)], a: 0.22 + r() * 0.25, f: r() * 6 }));
  const pet = Array.from({ length: 32 }, () => ({ x: r() * W, y: r() * H, v: 36 + r() * 46, s: 0.7 + r() * 1.0, f: r() * 6, rot: r() * 360, c: ['#F6CFC6', '#FBE3D6', '#FFF4E8', '#F3C2BA'][Math.floor(r() * 4)] }));
  const deco = el(`<div class="layer">${bok.map((b) => `<div class="bokeh" style="width:${b.s}px;height:${b.s}px;background:radial-gradient(closest-side,rgba(${b.c},${b.a}),rgba(${b.c},0))"></div>`).join('')}${pet.map((p) => `<div class="petal" style="background:${p.c}"></div>`).join('')}</div>`);
  $('#fxl').appendChild(deco);
  const lms = J.landmarks.map((m) => { const e = el(`<div class="lm a"><div class="st"></div><div class="d"></div><div class="lb"><b>${m.name}</b>${m.sub ? `<small>${m.sub}</small>` : ''}</div></div>`); ov.appendChild(e); return { m, e, p: toM(m.lon, m.lat) }; });
  const pinSvg = '<svg viewBox="0 0 84 114"><path d="M42 4C21 4 4 20.4 4 41 4 69 42 110 42 110s38-41 38-69C80 20.4 63 4 42 4z" fill="#D58C84" stroke="#fff" stroke-width="5"/><circle cx="42" cy="41" r="14" fill="#fff"/></svg>';
  const bpin = el(`<div class="bpin a"><div class="bp-halo"></div><div class="bp-ring"></div><div class="bp-ring"></div><div class="bp-ring"></div><div class="bp-shadow"></div><div class="bp-pin">${pinSvg}</div></div>`);
  ov.appendChild(bpin);
  const T = cfg.text;
  const title = el(`<div id="title" class="a"><div class="k">${TX.kicker}</div><div class="t">${TX.title.map((x) => `<div>${x}</div>`).join('')}</div><div class="s">${TX.sub}</div></div>`);
  const brand = el(`<div id="brand" class="a"><b>${D.brand.name}</b><span>${D.brand.en}</span></div>`);
  const remain = el(`<div id="remain" class="a"><span>${TX.remain}</span><b>0.0 km</b></div>`);
  const cap = el(`<div id="cap" class="a"><div class="ic"></div><div class="tx"></div></div>`);
  const card = el(`<div id="card" class="a"><div class="k">${D.brand.en} HEADQUARTERS · ${TX.arrive}</div><div class="n">${OFF.name}</div><div class="b">${OFF.building}</div><div class="ad">${OFF.address}</div></div>`);
  const info = el(`<div id="info" class="a">${T.locInfo.map((x) => `<div class="row"><div class="ic">${ICON[x.icon]}</div><div><div class="lt">${x.t}</div><div class="ls">${x.s}</div></div></div>`).join('')}</div>`);
  const attr = el(`<div id="attr" class="a">Imagery © Esri, Maxar, Earthstar Geographics<br>Terrain: Mapzen Terrain Tiles (SRTM · NASA · USGS)</div>`);
  [title, brand, remain, cap, card, info, attr].forEach((e) => ui.appendChild(e));
  $('#veil').style.opacity = '1';

  function overlays(t) {
    const cam = camera(t);
    // opening title
    const to = 1 - E.inCubic(seg(t, 2.1, 2.9));
    $('#veil').style.opacity = to.toFixed(3);
    title.style.display = to > 0.002 ? '' : 'none';
    rv($('.k', title), t, 0.15, 2.9, { dy: 20 });
    $$('.t > div', title).forEach((e, i) => rv(e, t, 0.3 + i * 0.18, 2.9, { dy: 40, din: 0.8 }));
    rv($('.s', title), t, 0.75, 2.9, { dy: 20 });
    tf(brand, 0, 0, 1, env(t, 2.4, 99, 0.6, 1));
    // distance to the office
    const ro = env(t, 2.6, F1 - 0.1, 0.5, 0.5);
    remain.style.display = ro > 0.002 ? '' : 'none';
    tf(remain, 0, 0, 1, ro);
    // counts down to 0.0 exactly as the camera arrives (it stops a short way from the office)
    remain.querySelector('b').textContent = `${((L_HQ * (1 - distAt(t) / L_ROUTE)) / 1000).toFixed(1)} km`;
    // captions
    const c = J.captions.find((x) => t >= x.t[0] && t < x.t[1]);
    cap.style.display = c ? '' : 'none';
    if (c) {
      cap.querySelector('.ic').innerHTML = ICON[c.icon];
      cap.querySelector('.tx').textContent = c.text;
      const pi = E.outBack(seg(t, c.t[0], c.t[0] + 0.55)), po = E.inCubic(seg(t, c.t[1] - 0.4, c.t[1]));
      tf(cap, 0, 30 * (1 - pi) - 20 * po, lerp(0.85, 1, clamp(pi)), clamp(seg(t, c.t[0], c.t[0] + 0.3)) * (1 - po));
    }
    // place labels, only while they are in front of the camera
    const hx = cam.g.x - cam.c.x, hy = cam.g.y - cam.c.y;
    for (const { m, e, p } of lms) {
      let o = env(t, m.show[0], m.show[1], 0.5, 0.5);
      if (o > 0.002 && (p[0] - cam.c.x) * hx + (p[1] - cam.c.y) * hy <= 0) o = 0;
      e.style.display = o > 0.002 ? '' : 'none';
      if (o > 0.002) {
        const s = map.project([m.lon, m.lat]);
        o *= smooth(90, 200, s.x) * smooth(90, 200, W - s.x) * smooth(540, 620, s.y); // fade near the edges and under the captions
        e.style.display = o > 0.002 ? '' : 'none';
        tf(e, s.x, s.y, lerp(0.85, 1, o), o);
      }
    }
    // arrival: pin, card, info, petals
    const t0 = F1 - 0.6;
    const po = env(t, t0, 99, 0.3, 1);
    bpin.style.display = po > 0.002 ? '' : 'none';
    const s = map.project([OFF.lon, OFF.lat]);
    if (po > 0.002) {
      tf(bpin, s.x, s.y, 1, po);
      const dp = seg(t, t0, t0 + 0.6);
      tf($('.bp-pin', bpin), 0, (1 - E.outBack(dp)) * -190, 1, clamp(dp * 3));
      tf($('.bp-shadow', bpin), 0, 0, lerp(0.4, 1, E.outCubic(dp)), 1);
      tf($('.bp-halo', bpin), 0, 0, lerp(0.3, 1, E.outCubic(seg(t, t0, t0 + 1.2))) * (1 + 0.06 * Math.sin(t * 2.2)), clamp(seg(t, t0, t0 + 0.8)));
      $$('.bp-ring', bpin).forEach((rg, i) => { const ph = (((t - t0) / 1.8 + i / 3) % 1 + 1) % 1; tf(rg, 0, 0, 0.4 + ph * 2.6, t > t0 + 0.3 ? (1 - ph) * 0.85 : 0); });
    }
    const ca = F1 - 0.1;
    card.style.display = t >= ca ? '' : 'none';
    info.style.display = t >= ca + 0.6 ? '' : 'none';
    if (HZ) { card.style.top = `${s.y - 330}px`; info.style.top = `${H - 100 - 388}px`; }
    else { card.style.top = `${s.y - 430}px`; info.style.top = `${s.y + 130}px`; }
    rv(card, t, ca, null, { dy: 40, din: 0.7 });
    rv(info, t, ca + 0.6, null, { dy: 60, din: 0.8 });
    $$('.row', info).forEach((e, i) => rv(e, t, ca + 0.9 + i * 0.18, null, { dy: 18 }));
    const dv = env(t, t0 + 0.2, 99, 1.0, 1);
    deco.style.display = dv > 0.002 ? '' : 'none';
    if (dv > 0.002) {
      deco.style.opacity = dv.toFixed(3);
      $$('.bokeh', deco).forEach((e, i) => { const q = bok[i]; tf(e, q.x - q.s / 2 + Math.sin(t * 0.3 + q.f) * 50, q.y - q.s / 2 + Math.cos(t * 0.25 + q.f) * 40, 1, 0.6 + 0.4 * Math.sin(t * 0.8 + q.f)); });
      $$('.petal', deco).forEach((e, i) => { const p = pet[i]; tf(e, p.x + Math.sin(t * 0.9 + p.f) * 70, ((p.y + t * p.v) % (H + 40)) - 20, p.s, 0.9, p.rot + t * 45); });
    }
    tf(attr, 0, 0, 1, 0.9);
    $('#black').style.opacity = Math.max(1 - seg(t, 0, 0.4), seg(t, DUR - 0.8, DUR)).toFixed(3);
  }

  let lastD = -1;
  async function renderAt(t) {
    const { c, g } = camera(t);
    const [clon, clat] = toLL(c.x, c.y), [glon, glat] = toLL(g.x, g.y);
    map.jumpTo(map.calculateCameraOptionsFromTo(new maplibregl.LngLat(clon, clat), c.alt, new maplibregl.LngLat(glon, glat), g.alt));
    // the guide line shows the road still ahead
    const d = Math.min(distAt(t), L_ROUTE);
    if (Math.abs(d - lastD) > 1) { map.getSource('ahead').setData(line(d, L_HQ)); lastD = d; }
    const lo = 1 - smooth(F1 - 0.4, F1 + 1.2, t);
    for (const [id, o] of [['glow', 0.55], ['path', 0.95], ['dash', 0.95]]) map.setPaintProperty(id, 'line-opacity', o * lo);
    await idle();
    overlays(t); // after the tiles are in, so labels sit on the loaded terrain
  }

  await renderAt(0);
  window.renderAt = renderAt;
  window.VIDEO = { fps: J.fps, duration: DUR, route: L_ROUTE };
  window.ready = true;
})();
