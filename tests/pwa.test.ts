import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAppDisplayMode } from '../src/features/display/pwa.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url));

test('PWA manifest resolves within the GitHub Pages project subpath', () => {
  const manifest = JSON.parse(read('../public/manifest.webmanifest').toString('utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'landscape');
  assert.ok(manifest.name.includes('Brejo Alegre'));
  assert.ok(Array.isArray(manifest.icons));
});

test('PWA icon files are valid PNGs with declared resolutions', () => {
  const manifest = JSON.parse(read('../public/manifest.webmanifest').toString('utf8'));
  for (const icon of manifest.icons) {
    const png = read(`../public/${icon.src.replace(/^\.\//, '')}`);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const size = Number.parseInt(icon.sizes, 10);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(icon.type, 'image/png');
  }
});

test('installed standalone, fullscreen and minimal-ui modes are recognized', () => {
  for (const mode of ['standalone', 'fullscreen', 'minimal-ui']) {
    assert.equal(isAppDisplayMode((query) => query === `(display-mode: ${mode})`), true);
  }
  assert.equal(isAppDisplayMode(() => false), false);
});

test('service worker cache rules remain scoped to this app', () => {
  const sw = read('../public/sw.js').toString('utf8');
  assert.ok(sw.includes('new URL(self.registration.scope)'));
  assert.ok(sw.includes('url.origin !== APP_SCOPE.origin'));
  assert.ok(sw.includes('url.pathname.startsWith(APP_SCOPE.pathname)'));
  assert.ok(sw.includes('fetch(request)'));
});
