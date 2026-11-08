'use strict';
// Suminmom promo video. Every frame is a pure function of time:
// renderAt(t) sets the whole stage for second t, so the recorder can step frame by frame.
(async function () {
  // ?fmt=v renders the vertical 1080x1920 (9:16) mobile cut; the default is 1920x1080
  const V = new URLSearchParams(location.search).get('fmt') === 'v';
  const W = V ? 1080 : 1920, H = V ? 1920 : 1080;
  document.documentElement.style.setProperty('--W', `${W}px`);
  document.documentElement.style.setProperty('--H', `${H}px`);
  document.getElementById('stage').classList.add(V ? 'fmt-v' : 'fmt-h');
  for (const c of document.querySelectorAll('canvas')) { c.width = W; c.height = H; }
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
    outQuint: (t) => 1 - (1 - t) ** 5,
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  };
  // fade-in at a (over fi seconds), fade-out ending at b (over fo seconds)
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
  // Slide/fade an element in at a and out at b. Returns its visibility 0..1.
  function rv(e, t, a, b, o = {}) {
    const { dx = 0, dy = 36, ds = 0, din = 0.7, dout = 0.45, ox = 0, oy = -24, os = 0, r = 0, ease = E.outCubic } = o;
    const pi = ease(seg(t, a, a + din));
    const po = b == null ? 0 : E.inCubic(seg(t, b - dout, b));
    tf(e, dx * (1 - pi) + ox * po, dy * (1 - pi) + oy * po, 1 + ds * (1 - pi) + os * po, clamp(pi) * (1 - po), r);
    return clamp(pi) * (1 - po);
  }
  // slow Ken Burns zoom on the <img> inside a photo frame
  const kb = (frame, t, a, b, s0 = 1.0, s1 = 1.08, dx = 0, dy = 0) => {
    const u = seg(t, a, b), img = frame.querySelector('img');
    img.style.transform = `translate(${(dx * u).toFixed(2)}px,${(dy * u).toFixed(2)}px) scale(${lerp(s0, s1, u).toFixed(4)})`;
  };

  const cfg = await (await fetch('config.json', { cache: 'no-store' })).json();
  const S = cfg.scenes, MP = cfg.map, CUE = cfg.cues, D = cfg.data;
  // the vertical cut breaks some long lines differently (config "vertical.text")
  const TX = V ? { ...cfg.text, ...((cfg.vertical || {}).text || {}) } : cfg.text;
  await Promise.all([400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Pretendard`, '가나다라 ABC 123')));
  await Promise.all([document.fonts.load('700 40px Batang', '수민맘'), document.fonts.load('400 40px Batang', '수민맘'), document.fonts.load('italic 500 40px Corm', 'Premium')]);

  const photo = (src, w, h, cls = '', style = '') => `<div class="ph ${cls}" style="width:${w}px;height:${h}px;${style}"><img src="assets/photos/${src}"></div>`;

  // ---------- icons ----------
  const svgo = (inner, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICON = {
    cal: svgo('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>'),
    group: svgo('<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5"/><path d="M15.5 14.6c2.6-.3 4.8 1.4 5.5 4.4"/>'),
    pen: svgo('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
    gift: svgo('<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 13h18M12 9v12"/><path d="M12 9c-1.5-3.5-6-4.5-6-1.5S10 9 12 9zM12 9c1.5-3.5 6-4.5 6-1.5S14 9 12 9z"/>'),
    needle: svgo('<path d="M4 20L18 6"/><ellipse cx="19.2" cy="4.8" rx="1.6" ry="1" transform="rotate(-45 19.2 4.8)"/><path d="M4 20c3-1 6-1 9 1s5 1 7-1" stroke-dasharray="2 2.4"/>'),
    truck: svgo('<rect x="2" y="6" width="12" height="10" rx="1.5"/><path d="M14 9h4l3 3.5V16h-7z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>'),
    phone: svgo('<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>'),
    check: svgo('<circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.3l3 3 6-6.3"/>', 1.8),
    globe: svgo('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'),
    insta: svgo('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor"/>'),
  };
  const LEAF = `<svg viewBox="0 0 300 420" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
    <path d="M150 410 C150 300 152 180 160 20"/>${[0, 1, 2, 3, 4, 5].map((i) => { const y = 360 - i * 58, s = i % 2 ? -1 : 1; return `<path d="M152 ${y} C${152 + s * 40} ${y - 30} ${152 + s * 110} ${y - 30} ${152 + s * 130} ${y - 70} C${152 + s * 80} ${y - 70} ${152 + s * 30} ${y - 40} 152 ${y}Z" fill="currentColor" fill-opacity=".35"/>`; }).join('')}</svg>`;
  const FLOWER = `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="2.4">${Array.from({ length: 22 }, (_, i) => `<ellipse cx="100" cy="58" rx="12" ry="44" transform="rotate(${(i * 360) / 22} 100 100)"/>`).join('')}${Array.from({ length: 14 }, (_, i) => `<ellipse cx="100" cy="74" rx="8" ry="26" transform="rotate(${(i * 360) / 14 + 8} 100 100)"/>`).join('')}<circle cx="100" cy="100" r="12"/></svg>`;

  const scenesRoot = $('#scenes');
  const scenes = [];
  function addScene(range, html, update, display = 'block') {
    const root = el(html);
    scenesRoot.appendChild(root);
    scenes.push({ a: range[0], b: range[1], root, update, display });
    return root;
  }

  // ---------- map ----------
  const proj = (lat, lon) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return { x: ((lon + 180) / 360) * 256, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 };
  };
  const OFF = D.office;
  const P_OFF = proj(OFF.lat, OFF.lon);
  const P_KR = V ? proj(37.72, 127.3) : proj(36.75, 125.3);
  const Z_OV0 = V ? 7.55 : 6.85, Z_OV1 = V ? 7.85 : 7.2, Z_LAND = 17.35, Z_HOLD = 17.6;
  // vertical: keep the office pin in the upper part of the frame, leaving room for the info panel
  const OFFY = V ? 110 : 0;
  const tgt = (z) => ({ x: P_OFF.x, y: P_OFF.y + OFFY / 2 ** z, z });
  function fly(from, to, u) {
    const z = lerp(from.z, to.z, E.inOutCubic(u));
    const s0 = 2 ** from.z, s = 2 ** z;
    const k = 1 - E.inOutCubic(clamp(u * 1.18));
    return { x: to.x - ((to.x - from.x) * s0 * k) / s, y: to.y - ((to.y - from.y) * s0 * k) / s, z };
  }
  function cam(t) {
    const f = MP.fly;
    if (t < f[0]) return { ...P_KR, z: lerp(Z_OV0, Z_OV1, seg(t, MP.on[0], f[0])) };
    if (t < f[1]) return fly({ ...P_KR, z: Z_OV1 }, tgt(Z_LAND), seg(t, f[0], f[1]));
    return tgt(lerp(Z_LAND, Z_HOLD, E.outCubic(seg(t, f[1], f[1] + 6))));
  }
  const mapOn = (t) => t >= MP.on[0] && t < MP.on[1];
  const mapAlpha = (t) => seg(t, MP.on[0], MP.on[0] + 0.9) * (1 - seg(t, MP.on[1] - 0.8, MP.on[1]));
  // g: soft light bloom around the office once we have landed
  function mapLook(t) {
    return { g: E.inOutCubic(seg(t, MP.fly[1] - 0.6, MP.fly[1] + 1.2)) };
  }
  const toScreen = (p, c) => ({ x: (p.x - c.x) * 2 ** c.z + W / 2, y: (p.y - c.y) * 2 ** c.z + H / 2 });

  const MAP = (() => {
    const cv = $('#map'), ctx = cv.getContext('2d');
    const cache = new Map();
    function levelTiles(c, L, out) {
      const n = 2 ** L, sc = 2 ** (c.z - L);
      const cx = c.x * n, cy = c.y * n, hw = W / 2 / sc, hh = H / 2 / sc;
      const x0 = Math.floor((cx - hw) / 256), x1 = Math.floor((cx + hw) / 256);
      const y0 = Math.max(0, Math.floor((cy - hh) / 256)), y1 = Math.min(n - 1, Math.floor((cy + hh) / 256));
      for (let ty = y0; ty <= y1; ty++)
        for (let tx = x0; tx <= x1; tx++)
          out.push({ key: `${L}/${ty}/${(tx % n + n) % n}`, sx: (tx * 256 - cx) * sc + W / 2, sy: (ty * 256 - cy) * sc + H / 2, sz: 256 * sc });
    }
    function tiles(c) {
      const L = clamp(Math.floor(c.z + 0.5), 4, 18), out = [];
      levelTiles(c, L - 1, out);
      levelTiles(c, L, out);
      return out;
    }
    function get(k) {
      let e = cache.get(k);
      if (e) { cache.delete(k); cache.set(k, e); return e; }
      e = { img: new Image(), ok: false };
      e.p = new Promise((res) => { e.img.onload = () => { e.ok = true; res(); }; e.img.onerror = () => res(); });
      e.img.src = `assets/tiles/${MP.release}/${k}.jpg`;
      cache.set(k, e);
      if (cache.size > 1600) cache.delete(cache.keys().next().value);
      return e;
    }
    const ensure = (c) => Promise.all(tiles(c).map((tl) => get(tl.key).p));
    let last = '';
    function draw(c, look) {
      const key = `${c.x.toFixed(7)},${c.y.toFixed(7)},${c.z.toFixed(4)},${look.g.toFixed(3)}`;
      if (key === last) return;
      last = key;
      ctx.fillStyle = '#0b1a2c';
      ctx.fillRect(0, 0, W, H);
      for (const tl of tiles(c)) {
        const e = cache.get(tl.key);
        if (!e || !e.ok) continue;
        const x0 = Math.floor(tl.sx), y0 = Math.floor(tl.sy);
        ctx.drawImage(e.img, x0, y0, Math.ceil(tl.sx + tl.sz) - x0, Math.ceil(tl.sy + tl.sz) - y0);
      }
      // bright, warm grade so the satellite view sits with the cream palette
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = 'rgba(255,226,206,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,238,226,0.16)';
      ctx.fillRect(0, 0, W, H);
      if (look.g > 0.002) {
        const gr = ctx.createRadialGradient(W / 2, H / 2 - OFFY, 160, W / 2, H / 2 - OFFY, 1000);
        gr.addColorStop(0, `rgba(255,236,226,${(0.14 * look.g).toFixed(3)})`);
        gr.addColorStop(0.5, `rgba(255,232,220,${(0.07 * look.g).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(255,232,220,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    return { tiles, ensure, draw, el: cv };
  })();

  // clouds the camera falls through
  const CLOUD_SPR = [0, 1, 2, 3].map((k) => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 400;
    const g = c.getContext('2d'), r = rng(100 + k);
    for (let i = 0; i < 46; i++) {
      const x = 320 + (r() - 0.5) * 440, sp = 1 - Math.abs(x - 320) / 300;
      const y = 200 + (r() - 0.5) * 170 * sp, rad = 40 + r() * 110 * (0.5 + sp * 0.5);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.24)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    return c;
  });
  const CLOUDS = (() => { const r = rng(11), a = []; for (let i = 0; i < 18; i++) a.push({ dx: (r() - 0.5) * 2300, dy: (r() - 0.5) * 1400, zi: 9.8 + r() * 2.8, spr: Math.floor(r() * 4), w: 760 + r() * 640 }); return a; })();

  const fxc = $('#fx').getContext('2d');
  function drawFx(t, c) {
    fxc.clearRect(0, 0, W, H);
    const vis = mapAlpha(t);
    if (vis <= 0.001) return;
    fxc.save();
    const gate = smooth(9.3, 10.0, c.z);
    if (gate > 0) {
      for (const cl of CLOUDS) {
        const k = 2 ** (c.z - cl.zi);
        const a = smooth(0.25, 0.75, k) * (1 - smooth(1.5, 3.4, k)) * gate;
        if (a <= 0.003) continue;
        const w = cl.w * k, h = w * 0.625;
        fxc.globalAlpha = vis * a * 0.78;
        fxc.drawImage(CLOUD_SPR[cl.spr], W / 2 + cl.dx * k - w / 2, H / 2 + cl.dy * k - h / 2, w, h);
      }
      const haze = 0.13 * Math.exp(-(((c.z - 11.1) / 1.25) ** 2)) * gate;
      fxc.globalAlpha = vis;
      fxc.fillStyle = `rgba(255,244,235,${haze.toFixed(3)})`;
      fxc.fillRect(0, 0, W, H);
    }
    // targeting reticle during the flight
    const f = MP.fly;
    const ra = env(t, f[0] + 0.2, f[1] + 0.25, 0.5, 0.45);
    if (ra > 0) {
      const u = seg(t, f[0], f[1]);
      const R = lerp(250, 76, E.inOutCubic(u));
      // the reticle follows the office as it slides into place
      const { x: cx, y: cy } = toScreen(P_OFF, c);
      fxc.globalAlpha = vis * ra * 0.85;
      fxc.strokeStyle = '#ffffff'; fxc.lineWidth = 2.5;
      fxc.beginPath(); fxc.arc(cx, cy, R, 0, 7); fxc.stroke();
      fxc.lineWidth = 5;
      const rot = t * 0.9;
      for (let i = 0; i < 4; i++) {
        const a0 = rot + (i * Math.PI) / 2;
        fxc.beginPath(); fxc.arc(cx, cy, R + 16, a0 - 0.28, a0 + 0.28); fxc.stroke();
      }
      fxc.lineWidth = 2.5;
      for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        fxc.beginPath(); fxc.moveTo(cx + sx * (R - 18), cy + sy * (R - 18)); fxc.lineTo(cx + sx * (R + 34), cy + sy * (R + 34)); fxc.stroke();
      }
    }
    fxc.restore();
  }

  // ---------- pins, HUD ----------
  const pins = $('#pins');
  // petals and soft light drifting over the map after landing
  const DECO = (() => {
    const r = rng(29);
    const bok = Array.from({ length: 10 }, () => ({ x: r() * W, y: r() * H, s: 180 + r() * 340, c: ['255,222,210', '255,236,200', '255,246,236'][Math.floor(r() * 3)], a: 0.22 + r() * 0.25, f: r() * 6 }));
    const pet = Array.from({ length: 30 }, () => ({ x: r() * W, y: r() * H, v: 34 + r() * 46, s: 0.7 + r() * 1.0, f: r() * 6, rot: r() * 360, c: ['#F6CFC6', '#FBE3D6', '#FFF4E8', '#F3C2BA'][Math.floor(r() * 4)] }));
    const root = el(`<div class="mapdeco a" style="left:0;top:0;width:${W}px;height:${H}px">
      ${bok.map((b) => `<div class="bokeh" style="width:${b.s}px;height:${b.s}px;background:radial-gradient(closest-side,rgba(${b.c},${b.a}),rgba(${b.c},0))"></div>`).join('')}
      ${pet.map((p) => `<div class="petal" style="background:${p.c}"></div>`).join('')}</div>`);
    pins.appendChild(root);
    const be = $$('.bokeh', root), pe = $$('.petal', root);
    return (t, o) => {
      root.style.display = o > 0.002 ? '' : 'none';
      if (o <= 0.002) return;
      root.style.opacity = o.toFixed(3);
      be.forEach((e, i) => { const q = bok[i]; tf(e, q.x - q.s / 2 + Math.sin(t * 0.3 + q.f) * 50, q.y - q.s / 2 + Math.cos(t * 0.25 + q.f) * 40, 1, 0.6 + 0.4 * Math.sin(t * 0.8 + q.f)); });
      pe.forEach((e, i) => { const p = pet[i]; tf(e, p.x + Math.sin(t * 0.9 + p.f) * 70, ((p.y + t * p.v) % (H + 40)) - 20, p.s, 0.9, p.rot + t * 45); });
    };
  })();
  const cpins =D.context.map((o) => { const p = el(`<div class="cpin a"><div class="cp-dot"></div><div class="cp-label">${o.name}</div></div>`); pins.appendChild(p); return { p, pt: proj(o.lat, o.lon) }; });
  const spin = el(`<div class="spin a"><div class="sp-ring"></div><div class="sp-dot"></div><div class="sp-label">${D.brand.name}<small>경기도 부천</small></div></div>`);
  pins.appendChild(spin);
  const pinSvg = '<svg viewBox="0 0 84 114"><path d="M42 4C21 4 4 20.4 4 41 4 69 42 110 42 110s38-41 38-69C80 20.4 63 4 42 4z" fill="#D58C84" stroke="#fff" stroke-width="5"/><circle cx="42" cy="41" r="14" fill="#fff"/></svg>';
  const bpin = el(`<div class="bpin a"><div class="bp-halo"></div><div class="bp-ring"></div><div class="bp-ring"></div><div class="bp-ring"></div><div class="bp-shadow"></div><div class="bp-pin">${pinSvg}</div>
    <div class="bp-card"><div class="bp-k">${D.brand.en} HEADQUARTERS</div><div class="bp-name">${OFF.name}</div><div class="bp-bld">${OFF.building}</div><div class="bp-area">${OFF.address}</div></div></div>`);
  pins.appendChild(bpin);
  const hud = el(`<div id="hud" class="a"><div class="hud-k"><i></i><span>NAVIGATING TO</span></div><div class="hud-name">${OFF.name}</div><div class="hud-coord">N ${OFF.lat.toFixed(4)}°  ·  E ${OFF.lon.toFixed(4)}°</div><div class="hud-alt"><span>ALTITUDE</span><b></b></div></div>`);
  pins.appendChild(hud);

  function updatePins(t, c) {
    const vis = mapAlpha(t);
    DECO(t, vis * seg(t, MP.fly[1] - 0.3, MP.fly[1] + 1.0));
    // overview pin
    const so = env(t, MP.on[0] + 1.2, MP.fly[0] + 1.0, 0.6, 0.6) * vis;
    spin.style.display = so > 0.002 ? '' : 'none';
    if (so > 0.002) {
      const s = toScreen(P_OFF, c);
      tf(spin, s.x, s.y, 1, so);
      const ph = (t * 0.7) % 1;
      tf(spin.children[0], 0, 0, 1 + ph * 3.2, (1 - ph) * 0.9);
    }
    // city labels while passing through the middle altitudes
    const co = smooth(8.6, 9.4, c.z) * (1 - smooth(11.6, 12.4, c.z)) * vis;
    cpins.forEach(({ p, pt }) => {
      p.style.display = co > 0.002 ? '' : 'none';
      if (co > 0.002) { const s = toScreen(pt, c); tf(p, s.x, s.y, 1, co); }
    });
    // landing pin + card
    const t0 = MP.fly[1];
    const o = env(t, t0 - 0.1, MP.on[1], 0.3, 0.7) * vis;
    bpin.style.display = o > 0.002 ? '' : 'none';
    if (o > 0.002) {
      const s = toScreen(P_OFF, c);
      tf(bpin, s.x, s.y, 1, o);
      const dp = seg(t, t0 - 0.1, t0 + 0.55);
      tf($('.bp-pin', bpin), 0, (1 - E.outBack(dp)) * -170, 1, clamp(dp * 3));
      tf($('.bp-shadow', bpin), 0, 0, lerp(0.4, 1, E.outCubic(dp)), 1);
      tf($('.bp-halo', bpin), 0, 0, lerp(0.3, 1, E.outCubic(seg(t, t0, t0 + 1.2))) * (1 + 0.06 * Math.sin(t * 2.2)), clamp(seg(t, t0, t0 + 0.8)));
      $$('.bp-ring', bpin).forEach((rg, i) => {
        const ph = (((t - t0) / 1.8 + i / 3) % 1 + 1) % 1;
        tf(rg, 0, 0, 0.4 + ph * 2.6, t > t0 + 0.3 ? (1 - ph) * 0.85 : 0);
      });
      const card = $('.bp-card', bpin);
      rv(card, t, t0 + 0.45, null, { dx: -40, dy: 0, din: 0.7 });
      // lift the card above the info bar once it appears
      const up = V ? 0 : E.inOutCubic(seg(t, S.locInfo[0], S.locInfo[0] + 0.8));
      card.style.transform += ` translateY(${(-60 * up).toFixed(1)}px)`;
    }
    // HUD
    const ho = env(t, MP.fly[0] + 0.1, MP.fly[1] + 0.5, 0.5, 0.5) * vis;
    hud.style.display = ho > 0.002 ? '' : 'none';
    if (ho > 0.002) {
      tf(hud, 0, 0, 1, ho);
      const alt = ((156543.03 * Math.cos((OFF.lat * Math.PI) / 180)) / 2 ** c.z) * H * 0.866;
      hud.querySelector('b').textContent = alt >= 10000 ? `${Math.round(alt / 1000).toLocaleString()} km` : alt >= 1000 ? `${(alt / 1000).toFixed(1)} km` : `${Math.round(alt)} m`;
      $$('i', hud)[0].style.opacity = (Math.sin(t * 8) > 0 ? 1 : 0.25).toString();
    }
  }

  // ---------- 1. intro ----------
  {
    const r = rng(5);
    const bok = Array.from({ length: 14 }, () => ({ x: r() * W, y: r() * H, s: 120 + r() * 320, c: ['255,214,200', '240,214,170', '255,236,214'][Math.floor(r() * 3)], a: 0.25 + r() * 0.35, f: r() * 6 }));
    const pet = Array.from({ length: 26 }, () => ({ x: r() * W, y: r() * H, v: 30 + r() * 50, s: 0.6 + r() * 0.9, f: r() * 6, rot: r() * 360, c: r() < 0.5 ? '#F3D7CF' : '#F0E0C4' }));
    const root = addScene(S.intro, `<div class="scene" id="intro"><div class="a bg"></div>
      ${bok.map((b) => `<div class="bokeh" style="width:${b.s}px;height:${b.s}px;background:radial-gradient(closest-side,rgba(${b.c},${b.a}),rgba(${b.c},0))"></div>`).join('')}
      ${pet.map((p) => `<div class="petal" style="background:${p.c}"></div>`).join('')}
      <div class="a top"><div class="ien en">${TX.introEn}</div><div class="wm">${D.brand.name}</div><div class="line"></div><div class="isub">${TX.introSub}</div></div>
      <div class="a head">${TX.introHead.map((h) => `<div class="ln"><span>${h}</span></div>`).join('')}</div>
      <div class="a foot en">${TX.introFoot}</div></div>`, (t) => {
      const [a, b] = S.intro;
      $$('.bokeh', root).forEach((e, i) => { const q = bok[i]; tf(e, q.x - q.s / 2 + Math.sin(t * 0.3 + q.f) * 40, q.y - q.s / 2 + Math.cos(t * 0.25 + q.f) * 30, 1, 0.6 + 0.4 * Math.sin(t * 0.8 + q.f)); });
      $$('.petal', root).forEach((e, i) => { const p = pet[i]; tf(e, p.x + Math.sin(t * 0.9 + p.f) * 60, ((p.y + t * p.v) % (H + 40)) - 20, p.s, 0.85, p.rot + t * 40); });
      rv($('.ien', root), t, 0.3, null, { dy: 16, din: 1.0 });
      const wm = $('.wm', root);
      wm.style.letterSpacing = `${lerp(0.45, 0.12, E.outQuint(seg(t, 0.5, 2.6)))}em`;
      wm.style.textIndent = wm.style.letterSpacing;
      wm.style.opacity = E.outCubic(seg(t, 0.5, 1.9)).toFixed(3);
      $('.line', root).style.transform = `scaleX(${E.outCubic(seg(t, 1.4, 2.6)).toFixed(3)})`;
      rv($('.isub', root), t, 1.9, null, { dy: 18 });
      $('.top', root).style.transform = `translateY(${(-160 * E.inOutCubic(seg(t, 3.0, 4.0))).toFixed(1)}px) scale(${lerp(1, 0.82, E.inOutCubic(seg(t, 3.0, 4.0))).toFixed(4)})`;
      $$('.ln span', root).forEach((s, i) => { const p = E.outCubic(seg(t, 3.6 + i * 0.45, 4.6 + i * 0.45)); s.style.transform = `translateY(${((1 - p) * 150).toFixed(1)}px)`; });
      rv($('.foot', root), t, 5.0, null, { dy: 16 });
      root.style.opacity = (1 - E.inCubic(seg(t, b - 0.8, b))).toFixed(3);
      root.style.transform = `scale(${(1 + 0.06 * E.inCubic(seg(t, b - 1.2, b))).toFixed(4)})`;
    });
  }

  // ---------- 2. occasions ----------
  {
    // horizontal: one row of six; vertical: a 3 x 2 grid
    const n = D.occasions.length, w = V ? 290 : 270, gap = V ? 40 : 26, per = V ? 3 : n;
    const x0 = (W - (per * w + (per - 1) * gap)) / 2;
    const pos = (i) => `left:${x0 + (i % per) * (w + gap)}px;top:${V ? 520 + Math.floor(i / per) * 450 : 330}px`;
    const root = addScene(S.occasions, `<div class="scene" id="occasions"><div class="a bg"></div>
      <div class="a hd"><div class="kick">${TX.occKicker}</div><div class="t">${TX.occTitle}</div></div>
      ${D.occasions.map((o, i) => `<div class="occ" style="${pos(i)}">${photo(o.photo, w, w)}<div class="ol">${o.label}</div><div class="oe en">${o.en}</div></div>`).join('')}
      <div class="a cap">${TX.occCap}</div><div class="a cap2">${TX.occCap2}</div></div>`, (t) => {
      const [a, b] = S.occasions;
      root.style.opacity = env(t, a, b, 0.6, 0.5).toFixed(3);
      rv($('.hd', root), t, a + 0.05, b, { dy: 30 });
      $$('.occ', root).forEach((e, i) => {
        const s = a + 0.55 + i * 0.18;
        rv(e, t, s, b, { dy: 120, ds: 0.08, din: 0.9 });
        e.style.transform += ` translateY(${(Math.sin(t * 1.3 + i * 1.1) * 5).toFixed(1)}px)`;
        kb($('.ph', e), t, a, b, 1.04, 1.16);
      });
      rv($('.cap', root), t, a + 2.9, b, { dy: 24 });
      rv($('.cap2', root), t, a + 3.3, b, { dy: 20 });
    });
  }

  // ---------- 3. first birthday ----------
  {
    const N = D.dolPhotos.length, pw = V ? 268 : 280, gap = 24, span = N * (pw + gap);
    // satin-stitch embroidery: diagonal thread pattern clipped by a moving reveal
    const [s1, s2] = TX.stitch;
    const sw = `<svg width="800" height="540" viewBox="0 0 800 540">
      <defs>
        <pattern id="satin" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><rect width="7" height="7" fill="#C97C74"/><rect width="3.2" height="7" fill="#E3A39A"/></pattern>
        <pattern id="satin2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><rect width="6" height="6" fill="#6F8FA9"/><rect width="2.6" height="6" fill="#9DB8CD"/></pattern>
        <pattern id="satin3" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="6" height="6" fill="#6F9470"/><rect width="2.6" height="6" fill="#A4C2A0"/></pattern>
        <clipPath id="rv1"><rect class="r1" x="0" y="0" width="0" height="540"/></clipPath>
        <clipPath id="rv2"><rect class="r2" x="0" y="0" width="0" height="540"/></clipPath>
        <filter id="emb" x="-5%" y="-5%" width="110%" height="120%"><feDropShadow dx="0" dy="2.5" stdDeviation="1.6" flood-color="#5a3a2a" flood-opacity=".35"/></filter>
      </defs>
      <g filter="url(#emb)">
        <g clip-path="url(#rv1)">
          <g transform="translate(400 96)">
            <path d="M0 70 C-6 40 -4 10 0 -10" stroke="url(#satin3)" stroke-width="7" fill="none" stroke-linecap="round"/>
            <path d="M0 40 C-30 30 -46 10 -50 -6 C-24 -4 -6 16 0 40Z" fill="url(#satin3)"/>
            <path d="M0 26 C26 18 42 0 46 -14 C22 -12 4 8 0 26Z" fill="url(#satin3)"/>
            ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="0" cy="-34" rx="13" ry="22" fill="url(#satin)" transform="rotate(${i * 72} 0 -12)"/>`).join('')}
            <circle cx="0" cy="-12" r="9" fill="#F2D27E"/>
          </g>
          <text x="400" y="286" text-anchor="middle" font-family="Batang" font-weight="700" font-size="104" fill="url(#satin)" stroke="#B9665E" stroke-width="1.4">${s1}</text>
        </g>
        <text clip-path="url(#rv2)" x="400" y="388" text-anchor="middle" font-family="Pretendard" font-weight="700" font-size="58" letter-spacing="4" fill="url(#satin2)" stroke="#5E7E98" stroke-width="1">${s2}</text>
      </g></svg>`;
    const needle = `<svg class="needle" viewBox="0 0 70 70"><path d="M8 62 L58 12" stroke="#9aa3ad" stroke-width="4" stroke-linecap="round"/><path d="M8 62 L58 12" stroke="#e8edf2" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="54" cy="16" rx="4" ry="1.6" fill="none" stroke="#7d8790" stroke-width="1.4" transform="rotate(-45 54 16)"/><path d="M54 16 C70 30 40 40 60 60" stroke="#D58C84" stroke-width="2" fill="none"/></svg>`;
    const root = addScene(S.dol, `<div class="scene" id="dol"><div class="a bg"></div>
      <div class="a txt"><div class="kick">${TX.dolKicker}</div><div class="t">${TX.dolTitle}</div>
        <div class="d">${TX.dolDesc.map((x) => `<div>${x}</div>`).join('')}</div>
        <div class="chips">${TX.dolChips.map((c) => `<span class="chip"><i></i>${c}</span>`).join('')}</div>
        <div class="note">${TX.dolNote}</div></div>
      <div class="a swatch"><div class="band" style="top:22px"></div><div class="band" style="top:48px;height:6px"></div><div class="dobby"></div>${sw}${needle}</div>
      <div class="a marq"><div class="a mtrack" style="left:0;top:0;width:${span * 2}px;height:320px">${[...D.dolPhotos, ...D.dolPhotos].map((p, i) => photo(p, pw, pw, '', `left:${i * (pw + gap)}px`)).join('')}</div></div></div>`, (t) => {
      const [a, b] = S.dol;
      root.style.opacity = env(t, a, b, 0.6, 0.5).toFixed(3);
      const txt = $('.txt', root);
      rv($('.kick', txt), t, a + 0.1, b, { dx: -40, dy: 0 });
      rv($('.t', txt), t, a + 0.2, b, { dx: -60, dy: 0, din: 0.9 });
      rv($('.d', txt), t, a + 0.6, b, { dx: -40, dy: 0 });
      $$('.chip', txt).forEach((e, i) => rv(e, t, a + 1.3 + i * 0.15, b, { dy: 20 }));
      rv($('.note', txt), t, a + 1.9, b, { dy: 14 });
      const swt = $('.swatch', root);
      rv(swt, t, a + 0.25, b, V ? { dy: 80, ds: 0.04, din: 1.0 } : { dx: 80, dy: 0, ds: 0.04, din: 1.0 });
      swt.style.transform += `${V ? ' scale(1.14)' : ''} rotate(${(-1.2 + 0.6 * Math.sin(t * 0.6)).toFixed(2)}deg)`;
      const [st1, st2] = CUE.stitch;
      const p1 = E.inOutSine(seg(t, st1[0], st1[1])), p2 = E.inOutSine(seg(t, st2[0], st2[1]));
      // line 1 covers the motif (x 340-460) and the name (x ~130-670)
      const x1 = lerp(120, 690, p1), x2 = lerp(160, 650, p2);
      $('.r1', swt).setAttribute('width', x1.toFixed(1));
      $('.r2', swt).setAttribute('width', x2.toFixed(1));
      const nd = $('.needle', swt);
      const active = t >= st1[0] - 0.2 && t <= st2[1] + 0.3;
      const onL2 = t >= st2[0] - 0.05;
      const nx = onL2 ? x2 : x1, ny = onL2 ? 330 : (p1 < 0.1 ? 120 : 210);
      const bob = Math.sin(t * 40) * 6;
      tf(nd, nx - 10, ny - 50 + bob, 1, active ? 1 : 0);
      const mq = $('.marq', root);
      rv(mq, t, a + 1.6, b, { dy: 80, din: 1.0 });
      $('.mtrack', mq).style.transform = `translateX(${(-((t - a) * 95) % span).toFixed(1)}px)`;
    });
  }

  // ---------- 4. towel quality + bamboo ----------
  {
    // [size, left, top] of the big and small photo
    const [b1, b2] = V ? [[560, 90, 190], [300, 660, 480]] : [[640, 120, 150], [330, 520, 640]];
    const at = (p) => `left:${p[1]}px;top:${p[2]}px`;
    const root = addScene(S.quality, `<div class="scene" id="quality"><div class="a bg"></div><div class="a bg2"></div><div class="a leaf">${LEAF}</div>
      ${photo('t/1000001254.jpg', b1[0], b1[0], 'p1a', at(b1))}${photo('t/1000000069.jpg', b1[0], b1[0], 'p1b', at(b1))}
      ${photo('t/1000000219.jpg', b2[0], b2[0], 'p2a', at(b2))}${photo('t/1000001077.jpg', b2[0], b2[0], 'p2b', at(b2))}
      <div class="a qpanel q1"><div class="kick">${TX.qKicker}</div><div class="t">${TX.qTitle}</div><div class="s">${TX.qSub}</div>
        ${D.towels.map((r) => `<div class="trow"><div class="sp">${r.spec}</div><div class="gw">${r.g}</div><span class="tg${r.tag ? '' : ' no'}">${r.tag}</span><div class="nt">${r.badge ? `<b class="bd">${r.badge}</b>` : ''}${r.note}</div></div>`).join('')}</div>
      <div class="a qpanel q2"><div class="kick" style="color:var(--sage)">${TX.bKicker}</div><div class="t">${TX.bTitle}</div><div class="s">${TX.bSub}</div>
        <div class="bgrid">${D.bamboo.map((x) => `<div class="bcell">${x.w ? `<div class="n w">${x.w}</div>` : `<div class="n"><span>0</span><em>${x.u}</em></div>`}<div class="l">${x.l}</div></div>`).join('')}</div></div></div>`, (t) => {
      const [a, b] = S.quality, sw = CUE.bambooSwap;
      root.style.opacity = env(t, a, b, 0.6, 0.5).toFixed(3);
      const k2 = E.inOutCubic(seg(t, sw - 0.3, sw + 0.5));
      $('.bg2', root).style.opacity = k2.toFixed(3);
      tf($('.leaf', root), 0, -30 * seg(t, a, b), 1, k2 * 0.16, 4 * Math.sin(t * 0.5));
      const p1a = $('.p1a', root), p1b = $('.p1b', root), p2a = $('.p2a', root), p2b = $('.p2b', root);
      rv(p1a, t, a + 0.2, null, { dx: -80, dy: 0, din: 1.0 });
      p1b.style.opacity = k2.toFixed(3); p1b.style.transform = p1a.style.transform;
      kb(p1a, t, a, sw + 0.5, 1.02, 1.12); kb(p1b, t, sw - 0.3, b, 1.12, 1.02);
      rv(p2a, t, a + 0.6, null, { dy: 80, din: 0.9, r: 3 });
      p2b.style.opacity = k2.toFixed(3); p2b.style.transform = p2a.style.transform;
      p1a.style.opacity = (1 - E.inCubic(seg(t, b - 0.5, b))).toFixed(3);
      const q1 = $('.q1', root), q2 = $('.q2', root);
      q1.style.display = t < sw + 0.1 ? '' : 'none';
      q2.style.display = t >= sw - 0.2 ? '' : 'none';
      if (t < sw + 0.1) {
        rv($('.kick', q1), t, a + 0.4, sw, { dx: 40, dy: 0, ox: -40, oy: 0 });
        rv($('.t', q1), t, a + 0.55, sw, { dx: 60, dy: 0, ox: -40, oy: 0, din: 0.9 });
        rv($('.s', q1), t, a + 0.8, sw, { dx: 40, dy: 0, ox: -40, oy: 0 });
        $$('.trow', q1).forEach((e, i) => rv(e, t, a + 1.3 + i * 0.22, sw, { dx: 70, dy: 0, ox: -50, oy: 0, dout: 0.35 }));
      }
      if (t >= sw - 0.2) {
        rv($('.kick', q2), t, sw + 0.1, b, { dx: 40, dy: 0 });
        rv($('.t', q2), t, sw + 0.25, b, { dx: 60, dy: 0, din: 0.9 });
        rv($('.s', q2), t, sw + 0.5, b, { dx: 40, dy: 0 });
        $$('.bcell', q2).forEach((e, i) => {
          const s = sw + 0.9 + i * 0.2;
          rv(e, t, s, b, { dy: 40, ds: 0.06 });
          const x = D.bamboo[i], sp = e.querySelector('span');
          if (sp) sp.textContent = (x.n * E.outCubic(seg(t, s, s + 1.3))).toFixed(x.dec);
        });
      }
    });
  }

  // ---------- 5. gift set title ----------
  {
    const ph5 = ['1000001329.jpg', '1000001165.jpg', '1000000862.jpg', '1000001275.jpg', '1000000475.jpg'];
    const root = addScene(S.giftTitle, `<div class="scene" id="giftTitle"><div class="a bg"></div>
      <div class="a hd"><div class="k en">${TX.gKicker}</div><div class="t">${TX.gTitle}</div><div class="s">${TX.gSub}</div></div>
      ${ph5.map((p) => photo(p, V ? 330 : 360, V ? 330 : 360, 'fan')).join('')}</div>`, (t) => {
      const [a, b] = S.giftTitle;
      root.style.opacity = env(t, a, b, 0.5, 0.45).toFixed(3);
      const hd = $('.hd', root);
      rv($('.k', hd), t, a + 0.15, b, { dy: 20 });
      const tt = $('.t', hd);
      rv(tt, t, a + 0.3, b, { dy: 40, ds: 0.08, din: 0.9 });
      tt.style.letterSpacing = `${lerp(0.3, 0.06, E.outQuint(seg(t, a + 0.3, a + 1.6)))}em`;
      rv($('.s', hd), t, a + 0.7, b, { dy: 20 });
      $$('.fan', root).forEach((e, i) => {
        const c = i - 2;
        const x = V ? W / 2 - 165 + c * 190 : W / 2 - 180 + c * 330, y = V ? 980 + Math.abs(c) * 44 : 640 + Math.abs(c) * 46;
        const p = E.outBack(seg(t, a + 0.6 + i * 0.1, a + 1.5 + i * 0.1));
        const o = clamp(seg(t, a + 0.6 + i * 0.1, a + 1.0 + i * 0.1)) * (1 - E.inCubic(seg(t, b - 0.45, b)));
        e.style.left = `${x}px`; e.style.top = `${y}px`;
        tf(e, 0, (1 - p) * 420 + Math.sin(t * 1.2 + i) * 6, 1, o, c * 6);
        e.style.zIndex = String(10 - Math.abs(c));
        kb(e, t, a, b, 1.0, 1.08);
      });
    });
  }

  // ---------- 6. signature set ----------
  {
    const G = D.sig;
    const root = addScene(S.sig, `<div class="scene" id="sig"><div class="a bg"></div>
      ${photo(G.photo, V ? 660 : 780, V ? 660 : 780, 'hero')}
      <div class="a txt"><div class="kick">${TX.sigKicker}</div><div class="t">${G.name}</div>
        <div class="comp">${G.comp.map((c) => `<b>${c}</b>`).join('<em>+</em>')}</div>
        <div class="pr">${G.tagline}</div></div>
      <div class="a items">${G.items.map((it) => `<div class="item">${photo(it.photo, V ? 170 : 190, V ? 170 : 190)}<div class="n">${it.n}</div><div class="s">${it.s}</div></div>`).join('')}</div>
      <div class="a more">${photo(G.more.photo, 92, 92)}<div><div class="mk">${TX.sigMoreK}</div><div class="mn">${G.more.name}</div></div><div class="mp">${G.more.note}</div></div></div>`, (t) => {
      const [a, b] = S.sig;
      root.style.opacity = env(t, a, b, 0.5, 0.5).toFixed(3);
      const hero = $('.hero', root);
      rv(hero, t, a + 0.1, b, { dx: -90, dy: 0, ds: 0.04, din: 1.0 });
      kb(hero, t, a, b, 1.0, 1.1, -10, 6);
      const txt = $('.txt', root);
      rv($('.kick', txt), t, a + 0.35, b, { dx: 40, dy: 0 });
      rv($('.t', txt), t, a + 0.5, b, { dx: 60, dy: 0, din: 0.9 });
      $$('.comp > *', txt).forEach((e, i) => rv(e, t, a + 0.9 + i * 0.1, b, { dy: 18 }));
      rv($('.pr', txt), t, a + 1.4, b, { dy: 30, ds: 0.1 });
      $$('.item', root).forEach((e, i) => { rv(e, t, a + 1.9 + i * 0.25, b, { dy: 60, ds: 0.1 }); kb($('.ph', e), t, a, b, 1.05, 1.18); });
      rv($('.more', root), t, CUE.sigMore, b, { dy: 60 });
    });
  }

  // ---------- 7/8. card rows: premium sets, towel sets ----------
  function cardRow(id, range, kicker, title, cards, bg, from) {
    // horizontal: three cards side by side; vertical: three rows, photo left and text right
    const n = cards.length, w = V ? 320 : 520, gap = V ? 30 : 54, x0 = (W - (n * w + (n - 1) * gap)) / 2;
    const pos = (i) => (V ? `left:80px;top:${470 + i * (w + gap)}px` : `left:${x0 + i * (w + gap)}px`);
    const root = addScene(range, `<div class="scene crow" id="${id}"><div class="a bg" style="background:${bg}"></div>
      <div class="a hd"><div class="kick">${kicker}</div><div class="t">${title}</div></div>
      ${cards.map((c, i) => `<div class="gcard" style="${pos(i)}">${c.tag ? `<div class="pr">${c.tag}</div>` : ''}${photo(c.photo, w, w)}<div class="gt"><div class="n0 en">0${i + 1}</div><div class="n1">${c.name[0]}</div><div class="n2">${c.name[1]}</div></div></div>`).join('')}</div>`, (t) => {
      const [a, b] = range;
      root.style.opacity = env(t, a, b, 0.5, 0.5).toFixed(3);
      rv($('.hd', root), t, a + 0.15, b, { dy: 26 });
      $$('.gcard', root).forEach((e, i) => {
        const s = a + 0.4 + i * 0.22;
        if (from === 'side') rv(e, t, s, b, { dx: 160, dy: 0, din: 0.9 });
        else rv(e, t, s, b, { dy: 130, ds: 0.05, din: 0.9 });
        kb($('.ph', e), t, a, b, 1.02, 1.12, (i - 1) * 8, 0);
        const tag = $('.pr', e);
        if (tag) rv(tag, t, s + 0.6, b, { dy: -10, ds: 0.4, din: 0.5, ease: E.outBack });
      });
    });
    return root;
  }
  cardRow('prem', S.prem, TX.premKicker, TX.premTitle, D.prem, 'linear-gradient(180deg,#FFFCF7,#F6ECDD)', 'up');
  cardRow('towelSets', S.towelSets, TX.tsKicker, TX.tsTitle, D.towelSets, 'linear-gradient(180deg,#F5F7F1,#E7EEE2)', 'side');

  // ---------- 9. condolence ----------
  {
    const G = D.condol;
    const root = addScene(S.condol, `<div class="scene" id="condol"><div class="a bg"></div><div class="a flw">${FLOWER}</div>
      ${photo(G.photo, V ? 640 : 720, V ? 640 : 720, 'hero')}
      <div class="a txt"><div class="kick">${TX.cKicker}</div><div class="t">${TX.cTitle}</div><div class="s">${TX.cSub}</div>
        <div class="lst">${G.items.map((x) => `<div class="li">${ICON.check}<span>${x}</span></div>`).join('')}</div>
        <div class="pr">${G.closing}</div></div></div>`, (t) => {
      const [a, b] = S.condol;
      root.style.opacity = env(t, a, b, 0.6, 0.8).toFixed(3);
      tf($('.flw', root), 0, 0, 1, 0.10, t * 4);
      const hero = $('.hero', root);
      rv(hero, t, a + 0.2, b, { dy: 0, ds: 0.06, din: 1.2 });
      kb(hero, t, a, b, 1.0, 1.1);
      const txt = $('.txt', root);
      rv($('.kick', txt), t, a + 0.5, b, { dx: 40, dy: 0 });
      rv($('.t', txt), t, a + 0.65, b, { dx: 60, dy: 0, din: 0.9 });
      rv($('.s', txt), t, a + 0.9, b, { dx: 40, dy: 0 });
      $$('.li', txt).forEach((e, i) => rv(e, t, a + 1.3 + i * 0.2, b, { dx: 40, dy: 0 }));
      rv($('.pr', txt), t, a + 2.3, b, { dy: 24 });
    });
  }

  // ---------- 10. location overlays ----------
  {
    const root = addScene(S.locIntro, `<div class="scene" id="locIntro"><div class="a shade"></div>
      <div class="a txt"><div class="kick">${TX.locKicker}</div><div class="t">${TX.locTitle.map((x) => `<div>${x}</div>`).join('')}</div><div class="s">${TX.locSub}</div></div></div>`, (t) => {
      const [a, b] = S.locIntro;
      tf($('.shade', root), 0, 0, 1, env(t, a + 0.2, b, 0.9, 0.7));
      const txt = $('.txt', root);
      rv($('.kick', txt), t, a + 0.6, b, { dx: -40, dy: 0 });
      $$('.t > div', txt).forEach((e, i) => rv(e, t, a + 0.8 + i * 0.2, b, { dx: -60, dy: 0, din: 0.9 }));
      rv($('.s', txt), t, a + 1.4, b, { dx: -40, dy: 0 });
    });
    const info = addScene(S.locInfo, `<div class="scene" id="locInfo"><div class="a bar">${TX.locInfo.map((x) => `<div class="li3"><div class="ic">${ICON[x.icon]}</div><div><div class="lt">${x.t}</div><div class="ls">${x.s}</div></div></div>`).join('')}</div></div>`, (t) => {
      const [a, b] = S.locInfo;
      rv($('.bar', info), t, a + 0.2, b, { dy: 80, din: 0.9 });
      $$('.li3', info).forEach((e, i) => rv(e, t, a + 0.6 + i * 0.2, b, { dy: 20 }));
    });
  }

  // ---------- 11. benefits ----------
  {
    // horizontal: a row of four cards; vertical: a 2 x 2 grid
    const n = D.benefits.length, w = V ? 440 : 380, gap = 40, per = V ? 2 : n, x0 = (W - (per * w + (per - 1) * gap)) / 2;
    const pos = (i) => `left:${x0 + (i % per) * (w + gap)}px;${V ? `top:${410 + Math.floor(i / per) * 440}px` : ''}`;
    const root = addScene(S.benefits, `<div class="scene" id="benefits"><div class="a bg"></div>
      <div class="a hd"><div class="kick">${TX.beKicker}</div><div class="t">${TX.beTitle}</div></div>
      ${D.benefits.map((x, i) => `<div class="bcard" style="${pos(i)}"><div class="bi">${ICON[x.icon]}</div><div class="bk">${x.k}</div><div class="bt">${x.t}</div><div class="bs">${x.s}</div></div>`).join('')}
      <div class="a ex"><div class="exk">${TX.beExtra}</div><div class="exr">${D.extras.map((x) => `<span class="chip"><i></i>${x}</span>`).join('')}</div></div></div>`, (t) => {
      const [a, b] = S.benefits;
      root.style.opacity = env(t, a, b, 0.6, 0.5).toFixed(3);
      rv($('.hd', root), t, a + 0.3, b, { dy: 30 });
      $$('.bcard', root).forEach((e, i) => {
        const s = CUE.benefitPops[i] - 0.25;
        rv(e, t, s, b, { dy: 60, ds: 0.25, din: 0.6, ease: E.outBack });
        e.style.transform += ` translateY(${(Math.sin(t * 1.4 + i) * 6).toFixed(1)}px)`;
        const bi = $('.bi', e);
        const wig = t > s + 0.3 && t < s + 1.0 ? Math.sin((t - s) * 30) * 8 * (1 - seg(t, s + 0.3, s + 1.0)) : 0;
        bi.style.transform = `rotate(${wig.toFixed(2)}deg)`;
      });
      rv($('.exk', root), t, a + 3.6, b, { dy: 20 });
      $$('.ex .chip', root).forEach((e, i) => rv(e, t, a + 3.8 + i * 0.12, b, { dy: 20 }));
    });
  }

  // ---------- 12. outro ----------
  {
    // a wall of product photos behind the end card; the vertical frame needs more rows
    const cols = V ? 4 : 7, cs = V ? 290 : 340, ps = V ? 260 : 300, rows = V ? 8 : 3;
    const P = Array.from({ length: cols * rows }, (_, i) => D.outroPhotos[i % D.outroPhotos.length]);
    const wall = P.map((p, i) => photo(p, ps, ps, '', `left:${(i % cols) * cs + (Math.floor(i / cols) % 2) * (cs / 2)}px;top:${Math.floor(i / cols) * cs + 60}px`)).join('');
    const root = addScene(S.outro, `<div class="scene" id="outro"><div class="a wall">${wall}</div><div class="a veil"></div>
      <div class="a ctr"><div class="wm">${D.brand.name}</div><div class="we">${D.brand.en}</div><div class="ln"></div>
        <div class="tag">${TX.outTag}</div><div class="url">${D.brand.site}</div>
        <div class="ct"><span>${ICON.phone}${D.brand.tel}</span><span>${ICON.insta}${D.brand.insta}</span><span>${ICON.globe}네이버 스마트스토어 · 블로그</span></div>
        <div class="th">${TX.outThanks}</div></div></div>`, (t) => {
      const [a, b] = S.outro, f = CUE.outroFin;
      root.style.opacity = env(t, a, b + 1, 0.8, 0.1).toFixed(3);
      tf($('.wall', root), -60 * seg(t, a, b), -40 * seg(t, a, b), 1.0 + 0.05 * seg(t, a, b), 1);
      $$('.wall .ph', root).forEach((e, i) => { const s = a + (V ? 0.03 : 0.05) * i; rv(e, t, s, null, { dy: 40, ds: 0.1, din: 0.8 }); });
      tf($('.veil', root), 0, 0, 1, lerp(0.35, 1, E.inOutCubic(seg(t, a + 0.4, f + 0.4))));
      const c = $('.ctr', root);
      const wm = $('.wm', c);
      rv(wm, t, f, null, { dy: 30, din: 1.0 });
      wm.style.letterSpacing = `${lerp(0.4, 0.12, E.outQuint(seg(t, f, f + 2.0)))}em`;
      wm.style.textIndent = wm.style.letterSpacing;
      rv($('.we', c), t, f + 0.4, null, { dy: 16 });
      $('.ln', c).style.transform = `scaleX(${E.outCubic(seg(t, f + 0.6, f + 1.5)).toFixed(3)})`;
      rv($('.tag', c), t, f + 0.9, null, { dy: 20 });
      rv($('.url', c), t, f + 1.4, null, { dy: 20, ds: 0.1 });
      $$('.ct span', c).forEach((e, i) => rv(e, t, f + 1.8 + i * 0.15, null, { dy: 16 }));
      rv($('.th', c), t, f + 2.5, null, { dy: 14 });
    });
  }

  // wait for every photo so no frame shows a half-loaded image
  await Promise.all([...document.images].map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))));

  // Vertical cut: centre each scene's content so the space above and below is about equal.
  // Each scene is measured once in its settled state, then its content is shifted by --dy.
  if (V) {
    const BACKDROP = ['bg', 'bg2', 'leaf', 'flw', 'bokeh', 'petal', 'wall', 'veil', 'shade'];
    const TOP_MIN = 190; // keep clear of the brand pill
    for (const s of scenes) {
      const id = s.root.id;
      if (!id || id.startsWith('loc')) continue; // the map overlays are placed with the map camera
      const times = id === 'quality' ? [CUE.bambooSwap - 0.5, s.b - 1.2] : [s.b - 1.2];
      let top = 1e9, bot = -1e9;
      s.root.style.display = s.display;
      for (const t of times) {
        s.update(t);
        for (const ch of s.root.children) {
          if (BACKDROP.some((c) => ch.classList.contains(c))) continue;
          for (const e of [ch, ...ch.querySelectorAll('*')]) {
            if (e.tagName === 'IMG' || getComputedStyle(e).display === 'none') continue;
            const q = e.getBoundingClientRect();
            if (q.width < 2 || q.height < 2 || q.height >= H - 1) continue;
            top = Math.min(top, q.top); bot = Math.max(bot, q.bottom);
          }
        }
      }
      s.root.style.display = 'none';
      if (top > bot) continue;
      const dy = Math.max(TOP_MIN - top, Math.round((H - bot - top) / 2));
      s.root.style.setProperty('--dy', `${dy}px`);
    }
  }

  // ---------- frame ----------
  const brand = $('#brand'), attr = $('#attr'), black = $('#black');
  async function renderAt(t) {
    const c = cam(t), look = mapLook(t);
    const mon = mapOn(t);
    MAP.el.style.display = mon ? '' : 'none';
    if (mon) {
      await MAP.ensure(c);
      MAP.draw(c, look);
      MAP.el.style.opacity = mapAlpha(t).toFixed(3);
    }
    drawFx(t, c);
    updatePins(t, c);
    $('#vignette').style.opacity = mapAlpha(t).toFixed(3);
    for (const s of scenes) {
      const on = t >= s.a && t < s.b;
      s.root.style.display = on ? s.display : 'none';
      if (on) s.update(t);
    }
    tf(brand, 0, 0, 1, env(t, S.occasions[0] + 0.4, S.outro[0], 0.8, 0.6) * (1 - 0.15 * mapAlpha(t)));
    tf(attr, 0, 0, 1, mapAlpha(t) * 0.9);
    black.style.opacity = Math.max(1 - seg(t, 0, 0.5), seg(t, cfg.duration - 1.0, cfg.duration)).toFixed(3);
  }

  function collectTiles() {
    const set = new Set();
    for (let f = 0; f < cfg.duration * cfg.fps; f++) {
      const t = f / cfg.fps;
      if (!mapOn(t)) continue;
      for (const tl of MAP.tiles(cam(t))) set.add(tl.key);
    }
    return [...set];
  }

  window.renderAt = renderAt;
  window.collectTiles = collectTiles;
  window.VIDEO = { fps: cfg.fps, duration: cfg.duration };
  window.ready = true;

  // live preview: open index.html?play (optionally &t=SECONDS)
  const qs = new URLSearchParams(location.search);
  if (qs.has('play')) {
    const start = parseFloat(qs.get('t') || '0'), t0 = performance.now();
    const audio = new Audio('output/audio.wav');
    audio.currentTime = start; audio.play().catch(() => {});
    let busy = false;
    const loop = async () => { if (!busy) { busy = true; await renderAt(Math.min(cfg.duration - 0.01, start + (performance.now() - t0) / 1000)); busy = false; } requestAnimationFrame(loop); };
    loop();
  } else if (qs.has('t')) {
    renderAt(parseFloat(qs.get('t')));
  }
})();
