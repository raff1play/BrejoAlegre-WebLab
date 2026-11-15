import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isWebLabRegistration,WEBLAB_CACHE_PREFIX} from '../src/features/display/disablePwa.ts';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('the browser game does not register an installable PWA and keeps manual landscape mode',()=>{
 const html=read('../index.html'),main=read('../src/main.ts');
 assert.doesNotMatch(html,/rel=["']manifest["']|data-pwa-install/);
 assert.match(html,/id="landscape-start"/);
 assert.match(main,/disableWebLabPwa\(window, import\.meta\.env\.BASE_URL\)/);
 assert.doesNotMatch(main,/initializePwa\(/);
});

test('retirement service worker and scope guard only clear this project',()=>{
 const sw=read('../public/sw.js');
 assert.match(sw,/registration\.unregister\(\)/);
 assert.doesNotMatch(sw,/addEventListener\(['"]fetch['"]/);
 assert.equal(isWebLabRegistration('https://raff1play.github.io/BrejoAlegre-WebLab/','https://raff1play.github.io/BrejoAlegre-WebLab/','./'),true);
 assert.equal(isWebLabRegistration('https://raff1play.github.io/Other/','https://raff1play.github.io/BrejoAlegre-WebLab/','./'),false);
 assert.equal(WEBLAB_CACHE_PREFIX,'brejo-weblab-');
});
