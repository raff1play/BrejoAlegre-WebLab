import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const required = [
 'AGENTS.md','README.md','docs/00_START_HERE.md','docs/DECISIONS.md',
 'docs/PROJECT_STATE.md','docs/ARCHITECTURE.md','docs/WORKFLOW.md',
 'docs/ISSUES_AND_RISKS.md','docs/QUALITY_GATES.md','docs/ENVIRONMENTS.md',
 'docs/product/ORIGINAL_GODOT_SPEC.md','docs/product/WEBLAB_SCOPE.md',
 'docs/ASSETS_AND_LICENSES.md','docs/CITY_REFERENCE.md','docs/evidence/README.md',
 'src/main.ts','src/core/delivery/logisticsDay.ts','src/core/delivery/couriers.ts',
 'src/core/delivery/operatingCalendar.ts','src/core/delivery/parcels.ts',
 'src/features/hud/hud.ts','src/features/controls/input.ts','src/core/motorcyclePhysics.ts',
 'src/world/geo/brejoAlegreData.ts','src/features/display/disablePwa.ts',
 'tests/log006-traffic-deadlock.test.ts','tests/e2e/current-smoke.cjs',
 'package-lock.json','docs/BETA_1_0_SPEC.md','docs/BETA_1_0_DECISIONS.md',
 'docs/beta1/STATE.json','docs/beta1/B1_00_RUNBOOK.md','scripts/beta1-control.mjs',
 'tests/beta1-control.test.ts','.github/workflows/ci.yml',
 '.github/workflows/preview.yml','.github/workflows/pages.yml'
];
for(const file of required){
 assert.ok(existsSync(file),`Required file missing: ${file}`);
 assert.ok(readFileSync(file,'utf8').trim().length>0,`Required file empty: ${file}`);
}
const product=readFileSync('docs/product/ORIGINAL_GODOT_SPEC.md','utf8');
assert.match(product,/Godot/);
const scope=readFileSync('docs/product/WEBLAB_SCOPE.md','utf8');
assert.match(scope,/Babylon/);
assert.match(scope,/single-player/);
const html=readFileSync('index.html','utf8');
assert.match(html,/ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE/);
assert.doesNotMatch(html,/<link[^>]+rel=["']manifest["']/);
for(const wf of ['ci.yml','pages.yml','preview.yml'])assert.match(readFileSync(`.github/workflows/${wf}`,'utf8'),/npm ci/);
const trigger=readFileSync('.github/workflows/preview.yml','utf8');
assert.match(trigger,/docs\/PREVIEW_DEPLOY_TRIGGER\.md/);
const stateCheck=execFileSync(process.execPath,['scripts/beta1-control.mjs','validate'],{encoding:'utf8'});
assert.match(stateCheck,/B1-00: estado valido/);
assert.match(trigger,/npm run test:e2e/);
console.log(`Repository integrity checks passed (${required.length} required files).`);
