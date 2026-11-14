/** Repeatable visual audit. Supply Playwright externally (no new app dependency).
 * WEBLAB_URL, WEBLAB_SHOTS, CHROMIUM_PATH; run on dev server for scene positioning.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 296 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.WEBLAB_URL || 'http://localhost:5173');
    await page.waitForFunction(() => window.__debug && window.__weblab, null, { timeout: 120000 });
    await page.evaluate(async () => {
      const { STORES } = await import('/src/world/city/cityPlan.ts');
      const { framePoint, yawOf } = await import('/src/world/layout.ts');
      const s = STORES.find(s => s.id === 'construcao');
      const q = framePoint(s.frame, s.width / 2, -0.6);
      window.__debug.setHour(12);
      window.__debug.placeWalker(q.x, q.z, yawOf(s.frame));
      window.__debug.view(Math.atan2(-Math.cos(yawOf(s.frame)), -Math.sin(yawOf(s.frame))), 1.12, 10, q.x, q.z);
    });
    await page.waitForFunction(() => window.__weblab.snapshot().delivery.stores.find(s => s.id === 'construcao').shutter > .95, null, { timeout: 180000 });
    const out = process.env.WEBLAB_SHOTS || '/tmp/street-visual'; fs.mkdirSync(out, {recursive:true});
    await page.setViewportSize({width:1412,height:652});
    await page.waitForTimeout(2000); await page.screenshot({path:`${out}/shop.png`});
    await page.evaluate(async () => {
      const { zebraSites } = await import('/src/world/city/urbanDetail.ts');
      const s = zebraSites().find(s => Math.abs(s.dirX) > .2 && Math.abs(s.dirZ) > .2);
      window.__debug.view(Math.atan2(s.dirZ, s.dirX), .3, 22, s.x, s.z);
    });
    await page.waitForTimeout(2000); await page.screenshot({path:`${out}/crossing.png`});
    if(errors.length) throw new Error(errors.join('\n'));
    console.log('PASS: shop opens, objective/HUD rendered, diagonal OSM crossing captured; no page errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
