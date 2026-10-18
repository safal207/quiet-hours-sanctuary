// CI-only browser checks for the actual visitor entry page, not preview.html.
// Run after verify-webgl.mjs has generated the raster scene poster, or check out
// the committed raster asset. Screenshots are evidence for manual art review.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,firefox,webkit} from 'playwright';
import {PNG} from 'pngjs';

const browserName=(process.argv[2]||'chromium').replace(/^(?:--)?browser=/,'');
assert.ok(['chromium','firefox','webkit'].includes(browserName),'Expected browser=chromium, browser=firefox, or browser=webkit');
const root=path.resolve('dist'),out=path.resolve(browserName==='chromium'?'qa-fullpage':`qa-fullpage-${browserName}`);
await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  if(!(await stat(file)).isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
 }catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const engines={chromium:'Chromium / ANGLE SwiftShader software WebGL',firefox:'Firefox / Linux Mesa software WebGL (headed Xvfb)',webkit:'Playwright WebKit / Linux Mesa software WebGL (headed Xvfb; not Safari)'};
const report={entry:'dist/index.html',browser:browserName,browserVersion:null,engine:engines[browserName],date:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,status:'running',stage:'launch',cases:[],errors:[],limits:['Linux software WebGL does not certify a physical Android/iOS device GPU.','Playwright WebKit on Linux is not Safari.','Nonblank and layout checks are bounded regression guards; they do not score artistic quality.','Screenshots show the visitor page, its scene and its controls; preview.html is checked separately.']};
const launchOptions=browserName==='chromium'
 ?{headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
 :browserName==='firefox'
 ?{headless:false,firefoxUserPrefs:{'webgl.disabled':false,'webgl.force-enabled':true,'webgl.forbid-software':false,'gfx.webrender.all':true,'gfx.webrender.software':true}}
 :{headless:false};
let browser,lastPage;
function pass(id,details={}){report.cases.push({id,status:'pass',...details});console.log('PASS',id,JSON.stringify(details))}
function metrics(bytes){
 const image=PNG.sync.read(bytes);let sum=0,sq=0,min=255,max=0,clipped=0,black=0;
 for(let i=0;i<image.data.length;i+=4){const r=image.data[i],g=image.data[i+1],b=image.data[i+2],v=.2126*r+.7152*g+.0722*b;sum+=v;sq+=v*v;min=Math.min(min,v);max=Math.max(max,v);if(r>249&&g>249&&b>249)clipped++;if(v<2)black++}
 const n=image.width*image.height,mean=sum/n;
 return{width:image.width,height:image.height,mean,std:Math.sqrt(Math.max(0,sq/n-mean*mean)),min,max,clippedFraction:clipped/n,blackFraction:black/n};
}
function difference(a,b){const pa=PNG.sync.read(a),pb=PNG.sync.read(b);assert.equal(pa.data.length,pb.data.length);let sum=0;for(let i=0;i<pa.data.length;i+=4)for(let c=0;c<3;c++)sum+=Math.abs(pa.data[i+c]-pb.data[i+c]);return sum/(pa.width*pa.height*3)}
async function open(width,{beforeGoto}={}){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 await context.addInitScript(()=>{let seed=207;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}});
 const page=await context.newPage();lastPage=page;const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
 page.on('requestfailed',request=>errors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`));
 if(beforeGoto)await beforeGoto(page);
 await page.goto(origin+'/',{waitUntil:'load',timeout:90000});
 assert.equal(new URL(page.url()).pathname,'/','Must exercise the actual entry page');
 await page.waitForFunction(()=>document.querySelector('#poster img')?.complete&&document.querySelector('#poster img')?.naturalWidth>0);
 await page.locator('#poster img').evaluate(img=>img.decode());
 return{page,context,errors,width};
}
async function layout(test,phase){
 const {page,width}=test;
 const result=await page.evaluate(()=>{
  const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const groups=[['[data-view="0"]','[data-view="2"]','[data-view="4"]'],['#rain','label[for="light"]','#pause']];
  return{viewport:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,scene:rect('#scene'),controls:rect('#controls'),groups:groups.map(group=>group.map(rect)),slider:rect('#light')};
 });
 assert.ok(result.overflow<=1,`${width} ${phase}: horizontal overflow ${result.overflow}`);
 assert.ok(result.scene.x>=-1&&result.scene.right<=result.viewport+1,`${width} ${phase}: scene exceeds viewport`);
 const minimumSceneWidth=width>760?Math.max(500,width*.5):width*.78;
 assert.ok(result.scene.width>=minimumSceneWidth&&result.scene.height>=180,`${width} ${phase}: scene is too small to inspect`);
 assert.ok(result.controls.y>=result.scene.bottom-1,`${width} ${phase}: controls cover the scene`);
 assert.ok(result.slider.width>=45,`${width} ${phase}: unusable light slider`);
 for(const row of result.groups){
  for(const box of row)assert.ok(box.x>=-1&&box.right<=result.viewport+1&&box.width>20&&box.height>=28,`${width} ${phase}: control out of bounds: ${JSON.stringify(box)}`);
  for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length;j++){
   const a=row[i],b=row[j],overlapX=Math.min(a.right,b.right)-Math.max(a.x,b.x),overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
   assert.ok(overlapX<=1||overlapY<=1,`${width} ${phase}: adjacent controls overlap`);
  }
 }
 pass(`${width}-${phase}-layout`,{viewport:result.viewport,scene:result.scene,overflow:result.overflow,controlsBelowScene:true});
}
async function light(test,value){
 await test.page.locator('#light').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}))},value);
 assert.equal(await test.page.locator('#light-value').textContent(),`${value}%`);
}
async function picture(test,id,selector='#scene'){
 const bytes=await test.page.locator(selector).screenshot({path:path.join(out,`${id}.png`),timeout:30000});
 const m=metrics(bytes);
 assert.ok(m.mean>2&&m.mean<245,`${id}: invalid exposure / blank image: ${JSON.stringify(m)}`);
 assert.ok(m.std>4&&m.max-m.min>30,`${id}: image is blank or uniform`);
 assert.ok(m.blackFraction<.98&&m.clippedFraction<.5,`${id}: image is mostly black or white`);
 pass(id,{image:`${id}.png`,metrics:m});return{bytes,m};
}
async function ready(test){
 await test.page.waitForFunction(()=>document.querySelector('.sanctuary')?.classList.contains('ready')||(!document.querySelector('#enter')?.disabled&&document.querySelector('#status')?.textContent.match(/недоступ|долго|время|не удалось|не запуст|больше 12/i)),null,{timeout:30000});
 assert.equal(await test.page.locator('.sanctuary').evaluate(el=>el.classList.contains('ready')),true,await test.page.locator('#status').textContent());
 assert.equal(await test.page.locator('#scene').getAttribute('aria-busy'),'false','First successful frame must end loading');
 assert.equal(await test.page.locator('#cancel-start').isVisible(),false);
 const gl=await test.page.locator('#world').evaluate(canvas=>{const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(!gl)return null;const info=gl.getExtension('WEBGL_debug_renderer_info');return{width:canvas.width,height:canvas.height,version:gl.getParameter(gl.VERSION),renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}});
 assert.ok(gl?.width>0&&gl?.height>0,'A real WebGL drawing buffer must exist');
 assert.ok(await test.page.locator('#world').isVisible(),'Rendered canvas must be visible');
 assert.equal(await test.page.locator('#poster').isVisible(),false,'Poster must hide only after readiness');
 assert.deepEqual(test.errors,[],`Full page renderer console / shader / network errors: ${test.errors.join('\n')}`);
 pass(`${test.width}-primary-3d-first-draw`,{gl});
}
async function visit(width){
 const test=await open(width),{page}=test;
 try{
  const poster=await page.locator('#poster img').evaluate(img=>({src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight}));
  assert.match(new URL(poster.src).pathname,/\.(?:png|webp|jpe?g)$/i,'Visitor must see an actual raster frame of the 3D scene');
  assert.ok(poster.width>=500&&poster.height>=300,'Full scene poster must be large enough for mobile / desktop');
  assert.equal(await page.locator('.sanctuary').evaluate(el=>el.classList.contains('ready')),false);
  assert.equal(await page.locator('#enter').isEnabled(),true);
  assert.equal(await page.locator('#cancel-start').isVisible(),false);
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'true','Reduced motion must freeze the scene initially');
  pass(`${width}-raster-poster-before-webgl`,poster);
  await layout(test,'poster');
  await page.screenshot({path:path.join(out,`${width}-entry-page.png`),fullPage:true});
  await page.screenshot({path:path.join(out,`${width}-first-screen.png`),fullPage:false});
  await picture(test,`${width}-poster-original`,'#poster');
  await light(test,60);const posterLow=await picture(test,`${width}-poster-light-60`,'#poster');
  await light(test,140);const posterHigh=await picture(test,`${width}-poster-light-140`,'#poster');
  assert.ok(posterHigh.m.mean>posterLow.m.mean+.1,'Poster exposure slider must affect the displayed frame');
  assert.ok(difference(posterLow.bytes,posterHigh.bytes)>.2,'Poster exposure must visibly change pixels');
  await page.locator('[data-view="4"]').click();
  assert.equal(await page.locator('[data-view="4"]').getAttribute('aria-pressed'),'true');
  const posterClose=await picture(test,`${width}-poster-close`,'#poster');
  assert.ok(difference(posterHigh.bytes,posterClose.bytes)>1,'Poster framing must visibly change the displayed scene');
  await page.locator('#rain').click();assert.equal(await page.locator('#rain').getAttribute('aria-pressed'),'true');
  await page.locator('#reset').click();
  assert.equal(await page.locator('#light-value').textContent(),'100%');
  assert.equal(await page.locator('[data-view="0"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#rain').getAttribute('aria-pressed'),'false');
  pass(`${width}-poster-light-framing-weather-reset`);
  await page.locator('#enter').click();
  await ready(test);await layout(test,'3d');
  await picture(test,`${width}-full-page-3d`,'#world');
  await page.locator('#scene').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,`${width}-3d-page.png`),fullPage:true});
  await light(test,60);const low=await picture(test,`${width}-3d-light-60`,'#world');
  await light(test,140);const high=await picture(test,`${width}-3d-light-140`,'#world');
  assert.ok(high.m.mean>low.m.mean+.1,'Actual full-page 3D light must be monotonic');
  assert.ok(difference(low.bytes,high.bytes)>.2,'Full-page 3D light must visibly change rendered pixels');
  await page.locator('[data-view="4"]').click();const close=await picture(test,`${width}-3d-close`,'#world');
  assert.ok(difference(high.bytes,close.bytes)>1,'Full-page 3D buttons must move the actual camera');
  await page.locator('#rain').click();assert.equal(await page.locator('#rain').getAttribute('aria-pressed'),'true');
  await page.locator('#flat-mode').click();
  assert.equal(await page.locator('.sanctuary').evaluate(el=>el.classList.contains('ready')),false);
  assert.equal(await page.locator('#poster').isVisible(),true);
  assert.equal(await page.locator('#enter').isEnabled(),true);
  assert.equal(await page.locator('#light-value').textContent(),'140%');
  assert.equal(await page.locator('[data-view="4"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(test.errors,[]);
  pass(`${width}-full-page-light-camera-return-preserves-state`,{low:low.m.mean,high:high.m.mean});
 }catch(error){
  try{await page.screenshot({path:path.join(out,`${width}-failure-page.png`),fullPage:true,timeout:10000})}catch{}
  throw error;
 }finally{await test.context.close()}
}
async function deferredImportRecovery({timeout=false}={}){
 let release,intercepted,moduleUrl;
 const pending=new Promise(resolve=>release=resolve),observed=new Promise(resolve=>intercepted=resolve);
 const test=await open(390,{beforeGoto:page=>page.route(/\/temple-renderer\.js(?:\?|$)/,async route=>{moduleUrl=route.request().url();intercepted();await pending;await route.continue()})});
 const {page}=test;
 try{
  await page.locator('#enter').click();
  await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Full page did not request its renderer module')),5000))]);
  assert.equal(await page.locator('#scene').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('#cancel-start').isVisible(),true);
  assert.equal(await page.locator('#enter').isEnabled(),false);
  assert.equal(await page.locator('#poster').isVisible(),true);
  await page.locator('[data-view="4"]').click();await light(test,140);
  assert.equal(await page.locator('#light-value').textContent(),'140%','Poster controls remain usable during module loading');
  if(timeout){
   await page.waitForFunction(()=>!document.querySelector('#enter').disabled,null,{timeout:16000});
   assert.match(await page.locator('#status').textContent(),/долго|время|не удалось|попроб|больше 12|повтор/i,'Timeout needs a clear recovery message');
  }else await page.locator('#cancel-start').click();
  assert.equal(await page.locator('#scene').getAttribute('aria-busy'),'false');
  assert.equal(await page.locator('#cancel-start').isVisible(),false);
  assert.equal(await page.locator('#enter').isEnabled(),true);
  assert.equal(await page.locator('.sanctuary').evaluate(el=>el.classList.contains('ready')),false);
  await picture(test,`delayed-import-${timeout?'timeout':'cancel'}-usable-poster`,'#poster');
  release();
  // Wait for the same real module and its dependencies to settle. Merely seeing
  // the HTTP response would not prove the original delayed import has resumed.
  await page.evaluate(async url=>{await import(url)},moduleUrl);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.sanctuary').evaluate(el=>el.classList.contains('ready')),false,'Late cancelled module must not activate a stale renderer');
  assert.equal(await page.locator('#world').isVisible(),false);
  if(timeout){
   assert.ok(test.errors.every(error=>/долго|время|timeout/i.test(error)),`Unexpected timeout failure: ${test.errors.join('\n')}`);
   test.errors.length=0;
  }else assert.deepEqual(test.errors,[]);
  await page.locator('#enter').click();await ready(test);
  await picture(test,`delayed-import-${timeout?'timeout':'cancel'}-retry-3d`,'#world');
  pass(`delayed-import-${timeout?'timeout':'cancel'}-late-result-ignored-and-retry`,{deadlineMilliseconds:timeout?12000:null});
 }catch(error){
  try{await page.screenshot({path:path.join(out,`delayed-import-${timeout?'timeout':'cancel'}-failure-page.png`),fullPage:true,timeout:10000})}catch{}
  throw error;
 }finally{release();await test.context.close()}
}
async function failedImportRecovery(){
 const requested=[];let first=true;
 const modulePattern=/\/temple-renderer\.js(?:\?|$)/;
 const test=await open(390,{beforeGoto:page=>page.route(modulePattern,async route=>{
  requested.push(route.request().url());
  if(first){first=false;await route.abort('failed')}else await route.continue();
 })});
 const {page}=test;
 try{
  await page.locator('#enter').click();
  await page.waitForFunction(()=>!document.querySelector('#enter').disabled&&!document.querySelector('.sanctuary').classList.contains('ready'),null,{timeout:10000});
  assert.equal(requested.length,1,'Failure fixture must abort an actual first renderer import');
  assert.match(await page.locator('#status').textContent(),/3D не запустилось/);
  assert.equal(await page.locator('#scene').getAttribute('aria-busy'),'false');
  assert.equal(await page.locator('#cancel-start').isVisible(),false);
  assert.equal(await page.locator('#poster').isVisible(),true);
  assert.equal(await page.locator('#safe-start').isVisible(),true,'Failure must offer explicit retry');
  await light(test,130);await page.locator('#rain').click();
  assert.equal(await page.locator('#light-value').textContent(),'130%');
  assert.equal(await page.locator('#rain').getAttribute('aria-pressed'),'true');
  await picture(test,'failed-import-usable-poster','#poster');
  pass('first-import-network-failure-recoverable',{requested:requested[0],expectedErrors:[...test.errors]});
  await page.unroute(modulePattern);
  test.errors.length=0;
  // This is deliberately a real browser import retry. A mocked successful
  // factory would conceal a cached failed module request in the browser.
  await page.locator('#enter').click();await ready(test);
  assert.equal(await page.locator('#light-value').textContent(),'130%');
  assert.equal(await page.locator('#rain').getAttribute('aria-pressed'),'true');
  await picture(test,'failed-import-retry-actual-3d','#world');
  pass('network-restored-real-module-retry-preserves-state');
 }catch(error){
  try{await page.screenshot({path:path.join(out,'failed-import-failure-page.png'),fullPage:true,timeout:10000})}catch{}
  throw error;
 }finally{await test.context.close()}
}
try{
 browser=await({chromium,firefox,webkit}[browserName]).launch(launchOptions);report.browserVersion=browser.version();
 report.stage='visitor-entry-page';
 for(const width of [1200,390,320])await visit(width);
 report.stage='delayed-module-cancellation';await deferredImportRecovery();
 report.stage='failed-module-network-retry';await failedImportRecovery();
 // The deadline is the same host code in every engine; one actual 12s elapsed
 // Chromium check accompanies the deterministic Node lifecycle tests.
 if(browserName==='chromium'){report.stage='delayed-module-timeout';await deferredImportRecovery({timeout:true})}
 report.status='passed';report.stage='complete';
}catch(error){
 report.status='failed';report.errors.push(error.stack||String(error));console.error(error);process.exitCode=1;
 if(lastPage&&!lastPage.isClosed())try{await lastPage.screenshot({path:path.join(out,'failure-page.png'),fullPage:true,timeout:10000})}catch{}
}finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
}
