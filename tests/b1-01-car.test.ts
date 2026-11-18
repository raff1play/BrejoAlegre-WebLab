import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionGuard, type Box2D, type MotionGuard } from '../src/core/collision.ts';
import {
  CAR, CAR_FOOTPRINT, CAR_DOORS, FOOTPRINT_TOLERANCE, canEnterCar, carBodyHits, carFits, carLocal, carToWorld,
  createCarState, doorSpot, findCarExit, isCarStopped, stepCar, type CarState,
} from '../src/core/carPhysics.ts';
import { MOTO, createMotoState, motoFits, stepMotorcycle } from '../src/core/motorcyclePhysics.ts';
import { CAR_STICK, carTurnFraction, motoTurnFraction, steerForTurn } from '../src/core/analogStick.ts';
import { WALKER } from '../src/core/walking.ts';
import { CAR_PARKING, depotCarBay } from '../src/world/city/depotPlan.ts';
import { CAREER_IDS, DEFAULT_CAREER, VEHICLE_KINDS } from '../src/core/career/careers.ts';
import { CareerSession, CareerStore, MemoryStorage } from '../src/core/career/careerStore.ts';
import { bootCareer, chooseCareerVehicle } from '../src/core/career/careerBoot.ts';
import { SaveError } from '../src/core/career/snapshot.ts';

/**
 * B1-01 F2 — carro jogável (decisões 5–7, AC-03, AC-04 regressão, AC-05). Física pura e
 * determinística; a apresentação 3D e o toque real são cobertos pelo E2E (tests/e2e).
 */
const open: MotionGuard = createMotionGuard({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 }, []);
const idle = { throttle: 0, brake: 0, steer: 0 };
const driving = (x = 0, z = 0, yaw = 0): CarState => { const s = createCarState(x, z, yaw); s.parked = false; return s; };
const run = (s: CarState, controls: typeof idle, seconds: number, guard = open, dt = 1 / 60, each?: (s: CarState) => void) => {
  for (let t = 0; t < seconds; t += dt) { stepCar(s, controls, dt, guard); each?.(s); }
  return s;
};
const corners = (s: { x: number; z: number; yaw: number }) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => carToWorld(s, a! * CAR.width / 2, b! * CAR.length / 2));
/** How deep a point is inside an axis-aligned box (0 when outside). */
const depth = (p: { x: number; z: number }, b: Box2D) => Math.max(0, Math.min(p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z));

test('B1-01 F2 AC-05: footprint covers the 3.85 × 1.62 m body within tolerance and never sticks out', () => {
  const hw = CAR.width / 2; const hl = CAR.length / 2;
  let worst = 0;
  for (let i = 0; i <= 200; i++) for (let j = 0; j <= 200; j++) {
    const x = -hw + (2 * hw * i) / 200; const z = -hl + (2 * hl * j) / 200;
    worst = Math.max(worst, Math.min(...CAR_FOOTPRINT.map((f) => Math.hypot(x - f.x, z - f.z) - f.r)));
  }
  assert.ok(worst <= FOOTPRINT_TOLERANCE, `ponto da carroceria fora dos colisores: ${worst.toFixed(3)} m`);
  for (const f of CAR_FOOTPRINT) assert.ok(Math.abs(f.x) + f.r <= hw + 1e-9 && Math.abs(f.z) + f.r <= hl + 1e-9, 'colisor maior que a carroceria');
  assert.ok(CAR.length > 2 * (MOTO.bodyOffset + MOTO.bodyRadius) && CAR.width > 2 * MOTO.bodyRadius, 'carro maior que a moto');
});

test('B1-01 F2 AC-05: car accelerates progressively, slower than the bike, straight ahead, capped', () => {
  const s = run(driving(), { ...idle, throttle: 1 }, 1);
  const m = createMotoState(0, 0, 0);
  for (let t = 0; t < 1; t += 1 / 60) stepMotorcycle(m, { ...idle, throttle: 1 }, 1 / 60, open);
  assert.ok(s.speed > 1.5 && s.speed < m.speed, `1 s: carro ${s.speed.toFixed(2)} m/s, moto ${m.speed.toFixed(2)} m/s`);
  run(s, { ...idle, throttle: 1 }, 25);
  assert.ok(s.speed <= CAR.maxSpeed && s.speed > CAR.maxSpeed * 0.97, `velocidade final ${s.speed}`);
  assert.ok(s.z > 300 && Math.abs(s.x) < 1e-6 && s.yaw === 0, 'reta ao longo de +z');
});

test('B1-01 F2 AC-05: brakes to a stop without rolling back; reverse only after releasing; reverse capped', () => {
  const s = run(driving(), { ...idle, throttle: 1 }, 6);
  run(s, { ...idle, brake: 1 }, 3);
  assert.equal(s.speed, 0); assert.ok(isCarStopped(s));
  run(s, { ...idle, brake: 1 }, 2);
  assert.equal(s.speed, 0, 'segurar o freio após parar não dá ré');
  run(s, idle, 0.1);
  const z0 = s.z;
  run(s, { ...idle, brake: 1 }, 8);
  assert.ok(s.speed < 0 && s.speed >= -CAR.reverseSpeed - 1e-9 && s.z < z0, `ré: ${s.speed}`);
  run(s, { ...idle, throttle: 1 }, 3);
  assert.ok(s.speed > 0, 'acelerar sai da ré e volta à frente');
});

test('B1-01 F2 AC-05: steering — right turns right, low-speed radius from wheelbase/lock, grip limit at speed', () => {
  const r = run(driving(), { throttle: 0.35, brake: 0, steer: 1 }, 2);
  assert.ok(r.yaw > 0.2, 'esterço positivo vira à direita');
  const l = run(driving(), { throttle: 0.35, brake: 0, steer: -1 }, 2);
  assert.ok(Math.abs(l.yaw + r.yaw) < 1e-9, 'simétrico');
  // Low speed circle: radius ≈ wheelbase / tan(lock) (kinematic), measured from the path.
  const s = driving();
  let cruise = 0;
  const pts: { x: number; z: number }[] = [];
  // Parking-speed cruise (~2 m/s, throttle feathered like a driver would) at full lock.
  for (let t = 0; t < 30; t += 1 / 60) {
    stepCar(s, { throttle: s.speed < 2 ? 0.5 : 0, brake: 0, steer: 1 }, 1 / 60, open);
    cruise = s.speed; pts.push({ x: s.x, z: s.z });
  }
  const tail = pts.slice(-600);
  const cx = tail.reduce((a, p) => a + p.x, 0) / tail.length; const cz = tail.reduce((a, p) => a + p.z, 0) / tail.length;
  const radius = tail.reduce((a, p) => a + Math.hypot(p.x - cx, p.z - cz), 0) / tail.length;
  const lock = CAR.maxSteerAngle / (1 + (cruise / CAR.steerSpeedRef) ** 2);
  const expected = CAR.wheelbase / Math.tan(lock);
  assert.ok(Math.abs(radius - expected) / expected < 0.12, `raio ${radius.toFixed(2)} m, esperado ${expected.toFixed(2)} m a ${cruise.toFixed(2)} m/s`);
  assert.ok(radius > 3.2 && radius < 6, `raio de giro de carro popular (não de moto): ${radius.toFixed(2)} m`);
  // At full speed, full lock never exceeds the lateral grip budget.
  const fast = run(driving(), { ...idle, throttle: 1 }, 30);
  let maxLat = 0;
  let yaw = fast.yaw;
  run(fast, { throttle: 1, brake: 0, steer: 1 }, 2, open, 1 / 60, (c) => { maxLat = Math.max(maxLat, Math.abs(c.speed * (c.yaw - yaw) * 60)); yaw = c.yaw; });
  assert.ok(maxLat <= CAR.maxLateralAccel + 1e-6, `aceleração lateral ${maxLat.toFixed(2)} > ${CAR.maxLateralAccel}`);
});

test('B1-01 F2 AC-05: steering wheel is slower than handlebars and recentres when released', () => {
  const c = driving(); stepCar(c, { ...idle, steer: 1 }, 0.1, open);
  const m = createMotoState(0, 0, 0); stepMotorcycle(m, { ...idle, steer: 1 }, 0.1, open);
  assert.ok(c.steer > 0.3 && c.steer < m.steer, `volante ${c.steer}, guidão ${m.steer}`);
  run(c, { ...idle, steer: 1 }, 1); assert.equal(c.steer, 1);
  run(c, idle, 0.5); assert.equal(c.steer, 0);
});

test('B1-01 F2 AC-05: colliders — driving into walls at any angle never lets the body clip in', () => {
  const walls: Box2D[] = [
    { minX: 6, maxX: 7, minZ: -40, maxZ: 40 },
    { minX: -40, maxX: 40, minZ: 14, maxZ: 15 },
    { minX: -3.2, maxX: -2.6, minZ: 3, maxZ: 6 }, // a pole/pillar
  ];
  const guard = createMotionGuard({ minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, walls);
  let worst = 0; let hits = 0;
  for (let k = 0; k < 24; k++) {
    const yaw = (k / 24) * Math.PI * 2;
    for (const steer of [-1, -0.4, 0, 0.4, 1]) {
      const s = driving(0, 0, yaw);
      run(s, { throttle: 1, brake: 0, steer }, 9, guard, 1 / 30, (c) => {
        assert.ok(carFits(guard, c.x, c.z, c.yaw), 'colisores sempre livres');
        for (const p of corners(c)) for (const w of walls) worst = Math.max(worst, depth(p, w));
      });
      if (Math.abs(s.speed) < CAR.maxSpeed * 0.5) hits++;
    }
  }
  assert.ok(hits > 20, 'cenário realmente atinge obstáculos');
  assert.ok(worst <= FOOTPRINT_TOLERANCE, `canto da carroceria penetrou ${worst.toFixed(3)} m`);
});

test('B1-01 F2 AC-05: a 1.5 m gap stops the car but not the bike (dimensions are real)', () => {
  const posts: Box2D[] = [{ minX: -10, maxX: -0.75, minZ: 5, maxZ: 5.4 }, { minX: 0.75, maxX: 10, minZ: 5, maxZ: 5.4 }];
  const guard = createMotionGuard({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, posts);
  const c = run(driving(), { ...idle, throttle: 1 }, 6, guard);
  assert.ok(c.z + CAR.length / 2 <= 5 + FOOTPRINT_TOLERANCE, `carro passou: frente em ${(c.z + CAR.length / 2).toFixed(2)}`);
  const m = createMotoState(0, 0, 0);
  for (let t = 0; t < 6; t += 1 / 60) stepMotorcycle(m, { ...idle, throttle: 1 }, 1 / 60, guard);
  assert.ok(m.z > 8 && motoFits(guard, m.x, m.z, m.yaw), 'moto passa no vão de 1,5 m');
});

test('B1-01 F2 AC-05: a car pinned against a wall can always back out', () => {
  const guard = createMotionGuard({ minX: -50, maxX: 50, minZ: -50, maxZ: 10 }, []);
  const s = run(driving(), { ...idle, throttle: 1 }, 15, guard);
  assert.ok(Math.abs(s.z - (10 - CAR.length / 2)) < 0.05 && s.speed === 0, 'encostado');
  run(s, { ...idle, brake: 1 }, 2, guard);
  assert.ok(s.speed < 0 && s.z < 10 - CAR.length / 2 - 0.3, 'ré afasta da parede');
});

test('B1-01 F2 AC-05: parked car (handbrake) ignores pedals; getting in releases it', () => {
  const s = createCarState(3, 4, 1);
  run(s, { throttle: 1, brake: 0, steer: 1 }, 3);
  assert.deepEqual([s.x, s.z, s.yaw, s.speed], [3, 4, 1, 0]);
  s.parked = false;
  run(s, { ...idle, throttle: 1 }, 1);
  assert.ok(s.speed > 0);
});

test('B1-01 F2 AC-05: getting out only stopped, on free ground beside a door (driver, passenger, behind)', () => {
  const s = createCarState(0, 0, 0);
  const first = findCarExit(s, open)!;
  assert.equal(first.side, 'motorista');
  const local = carLocal(s, first.x, first.z);
  assert.ok(local.right < -CAR.width / 2 && !carBodyHits(s, first.x, first.z, WALKER.radius), 'motorista desce pela esquerda, fora da carroceria');
  // Wall on the driver's side → passenger side; both sides → behind; boxed in → no exit.
  const left = createMotionGuard({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, [{ minX: -2, maxX: -1.0, minZ: -5, maxZ: 5 }]);
  assert.equal(findCarExit(s, left)!.side, 'passageiro');
  const both = createMotionGuard({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, [{ minX: -2, maxX: -1.0, minZ: -1.5, maxZ: 5 }, { minX: 1.0, maxX: 2, minZ: -1.5, maxZ: 5 }]);
  assert.equal(findCarExit(s, both)!.side, 'traseira');
  const boxed = createMotionGuard({ minX: -1.05, maxX: 1.05, minZ: -2.1, maxZ: 2.1 }, []);
  assert.equal(findCarExit(s, boxed), null);
  const moving = driving(); run(moving, { ...idle, throttle: 1 }, 1);
  assert.equal(findCarExit(moving, open), null, 'em movimento não sai');
});

test('B1-01 F2 AC-05: getting in only beside a front door; the body is solid for a person', () => {
  const s = createCarState(10, -4, Math.PI / 3);
  for (const side of ['motorista', 'passageiro'] as const) assert.equal(canEnterCar(doorSpot(s, side), s), side);
  assert.equal(canEnterCar(carToWorld(s, 0, CAR.length / 2 + 2), s), null, 'pela frente, longe das portas');
  assert.equal(canEnterCar(carToWorld(s, -CAR.width / 2 - CAR_DOORS.reach - 1, 0), s), null);
  assert.ok(carBodyHits(s, s.x, s.z, 0.3) && carBodyHits(s, ...Object.values(carToWorld(s, CAR.width / 2 + 0.2, 1.8)) as [number, number], 0.3));
  assert.ok(!carBodyHits(s, ...Object.values(carToWorld(s, CAR.width / 2 + 0.35, 0)) as [number, number], 0.3));
});

test('B1-01 F2: car stick curve — own dead zone/saturation, monotonic, symmetric; CTRL-002 bike curve unchanged', () => {
  assert.equal(carTurnFraction(CAR_STICK.deadzone), 0);
  assert.equal(carTurnFraction(CAR_STICK.saturation), 1);
  assert.equal(carTurnFraction(1), 1); assert.equal(carTurnFraction(-1), -1); assert.equal(carTurnFraction(Number.NaN), 0);
  let prev = 0;
  for (let x = 0; x <= 1.0001; x += 0.01) { const f = carTurnFraction(x); assert.ok(f >= prev - 1e-12); assert.ok(Math.abs(f + carTurnFraction(-x)) < 1e-12); prev = f; }
  // CTRL-002 reference values of the bike (from analogStick.test.ts calibration): untouched by F2.
  assert.ok(Math.abs(motoTurnFraction(0.25, 0) - 0.64) < 0.02);
  assert.equal(motoTurnFraction(0.62, 0), 1);
  assert.ok(steerForTurn(1, 0) > 0.99 && MOTO.maxSteerAngle === 0.82 && MOTO.maxLateralAccel === 9.5);
});

test('B1-01 F2 AC-05: parking — depot car bay only with the four corners inside the paint and stopped', () => {
  const r = CAR_PARKING[1]!;
  const cx = (r.minX + r.maxX) / 2; const cz = (r.minZ + r.maxZ) / 2;
  const at = (x: number, z: number, yaw: number) => corners({ x, z, yaw });
  assert.equal(depotCarBay(at(cx, cz, 0), false), 1);
  assert.equal(depotCarBay(at(cx, cz, Math.PI), false), 1, 'de ré também vale');
  assert.equal(depotCarBay(at(cx, cz, 0), true), null, 'em movimento não está estacionado');
  assert.equal(depotCarBay(at(cx + 1.6, cz, 0), false), null, 'entre duas vagas');
  assert.equal(depotCarBay(at(cx, cz, Math.PI / 2), false), null, 'atravessado');
  assert.equal(depotCarBay(at(cx, cz + 1.5, 0), false), null, 'metade fora');
});

test('B1-01 F2 AC-03: vehicle chosen once per career, persisted, fixed; other careers untouched', () => {
  const storage = new MemoryStorage();
  const boot = bootCareer(storage);
  assert.equal(boot.session.careerId, DEFAULT_CAREER);
  assert.equal(boot.session.profile.vehicle, null);
  const save = chooseCareerVehicle(boot.session, 'carro-antigo');
  assert.deepEqual({ ...save.profile.vehicle }, { vehicleId: `veiculo-${DEFAULT_CAREER}`, kind: 'carro-antigo', owned: true, paidOff: true, chosenOnCalendarIndex: 0 });
  assert.throws(() => chooseCareerVehicle(boot.session, 'moto-antiga'), SaveError, 'segunda escolha recusada');
  assert.throws(() => chooseCareerVehicle(boot.session, 'carro-antigo'), SaveError, 'nem repetindo a mesma');
  assert.throws(() => chooseCareerVehicle(boot.session, 'bicicleta' as never), SaveError);
  const again = bootCareer(storage);
  assert.equal(again.session.profile.vehicle?.kind, 'carro-antigo', 'mantido após reiniciar');
  const all = new CareerStore(storage).readAll();
  for (const id of CAREER_IDS) if (id !== DEFAULT_CAREER) assert.equal(all[id].save.profile.vehicle, null, `${id} intocada`);
  assert.deepEqual([...VEHICLE_KINDS], ['moto-antiga', 'carro-antigo']);
});

test('B1-01 F2 AC-03: a stale session (other tab already chose) cannot overwrite the choice', () => {
  const storage = new MemoryStorage();
  const store = new CareerStore(storage);
  const a = new CareerSession(store);
  const b = new CareerSession(store);
  chooseCareerVehicle(a, 'moto-antiga');
  assert.throws(() => chooseCareerVehicle(b, 'carro-antigo'), SaveError);
  assert.equal(new CareerSession(new CareerStore(storage)).profile.vehicle?.kind, 'moto-antiga');
});
