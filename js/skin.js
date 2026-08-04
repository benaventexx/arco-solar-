// Arco Solar — skin, burn time and vitamin D estimates
// All figures here are educational approximations (Fitzpatrick-scale minutes-
// to-burn at UV=1, scaled by SPF). They are not medical guidance.
(function(global){
  const SKIN_TYPES = [
    { id:1, label:'I',   base:150, hex:'#F4DFC9', dark:0 },
    { id:2, label:'II',  base:250, hex:'#E8C79C', dark:0 },
    { id:3, label:'III', base:350, hex:'#D2A374', dark:0 },
    { id:4, label:'IV',  base:450, hex:'#AD7A4C', dark:1 },
    { id:5, label:'V',   base:600, hex:'#7A5030', dark:1 },
    { id:6, label:'VI',  base:750, hex:'#4A2E1C', dark:1 },
  ];
  function skinDescKey(id){
    return { 1:'skinDesc1', 2:'skinDesc2', 3:'skinDesc3', 4:'skinDesc4', 5:'skinDesc5', 6:'skinDesc6' }[id];
  }

  // SPF options: extension factor is a simplified, conservative approximation
  // (real-world protection depends heavily on correct/re-application).
  const SPF_OPTIONS = [
    { spf: 0,  label:'—',   factor: 1 },
    { spf: 15, label:'15',  factor: 5 },
    { spf: 30, label:'30',  factor: 8 },
    { spf: 50, label:'50+', factor: 12 },
  ];

  // Reflective surfaces (water, wet sand, snow) bounce extra UV back onto
  // skin — a well-documented effect (water ~10-25% extra, sand ~15%, fresh
  // snow up to 80%+). We use a single conservative multiplier as an estimate.
  const REFLECTION_FACTOR = 1.25;
  function effectiveUV(uv, reflective){ return reflective ? uv * REFLECTION_FACTOR : uv; }

  function burnMinutes(skinId, uv, spf){
    const skin = SKIN_TYPES.find(s=>s.id===skinId) || SKIN_TYPES[2];
    const opt = SPF_OPTIONS.find(o=>o.spf===spf) || SPF_OPTIONS[0];
    return Math.round((skin.base * opt.factor) / Math.max(uv, 0.3));
  }

  // Very rough vitamin D estimate: assumes ~600 IU produced per 10 minutes of
  // mid-UV (index ~5) exposure on ~25% of skin, scaled linearly with UV and
  // exposure minutes, halved when sunscreen is in use. Purely illustrative.
  function vitaminDEstimate(uv, minutesExposed, spf){
    const base = (uv / 5) * (minutesExposed / 10) * 600;
    const factor = spf > 0 ? 0.4 : 1;
    return Math.max(0, Math.round(base * factor));
  }

  const TAN_GOALS = [
    { id:'light',    factor:0.45 },
    { id:'medium',   factor:0.7 },
    { id:'intense',  factor:0.95 },
  ];

  // Per-skin-type guidance: generic product CATEGORIES and general skincare
  // practice — never a specific brand (that would be an unverifiable claim
  // and could look like an endorsement). Educational, not medical advice.
  const RECOMMENDATIONS = {
    1: { spf: '50+', careKey:'rec1Care', spfKey:'rec1Spf', tanKey:'rec1Tan' },
    2: { spf: '50',  careKey:'rec2Care', spfKey:'rec2Spf', tanKey:'rec2Tan' },
    3: { spf: '30-50', careKey:'rec3Care', spfKey:'rec3Spf', tanKey:'rec3Tan' },
    4: { spf: '30',  careKey:'rec4Care', spfKey:'rec4Spf', tanKey:'rec4Tan' },
    5: { spf: '15-30', careKey:'rec5Care', spfKey:'rec5Spf', tanKey:'rec5Tan' },
    6: { spf: '15-30', careKey:'rec6Care', spfKey:'rec6Spf', tanKey:'rec6Tan' },
  };
  function recommendationsFor(skinId){ return RECOMMENDATIONS[skinId] || RECOMMENDATIONS[3]; }

  global.SkinModel = { SKIN_TYPES, SPF_OPTIONS, TAN_GOALS, REFLECTION_FACTOR, skinDescKey, burnMinutes, vitaminDEstimate, recommendationsFor, effectiveUV };
})(window);
