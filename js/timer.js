// Arco Solar — sun session routine timer
// Pure logic + side-effect hooks (vibration/sound). No DOM access here;
// js/ui.js wires this to the screen so the two stay decoupled and testable.
(function(global){
  let steps = [];
  let interval = null;
  let state = { running:false, remaining:0, stepIdx:0 };
  let onChange = () => {};
  let onComplete = () => {};

  function beep(){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      setTimeout(()=>{ osc.stop(); ctx.close(); }, 180);
    }catch(e){ /* audio not available, safe to ignore */ }
  }
  function buzz(pattern){
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){ /* not available */ }
  }

  function build(burnMinutes, tanFactor, includeOil){
    const factor = typeof tanFactor === 'number' ? tanFactor : 0.7;
    const targetMinutes = Math.min(burnMinutes * factor, burnMinutes * 0.95); // never exceed safe burn time
    const perSide = Math.max(Math.round(targetMinutes/2), 5);
    steps = [
      { key:'sunscreen', seconds:600, done:false },
      ...(includeOil ? [{ key:'oil', seconds:120, done:false }] : []),
      { key:'front',     seconds:perSide*60, done:false },
      { key:'flip',      seconds:20, done:false },
      { key:'back',      seconds:perSide*60, done:false },
      { key:'reapply',   seconds:600, done:false },
    ];
    return steps;
  }

  function reset(){
    clearInterval(interval);
    state = { running:false, remaining:0, stepIdx:0 };
    steps.forEach(s=>s.done=false);
    onChange();
  }

  function tick(skipDecrement){
    if(!skipDecrement) state.remaining--;
    if(state.remaining <= 0){
      const finishedStep = steps[state.stepIdx];
      if(finishedStep) finishedStep.done = true;
      state.stepIdx++;
      buzz([120,60,120]); beep();
      if(state.stepIdx >= steps.length){
        clearInterval(interval);
        state.running = false;
        onChange();
        onComplete();
        return;
      }
      state.remaining = steps[state.stepIdx].seconds;
    }
    onChange();
  }

  function start(){
    if(state.running) return;
    if(state.stepIdx >= steps.length) return;
    if(!state.remaining) state.remaining = steps[state.stepIdx].seconds;
    state.running = true;
    interval = setInterval(()=>tick(false), 1000);
    tick(true);
  }
  function pause(){
    state.running = false;
    clearInterval(interval);
    onChange();
  }
  function toggle(){ state.running ? pause() : start(); }

  function getState(){ return state; }
  function getSteps(){ return steps; }

  global.RoutineTimer = {
    build, start, pause, toggle, reset, getState, getSteps,
    onChange(fn){ onChange = fn; },
    onComplete(fn){ onComplete = fn; },
  };
})(window);
