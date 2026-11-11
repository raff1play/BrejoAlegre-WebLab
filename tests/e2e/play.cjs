/* eslint-disable */
/**
 * Browser play-through: opens the REAL game in Chromium, plays it with keyboard, mouse and
 * multi-touch, asserts what happened via the read-only `window.__weblab.snapshot()` probe and saves
 * genuine screenshots. It needs Playwright with a Chromium build available in the environment
 * (it is deliberately not a project dependency) and a running server:
 *
 *   npm run build:staging && npm run preview        # or: npm run dev
 *   WEBLAB_URL=http://localhost:4173 npm run test:e2e
 *
 * Headless Chromium renders with a software GPU, so FPS printed here says nothing about phones.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL_BASE = process.env.WEBLAB_URL || 'http://localhost:5173';
const OUT = process.env.WEBLAB_SHOTS || path.join(__dirname, '..', '..', 'docs', 'evidence');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const fx = (n) => Number(n.toFixed(2));

async function open(browser, options, query) {
  const { shotSize, ...contextOptions } = options;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${URL_BASE}/?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__weblab, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const snap = () => page.evaluate(() => window.__weblab.snapshot());
  /** Polls the game state until `predicate` holds; returns the last snapshot. */
  const until = async (predicate, timeout = 40000) => {
    const deadline = Date.now() + timeout;
    let s = await snap();
    while (!predicate(s) && Date.now() < deadline) { await page.waitForTimeout(50); s = await snap(); }
    return s;
  };
  /** Screenshots are taken at `shotSize` when given, so play can run in a small, faster viewport. */
  const shot = async (name) => {
    const play = page.viewportSize();
    if (options.shotSize) { await page.setViewportSize(options.shotSize); await page.waitForTimeout(1200); }
    await page.screenshot({ path: path.join(OUT, name) });
    if (options.shotSize) { await page.setViewportSize(play); await page.waitForTimeout(300); }
  };
  return { context, page, errors, snap, until, shot };
}

async function desktop(browser) {
  const g = await open(browser, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1, shotSize: { width: 1280, height: 720 } }, 'gfx=desktop');
  const { page, snap, until, shot } = g;
  const key = page.keyboard;
  let s = await snap();
  check('abre sem erro e inicia pilotando na vaga', g.errors.length === 0 && s.mode === 'riding' && s.moto.speed === 0, g.errors.join(' | '));
  const label = await page.textContent('.prototype-label');
  check('aviso de área temporária visível na tela', /ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE/.test(label));
  await shot('01-inicio-estacionamento.png');

  // Accelerate out of the bay (heading west) and check that speed builds up progressively.
  const start = s.moto;
  await key.down('KeyW');
  s = await until((v) => v.moto.speed > 3);
  check('moto acelera', s.moto.speed > 3 && s.moto.x < start.x, `v=${fx(s.moto.speed)} m/s`);
  s = await until((v) => v.moto.x < 3.2);
  await key.up('KeyW');
  // Brake to a full stop on the main street.
  await key.down('KeyS');
  s = await until((v) => v.moto.speed === 0);
  await key.up('KeyS');
  check('moto freia até parar', s.moto.speed === 0, `x=${fx(s.moto.x)}`);
  check('moto desceu o meio-fio para a rua', s.moto.y < 0.05, `y=${fx(s.moto.y)}`);

  // Turn right (north) while moving; steering must do nothing at rest.
  const yaw0 = s.moto.yaw;
  await key.down('KeyD');
  await page.waitForTimeout(600);
  s = await snap();
  check('guidão não gira a moto parada', Math.abs(s.moto.yaw - yaw0) < 1e-6);
  await key.down('KeyW');
  s = await until((v) => v.moto.yaw > -0.12 || v.moto.speed === 0 && v.moto.yaw > yaw0 + 0.5, 30000);
  await key.up('KeyD');
  const leaned = s.moto.lean;
  check('moto vira à direita em movimento', s.moto.yaw > yaw0 + 1, `yaw ${fx(yaw0)} → ${fx(s.moto.yaw)}`);
  check('inclinação visual moderada na curva', Math.abs(leaned) > 0.02 && Math.abs(leaned) < 0.45, `lean=${fx(leaned)} rad`);
  // Ride north along the houses, keeping near the lane with small corrections.
  s = await until((v) => v.moto.z > -4 || v.moto.speed === 0, 30000);
  await shot('02-pilotando-rua.png');
  s = await until((v) => v.moto.z > 12 || v.moto.speed === 0, 30000);
  await key.up('KeyW');
  check('moto percorre a rua', s.moto.z > 5, `z=${fx(s.moto.z)}, v=${fx(s.moto.speed)}`);
  const coasting = s.moto.speed;
  await page.waitForTimeout(700);
  s = await snap();
  check('moto desacelera sozinha sem acelerador', s.moto.speed < coasting && s.moto.speed >= 0, `${fx(coasting)} → ${fx(s.moto.speed)}`);

  // Dismount is refused while moving.
  if (s.moto.speed > 0.5) {
    await key.press('KeyF');
    s = await snap();
    check('não desce com a moto em movimento', s.mode === 'riding');
  }
  await key.down('KeyS');
  s = await until((v) => v.moto.speed === 0);
  await key.up('KeyS');

  // Camera: rotate, zoom in, zoom out, drag.
  const cam0 = s.camera;
  await key.down('KeyE');
  s = await until((v) => Math.abs(v.camera.alpha - cam0.alpha) > 0.4, 20000);
  await key.up('KeyE');
  check('câmera gira (teclado)', Math.abs(s.camera.alpha - cam0.alpha) > 0.3, `Δalpha=${fx(s.camera.alpha - cam0.alpha)}`);
  await key.down('KeyZ');
  await until((v) => v.camera.radius < cam0.radius - 5, 20000);
  await key.up('KeyZ');
  const near = (await snap()).camera.radius;
  check('câmera aproxima', near < cam0.radius - 2, `raio ${fx(cam0.radius)} → ${fx(near)}`);
  await shot('03-camera-proxima.png');
  await page.mouse.move(320, 150);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  const far = (await until((v) => v.camera.radius > near + 6, 15000)).camera.radius;
  check('câmera afasta (roda do mouse)', far > near + 4, `raio ${fx(near)} → ${fx(far)}`);
  const alphaBeforeDrag = (await snap()).camera.alpha;
  await page.mouse.move(250, 150);
  await page.mouse.down();
  await page.mouse.move(400, 150, { steps: 8 });
  await page.mouse.up();
  s = await until((v) => Math.abs(v.camera.alpha - alphaBeforeDrag) > 0.5, 15000);
  check('câmera gira arrastando na cena', Math.abs(s.camera.alpha - alphaBeforeDrag) > 0.5);
  s = await until((v) => Math.hypot(v.camera.target[0] - v.moto.x, v.camera.target[2] - v.moto.z) < 0.3, 15000);
  check('câmera acompanha a moto', Math.hypot(s.camera.target[0] - s.moto.x, s.camera.target[2] - s.moto.z) < 1.5);
  await shot('04-camera-afastada.png');

  // Dismount, walk, try to drive (must not move the bike), come back and mount.
  await key.press('KeyF');
  s = await snap();
  check('desce com a moto parada', s.mode === 'walking');
  const parked = s.moto;
  const walk0 = s.walker;
  const dist = (v) => Math.hypot(v.walker.x - v.moto.x, v.walker.z - v.moto.z);
  // Movement is camera-relative, so find which key leads away from the bike (the bike itself is solid).
  const opposite = { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA' };
  let awayKey = null;
  for (const candidate of Object.keys(opposite)) {
    const before = dist(await snap());
    await key.down(candidate);
    s = await until((v) => dist(v) > before + 1.2 || dist(v) > 3, 4000);
    await key.up(candidate);
    if (dist(s) > before + 1.0) { awayKey = candidate; break; }
  }
  const walked = Math.hypot(s.walker.x - walk0.x, s.walker.z - walk0.z);
  check('personagem caminha', awayKey !== null && walked > 0.8, `${fx(walked)} m com ${awayKey}`);
  check('moto não se move enquanto a pé', s.moto.x === parked.x && s.moto.z === parked.z && s.moto.speed === 0);
  await shot('05-a-pe.png');
  // Farther away, mounting must be refused.
  await key.down(awayKey || 'KeyW');
  s = await until((v) => dist(v) > 3.2, 12000);
  await key.up(awayKey || 'KeyW');
  await key.press('KeyF');
  s = await snap();
  if (dist(s) > 2.3) check('não monta longe da moto', s.mode === 'walking', `${fx(dist(s))} m`);
  // Walk back the way we came until within reach, then mount.
  await key.down(opposite[awayKey || 'KeyW']);
  s = await until((v) => dist(v) < 1.6, 25000);
  await key.up(opposite[awayKey || 'KeyW']);
  await page.waitForTimeout(600);
  s = await snap();
  check('personagem não atravessa a moto estacionada', dist(s) > 0.5, `distância ${fx(dist(s))} m`);
  await key.press('KeyF');
  s = await snap();
  check('monta novamente perto da moto', s.mode === 'riding', `distância ${fx(dist(s))} m`);

  // Collision: steer into the walled lots on the east side with the throttle held; the bike must
  // never get past the wall line (x = 6.2), however long we push.
  await key.down('KeyD');
  await key.down('KeyW');
  const facingEast = (v) => Math.abs(((v.moto.yaw - Math.PI / 2) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.3;
  s = await until(facingEast, 40000);
  await key.up('KeyD');
  s = await until((v) => v.moto.x > 4.4 || v.moto.speed === 0, 30000);
  let maxX = s.moto.x;
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); s = await snap(); maxX = Math.max(maxX, s.moto.x + 0); }
  await key.up('KeyW');
  check('moto chega ao muro e não atravessa muros nem casas', maxX > 4.4 && maxX < 5.9, `x máximo ${fx(maxX)}; face do muro em x=6.2`);
  check('moto sobe na calçada (meio-fio)', s.moto.y > 0.1 || maxX < 4.6, `y=${fx(s.moto.y)}`);
  await shot('06-colisao-muro.png');

  // Lost focus must release every held control: hold reverse, blur, and the bike must settle.
  await key.down('KeyS');
  s = await until((v) => v.moto.speed === 0, 10000);
  await key.up('KeyS');
  await page.waitForTimeout(400);
  await key.down('KeyS');
  s = await until((v) => v.moto.speed < -0.5, 15000);
  check('ré lenta ao frear parado', s.moto.speed < -0.5 && s.moto.speed >= -1.81, `v=${fx(s.moto.speed)}`);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  s = await until((v) => v.moto.speed === 0, 25000);
  await key.up('KeyS');
  check('perda de foco solta as teclas', s.moto.speed === 0);

  // Resize to a narrow landscape window.
  await page.setViewportSize({ width: 900, height: 420 });
  s = await until((v) => v.renderSize[0] === 900, 8000);
  check('redimensiona o canvas com a janela', s.renderSize[0] === 900 && s.renderSize[1] === 420, s.renderSize.join('x'));
  check('sem erros de console no desktop', g.errors.length === 0, g.errors.join(' | '));
  console.log(`   desktop headless: ${fx(s.fps)} FPS (GPU por software, não representa aparelho real)`);
  await g.context.close();
}

async function phone(browser) {
  // Landscape phone, roughly a Galaxy S24 viewport. Emulation only: it is NOT a test on Android.
  const g = await open(browser, {
    viewport: { width: 780, height: 360 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  }, '');
  const { page, snap, until, shot } = g;
  let s = await snap();
  check('[toque] perfil gráfico móvel escolhido automaticamente', s.graphics === 'mobile', `render ${s.renderSize.join('x')}`);

  const layout = await page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, id: el.dataset.control || el.dataset.action }; };
    const buttons = [...document.querySelectorAll('.pad button, .camera-bar button')].map(rect);
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const collisions = [];
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) if (overlap(buttons[i], buttons[j])) collisions.push(`${buttons[i].id}/${buttons[j].id}`);
    const inside = buttons.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= innerWidth && b.y + b.h <= innerHeight);
    const centre = { x: innerWidth * 0.3, y: innerHeight * 0.25, w: innerWidth * 0.4, h: innerHeight * 0.5 };
    const panels = [...document.querySelectorAll('.brand, .telemetry, .status-panel, .pad, .camera-bar')].map(rect);
    return { buttons, collisions, inside, centreFree: !panels.some((p) => overlap(p, centre)), portrait: getComputedStyle(document.querySelector('.portrait-warning')).display };
  });
  const smallest = Math.min(...layout.buttons.map((b) => Math.min(b.w, b.h)));
  check('[toque] botões com tamanho para dedos (≥ 44 px)', smallest >= 44, `menor lado ${fx(smallest)} px`);
  check('[toque] botões dentro da tela e sem sobreposição', layout.inside && layout.collisions.length === 0, layout.collisions.join(','));
  check('[toque] HUD deixa o centro da tela livre', layout.centreFree && layout.portrait === 'none');

  // Real multi-touch through the DevTools protocol: one finger per button.
  const cdp = await g.context.newCDPSession(page);
  const centreOf = (id) => { const b = layout.buttons.find((v) => v.id === id); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };
  const fingers = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...fingers.values()] });
  // CDP models every finger in one event stream: adding a finger is a touchStart with all points.
  const press = async (id, control) => { fingers.set(id, { ...centreOf(control), id }); await send('touchStart'); };
  const lift = async (id) => { fingers.delete(id); await send('touchEnd'); };

  await press(1, 'accelerate');
  s = await until((v) => v.moto.speed > 2.5);
  check('[toque] botão acelerar move a moto', s.moto.speed > 2.5, `v=${fx(s.moto.speed)}`);
  const pressed = await page.evaluate(() => document.querySelector('[data-control="accelerate"]').classList.contains('active'));
  check('[toque] botão mostra estado pressionado', pressed);
  const yaw0 = s.moto.yaw;
  await press(2, 'right');
  s = await until((v) => v.moto.yaw > yaw0 + 0.25, 15000);
  check('[toque] dois dedos: acelerar + virar ao mesmo tempo', s.moto.yaw > yaw0 + 0.25 && s.moto.speed > 1, `Δyaw=${fx(s.moto.yaw - yaw0)}`);
  await shot('07-celular-emulado-pilotando.png');
  await lift(2);
  await lift(1);
  await page.waitForTimeout(300);
  const stuck = await page.evaluate(() => [...document.querySelectorAll('[data-control].active')].length);
  const v1 = (await snap()).moto;
  await page.waitForTimeout(900);
  const v2 = (await snap()).moto;
  check('[toque] soltar os dedos não deixa comando preso', stuck === 0 && v2.speed < v1.speed && Math.abs(v2.yaw - v1.yaw) < 0.15, `v ${fx(v1.speed)} → ${fx(v2.speed)}`);

  await press(3, 'brake');
  s = await until((v) => v.moto.speed === 0, 15000);
  await lift(3);
  check('[toque] botão frear para a moto', s.moto.speed === 0);

  // A cancelled touch (system gesture, call...) must also release the control.
  await press(4, 'accelerate');
  await until((v) => v.moto.speed > 1);
  fingers.clear();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(400);
  const afterCancel = await page.evaluate(() => [...document.querySelectorAll('[data-control].active')].length);
  check('[toque] toque cancelado solta o comando', afterCancel === 0);
  await press(5, 'brake');
  await until((v) => v.moto.speed === 0, 15000);
  await lift(5);

  // Camera buttons and pinch.
  const cam0 = (await snap()).camera;
  await press(6, 'camera-right');
  await until((v) => Math.abs(v.camera.alpha - cam0.alpha) > 0.35, 20000);
  await lift(6);
  await press(7, 'zoom-in');
  s = await until((v) => v.camera.radius < cam0.radius - 2, 20000);
  await lift(7);
  check('[toque] botões de câmera giram e aproximam', Math.abs(s.camera.alpha - cam0.alpha) > 0.3 && s.camera.radius < cam0.radius - 1.5);
  const r0 = s.camera.radius;
  const pinch = async (spread) => {
    fingers.set(8, { x: 390 - spread, y: 150, id: 8 });
    fingers.set(9, { x: 390 + spread, y: 150, id: 9 });
  };
  await pinch(120); await send('touchStart');
  for (const spread of [100, 80, 60, 45, 30]) { await pinch(spread); await send('touchMove'); await page.waitForTimeout(40); }
  fingers.clear(); await send('touchEnd');
  s = await until((v) => v.camera.radius > r0 + 2, 15000);
  check('[toque] pinça afasta a câmera', s.camera.radius > r0 + 2, `raio ${fx(r0)} → ${fx(s.camera.radius)}`);

  // Dismount / walk / mount with the touch buttons.
  await page.touchscreen.tap(centreOf('mount').x, centreOf('mount').y);
  s = await snap();
  check('[toque] botão Descer funciona parado', s.mode === 'walking');
  const w0 = s.walker;
  await press(10, 'left');
  s = await until((v) => Math.hypot(v.walker.x - w0.x, v.walker.z - w0.z) > 0.8, 20000);
  await lift(10);
  check('[toque] personagem anda pelos botões', Math.hypot(s.walker.x - w0.x, s.walker.z - w0.z) > 0.5 && s.moto.speed === 0);
  await shot('08-celular-emulado-a-pe.png');
  await press(11, 'right');
  await until((v) => Math.hypot(v.walker.x - v.moto.x, v.walker.z - v.moto.z) < 1.6, 20000);
  await lift(11);
  await page.touchscreen.tap(centreOf('mount').x, centreOf('mount').y);
  s = await snap();
  check('[toque] botão Montar funciona perto da moto', s.mode === 'riding');
  check('[toque] sem erros de console', g.errors.length === 0, g.errors.join(' | '));
  console.log(`   celular emulado headless: ${fx(s.fps)} FPS em ${s.renderSize.join('x')} (GPU por software; NÃO é medição em Android)`);
  await g.context.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    await desktop(browser);
    await phone(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
