// Step 1a regression tests — camera state machine.
// Evaluates the inline app script under Node with a minimal DOM stub.
// Run with: node --test tests/camera-state.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const logicSrc = fs.readFileSync(path.join(root, 'logic.js'), 'utf8');
const iconsSrc = fs.readFileSync(path.join(root, 'icons.js'), 'utf8');

function makeEl(id) {
  return {
    id, style: {}, innerHTML: '', textContent: '', disabled: false, dataset: {},
    offsetWidth: 0, videoWidth: 0, muted: false, srcObject: null, checked: false, value: '',
    classList: { toggle() { return false; }, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    appendChild() {}, remove() {}, after() {}, before() {}, closest() { return null; },
    scrollIntoView() {},
    getContext() { return null; },
    play() { return Promise.resolve(); },
  };
}

// Builds a fresh sandboxed instance of the app script and returns its
// internals plus the element registry for assertions.
function makeEnv() {
  const registry = { app: makeEl('app') };
  const reg = (id) => { registry[id] = makeEl(id); return registry[id]; };
  const documentStub = {
    getElementById: (id) => registry[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeEl(''),
    body: { appendChild() {}, removeChild() {} },
  };
  const windowStub = { scrollTo() {}, open() {}, location: { search: '', href: '', reload() {} }, addEventListener() {} };
  const localStorageStub = { getItem: () => null, setItem() {}, removeItem() {} };
  const navigatorStub = {
    geolocation: { getCurrentPosition() {} },
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
  };
  class FakeImage { set src(v) { /* never fires onload in tests */ } }
  const fn = new Function(
    'window', 'document', 'localStorage', 'navigator',
    'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'Image', 'confirm', 'alert',
    logicSrc + '\n' + iconsSrc + '\n' + inline +
    '\nreturn {showCameraState,retakePhoto,startCamera,handleAnalysisResult,showManualToneSelect,showToneRetakePrompt,st};'
  );
  const api = fn(
    windowStub, documentStub, localStorageStub, navigatorStub,
    () => 0, () => {}, async () => { throw new Error('network disabled in tests'); },
    FakeImage, () => true, () => {}
  );
  return { registry, reg, api, window: windowStub };
}

test("showCameraState('a') and ('A') resolve the same lowercase DOM elements", () => {
  const { reg, api, registry } = makeEnv();
  reg('cam-state-a'); reg('cam-state-b'); reg('cam-state-c');

  api.showCameraState('A');
  assert.strictEqual(registry['cam-state-a'].style.display, '', "state 'A' must show cam-state-a");
  assert.strictEqual(registry['cam-state-b'].style.display, 'none');
  assert.strictEqual(registry['cam-state-c'].style.display, 'none');

  api.showCameraState('c'); // lowercase, no dataURL — generic fallback path
  assert.strictEqual(registry['cam-state-c'].style.display, '');
  assert.strictEqual(registry['cam-state-a'].style.display, 'none');

  api.showCameraState('A'); // and back again, uppercase
  assert.strictEqual(registry['cam-state-a'].style.display, '');
  assert.strictEqual(registry['cam-state-c'].style.display, 'none');
});

test('capture -> lighting retake -> Retake reopens camera -> second failure -> manual tone selection', async () => {
  const { reg, api, registry, window } = makeEnv();
  reg('cam-state-a'); reg('cam-state-b'); reg('cam-state-c');
  reg('cameraVideo'); reg('overlayCanvas');
  api.st.screen = 'arm_camera';

  // 1) First capture comes back with uneven lighting -> retake prompt in state C
  api.st.capturedPhoto = 'data:image/jpeg;base64,xxx';
  api.handleAnalysisResult({ monkTone: null, toneStatus: 'lighting', moleCount: -1, moleCountCategory: null, confidence: 'low' });
  assert.match(registry['cam-state-c'].innerHTML, /Lighting looks uneven/);
  assert.strictEqual(registry['cam-state-c'].style.display, '');
  assert.strictEqual(api.st.toneRetryDone, true, 'the one retry must now be consumed');

  // 2) Retake reopens the LIVE camera (state B), not the setup screen
  api.retakePhoto();
  await new Promise((r) => setTimeout(r, 20)); // let startCamera's async settle
  assert.strictEqual(registry['cam-state-b'].style.display, '', 'Retake must reopen the camera view');
  assert.strictEqual(registry['cam-state-a'].style.display, 'none');
  assert.strictEqual(api.st.capturedPhoto, null);
  assert.strictEqual(api.st.skinAnalysis, null);
  assert.ok(window.activeCameraStream, 'camera stream must be live again');

  // 3) Second capture fails the lighting gate too -> manual tone selection
  api.st.capturedPhoto = 'data:image/jpeg;base64,yyy';
  api.handleAnalysisResult({ monkTone: null, toneStatus: 'lighting', moleCount: -1, moleCountCategory: null, confidence: 'low' });
  assert.match(registry['cam-state-c'].innerHTML, /Select your skin tone/);
  assert.strictEqual(registry['cam-state-c'].style.display, '');
});

test('worker/pixel mismatch follows the same retry-then-manual path', () => {
  const { reg, api, registry } = makeEnv();
  reg('cam-state-a'); reg('cam-state-b'); reg('cam-state-c');
  api.st.screen = 'arm_camera';

  api.handleAnalysisResult({ monkTone: 4, toneStatus: 'mismatch', workerTone: 8, moleCount: -1, moleCountCategory: null, confidence: 'low' });
  assert.match(registry['cam-state-c'].innerHTML, /confident skin tone reading/);

  api.handleAnalysisResult({ monkTone: 4, toneStatus: 'mismatch', workerTone: 8, moleCount: -1, moleCountCategory: null, confidence: 'low' });
  assert.match(registry['cam-state-c'].innerHTML, /Select your skin tone/);
});
