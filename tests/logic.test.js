// Phase 1 verification tests — run with: node --test tests/logic.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const L = require(path.join(__dirname, '..', 'logic.js'));

// ───────────────────────── SPF / EADO (feedback 1.2) ─────────────────────────

test('no SPF advice below UV 3 for any Monk tone', () => {
  for (let monk = 1; monk <= 10; monk++) {
    for (const uv of [0, 0.5, 1, 1.9, 2, 2.4, 2.49]) {
      const r = L.getPersonalisedSPF(uv, monk);
      assert.strictEqual(r.spf, null, `uv=${uv} monk=${monk} should give no SPF`);
      assert.match(r.msg, /No sun protection required/);
    }
  }
});

test('fair-skin (Monk 1-3) bump applies only when rounded UV >= 3', () => {
  // At UV 3-5 base level is "30+"; Monk 1-3 should be bumped to "30–50"
  for (let monk = 1; monk <= 3; monk++) {
    assert.strictEqual(L.getPersonalisedSPF(3, monk).spf, '30–50');
    assert.strictEqual(L.getPersonalisedSPF(2.4, monk).spf, null); // no bump below 3
  }
  for (let monk = 4; monk <= 10; monk++) {
    assert.strictEqual(L.getPersonalisedSPF(3, monk).spf, '30+');
  }
});

test('SPF defined for all UV 3-12 x all tones, never below 30', () => {
  for (let monk = 1; monk <= 10; monk++) {
    for (let uv = 3; uv <= 12; uv++) {
      const r = L.getPersonalisedSPF(uv, monk);
      assert.ok(r.spf, `uv=${uv} monk=${monk} must carry an SPF`);
      assert.match(r.spf, /^(30\+|30–50|50\+)$/);
    }
  }
});

test('Monk >= 7 equality note is preserved', () => {
  assert.ok(L.getPersonalisedSPF(5, 7).note);
  assert.strictEqual(L.getPersonalisedSPF(5, 5).note, null);
});

// ───────────────────── Rounding consistency (feedback 1.2) ─────────────────────

test('UV 2.4 displays as 2 with LOW band and no SPF; 2.6 as 3, MODERATE, SPF', () => {
  const low = L.getPersonalisedSPF(2.4, 5);
  assert.strictEqual(low.uvR, 2);
  assert.strictEqual(low.spf, null);
  assert.strictEqual(L.getUVBand(2.4).level, 'LOW');

  const mod = L.getPersonalisedSPF(2.6, 5);
  assert.strictEqual(mod.uvR, 3);
  assert.ok(mod.spf);
  assert.strictEqual(L.getUVBand(2.6).level, 'MODERATE');
});

// ───────────────────── Nearest clinic / haversine (feedback 1.1) ─────────────────────

test('nearest clinic is sensible for London, Bristol, Manchester, Edinburgh', () => {
  // Coordinates of representative postcodes in each city
  const cases = [
    { name: 'London (WC2N)',    lat: 51.5074, lon: -0.1278, expect: ['London Bridge','Oxford Circus','Harley Street','Moorgate','Richmond'] },
    { name: 'Bristol (BS1)',    lat: 51.4545, lon: -2.5879, expect: ['Bristol'] },
    { name: 'Manchester (M1)',  lat: 53.4808, lon: -2.2426, expect: ['Manchester'] },
    { name: 'Edinburgh (EH1)',  lat: 55.9533, lon: -3.1883, expect: ['Edinburgh'] },
  ];
  for (const c of cases) {
    const sorted = L.getClinicsByDistance(c.lat, c.lon);
    assert.ok(c.expect.includes(sorted[0].name), `${c.name}: got ${sorted[0].name}`);
    assert.notStrictEqual(sorted[0].name, c.name === 'Birmingham' ? '' : 'Birmingham',
      `${c.name} must never be matched to Birmingham`);
    assert.ok(sorted[0].distance < 5, `${c.name}: nearest clinic should be < 5 miles`);
    // distances strictly sorted ascending
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].distance >= sorted[i-1].distance);
  }
});

test('no coordinates -> full clinic list with null distances (picker, not a guess)', () => {
  const list = L.getClinicsByDistance(null, null);
  assert.strictEqual(list.length, L.clinics.length);
  assert.ok(list.every(c => c.distance === null));
});

test('booking URLs are service-specific, never the generic /book', () => {
  const urls = Object.values(L.BOOK_URLS);
  assert.strictEqual(urls.length, 3);
  for (const u of urls) {
    assert.ok(!/\/book\/?$/.test(u), `${u} must not be the bare /book URL`);
    assert.match(u, /^https:\/\/themoleclinic\.co\.uk\/book-/);
  }
});

// ───────────────────── Cumulative UV dimension (feedback 1.11) ─────────────────────

const outdoorWorker = {
  age: '45-54',
  outdoor_work: 'over15',           // 20 years outdoor work
  sun_damage_visible: 'yes',        // photodamage
  personal_skin_cancer_history: 'yes_nmsc', // prior NMSC
  longterm_sun_exposure: 'yes',
  sunny_climate: 'no',
};

test('20-year outdoor worker with photodamage and prior NMSC lands HIGH/VERY HIGH on cumulative band', () => {
  const score = L.calculateCumulativeUVScore(outdoorWorker);
  const band = L.getCumulativeUVLevel(score);
  assert.ok(['HIGH', 'VERY HIGH'].includes(band), `got ${band} (score ${score})`);
});

test('cumulative answers do not inflate the melanoma-pathway score', () => {
  const base = {
    age: '45-54', sunburn_history: 'yes', mole_freckle_profile: 'some_moles',
    longterm_sun_exposure: 'yes', sun_damage_visible: 'yes',
    personal_skin_cancer_history: 'yes_nmsc',
  };
  const withCumulative = { ...base, outdoor_work: 'over15', sunny_climate: 'over_5' };
  assert.strictEqual(
    L.calculateRiskScore(base, {}, 5, null),
    L.calculateRiskScore(withCumulative, {}, 5, null),
    'the two new questions must not affect the validated melanoma score'
  );
});

test('overall band is the max of the two pathway bands', () => {
  assert.strictEqual(L.combineRiskBands('LOW', 'VERY HIGH'), 'VERY HIGH');
  assert.strictEqual(L.combineRiskBands('HIGH', 'MODERATE'), 'HIGH');
  assert.strictEqual(L.combineRiskBands('LOW', 'LOW'), 'LOW');
  assert.strictEqual(L.combineRiskBands('VERY HIGH', 'LOW'), 'VERY HIGH');
});

test('cumulative-only profile scores low on the melanoma pathway but high cumulative', () => {
  // No melanoma red flags at all — purely chronic exposure
  const chronicOnly = {
    age: '55-64', outdoor_work: 'over15', sunny_climate: 'over_5',
    longterm_sun_exposure: 'yes', sun_damage_visible: 'yes',
    sunburn_history: 'no', sunbed_use: 'no', new_changing_lesion: 'no',
    mole_freckle_profile: 'very_few_moles_few_freckles',
    personal_skin_cancer_history: 'no', family_melanoma_history: 'no',
  };
  const mel = L.getRiskLevel(L.calculateRiskScore(chronicOnly, {}, 6, null));
  const cum = L.getCumulativeUVLevel(L.calculateCumulativeUVScore(chronicOnly));
  assert.ok(['HIGH', 'VERY HIGH'].includes(cum), `cumulative band: ${cum}`);
  assert.ok(['LOW', 'MODERATE'].includes(mel), `melanoma band should stay low/moderate: ${mel}`);
  assert.strictEqual(L.combineRiskBands(mel, cum), cum);
});

// ───────────────── Service recommendation (feedback 1.11 trigger) ─────────────────

test('high cumulative band routes to Full Body Skin Check without overriding mole-mapping logic', () => {
  // No other triggers + high cumulative -> FBSC with the cumulative description
  const quiet = { sunburn_history: 'no', sunbed_use: 'no' };
  const rec = L.getServiceRecommendation(quiet, 'HIGH');
  assert.strictEqual(rec.primary, 'fbsc');
  assert.match(rec.description, /cumulative/i);
  // Existing domain A logic still wins: lots of moles -> Mole Mapping
  const moley = { mole_freckle_profile: 'lots_of_moles' };
  assert.strictEqual(L.getServiceRecommendation(moley, 'HIGH').primary, 'mole_mapping');
  // And no cumulative level given behaves as before
  assert.strictEqual(L.getServiceRecommendation(quiet).primary, 'fbsc');
});

// ───────────────────── Melanoma score regression guards ─────────────────────

test('melanoma thresholds and a known profile are unchanged', () => {
  assert.strictEqual(L.getRiskLevel(24), 'LOW');
  assert.strictEqual(L.getRiskLevel(25), 'MODERATE');
  assert.strictEqual(L.getRiskLevel(45), 'HIGH');
  assert.strictEqual(L.getRiskLevel(70), 'VERY HIGH');
  // Spot-check a hand-computed profile: age 16 + family 18 + sunburn 12 +
  // sunbed 14 + fair-skin 8 = 68
  const answers = {
    age: '45-54', family_melanoma_history: 'yes', sunburn_history: 'yes',
    sunbed_use: 'yes',
  };
  assert.strictEqual(L.calculateRiskScore(answers, {}, 2, null), 68);
});
