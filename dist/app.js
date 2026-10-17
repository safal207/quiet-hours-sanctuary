const q = selector => document.querySelector(selector);
const sanctuary = q('.sanctuary');
const controls = () => document.querySelectorAll('.controls button,.controls input');
let renderer, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let raining = true, raf = 0, busy = false;

function stopFrames() {
  cancelAnimationFrame(raf);
  raf = 0;
}
function fail(error) {
  stopFrames();
  const failedRenderer = renderer;
  renderer = null;
  sanctuary.classList.remove('ready');
  controls().forEach(element => element.disabled = true);
  q('#enter').disabled = false;
  q('#safe-start').disabled = false;
  q('#enter').textContent = 'Попробовать ещё раз ↗';
  q('#status').textContent = 'Не удалось запустить 3D. Попробуйте облегчённый запуск ниже. Заставка остаётся доступной.';
  try { failedRenderer?.dispose(); } catch {}
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
async function enter(options = {}) {
  if (busy || renderer) return;
  busy = true;
  q('#enter').disabled = true;
  q('#safe-start').disabled = true;
  q('#status').textContent = 'Собираем ночной сад… Первый запуск может занять несколько секунд.';
  try {
    const { createTempleNightRenderer } = await import('./temple-renderer.js?v=2');
    // Let the loading message paint before generating procedural textures.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    renderer = createTempleNightRenderer(q('#world'), options);
    renderer.setRain(raining);
    renderer.setLight(Number(q('#light').value) / 100);
    const selectedView = [...document.querySelectorAll('[data-view]')].find(button => button.getAttribute('aria-pressed') === 'true');
    renderer.setView(Number(selectedView?.dataset.view || 0));
    renderer.render(performance.now());
    // Reveal the canvas only after the first frame succeeds.
    sanctuary.classList.add('ready');
    controls().forEach(element => element.disabled = false);
    q('#status').textContent = renderer.quality === 'low' ? 'Облегчённый режим. Выберите точку обзора.' : 'Выберите точку обзора внизу.';
    q('#pause').textContent = playing ? 'Ⅱ Пауза' : '▷ Движение';
    q('#pause').setAttribute('aria-pressed', !playing);
    if (playing && !document.hidden) raf = requestAnimationFrame(frame);
  } catch (error) { fail(error); }
  finally { busy = false; }
}
q('#enter').addEventListener('click', () => enter());
q('#safe-start').addEventListener('click', () => enter({ quality: 'low', post: false }));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  renderer?.setView(Number(button.dataset.view));
  document.querySelectorAll('[data-view]').forEach(other => other.setAttribute('aria-pressed', other === button));
  updateFrame();
}));
q('#rain').addEventListener('click', () => {
  raining = !raining;
  renderer?.setRain(raining);
  q('#rain').setAttribute('aria-pressed', raining);
  updateFrame();
});
q('#light').addEventListener('input', event => {
  renderer?.setLight(Number(event.target.value) / 100);
  q('#light-value').textContent = event.target.value + '%';
  updateFrame();
});
q('#pause').addEventListener('click', () => {
  playing = !playing;
  q('#pause').setAttribute('aria-pressed', !playing);
  q('#pause').textContent = playing ? 'Ⅱ Пауза' : '▷ Движение';
  if (!playing) stopFrames(); else updateFrame();
});
sanctuary.addEventListener('pointermove', event => {
  const rect = sanctuary.getBoundingClientRect();
  renderer?.setPointer((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
  if (!playing) updateFrame();
});
sanctuary.addEventListener('pointerleave', () => {
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
  if (!renderer) q('#status').textContent = '3D снова доступно. Нажмите «Облегчённый запуск».';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopFrames(); else updateFrame();
});
window.addEventListener('pagehide', event => {
  stopFrames();
  if (!event.persisted) { renderer?.dispose(); renderer = null; }
});
window.addEventListener('pageshow', event => { if (event.persisted) updateFrame(); });
