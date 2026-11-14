import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWebLabRegistration, WEBLAB_CACHE_PREFIX } from '../src/features/display/disablePwa.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('browser build no longer advertises the installable PWA', () => {
  const html = read('../index.html');
  assert.doesNotMatch(html, /rel=["']manifest["']/);
  assert.doesNotMatch(html, /data-pwa-install/);
  assert.doesNotMatch(html, /mobile-web-app-capable/);
  assert.match(html, /id="landscape-start"/);
  assert.match(html, /id="movement-stick"/);
});

test('retirement service worker unregisters and does not intercept fetch', () => {
  const sw = read('../public/sw.js');
  assert.match(sw, /registration\.unregister\(\)/);
  assert.match(sw, /caches\.delete\(name\)/);
  assert.doesNotMatch(sw, /addEventListener\(['"]fetch['"]/);
});

test('old PWA cleanup matches only this project registration scope', () => {
  const page = 'https://raff1play.github.io/BrejoAlegre-WebLab/';
  const base = './';
  assert.equal(isWebLabRegistration(page, page, base), true);
  assert.equal(isWebLabRegistration('https://raff1play.github.io/AnotherProject/', page, base), false);
  assert.equal(isWebLabRegistration('https://elsewhere.test/BrejoAlegre-WebLab/', page, base), false);
  assert.equal(WEBLAB_CACHE_PREFIX, 'brejo-weblab-');
});

test('game boot retires the PWA instead of installing it', () => {
  const main = read('../src/main.ts');
  assert.match(main, /disableWebLabPwa\(window, import\.meta\.env\.BASE_URL\)/);
  assert.doesNotMatch(main, /initializePwa\(/);
});
