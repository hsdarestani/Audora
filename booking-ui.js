/* Direct booking flow layered onto the full-stack Audora frontend. */
(() => {
  function langText(de,en){return typeof lang!=='undefined'&&lang==='de'?de:en}
  function esc(v){return typeof escapeHTML==='function'?escapeHTML(v):String(v).replace(/[&<>"']/g,'')}
  function modal(){return document.getElementById('functionalModal')}
  function body(){return document.getElementById('functionalBody')}
  function open(html){const m=modal();if(!m)return;body().innerHTML=html;document.getElementById('functionalContent')?.classList.remove('wide');m.classList.add('open');m.setAttribute('aria-hidden','false')}
  function close(){const m=modal();if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}

  /* Empty inbox must be a valid state for a new account. */
  if(typeof renderChat==='function'){
    const originalRenderChat=renderChat;
    renderChat=function(){
      if(typeof conversations!=='undefined' && !conversations.length){
        const header=document.getElementById('chatHeader');
        const messages=document.getElementById('messages');
        if(header)header.innerHTML=`<span><strong>${langText('Noch keine Unterhaltung','No conversation yet')}</strong><small>${langText('Öffne ein Studio oder Creator-Profil und sende eine Nachricht.','Open a studio or creator profile and send a message.')}</small></span>`;
        if(messages)messages.innerHTML=`<div class="provider-empty">${langText('Deine Nachrichten erscheinen hier.','Your messages will appear here.')}</div>`;
        return;
      }
      return originalRenderChat();
    };
  }

  /* A favorite only becomes visually persisted after the database confirms it. */
  if(typeof toggleFavorite==='function' && typeof favorites!=='undefined'){
    toggleFavorite=async function(id){
      const shouldAdd=!favorites.has(id);
      const buttons=[...document.querySelectorAll(`[data-favorite="${CSS.escape(id)}"]`)];
      buttons.forEach(button=>{button.disabled=true;button.setAttribute('aria-busy','true')});
      try{
        const result=await window.AudoraAPI.favorite(id,shouldAdd);
        if(result.active)favorites.add(id);else favorites.delete(id);
        if(typeof renderHome==='function')renderHome();
        if(typeof renderDiscover==='function')renderDiscover();
        if(typeof renderSaved==='function')renderSaved();
        if(typeof updateFavoriteCounts==='function')updateFavoriteCounts();
      }catch(err){
        console.error('[Audora API]',err);
        if(typeof showToast==='function')showToast(langText('Speichern fehlgeschlagen. Bitte erneut versuchen.','Save failed. Please try again.'));
      }finally{
        document.querySelectorAll(`[data-favorite="${CSS.escape(id)}"]`).forEach(button=>{button.disabled=false;button.removeAttribute('aria-busy')});
      }
    };
  }

  /* Keep the sign-in/account control reachable on mobile as well, including when api.js injects it after bootstrap. */
  function exposeMobileAuth(){
    const status=document.getElementById('backendStatus');
    if(status && window.matchMedia('(max-width: 820px)').matches){
      status.style.setProperty('display','inline-flex','important');
      status.style.setProperty('max-width','104px','important');
      status.style.setProperty('visibility','visible','important');
      status.removeAttribute('hidden');
      return true;
    }
    return !!status;
  }
  exposeMobileAuth();
  window.addEventListener('resize',exposeMobileAuth,{passive:true});
  document.addEventListener('DOMContentLoaded',()=>{
    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      const ready=exposeMobileAuth();
      if((ready && tries>=4)||tries>=24)clearInterval(timer);
    },250);
  });

  /* app.js toggles map state on a delegated document click, so mirror it after that handler runs. */
  document.getElementById('mapToggle')?.addEventListener('click',()=>{
    setTimeout(()=>{
      const layout=document.getElementById('discoverLayout');
      const panel=document.getElementById('mapPanel');
      panel?.classList.toggle('open',!!layout?.classList.contains('map-open'));
      panel?.setAttribute('aria-hidden',layout?.classList.contains('map-open')?'false':'true');
    },0);
  });

  /* A read notification should not leave an overlay blocking the app. */
  document.addEventListener('click',e=>{
    if(!e.target.closest('[data-notification-id]'))return;
    const panel=document.getElementById('notificationPanel');
    if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true')}
  });

  window.openDirectBooking=async function(id){
    const item=(typeof listings!=='undefined'?listings:[]).find(x=>x.id===id);
    if(!item)return;
    let availability={slots:[],bookings:[]};
    try{availability=await window.AudoraAPI.availability(id)}catch(_e){}
    const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());const min=now.toISOString().slice(0,16);
    open(`<h2>${langText('Direkt buchen','Book directly')}</h2><p>${esc(item.name)} — ${langText('Termin wählen. Audora prüft beim Bestätigen live, ob der Slot noch frei ist.','Choose a time. Audora checks live at confirmation that the slot is still free.')}</p><form class="functional-form" id="directBookingForm" data-listing="${esc(id)}"><label><span>${langText('DATUM & UHRZEIT','DATE & TIME')}</span><input type="datetime-local" name="start" min="${min}" required></label><label><span>${langText('DAUER','DURATION')}</span><select name="duration"><option value="1">1 ${langText('Stunde','hour')}</option><option value="2">2 ${langText('Stunden','hours')}</option><option value="3" selected>3 ${langText('Stunden','hours')}</option><option value="4">4 ${langText('Stunden','hours')}</option><option value="6">6 ${langText('Stunden','hours')}</option></select></label><label><span>${langText('NOTIZ (OPTIONAL)','NOTE (OPTIONAL)')}</span><textarea name="notes" placeholder="${langText('Was soll vorbereitet werden?','Anything that should be prepared?')}"></textarea></label><div class="review-summary"><strong class="review-score">€${Number(item.price).toFixed(0)}</strong><div><strong>${item.category==='studio'?langText('pro Stunde','per hour'):langText('pro Buchung','per booking')}</strong><small>${availability.bookings?.length||0} ${langText('bestehende Termine im angezeigten Zeitraum','existing bookings in the shown period')}</small></div></div><div class="functional-message" id="directBookingMessage"></div><button class="primary-btn" type="submit">${langText('Verfügbarkeit prüfen & buchen','Check availability & book')}</button></form>`)
  };

  if(typeof bookListing!=='undefined'){
    bookListing=function(id){closeModals?.();window.openDirectBooking(id)};
  }

  document.addEventListener('submit',async e=>{
    if(e.target.id!=='directBookingForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    const form=e.target,fd=new FormData(form),msg=document.getElementById('directBookingMessage'),button=form.querySelector('button[type=submit]');
    const start=new Date(fd.get('start'));
    if(Number.isNaN(start.getTime()))return;
    button.disabled=true;msg.textContent=langText('Slot wird geprüft…','Checking slot…');msg.className='functional-message';
    try{
      const result=await window.AudoraAPI.request('/bookings/',{method:'POST',body:JSON.stringify({listing_id:form.dataset.listing,start_at:start.toISOString(),duration_hours:Number(fd.get('duration')),notes:fd.get('notes')})});
      msg.textContent=langText(`Bestätigt · €${Math.round(result.total)}`,`Confirmed · €${Math.round(result.total)}`);msg.classList.add('success');
      if(typeof showToast==='function')showToast(langText('Buchung bestätigt.','Booking confirmed.'));
      setTimeout(close,650);
    }catch(err){msg.textContent=(err.code==='slot_just_booked')?langText('Dieser Slot ist bereits vergeben. Bitte wähle eine andere Zeit.','That slot is already booked. Choose another time.'):langText('Buchung konnte nicht abgeschlossen werden.','Booking could not be completed.');msg.classList.add('error')}
    finally{button.disabled=false}
  },true);
})();
