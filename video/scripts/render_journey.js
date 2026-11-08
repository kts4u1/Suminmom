// Renders the "road to the office" terrain flyover (journey.html) frame by frame.
//   node scripts/render_journey.js --stills 3,9,20 --out dir      single preview frames
//   node scripts/render_journey.js --out frames [--workers 3]      all frames as JPEG
//   add --fmt h for 1920x1080 (default: vertical 1080x1920)
// Map tiles are fetched on demand and cached on disk:
//   satellite  Esri World Imagery Wayback (release from config.json map.release) -> assets/tiles/<release>/z/y/x.jpg
//   elevation  AWS Terrain Tiles (terrarium)                                      -> assets/dem/z/x/y.png
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const HORIZ = arg('fmt', 'v') === 'h';
const VIEW = HORIZ ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const REL = CFG.map.release;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const UA = 'suminmom-promo-video/1.0';

// fetch one remote tile into the cache with curl (it follows redirects and uses the proxy settings)
const inflight = new Map();
function cached(file, url) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return Promise.resolve(true);
  if (inflight.has(file)) return inflight.get(file);
  const p = new Promise((resolve) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.part`;
    execFile('curl', ['-sSfL', '--retry', '3', '--max-time', '40', '-A', UA, '-o', tmp, url], (err) => {
      if (err) { fs.rmSync(tmp, { force: true }); return resolve(false); }
      fs.renameSync(tmp, file); resolve(true);
    });
  }).finally(() => inflight.delete(file));
  inflight.set(file, p);
  return p;
}

function serve(listenPort = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      let m;
      if ((m = p.match(/^\/wb\/(\d+)\/(\d+)\/(\d+)\.jpg$/))) {
        const [, z, y, x] = m;
        const file = path.join(ROOT, 'assets', 'tiles', String(REL), z, y, `${x}.jpg`);
        const ok = await cached(file, `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${REL}/${z}/${y}/${x}`);
        if (!ok) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return fs.createReadStream(file).pipe(res);
      }
      if ((m = p.match(/^\/dem\/(\d+)\/(\d+)\/(\d+)\.png$/))) {
        const [, z, x, y] = m;
        const file = path.join(ROOT, 'assets', 'dem', z, x, `${y}.png`);
        const ok = await cached(file, `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
        if (!ok) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'image/png' }); return fs.createReadStream(file).pipe(res);
      }
      const fp = path.join(ROOT, p === '/' ? '/journey.html' : p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(fp, (e, d) => {
        if (e) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(d);
      });
    });
    srv.listen(listenPort, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/journey.html${HORIZ ? '?fmt=h' : ''}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  return page;
}

(async () => {
  if (arg('serve')) { // preview: open http://127.0.0.1:<port>/journey.html in a browser
    await serve(parseInt(arg('serve'), 10));
    console.log(`serving on http://127.0.0.1:${arg('serve')}/journey.html`);
    return;
  }
  const srv = await serve();
  const port = srv.address().port;
  const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
  const out = path.resolve(arg('out', path.join(ROOT, 'output', HORIZ ? 'journey_frames_h' : 'journey_frames')));
  fs.mkdirSync(out, { recursive: true });

  if (arg('stills')) {
    const b = await launch();
    const page = await openPage(b, port);
    for (const s of arg('stills').split(',')) {
      const t = parseFloat(s), t0 = Date.now();
      await page.evaluate((t) => window.renderAt(t), t);
      await page.screenshot({ path: path.join(out, `still_${t.toFixed(2).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 88 });
      console.log(`t=${t} ${Date.now() - t0}ms`);
    }
    await b.close(); srv.close(); return;
  }

  const meta = await (async () => { const b = await launch(); const p = await openPage(b, port); const m = await p.evaluate(() => window.VIDEO); await b.close(); return m; })();
  const total = Math.round(meta.fps * meta.duration);
  const workers = parseInt(arg('workers', '3'), 10);
  const todo = [];
  for (let f = 0; f < total; f++) {
    const fp = path.join(out, `f${String(f).padStart(5, '0')}.jpg`);
    if (!fs.existsSync(fp) || fs.statSync(fp).size === 0) todo.push(f);
  }
  console.log(`rendering ${todo.length} frames with ${workers} workers -> ${out}`);
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, async () => {
    const b = await launch();
    const page = await openPage(b, port);
    const block = 30; // contiguous blocks keep each worker's tile cache warm
    for (;;) {
      const start = next; next += block;
      if (start >= todo.length) break;
      for (let i = start; i < Math.min(start + block, todo.length); i++) {
        const f = todo[i];
        await page.evaluate((t) => window.renderAt(t), f / meta.fps);
        const fp = path.join(out, `f${String(f).padStart(5, '0')}.jpg`);
        await page.screenshot({ path: fp + '.tmp', type: 'jpeg', quality: 93 });
        fs.renameSync(fp + '.tmp', fp);
        done++;
        if (done % 60 === 0) {
          const el = (Date.now() - t0) / 1000;
          console.log(`${done}/${todo.length} frames, ${(done / el).toFixed(2)} fps, eta ${Math.round((todo.length - done) / (done / el))}s`);
        }
      }
    }
    await b.close();
  }));
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
