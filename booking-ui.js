/* Audora interaction fixes outside the Session Builder. Builder logic lives only in builder-team-selection.js. */
(() => {
  const langText=(de,en)=>typeof lang!=='undefined'&&lang==='de'?de:en;
  const esc=v=>typeof escapeHTML==='function'?escapeHTML(v):String(v??'').replace(/[&<>"']/g,'');
  const modal=()=>document.getElementById('functionalModal');
  const body=()=>document.getElementById('functionalBody');
  function open(html){const m=modal();if(!m)return;body().innerHTML=html;document.getElementById('functionalContent')?.classList.remove('wide');m.classList.add('open');m.setAttribute('aria-hidden','false')}
  function close(){const m=modal();if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}

  /* Empty Inbox is a valid state. */
  if(typeof renderChat==='function'){
    const original=renderChat;
    renderChat=function(){
      if(typeof conversations!=='undefined'&&!conversations.length){
        const header=document.getElementById('chatHeader'),messages=document.getElementById('messages');
        if(header)header.innerHTML=`<span><strong>${langText('Noch keine Unterhaltung','No conversation yet')}</strong><small>${langText('Öffne ein Studio oder Creator-Profil und sende eine Nachricht.','Open a studio or creator profile and send a message.')}</small></span>`;
        if(messages)messages.innerHTML=`<div class="provider-empty">${langText('Deine Nachrichten erscheinen hier.','Your messages will appear here.')}</div>`;
        return;
      }
      return original();
    };
  }

  /* Favorite becomes active only after the database confirms persistence. */
  if(typeof toggleFavorite==='function'&&typeof favorites!=='undefined'){
    toggleFavorite=async function(id){
      const shouldAdd=!favorites.has(id);const buttons=[...document.querySelectorAll(`[data-favorite="${CSS.escape(id)}"]`)];
      buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true')});
      try{
        const result=await window.AudoraAPI.favorite(id,shouldAdd);
        if(result.active)favorites.add(id);else favorites.delete(id);
        renderHome?.();renderDiscover?.();renderSaved?.();updateFavoriteCounts?.();
      }catch(err){console.error('[Audora favorite]',err);showToast?.(langText('Speichern fehlgeschlagen. Bitte erneut versuchen.','Save failed. Please try again.'))}
      finally{document.querySelectorAll(`[data-favorite="${CSS.escape(id)}"]`).forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy')})}
    };
  }

  /* Listing modal must not remain above Inbox after Message. */
  if(typeof messageListing==='function'){
    const original=messageListing;
    messageListing=async function(id){
      if(typeof closeModals==='function')closeModals();
      else document.getElementById('listingModal')?.classList.remove('open');
      return original(id);
    };
  }

  function exposeMobileAuth(){
    const status=document.getElementById('backendStatus');
    if(status&&window.matchMedia('(max-width: 820px)').matches){status.style.setProperty('display','inline-flex','important');status.style.setProperty('max-width','104px','important');status.style.setProperty('visibility','visible','important');status.removeAttribute('hidden');return true}
    return !!status;
  }
  exposeMobileAuth();window.addEventListener('resize',exposeMobileAuth,{passive:true});
  document.addEventListener('DOMContentLoaded',()=>{let tries=0;const timer=setInterval(()=>{tries++;const ready=exposeMobileAuth();if((ready&&tries>=4)||tries>=24)clearInterval(timer)},250)});

  document.getElementById('mapToggle')?.addEventListener('click',()=>setTimeout(()=>{
    const layout=document.getElementById('discoverLayout'),panel=document.getElementById('mapPanel');
    panel?.classList.toggle('open',!!layout?.classList.contains('map-open'));panel?.setAttribute('aria-hidden',layout?.classList.contains('map-open')?'false':'true');
  },0));

  async function refreshNotificationPanel(){
    const panel=document.getElementById('notificationPanel'),list=panel?.querySelector('.notification-list');if(!panel||!list||!window.AudoraAPI)return;
    try{
      const data=await window.AudoraAPI.notifications(),rows=Array.isArray(data?.results)?data.results:[];
      list.innerHTML=rows.length?rows.map(n=>`<button data-notification-id="${n.id}"><span class="activity-icon ${n.read?'':'purple'}">${n.read?'✓':'•'}</span><p><strong>${esc(n.title?.[typeof lang!=='undefined'?lang:'de']||'')}</strong><small>${esc(n.text?.[typeof lang!=='undefined'?lang:'de']||'')}</small></p></button>`).join(''):`<div class="provider-empty">${langText('Noch keine Benachrichtigungen.','No notifications yet.')}</div>`;
      const unread=rows.filter(n=>!n.read).length,badge=document.querySelector('.notification-badge');if(badge){badge.textContent=String(unread);badge.style.display=unread?'grid':'none'}
    }catch(err){console.error('[Audora notifications]',err)}
  }
  document.getElementById('notificationButton')?.addEventListener('click',refreshNotificationPanel);
  document.addEventListener('click',e=>{if(!e.target.closest('[data-notification-id]'))return;const panel=document.getElementById('notificationPanel');if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true')}});

  window.openDirectBooking=async function(id){
    const item=(typeof listings!=='undefined'?listings:[]).find(x=>x.id===id);if(!item)return;
    let availability={slots:[],bookings:[]};try{availability=await window.AudoraAPI.availability(id)}catch(_e){}
    const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());const min=now.toISOString().slice(0,16);
    const instant=!!item.instant;
    const title=instant?langText('Direkt buchen','Book directly'):langText('Buchung anfragen','Request booking');
    const explanation=instant?langText('Der Anbieter erlaubt Sofortbuchung. Audora bestätigt den Termin, wenn der Slot frei ist.','This provider allows instant booking. Audora confirms the time if the slot is free.'):langText('Der Anbieter bestätigt diesen Termin manuell. Nach dem Absenden steht die Buchung auf „Ausstehend“.','The provider confirms this time manually. After sending, the booking stays “Pending”.');
    const cta=instant?langText('Verfügbarkeit prüfen & buchen','Check availability & book'):langText('Verfügbarkeit prüfen & Anfrage senden','Check availability & send request');
    open(`<h2>${title}</h2><p>${esc(item.name)} — ${explanation}</p><form class="functional-form" id="directBookingForm" data-listing="${esc(id)}"><label><span>${langText('DATUM & UHRZEIT','DATE & TIME')}</span><input type="datetime-local" name="start" min="${min}" required></label><label><span>${langText('DAUER','DURATION')}</span><select name="duration"><option value="1">1 ${langText('Stunde','hour')}</option><option value="2">2 ${langText('Stunden','hours')}</option><option value="3" selected>3 ${langText('Stunden','hours')}</option><option value="4">4 ${langText('Stunden','hours')}</option><option value="6">6 ${langText('Stunden','hours')}</option></select></label><label><span>${langText('NOTIZ (OPTIONAL)','NOTE (OPTIONAL)')}</span><textarea name="notes" placeholder="${langText('Was soll vorbereitet werden?','Anything that should be prepared?')}"></textarea></label><div class="review-summary"><strong class="review-score">€${Number(item.price).toFixed(0)}</strong><div><strong>${item.category==='studio'?langText('pro Stunde','per hour'):langText('pro Buchung','per booking')}</strong><small>${availability.bookings?.length||0} ${langText('bestehende Termine im angezeigten Zeitraum','existing bookings in the shown period')}</small></div></div><div class="functional-message" id="directBookingMessage"></div><button class="primary-btn" type="submit">${cta}</button></form>`);
  };

  if(typeof bookListing!=='undefined')bookListing=function(id){closeModals?.();window.openDirectBooking(id)};

  document.addEventListener('submit',async e=>{
    if(e.target.id!=='directBookingForm')return;e.preventDefault();e.stopImmediatePropagation();
    const form=e.target,fd=new FormData(form),msg=document.getElementById('directBookingMessage'),button=form.querySelector('button[type=submit]'),start=new Date(fd.get('start'));
    if(Number.isNaN(start.getTime()))return;
    button.disabled=true;msg.textContent=langText('Slot wird geprüft…','Checking slot…');msg.className='functional-message';
    try{
      const result=await window.AudoraAPI.request('/bookings/',{method:'POST',body:JSON.stringify({listing_id:form.dataset.listing,start_at:start.toISOString(),duration_hours:Number(fd.get('duration')),notes:fd.get('notes')})});
      const pending=result.status==='pending';
      msg.textContent=pending?langText(`Anfrage gesendet · €${Math.round(result.total)}`,`Request sent · €${Math.round(result.total)}`):langText(`Bestätigt · €${Math.round(result.total)}`,`Confirmed · €${Math.round(result.total)}`);msg.classList.add('success');
      showToast?.(pending?langText('Buchungsanfrage gesendet.','Booking request sent.'):langText('Buchung bestätigt.','Booking confirmed.'));
      setTimeout(close,850);
    }catch(err){msg.textContent=err.code==='slot_just_booked'?langText('Dieser Slot ist bereits vergeben. Bitte wähle eine andere Zeit.','That slot is already booked. Choose another time.'):langText('Buchung konnte nicht abgeschlossen werden.','Booking could not be completed.');msg.classList.add('error')}
    finally{button.disabled=false}
  },true);
})();