const sceneName=document.body.dataset.scene;
const params=new URLSearchParams(location.search);
const qa=params.get('qa')==='1';
if(window.parent!==window)document.querySelector('header a').hidden=true;
const canvas=document.querySelector('canvas');
const status=document.querySelector('.status');
const slider=document.querySelector('#light');
const output=document.querySelector('output');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let world,state,preset,validate,raf=0,parentActive=true,intersecting=true,disposed=false;
const active=()=>parentActive&&intersecting&&!document.hidden&&!disposed;
const hooks={ready:false,error:null,scene:sceneName,quality:'low',postprocessing:false,active:false,frames:0};
window.__preview=hooks;
function notify(type,detail={}){
  let origin;try{origin=new URL(document.referrer).origin}catch{return}
  if(origin===location.origin||origin==='https://safal207.github.io')parent.postMessage({type,scene:sceneName,...detail},origin);
}
function stop(){cancelAnimationFrame(raf);raf=0;world?.setPaused?.(true);hooks.active=false}
function render(now=performance.now()){
  if(!world||disposed)return;
  if(sceneName==='temple')world.render(now);else world.update(state);
  hooks.frames++;
}
function fail(error){
  stop();hooks.ready=false;hooks.error=error.message||String(error);document.body.dataset.ready='false';
  status.textContent='3D не запустилось. Посмотрите превью или откройте проект.';
  const fallback=document.querySelector('.fallback');fallback.src=fallback.dataset.src;fallback.hidden=false;
  document.querySelector('.retry').hidden=false;
  world?.dispose?.();world=null;
  notify('designlab:preview-error');
}
function tick(now){raf=0;if(!active()||!world)return;try{render(now)}catch(error){fail(error);return}if(!qa&&!reduced&&sceneName==='temple')raf=requestAnimationFrame(tick)}
function sync(){
  stop();if(!world||!active())return;
  hooks.active=true;world.resetTiming?.();world.setPaused?.(qa||reduced);
  if(!qa&&!reduced&&sceneName==='temple')raf=requestAnimationFrame(tick);
}
function setLight(value){
  const n=Math.max(Number(slider.min),Math.min(Number(slider.max),Number(value)));
  slider.value=n;output.value=n+'%';
  if(sceneName==='temple')world?.setLight(n/100);else if(state){state.brightness=n;world?.update(state)}
  if(world)render(qa?1000:performance.now());
}
function setView(value){
  const selected=String(value);document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===selected)));
  if(sceneName==='temple')world?.setView(Number(value));else world?.view(value==='plan');
  if(world)render(qa?1000:performance.now());
}
function setPreset(name){
  if(sceneName!=='room')return;
  state=preset(name);slider.value=state.brightness;output.value=state.brightness+'%';world.update(state);hooks.preset=state.scene;
}
Object.assign(hooks,{render,setLight,setView,setPreset,getState:()=>state?structuredClone(state):null,setState(value){if(sceneName!=='room')return;state=validate(value);slider.value=state.brightness;output.value=state.brightness+'%';world.update(state)},setActive(value){parentActive=Boolean(value);sync()}});
async function boot(){
  try{
    if(sceneName==='room'){
      const modules=await Promise.all([import('./room.js?v=preview-light-1'),import('./state.js')]);
      preset=modules[1].preset;validate=modules[1].validate;state=preset('evening');world=modules[0].createRoom(canvas);world.setErrorHandler?.(fail);world.update(state);
    }else{
      const {createTempleNightRenderer}=await import('./temple-renderer.js?v=preview-light-1');
      const quality=params.get('quality')==='high'?'high':'low';
      world=createTempleNightRenderer(canvas,{quality,post:quality==='high'});
      hooks.quality=world.quality;hooks.postprocessing=world.postprocessing;
      world.setPaused?.(qa||reduced);world.setRain(false);world.setView(0);world.setLight(1);
    }
    render(1000);if(!world||hooks.error)throw new Error(hooks.error||'Renderer unavailable');hooks.ready=true;document.body.dataset.ready='true';status.textContent='';
    setLight(slider.value);sync();notify('designlab:preview-ready');
  }catch(error){fail(error)}
}
slider.addEventListener('input',()=>{try{setLight(slider.value)}catch(error){fail(error)}});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{try{setView(button.dataset.view)}catch(error){fail(error)}}));
document.querySelector('.retry').addEventListener('click',()=>location.reload());
window.addEventListener('message',event=>{
  if(event.source!==window.parent||![location.origin,'https://safal207.github.io'].includes(event.origin))return;
  if(event.data?.type==='designlab:visibility'&&typeof event.data.active==='boolean'){parentActive=event.data.active;sync()}
});
document.addEventListener('visibilitychange',sync);
const observer=new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;sync()});observer.observe(canvas);
const resizeObserver=new ResizeObserver(()=>{if(!world||disposed)return;try{world.resize();if(active())render(qa?1000:performance.now())}catch(error){fail(error)}});resizeObserver.observe(canvas);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail(new Error('WebGL context lost'))});
window.addEventListener('pagehide',event=>{stop();if(!event.persisted){disposed=true;observer.disconnect();resizeObserver.disconnect();world?.dispose?.()}});
window.addEventListener('pageshow',()=>sync());
boot();
