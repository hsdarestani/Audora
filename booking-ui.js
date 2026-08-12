/* Audora interaction fixes outside the Session Builder. Builder logic lives only in builder-team-selection.js. */
(() => {
  const langText=(de,en)=>typeof lang!=='undefined'&&lang==='de'?de:en;
  const esc=v=>typeof escapeHTML==='function'?escapeHTML(v):String(v??'').replace(/[&<>"']/g,'');
  const modal=()=>document.getElementById('functionalModal');
  const body=()=>document.getElementById('functionalBody');
  function open(html){const m=modal();if(!m)return;body().innerHTML=html;document.getElementById('functionalContent')?.classList.remove('wide');m.classList.add('open');m.setAttribute('aria-hidden','false')}
  function close(){const m=modal();if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}

  /* Runtime wording for lifecycle states introduced by the real backend. */
  if(window.I18N?.de?.sessions)window.I18N.de.sessions.pending='Ausstehend';
  if(window.I18N?.en?.sessions)window.I18N.en.sessions.pending='Pending';

  /* Builder confirmation is time-bound. Do not let a real booking flow enter Match without a date. */
  function localISODate(date=new Date()){
    const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,10);
  }
  function initBuilderDate(){const input=document.getElementById('buildDate');if(input){input.min=localISODate();input.required=true}}
  initBuilderDate();
  document.addEventListener('DOMContentLoaded',initBuilderDate);
  document.addEventListener('click',event=>{
    const next=event.target.closest('#builderNext');
    const directStep3=event.target.closest('[data-builder-step="3"]');
    const shouldValidate=(next&&typeof builderStep!=='undefined'&&builderStep===2)||directStep3;
    if(!shouldValidate)return;
    const input=document.getElementById('buildDate');
    const today=localISODate();
    if(input?.value&&input.value>=today)return;
    event.preventDefault();event.stopImmediatePropagation();
    input?.focus();input?.classList.add('logic-invalid');
    if(input)input.setAttribute('aria-invalid','true');
    showToast?.(input?.value?langText('Bitte wähle ein zukünftiges Datum.','Please choose a future date.'):langText('Bitte wähle zuerst ein Datum.','Please choose a date first.'));
  },true);
  document.getElementById('buildDate')?.addEventListener('change',event=>{event.target.classList.remove('logic-invalid');event.target.removeAttribute('aria-invalid')});

  /* Home must reflect the signed-in/demo user's real server data, never static showcase data. */
  function liveStatusLabel(status){
    const map={draft:['Entwurf','Draft'],pending:['Ausstehend','Pending'],confirmed:['Bestätigt','Confirmed'],completed:['Abgeschlossen','Completed'],cancelled:['Storniert','Cancelled']};
    return langText(...(map[status]||[status||'',status||'']));
  }
  async function syncLiveHome(){
    const home=document.querySelector('[data-view="home"]');if(!home||typeof sessions==='undefined')return;
    const serverSessions=sessions.filter(s=>s?.server);
    const upcoming=serverSessions.find(s=>s.state==='upcoming')||null;
    const spotlight=home.querySelector('.spotlight-card');
    const project=home.querySelector('.home-lower-grid .insight-card:first-child');
    const activity=home.querySelector('.activity-list');
    const navCount=document.querySelector('.side-link[data-route="sessions"] .nav-count');
    if(navCount)navCount.textContent=String(serverSessions.length);

    if(spotlight){
      const title=spotlight.querySelector('.spotlight-copy h2');
      const copy=spotlight.querySelector('.spotlight-copy p');
      const team=spotlight.querySelector('.spotlight-team');
      const primary=spotlight.querySelector('.spotlight-actions .primary-btn');
      const art=spotlight.querySelector('.spotlight-art img');
      const dateBadge=spotlight.querySelector('.spotlight-date');
      if(upcoming){
        title?.removeAttribute('data-i18n-html');
        if(title)title.innerHTML=`${esc(upcoming.title)}<br><span>${esc(upcoming.date?.[typeof lang!=='undefined'?lang:'de']||'')} · ${esc(upcoming.place||'')}</span>`;
        if(copy)copy.textContent=upcoming.status==='pending'?langText('Ein oder mehrere Anbieter müssen deine Anfrage noch bestätigen. Im Session Room siehst du den aktuellen Stand.','One or more providers still need to confirm your request. The Session Room shows the live status.'):langText('Deine aktuelle Session, Team-Infos, Aufgaben und Dateien liegen im gemeinsamen Session Room.','Your current session, team details, tasks and files live in the shared Session Room.');
        if(team){
          const members=(upcoming.team||[]).map(id=>(typeof listings!=='undefined'?listings:[]).find(x=>x.id===id)).filter(Boolean).slice(0,3);
          team.innerHTML=`${members.map(member=>`<span><img src="${esc(member.image||'')}" alt="${esc(member.name||'')}"></span>`).join('')}<small>${esc(upcoming.place||'')} ${members.length?`+ ${members.length}`:''}</small>`;
        }
        if(primary){primary.removeAttribute('data-route');primary.dataset.openSession=upcoming.id;const span=primary.querySelector('span');if(span)span.textContent=langText('Session Room öffnen','Open Session Room')}
        if(art&&upcoming.image)art.src=upcoming.image;
        if(dateBadge)dateBadge.style.display='none';
      }else{
        title?.removeAttribute('data-i18n-html');if(title)title.innerHTML=langText('Noch keine Session geplant.<br><span>Starte dein erstes Match.</span>','No session planned yet.<br><span>Start your first match.</span>');
        if(copy)copy.textContent=langText('Wähle Studio, Producer oder Engineer und baue eine Session, die wirklich zu deinem Termin und Budget passt.','Choose a studio, producer or engineer and build a session that actually fits your time and budget.');
        if(team)team.innerHTML=`<small>${langText('Noch kein Team ausgewählt','No team selected yet')}</small>`;
        if(primary){delete primary.dataset.openSession;primary.dataset.route='build';const span=primary.querySelector('span');if(span)span.textContent=langText('Session bauen','Build a session')}
        if(dateBadge)dateBadge.style.display='none';
      }
    }

    if(project){
      if(upcoming){
        project.innerHTML=`<div class="section-title compact"><div><small>${langText('DEINE NÄCHSTE SESSION','YOUR NEXT SESSION')}</small><h3>${esc(upcoming.title)}</h3></div><span class="session-status ${esc(upcoming.status||'')}">${esc(liveStatusLabel(upcoming.status))}</span></div><div class="live-home-project"><div><small>${langText('TERMIN','DATE')}</small><strong>${esc(upcoming.date?.[typeof lang!=='undefined'?lang:'de']||'—')}</strong></div><div><small>${langText('ORT','PLACE')}</small><strong>${esc(upcoming.place||'—')}</strong></div><div><small>${langText('GESAMT','TOTAL')}</small><strong>€${Math.round(Number(upcoming.total||0))}</strong></div></div><button class="ghost-btn full" data-open-session="${esc(upcoming.id)}">${langText('Session öffnen','Open session')}</button>`;
      }else{
        project.innerHTML=`<div class="section-title compact"><div><small>${langText('DEIN PROJEKT','YOUR PROJECT')}</small><h3>${langText('Noch kein aktives Projekt','No active project yet')}</h3></div></div><div class="provider-empty">${langText('Sobald du eine Session baust oder buchst, erscheint sie hier mit echtem Status und Termin.','As soon as you build or book a session, it appears here with its real status and date.')}</div><button class="ghost-btn full" data-route="build">${langText('Erste Session bauen','Build first session')}</button>`;
      }
    }

    if(activity&&window.AudoraAPI?.notifications){
      try{
        const data=await window.AudoraAPI.notifications();const rows=Array.isArray(data.results)?data.results.slice(0,3):[];
        activity.innerHTML=rows.length?rows.map(row=>`<div><span class="activity-icon ${row.read?'':'purple'}">${row.read?'✓':'•'}</span><p><strong>${esc(row.title?.[typeof lang!=='undefined'?lang:'de']||'')}</strong><small>${esc(row.text?.[typeof lang!=='undefined'?lang:'de']||'')}</small></p></div>`).join(''):`<div class="provider-empty">${langText('Noch keine Aktivität.','No activity yet.')}</div>`;
      }catch(err){console.error('[Audora home activity]',err)}
    }
  }
  if(typeof renderHome==='function'){
    const originalHome=renderHome;
    renderHome=function(){const result=originalHome();setTimeout(syncLiveHome,0);return result};
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(syncLiveHome,450));

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
    }catch(err){msg.textContent=err.code==='slot_just_booked'?langText('Dieser Slot ist bereits vergeben. Bitte wähle eine andere Zeit.','That slot is already booked. Choose another time.'):err.code==='cannot_book_own_listing'?langText('Du kannst dein eigenes Angebot nicht buchen.','You cannot book your own listing.'):langText('Buchung konnte nicht abgeschlossen werden.','Booking could not be completed.');msg.classList.add('error')}
    finally{button.disabled=false}
  },true);

  const homeStyle=document.createElement('style');homeStyle.textContent=`.logic-invalid{outline:2px solid rgba(255,118,140,.65)!important;outline-offset:2px}.live-home-project{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.live-home-project>div{padding:10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.02);min-width:0}.live-home-project small{display:block;font-size:9px;color:var(--muted);margin-bottom:4px}.live-home-project strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis}.session-status{font-size:9px;border:1px solid var(--line);border-radius:999px;padding:6px 8px;color:var(--muted)}.session-status.confirmed{color:var(--mint);border-color:rgba(99,232,187,.24)}.session-status.pending{color:#ffc77a;border-color:rgba(255,199,122,.25)}@media(max-width:520px){.live-home-project{grid-template-columns:1fr}.spotlight-team:has(>small:only-child){min-height:24px}}`;
  document.head.appendChild(homeStyle);
})();