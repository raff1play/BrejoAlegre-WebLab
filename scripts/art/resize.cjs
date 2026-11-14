/** Checks native resize without the optional E2E runner's forced 4x scaling. */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:640,height:360}});
 await p.goto((process.env.WEBLAB_URL||'http://localhost:5173')+'/?gfx=desktop&trafego=0');await p.waitForFunction(()=>window.__weblab);
 await p.setViewportSize({width:900,height:420});
 await p.waitForFunction(()=>{const s=window.__weblab.snapshot();return s.renderSize[0]===900&&s.renderSize[1]===420},null,{timeout:30000});
 console.log('PASS native resize 900x420:',await p.evaluate(()=>window.__weblab.snapshot().renderSize));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
