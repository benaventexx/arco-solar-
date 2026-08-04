// Arco Solar — solar data
// Tries real, live UV data from Open-Meteo (free, no API key, CORS-open).
// If that fetch fails for any reason (offline, DNS, a restrictive sandbox),
// falls back automatically to a clear-sky estimate computed from real solar
// geometry (latitude/date/hour), so the app never gets stuck on an error
// screen. The fallback is always labelled as an estimate in the UI.
(function(global){

  async function geocode(name){
    const results = await searchCities(name, 1);
    if(!results.length) throw new Error(I18n.t('cityNotFound'));
    return results[0];
  }

  async function searchCities(name, count){
    if(!name || name.trim().length < 2) return [];
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=${count||5}&language=pt&format=json`);
    const j = await r.json();
    if(!j.results) return [];
    return j.results.map(top => ({
      lat: top.latitude, lon: top.longitude,
      place: `${top.name}, ${top.country}`,
      admin: top.admin1 || '',
    }));
  }

  async function fetchLive(lat, lon){
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index,temperature_2m,weathercode&daily=uv_index_max,sunrise,sunset&timezone=auto&forecast_days=10`);
    if(!r.ok) throw new Error('network');
    const data = await r.json();
    if(!data || !data.hourly || !data.daily) throw new Error('bad-payload');
    return { hourly: data.hourly, daily: data.daily, utcOffset: data.utc_offset_seconds || 0, isEstimate: false };
  }

  // WMO weather codes -> a simple emoji + label, good enough for a compact UI badge
  const WEATHER_CODES = {
    0:{icon:'☀️',label:'Céu limpo'}, 1:{icon:'🌤️',label:'Maioritariamente limpo'}, 2:{icon:'⛅',label:'Parcialmente nublado'}, 3:{icon:'☁️',label:'Nublado'},
    45:{icon:'🌫️',label:'Nevoeiro'}, 48:{icon:'🌫️',label:'Nevoeiro'},
    51:{icon:'🌦️',label:'Chuvisco'}, 53:{icon:'🌦️',label:'Chuvisco'}, 55:{icon:'🌦️',label:'Chuvisco'},
    61:{icon:'🌧️',label:'Chuva'}, 63:{icon:'🌧️',label:'Chuva'}, 65:{icon:'🌧️',label:'Chuva forte'},
    71:{icon:'🌨️',label:'Neve'}, 73:{icon:'🌨️',label:'Neve'}, 75:{icon:'🌨️',label:'Neve forte'},
    80:{icon:'🌦️',label:'Aguaceiros'}, 81:{icon:'🌦️',label:'Aguaceiros'}, 82:{icon:'⛈️',label:'Aguaceiros fortes'},
    95:{icon:'⛈️',label:'Trovoada'}, 96:{icon:'⛈️',label:'Trovoada'}, 99:{icon:'⛈️',label:'Trovoada forte'},
  };
  function weatherFor(code){ return WEATHER_CODES[code] || { icon:'☀️', label:'—' }; }

  // Peak UV time today + solar noon (midpoint between sunrise and sunset)
  function solarStatsToday(hourly, daily){
    const todayISO = daily.time[0];
    let peakUv = 0, peakIdx = -1;
    hourly.time.forEach((t,i) => {
      if(t.startsWith(todayISO) && hourly.uv_index[i] > peakUv){ peakUv = hourly.uv_index[i]; peakIdx = i; }
    });
    const peakTime = peakIdx >= 0 ? hourly.time[peakIdx].slice(11,16) : null;
    let solarNoon = null;
    if(daily.sunrise && daily.sunrise[0] && daily.sunset && daily.sunset[0]){
      const toMin = (s) => { const [h,m] = s.slice(11,16).split(':').map(Number); return h*60+m; };
      const midMin = Math.round((toMin(daily.sunrise[0]) + toMin(daily.sunset[0])) / 2);
      const hh = Math.floor(midMin/60), mm = midMin%60;
      solarNoon = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    }
    return { peakUv, peakTime, solarNoon };
  }

  // ---- Clear-sky fallback model, from real solar geometry ----
  function dayOfYear(d){
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }
  function solarElevationDeg(lat, date, hourLocal){
    const rad = Math.PI/180;
    const N = dayOfYear(date);
    const decl = 23.44*rad*Math.sin((360/365)*(N-81)*rad);
    const hourAngle = (hourLocal - 12)*15*rad;
    const latR = lat*rad;
    const sinEl = Math.sin(latR)*Math.sin(decl) + Math.cos(latR)*Math.cos(decl)*Math.cos(hourAngle);
    return Math.asin(Math.max(-1, Math.min(1, sinEl))) / rad;
  }
  function uvFromElevation(elevDeg, cloudFactor){
    if(elevDeg <= 0) return 0;
    const rad = Math.PI/180;
    const raw = 12.4 * Math.pow(Math.sin(elevDeg*rad), 1.05);
    return Math.max(0, raw * cloudFactor);
  }
  function cloudFactorFor(lat, lon, dateStr){
    let h = 0;
    const s = `${lat.toFixed(1)}-${lon.toFixed(1)}-${dateStr}`;
    for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) % 1000; }
    return 0.78 + (h/1000)*0.22;
  }
  function sunTimesFor(lat, date){
    // rough sunrise/sunset from the same elevation model (hour where elevation crosses 0)
    let sunrise = null, sunset = null;
    for(let h=0; h<24; h+=0.25){
      const el = solarElevationDeg(lat, date, h);
      if(sunrise===null && el>0) sunrise = h;
      if(sunrise!==null && sunset===null && el<=0 && h>12) sunset = h;
    }
    const fmt = (h)=>{ if(h===null) return null; const hh=Math.floor(h), mm=Math.round((h-hh)*60); return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; };
    return { sunrise: fmt(sunrise), sunset: fmt(sunset) };
  }

  function buildEstimate(lat, lon){
    const now = new Date();
    const hourly = { time: [], uv_index: [] };
    const daily = { time: [], uv_index_max: [], sunrise: [], sunset: [] };
    for(let dOff=0; dOff<10; dOff++){
      const day = new Date(now); day.setDate(now.getDate()+dOff);
      const dateStr = day.toISOString().slice(0,10);
      const cf = cloudFactorFor(lat, lon, dateStr);
      let dayMax = 0;
      for(let hr=0; hr<24; hr++){
        const el = solarElevationDeg(lat, day, hr);
        const uv = Math.round(uvFromElevation(el, cf)*10)/10;
        if(dOff===0){ hourly.time.push(`${dateStr}T${String(hr).padStart(2,'0')}:00`); hourly.uv_index.push(uv); }
        dayMax = Math.max(dayMax, uv);
      }
      const st = sunTimesFor(lat, day);
      daily.time.push(dateStr);
      daily.uv_index_max.push(Math.round(dayMax*10)/10);
      daily.sunrise.push(st.sunrise ? `${dateStr}T${st.sunrise}` : null);
      daily.sunset.push(st.sunset ? `${dateStr}T${st.sunset}` : null);
    }
    return { hourly, daily, utcOffset: Math.round(lon/15)*3600, isEstimate: true };
  }

  async function getForecast(lat, lon){
    try{
      return await fetchLive(lat, lon);
    }catch(e){
      console.warn('Arco Solar: live data unavailable, using clear-sky estimate.', e.message);
      return buildEstimate(lat, lon);
    }
  }

  global.SolarAPI = { geocode, searchCities, getForecast, weatherFor, solarStatsToday };
})(window);
