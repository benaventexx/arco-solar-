// Arco Solar — bootstrap
(function(){
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(()=>{ /* offline shell just won't be cached */ });
    });
  }
  document.addEventListener('DOMContentLoaded', () => UI.init());
})();
