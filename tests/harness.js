// Shared Node DOM-stub harness: evaluates the app's inline script (plus
// logic.js and icons.js) in a sandbox so screen renderers and state-machine
// functions can be exercised without a browser.
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

const RETURNS = [
  'showCameraState', 'retakePhoto', 'startCamera', 'handleAnalysisResult',
  'showManualToneSelect', 'showToneRetakePrompt', 'st', 'buildProfile',
  'renderWelcome', 'renderEmail', 'renderConsent', 'renderArmCamera',
  'renderQIntro', 'renderQuestionnaire', 'renderABCDE', 'renderConsentLocation',
  'renderConsentTravel', 'renderConsentNotifications', 'renderLoading',
  'renderHomepage', 'renderPartnerLockup', 'resolvePartner', 'render',
];

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
    `\nreturn {${RETURNS.join(',')}};`
  );
  const api = fn(
    windowStub, documentStub, localStorageStub, navigatorStub,
    () => 0, () => {}, async () => { throw new Error('network disabled in tests'); },
    FakeImage, () => true, () => {}
  );
  return { registry, reg, api, window: windowStub, document: documentStub };
}

module.exports = { makeEnv, makeEl };
