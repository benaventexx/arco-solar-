// Arco Solar — UI rendering
// Talks to SolarAPI / SkinModel / RoutineTimer / History / Storage2 / I18n.
// Kept as plain DOM string-building (no framework) to stay dependency-free
// and easy to audit.
(function(global){
  const bandFor = (uv) => {
    if(uv < 3) return { name:'low', hex:'#4FC08D' };
    if(uv < 6) return { name:'mod', hex:'#E8C547' };
    if(uv < 8) return { name:'high', hex:'#F19A3E' };
    if(uv < 11) return { name:'vhigh', hex:'#E8544B' };
    return { name:'extreme', hex:'#B565D8' };
  };
  const BAND_LABEL = {
    pt: { low:'Baixo', mod:'Moderado', high:'Alto', vhigh:'Muito alto', extreme:'Extremo' },
    en: { low:'Low', mod:'Moderate', high:'High', vhigh:'Very high', extreme:'Extreme' },
    es: { low:'Bajo', mod:'Moderado', high:'Alto', vhigh:'Muy alto', extreme:'Extremo' },
  };
  function bandLabel(name){ return (BAND_LABEL[I18n.getLang()] || BAND_LABEL.pt)[name]; }

  const state = {
    tab: 'today',
    skin: Storage2.get('arcoSolar.skin', 3),
    spf: Storage2.get('arcoSolar.spf', 0),
    tanGoal: Storage2.get('arcoSolar.tanGoal', 'medium'),
    lat: 39.601, lon: -9.071, place: 'Nazaré, Portugal',
    hourly: null, daily: null, utcOffset: 0, isEstimate: false,
    routineInitialized: false,
    sessionStartMinutes: 0,
    photoSuggestion: null, photoAnalyzing: false,
  };

  function localNow(){ return new Date(Date.now() + (state.utcOffset||0)*1000); }

  function currentUV(){
    if(!state.hourly) return 0;
    const isoHour = localNow().toISOString().slice(0,13);
    let idx = state.hourly.time.findIndex(t => t.startsWith(isoHour));
    if(idx < 0) idx = localNow().getUTCHours();
    return state.hourly.uv_index[idx] ?? 0;
  }

  function el(id){ return document.getElementById(id); }

  // ---------- Header controls ----------
  function renderChrome(){
    el('appNameLabel').textContent = I18n.t('appName');
    el('betaLabel').textContent = I18n.t('beta');
    el('cityInput').placeholder = I18n.t('cityPlaceholder');
    el('goBtn').textContent = I18n.t('locate');
    el('gpsBtn').title = I18n.t('useGps');
    el('feedbackLink').textContent = I18n.t('feedback');
    el('privacyLink').textContent = I18n.t('privacy');
    el('termsLink').textContent = I18n.t('terms');
    document.querySelectorAll('.tab').forEach(t=>{
      t.textContent = I18n.t('tab' + t.dataset.tab[0].toUpperCase() + t.dataset.tab.slice(1));
      t.classList.toggle('active', t.dataset.tab === state.tab);
    });
  }

  // ---------- Tab: Today ----------
  function renderToday(){
    const uv = currentUV();
    const band = bandFor(uv);
    const arcPct = Math.min(uv/12, 1) * 100;
    const todayISO = localNow().toISOString().slice(0,10);
    const dayHours = state.hourly.time
      .map((t,i)=>({ t, uv: state.hourly.uv_index[i] }))
      .filter(h => h.t.startsWith(todayISO));
    const maxUvToday = Math.max(...dayHours.map(h=>h.uv), 1);
    const sunsetToday = state.daily.sunset ? state.daily.sunset[0] : null;

    const sessionActive = Alerts.isSessionActive();
    const sessionMins = Storage2.get('arcoSolar.sessionInterval', 20);
    const alertInfo = Alerts.checkHighUV(band.name, uv);

    return `
      ${alertInfo ? `<div class="uvbanner"><span class="ico">⚠️</span><span>${I18n.t('uvAlertMsg', uv)}</span></div>` : ''}
      <div class="hero">
        <div class="place">
          <span>${I18n.t('nowIn')} <b>${state.place}</b></span>
          ${state.isEstimate ? `<span class="badge">${I18n.t('offlineEstimate')}</span>` : ''}
        </div>
        <div class="biglabel">
          <div class="bignum">${uv.toFixed(1)}</div>
          <div class="risk" style="background:${band.hex}22; color:${band.hex}; border:1px solid ${band.hex}55;">${bandLabel(band.name)}</div>
        </div>
        <div class="arcbox">
          <svg viewBox="0 0 300 30" preserveAspectRatio="none">
            <defs>
              <linearGradient id="arcgrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#4FC08D"/>
                <stop offset="25%" stop-color="#E8C547"/>
                <stop offset="55%" stop-color="#F19A3E"/>
                <stop offset="80%" stop-color="#E8544B"/>
                <stop offset="100%" stop-color="#B565D8"/>
              </linearGradient>
            </defs>
            <rect x="0" y="12" width="300" height="6" rx="3" fill="url(#arcgrad)" opacity="0.9"/>
          </svg>
          <div class="sunmarker" style="left:${arcPct}%;">☀️</div>
        </div>
        <div class="hourcaps"><span>0</span><span>3</span><span>6</span><span>9</span><span>11+</span></div>
        ${sunsetToday ? `<div class="solarmeta"><span>🌇 ${I18n.t('sunsetToday')}: ${sunsetToday.slice(11,16)}</span></div>` : ''}
      </div>

      <section class="card">
        <h2>${I18n.t('hourlyTitle')}</h2>
        <div class="hourly">
          ${dayHours.map(h=>{
            const b = bandFor(h.uv);
            const isNow = h.t === state.hourly.time[state.hourly.uv_index.indexOf(currentUV())];
            return `<div class="hbar" style="height:${Math.max(h.uv/maxUvToday*100,4)}%; background:${b.hex}; opacity:${h.t.slice(11,13)===localNow().toISOString().slice(11,13)?1:0.55}"></div>`;
          }).join('')}
        </div>
        <div class="hourlylabels">
          <span>${dayHours[0]?.t.slice(11,16) || ''}</span>
          <span>${dayHours[Math.floor(dayHours.length/2)]?.t.slice(11,16) || ''}</span>
          <span>${dayHours[dayHours.length-1]?.t.slice(11,16) || ''}</span>
        </div>
      </section>

      <section class="card">
        <h2>${I18n.t('dailyTitle')}</h2>
        <div class="daylist">
          ${state.daily.time.map((d,i)=>{
            const b = bandFor(state.daily.uv_index_max[i]);
            const dname = new Date(d+'T12:00:00').toLocaleDateString(I18n.getLang()==='pt'?'pt-PT':I18n.getLang(), {weekday:'short'});
            return `<div class="daychip">
              <div class="dname">${dname}</div>
              <div class="dnum" style="color:${b.hex}">${state.daily.uv_index_max[i].toFixed(0)}</div>
              <div class="dband">${bandLabel(b.name)}</div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <section class="card" id="routineCard">
        <h2>${I18n.t('routineTitle')}</h2>
        <div class="timerbig">
          <div class="tt mono" id="timerDisplay">--:--</div>
          <div class="lbl" id="timerLabel">${I18n.t('timerIdleLabel')}</div>
        </div>
        <div class="timerbtns">
          <button class="btn-ghost" id="resetBtn">${I18n.t('resetBtn')}</button>
          <button class="btn-primary" id="startBtn">${I18n.t('startBtn')}</button>
        </div>
        <div id="stepsList" style="margin-top:16px;"></div>
      </section>

      <section class="card">
        <h2>${I18n.t('sessionTitle')}</h2>
        <div class="sessionrow">
          <span class="lbl">${I18n.t('sessionLabel')}</span>
          <button class="sessiontoggle ${sessionActive?'on':'off'}" id="sessionToggleBtn">${sessionActive?I18n.t('sessionOn'):I18n.t('sessionOff')}</button>
        </div>
        <div class="sessionpicker">
          ${[15,20,30,45].map(m => `<div class="sessionchip ${m===sessionMins?'active':''}" data-mins="${m}">${m}min</div>`).join('')}
        </div>
      </section>
    `;
  }

  // ---------- Tab: Skin ----------
  function renderSkin(){
    const uv = currentUV();
    const skin = SkinModel.SKIN_TYPES.find(s=>s.id===state.skin);
    const burnMin = SkinModel.burnMinutes(state.skin, uv, state.spf);
    const vitD = SkinModel.vitaminDEstimate(uv, 20, state.spf);
    const rec = SkinModel.recommendationsFor(state.skin);

    return `
      <section class="card">
        <h2>${I18n.t('skinTitle')}</h2>
        <div class="skinrow">
          ${SkinModel.SKIN_TYPES.map(s => `
            <div class="swatch ${s.id===state.skin?'active':''}" data-skin="${s.id}" data-dark="${s.dark}" style="background:${s.hex}">${s.label}</div>
          `).join('')}
        </div>
        <div class="skinnote">${I18n.t(SkinModel.skinDescKey(state.skin))}</div>

        <input type="file" accept="image/*" capture="environment" id="skinPhotoInput" style="display:none">
        <button class="btn-ghost sharebtn" id="skinPhotoBtn" style="margin-top:14px;">
          ${state.photoAnalyzing ? I18n.t('skinPhotoAnalyzing') : I18n.t('skinPhotoBtn')}
        </button>
        <div class="disclaimer">${I18n.t('skinPhotoHint')}</div>

        ${state.photoSuggestion ? `
          <div class="photosuggest">
            <div class="swatch-preview" style="background:${SkinModel.SKIN_TYPES.find(s=>s.id===state.photoSuggestion.suggestedId).hex}"></div>
            <div class="photosuggest-txt">
              <div class="t1">${I18n.t('skinPhotoSuggested', SkinModel.SKIN_TYPES.find(s=>s.id===state.photoSuggestion.suggestedId).label)}</div>
              <div class="t2">${I18n.t(SkinModel.skinDescKey(state.photoSuggestion.suggestedId))}</div>
            </div>
          </div>
          <div class="timerbtns" style="margin-top:10px;">
            <button class="btn-ghost" id="photoCancelBtn">${I18n.t('skinPhotoCancel')}</button>
            <button class="btn-primary" id="photoUseBtn">${I18n.t('skinPhotoUse')}</button>
          </div>
        ` : ''}
        ${state.photoError ? `<div class="disclaimer" style="color:var(--vhigh);">${I18n.t('skinPhotoError')}</div>` : ''}
      </section>

      <section class="card">
        <h2>${I18n.t('recTitle')}</h2>
        <div class="rectile"><span class="ico">🧴</span><div><div class="t1">SPF ${rec.spf}</div><div class="t2">${I18n.t(rec.spfKey)}</div></div></div>
        <div class="rectile"><span class="ico">💧</span><div><div class="t1">${I18n.t('recCareLabel')}</div><div class="t2">${I18n.t(rec.careKey)}</div></div></div>
        <div class="rectile"><span class="ico">☀️</span><div><div class="t1">${I18n.t('recTanLabel')}</div><div class="t2">${I18n.t(rec.tanKey)}</div></div></div>
        <div class="disclaimer">${I18n.t('burnDisclaimer')}</div>
      </section>

      <section class="card">
        <h2>${I18n.t('tanGoalTitle')}</h2>
        <div class="spfrow">
          ${SkinModel.TAN_GOALS.map(g => `
            <div class="tanchip ${g.id===state.tanGoal?'active':''}" data-tangoal="${g.id}">${I18n.t('tanGoal'+g.id.charAt(0).toUpperCase()+g.id.slice(1))}</div>
          `).join('')}
        </div>
      </section>

      <section class="card">
        <h2>${I18n.t('spfTitle')}</h2>
        <div class="spfrow">
          ${SkinModel.SPF_OPTIONS.map(o => `
            <div class="spfchip ${o.spf===state.spf?'active':''}" data-spf="${o.spf}">${o.spf===0?I18n.t('spfNone'):o.label}</div>
          `).join('')}
        </div>
        <div class="burnrow">
          <div class="burnnum">${burnMin}<span> ${I18n.t('minToBurn')}</span></div>
        </div>
        <div class="vitd">☀️ ${I18n.t('vitaminD')} (20min): ~${vitD} UI</div>
        <div class="disclaimer">${I18n.t('burnDisclaimer')}</div>
      </section>
    `;
  }

  // ---------- Tab: History ----------
  function renderHistory(){
    const history = History.get();
    const days = History.last14Days(history);
    const sessionCount = history.filter(h => Date.now() - h.ts < 14*86400000).length;
    return `
      <section class="card">
        <h2>${I18n.t('historyTitle')}</h2>
        ${history.length === 0 ? `<div class="historyempty">${I18n.t('historyEmpty')}</div>` : `
          <canvas id="historyCanvas" class="historybars" style="width:100%; height:80px;"></canvas>
          <div class="historylabels"><span>${days[0].date.toLocaleDateString(I18n.getLang(), {day:'numeric', month:'short'})}</span><span>${days[13].date.toLocaleDateString(I18n.getLang(), {day:'numeric', month:'short'})}</span></div>
          <div class="skinnote" style="margin-top:10px;">${sessionCount} ${I18n.t('historySessions')}</div>
          <button class="btn-primary sharebtn" id="shareBtn">🔗 ${I18n.t('shareProgress')}</button>
        `}
      </section>
    `;
  }

  function renderTabBody(){
    if(state.tab === 'today') return renderToday();
    if(state.tab === 'skin') return renderSkin();
    if(state.tab === 'history') return renderHistory();
  }

  // ---------- Full render ----------
  function render(){
    renderChrome();
    const app = el('app');
    if(!state.hourly){ app.innerHTML = `<div class="loading">${I18n.t('loadingSolar')}</div>`; return; }
    app.innerHTML = renderTabBody();
    wireTabBody();
  }

  function wireTabBody(){
    if(state.tab === 'today'){
      const burnMin = SkinModel.burnMinutes(state.skin, currentUV(), state.spf);
      const tanFactor = SkinModel.TAN_GOALS.find(g=>g.id===state.tanGoal)?.factor ?? 0.7;
      if(!state.routineInitialized || (!RoutineTimer.getState().running && RoutineTimer.getState().stepIdx===0 && RoutineTimer.getState().remaining===0)){
        RoutineTimer.build(burnMin, tanFactor);
        state.routineInitialized = true;
      }
      renderSteps();
      el('startBtn').onclick = () => RoutineTimer.toggle();
      el('resetBtn').onclick = () => RoutineTimer.reset();
      syncTimerDisplay();

      document.querySelectorAll('.sessionchip').forEach(chip=>{
        chip.onclick = () => {
          const mins = Number(chip.dataset.mins);
          Storage2.set('arcoSolar.sessionInterval', mins);
          if(Alerts.isSessionActive()) Alerts.startSession(mins);
          render();
        };
      });
      const sessionBtn = el('sessionToggleBtn');
      if(sessionBtn){
        sessionBtn.onclick = async () => {
          if(Alerts.isSessionActive()){
            Alerts.stopSession();
          } else {
            if('Notification' in window && Notification.permission === 'default'){
              try{ await Notification.requestPermission(); }catch(e){}
            }
            const mins = Storage2.get('arcoSolar.sessionInterval', 20);
            Alerts.startSession(mins);
          }
          render();
        };
      }
    }
    if(state.tab === 'skin'){
      document.querySelectorAll('.swatch').forEach(swEl=>{
        swEl.onclick = () => { state.skin = Number(swEl.dataset.skin); Storage2.set('arcoSolar.skin', state.skin); render(); };
      });
      document.querySelectorAll('.spfchip').forEach(chipEl=>{
        chipEl.onclick = () => { state.spf = Number(chipEl.dataset.spf); Storage2.set('arcoSolar.spf', state.spf); render(); };
      });
      document.querySelectorAll('.tanchip').forEach(chipEl=>{
        chipEl.onclick = () => { state.tanGoal = chipEl.dataset.tangoal; Storage2.set('arcoSolar.tanGoal', state.tanGoal); render(); };
      });

      const photoBtn = el('skinPhotoBtn');
      const photoInput = el('skinPhotoInput');
      if(photoBtn && photoInput){
        photoBtn.onclick = () => { state.photoError = false; photoInput.click(); };
        photoInput.onchange = async () => {
          const file = photoInput.files && photoInput.files[0];
          if(!file) return;
          state.photoAnalyzing = true; state.photoSuggestion = null; state.photoError = false;
          render();
          try{
            const result = await SkinPhoto.analyzeImageFile(file);
            state.photoSuggestion = result;
          }catch(e){
            state.photoError = true;
          }
          state.photoAnalyzing = false;
          render();
        };
      }
      const useBtn = el('photoUseBtn');
      if(useBtn){
        useBtn.onclick = () => {
          state.skin = state.photoSuggestion.suggestedId;
          Storage2.set('arcoSolar.skin', state.skin);
          state.photoSuggestion = null;
          render();
        };
      }
      const cancelBtn = el('photoCancelBtn');
      if(cancelBtn){
        cancelBtn.onclick = () => { state.photoSuggestion = null; render(); };
      }
    }
    if(state.tab === 'history'){
      const canvas = el('historyCanvas');
      if(canvas){
        const days = History.last14Days(History.get());
        History.drawChart(canvas, days);
      }
      const shareBtn = el('shareBtn');
      if(shareBtn){
        shareBtn.onclick = async () => {
          const count = History.get().length;
          const text = I18n.t('shareText', count);
          if(navigator.share){ try{ await navigator.share({ text, title: I18n.t('appName') }); }catch(e){ /* user cancelled */ } }
          else { try{ await navigator.clipboard.writeText(text); shareBtn.textContent = '✓'; setTimeout(()=>{ shareBtn.textContent = `🔗 ${I18n.t('shareProgress')}`; }, 1500); }catch(e){} }
        };
      }
    }
  }

  const STEP_ICON = { sunscreen:'🧴', front:'☀️', flip:'🔄', back:'☀️', reapply:'🧴' };
  const STEP_TITLE_KEY = { sunscreen:'stepSunscreenTitle', front:'stepFrontTitle', flip:'stepFlipTitle', back:'stepBackTitle', reapply:'stepReapplyTitle' };
  const STEP_SUB_KEY = { sunscreen:'stepSunscreenSub', front:'stepFrontSub', flip:'stepFlipSub', back:'stepBackSub', reapply:'stepReapplySub' };

  function fmt(sec){
    const m = Math.floor(sec/60), s = sec%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function renderSteps(){
    const list = el('stepsList');
    if(!list) return;
    const st = RoutineTimer.getState();
    list.innerHTML = RoutineTimer.getSteps().map((s,i)=>{
      const isActive = i===st.stepIdx && st.running;
      return `<div class="routine-step ${s.done?'done':''} ${isActive?'active':''}">
        <div class="ico">${s.done?'✓':STEP_ICON[s.key]}</div>
        <div class="txt"><div class="t1">${I18n.t(STEP_TITLE_KEY[s.key])}</div><div class="t2">${I18n.t(STEP_SUB_KEY[s.key])}</div></div>
        <div class="stat">${fmt(s.seconds)}</div>
      </div>`;
    }).join('');
  }

  function syncTimerDisplay(){
    const st = RoutineTimer.getState();
    const steps = RoutineTimer.getSteps();
    const step = steps[st.stepIdx];
    const disp = el('timerDisplay'), lbl = el('timerLabel'), startBtn = el('startBtn');
    if(!disp) return;
    if(!step){ disp.textContent = '--:--'; lbl.textContent = I18n.t('routineDone'); return; }
    disp.textContent = (st.running || st.remaining>0) ? fmt(Math.max(st.remaining,0)) : '--:--';
    lbl.textContent = (st.running || st.remaining>0) ? I18n.t(STEP_TITLE_KEY[step.key]) : I18n.t('timerIdleLabel');
    if(startBtn) startBtn.textContent = st.running ? I18n.t('pauseBtn') : (st.remaining>0 ? I18n.t('resumeBtn') : I18n.t('startBtn'));
  }

  RoutineTimer.onChange(() => { renderSteps(); syncTimerDisplay(); });
  RoutineTimer.onComplete(() => {
    const totalMinutes = RoutineTimer.getSteps().reduce((a,s)=>a+s.seconds,0)/60;
    History.logCompletedSession({ uv: currentUV(), skinId: state.skin, spf: state.spf, totalMinutes });
    if('Notification' in window && Notification.permission === 'granted'){
      try{ new Notification(I18n.t('appName'), { body: I18n.t('routineDone') }); }catch(e){}
    }
  });

  // ---------- Location ----------
  async function loadLocation(lat, lon, place){
    try{
      el('goBtn').disabled = true;
      state.lat = lat; state.lon = lon; state.place = place;
      const data = await SolarAPI.getForecast(lat, lon);
      state.hourly = data.hourly; state.daily = data.daily;
      state.utcOffset = data.utcOffset; state.isEstimate = data.isEstimate;
      Storage2.set('arcoSolar.place', { lat, lon, place });
      render();
    }catch(e){
      el('app').innerHTML = `<div class="loading">${I18n.t('couldNotLoad')}<div class="err">${e.message}</div></div>`;
    }finally{
      el('goBtn').disabled = false;
    }
  }

  async function searchCity(){
    const name = el('cityInput').value.trim();
    if(!name) return;
    el('app').innerHTML = `<div class="loading">${I18n.t('locating')}</div>`;
    try{
      const g = await SolarAPI.geocode(name);
      loadLocation(g.lat, g.lon, g.place);
    }catch(e){
      el('app').innerHTML = `<div class="loading">${I18n.t('cityNotFound')}<div class="err">${e.message}</div></div>`;
    }
  }

  function useGps(){
    if(!navigator.geolocation){
      el('app').innerHTML = `<div class="loading">${I18n.t('gpsUnavailable')}</div>`;
      return;
    }
    el('app').innerHTML = `<div class="loading">${I18n.t('gettingGps')}</div>`;
    navigator.geolocation.getCurrentPosition(
      pos => loadLocation(pos.coords.latitude, pos.coords.longitude, I18n.t('nowIn')),
      () => { el('app').innerHTML = `<div class="loading">${I18n.t('gpsDenied')}<div class="err">${I18n.t('gpsHint')}</div></div>`; }
    );
  }

  // ---------- Tabs & language ----------
  function wireTabs(){
    document.querySelectorAll('.tab').forEach(t=>{
      t.onclick = () => { state.tab = t.dataset.tab; render(); };
    });
  }
  function wireLang(){
    const sel = el('langSelect');
    sel.value = I18n.getLang();
    sel.onchange = () => { I18n.setLang(sel.value); Storage2.set('arcoSolar.lang', sel.value); render(); };
  }

  // ---------- Onboarding ----------
  const ONBOARD_SLIDES = [
    { emoji:'☀️', titleKey:'onboard1Title', bodyKey:'onboard1Body' },
    { emoji:'🧴', titleKey:'onboard2Title', bodyKey:'onboard2Body' },
    { emoji:'📋', titleKey:'onboard3Title', bodyKey:'onboard3Body' },
  ];
  function showOnboarding(){
    if(Storage2.get('arcoSolar.onboarded', false)) return;
    let step = 0;
    const overlay = document.createElement('div');
    overlay.className = 'onboard-overlay';
    document.body.appendChild(overlay);
    function paint(){
      const s = ONBOARD_SLIDES[step];
      const isLast = step === ONBOARD_SLIDES.length - 1;
      overlay.innerHTML = `
        <div class="onboard-card">
          <div class="emoji">${s.emoji}</div>
          <h3>${I18n.t(s.titleKey)}</h3>
          <p>${I18n.t(s.bodyKey)}</p>
          <div class="onboard-dots">${ONBOARD_SLIDES.map((_,i)=>`<span class="${i===step?'active':''}"></span>`).join('')}</div>
          <div class="onboard-btns">
            ${!isLast ? `<button class="btn-ghost" id="obSkip">${I18n.t('skip')}</button><button class="btn-primary" id="obNext">${I18n.t('next')}</button>`
                      : `<button class="btn-primary" id="obStart" style="flex:1;">${I18n.t('start')}</button>`}
          </div>
        </div>`;
      const finish = () => { Storage2.set('arcoSolar.onboarded', true); overlay.remove(); };
      if(!isLast){
        el('obSkip').onclick = finish;
        el('obNext').onclick = () => { step++; paint(); };
      } else {
        el('obStart').onclick = finish;
      }
    }
    paint();
  }

  // ---------- Notifications (local reminders only, no push server) ----------
  function maybeRequestNotifications(){
    const btn = el('notifBtn');
    if(!btn) return;
    if(!('Notification' in window)){ btn.style.display = 'none'; return; }
    btn.onclick = async () => {
      try{
        const perm = await Notification.requestPermission();
        alert(perm === 'granted' ? I18n.t('notifPermGranted') : I18n.t('notifPermDenied'));
      }catch(e){}
    };
  }

  global.UI = {
    init(){
      const savedLang = Storage2.get('arcoSolar.lang', (navigator.language||'pt').slice(0,2));
      I18n.setLang(I18n.available.includes(savedLang) ? savedLang : 'pt');
      wireTabs();
      wireLang();
      maybeRequestNotifications();
      Alerts.resumeSessionIfNeeded();

      el('goBtn').onclick = searchCity;
      el('cityInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') searchCity(); });
      el('gpsBtn').onclick = useGps;

      const saved = Storage2.get('arcoSolar.place', null);
      if(saved){ el('cityInput').value = saved.place.split(',')[0]; loadLocation(saved.lat, saved.lon, saved.place); }
      else { loadLocation(state.lat, state.lon, state.place); }

      showOnboarding();
    },
    _state: state, // exposed read-only for tests
  };
})(window);
