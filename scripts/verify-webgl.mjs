// Runs only on the GitHub Actions runner. Chromium uses software WebGL (SwiftShader), not a phone GPU.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const root=path.resolve('dist'),out=path.resolve('qa-webgl');
const kind=process.argv[2];
assert.ok(['room','temple'].includes(kind),'Expected room or temple argument');
await mkdir(out,{recursive:true});await mkdir(path.join(root,'assets'),{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
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
const report={scene:kind,engine:'Chromium / ANGLE SwiftShader software WebGL',date:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,status:'running',cases:[],errors:[],limits:['Software WebGL does not certify an Android/iOS device GPU.','Pixel luminance checks detect blank scenes and lighting regressions; aesthetic review of screenshots remains separate.']};
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
function metrics(bytes){
 const image=PNG.sync.read(bytes);let sum=0,sq=0,min=255,max=0,clipped=0,black=0;
 for(let i=0;i<image.data.length;i+=4){const r=image.data[i],g=image.data[i+1],b=image.data[i+2],v=.2126*r+.7152*g+.0722*b;sum+=v;sq+=v*v;min=Math.min(min,v);max=Math.max(max,v);if(r>249&&g>249&&b>249)clipped++;if(v<2)black++}
 const n=image.width*image.height,mean=sum/n;
 return{width:image.width,height:image.height,mean,std:Math.sqrt(Math.max(0,sq/n-mean*mean)),min,max,clippedFraction:clipped/n,blackFraction:black/n};
}
function difference(a,b){const pa=PNG.sync.read(a),pb=PNG.sync.read(b);assert.equal(pa.data.length,pb.data.length);let sum=0;for(let i=0;i<pa.data.length;i+=4)for(let c=0;c<3;c++)sum+=Math.abs(pa.data[i+c]-pb.data[i+c]);return sum/(pa.width*pa.height*3)}
function pass(id,details={}){report.cases.push({id,status:'pass',...details});console.log('PASS',id,JSON.stringify(details))}
async function open({width=1200,height=800,quality='low',qa=true,reduced='reduce'}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:reduced});
 await context.addInitScript(()=>{let seed=207;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});page.on('requestfailed',request=>errors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`));
 await page.goto(`${origin}/preview.html?quality=${quality}&qa=${qa?'1':'0'}`,{waitUntil:'load',timeout:90000});
 await page.waitForFunction(()=>window.__preview?.ready||window.__preview?.error,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>window.__preview.error),null,`Renderer failed: ${errors.join('\n')}`);
 assert.equal(await page.evaluate(()=>window.__preview.ready),true);
 assert.deepEqual(errors,[],`${quality} startup console / shader errors`);
 const gl=await page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(!gl)return null;const info=gl.getExtension('WEBGL_debug_renderer_info');return{version:gl.getParameter(gl.VERSION),renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}});
 assert.ok(gl,'Actual WebGL context required');
 pass(`${quality}-${width}-webgl-startup`,{viewport:{width,height},gl});
 return{page,context,errors,quality,width};
}
async function snapshot(test,id,{poster=false}={}){
 const{page,errors}=test;
 await page.evaluate(()=>{document.body.dataset.capture='true';window.__preview.render(1000)});
 await page.waitForTimeout(100);
 const bytes=await page.locator('canvas').screenshot({path:path.join(out,`${id}.png`),timeout:30000});
 const m=metrics(bytes);
 assert.ok(m.mean>2&&m.mean<250,`${id}: implausible mean ${m.mean}`);
 assert.ok(m.std>4&&m.max-m.min>30,`${id}: canvas is blank or too uniform: ${JSON.stringify(m)}`);
 assert.ok(m.blackFraction<.98&&m.clippedFraction<.5,`${id}: scene mostly black or white`);
 assert.deepEqual(errors,[],`${id}: console / shader errors`);
 if(poster)await writeFile(path.join(root,'assets','scene-preview.png'),bytes);
 pass(id,{quality:test.quality,viewport:m.width+'×'+m.height,metrics:m,image:`${id}.png`,poster});
 await page.evaluate(()=>{delete document.body.dataset.capture});
 return{bytes,m};
}
async function light(test,value){await test.page.locator('#light').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}))},value);assert.equal(await test.page.locator('output').textContent(),`${value}%`)}
async function assertNoOverflow(test){const overflow=await test.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);const sliderBox=await test.page.locator('#light').boundingBox();assert.ok(sliderBox?.width>40);pass(`${test.quality}-${test.width}-controls-fit`)}
try{
 const desktop=await open();await assertNoOverflow(desktop);
 if(kind==='room'){
  await desktop.page.evaluate(()=>window.__preview.setPreset('evening'));
  await light(desktop,75);await snapshot(desktop,'room-evening-75',{poster:true});
  await light(desktop,0);const zero=await snapshot(desktop,'room-evening-0');
  await light(desktop,100);const full=await snapshot(desktop,'room-evening-100');
  assert.ok(full.m.mean>zero.m.mean+.1,'Room slider must increase real scene brightness');assert.ok(difference(zero.bytes,full.bytes)>.2,'Room lighting must visibly change pixels');pass('room-light-monotonic',{low:zero.m.mean,high:full.m.mean});
  await desktop.page.evaluate(()=>window.__preview.setPreset('away'));const off=await snapshot(desktop,'room-away-0');
  await light(desktop,100);const offFull=await snapshot(desktop,'room-away-100');
  assert.ok(difference(off.bytes,offFull.bytes)<.03,'All lamps off: brightness slider must not create light');pass('room-off-slider-stable');
  await desktop.page.evaluate(()=>window.__preview.setState({scene:'custom',brightness:100,day:false,ac:false,temperature:22,lights:{pendant:false,floor:false,accent:false}}));
  const customOff=await snapshot(desktop,'room-custom-off');
  for(const id of ['pendant','floor','accent']){
   await desktop.page.evaluate(id=>window.__preview.setState({scene:'custom',brightness:100,day:false,ac:false,temperature:22,lights:{pendant:id==='pendant',floor:id==='floor',accent:id==='accent'}}),id);
   const only=await snapshot(desktop,`room-${id}-only`);
   assert.ok(only.m.mean>customOff.m.mean+.01,`${id} must illuminate real pixels`);pass(`room-${id}-light-visible`,{off:customOff.m.mean,on:only.m.mean});
  }
  await desktop.page.locator('[data-view=plan]').click();const plan=await snapshot(desktop,'room-plan');
  await desktop.page.locator('[data-view="3d"]').click();const model=await snapshot(desktop,'room-model');
  assert.ok(difference(plan.bytes,model.bytes)>2,'Plan and 3D must be different cameras');pass('room-plan-model-camera');
 }else{
  assert.equal(await desktop.page.evaluate(()=>window.__preview.postprocessing),false,'Low profile skips bloom');
  await light(desktop,100);await snapshot(desktop,'temple-low-default',{poster:true});
  await light(desktop,60);const low=await snapshot(desktop,'temple-low-light-60');
  await light(desktop,140);const high=await snapshot(desktop,'temple-low-light-140');
  assert.ok(high.m.mean>low.m.mean+.1,'Low-profile light must be monotonic');assert.ok(difference(low.bytes,high.bytes)>.2);pass('temple-low-light-monotonic',{low:low.m.mean,high:high.m.mean});
  await desktop.page.locator('[data-view="2"]').click();const close=await snapshot(desktop,'temple-close-view');assert.ok(difference(high.bytes,close.bytes)>1);pass('temple-camera-change');
  await desktop.context.close();
  const bloom=await open({quality:'high'});
  assert.equal(await bloom.page.evaluate(()=>window.__preview.postprocessing),true,'High-profile actual bloom pipeline must execute in CI');
  await light(bloom,60);const bloomLow=await snapshot(bloom,'temple-bloom-light-60');
  await light(bloom,140);const bloomHigh=await snapshot(bloom,'temple-bloom-light-140');
  assert.ok(bloomHigh.m.mean>bloomLow.m.mean+.1,'Bloom exposure must be monotonic');assert.ok(difference(bloomLow.bytes,bloomHigh.bytes)>.2);pass('temple-bloom-real-shaders-and-light',{low:bloomLow.m.mean,high:bloomHigh.m.mean});
  await bloom.context.close();
 }
 if(kind==='room')await desktop.context.close();
 for(const width of [390,320]){
  const mobile=await open({width,height:520,qa:width!==320,reduced:width===320?'no-preference':'reduce'});
  await assertNoOverflow(mobile);await snapshot(mobile,`${kind}-mobile-${width}`);
  await mobile.page.evaluate(()=>window.postMessage({type:'designlab:visibility',active:false},location.origin));
  await mobile.page.waitForTimeout(120);assert.equal(await mobile.page.evaluate(()=>window.__preview.active),false);
  const paused=await mobile.page.evaluate(()=>window.__preview.frames);await mobile.page.waitForTimeout(160);assert.equal(await mobile.page.evaluate(()=>window.__preview.frames),paused,'Paused preview must stop automatic renders');
  await mobile.page.evaluate(()=>dispatchEvent(new MessageEvent('message',{data:{type:'designlab:visibility',active:true},origin:'https://invalid.example',source:window.parent})));
  assert.equal(await mobile.page.evaluate(()=>window.__preview.active),false,'Untrusted origin must not resume');
  await mobile.page.evaluate(()=>window.postMessage({type:'designlab:visibility',active:true},location.origin));await mobile.page.waitForTimeout(240);
  assert.equal(await mobile.page.evaluate(()=>window.__preview.active),true);
  if(kind==='temple'&&width===320)assert.ok(await mobile.page.evaluate(()=>window.__preview.frames)>paused,'Normal animation resumes after visibility');
  assert.deepEqual(mobile.errors,[]);pass(`${kind}-mobile-${width}-visibility-origin`);await mobile.context.close();
 }
 report.status='passed';
}catch(error){report.status='failed';report.errors.push(error.stack||String(error));console.error(error);process.exitCode=1}
finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve))}
