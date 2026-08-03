// Arco Solar — storage
// Wraps localStorage so it never throws: works normally once hosted for real,
// and silently no-ops if run inside a sandboxed preview that blocks storage.
(function(global){
  function get(key, fallback){
    try{
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    }catch(e){ return fallback; }
  }
  function set(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ return false; }
  }
  function remove(key){
    try{ localStorage.removeItem(key); }catch(e){ /* no-op */ }
  }

  // --- Session history (for the History tab) ---
  const HISTORY_KEY = 'arcoSolar.history';
  const MAX_HISTORY = 60;

  function logSession(entry){
    const list = get(HISTORY_KEY, []);
    list.push({ ts: Date.now(), ...entry });
    while(list.length > MAX_HISTORY) list.shift();
    set(HISTORY_KEY, list);
    return list;
  }
  function getHistory(){ return get(HISTORY_KEY, []); }
  function clearHistory(){ remove(HISTORY_KEY); }

  global.Storage2 = { get, set, remove, logSession, getHistory, clearHistory };
})(window);
