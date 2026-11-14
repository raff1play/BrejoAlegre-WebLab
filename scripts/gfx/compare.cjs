/* eslint-disable */
/**
 * GFX-001: side-by-side sheets from the real captures of scripts/gfx/capture.cjs
 * (same camera and virtual hour), plus a metrics table. Usage:
 *   node scripts/gfx/compare.cjs docs/evidence/gfx-001
 */
const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = process.argv[2];
const A = path.join(ROOT, 'antes'); const B = path.join(ROOT, 'depois'); const OUT = path.join(ROOT, 'comparacao');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1320, height: 440 } })).newPage();
  const img = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;
  const names = fs.readdirSync(A).filter((f) => f.endsWith('.jpg')).map((f) => f.replace(/^antes-/, ''));
  let done = 0;
  for (const n of names) {
    const a = path.join(A, `antes-${n}`); const b = path.join(B, `depois-${n}`);
    if (!fs.existsSync(b)) continue;
    await page.setContent(`<body style="margin:0;background:#101820;color:#fff;font:600 15px sans-serif"><div style="padding:8px 12px">${n.replace('.jpg', '')} — antes (base eb8d5c9) × depois (GFX-001) · captura real, mesma câmera e hora</div><div style="display:flex;gap:8px;padding:0 8px 8px"><img src="${img(a)}" style="width:648px"><img src="${img(b)}" style="width:648px"></div></body>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, n), type: 'jpeg', quality: 86, fullPage: true });
    done++;
  }
  await browser.close();
  // Metrics table.
  const ma = JSON.parse(fs.readFileSync(path.join(A, 'antes-metrics.json'), 'utf8')); const mb = JSON.parse(fs.readFileSync(path.join(B, 'depois-metrics.json'), 'utf8'));
  let md = '| Cena | Malhas ativas | Triângulos | Draw calls | Texturas | Memória JS (MB) |\n|---|---|---|---|---|---|\n';
  for (const k of Object.keys(ma)) {
    if (k.endsWith(':load') || !mb[k]) continue;
    const x = ma[k]; const y = mb[k];
    md += `| ${k} | ${x.activeMeshes} → ${y.activeMeshes} | ${x.triangles} → ${y.triangles} | ${x.perf?.drawCalls ?? '—'} → ${y.perf?.drawCalls ?? '—'} | ${x.textures} → ${y.textures} | ${x.perf?.memoryMb ?? '—'} → ${y.perf?.memoryMb ?? '—'} |\n`;
  }
  fs.writeFileSync(path.join(OUT, 'metricas.md'), md);
  console.log(done, 'pranchas'); console.log(md);
})().catch((e) => { console.error(e); process.exit(1); });
