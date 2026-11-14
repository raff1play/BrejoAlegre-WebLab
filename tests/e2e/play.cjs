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
    await page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 88 });
    if (options.shotSize) { await page.setViewportSize(play); await page.waitForTimeout(300); }
  };
  return { context, page, errors, snap, until, shot };
}

async function desktop(browser) {
  const g = await open(browser, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1, shotSize: { width: 1280, height: 720 } }, 'gfx=desktop&trafego=0');
  const { page, snap, until, shot } = g;
  const key = page.keyboard;
  let s = await snap();
  check('abre sem erro e inicia pilotando na vaga', g.errors.length === 0 && s.mode === 'riding' && s.moto.speed === 0, g.errors.join(' | '));
  const label = await page.textContent('.about-notice');
  check('aviso de área temporária visível na tela', /ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE/.test(label));
  await shot('01-inicio-estacionamento.jpg');

  // Accelerate inside the depot yard (CORE-014 bay, now on the real block) and brake.
  const start = s.moto;
  await key.down('KeyW');
  s = await until((v) => v.moto.speed > 3);
  await key.up('KeyW');
  check('moto acelera', s.moto.speed > 3 && Math.hypot(s.moto.x - start.x, s.moto.z - start.z) > 0.5, `v=${fx(s.moto.speed)} m/s`);
  await key.down('KeyS');
  s = await until((v) => v.moto.speed === 0);
  await key.up('KeyS');
  check('moto freia até parar', s.moto.speed === 0);

  // CORE-015: a straight approach to a real four-way junction (picked from the OSM network).
  const probe = await page.evaluate(() => window.__debug.probe());
  const J = probe.junction;
  await page.evaluate(([x, z, y]) => window.__debug.teleport(x, z, y), [J.startX, J.startZ, J.yaw]);
  s = await until((v) => Math.hypot(v.moto.x - J.startX, v.moto.z - J.startZ) < 0.5 && v.moto.y < 0.05, 8000);
  check('rua real: moto posicionada na faixa da via OSM', Math.hypot(s.moto.x - J.startX, s.moto.z - J.startZ) < 0.5 && s.moto.y < 0.05, `${J.road} (${fx(J.startX)}, ${fx(J.startZ)}) y=${fx(s.moto.y)}`);
  const yaw0 = s.moto.yaw;
  await key.down('KeyD');
  await page.waitForTimeout(600);
  s = await snap();
  await key.up('KeyD');
  check('guidão não gira a moto parada', Math.abs(s.moto.yaw - yaw0) < 1e-6);
  const toJ = (v) => Math.hypot(v.moto.x - J.x, v.moto.z - J.z);
  // Moderate speed (~15–20 km/h), as a rider would approach a corner; headless runs at ~2 FPS.
  let gas = false;
  for (const end = Date.now() + 60000; Date.now() < end;) {
    s = await snap();
    if (toJ(s) < 9) break;
    const want = s.moto.speed < (gas ? 5 : 3.5);
    if (want !== gas) { gas = want; await (want ? key.down('KeyW') : key.up('KeyW')); }
    await page.waitForTimeout(50);
  }
  if (gas) await key.up('KeyW');
  check('moto percorre a rua real até o cruzamento', toJ(s) < 9, `${fx(toJ(s))} m do cruzamento, v=${fx(s.moto.speed)}`);
  await shot('02-pilotando-rua.jpg');
  // Right turn at the junction (yaw grows clockwise seen from above: north → east).
  const wrap = (d) => ((d % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  await key.down('KeyD');
  let leaned = 0; let throttle = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    s = await snap();
    if (Math.abs(s.moto.lean) > Math.abs(leaned)) leaned = s.moto.lean;
    if (wrap(s.moto.yaw - yaw0) > 1.2 || s.moto.speed === 0) break;
    const want = s.moto.speed < 3;
    if (want !== throttle) { throttle = want; await (want ? key.down('KeyW') : key.up('KeyW')); }
    await page.waitForTimeout(50);
  }
  await key.up('KeyD');
  await key.down('KeyW');
  check('moto vira à direita em movimento', wrap(s.moto.yaw - yaw0) > 1, `yaw ${fx(yaw0)} → ${fx(s.moto.yaw)}`);
  check('inclinação visual moderada na curva', Math.abs(leaned) > 0.02 && Math.abs(leaned) < 0.45, `lean=${fx(leaned)} rad`);
  s = await until((v) => Math.hypot(v.moto.x - J.x, v.moto.z - J.z) > 14 || v.moto.speed === 0, 20000);
  await key.up('KeyW');
  const coasting = s.moto.speed;
  // Polls instead of a fixed wait: under software rendering a frame can take longer than 0.7 s.
  s = await until((v) => v.moto.speed < coasting, 5000);
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
  await shot('03-camera-proxima.jpg');
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
  await shot('04-camera-afastada.jpg');

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
    // Generous window: under software rendering a few frames per second cover little distance.
    s = await until((v) => dist(v) > before + 1.2 || dist(v) > 3, 12000);
    await key.up(candidate);
    if (dist(s) > before + 1.0) { awayKey = candidate; break; }
  }
  const walked = Math.hypot(s.walker.x - walk0.x, s.walker.z - walk0.z);
  check('personagem caminha', awayKey !== null && walked > 0.8, `${fx(walked)} m com ${awayKey}`);
  check('moto não se move enquanto a pé', s.moto.x === parked.x && s.moto.z === parked.z && s.moto.speed === 0);
  await shot('05-a-pe.jpg');
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

  // Collision (CORE-015): from the lane, ride straight into a real house lot (estimated lot on a
  // real block); the lot is solid, so the bike must stop at its front line, however long we push.
  const L = probe.lot;
  await page.evaluate(([x, z, y]) => window.__debug.teleport(x, z, y), [L.startX, L.startZ, L.yaw]);
  await until((v) => Math.hypot(v.moto.x - L.startX, v.moto.z - L.startZ) < 0.5, 5000);
  const depth = (v) => (v.moto.x - L.ox) * L.ix + (v.moto.z - L.oz) * L.iz;
  await key.down('KeyW');
  let maxDepth = -Infinity; let moved = false; let still = 0;
  // Push until the bike has been at rest for a while after moving (time-based: ~2 FPS headless).
  for (const end = Date.now() + 45000; Date.now() < end && still < 12;) {
    await page.waitForTimeout(150); s = await snap(); maxDepth = Math.max(maxDepth, depth(s));
    if (s.moto.speed > 0.5) moved = true;
    still = moved && Math.abs(s.moto.speed) < 0.05 ? still + 1 : 0;
  }
  await key.up('KeyW');
  check('moto chega ao muro do lote e não atravessa muros nem casas', maxDepth < 0.05 && maxDepth > -2.5,
    `profundidade máxima ${fx(maxDepth)} m além da divisa (lote ${L.id}; divisa em 0)`);
  check('moto sobe na calçada (meio-fio)', s.moto.y > 0.1, `y=${fx(s.moto.y)}`);
  await shot('06-colisao-muro.jpg');

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

  // CORE-014: one third-person camera (GTA/ISO toggle removed), pause screen with the notice.
  s = await until((v) => v.camera.radius <= 9, 8000);
  check('câmera única em terceira pessoa, enquadramento próximo', s.camera.mode === 'third-person' && s.camera.radius <= 9 && s.camera.radius > 0.5, `raio ${fx(s.camera.radius)}`);
  await key.press('KeyC');
  await page.waitForTimeout(600);
  check('tecla C não alterna mais a câmera', (await snap()).camera.mode === 'third-person');
  check('sem botão GTA/ISO no HUD', (await page.$('[data-action="camera-mode"]')) === null && (await page.$('.camera-bar')) === null);
  await key.press('KeyP');
  s = await until((v) => v.paused, 5000);
  const notice = await page.isVisible('.about-notice');
  check('pausa abre com aviso de releitura fictícia', s.paused && notice);
  const frozen = s.clock.hour;
  await page.waitForTimeout(1200);
  check('pausa congela o relógio', Math.abs((await snap()).clock.hour - frozen) < 1e-6);
  await key.press('KeyP');
  s = await until((v) => !v.paused, 5000);
  await shot('09-camera-terceira-pessoa-desktop.jpg');
  check('sem erros de console no desktop', g.errors.length === 0, g.errors.join(' | '));
  console.log(`   desktop headless: ${fx(s.fps)} FPS (GPU por software, não representa aparelho real)`);
  await g.context.close();
}

/** CORE-013/014: living city, clock, minimap and the first complete workday, in a fresh page. */
async function cityAndJob(browser) {
  const g = await open(browser, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1, shotSize: { width: 1280, height: 720 } }, 'gfx=desktop');
  const { page, snap, until, shot } = g;
  const key = page.keyboard;
  let s;
  // Workday first (from 11h, before the day/night jumps below).
  // CORE-014: first complete workday (debug helpers place the rider; the actions are the real ones).
  await page.evaluate(() => window.__debug.setHour(11.2));
  let d = (await snap()).delivery;
  check('jornada: 11h designa lojas e cria volumes rastreáveis', d.phase === 'COLETA' && d.assigned.length === 2 && d.parcels.length === 8 && new Set(d.parcels.map((q) => q.id)).size === 8,
    `${d.assigned.join(', ')} · ${d.addresses} endereços`);
  const first = d.stores.find((q) => q.id === d.assigned[0]);
  await page.evaluate(([x, z, y]) => window.__debug.placeWalker(x, z, y), [first.pickup.x, first.pickup.z, first.facing]);
  s = await until((v) => v.delivery.action !== null, 5000);
  check('loja: funcionário avisa que os volumes saem às 12h', /12h/.test(s.delivery.action ?? ''), s.delivery.action);
  await page.evaluate(() => window.__debug.wait());
  s = await until((v) => v.clock.speed > 1, 5000);
  check('aguardar acelera o relógio até 12h (escala 1 h = 4 min mantida)', s.clock.speed === 24 && s.delivery.waiting === 12, `×${s.clock.speed}`);
  await page.evaluate(() => window.__debug.setHour(12.05));
  s = await until((v) => v.clock.speed === 1, 5000);
  check('relógio volta à escala normal após a espera', s.clock.speed === 1 && s.delivery.waiting === null);
  // CORE-015.1 physical cargo: shop → hands → top box → base → sack → top box → gate.
  const cargo = async () => (await snap()).delivery.cargo;
  const act = () => page.evaluate(() => window.__debug.act());
  const walkTo = (x, z, yaw = 0) => page.evaluate(([a, b, c]) => window.__debug.placeWalker(a, b, c), [x, z, yaw]);
  const toTrunk = async () => { const c = await cargo(); await walkTo(c.trunkSpot.x, c.trunkSpot.z, 0); };
  const label = async (re, timeout = 8000) => (await until((v) => re.test(v.delivery.action ?? ''), timeout)).delivery.action;
  let n = 0;
  for (const id of d.assigned) {
    const st = d.stores.find((q) => q.id === id);
    await page.evaluate(([x, z]) => window.__debug.parkNear(x, z), [st.pickup.x, st.pickup.z]);
    await walkTo(st.pickup.x, st.pickup.z, st.facing);
    await label(/Retirar com/);
    await act();
    let c = await cargo();
    if (n === 0) {
      check('coleta: os volumes vão para as MÃOS (não para o baú)', c.hands === 2 && c.trunk === 0 && /2 volumes nas mãos/.test(c.label), c.label);
      s = await snap();
      check('objetivo manda guardar no baú da moto', /baú/i.test(s.delivery.objective.title) && s.delivery.objective.target.kind === 'moto', s.delivery.objective.title);
      // Camera behind the rider, facing the counter (the orbit is left where the last test put it).
      await page.evaluate((y) => window.__debug.camera(Math.atan2(-Math.cos(y), -Math.sin(y)), 1.12, 4.4), st.facing);
      await page.waitForTimeout(800);
      const chip = await page.textContent('#cargo-status');
      const hands = await page.isVisible('#cargo-status.hands'); const dist = await page.isVisible('#objective-distance');
      // The distance chip only shows beyond 12 m (the bike is parked right outside here).
      check('HUD: "2 volumes nas mãos" em destaque', /2 volumes nas mãos/.test(chip) && hands, `${chip} · destaque=${hands} · chip de distância visível=${dist}`);
      check('minimapa: moto marcada e rota até ela pelas ruas', s.minimap.bike && (s.minimap.route === 0 || s.minimap.routeLength >= s.minimap.distance - 0.01), `rota ${s.minimap.route} pontos`);
      await shot('11-loja-retirada.jpg');
    }
    await toTrunk();
    const l = await label(/Guardar no baú/);
    await act();
    s = await until((v) => v.delivery.cargo.trunkOpen > 0.3, 8000);
    c = s.delivery.cargo;
    n += 2;
    if (n === 2) {
      check('baú: "Guardar no baú" atrás da moto; volumes saem das mãos e a tampa abre', /Guardar no baú \(2\)/.test(l) && c.hands === 0 && c.trunk === 2 && c.trunkOpen > 0.3 && s.mode === 'walking', `${l} → ${c.label}, tampa ${fx(c.trunkOpen)}`);
      await shot('14-bau-guardando.jpg');
    }
  }
  d = (await snap()).delivery;
  check('coleta nas duas lojas: 4 volumes no baú, em transporte', d.phase === 'RETORNO' && d.cargo.trunk === 4 && d.cargo.hands === 0 && d.parcels.filter((q) => q.state === 'EM_TRANSPORTE' && q.place === 'bau' && q.holder === 'jogador').length === 4, d.cargo.label);
  // Base: park in the yard; the checker takes nothing while the volumes are still in the box.
  await page.evaluate(() => { const p = window.__debug.depot(84, -111); window.__debug.parkAt(p.x, p.z, window.__debug.depotYaw(0)); });
  const desk = await page.evaluate(() => ({ p: window.__debug.depot(95.4, -122.4), q: window.__debug.depot(95.4, -131), yaw: window.__debug.depotYaw(-Math.PI / 2) }));
  await walkTo(desk.p.x, desk.p.z, desk.yaw);
  const blocked = await label(/baú/i);
  await act();
  check('galpão: com os volumes no baú o conferente não recebe nada', /retire na moto/.test(blocked) && (await cargo()).trunk === 4 && (await snap()).delivery.phase === 'RETORNO', blocked);
  await toTrunk();
  const out = await label(/Retirar do baú/);
  await act();
  let c = await cargo();
  check('galpão: retirar do baú leva os 4 volumes às mãos', /\(4\)/.test(out) && c.hands === 4 && c.trunk === 0, c.label);
  await walkTo(desk.p.x, desk.p.z, desk.yaw);
  await label(/conferente/);
  await act();
  c = await cargo();
  check('galpão: conferente recebe os volumes das mãos', c.hands === 0 && c.trunk === 0 && (await snap()).delivery.parcels.filter((q) => q.place === 'galpao').length >= 4);
  await page.evaluate(() => window.__debug.setHour(13.95));
  s = await until((v) => v.delivery.parcels.every((q) => q.state === 'RECEBIDO_BASE'), 30000);
  check('galpão: conferente recebe volumes da loja e do caminhão', s.delivery.parcels.every((q) => q.state === 'RECEBIDO_BASE' && q.holder === 'conferente' && q.place === 'galpao'));
  await shot('12-galpao-conferencia.jpg');
  await page.evaluate(() => window.__debug.setHour(14.3));
  s = await until((v) => v.delivery.parcels.every((q) => q.state === 'NA_SACA'), 30000);
  check('triagem pelos separadores e saca pelo expedidor', s.delivery.parcels.every((q) => q.state === 'NA_SACA' && q.place === 'saca'), JSON.stringify(s.delivery.staff.map((x) => x.state)));
  await page.evaluate(() => window.__debug.setHour(15.05));
  await walkTo(desk.q.x, desk.q.z, desk.yaw);
  await label(/saca/);
  await act();
  s = await snap();
  check('saca mista retirada a partir das 15h: nas mãos, em rota', s.delivery.phase === 'ENTREGAS' && s.delivery.parcels.every((q) => q.state === 'EM_ROTA' && q.place === 'maos') && s.delivery.cargo.sack && s.delivery.objective.target.kind === 'moto', s.delivery.cargo.label);
  await toTrunk();
  await label(/Guardar a saca/);
  await act();
  c = await cargo();
  check('saca guardada no baú antes das entregas', c.hands === 0 && c.trunk === 8 && !c.sack, c.label);
  s = await until((v) => v.minimap.stops > 0 && v.minimap.route > 2, 8000);
  const straight = Math.hypot(s.delivery.objective.target.x - s.walker.x, s.delivery.objective.target.z - s.walker.z);
  check('minimapa: paradas de entrega e rota pelas ruas (mais longa que a linha reta)', s.minimap.stops === s.delivery.route.length && s.minimap.route > 2 && s.minimap.routeLength >= straight,
    `${s.minimap.stops} paradas, rota ${Math.round(s.minimap.routeLength)} m × reta ${Math.round(straight)} m`);
  check('HUD: "8 volumes no baú" e distância pela rota', /8 volumes no baú/.test(await page.textContent('#cargo-status')) && /(m|km)$/.test((await page.textContent('#objective-distance')).trim()), await page.textContent('#objective-distance'));
  for (let k = 0; k < 10 && (await snap()).delivery.route.length; k++) {
    const t = (await snap()).delivery.objective.target;
    await page.evaluate(([x, z]) => window.__debug.parkNear(x, z), [t.x, t.z]);
    if (k === 0) {
      // At the gate with the parcel still in the box: nothing is delivered.
      await walkTo(t.x, t.z, t.yaw ?? 0);
      const no = await label(/baú/i);
      await act();
      check('entrega recusada com o pacote dentro do baú', /retire na moto/.test(no) && (await cargo()).trunk === 8 && (await snap()).delivery.progress.delivered === 0, no);
    }
    await toTrunk();
    const take = await label(/Retirar pacote/);
    await act();
    c = await cargo();
    if (k === 0) {
      check('entrega: retirar do baú o pacote do endereço mais próximo', c.hands === 1 && c.trunk === 7, `${take} → ${c.label}`);
      await shot('15-bau-retirando-pacote.jpg');
    }
    await walkTo(t.x, t.z, t.yaw ?? 0);
    await label(/Entregar/);
    if (k === 0) { await page.evaluate((y) => window.__debug.camera(Math.atan2(-Math.cos(y), -Math.sin(y)), 1.12, 4.8), t.yaw ?? 0); await page.waitForTimeout(800); await shot('13-entrega-residencia.jpg'); }
    await act();
  }
  s = await snap();
  check('primeira jornada completa: 8/8 entregues, sem duplicar nem perder volumes',
    s.delivery.phase === 'CONCLUIDA' && s.delivery.parcels.length === 8 && new Set(s.delivery.parcels.map((q) => q.id)).size === 8
      && s.delivery.parcels.every((q) => q.state === 'ENTREGUE' && q.holder === 'destinatario' && q.place === 'destinatario') && s.delivery.cargo.hands === 0 && s.delivery.cargo.trunk === 0,
    JSON.stringify(s.delivery.progress));
  // CORE-013: living city, clock, day/night and minimap.
  s = await snap();
  check('cidade viva: veículos e pedestres ativos', s.city.vehicles >= 8 && s.city.pedestrians >= 15,
    `${s.city.vehicles} veículos ${JSON.stringify(s.city.byKind)}, ${s.city.pedestrians} pedestres`);
  const fp0 = s.city.fingerprint; const sig0 = JSON.stringify(s.city.signals);
  await page.waitForTimeout(4000);
  s = await snap();
  check('cidade viva: tráfego e pedestres se movem', s.city.fingerprint !== fp0 && s.city.moving > 0, `${s.city.moving} veículos em movimento`);
  void sig0;
  check('sem semáforos inventados (o OSM não mapeia nenhum na sede)', Object.keys(s.city.signals).length === 0, JSON.stringify(s.city.signals));
  check('relógio virtual no formato HH:MM e jornada 11h–21h ativa', /^\d\d:\d\d$/.test(s.clock.label) && s.clock.workday === (s.clock.hour >= 11 && s.clock.hour < 21), s.clock.label);
  const P = await page.evaluate(() => window.__debug.probe().junction);
  await page.evaluate(([x, z]) => window.__debug.placeWalker(x + 40, z, Math.PI / 2), [P.x, P.z]);
  await page.waitForTimeout(400);
  const arrow0 = (await snap()).minimap.arrow;
  await page.keyboard.press('KeyM');
  s = await until((q) => q.minimap.expanded);
  const arrowA = s.minimap.arrow;
  await page.evaluate(([x, z]) => window.__debug.placeWalker(x - 40, z, Math.PI / 2), [P.x, P.z]);
  // The expanded map shows the whole town (~1.6 km wide): 80 m west is ~5 % of its width.
  s = await until((q) => Math.abs(q.minimap.arrow.x - arrowA.x) > 0.03, 5000);
  check('minimapa ampliado acompanha o jogador', s.minimap.expanded && s.minimap.arrow.x < arrowA.x - 0.03 && arrow0.x === 0.5,
    `x ${fx(arrowA.x)} → ${fx(s.minimap.arrow.x)} (fração da largura)`);
  await page.keyboard.press('KeyM');
  for (const [hour, expectNight] of [[7, false], [12, false], [18.4, false], [21.5, true]]) {
    await page.evaluate((h) => window.__debug.setHour(h), hour);
    s = await until((q) => Math.abs(q.clock.hour - hour) < 0.2 && (q.clock.night > 0.5) === expectNight, 5000);
    check(`controle de hora (dev): ${hour}h ${expectNight ? 'noite' : 'dia'}`, (s.clock.night > 0.5) === expectNight, `${s.clock.label} noite=${fx(s.clock.night)}`);
  }
  await shot('core013-noite.jpg');
  await page.evaluate(() => window.__debug.setHour(12));
  check('sem erros de console na cidade/jornada', g.errors.length === 0, g.errors.join(' | '));
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
    const buttons = [...document.querySelectorAll('.pad button, .pause-button')].map(rect);
    for (const [sel, id] of [['.objective', 'objetivo'], ['.telemetry', 'relogio-velocidade']]) { const r = rect(document.querySelector(sel)); r.id = id; buttons.push(r); }
    const stick = rect(document.querySelector('#movement-stick'));
    stick.id = 'stick';
    buttons.push(stick);
    // CORE-013: the minimap must not cover the analog, the throttle pad or the camera bar.
    const map = rect(document.querySelector('#minimap'));
    map.id = 'minimap';
    buttons.push(map);
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const collisions = [];
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) if (overlap(buttons[i], buttons[j])) collisions.push(`${buttons[i].id}/${buttons[j].id}`);
    const inside = buttons.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= innerWidth && b.y + b.h <= innerHeight);
    const centre = { x: innerWidth * 0.3, y: innerHeight * 0.25, w: innerWidth * 0.4, h: innerHeight * 0.5 };
    const panels = [...document.querySelectorAll('.objective, .telemetry, .minimap, .pad, .joystick-zone')].map(rect);
    return { buttons, collisions, inside, centreFree: !panels.some((p) => overlap(p, centre)), portrait: getComputedStyle(document.querySelector('.portrait-warning')).display };
  });
  const smallest = Math.min(...layout.buttons.filter((b) => !['minimap', 'objetivo', 'relogio-velocidade'].includes(b.id)).map((b) => Math.min(b.w, b.h)));
  check('[toque] botões com tamanho para dedos (≥ 44 px)', smallest >= 44, `menor lado ${fx(smallest)} px`);
  check('[toque] botões dentro da tela e sem sobreposição', layout.inside && layout.collisions.length === 0, layout.collisions.join(','));
  check('[toque] HUD deixa o centro da tela livre', layout.centreFree && layout.portrait === 'none', JSON.stringify(layout.buttons.filter((b) => b.id === 'objetivo')));
  // Expanded map on the phone: legend readable, map at least 60 % of the screen height.
  const mm = centreOfEl => page.$eval(centreOfEl, (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
  const small = await mm('#minimap');
  await page.touchscreen.tap(small.x, small.y);
  await until((v) => v.minimap.expanded, 5000);
  const big = await mm('#minimap-canvas');
  const legend = await page.$$eval('.minimap-legend li', (els) => els.filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.textContent.trim()));
  const fits = await page.$eval('#minimap', (el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
  check('[toque] mapa ampliado: cabe na tela, mapa grande e legenda com moto/galpão/lojas/entregas', fits && big.h >= 360 * 0.6 && ['Você', 'Objetivo', 'Rota pelas ruas', 'Moto', 'Galpão', 'Lojas', 'Entregas'].every((t) => legend.some((l) => l.includes(t))) && (await snap()).minimap.names >= 10,
    `mapa ${Math.round(big.w)}×${Math.round(big.h)} px, ${legend.length} itens, ${(await snap()).minimap.names} nomes de rua, cabe=${fits}`);
  await shot('16-mapa-ampliado-celular.jpg');
  const bigBox = await mm('#minimap');
  await page.touchscreen.tap(bigBox.x, bigBox.y);
  await until((v) => !v.minimap.expanded, 5000);

  // Real multi-touch through the DevTools protocol: one finger per button.
  const cdp = await g.context.newCDPSession(page);
  const centreOf = (id) => { const b = layout.buttons.find((v) => v.id === id); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };
  const fingers = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...fingers.values()] });
  // CDP models every finger in one event stream: adding a finger is a touchStart with all points.
  const press = async (id, control) => { fingers.set(id, { ...centreOf(control), id }); await send('touchStart'); };
  const lift = async (id) => { fingers.delete(id); await send('touchEnd'); };
  const tiltStick = async (id, dx, dy) => {
    const point = centreOf('stick');
    fingers.set(id, { x: point.x + dx, y: point.y + dy, id });
    await send('touchMove');
  };

  await press(1, 'accelerate');
  s = await until((v) => v.moto.speed > 2.5);
  check('[toque] botão acelerar move a moto', s.moto.speed > 2.5, `v=${fx(s.moto.speed)}`);
  const pressed = await page.evaluate(() => document.querySelector('[data-control="accelerate"]').classList.contains('active'));
  check('[toque] botão mostra estado pressionado', pressed);
  const yaw0 = s.moto.yaw;
  await press(2, 'stick');
  await tiltStick(2, 38, 0);
  s = await until((v) => v.moto.yaw > yaw0 + 0.25, 15000);
  check('[toque] dois dedos: acelerar + virar ao mesmo tempo', s.moto.yaw > yaw0 + 0.25 && s.moto.speed > 1, `Δyaw=${fx(s.moto.yaw - yaw0)}`);
  await shot('07-celular-emulado-pilotando.jpg');
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

  // Camera: one-finger drag on the scene orbits, pinch zooms (no camera buttons since CORE-014).
  const cam0 = (await snap()).camera;
  fingers.set(6, { x: 390, y: 150, id: 6 }); await send('touchStart');
  for (let i = 1; i <= 6; i++) { fingers.set(6, { x: 390 + i * 30, y: 150, id: 6 }); await send('touchMove'); await page.waitForTimeout(40); }
  fingers.clear(); await send('touchEnd');
  s = await until((v) => Math.abs(v.camera.alpha - cam0.alpha) > 0.3, 15000);
  check('[toque] arrastar na cena gira a câmera', Math.abs(s.camera.alpha - cam0.alpha) > 0.3, `Δalpha=${fx(s.camera.alpha - cam0.alpha)}`);
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
  await press(10, 'stick');
  await tiltStick(10, -35, 0);
  s = await until((v) => Math.hypot(v.walker.x - w0.x, v.walker.z - w0.z) > 0.8, 20000);
  await lift(10);
  check('[toque] personagem anda pelo analógico', Math.hypot(s.walker.x - w0.x, s.walker.z - w0.z) > 0.5 && s.moto.speed === 0);
  await shot('08-celular-emulado-a-pe.jpg');
  await press(11, 'stick');
  await tiltStick(11, 35, 0);
  await until((v) => Math.hypot(v.walker.x - v.moto.x, v.walker.z - v.moto.z) < 1.6, 20000);
  await lift(11);
  await page.touchscreen.tap(centreOf('mount').x, centreOf('mount').y);
  s = await snap();
  check('[toque] botão Montar funciona perto da moto', s.mode === 'riding');

  // Pause button opens and closes the pause screen.
  const pauseBtn = await page.$eval('.pause-button', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(pauseBtn.x, pauseBtn.y);
  s = await until((v) => v.paused, 5000);
  check('[toque] botão de pausa abre a tela de pausa', s.paused);
  await shot('10-pausa-celular-emulado.jpg');
  const resume = await page.$eval('.pause-actions .primary', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(resume.x, resume.y);
  s = await until((v) => !v.paused, 5000);
  check('[toque] Continuar fecha a pausa', !s.paused);
  check('[toque] sem erros de console', g.errors.length === 0, g.errors.join(' | '));
  console.log(`   celular emulado headless: ${fx(s.fps)} FPS em ${s.renderSize.join('x')} (GPU por software; NÃO é medição em Android)`);
  await g.context.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    // WEBLAB_ONLY=desktop,city,phone runs a subset while iterating (default: everything).
    const only = (process.env.WEBLAB_ONLY || 'desktop,city,phone').split(',');
    if (only.includes('desktop')) await desktop(browser);
    if (only.includes('city')) await cityAndJob(browser);
    if (only.includes('phone')) await phone(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
