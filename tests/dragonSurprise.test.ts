import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRAGON_DURATION, DRAGON_MESSAGE, DRAGON_SPEED_KMH, dragonCanStart, dragonEnabled, dragonPhase } from '../src/core/dragonSurprise.ts';

test('dragon feature is OFF by default and requires explicit ?dragon=1', () => {
  for (const query of ['', '?dragon=0', '?gfx=mobile', '?dragon=true', '?dragon=2']) {
    assert.equal(dragonEnabled(query), false, query);
  }
  assert.equal(dragonEnabled('?dragon=1'), true);
  assert.equal(dragonEnabled('?gfx=mobile&dragon=1'), true);
});

test('dragon starts only at actual forward 45 km/h while riding', () => {
  assert.equal(DRAGON_SPEED_KMH, 45);
  assert.equal(dragonCanStart(44.9 / 3.6, true), false);
  assert.equal(dragonCanStart(45 / 3.6, true), true);
  assert.equal(dragonCanStart(50 / 3.6, true), true);
  assert.equal(dragonCanStart(-55 / 3.6, true), false);
  assert.equal(dragonCanStart(50 / 3.6, false), false);
  assert.equal(dragonCanStart(Number.NaN, true), false);
  assert.equal(dragonCanStart(Infinity, true), false);
});

test('effect phases progress from dragon to fire, exhaust rocket and sky message', () => {
  assert.equal(dragonPhase(0), 'approach');
  assert.equal(dragonPhase(2.2), 'fire');
  assert.equal(dragonPhase(4.1), 'rocket');
  assert.equal(dragonPhase(5.3), 'message');
  assert.equal(dragonPhase(DRAGON_DURATION), 'finished');
  assert.equal(DRAGON_MESSAGE, 'Marcos Pato');
});

test('heavy visuals are dynamically imported only behind URL opt-in', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /if \(dragonEnabled\(window\.location\.search\)\) \{/);
  assert.match(main, /void import\('\.\/features\/easterEgg\/dragonSurprise'\)/);
  assert.match(main, /dragonSurprise\?\.update/);
});

test('W011 audio and cinematic effects are isolated in the opted-in visual chunk', () => {
  const audio = readFileSync(new URL('../src/features/easterEgg/dragonAudio.ts', import.meta.url), 'utf8');
  const effect = readFileSync(new URL('../src/features/easterEgg/dragonSurprise.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(audio, /new ctor\(\{ latencyHint: 'interactive' \}\)/);
  assert.match(audio, /document\.addEventListener\('pointerdown'/);
  assert.match(audio, /roar\(\): void/);
  assert.match(audio, /fireworks\(\): void/);
  assert.match(audio, /private quack\(at: number\): void/);
  assert.match(audio, /update\(speedMps: number, riding: boolean\): void/);
  assert.match(audio, /this\.button\.remove\(\)/);
  assert.match(effect, /this\.audio\.update\(bike\.speed, bike\.riding\)/);
  assert.match(effect, /this\.audio\.roar\(\)/);
  assert.match(effect, /this\.audio\.fire\(\)/);
  assert.match(effect, /this\.audio\.launch\(\)/);
  assert.match(effect, /this\.audio\.fireworks\(\)/);
  assert.match(effect, /makeScaleTexture\(\)/);
  assert.match(effect, /this\.smoke = this\.particle/);
  assert.match(effect, /this\.coreFire = this\.particle/);
  assert.doesNotMatch(main, /DragonAudio|dragonAudio/);
  assert.match(main, /if \(dragonEnabled\(window\.location\.search\)\)/);
});
