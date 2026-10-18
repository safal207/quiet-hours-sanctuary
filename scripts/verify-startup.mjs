/** Node-only host lifecycle checks. No browser, DOM engine, Canvas2D or GPU is used. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const appPath=path.resolve(process.argv[2]||new URL('../dist/app.js',import.meta.url).pathname);
const original=fs.readFileSync(appPath,'utf8');
const source=original.replace(/import\(\s*moduleURL\s*\)/g,'__loadRenderer(moduleURL)');
assert.notEqual(source,original,'Harness must replace the temple dynamic import; update matcher if module path changed.');
const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}

function harness({failAt=[],reducedMotion=false,createDelay=0}={}){
 const timeline=[],elements=new Map(),raf=new Map(),timers=new Map(),renderers=[],errors=[],load=deferred(),loads=[],loadURLs=[];let nextRaf=0,nextTimer=0,time=0,loadCalls=0,firstDraw=false;
 class Element{
  constructor(selector){this.selector=selector;this.listeners=new Map();this.attributes=new Map();this.style={setProperty(k,v){this[k]=String(v)}};this.dataset={};this.disabled=false;this.hidden=false;this.textContent='';this.value='100';this.clientWidth=1280;this.clientHeight=850;this.width=1280;this.height=850;this.isConnected=true;const classes=new Set();this.classList={add:(...xs)=>{for(const x of xs){classes.add(x);if(selector==='.sanctuary'&&x==='ready')timeline.push('ready')}},remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,force)=>{const on=force===undefined?!classes.has(x):force;if(on)classes.add(x);else classes.delete(x);return on}}}
  addEventListener(type,fn){const a=this.listeners.get(type)||[];a.push(fn);this.listeners.set(type,a)}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x!==fn))}
  setAttribute(k,v){this.attributes.set(k,String(v))}getAttribute(k){return this.attributes.get(k)??null}removeAttribute(k){this.attributes.delete(k)}
  getBoundingClientRect(){return{left:0,top:0,width:this.clientWidth,height:this.clientHeight,right:this.clientWidth,bottom:this.clientHeight}}
  focus(){}scrollIntoView(){}replaceWith(other){elements.set(this.selector,other)}cloneNode(){return new Element(this.selector)}
  async emit(type,extra={}){let prevented=false;const event={type,target:this,currentTarget:this,persisted:false,preventDefault(){prevented=true},...extra};for(const fn of this.listeners.get(type)||[])await fn(event);return prevented}
 }
 const q=s=>{if(!elements.has(s))elements.set(s,new Element(s));return elements.get(s)};
 const controls=['[data-view="0"]','[data-view="2"]','[data-view="4"]','#rain','#pause','#light'].map(q);controls.forEach(e=>e.disabled=false);const views=controls.slice(0,3);views.forEach((e,i)=>e.dataset.view=String(i*2));
 const steps=['original','atmosphere','result'].map(value=>{const e=q('[data-process="'+value+'"]');e.dataset.process=value;return e});q('#flat-mode').hidden=true;q('#safe-start').hidden=true;q('#cancel-start').hidden=true;q('#enter').textContent='Включить 3D';q('#status').textContent='2D уже работает.';
 function queryAll(s){if(s.includes('data-process'))return steps;if(s.includes('data-view'))return views;if(s.includes('.controls'))return controls;return[]}
 q('.controls').querySelectorAll=queryAll;
 const document=q('document');document.hidden=false;document.querySelector=q;document.querySelectorAll=queryAll;document.createElement=tag=>new Element(tag);
 const window=q('window');window.innerWidth=1280;window.innerHeight=850;
 function create(canvas,options){time+=createDelay;const index=renderers.length;const r={options,quality:options.quality,calls:0,disposed:0,reducedMotion:false,paused:false,timingResets:0,setPaused(value){this.paused=value;this.timingResets++},resetTiming(){this.timingResets++},render(){this.calls++;timeline.push('render-attempt');if(this.calls===failAt[index])throw new Error('Injected render failure #'+index+':'+this.calls);firstDraw=true;timeline.push('render-success')},dispose(){this.disposed++;timeline.push('dispose')},resize(){},setPointer(){},setView(value){this.view=value},setRain(value){this.rain=value},setLight(value){this.light=value},getQuality(){return'balanced'}};renderers.push(r);timeline.push('create');return r}
 const context={document,window,location:{search:'',href:'https://example.test/'},navigator:{hardwareConcurrency:4},URLSearchParams,URL,matchMedia:()=>({matches:reducedMotion,addEventListener(){},removeEventListener(){}}),performance:{now:()=>time},requestAnimationFrame(fn){const id=++nextRaf;raf.set(id,fn);return id},cancelAnimationFrame(id){raf.delete(id)},setTimeout(fn,delay=0){const id=++nextTimer;timers.set(id,{fn,at:time+delay});return id},clearTimeout(id){timers.delete(id)},queueMicrotask,console:{error:(...a)=>errors.push(a),warn:(...a)=>errors.push(a),log(){}},__loadRenderer(url){loadURLs.push(url);return (loads[loadCalls++]||load).promise},ResizeObserver:class{observe(){}disconnect(){}}};
 window.matchMedia=context.matchMedia;window.requestAnimationFrame=context.requestAnimationFrame;window.cancelAnimationFrame=context.cancelAnimationFrame;
 vm.runInNewContext(source,context,{filename:appPath});
 async function runTimers(){for(const [id,timer] of [...timers]){if(timer.at<=time&&timers.has(id)){timers.delete(id);timer.fn()}}await microtasks()}
 async function tick(){await microtasks();const batch=[...raf];raf.clear();time+=16;await runTimers();for(const[,fn]of batch)fn(time);await microtasks()}
 async function advance(ms){time+=ms;await runTimers()}
 async function drive(promise){let done=false,rejection;promise.then(()=>done=true,e=>{done=true;rejection=e});for(let i=0;i<30&&!done;i++){await microtasks();if(!done)await tick()}assert.ok(done,'Host operation did not finish after 30 frame/microtask cycles');if(rejection)throw rejection;await microtasks()}
 return{q,controls,renderers,errors,raf,timers,timeline,load,loads,loadURLs,advance,newLoad(){const next=deferred();loads.push(next);return next},get loadCalls(){return loadCalls},get firstDraw(){return firstDraw},release(target=load){target.resolve({createTempleNightRenderer:create})},tick,drive,click:()=>q('#enter').emit('click')};
}
function failedState(h,label){assert.equal(h.q('.sanctuary').classList.contains('ready'),false,label+': ready removed');assert.equal(h.q('#enter').disabled,false,label+': retry enabled');assert.equal(h.q('#enter').hidden,false,label+': retry not hidden');assert.ok(h.controls.every(e=>!e.disabled),label+': 2D controls stay usable');assert.match(h.q('#mode').textContent,/Кадр/);assert.match(h.q('#status').textContent,/Кадр/);assert.equal(h.raf.size,0,label+': animation frames cancelled');assert.ok(h.renderers.at(-1)?.disposed>0,label+': renderer disposed')}

// A useful image transformation is available before WebGL is requested.
{
 const h=harness();assert.equal(h.loadCalls,0);assert.ok(h.controls.every(e=>!e.disabled));assert.match(h.q('#result').textContent,/Кадр сцены.*100%.*без дождя/);
 await h.q('[data-process="atmosphere"]').emit('click');assert.equal(h.q('#poster').style['--light'],'1.3');assert.ok(h.q('.sanctuary').classList.contains('raining'));assert.match(h.q('#result').textContent,/130%.*дождь/);
 await h.q('[data-process="result"]').emit('click');assert.equal(h.q('#poster').style['--scale'],'1.6');assert.equal(h.q('[data-view="4"]').getAttribute('aria-pressed'),'true');assert.match(h.q('#result').textContent,/храм/);
 await h.q('#pause').emit('click');assert.ok(h.q('.sanctuary').classList.contains('paused'));
 await h.q('#reset').emit('click');assert.equal(h.q('#poster').style['--light'],'1');assert.equal(h.q('#poster').style['--scale'],'1');assert.ok(!h.q('.sanctuary').classList.contains('raining'));assert.equal(h.loadCalls,0,'Poster lessons must not initialize WebGL');
 console.log('PASS real-scene poster before import: atmosphere, framing, pause and repeatable reset');
}
{
 const h=harness({reducedMotion:true});assert.ok(h.q('.sanctuary').classList.contains('paused'),'Reduced-motion preference pauses rain at initialization');assert.equal(h.q('#pause').getAttribute('aria-pressed'),'true');
 const pending=h.click();h.release();await h.drive(pending);assert.deepEqual({...h.renderers[0].options},{quality:'low',post:false},'Default profile must compile the fast real 3D scene');assert.equal(h.renderers[0].paused,true,'Reduced-motion 3D starts with a frozen animation clock');assert.equal(h.raf.size,0);
 console.log('PASS reduced-motion initial state and frozen 3D clock');
}
// Delayed imports cannot activate the stage; a double click must not import twice.
{
 const h=harness(),pending=h.click();await microtasks();assert.equal(h.loadCalls,1);assert.equal(h.renderers.length,0);assert.equal(h.q('#enter').disabled,true);assert.equal(h.q('.sanctuary').classList.contains('ready'),false);assert.ok(h.controls.every(e=>!e.disabled),'2D stays usable while import loads');await h.q('[data-view="4"]').emit('click');h.q('#light').value='140';await h.q('#light').emit('input');await h.q('#rain').emit('click');await h.click();assert.equal(h.loadCalls,1,'Busy double-click must not initialize twice');h.release();await h.drive(pending);assert.equal(h.renderers.length,1);assert.equal(h.renderers[0].view,4,'Loading changes must reach 3D');assert.equal(h.renderers[0].light,1.4);assert.equal(h.renderers[0].rain,true);assert.ok(h.firstDraw);assert.ok(h.timeline.indexOf('render-success')<h.timeline.indexOf('ready'),'First render must succeed before ready hides the fallback');assert.equal(h.q('.sanctuary').classList.contains('ready'),true);assert.ok(h.controls.every(e=>!e.disabled));
 console.log('PASS delayed import, duplicate click and first-frame readiness');
}
// Initial render failure must leave a usable retry, not a stale truthy renderer.
{
 const h=harness({failAt:[1]}),pending=h.click();h.release();await h.drive(pending);failedState(h,'first-frame failure');assert.ok(!h.timeline.includes('ready'),'Failed first frame must never mark stage ready');await h.drive(h.click());assert.equal(h.renderers.length,2,'Retry must create a new renderer');assert.equal(h.q('.sanctuary').classList.contains('ready'),true);assert.ok(h.controls.every(e=>!e.disabled));
 console.log('PASS first-render failure cleanup and working retry');
}
// Animation failures occur outside the async click handler and need their own guard.
{
 const h=harness({failAt:[2]}),pending=h.click();h.release();await h.drive(pending);assert.equal(h.q('.sanctuary').classList.contains('ready'),true);await h.tick();failedState(h,'later-frame failure');await h.drive(h.click());assert.equal(h.renderers.length,2,'Retry after a frame error must recreate renderer');assert.equal(h.q('.sanctuary').classList.contains('ready'),true);
 console.log('PASS later animation-frame failure cleanup and working retry');
}
// Context loss must release stage ownership and leave an explicit user recovery.
{
 const h=harness(),pending=h.click();h.release();await h.drive(pending);assert.ok((h.q('#world').listeners.get('webglcontextlost')||[]).length,'Canvas must handle WebGL context loss');const prevented=await h.q('#world').emit('webglcontextlost');assert.equal(prevented,true,'Context loss default must be prevented for restoration');failedState(h,'context loss');
 console.log('PASS WebGL context-loss cleanup');
}
// Paused UI changes may redraw but must keep the renderer clock frozen.
{
 const h=harness(),pending=h.click();h.release();await h.drive(pending);const r=h.renderers[0];assert.equal(r.paused,false);
 await h.q('#pause').emit('click');assert.equal(r.paused,true);assert.equal(h.raf.size,0);const before=r.calls;
 h.q('#light').value='60';await h.q('#light').emit('input');assert.ok(r.calls>before,'Changing light redraws a paused frame');assert.equal(r.paused,true);assert.equal(h.raf.size,0);
 const resets=r.timingResets;h.q('document').hidden=true;await h.q('document').emit('visibilitychange');h.q('document').hidden=false;await h.q('document').emit('visibilitychange');assert.equal(r.timingResets,resets+2,'Visibility boundaries reset renderer timing');assert.equal(r.paused,true);
 await h.q('#pause').emit('click');assert.equal(r.paused,false);assert.ok(h.raf.size>0);
 const cached=r.timingResets;await h.q('window').emit('pageshow',{persisted:true});assert.equal(r.timingResets,cached+1,'Back-forward cache restore resets timing');
 console.log('PASS pause/light-control wiring and visibility/bfcache timing reset');
}
// Returning to the source illustration must preserve current controls and dispose 3D.
{
 const h=harness(),pending=h.click();h.release();await h.drive(pending);await h.q('[data-process="result"]').emit('click');await h.q('#flat-mode').emit('click');assert.equal(h.q('.sanctuary').classList.contains('ready'),false);assert.ok(h.renderers[0].disposed>0);assert.match(h.q('#result').textContent,/Кадр сцены.*храм.*130%.*дождь/);assert.equal(h.raf.size,0);assert.ok(h.controls.every(e=>!e.disabled));
 console.log('PASS explicit return to the real-scene poster preserves transformation');
}
// A slow or hung module must leave both an immediate cancel and a bounded loading state.
{
 const h=harness(),pending=h.click();await microtasks();assert.equal(h.q('#cancel-start').hidden,false);assert.equal(h.q('#cancel-start').disabled,false);assert.equal(h.q('.scene-frame').getAttribute('aria-busy'),'true');
 await h.advance(11999);assert.equal(h.q('#enter').disabled,true,'Deadline must not expire early');await h.advance(1);await h.drive(pending);
 assert.equal(h.q('#enter').disabled,false);assert.equal(h.q('#cancel-start').hidden,true);assert.equal(h.q('.scene-frame').getAttribute('aria-busy'),'false');assert.match(h.q('#status').textContent,/12 секунд/);assert.equal(h.renderers.length,0);assert.equal(h.timers.size,0);
 h.release();await microtasks();await h.tick();assert.equal(h.renderers.length,0,'A late timed-out module cannot construct WebGL');
 await h.drive(h.click());assert.equal(h.renderers.length,1,'A user retry may reuse the now loaded module');assert.equal(h.q('.sanctuary').classList.contains('ready'),true);
 console.log('PASS hung import deadline, late-resolution invalidation and explicit retry');
}
// Cancelling an import and retrying immediately must not let the old finally reset newer loading UI.
{
 const h=harness(),first=h.newLoad(),second=h.newLoad(),pending=h.click();await microtasks();await h.q('[data-view="4"]').emit('click');h.q('#light').value='60';await h.q('#light').emit('input');await h.q('#rain').emit('click');await h.q('#cancel-start').emit('click');await h.drive(pending);
 assert.equal(h.q('#enter').disabled,false);assert.equal(h.q('#cancel-start').hidden,true);assert.match(h.q('#result').textContent,/Кадр сцены.*храм.*60%.*дождь/);assert.equal(h.renderers.length,0);assert.equal(h.timers.size,0);
 const retry=h.click();await microtasks();first.resolve({createTempleNightRenderer(){throw new Error('Stale attempt constructed renderer')}});await microtasks();assert.equal(h.q('#enter').disabled,true,'Old attempt must not clear a newer busy state');assert.equal(h.renderers.length,0);
 second.resolve({createTempleNightRenderer:()=>({quality:'low',setPaused(){},setRain(){},setLight(){},setView(){},render(){},dispose(){}})});await h.drive(retry);assert.equal(h.q('.sanctuary').classList.contains('ready'),true);assert.equal(h.q('#enter').disabled,false);assert.equal(h.q('#cancel-start').hidden,true);
 console.log('PASS cancellation, preserved poster controls and stale-attempt/new-retry isolation');
}
// A rejected download must restore the poster and not leave an unhandled promise or deadline.
{
 const h=harness(),pending=h.click();h.load.reject(new Error('Injected import network failure'));await h.drive(pending);assert.equal(h.q('#enter').disabled,false);assert.equal(h.q('.sanctuary').classList.contains('ready'),false);assert.equal(h.q('#cancel-start').hidden,true);assert.match(h.q('#status').textContent,/не запустилось/);assert.equal(h.timers.size,0);assert.equal(h.renderers.length,0);
 console.log('PASS import rejection restores an actionable poster');
}
// A browser may retain a failed import URL; a retry uses a new local URL and then caches success.
{
 const h=harness(),first=h.newLoad(),second=h.newLoad(),pending=h.click();first.reject(new Error('Injected failed module download'));await h.drive(pending);assert.equal(h.q('#enter').disabled,false);
 const retry=h.click();await microtasks();assert.equal(h.loadURLs.length,2);assert.notEqual(h.loadURLs[0],h.loadURLs[1],'Network retry must not reuse the failed browser module-map key');assert.match(h.loadURLs[0],/^\.\/temple-renderer\.js\?v=polish2&attempt=1$/);assert.match(h.loadURLs[1],/^\.\/temple-renderer\.js\?v=polish2&attempt=2$/);
 h.release(second);await h.drive(retry);assert.equal(h.q('.sanctuary').classList.contains('ready'),true);await h.q('#flat-mode').emit('click');await h.drive(h.click());assert.equal(h.renderers.length,2);assert.equal(h.loadCalls,2,'Successful module exports must be reused for later renderer restarts');
 console.log('PASS failed-download retry uses a fresh module URL and successful exports are cached');
}
// A hidden document cannot hang on throttled animation frames or initialize 3D in the background.
{
 const h=harness(),pending=h.click();await microtasks();h.q('document').hidden=true;await h.q('document').emit('visibilitychange');await h.drive(pending);h.release();await microtasks();assert.equal(h.renderers.length,0);assert.equal(h.q('#enter').disabled,false);assert.match(h.q('#status').textContent,/страница была скрыта/);assert.equal(h.timers.size,0);
 h.q('document').hidden=false;await h.q('document').emit('visibilitychange');assert.equal(h.renderers.length,0,'Visibility restoration requires an explicit restart');await h.drive(h.click());assert.equal(h.q('.sanctuary').classList.contains('ready'),true);
 console.log('PASS hidden-tab cancellation and explicit visible restart');
}
// The elapsed limit is checked after synchronous setup, which no JS timer can preempt.
{
 const h=harness({createDelay:12001}),pending=h.click();h.release();await h.drive(pending);failedState(h,'synchronous over-deadline setup');assert.match(h.q('#status').textContent,/12 секунд/);assert.ok(!h.timeline.includes('ready'),'An over-deadline first frame cannot hide the usable poster');assert.equal(h.timers.size,0);
 console.log('PASS post-constructor elapsed deadline check (not a preemptive GPU watchdog)');
}
console.log('LIMIT: host lifecycle simulation only; this does not validate browser rendering, GLSL or GPU support.');
