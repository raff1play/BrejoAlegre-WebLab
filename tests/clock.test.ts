import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualClock, REAL_SECONDS_PER_VIRTUAL_HOUR, WORKDAY_END, WORKDAY_START, activityAt } from '../src/core/city/clock.ts';
import { lightingAt } from '../src/core/city/dayNight.ts';

test('clock keeps the approved scale: 4 real minutes per virtual hour, starting at 11:00', () => {
  assert.equal(REAL_SECONDS_PER_VIRTUAL_HOUR, 240);
  assert.equal(WORKDAY_START, 11);
  assert.equal(WORKDAY_END, 21);
  const c = new VirtualClock();
  assert.equal(c.label, '11:00');
  assert.ok(c.isWorkday);
  c.advance(240);
  assert.equal(c.label, '12:00');
  for (let i = 0; i < 600; i++) c.advance(4); // 40 real minutes = 10 virtual hours
  assert.equal(c.label, '22:00');
  assert.equal(c.isWorkday, false);
  c.advance(240 * 3);
  assert.equal(c.label, '01:00', 'wraps past midnight');
  c.advance(Number.NaN);
  c.advance(-5);
  assert.equal(c.label, '01:00', 'invalid steps are ignored');
});

test('development hour control jumps without changing the scale', () => {
  const c = new VirtualClock();
  c.setHour(6.5);
  assert.equal(c.label, '06:30');
  c.advance(120);
  assert.equal(c.label, '07:00');
  c.setHour(27);
  assert.equal(c.label, '03:00');
});

test('day/night lighting: bright noon, golden late afternoon, dark night, smooth transitions', () => {
  const noon = lightingAt(12);
  const afternoon = lightingAt(17.8);
  const night = lightingAt(22);
  const morning = lightingAt(7.5);
  assert.ok(noon.night < 0.01 && noon.sunIntensity > 1.8 && noon.shadows);
  assert.ok(night.night > 0.99 && night.sunIntensity < 0.3 && !night.shadows);
  assert.ok(afternoon.sunColor[2] < noon.sunColor[2], 'sunset light is warmer');
  assert.ok(morning.night < 0.05);
  assert.ok(noon.sunDirection[1] < afternoon.sunDirection[1], 'the sun is lower in the afternoon');
  let previous = lightingAt(0).night;
  for (let h = 0; h <= 24; h += 0.1) {
    const n = lightingAt(h).night;
    assert.ok(Math.abs(n - previous) < 0.12, `no jump at ${h.toFixed(1)}h`);
    previous = n;
    const d = lightingAt(h).sunDirection;
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9 && d[1] < 0, 'light always points down');
  }
});

test('activity: busier by day, quiet at night, logistics during the working day', () => {
  assert.ok(activityAt(12).people > activityAt(2).people * 3);
  assert.ok(activityAt(18).traffic > activityAt(3).traffic * 3);
  assert.equal(activityAt(15).logistics, 1);
  assert.equal(activityAt(3).logistics, 0);
  assert.ok(activityAt(10).commerceOpen && !activityAt(21).commerceOpen);
});
