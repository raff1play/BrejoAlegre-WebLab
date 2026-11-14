/** Real Babylon renders. Run against the unmodified base, then the ART branch, same Chromium. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.WEBLAB_URL||'http://localhost:5173')+'/?gfx=desktop&trafego=0&hora=12.5');
 await page.waitForFunction(()=>window.__debug&&window.__weblab);
 await page.waitForTimeout(6000);
 const poses=await page.evaluate(()=>{
  const s=window.__weblab.snapshot(); const st=s.delivery.stores.find(x=>x.id===s.delivery.assigned[0]);
  const d=s.delivery.objective.target;
  const P=(x,z)=>({x:d.x+Math.cos(st.facing)*x+Math.sin(st.facing)*z,z:d.z-Math.sin(st.facing)*x+Math.cos(st.facing)*z});
  const bike=P(-1,-5); window.__debug.parkAt(bike.x,bike.z,st.facing+Math.PI/2);
  const walker=P(5,-6);window.__debug.placeWalker(walker.x,walker.z,st.facing);
  return {shop:{...P(0,2),y:2.5,r:19,b:1.32,a:Math.atan2(-Math.cos(st.facing),-Math.sin(st.facing))+.18},street:{...P(0,1),y:1.8,r:29,b:1.12,a:Math.atan2(-Math.cos(st.facing),-Math.sin(st.facing))+.4},bike:{...bike,y:.75,r:3.1,b:1.35,a:Math.atan2(-Math.cos(st.facing),-Math.sin(st.facing))+.4},interior:{...st.pickup,y:1.3,r:5.5,b:1.35,a:Math.atan2(-Math.cos(st.facing),-Math.sin(st.facing))}};
 });
 const metrics={browser:await browser.version(),viewport:[1280,720],renderer:'SwiftShader software; not device FPS',traffic:false,errors,poses};
 for(const [name,p] of Object.entries(poses)){
  await page.evaluate(p=>{window.__debug.view(p.a,p.b,p.r,p.x,p.z);window.__scene.activeCamera.target.y=p.y},p);
  await page.waitForTimeout(3000);
  // Wait for real rendered frames, collect render cost and scene complexity at this exact camera.
  metrics[name]=await page.evaluate(()=>new Promise(resolve=>{const samples=[];const scene=window.__scene;const obs=scene.onAfterRenderObservable.add(()=>{samples.push(window.__weblab.snapshot().perf);if(samples.length===30){scene.onAfterRenderObservable.remove(obs);resolve({samples,meshes:scene.meshes.length,triangles:scene.getActiveIndices()/3,activeMeshes:scene.getActiveMeshes().length})}})}));
  await page.screenshot({path:`${out}/${name}.jpg`,type:'jpeg',quality:94});
 }
 fs.writeFileSync(`${out}/metrics.json`,JSON.stringify(metrics,null,2)); await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
