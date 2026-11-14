/* eslint-disable */
/**
 * GFX-001 comparison captures: the SAME cameras and virtual hours before and after the remaster.
 * Needs the dev server (debug helpers) and Playwright with Chromium (not a project dependency):
 *
 *   npm run dev &  WEBLAB_URL=http://localhost:5173 node scripts/gfx/capture.cjs <outDir> <prefix>
 *
 * Headless Chromium renders with a software GPU: the numbers in metrics.json describe the SCENE
 * (meshes, triangles, draw calls), never the frame rate of a phone.
 */
const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright');
const URL_BASE = process.env.WEBLAB_URL || 'http://localhost:5173';
const OUT = process.argv[2]; const PRE = process.argv[3] || 'x';
const ONLY = (process.env.GFX_ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const metrics = {};
  for (const gfx of (process.env.GFX_PROFILES || 'desktop,mobile').split(',')) {
    const page = await (await browser.newContext({ viewport: gfx === 'desktop' ? { width: 1280, height: 720 } : { width: 780, height: 360 }, deviceScaleFactor: 1 })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const t0 = Date.now();
    await page.goto(`${URL_BASE}/?gfx=${gfx}&trafego=${gfx === 'desktop' ? 1 : 1}&hora=12`, { timeout: 120000 });
    await page.waitForFunction(() => window.__weblab && window.__debug, null, { timeout: 120000 });
    const load = Date.now() - t0;
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const wait = (ms) => page.waitForTimeout(ms);
    const want = (n) => !ONLY.length || ONLY.some((o) => n.startsWith(o));
    const shot = async (name) => { if (want(name)) await page.screenshot({ path: path.join(OUT, `${PRE}-${gfx}-${name}.jpg`), type: 'jpeg', quality: 88 }); };
    const measure = async (name) => { metrics[`${gfx}:${name}`] = await ev(() => { const s = window.__weblab.snapshot(); return { activeMeshes: s.activeMeshes, meshes: window.__scene.meshes.length, triangles: Math.round(window.__scene.getActiveIndices() / 3), materials: window.__scene.materials.length, textures: window.__scene.textures.length, perf: s.perf ?? null, houses: s.houses, vehicles: s.city.vehicles, pedestrians: s.city.pedestrians }; }); };
    const behind = (yaw) => Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    await ev(() => window.__debug.setHour(12.5));
    await wait(2500);
    const P = await ev(() => window.__debug.probe());
    const snap = () => ev(() => window.__weblab.snapshot());
    // 1. Riding on a real street towards a four-way junction, noon and late afternoon.
    await ev(([x, z, y]) => window.__debug.teleport(x, z, y), [P.junction.startX, P.junction.startZ, P.junction.yaw]);
    await ev(([a]) => window.__debug.camera(a, 1.22, 5.6), [behind(P.junction.yaw)]);
    await wait(7000); await shot('rua-12h'); await measure('rua');
    await ev(() => window.__debug.setHour(17.6)); await wait(3500); await shot('rua-17h');
    await ev(() => window.__debug.setHour(20.5)); await wait(3500); await shot('rua-noite');
    await ev(() => window.__debug.setHour(12.5)); await wait(1500);
    // 2. Bike close-up (parked) and rider on foot.
    await ev(([a]) => window.__debug.camera(a + 0.9, 1.25, 3.2), [behind(P.junction.yaw)]); await wait(2500); await shot('moto-perto');
    await ev(([x, z, y]) => window.__debug.placeWalker(x + 2.2, z + 1.0, y), [P.junction.startX, P.junction.startZ, P.junction.yaw + 2.4]);
    await ev(([a]) => window.__debug.camera(a, 1.2, 3.0), [behind(P.junction.yaw + 2.4) + Math.PI]); await wait(2500); await shot('entregador-perto');
    if (process.env.GFX_QUICK === 'rua') { await page.close(); continue; }
    // 3. The eight shops: facade from the street and interior at the counter.
    const stores = (await snap()).delivery.stores;
    for (const st of stores) {
      const out = { x: st.pickup.x - Math.sin(st.facing) * 17, z: st.pickup.z - Math.cos(st.facing) * 17 };
      await ev(([x, z, y]) => window.__debug.placeWalker(x, z, y), [out.x, out.z, st.facing]);
      await ev(([a]) => window.__debug.camera(a, 1.32, 7.5), [behind(st.facing)]); await wait(6500); await shot(`loja-${st.id}-fachada`);
      const inn = { x: st.pickup.x - Math.sin(st.facing) * 2.4, z: st.pickup.z - Math.cos(st.facing) * 2.4 };
      await ev(([x, z, y]) => window.__debug.placeWalker(x, z, y), [inn.x, inn.z, st.facing]);
      await ev(([a]) => window.__debug.camera(a, 1.12, 4.4), [behind(st.facing)]); await wait(5000); await shot(`loja-${st.id}-interior`);
      if (st.id === stores[0].id) await measure('loja');
    }
    // 4. Depot: yard, receiving desk and the sorting floor.
    const D = await ev(() => ({ yard: window.__debug.depot(100, -104), desk: window.__debug.depot(96.4, -122.4), floor: window.__debug.depot(112, -124), yaw: window.__debug.depotYaw(Math.PI) }));
    await ev(() => window.__debug.setHour(14.2));
    await ev(([x, z, y]) => window.__debug.placeWalker(x, z, y), [D.yard.x, D.yard.z, D.yaw]);
    await ev(([a]) => window.__debug.camera(a, 1.3, 9), [behind(D.yaw)]); await wait(7000); await shot('galpao-patio'); await measure('galpao');
    await ev(([x, z, y]) => window.__debug.placeWalker(x, z, y), [D.desk.x, D.desk.z, D.yaw - Math.PI / 2]);
    await ev(([a]) => window.__debug.camera(a, 1.15, 5), [behind(D.yaw - Math.PI / 2)]); await wait(5000); await shot('galpao-recebimento');
    await ev(([x, z, y]) => window.__debug.placeWalker(x, z, y), [D.floor.x, D.floor.z, D.yaw]);
    await ev(([a]) => window.__debug.camera(a, 1.05, 8), [behind(D.yaw)]); await wait(5000); await shot('galpao-triagem');
    await ev(() => window.__debug.setHour(12.5));
    // 5. Aerial view of the centre (debug camera).
    await ev(([x, z]) => window.__debug.placeWalker(x, z, 0), [P.junction.x, P.junction.z]); await wait(6000);
    await ev(([x, z]) => window.__debug.view(0.9, 0.95, 60, x, z), [P.junction.x, P.junction.z]); await wait(4000); await shot('aereo-centro'); await measure('centro');
    await ev(() => window.__debug.endView());
    metrics[`${gfx}:load`] = { ms: load, errors };
    await page.close();
  }
  fs.writeFileSync(path.join(OUT, `${PRE}-metrics.json`), JSON.stringify(metrics, null, 1));
  console.log(JSON.stringify(metrics, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
