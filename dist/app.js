const q = selector => document.querySelector(selector);
const sanctuary = q('.sanctuary');
const scene = q('.scene-frame');
const views = { 0: { label: 'ворота', scale: 1, x: '0%', y: '0%' }, 2: { label: 'сад', scale: 1.22, x: '-8%', y: '0%' }, 4: { label: 'храм', scale: 1.6, x: '0%', y: '-4%' } };
let renderer, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let raining = false, selectedView = 0, light = 100, raf = 0, busy = false;
const STARTUP_LIMIT_MS = 12000;
let startup = null;

class StartupStopped extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}
function setBusy(value) {
  busy = value;
  if (value) q('#safe-start').hidden = true;
  q('#enter').disabled = value;
  q('#safe-start').disabled = value;
  q('#cancel-start').hidden = !value;
  q('#cancel-start').disabled = !value;
  scene.setAttribute('aria-busy', value);
}
function finishStartup(attempt) {
  clearTimeout(attempt.timer);
  clearTimeout(attempt.paintTimer);
  if (startup === attempt) { startup = null; setBusy(false); }
}
function stopStartup(kind, message) {
  const attempt = startup;
  if (!attempt) return false;
  attempt.stopped = true;
  startup = null;
  clearTimeout(attempt.timer);
  clearTimeout(attempt.paintTimer);
  setBusy(false);
  attempt.interrupt(new StartupStopped(kind, message));
  return true;
}
function cancelStartup(message = 'Запуск остановлен. Кадр и параметры сохранены. Можно снова рассмотреть сцену в 3D.') {
  if (!stopStartup('cancelled', message)) return;
  releaseRenderer();
  q('#status').textContent = message;
}

function stopFrames() {
  cancelAnimationFrame(raf);
  raf = 0;
}
function describe() {
  const mode = renderer ? '3D-сцена' : 'Кадр сцены';
  q('#mode').textContent = renderer ? '3D · объёмная сцена' : 'Кадр 3D-сцены';
  q('#scene-caption').textContent = `${renderer ? '' : 'кадр · '}${views[selectedView].label} · свет ${light}%`;
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
  stopStartup('failed', '3D остановлено');
  setBusy(false);
  q('#safe-start').hidden = false;
  q('#enter').textContent = 'Повторить 3D ↗';
  q('#status').textContent = error?.kind === 'timeout'
    ? 'Загрузка 3D заняла больше 12 секунд. Кадр и настройки сохранены. Можно повторить запуск или продолжить с кадром.'
    : '3D не запустилось. Кадр сцены остаётся доступным: можно менять его крупность, свет и дождь или повторить запуск.';
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
  const attempt = { stopped: false, started: performance.now(), timer: 0, paintTimer: 0 };
  const interrupted = new Promise((resolve, reject) => { attempt.interrupt = reject; });
  startup = attempt;
  setBusy(true);
  attempt.timer = setTimeout(() => {
    if (startup !== attempt) return;
    stopStartup('timeout', '3D startup deadline exceeded');
    releaseRenderer();
    q('#safe-start').hidden = false;
    q('#enter').textContent = 'Повторить 3D ↗';
    q('#status').textContent = 'Загрузка 3D заняла больше 12 секунд. Кадр и настройки сохранены. Можно повторить запуск или продолжить с кадром.';
  }, STARTUP_LIMIT_MS);
  const current = () => startup === attempt && !attempt.stopped;
  const wait = promise => Promise.race([promise, interrupted]);
  q('#status').textContent = 'Открываем объёмную сцену… Кадр и настройки доступны. Запуск можно остановить.';
  try {
    const { createTempleNightRenderer } = await wait(import('./temple-renderer.js?v=polish1'));
    if (!current()) return;
    // A timer yields to the UI without depending on animation frames, which stop in hidden tabs.
    await wait(new Promise(resolve => { attempt.paintTimer = setTimeout(resolve, 0); }));
    if (!current()) return;
    // The first frame uses the fast profile on every device; it avoids bloom compilation at startup.
    const created = createTempleNightRenderer(q('#world'), { ...options, quality: 'low', post: false });
    if (!current()) { created.dispose(); return; }
    renderer = created;
    renderer.setPaused?.(!playing);
    renderer.setRain(raining);
    renderer.setLight(light / 100);
    renderer.setView(selectedView);
    renderer.render(performance.now());
    // JavaScript cannot interrupt a synchronous WebGL constructor/render. Check the elapsed
    // deadline immediately afterwards, before the canvas can replace the usable poster.
    if (performance.now() - attempt.started >= STARTUP_LIMIT_MS) {
      throw new StartupStopped('timeout', '3D startup deadline exceeded');
    }
    if (!current()) { releaseRenderer(); return; }
    sanctuary.classList.add('ready');
    q('#flat-mode').hidden = false;
    q('#status').textContent = 'Объёмная сцена открыта. Выбирайте ракурс и свет; движение указателя меняет угол обзора.';
    syncFallback();
    if (playing && !document.hidden) raf = requestAnimationFrame(frame);
  } catch (error) {
    // An abandoned import may settle after a retry; it must not own the newer attempt or UI.
    if (current()) fail(error);
  } finally { finishStartup(attempt); }
}
q('#enter').addEventListener('click', () => enter());
q('#safe-start').addEventListener('click', () => enter({ quality: 'low', post: false }));
q('#cancel-start').addEventListener('click', () => cancelStartup());
q('#flat-mode').addEventListener('click', () => {
  releaseRenderer();
  q('#status').textContent = 'Вы вернулись к кадру 3D-сцены. Ракурс кадрирования, свет и дождь сохранены.';
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
  if (!renderer) q('#status').textContent = 'WebGL восстановлен. Кадр сцены доступен; можно повторить 3D-запуск.';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelStartup('Запуск остановлен, пока страница была скрыта. Кадр и настройки сохранены; 3D можно открыть снова.');
  renderer?.resetTiming?.();
  if (document.hidden) stopFrames(); else updateFrame();
});
window.addEventListener('pagehide', event => {
  cancelStartup();
  stopFrames();
  if (!event.persisted) { renderer?.dispose(); renderer = null; }
});
window.addEventListener('pageshow', event => {
  if (event.persisted) { renderer?.resetTiming?.(); updateFrame(); }
});
syncFallback();
setBusy(false);
