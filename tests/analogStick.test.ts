import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STICK_TUNING, ZERO_STICK, blendAxis, followCenter, motoTurnFraction, steerForTurn, stickAxes,
} from '../src/core/analogStick.ts';
import { MOTO, createMotoState, stepMotorcycle } from '../src/core/motorcyclePhysics.ts';

const near = (actual: number, expected: number, eps = 0.00001) => assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);

test('center and small finger jitter do not move player or motorcycle', () => {
  assert.deepEqual(stickAxes(0, 0, 60), ZERO_STICK);
  assert.deepEqual(stickAxes(3, 2, 60), ZERO_STICK);
  // Riding: a couple of pixels of tremor around the centre gives no steering at all.
  for (const px of [-2.5, -1, 0, 1, 2.5]) near(motoTurnFraction(px / 45), 0);
});

test('horizontal thumb displacement steers proportionally, including both directions', () => {
  const left = stickAxes(-30, 0, 60);
  const right = stickAxes(30, 0, 60);
  assert.ok(left.x < -0.3 && left.x > -0.6);
  near(right.x, -left.x);
  near(left.y, 0);
});

test('vertical thumb movement is forward when up, backward when down', () => {
  near(stickAxes(0, -60, 60).y, 1);
  near(stickAxes(0, 60, 60).y, -1);
});

test('diagonal stick preserves 360-degree direction and caps magnitude at one', () => {
  const diagonal = stickAxes(30, -30, 60);
  near(diagonal.x, diagonal.y);
  assert.ok(diagonal.x > 0 && diagonal.y > 0);
  assert.ok(Math.hypot(diagonal.x, diagonal.y) < 1);
  const outside = stickAxes(200, -200, 60);
  near(Math.hypot(outside.x, outside.y), 1);
});

test('out-of-range, non-finite and invalid radius input cannot produce NaN', () => {
  assert.deepEqual(stickAxes(Number.NaN, 1, 60), ZERO_STICK);
  assert.deepEqual(stickAxes(1, Number.POSITIVE_INFINITY, 60), ZERO_STICK);
  assert.deepEqual(stickAxes(20, 30, 0), ZERO_STICK);
  assert.deepEqual(stickAxes(20, 30, -1), ZERO_STICK);
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    near(motoTurnFraction(bad), 0);
    near(steerForTurn(bad, 5), 0);
    assert.ok(Number.isFinite(steerForTurn(0.5, bad)));
  }
});

test('analog and keyboard inputs combine without exceeding physical ranges', () => {
  near(blendAxis(1, 0.8), 1);
  near(blendAxis(-1, -0.7), -1);
  near(blendAxis(0, 0.4), 0.4);
  near(blendAxis(-1, 0.4), -0.6);
});

test('CTRL-001 riding curve: progressive, symmetric, saturating, axial dead zone', () => {
  near(motoTurnFraction(0), 0);
  near(motoTurnFraction(STICK_TUNING.motoDeadzone), 0);
  let previous = 0;
  for (let x = 0.07; x <= 1; x += 0.01) {
    const f = motoTurnFraction(x);
    assert.ok(f >= previous - 1e-12, `monotonic at ${x.toFixed(2)}`);
    near(motoTurnFraction(-x), -f);
    previous = f;
  }
  assert.ok(motoTurnFraction(0.25) > 0.5, 'a short thumb move already turns meaningfully');
  assert.ok(motoTurnFraction(0.5) > 0.88, 'half deflection asks for most of the available turn');
  // Calmer at speed, never weaker than the low-speed curve's shape at full deflection.
  assert.ok(motoTurnFraction(0.25, 40 / 3.6) < motoTurnFraction(0.25, 10 / 3.6));
  near(motoTurnFraction(1, 40 / 3.6), 1);
  near(motoTurnFraction(STICK_TUNING.motoSaturation), 1);
  near(motoTurnFraction(1), 1);
  near(motoTurnFraction(5), 1);
  // Response just outside the dead zone is gentle: no jump from 0 (smooth, no tremor).
  assert.ok(motoTurnFraction(STICK_TUNING.motoDeadzone + 0.01) < 0.05);
});

test('steerForTurn never exceeds the steering range and keeps full input = full lock at rest', () => {
  for (const v of [0, 0.2, 1, 2.78, 6.94, 11.1, MOTO.maxSpeed, -MOTO.reverseSpeed]) {
    for (const f of [-1, -0.5, 0, 0.3, 1]) {
      const s = steerForTurn(f, v);
      assert.ok(Number.isFinite(s) && Math.abs(s) <= 1 + 1e-12, `${f} @ ${v}`);
      assert.equal(Math.sign(s), Math.sign(f));
    }
  }
  near(steerForTurn(1, 0), 1);
  near(steerForTurn(-1, 1), -1);
});

/** Yaw rate (deg/s) the real physics produces at `kmh` with a held steering command. */
function yawRate(kmh: number, command: number): number {
  const s = createMotoState(0, 0, 0);
  s.speed = kmh / 3.6; s.steer = command;
  const free = () => true;
  const dt = 1 / 120; const steps = 12;
  for (let i = 0; i < steps; i++) stepMotorcycle(s, { throttle: 0, brake: 0, steer: command }, dt, free);
  return (s.yaw * 180) / Math.PI / (dt * steps);
}
/** CORE-015 chain, kept here only for the comparison: radial dead zone 0.12 + 1.18·x^0.7 curve. */
function legacyCommand(deflection: number): number {
  const x = stickAxes(deflection * 100, 0, 100).x;
  if (x === 0) return 0;
  return Math.sign(x) * Math.min(1, 1.18 * Math.pow(Math.abs(x), 0.7));
}
const newCommand = (deflection: number, kmh: number) => steerForTurn(motoTurnFraction(deflection, kmh / 3.6), kmh / 3.6);

test('CTRL-001 comparison old vs new at 10/25/40 km/h with 25/50/75 % deflection, both directions', () => {
  const rows: string[] = [];
  for (const kmh of [10, 25, 40]) {
    const maxOld = yawRate(kmh, 1);
    const maxNew = yawRate(kmh, newCommand(1, kmh));
    // Physics limits are untouched: full input turns exactly as hard as before (keyboard included).
    assert.ok(Math.abs(maxNew - maxOld) < 0.02 * maxOld + 0.01, `${kmh} km/h full lock ${maxNew} vs ${maxOld}`);
    for (const d of [0.25, 0.5, 0.75]) {
      const oldR = yawRate(kmh, legacyCommand(d));
      const newR = yawRate(kmh, newCommand(d, kmh));
      const newL = yawRate(kmh, newCommand(-d, kmh));
      near(newL, -newR, 1e-9);
      assert.ok(newR <= maxOld + 1e-6, 'never beyond the physical limit');
      rows.push(`${kmh} km/h ${Math.round(d * 100)}%: antes ${oldR.toFixed(1)}°/s (${Math.round((oldR / maxOld) * 100)}%) → agora ${newR.toFixed(1)}°/s (${Math.round((newR / maxOld) * 100)}%)`);
    }
  }
  console.log(['CTRL-001 taxa de guinada (mesma física, máx. por velocidade = 100%):', ...rows].join('\n  '));
  // Low speed: the same thumb move turns clearly more (lighter steering in manoeuvres).
  for (const d of [0.25, 0.5]) assert.ok(yawRate(10, newCommand(d, 10)) > yawRate(10, legacyCommand(d)) * 1.3, `10 km/h ${d}`);
  assert.ok(yawRate(10, newCommand(0.75, 10)) > yawRate(10, legacyCommand(0.75)));
  // Medium speed: at least as agile as before for a short move; half deflection ≈ the whole turn.
  assert.ok(yawRate(25, newCommand(0.25, 25)) >= yawRate(25, legacyCommand(0.25)));
  assert.ok(yawRate(25, newCommand(0.5, 25)) >= 0.88 * yawRate(25, 1));
  // High speed: a short thumb move no longer snaps to the grip limit (stable).
  assert.ok(yawRate(40, newCommand(0.25, 40)) < 0.75 * yawRate(40, legacyCommand(0.25)));
});

// CTRL-002: regression targets are the real CTRL-001 measurements from PR #8, before this
// user-requested calibration (10/25/40 km/h, 25% of thumb travel). No hardware claim.
test('CTRL-002 agile ride has clearly better response than approved CTRL-001 at 10/25/40 km/h', () => {
  const baseline = [
    { kmh: 10, oldYaw: 41.7, gain: 1.4 },
    { kmh: 25, oldYaw: 34.7, gain: 1.3 },
    { kmh: 40, oldYaw: 17.4, gain: 1.35 },
  ];
  for (const { kmh, oldYaw, gain } of baseline) {
    const newYaw = yawRate(kmh, newCommand(0.25, kmh));
    assert.ok(newYaw > oldYaw * gain, `${kmh} km/h: ${newYaw.toFixed(1)}°/s vs CTRL-001 ${oldYaw.toFixed(1)}°/s`);
    near(yawRate(kmh, newCommand(-0.25, kmh)), -newYaw, 1e-9);
    const full = yawRate(kmh, newCommand(1, kmh));
    assert.ok(newYaw <= full + 1e-9, 'short thumb motion never overdrives full steering');
    assert.ok(yawRate(kmh, newCommand(0.5, kmh)) >= full * 0.9, 'half thumb gives almost full turning authority');
  }
  // Still grip-limited at 40 km/h: steering gets lighter but cannot spin the bike at speed.
  assert.ok(yawRate(40, newCommand(1, 40)) < 60);
  near(motoTurnFraction(0.01, 10 / 3.6), 0);
});

test('CTRL-002 steering reaches useful input in one frame and returns promptly to neutral', () => {
  const s = createMotoState(0, 0, 0);
  s.speed = 10 / 3.6;
  const desired = newCommand(0.5, 10);
  stepMotorcycle(s, { throttle: 0, brake: 0, steer: desired }, 1 / 60, () => true);
  assert.ok(s.steer >= 0.14, `initial steering response ${s.steer}`);
  for (let i = 0; i < 6; i++) stepMotorcycle(s, { throttle: 0, brake: 0, steer: 0 }, 1 / 60, () => true);
  near(s.steer, 0);
});

test('floating stick: centre stays put inside the ring, follows past it, limited travel', () => {
  const origin = { x: 100, y: 300 };
  // Inside the radius: no follow.
  assert.deepEqual(followCenter(origin, { x: 130, y: 300 }, 45, origin, 72), origin);
  // Past the radius: the centre is dragged so the finger sits exactly on the ring.
  const c = followCenter(origin, { x: 170, y: 300 }, 45, origin, 72);
  near(c.x, 125); near(c.y, 300);
  // Reversing after the follow needs only a short move back: 25 px left of the dragged centre
  // is already a strong left deflection (it would be a right one around the first touch).
  assert.ok((100 - c.x) / 45 < -0.5);
  // Limited travel from the first touch.
  const far = followCenter(origin, { x: 600, y: 300 }, 45, origin, 72);
  near(far.x, 172); near(far.y, 300);
  // Bad numbers never move the centre.
  assert.deepEqual(followCenter(origin, { x: Number.NaN, y: 1 }, 45, origin, 72), origin);
  assert.deepEqual(followCenter(origin, { x: 500, y: 1 }, 0, origin, 72), origin);
});

test('walking keeps full 360-degree movement with the same radial dead zone', () => {
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const v = stickAxes(Math.cos(a) * 60, -Math.sin(a) * 60, 60, STICK_TUNING.walkDeadzone);
    near(Math.hypot(v.x, v.y), 1);
    near(Math.atan2(v.y, v.x), Math.atan2(Math.sin(a), Math.cos(a)));
  }
  near(stickAxes(0, -30, 60, STICK_TUNING.walkDeadzone).y, (0.5 - 0.12) / 0.88);
});
