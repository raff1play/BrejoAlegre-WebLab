/** Run the existing complete journey with software-GPU scaling; resize is tested at native scale. */
const pw=require('playwright');const launch=pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch=async options=>{
 const browser=await launch({...options,executablePath:'/usr/bin/chromium'});
 const context=browser.newContext.bind(browser);browser.newContext=async options=>{
  const c=await context(options),newPage=c.newPage.bind(c);c.newPage=async()=>{
   const page=await newPage(),goto=page.goto.bind(page),resize=page.setViewportSize.bind(page);
   page.goto=async(...args)=>{const result=await goto(...args);await page.waitForFunction(()=>window.__scene,null,{timeout:120000});await page.evaluate(()=>{
    const e=window.__scene.getEngine(),set=e.setHardwareScalingLevel.bind(e);
    e.setHardwareScalingLevel=v=>set(Math.max(4,v));e.setHardwareScalingLevel(4);
    window.__nativeScaleForResize=()=>{e.setHardwareScalingLevel=set;set(1)};
   });return result;};
   page.setViewportSize=async size=>{await resize(size);if(size.width===900&&size.height===420)await page.evaluate(()=>window.__nativeScaleForResize());};
   return page;
  };return c;
 };return browser;
};
require('../../tests/e2e/play.cjs');
