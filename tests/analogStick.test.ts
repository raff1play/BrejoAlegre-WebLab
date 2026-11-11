import test from 'node:test';
import assert from 'node:assert/strict';
import { stickAxes, blendAxis, ZERO_STICK } from '../src/core/analogStick.ts';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);

test('center and small finger jitter do not move player or motorcycle', () => {
  assert.deepEqual(stickAxes(0, 0, 60), ZERO_STICK);
  assert.deepEqual(stickAxes(3, 2, 60), ZERO_STICK);
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
});

test('analog and keyboard inputs combine without exceeding physical ranges', () => {
  near(blendAxis(1, 0.8), 1);
  near(blendAxis(-1, -0.7), -1);
  near(blendAxis(0, 0.4), 0.4);
  near(blendAxis(-1, 0.4), -0.6);
});
