import test from 'node:test';
import assert from 'node:assert/strict';
import { requestLandscapeMode } from '../src/features/display/landscape.ts';

function mockDocument(
  fullscreenElement: object | null,
  requestFullscreen?: () => Promise<void>,
): Document {
  return { fullscreenElement, documentElement: { requestFullscreen } } as unknown as Document;
}
function mockScreen(lock?: (mode: string) => Promise<void>): Screen {
  return { orientation: { lock } } as unknown as Screen;
}

test('a user gesture requests fullscreen before locking landscape', async () => {
  const events: string[] = [];
  const doc = mockDocument(null, async () => { events.push('fullscreen'); });
  const screen = mockScreen(async (mode) => { events.push(`lock:${mode}`); });
  assert.equal(await requestLandscapeMode(doc, screen), 'locked');
  assert.deepEqual(events, ['fullscreen', 'lock:landscape']);
});

test('already fullscreen: lock landscape without requesting fullscreen again', async () => {
  const events: string[] = [];
  const doc = mockDocument({}, async () => { events.push('fullscreen'); });
  const screen = mockScreen(async () => { events.push('lock'); });
  assert.equal(await requestLandscapeMode(doc, screen), 'locked');
  assert.deepEqual(events, ['lock']);
});

test('unsupported fullscreen: use manual rotation fallback', async () => {
  assert.equal(await requestLandscapeMode(mockDocument(null), mockScreen(async () => {})), 'manual');
});

test('rejected fullscreen: use manual rotation fallback', async () => {
  const doc = mockDocument(null, async () => { throw Error('NotAllowedError'); });
  assert.equal(await requestLandscapeMode(doc, mockScreen(async () => {})), 'manual');
});

test('unsupported orientation lock: keep fullscreen with manual rotation fallback', async () => {
  assert.equal(await requestLandscapeMode(mockDocument({}, async () => {}), mockScreen()), 'fullscreen-only');
});

test('rejected orientation lock: keep fullscreen with manual rotation fallback', async () => {
  const screen = mockScreen(async () => { throw Error('NotSupportedError'); });
  assert.equal(await requestLandscapeMode(mockDocument({}, async () => {}), screen), 'fullscreen-only');
});

test('installed PWA requests landscape without entering browser fullscreen', async () => {
  const events: string[] = [];
  const doc = mockDocument(null, async () => { events.push('fullscreen'); });
  const screen = mockScreen(async (mode) => { events.push(`lock:${mode}`); });
  assert.equal(await requestLandscapeMode(doc, screen, true), 'locked');
  assert.deepEqual(events, ['lock:landscape']);
});

test('installed PWA falls back to manual rotation without Chrome fullscreen', async () => {
  const events: string[] = [];
  const doc = mockDocument(null, async () => { events.push('fullscreen'); });
  const screen = mockScreen(async () => { throw Error('NotAllowedError'); });
  assert.equal(await requestLandscapeMode(doc, screen, true), 'manual');
  assert.deepEqual(events, []);
});
