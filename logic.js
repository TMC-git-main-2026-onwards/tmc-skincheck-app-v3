/*
 * TMC SkinCheck — pure logic module
 * Extracted from index.html so the scoring/UV/clinic functions can be
 * unit-tested under Node. Loaded as a classic script before the main
 * app script; also requirable from Node via the module.exports guard.
 * No DOM, no state, no network — pure functions and data only.
 */
const clinics=[
  {name:'London Marylebone',postcodes:['W1','NW','WC'],bookUrl:'https://www.themoleclinic.co.uk/book'},
  {name:'London City',postcodes:['EC','E1','E2'],bookUrl:'https://www.themoleclinic.co.uk/book'},
  {name:'London Chelsea',postcodes:['SW','KT','TW'],bookUrl:'https://www.themoleclinic.co.uk/book'},
  {name:'London Canary Wharf',postcodes:['E14','E'],bookUrl:'https://www.themoleclinic.co.uk/book'},
  {name:'Manchester',postcodes:['M','WA','SK','OL','BL','WN'],bookUrl:'https://www.themoleclinic.co.uk/book'},
  {name:'Leeds',postcodes:['LS','BD','HG','WF','HX','HD'],bookUrl:'https://www.themoleclinic.co.uk/book'},
  {name:'Bristol',postcodes:['BS','BA','GL','SN'],bookUrl:'https://www.themoleclinic.co.uk/book'},
  {name:'Birmingham',postcodes:['B','WS','DY','WV','CV'],bookUrl:'https://www.themoleclinic.co.uk/book'},
];
function getNearestClinics(postcode){
  const pc=(postcode||'').toUpperCase().replace(/\s/g,'');
  return clinics.map(c=>({...c,score:c.postcodes.reduce((best,p)=>pc.startsWith(p)?Math.max(best,p.length):best,0)})).sort((a,b)=>b.score-a.score);
}
// ===== UV & SPF LOGIC =====
// EADO (European Association of Dermato-Oncology) UV Protection Scale
function getUVBand(uv){
  if(uv<=2)return{level:'LOW',color:'#4caf50',bg:'#e8f5e9',text:'#2e7d32'};
  if(uv<=5)return{level:'MODERATE',color:'#ffb300',bg:'#fff8e1',text:'#f57f17'};
  if(uv<=7)return{level:'HIGH',color:'#ff7043',bg:'#fff3e0',text:'#bf360c'};
  if(uv<=10)return{level:'VERY HIGH',color:'#e53935',bg:'#ffebee',text:'#b71c1c'};
  return{level:'EXTREME',color:'#8e24aa',bg:'#f3e5f5',text:'#4a148c'};
}
// Bias-corrected SPF recommendation per Gadare et al., MIT 2026 debiasing principle:
// Monk tones 1-3 (lightest): move one EADO protection level up
// Monk tones 7-10 (darker): standard EADO + equality note
function getPersonalisedSPF(uv,monkTone){
  const levels=[
    {spf:null,msg:'No protection required'},
    {spf:'30+',msg:'SPF 30+, hat, and sunglasses'},
    {spf:'30–50',msg:'SPF 30–50, seek shade at solar noon'},
    {spf:'50+',msg:'SPF 50+, avoid solar noon, cover up'},
    {spf:'50+',msg:'SPF 50+, stay indoors at solar noon'},
  ];
  let idx=uv<=2?0:uv<=5?1:uv<=7?2:uv<=10?3:4;
  let note=null;
  if(monkTone<=3)idx=Math.min(idx+1,4);
  if(monkTone>=7)note='Darker skin tones have lower natural SPF but equal melanoma risk — do not rely on skin tone as protection. Use stated SPF.';
  return{...levels[idx],note};
}
// ===== RISK CALCULATIONS =====
/*
 * RISK SCORING MODEL — TMC Skin Check App v0.3
 * Based on published melanoma epidemiology literature.
 * Each weight reflects relative risk contribution from peer-reviewed sources.
 * This is a risk STRATIFICATION tool, not a diagnostic instrument.
 */
const calculateRiskScore = (answers, abcdeAnswers, skinType, skinAnalysis) => {
  let score = 0;

  // ── AGE ──────────────────────────────────────────────────────────────
  // Source: Cancer Research UK. Melanoma incidence by age. Peak incidence 55-64.
  const ageScores = {'under25':2,'25-34':5,'35-44':10,'45-54':16,'55-64':20,'65plus':22};
  score += ageScores[answers.age] || 0;

  // ── PERSONAL SKIN CANCER HISTORY ─────────────────────────────────────
  // Bradford et al. (2010). JNCI. Previous melanoma: RR 8.5 for second primary.
  // NMSC lower recurrence risk than melanoma.
  const personalScores = {'yes_melanoma':20,'yes_nmsc':8,'no':0};
  score += personalScores[answers.personal_skin_cancer_history] || 0;

  // ── FAMILY MELANOMA HISTORY ──────────────────────────────────────────
  // Gandini et al. (2005). First-degree relative with melanoma: RR 2.24.
  const familyScores = {'yes':18,'no':0,'not_sure':3};
  score += familyScores[answers.family_melanoma_history] || 0;

  // ── SUNBURN HISTORY ──────────────────────────────────────────────────
  // Gandini et al. (2005). Repeated/severe burns: RR ~1.68.
  const sunburnScores = {'yes':12,'no':0,'not_sure':2};
  score += sunburnScores[answers.sunburn_history] || 0;

  // ── SUN DAMAGE VISIBLE ───────────────────────────────────────────────
  // Direct evidence of cumulative UV damage on skin.
  const sunDamageScores = {'yes':8,'no':0,'not_sure':2};
  score += sunDamageScores[answers.sun_damage_visible] || 0;

  // ── LONGTERM SUN EXPOSURE ────────────────────────────────────────────
  // Gandini et al. (2005). Occupational/recreational cumulative UV.
  const longtermScores = {'yes':8,'no':0};
  score += longtermScores[answers.longterm_sun_exposure] || 0;

  // ── SUNBED USE ───────────────────────────────────────────────────────
  // IARC Working Group (2006). Lancet Oncology. Use before 35: RR 1.75. WHO Group 1 carcinogen.
  const sunbedScores = {'yes':14,'no':0};
  score += sunbedScores[answers.sunbed_use] || 0;

  // ── MOLE / FRECKLE PROFILE ───────────────────────────────────────────
  // Tucker et al. (1997). 50+ moles: RR 4.8 vs fewer than 15.
  // Freckles indicate UV sensitivity (Gandini 2005).
  const moleProfileScores = {
    'very_few_moles_few_freckles': 0,
    'very_few_moles_many_freckles': 3,
    'some_moles': 6,
    'lots_of_moles': 14
  };
  score += moleProfileScores[answers.mole_freckle_profile] || 0;

  // Arm AI mole count adds bonus if reliable and high
  if (skinAnalysis && skinAnalysis.confidence !== 'low' &&
      skinAnalysis.moleCount !== -1 && skinAnalysis.moleCountCategory) {
    const catBoost = {'11plus':8,'7to10':2};
    score += catBoost[skinAnalysis.moleCountCategory] || 0;
  }

  // ── MOLE APPEARANCE ──────────────────────────────────────────────────
  // Atypical/dysplastic naevi: significant independent risk factor.
  const moleAppScores = {'yes':14,'no':0,'no_moles':0,'not_sure':4};
  score += moleAppScores[answers.mole_appearance] || 0;

  // ── NEW / CHANGING LESION ────────────────────────────────────────────
  // NHS/NICE: evolving or new lesion is primary warning sign.
  const newLesionScores = {'yes':18,'no':0,'not_sure':5};
  score += newLesionScores[answers.new_changing_lesion] || 0;

  // ── LESION SYMPTOMS + ABCDE (merged multi-select) ────────────────────
  // Friedman et al. (1985). ABCDE criteria compound risk.
  // Symptoms (bleeding/itching/crusting) count alongside ABCDE criteria.
  const symptoms = answers.lesion_symptoms;
  if (Array.isArray(symptoms) && symptoms.length > 0 && !symptoms.includes('none')) {
    const criteriaCount = symptoms.filter(s => s !== 'none').length;
    if (criteriaCount === 1) score += 8;
    else if (criteriaCount === 2) score += 14;
    else if (criteriaCount === 3) score += 18;
    else if (criteriaCount >= 4) score += 22;
  }

  // ── IMMUNE SYSTEM ─────────────────────────────────────────────────────
  // Grulich et al. (2007). Lancet. Immunosuppression RR 3.4 for melanoma.
  const immuneScores = {'yes':12,'no':0,'not_sure':3};
  score += immuneScores[answers.immune_system] || 0;

  // ── REASON FOR VISIT ─────────────────────────────────────────────────
  const visitScores = {'specific_concern':6,'routine':0,'general_concern':2,'family_advice':3};
  score += visitScores[answers.reason_for_visit] || 0;

  // ── SELF CHECK CONFIDENCE ────────────────────────────────────────────
  // Harder to self-monitor = higher missed-change risk.
  const selfCheckScores = {'confident':0,'difficult':3,'dont_check':6,'no_moles':0};
  score += selfCheckScores[answers.self_check_confidence] || 0;

  // ── SKIN TYPE ADJUSTMENT (MONK SCALE, SILENT) ────────────────────────
  // Gandini et al. (2005). Fitzpatrick I-II (very fair): RR 2.09.
  // We do NOT reduce score for darker tones — melanoma is equally deadly
  // across skin tones but diagnosed later in darker skin (Gadare et al. 2026).
  const monkTone = skinType || (skinAnalysis && skinAnalysis.monkTone);
  if (monkTone) {
    if (monkTone <= 2) score += 8;
    else if (monkTone <= 4) score += 4;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
};
// Thresholds calibrated to approximate population percentiles
// from melanoma risk stratification literature.
const getRiskLevel = (score) => {
  if (score >= 70) return 'VERY HIGH';
  if (score >= 45) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
};
function getCheckFrequency(level){
  const f={
    'LOW':'Every 2 years',
    'MODERATE':'Annually',
    'HIGH':'Every 6 months',
    'VERY HIGH':'See a dermatologist urgently — do not wait for a routine appointment'
  };
  return f[level]||'Annually';
}
const getServiceRecommendation = (answers) => {
  const domainA_trigger =
    answers.mole_appearance === 'yes' ||
    answers.mole_freckle_profile === 'lots_of_moles' ||
    answers.personal_skin_cancer_history === 'yes_melanoma' ||
    answers.family_melanoma_history === 'yes';

  const symptoms = answers.lesion_symptoms || [];
  const hasSymptoms = Array.isArray(symptoms)
    ? symptoms.some(s => ['bleeding','itching','crusting'].includes(s))
    : false;
  const hasABCDE = Array.isArray(symptoms)
    ? symptoms.some(s => ['asymmetry','border','colour','diameter','evolving'].includes(s))
    : false;
  const domainD_trigger =
    answers.new_changing_lesion === 'yes' ||
    hasSymptoms ||
    hasABCDE ||
    answers.reason_for_visit === 'specific_concern';

  const domainC_trigger =
    answers.sun_damage_visible === 'yes' ||
    answers.longterm_sun_exposure === 'yes' ||
    answers.sunburn_history === 'yes' ||
    answers.sunbed_use === 'yes' ||
    answers.immune_system === 'yes' ||
    answers.personal_skin_cancer_history === 'yes_nmsc';

  if (domainA_trigger) {
    return {
      primary: 'mole_mapping',
      urgency: domainD_trigger ? 'urgent' : 'routine',
      title: 'Mole Mapping',
      description: 'Based on your mole profile and history, a full Mole Mapping assessment is recommended. This provides a comprehensive baseline record of all your moles and enables accurate monitoring over time.',
      show_fbsc: true, show_mole_mapping: true, show_single_mole: true
    };
  } else if (domainD_trigger) {
    return {
      primary: 'fbsc_urgent',
      urgency: 'urgent',
      title: 'Full Body Skin Check',
      description: "You've described a new, changing or symptomatic area of skin. We recommend booking a Full Body Skin Check as soon as possible so a specialist can assess it properly. Please do not wait.",
      show_fbsc: true, show_mole_mapping: true, show_single_mole: true
    };
  } else if (domainC_trigger) {
    return {
      primary: 'fbsc',
      urgency: 'routine',
      title: 'Full Body Skin Check',
      description: 'Your sun exposure history means a professional Full Body Skin Check is the most appropriate next step. Skin cancers related to UV damage can appear anywhere on the body and may not look like a mole.',
      show_fbsc: true, show_mole_mapping: true, show_single_mole: true
    };
  } else {
    return {
      primary: 'fbsc',
      urgency: 'routine',
      title: 'Full Body Skin Check',
      description: 'A Full Body Skin Check is appropriate for everyone, regardless of skin type or mole count. It gives you a professional baseline and peace of mind.',
      show_fbsc: true, show_mole_mapping: true, show_single_mole: true
    };
  }
};
// Node export for unit tests (no-op in the browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clinics, getNearestClinics, getUVBand, getPersonalisedSPF,
    calculateRiskScore, getRiskLevel, getCheckFrequency, getServiceRecommendation,
  };
}
