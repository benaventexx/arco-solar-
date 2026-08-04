// Arco Solar — multi-day tan plan
// Spreads tanning across several days with a gradually increasing exposure
// factor (safer than trying to reach a deep tan in one session), tracks
// which calendar days had a completed session, and reports progress.
(function(global){
  const KEY = 'arcoSolar.tanPlan';

  function today(){ return new Date().toISOString().slice(0,10); }

  function getPlan(){ return Storage2.get(KEY, null); }

  function startPlan(totalDays, goalId){
    const plan = { totalDays, goalId, startDate: today(), completedDates: [] };
    Storage2.set(KEY, plan);
    return plan;
  }
  function stopPlan(){ Storage2.set(KEY, null); }

  function dayNumber(plan){
    const start = new Date(plan.startDate + 'T00:00:00');
    const now = new Date(today() + 'T00:00:00');
    const diffDays = Math.round((now - start) / 86400000);
    return Math.min(diffDays + 1, plan.totalDays);
  }

  function completedToday(plan){ return plan.completedDates.includes(today()); }

  function missedDays(plan){
    // days strictly before today, within the plan window, with no completion
    const dn = dayNumber(plan);
    const start = new Date(plan.startDate + 'T00:00:00');
    let missed = 0;
    for(let i=0; i<dn-1; i++){
      const d = new Date(start); d.setDate(start.getDate()+i);
      const key = d.toISOString().slice(0,10);
      if(!plan.completedDates.includes(key)) missed++;
    }
    return missed;
  }

  function markTodayComplete(){
    const plan = getPlan();
    if(!plan) return;
    const t = today();
    if(!plan.completedDates.includes(t)) plan.completedDates.push(t);
    if(dayNumber(plan) >= plan.totalDays && completedToday(plan)){
      // plan naturally finished — keep the record but mark inactive next read
    }
    Storage2.set(KEY, plan);
  }

  // Exposure factor for today's session: ramps from ~35% up to 100% of the
  // chosen tan-goal factor across the plan's length, so early days are short
  // and cautious and later days approach the full goal.
  function factorForToday(plan, goalFactor){
    if(plan.totalDays <= 1) return goalFactor;
    const dn = dayNumber(plan);
    const ramp = 0.35 + 0.65 * ((dn - 1) / (plan.totalDays - 1));
    return goalFactor * Math.min(ramp, 1);
  }

  function status(){
    const plan = getPlan();
    if(!plan) return null;
    const dn = dayNumber(plan);
    const finished = dn >= plan.totalDays && plan.completedDates.length >= plan.totalDays;
    return {
      plan, dayNumber: dn, totalDays: plan.totalDays,
      completedToday: completedToday(plan),
      missedDays: missedDays(plan),
      finished,
    };
  }

  global.TanPlan = { getPlan, startPlan, stopPlan, dayNumber, completedToday, missedDays, markTodayComplete, factorForToday, status };
})(window);
