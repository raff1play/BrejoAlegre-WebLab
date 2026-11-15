/** Reproducible real screenshots/metrics from archived baseline and current dev server. */
const {chromium}=require('playwright'),fs=require('node:fs');
const poses=[['entry',106,-96,43,.85,false],['parking-floor',86,-108,23,1.02,false],['warehouse',111,-124,45,.8,false],['sorting',114,-130,25,.8,true],['five-docks',111,-118,36,1.02,true]];
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});for(const [version,port]of [['before',5175],['after',5173]].filter(([v])=>!process.env.ONLY_VERSION||v===process.env.ONLY_VERSION)){
 const page=await b.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://localhost:${port}/?gfx=mobile&trafego=0&hora=11.5&perf=1`);await page.waitForFunction(()=>window.__debug);await page.keyboard.press('KeyP');await page.evaluate(()=>{document.querySelector('#pause').style.visibility='hidden';__scene.getEngine().setHardwareScalingLevel(1)});
 const results={version,commit:version==='before'?'9805cf3':'LOG-003 working tree',browser:await b.version(),viewport:[960,540],profile:'mobile',gpu:'SwiftShader',traffic:false,hour:11.5,poses,samples:{},errors};
 fs.mkdirSync(`docs/evidence/log-003/${version}`,{recursive:true});
 for(const [name,x,z,r,beta,cutaway]of poses){await page.evaluate(([x,z,r,beta,cutaway])=>{const q=__debug.depot(x,z),a=__debug.depot(110,-100),b=__debug.depot(110,-120);__debug.view(Math.atan2(a.z-b.z,a.x-b.x),beta,r,q.x,q.z);__scene.activeCamera.target.y=1;__scene.meshes.filter(m=>m.name.startsWith('art002-roof')).forEach(m=>m.setEnabled(!cutaway));},[x,z,r,beta,cutaway]);await page.waitForTimeout(1800);
  const samples=await page.evaluate(async()=>{const data=[];for(let i=0;i<30;i++){await new Promise(r=>__scene.onAfterRenderObservable.addOnce(()=>r(null)));const s=__weblab.snapshot();data.push({...s.perf,fps:s.fps,activeMeshes:s.activeMeshes,renderSize:s.renderSize});}return data;});results.samples[name]=samples;await page.screenshot({path:`docs/evidence/log-003/${version}/${name}.jpg`,quality:88});console.log(version,name,samples[0]);
 }
 fs.writeFileSync(`docs/evidence/log-003/${version}/metrics.json`,JSON.stringify(results,null,2));await page.close();}
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
