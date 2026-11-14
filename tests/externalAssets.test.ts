import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { buildColliders, showcaseStreetItems, SHOP, frameRect, ROAD_HALF, FRONT } from '../src/world/layout.ts';

// externalAssets.ts imports Babylon; its placement rules are mirrored from layout here and the
// shipped files are checked directly.
const MODELS = ['street_lamp_01', 'planter_box_02', 'rollershutter_door'];

test('CORE-011 external models are shipped as small binary glTF files', () => {
  for (const id of MODELS) {
    const path = `public/assets/models/${id}.glb`;
    assert.ok(existsSync(path), `${path} exists`);
    const head = readFileSync(path).subarray(0, 4).toString('ascii');
    assert.equal(head, 'glTF', `${id} is a GLB`);
    assert.ok(statSync(path).size < 300_000, `${id} stays under 300 kB`);
  }
  for (const file of ['clay_roof_tiles_03_diff_512.jpg', 'clay_roof_tiles_03_nor_gl_512.jpg']) {
    assert.ok(statSync(`public/assets/textures/${file}`).size < 150_000, `${file} stays small`);
  }
});

test('CORE-011 every external model is registered with source and licence in the manifest', () => {
  const manifest = readFileSync('public/assets/ASSET_MANIFEST.md', 'utf8');
  for (const id of [...MODELS, 'clay_roof_tiles_03']) {
    assert.match(manifest, new RegExp(`${id}[\\s\\S]{0,400}CC0`), `${id} has a CC0 entry`);
    assert.match(manifest, new RegExp(`polyhaven\\.com/a/${id}`), `${id} links its source page`);
  }
});

test('CORE-011 lamp and planter slots sit on solid kerb-side colliders; the shop door is on the façade', () => {
  const colliders = buildColliders();
  const items = showcaseStreetItems().filter((i) => i.kind === 'poste-colonial' || i.kind === 'floreira');
  assert.ok(items.filter((i) => i.kind === 'poste-colonial').length >= 3);
  for (const i of items) {
    assert.ok(Math.abs(i.x) > ROAD_HALF && Math.abs(i.x) < FRONT - 1, `${i.kind} on the pavement`);
    assert.ok(colliders.some((c) => c.minX <= i.x && c.maxX >= i.x && c.minZ <= i.z && c.maxZ >= i.z), `${i.kind} is solid`);
  }
  const shop = frameRect(SHOP.frame, 0, SHOP.width, 0, SHOP.depth);
  assert.ok(Math.abs(shop.minX - 13) < 1e-9 && shop.minZ <= -37 && shop.maxZ >= -37, 'door slot is on the shop façade');
});
