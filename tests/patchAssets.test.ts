import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Ensure the two external GLBs actually exist, remain valid and retain needed animation clips.
 * These checks are independent from GPU/Playwright and catch accidental binary replacements.
 */
const folder = join(process.cwd(), 'public/assets/models/patch');
const readGlb = (name: string) => {
  const bytes = readFileSync(join(folder, name));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.byteLength);
  const chunk = bytes.readUInt32LE(12);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
  return { bytes, doc: JSON.parse(bytes.subarray(20, 20 + chunk).toString()) };
};

test('Patch pilot bus is a valid GLB with real geometry and suitable mobile payload', () => {
  const { bytes, doc } = readGlb('city-bus-49fd97.glb');
  assert.ok(bytes.byteLength < 600_000);
  assert.ok(doc.meshes.length >= 1);
  assert.ok(doc.nodes.length >= 1);
  assert.equal((doc.animations ?? []).length, 0);
});

test('Patch pilot pedestrian is rigged and has in-place Idle/Walk', () => {
  const { bytes, doc } = readGlb('woman.glb');
  assert.ok(bytes.byteLength < 7_000_000);
  assert.ok(doc.meshes.length >= 1);
  assert.ok(doc.skins.length >= 1);
  const clips = new Set((doc.animations ?? []).map((clip: { name: string }) => clip.name));
  assert.ok(clips.has('Idle') && clips.has('Walk') && clips.has('Run'));
  // Never play root-motion clips in a path-following city simulation.
  assert.ok(clips.has('Walk_Root'));
});

test('Patch pilot assets ship their CC0 and CC BY attribution and licence files', () => {
  const credits = readFileSync(join(folder, 'CREDITS.md'), 'utf8');
  const by = readFileSync(join(folder, 'LICENSES/CC-BY-4.0.txt'), 'utf8');
  const zero = readFileSync(join(folder, 'LICENSES/CC0-1.0.txt'), 'utf8');
  assert.match(credits, /Polyfork/i);
  assert.match(credits, /Patch|anymove/i);
  assert.ok(by.length > 500 && zero.length > 500);
});
