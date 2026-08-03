// Arco Solar — alerts
// Two kinds of "alert" the UI can trigger, both local (no push server needed):
// 1) A one-time-per-day banner + notification when UV crosses into a
//    high/very-high/extreme band.
// 2) Recurring reapply-sunscreen reminders while a manual "session" is active
//    (for time spent in the sun outside the guided routine).
(function(global){
  let sessionInterval = null;

  function notify(title, body){
    if('Notification' in window && Notification.permission === 'granted'){
      try{ new Notification(title, { body }); }catch(e){ /* ignore */ }
    }
    try{ if(navigator.vibrate) navigator.vibrate([100,50,100]); }catch(e){}
  }

  // ---- High-UV banner (checked on every render, fires at most once/day/band) ----
  function checkHighUV(bandName, uv){
    const highBands = ['high','vhigh','extreme'];
    if(!highBands.includes(bandName)) return null;
    const todayKey = new Date().toISOString().slice(0,10);
    const lastAlert = Storage2.get('arcoSolar.lastUvAlert', {});
    if(lastAlert.date !== todayKey || lastAlert.band !== bandName){
      Storage2.set('arcoSolar.lastUvAlert', { date: todayKey, band: bandName });
      notify('Arco Solar', `Índice UV ${uv.toFixed(1)} — protege-te já.`);
    }
    return { bandName, uv };
  }

  // ---- Recurring session reminders ----
  function isSessionActive(){ return Storage2.get('arcoSolar.sessionActive', false); }

  function startSession(intervalMinutes, onTick){
    Storage2.set('arcoSolar.sessionActive', true);
    Storage2.set('arcoSolar.sessionInterval', intervalMinutes);
    clearInterval(sessionInterval);
    sessionInterval = setInterval(() => {
      notify('Arco Solar', 'Hora de reaplicar o protetor solar.');
      onTick && onTick();
    }, intervalMinutes * 60 * 1000);
  }
  function stopSession(){
    Storage2.set('arcoSolar.sessionActive', false);
    clearInterval(sessionInterval);
    sessionInterval = null;
  }
  function resumeSessionIfNeeded(onTick){
    if(isSessionActive()){
      const mins = Storage2.get('arcoSolar.sessionInterval', 20);
      startSession(mins, onTick);
    }
  }

  global.Alerts = { checkHighUV, isSessionActive, startSession, stopSession, resumeSessionIfNeeded };
})(window);
