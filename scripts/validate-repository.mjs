import {readFileSync, existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const required = [
  'AGENTS.md','CLAUDE.md','README.md','docs/00_START_HERE.md',
  'docs/PROJECT_STATE.md','docs/product/ORIGINAL_GODOT_SPEC.md',
  'docs/product/WEBLAB_SCOPE.md','docs/DECISIONS.md','docs/ARCHITECTURE.md',
  'docs/ENVIRONMENTS.md','docs/QUALITY_GATES.md','docs/NEXT_TASK_FOR_FABLE.md',
  'docs/AGENT_HANDOFF.md','docs/ISSUES_AND_RISKS.md','docs/VISUAL_DIRECTION.md',
  'docs/ASSETS_AND_LICENSES.md','docs/WORKFLOW.md','SECURITY.md',
  'src/main.ts','src/features/driving/motorcycle.ts','src/features/controls/input.ts',
  'src/core/collision.ts','.github/workflows/ci.yml','.github/workflows/pages.yml'
];
for(const file of required){
  assert.ok(existsSync(file),`Required file missing: ${file}`);
  assert.ok(readFileSync(file,'utf8').trim().length>0,`Required file empty: ${file}`);
}
const original=readFileSync('docs/product/ORIGINAL_GODOT_SPEC.md','utf8');
assert.match(original,/Godot/);
assert.match(original,/Brejo Alegre/);
const scope=readFileSync('docs/product/WEBLAB_SCOPE.md','utf8');
assert.match(scope,/Babylon/);
assert.match(scope,/single-player/);
console.log(`Repository integrity checks passed (${required.length} required text files).`);
