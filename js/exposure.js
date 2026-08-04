// Arco Solar — live sun exposure stopwatch
// Distinct from RoutineTimer (the guided step-by-step routine): this is a
// freeform "I'm in the sun now" tracker — time-in-sun counts up, time-until-
// burn counts down live from the current burn-time estimate, and fires a
// proactive warning ~10 minutes before the estimated burn point.
(function(global){
  const KEY = 'arcoSolar.exposureStart';
  let tickInterval = null;
  let onTick = () => {};
  let warned10 = false, warnedBurn = false;
  let lastWaterBreakAt = 0;

  function isActive(){ return Storage2.get(KEY, null) !== null; }
  function getStartTime(){ return Storage2.get(KEY, null); }

  function start(){
    if(isActive()) return;
    Storage2.set(KEY, Date.now());
    warned10 = false; warnedBurn = false; lastWaterBreakAt = 0;
    tickInterval = setInterval(() => onTick(), 1000);
  }
  function stop(){
    Storage2.set(KEY, null);
    clearInterval(tickInterval);
    tickInterval = null;
  }
  function resumeIfNeeded(){
    if(isActive()){
      tickInterval = setInterval(() => onTick(), 1000);
    }
  }

  function elapsedSeconds(){
    const start = getStartTime();
    if(!start) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  }

  // burnMinutes = current estimate (already skin+SPF+UV adjusted, from SkinModel.burnMinutes)
  function remainingSeconds(burnMinutes){
    return Math.round(burnMinutes*60) - elapsedSeconds();
  }

  function notify(title, body){
    if('Notification' in window && Notification.permission === 'granted'){
      try{ new Notification(title, { body }); }catch(e){}
    }
    try{ if(navigator.vibrate) navigator.vibrate([150,80,150]); }catch(e){}
  }

  // Call every tick with the current burn-time estimate; fires each warning once.
  function checkWarnings(burnMinutes){
    const remaining = remainingSeconds(burnMinutes);
    if(!warned10 && remaining <= 600 && remaining > 0){
      warned10 = true;
      notify('Arco Solar', I18n.t('exposureWarn10'));
    }
    if(!warnedBurn && remaining <= 0){
      warnedBurn = true;
      notify('Arco Solar', I18n.t('exposureWarnBurn'));
    }
  }

  const WATER_BREAK_INTERVAL = 30*60; // 30 minutes

  // Call every tick alongside checkWarnings, passing whether the reflective
  // (water/sand) toggle is on — only suggests water breaks in that context.
  function checkWaterBreak(reflectiveActive){
    if(!reflectiveActive) return;
    const el = elapsedSeconds();
    if(el - lastWaterBreakAt >= WATER_BREAK_INTERVAL){
      lastWaterBreakAt = el;
      notify('Arco Solar', I18n.t('exposureWaterBreak'));
    }
  }

  global.Exposure = { isActive, start, stop, resumeIfNeeded, elapsedSeconds, remainingSeconds, checkWarnings, checkWaterBreak,
    onTick(fn){ onTick = fn; } };
})(window);
