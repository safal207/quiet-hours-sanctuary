const q = selector => document.querySelector(selector);
const sanctuary = q('.sanctuary');
const scene = q('.scene-frame');
const views = { 0: { label: 'ворота', scale: 1, x: '0%', y: '0%' }, 2: { label: 'сад', scale: 1.22, x: '-8%', y: '0%' }, 4: { label: 'храм', scale: 1.6, x: '0%', y: '-4%' } };
let renderer, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let raining = false, selectedView = 0, light = 100, raf = 0, busy = false;

function stopFrames() {
  cancelAnimationFrame(raf);
  raf = 0;
}
function describe() {
  const mode = renderer ? '3D-сцена' : '2D-иллюстрация';
  q('#mode').textContent = renderer ? '3D · объёмная сцена' : '2D · иллюстрация';
  q('#scene-caption').textContent = `${views[selectedView].label} · свет ${light}%`;
  q('#result').textContent = `${mode} · ${views[selectedView].label} · свет ${light}% · ${raining ? 'дождь' : 'без дождя'}${!playing ? ' · движение остановлено' : ''}`;
}
function syncFallback() {
  const view = views[selectedView];
  q('#poster').style.setProperty('--scale', view.scale);
  q('#poster').style.setProperty('--shift-x', view.x);
  q('#poster').style.setProperty('--shift-y', view.y);
  q('#poster').style.setProperty('--light', light / 100);
  sanctuary.classList.toggle('raining', raining);
  sanctuary.classList.toggle('paused', !playing);
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.view) === selectedView));
  q('#rain').setAttribute('aria-pressed', raining);
  q('#light').value = String(light);
  q('#light-value').textContent = light + '%';
  q('#pause').textContent = playing ? 'Ⅱ Пауза' : '▷ Движение';
  q('#pause').setAttribute('aria-pressed', !playing);
  describe();
}
function releaseRenderer() {
  stopFrames();
  const previous = renderer;
  renderer = null;
  sanctuary.classList.remove('ready');
  q('#flat-mode').hidden = true;
  try { previous?.dispose(); } catch {}
  syncFallback();
}
function fail(error) {
  releaseRenderer();
  q('#enter').disabled = false;
  q('#safe-start').disabled = false;
  q('#enter').textContent = 'Повторить 3D ↗';
  q('#status').textContent = '3D недоступно — продолжайте в 2D: свет, дождь и кадр работают. Можно повторить облегчённый запуск.';
  console.error('Quiet Hours: scene stopped', error);
}
function frame(time) {
  raf = 0;
  if (!renderer || document.hidden || !playing) return;
  try {
    renderer.render(time);
    raf = requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}
function updateFrame() {
  if (!renderer) return;
  try {
    renderer.render(performance.now());
    if (playing && !document.hidden && !raf) raf = requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}
function applyState() {
  syncFallback();
  if (!renderer) return;
  try {
    renderer.setView(selectedView);
    renderer.setRain(raining);
    renderer.setLight(light / 100);
    updateFrame();
  } catch (error) { fail(error); }
}
async function enter(options = {}) {
  if (busy || renderer) return;
  busy = true;
  q('#enter').disabled = true;
  q('#safe-start').disabled = true;
  q('#status').textContent = 'Собираем 3D-сцену… 2D остаётся доступным. Первый запуск может занять несколько секунд.';
  try {
    const { createTempleNightRenderer } = await import('./temple-renderer.js?v=light4');
    // Let the loading message paint before generating procedural textures.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    renderer = createTempleNightRenderer(q('#world'), options);
    renderer.setPaused?.(!playing);
    renderer.setRain(raining);
    renderer.setLight(light / 100);
    renderer.setView(selectedView);
    renderer.render(performance.now());
    // Reveal the canvas only after the first frame succeeds.
    sanctuary.classList.add('ready');
    q('#flat-mode').hidden = false;
    q('#status').textContent = renderer.quality === 'low' ? 'Работает облегчённая 3D-сцена. Те же параметры теперь меняют объёмный сад.' : 'Работает 3D-сцена. Двигайте указателем и меняйте параметры сада.';
    syncFallback();
    if (playing && !document.hidden) raf = requestAnimationFrame(frame);
  } catch (error) { fail(error); }
  finally {
    busy = false;
    q('#enter').disabled = false;
    q('#safe-start').disabled = false;
  }
}
q('#enter').addEventListener('click', () => enter());
q('#safe-start').addEventListener('click', () => enter({ quality: 'low', post: false }));
q('#flat-mode').addEventListener('click', () => {
  releaseRenderer();
  q('#status').textContent = 'Вы вернулись к 2D-иллюстрации. Параметры сохранены; можно сравнить оба режима.';
});
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  selectedView = Number(button.dataset.view);
  applyState();
}));
q('#rain').addEventListener('click', () => { raining = !raining; applyState(); });
q('#light').addEventListener('input', event => { light = Number(event.target.value); applyState(); });
q('#pause').addEventListener('click', () => {
  playing = !playing;
  renderer?.setPaused?.(!playing);
  if (!playing) stopFrames();
  syncFallback();
  if (playing) updateFrame();
});
function preset(step) {
  selectedView = step === 'result' ? 4 : 0;
  light = step === 'original' ? 100 : 130;
  raining = step !== 'original';
  applyState();
}
q('#reset').addEventListener('click', () => preset('original'));
document.querySelectorAll('[data-process]').forEach(button => button.addEventListener('click', () => {
  preset(button.dataset.process);
  scene.focus({ preventScroll: true });
  scene.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}));
scene.addEventListener('pointermove', event => {
  const rect = scene.getBoundingClientRect();
  renderer?.setPointer((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
  if (!playing) updateFrame();
});
scene.addEventListener('pointerleave', () => {
  renderer?.setPointer(0, 0, false);
  if (!playing) updateFrame();
});
window.addEventListener('resize', () => {
  try { renderer?.resize(); updateFrame(); } catch (error) { fail(error); }
});
q('#world').addEventListener('webglcontextlost', event => {
  event.preventDefault();
  fail(new Error('WebGL context lost'));
});
q('#world').addEventListener('webglcontextrestored', () => {
  if (!renderer) q('#status').textContent = 'WebGL восстановлен. Продолжайте в 2D или повторите облегчённый 3D-запуск.';
});
document.addEventListener('visibilitychange', () => {
  renderer?.resetTiming?.();
  if (document.hidden) stopFrames(); else updateFrame();
});
window.addEventListener('pagehide', event => {
  stopFrames();
  if (!event.persisted) { renderer?.dispose(); renderer = null; }
});
window.addEventListener('pageshow', event => {
  if (event.persisted) { renderer?.resetTiming?.(); updateFrame(); }
});
syncFallback();
