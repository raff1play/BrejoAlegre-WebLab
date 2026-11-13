/* eslint-disable */
/**
 * CORE-015 comparison images. Needs the dev server (the minimap base is exported by a dev-only
 * helper) and Playwright with Chromium in the environment (not a project dependency):
 *
 *   node --experimental-strip-types scripts/geo/compare-map.ts     # metrics + raw OSM SVGs
 *   npm run dev &  WEBLAB_URL=http://localhost:5173 node scripts/geo/compare-shots.cjs
 *
 * Writes to docs/evidence/core015-mapa/: minimapa-jogo.png (the game's minimap layer, exact pixels),
 * osm-bruto.png (raw OSM, independent projection), lado-a-lado.png, sobreposicao.png,
 * centro-sobreposicao.png and aereo-3d-centro.jpg. Same bounds, scale (1.2 px/m) and north-up
 * orientation for the two maps. Map data © OpenStreetMap contributors (ODbL).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL_BASE = process.env.WEBLAB_URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', '..', 'docs', 'evidence', 'core015-mapa');
const metrics = JSON.parse(fs.readFileSync(path.join(OUT, 'metricas.json'), 'utf8'));
const B = metrics.seatExtentMetres.playBounds;
const PX = 1.2;
const W = (B.maxX - B.minX) * PX; const H = (B.maxZ - B.minZ) * PX;
const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    // 1. The game's own minimap layer, as painted in the game (dev helper).
    const game = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    await game.goto(`${URL_BASE}/?gfx=desktop&trafego=0`);
    await game.waitForFunction(() => window.__weblab && window.__debug, null, { timeout: 90000 });
    const base = await game.evaluate(() => window.__debug.minimapBase());
    if (base.pxPerM !== PX) throw new Error(`minimap scale ${base.pxPerM} ≠ ${PX}`);
    fs.writeFileSync(path.join(OUT, 'minimapa-jogo.png'), Buffer.from(base.url.split(',')[1], 'base64'));

    // 2. Pages rendered at exact pixel size.
    const page = await (await browser.newContext({ viewport: { width: Math.ceil(W), height: Math.ceil(H) }, deviceScaleFactor: 1 })).newPage();
    const render = async (html, file, size) => {
      await page.setViewportSize(size || { width: Math.ceil(W), height: Math.ceil(H) });
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#111">${html}</body></html>`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    };
    const osmSvg = dataUrl(path.join(OUT, 'osm-bruto.svg'), 'image/svg+xml');
    const overSvg = dataUrl(path.join(OUT, 'osm-sobreposicao.svg'), 'image/svg+xml');
    await render(`<img src="${osmSvg}" width="${W}" height="${H}">`, 'osm-bruto.png');
    const c = metrics.comparison; const r = metrics.rawFile; const g = metrics.game;
    const bar = (label) => `<div style="position:absolute;left:24px;bottom:42px;color:#fff;font:14px sans-serif"><div style="width:${100 * PX}px;height:6px;background:#fff"></div>100 m · ${label}</div><div style="position:absolute;right:24px;top:20px;color:#fff;font:700 22px sans-serif">N ↑</div>`;
    const panel = (title, img, label) => `<div style="position:relative;width:${W}px;height:${H}px"><img src="${img}" width="${W}" height="${H}" style="display:block">${bar(label)}<div style="position:absolute;left:0;top:0;padding:10px 14px;background:#000a;color:#fff;font:700 20px sans-serif">${title}</div></div>`;
    const caption = `Mesma área (${B.maxX - B.minX} × ${B.maxZ - B.minZ} m), mesma escala (1,2 px/m) e orientação (norte para cima). Malha carroçável do OSM coberta pelo jogo: ${c.osmDrivableCoveredByGame}% (tolerância ${c.toleranceMetres} m) · vias do jogo sobre o OSM: ${c.gameRoadsOnOsm}% · cruzamentos: ${c.junctionsMatched}/${c.junctionsInPlayArea} · erro máximo de escala (haversine): ${c.maxScaleErrorMetres} m. Lotes/casas (${g.houses}) são ESTIMADOS: o OSM tem só ${r.buildings} edificações mapeadas. Lojas, galpão e números de casa são fictícios. © OpenStreetMap contributors (ODbL), extração ${metrics.source.fetchedAt.slice(0, 10)}.`;
    const gameImg = dataUrl(path.join(OUT, 'minimapa-jogo.png'), 'image/png');
    await render(`<div style="display:flex;gap:16px;background:#111;padding:16px">${panel('OpenStreetMap bruto (projeção independente)', osmSvg, 'OSM')}${panel('Minimapa do jogo (camada estática real)', gameImg, 'jogo')}</div><p style="color:#eee;font:16px/1.4 sans-serif;margin:0 16px 16px;max-width:${2 * W}px">${caption}</p>`,
      'lado-a-lado.png', { width: Math.ceil(2 * W + 48), height: Math.ceil(H + 140) });
    await render(`<div style="position:relative;width:${W}px;height:${H}px"><img src="${gameImg}" width="${W}" height="${H}" style="position:absolute"><img src="${overSvg}" width="${W}" height="${H}" style="position:absolute">${bar('vermelho = eixos OSM; tracejado = service/track (fora da malha do jogo)')}</div>`, 'sobreposicao.png');
    // 3. Centre detail at 3× (≈ 0.28 m per pixel): OSM centrelines over the game minimap.
    const Z = 3; const half = 230; const cx = -46; const cz = 39;
    const ox = -((cx - half - B.minX) * PX * Z); const oz = -((B.maxZ - (cz + half)) * PX * Z);
    await render(`<div style="position:relative;width:${2 * half * PX * Z}px;height:${2 * half * PX * Z}px;overflow:hidden"><img src="${gameImg}" width="${W * Z}" height="${H * Z}" style="position:absolute;left:${ox}px;top:${oz}px;image-rendering:auto"><img src="${overSvg}" width="${W * Z}" height="${H * Z}" style="position:absolute;left:${ox}px;top:${oz}px"><div style="position:absolute;left:20px;bottom:20px;color:#fff;font:15px sans-serif;background:#000a;padding:6px 10px"><div style="width:${50 * PX * Z}px;height:6px;background:#fff"></div>50 m · centro (${2 * half} × ${2 * half} m) · vermelho = OSM</div></div>`,
      'centro-sobreposicao.png', { width: Math.round(2 * half * PX * Z), height: Math.round(2 * half * PX * Z) });

    // 4. 3D aerial of the centre (perspective: for visual comparison only, not to scale).
    await game.evaluate(([x, z]) => window.__debug.view(-Math.PI / 2, 0.55, 260, x, z), [cx, cz]);
    await game.waitForTimeout(6000);
    await game.screenshot({ path: path.join(OUT, 'aereo-3d-centro.jpg'), type: 'jpeg', quality: 85 });
  } finally {
    await browser.close();
  }
  console.log('imagens em', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
