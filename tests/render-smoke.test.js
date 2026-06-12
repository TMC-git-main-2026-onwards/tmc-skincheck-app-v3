// Render smoke tests — every screen template must build without throwing,
// with no emoji and no retired design tokens in the output.
// Run with: node --test tests/render-smoke.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { makeEnv } = require('./harness');

const ANSWERS = {
  age: '45-54', mole_freckle_profile: 'some_moles', mole_appearance: 'no',
  self_check_confidence: 'difficult', personal_skin_cancer_history: 'yes_nmsc',
  family_melanoma_history: 'no', sun_damage_visible: 'yes',
  longterm_sun_exposure: 'yes', sunburn_history: 'yes', sunbed_use: 'no',
  outdoor_work: 'over15', sunny_climate: 'no', new_changing_lesion: 'no',
  lesion_symptoms: ['none'], reason_for_visit: 'routine', immune_system: 'no',
};

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
const RETIRED_RE = /--tmc-teal|--tmc-coral|--tmc-gold|--tmc-cream|--tmc-gray|#2ec4b6|#1a2332|#00A99D/i;

function setupFullState(api) {
  Object.assign(api.st, {
    name: 'Test', email: 'test@example.com', postcode: 'BS1 4JE',
    campaignCode: '', consentData: true, skinType: 5,
    skinAnalysis: { mst: 5, monkToneSource: 'pixel_sampling', moleRaw: 'under7', moleCountCategory: 'under7', moleCount: 3, moleCountAnswer: 'under10', confidence: 'high', photoDataUrl: null },
    answers: { ...ANSWERS }, currentQuestion: 0,
    riskScore: 55, riskLevel: 'HIGH', cumulativeUVScore: 72, cumulativeUVLevel: 'VERY HIGH',
    overallRiskLevel: 'VERY HIGH',
  });
  api.st.profile = api.buildProfile();
}

test('every screen renders without throwing; no emoji; no retired tokens', () => {
  const { api } = makeEnv();
  setupFullState(api);
  const screens = {
    welcome: api.renderWelcome, email: api.renderEmail, consent: api.renderConsent,
    arm_camera: api.renderArmCamera, q_intro: api.renderQIntro,
    questionnaire: api.renderQuestionnaire, abcde: api.renderABCDE,
    consent_location: api.renderConsentLocation, consent_travel: api.renderConsentTravel,
    consent_notifications: api.renderConsentNotifications, loading: api.renderLoading,
    homepage: api.renderHomepage,
  };
  for (const [name, fn] of Object.entries(screens)) {
    const out = fn();
    assert.ok(typeof out === 'string' && out.length > 100, `${name} should render markup`);
    assert.ok(!EMOJI_RE.test(out), `${name} must contain no emoji`);
    assert.ok(!RETIRED_RE.test(out), `${name} must not reference retired colours/tokens`);
  }
});

test('every questionnaire question renders (incl. multiselect + education panels)', () => {
  const { api } = makeEnv();
  setupFullState(api);
  // 16 questions — render each
  for (let i = 0; ; i++) {
    api.st.currentQuestion = i;
    let out;
    try { out = api.renderQuestionnaire(); } catch (e) { assert.fail(`question ${i} threw: ${e.message}`); }
    assert.ok(out.length > 100, `question ${i} should render`);
    if (out.includes('Continue ')) break; // last visible question reached
    if (i > 30) assert.fail('did not terminate');
  }
});

test('partner lockup: known code, unknown code, consumer', () => {
  const { api } = makeEnv();
  api.st.campaignCode = 'NORTHWIND';
  assert.match(api.renderPartnerLockup(), /Offered by/);
  assert.match(api.renderPartnerLockup(), /Northwind Travel/);
  api.st.campaignCode = 'ACME2026'; // unknown -> generic, never a gate
  assert.match(api.renderPartnerLockup(), /Offered through your provider/);
  api.st.campaignCode = '';
  assert.strictEqual(api.renderPartnerLockup(), '', 'consumer flow has no lockup');
});

test('homepage shows pathway tiles, band labels and nearest-clinic placeholder', () => {
  const { api } = makeEnv();
  setupFullState(api);
  const out = api.renderHomepage();
  assert.match(out, /Melanoma<\/div>/);
  assert.match(out, /Lifetime UV<\/div>/);
  assert.match(out, /Very high/);
  assert.match(out, /nearest-clinic-block/);
  assert.match(out, /Methodology &amp; References/);
  assert.match(out, /Email me my results/);
  assert.ok(!/\/100|out of 100/.test(out), 'no numeric risk score (feedback 1.5)');
});
