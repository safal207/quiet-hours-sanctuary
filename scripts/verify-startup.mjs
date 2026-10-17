/** Node-only host lifecycle checks. No browser, DOM engine, Canvas2D or GPU is used. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const appPath=path.resolve(process.argv[2]||new URL('../dist/app.js',import.meta.url).pathname);
const original=fs.readFileSync(appPath,'utf8');
const source=original.replace(/import\(\s*['"]\.\/temple-renderer\.js(?:\?[^'"]*)?['"]\s*\)/g,'__loadRenderer()');
assert.notEqual(source,original,'Harness must replace the temple dynamic import; update matcher if module path changed.');
const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}

function harness({failAt=[]}={}){
 const timeline=[],elements=new Map(),raf=new Map(),renderers=[],errors=[],load=deferred();let nextRaf=0,time=0,loadCalls=0,firstDraw=false;
 class Element{
  constructor(selector){this.selector=selector;this.listeners=new Map();this.attributes=new Map();this.style={};this.dataset={};this.disabled=false;this.hidden=false;this.textContent='';this.value='100';this.clientWidth=1280;this.clientHeight=850;this.width=1280;this.height=850;this.isConnected=true;const classes=new Set();this.classList={add:(...xs)=>{for(const x of xs){classes.add(x);if(selector==='.sanctuary'&&x==='ready')timeline.push('ready')}},remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,force)=>{const on=force===undefined?!classes.has(x):force;if(on)classes.add(x);else classes.delete(x);return on}}}
  addEventListener(type,fn){const a=this.listeners.get(type)||[];a.push(fn);this.listeners.set(type,a)}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x!==fn))}
  setAttribute(k,v){this.attributes.set(k,String(v))}getAttribute(k){return this.attributes.get(k)??null}removeAttribute(k){this.attributes.delete(k)}
  getBoundingClientRect(){return{left:0,top:0,width:this.clientWidth,height:this.clientHeight,right:this.clientWidth,bottom:this.clientHeight}}
  focus(){}replaceWith(other){elements.set(this.selector,other)}cloneNode(){return new Element(this.selector)}
  async emit(type,extra={}){let prevented=false;const event={type,target:this,currentTarget:this,persisted:false,preventDefault(){prevented=true},...extra};for(const fn of this.listeners.get(type)||[])await fn(event);return prevented}
 }
 const q=s=>{if(!elements.has(s))elements.set(s,new Element(s));return elements.get(s)};
 const controls=['[data-view="0"]','[data-view="2"]','[data-view="4"]','#rain','#pause','#light'].map(q);controls.forEach(e=>e.disabled=true);const views=controls.slice(0,3);views.forEach((e,i)=>e.dataset.view=String(i*2));
 q('#enter').textContent='Войти в сад';q('#status').textContent='3D-сцена загрузится после нажатия.';
 function queryAll(s){if(s.includes('data-view'))return views;if(s.includes('.controls'))return controls;return[]}
 q('.controls').querySelectorAll=queryAll;
 const document=q('document');document.hidden=false;document.querySelector=q;document.querySelectorAll=queryAll;document.createElement=tag=>new Element(tag);
 const window=q('window');window.innerWidth=1280;window.innerHeight=850;
 function create(){const index=renderers.length;const r={calls:0,disposed:0,reducedMotion:false,render(){this.calls++;timeline.push('render-attempt');if(this.calls===failAt[index])throw new Error('Injected render failure #'+index+':'+this.calls);firstDraw=true;timeline.push('render-success')},dispose(){this.disposed++;timeline.push('dispose')},resize(){},setPointer(){},setView(){},setRain(){},setLight(){},getQuality(){return'balanced'}};renderers.push(r);timeline.push('create');return r}
 const context={document,window,location:{search:'',href:'https://example.test/'},navigator:{hardwareConcurrency:4},URLSearchParams,URL,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),performance:{now:()=>time},requestAnimationFrame(fn){const id=++nextRaf;raf.set(id,fn);return id},cancelAnimationFrame(id){raf.delete(id)},setTimeout,clearTimeout,queueMicrotask,console:{error:(...a)=>errors.push(a),warn:(...a)=>errors.push(a),log(){}},__loadRenderer(){loadCalls++;return load.promise},ResizeObserver:class{observe(){}disconnect(){}}};
 window.matchMedia=context.matchMedia;window.requestAnimationFrame=context.requestAnimationFrame;window.cancelAnimationFrame=context.cancelAnimationFrame;
 vm.runInNewContext(source,context,{filename:appPath});
 async function tick(){await microtasks();const batch=[...raf];raf.clear();time+=16;for(const[,fn]of batch)fn(time);await microtasks()}
 async function drive(promise){let done=false,rejection;promise.then(()=>done=true,e=>{done=true;rejection=e});for(let i=0;i<30&&!done;i++){await microtasks();if(!done)await tick()}assert.ok(done,'Host operation did not finish after 30 frame/microtask cycles');if(rejection)throw rejection;await microtasks()}
 return{q,controls,renderers,errors,raf,timeline,load,get loadCalls(){return loadCalls},get firstDraw(){return firstDraw},release(){load.resolve({createTempleNightRenderer:create})},tick,drive,click:()=>q('#enter').emit('click')};
}
function failedState(h,label){assert.equal(h.q('.sanctuary').classList.contains('ready'),false,label+': ready removed');assert.equal(h.q('#enter').disabled,false,label+': retry enabled');assert.equal(h.q('#enter').hidden,false,label+': retry not hidden');assert.ok(h.controls.every(e=>e.disabled),label+': controls disabled');assert.equal(h.raf.size,0,label+': animation frames cancelled');assert.ok(h.renderers.at(-1)?.disposed>0,label+': renderer disposed')}

// Delayed imports cannot activate the stage; a double click must not import twice.
{
 const h=harness(),pending=h.click();await microtasks();assert.equal(h.loadCalls,1);assert.equal(h.renderers.length,0);assert.equal(h.q('#enter').disabled,true);assert.equal(h.q('.sanctuary').classList.contains('ready'),false);assert.ok(h.controls.every(e=>e.disabled));await h.click();assert.equal(h.loadCalls,1,'Busy double-click must not initialize twice');h.release();await h.drive(pending);assert.equal(h.renderers.length,1);assert.ok(h.firstDraw);assert.ok(h.timeline.indexOf('render-success')<h.timeline.indexOf('ready'),'First render must succeed before ready hides the fallback');assert.equal(h.q('.sanctuary').classList.contains('ready'),true);assert.ok(h.controls.every(e=>!e.disabled));
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
console.log('LIMIT: host lifecycle simulation only; this does not validate browser rendering, GLSL or GPU support.');
