/* Browser smoke test for the opt-in Patch.gg model comparison.
 * CI uses software rendering: does not measure Galaxy S24 real FPS.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  const evidence = path.join(__dirname, '../../docs/evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const reports = [];
  try {
    for (const [name, query, width, height] of [
      ['mobile', '?gfx=mobile&assets=patch&devtime=1&hora=12', 780, 360],
      ['desktop', '?gfx=desktop&assets=patch&devtime=1&hora=12', 1280, 720],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto('http://127.0.0.1:4173/' + query, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => {
        const status = window.__weblab?.snapshot()?.city?.patch;
        return status && status.bus !== 'loading' && status.pedestrian !== 'loading';
      }, null, { timeout: 75000 });
      await page.waitForTimeout(1700);
      const snap = await page.evaluate(() => window.__weblab.snapshot());
      const patch = snap.city.patch;
      const record = { name, patch, fpsSoftware: Number(snap.fps.toFixed(1)), errors };
      reports.push(record);
      console.log('PATCH_SMOKE ' + JSON.stringify(record));
      assert.equal(patch.bus, 'ready', 'GLB bus should load');
      assert.equal(patch.pedestrian, 'ready', 'rigged NPC should load');
      assert.equal(snap.city.byKind.bus, 2, 'original bus traffic count must remain unchanged');
      assert.equal(snap.camera.mode, 'third-person', 'only GTA camera remains');
      assert.equal(errors.length, 0, 'No browser runtime errors expected');
      await page.screenshot({ path: path.join(evidence, `patch-pilot-${name}.jpg`), type: 'jpeg', quality: 80 });
      await page.close();
    }
    fs.writeFileSync(path.join(evidence, 'patch-pilot-test.log'), reports.map((r) => JSON.stringify(r)).join('\n') + '\n');
    console.log('PASS Patch.gg bus + animated pedestrian: both GPU scenarios completed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
