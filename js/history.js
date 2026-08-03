// Arco Solar — exposure history
// Stores completed sessions locally (device-only, see js/storage.js) and
// renders a simple 14-day bar chart on a <canvas> — no charting library needed.
(function(global){
  function logCompletedSession({ uv, skinId, spf, totalMinutes }){
    return Storage2.logSession({ uv, skinId, spf, totalMinutes });
  }

  function last14Days(history){
    const days = [];
    const now = new Date();
    for(let i=13; i>=0; i--){
      const d = new Date(now); d.setDate(now.getDate()-i);
      const key = d.toISOString().slice(0,10);
      const sessions = history.filter(h => new Date(h.ts).toISOString().slice(0,10) === key);
      const totalMin = sessions.reduce((a,s)=>a+(s.totalMinutes||0), 0);
      days.push({ key, date:d, totalMin, count: sessions.length });
    }
    return days;
  }

  function drawChart(canvas, days){
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w*dpr; canvas.height = h*dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,w,h);
    const max = Math.max(...days.map(d=>d.totalMin), 1);
    const barW = w/days.length;
    const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#F4A93B';
    days.forEach((d,i)=>{
      const barH = Math.max((d.totalMin/max) * (h-4), d.totalMin>0 ? 4 : 1);
      ctx.fillStyle = d.totalMin>0 ? gold : 'rgba(154,161,199,0.25)';
      ctx.fillRect(i*barW + barW*0.18, h-barH, barW*0.64, barH);
    });
  }

  global.History = { logCompletedSession, last14Days, drawChart, get: Storage2.getHistory, clear: Storage2.clearHistory };
})(window);
