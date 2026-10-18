/** Real Three objects and render-pass contracts; GPU/Canvas2D drawing is mocked. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const directory = path.resolve(process.argv[2] || new URL('../dist/', import.meta.url).pathname);
const low = process.argv.includes('--low');
const realThree = await import(pathToFileURL(path.join(directory, 'vendor/three.module.js')));
const policy = await import(pathToFileURL(path.join(directory, 'render-policy.js')));
const gradient = { addColorStop() {} };
function canvas(width = 1, height = 1) {
  const element = {
    width, height, clientWidth: low ? 390 : 1280, clientHeight: 850, style: {},
    addEventListener() {}, removeEventListener() {}, getContext() { return context; },
  };
  element.parentElement = { clientWidth: element.clientWidth, clientHeight: element.clientHeight,
    getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; } };
  const context = new Proxy({
    canvas: element, createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    measureText: () => ({ width: 80 }),
  }, { get(target, key) { return key in target ? target[key] : () => {}; },
    set(target, key, value) { target[key] = value; return true; } });
  return element;
}
const gpu = { FRAMEBUFFER: 36160, FRAMEBUFFER_COMPLETE: 36053,
  checkFramebufferStatus: () => 36053, isContextLost: () => false, getError: () => 0 };
let draws = 0, additivePasses = 0, validatedSamplers = 0, lastRenderer, world, composite;
const checkedShaders = new Set();
function validateMaterial(material, target, autoClear, explicitlyCleared, fullScreen) {
  if (!material) return;
  const shader = (material.vertexShader || '') + '\n' + (material.fragmentShader || '');
  if (!checkedShaders.has(shader)) {
    for (const match of shader.matchAll(/smoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)) {
      assert.ok(Number(match[1]) < Number(match[2]), 'GLSL smoothstep must have ascending edges');
    }
    checkedShaders.add(shader);
  }
  for (const match of shader.matchAll(/uniform\s+sampler2D\s+(\w+)/g)) {
    const value = material.uniforms[match[1]]?.value;
    assert.ok(value?.isTexture, `sampler2D ${match[1]} needs a Texture, never a render target`);
    assert.notEqual(value, target?.texture, 'A post pass cannot sample its own draw buffer');
    validatedSamplers++;
  }
  if (fullScreen && material.blending === realThree.AdditiveBlending) {
    assert.equal(autoClear, false, 'Additive bloom cannot automatically clear previous levels');
    assert.equal(explicitlyCleared, false, 'Additive bloom must preserve the destination');
    additivePasses++;
  }
  if (material.uniforms?.uBloom) composite = material;
  if (low && material.isMeshBasicMaterial) {
    assert.equal(material.toneMapped, true, 'Direct-render emitters must respond to exposure');
  }
}
class MockRenderer {
  constructor({ canvas: element }) {
    this.domElement = element; this.capabilities = { getMaxAnisotropy: () => 4, isWebGL2: true, maxSamples: 4 };
    this.extensions = { has: () => true, get: () => ({}) }; this.shadowMap = {}; this.info = { render: {} };
    this.debug = {}; this.autoClear = true; lastRenderer = this;
  }
  setPixelRatio(value) { this.ratio = value; }
  getPixelRatio() { return this.ratio; }
  setSize(w, h) { this.domElement.width = w * this.ratio; this.domElement.height = h * this.ratio; }
  setClearColor() {}
  setRenderTarget(target) { this.target = target; this.explicitlyCleared = false; }
  getRenderTarget() { return this.target; }
  getContext() { return gpu; }
  clear() { this.explicitlyCleared = true; }
  render(scene) {
    draws++;
    const fullScreen = !scene.children.some(object => object.isPerspectiveCamera);
    if (!fullScreen) world = scene;
    scene.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => validateMaterial(material, this.target, this.autoClear, this.explicitlyCleared, fullScreen));
    });
  }
  dispose() {}
}
const source = fs.readFileSync(path.join(directory, 'temple-renderer.js'), 'utf8')
  .replace(/import \* as THREE from ["']\.\/vendor\/three.module\.js["'];/, '')
  .replace(/import \{ canUsePostProcessing \} from ["']\.\/render-policy\.js["'];/, '')
  .replace('export function', 'function') + '\nglobalThis.subject=createTempleNightRenderer(canvas);';
const context = vm.createContext({ THREE: { ...realThree, WebGLRenderer: MockRenderer },
  canUsePostProcessing: policy.canUsePostProcessing, location: { search: low ? '?q=low' : '' },
  matchMedia: query => ({ matches: low && query.includes('hover') }), URLSearchParams, devicePixelRatio: 1,
  document: { createElement: () => canvas() }, canvas: canvas(), console, Uint8ClampedArray });
new vm.Script(source, { filename: 'temple-renderer.js' }).runInContext(context, { timeout: 30000 });
const subject = context.subject;
assert.equal(typeof subject.render, 'function');
assert.equal(subject.postprocessing, !low);
subject.render(0); subject.render(16); subject.setView(4); subject.setRain(false);
for (const [input, expected] of [[.6, .6], [1, 1], [1.4, 1.4], [-10, .6], [10, 1.4], [NaN, 1], [Infinity, 1]]) {
  subject.setLight(input);
  const actual = low ? lastRenderer.toneMappingExposure : composite.uniforms.uExp.value / .62;
  assert.ok(Math.abs(actual - expected) < 1e-10, `Finite bounded exposure for ${input}`);
}
function lightingSnapshot() {
  const result = [];
  world.traverse(object => {
    if (object.isLight) result.push(object.intensity);
    if (object.material?.uniforms?.uT) result.push(object.material.uniforms.uT.value);
  });
  return result;
}
subject.setPaused(true);
const paused = lightingSnapshot();
subject.render(10000); subject.setLight(1.4); subject.render(20000); subject.setView(2); subject.render(30000);
assert.deepEqual(lightingSnapshot(), paused, 'Paused controls must not change light animation phases');
subject.setPaused(false); subject.render(40000);
assert.deepEqual(lightingSnapshot(), paused, 'Resume must not include the wall-clock pause');
subject.render(40016);
assert.notDeepEqual(lightingSnapshot(), paused, 'Animation resumes after a new frame interval');
for (let frame = 2; frame <= 170; frame++) subject.render(40000 + frame * 16);
const beforeHidden = lightingSnapshot(), ratio = lastRenderer.getPixelRatio();
subject.resetTiming(); subject.render(400000);
assert.deepEqual(lightingSnapshot(), beforeHidden, 'Hidden time must not advance lights');
assert.equal(lastRenderer.getPixelRatio(), ratio, 'Hidden time must not trigger adaptive downscaling');
subject.resize(); subject.dispose();
assert.ok(draws > 0); assert.ok(validatedSamplers > 0);
if (!low) assert.ok(additivePasses > 0, 'High quality must exercise bloom accumulation');
console.log(`PASS Three scene/render-pass contracts (${low ? 'low' : 'high'}): Texture samplers, no feedback, additive preservation, defined GLSL ramps, exposure bounds, pause/resume and hidden timing.`);
console.log('LIMIT: GPU and Canvas2D mocked. This does not certify GLSL compilation, pixels, browser compatibility or a physical device.');
