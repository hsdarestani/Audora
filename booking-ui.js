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

  /* Messaging from a listing must not leave its modal intercepting the inbox. */
  if(typeof messageListing==='function'){
    const serverMessageListing=messageListing;
    messageListing=async function(id){
      if(typeof closeModals==='function')closeModals();
      else{
        const listingModal=document.getElementById('listingModal');
        if(listingModal){listingModal.classList.remove('open');listingModal.setAttribute('aria-hidden','true')}
      }
      return serverMessageListing(id);
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

  /* Notifications are dynamic: bookings and sessions can create them after the initial bootstrap. */
  async function refreshNotificationPanel(){
    const panel=document.getElementById('notificationPanel');
    const list=panel?.querySelector('.notification-list');
    if(!panel||!list||!window.AudoraAPI)return;
    try{
      const data=await window.AudoraAPI.notifications();
      const rows=Array.isArray(data?.results)?data.results:[];
      if(!rows.length){
        list.innerHTML=`<div class="provider-empty">${langText('Noch keine Benachrichtigungen.','No notifications yet.')}</div>`;
      }else{
        list.innerHTML=rows.map(n=>`<button data-notification-id="${n.id}"><span class="activity-icon ${n.read?'':'purple'}">${n.read?'✓':'•'}</span><p><strong>${esc(n.title?.[typeof lang!=='undefined'?lang:'de']||'')}</strong><small>${esc(n.text?.[typeof lang!=='undefined'?lang:'de']||'')}</small></p></button>`).join('');
      }
      const unread=rows.filter(n=>!n.read).length;
      const badge=document.querySelector('.notification-badge');
      if(badge){badge.textContent=String(unread);badge.style.display=unread?'grid':'none'}
    }catch(err){
      console.error('[Audora API]',err);
    }
  }
  document.getElementById('notificationButton')?.addEventListener('click',()=>{refreshNotificationPanel()});

  /* A read notification should not leave an overlay blocking the app. */
  document.addEventListener('click',e=>{
    if(!e.target.closest('[data-notification-id]'))return;
    const panel=document.getElementById('notificationPanel');
    if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true')}
  });

  /* Smart Match must recommend studios, but the artist chooses the final room. */
  const builderSelection={studioId:null,studioCandidates:[],team:[]};
  window.AudoraBuilderSelection=builderSelection;

  function currentBuilderCity(){return document.getElementById('buildCity')?.value||'Berlin'}
  function currentBuilderGenres(){return typeof selectedGenres!=='undefined'?[...selectedGenres]:[]}
  function candidateScore(item){
    const genres=currentBuilderGenres();
    const hits=genres.reduce((count,genre)=>count+((item.genres||[]).includes(genre)?1:0),0);
    return hits*100+(item.top?25:0)+Number(item.rating||0)*5-Number(item.price||0)/100;
  }
  function cityPool(category){
    const all=(typeof listings!=='undefined'?listings:[]).filter(item=>item.category===category);
    const city=currentBuilderCity().trim().toLowerCase();
    const local=all.filter(item=>String(item.city||'').toLowerCase().includes(city));
    return local.length?local:all;
  }
  function studioCandidates(){return cityPool('studio').sort((a,b)=>candidateScore(b)-candidateScore(a)).slice(0,3)}
  function teamCandidates(){
    const goal=typeof builderGoal!=='undefined'?(builderGoal||'record'):'record';
    const wanted=goal==='mix'?['engineer']:goal==='write'?['songwriter']:['producer','engineer'];
    return wanted.map(category=>cityPool(category).sort((a,b)=>candidateScore(b)-candidateScore(a))[0]).filter(Boolean);
  }
  function updateBuilderSelectionSummary(studio,team){
    const duration=3;
    const total=(studio?Number(studio.price||0)*duration:0)+team.reduce((sum,item)=>sum+Number(item.price||0),0);
    const totalEl=document.getElementById('summaryTotal');
    if(totalEl)totalEl.textContent=`€${Math.round(total)}`;
    const visual=document.querySelector('.summary-visual img');
    if(visual&&studio?.image){visual.src=studio.image;visual.alt=studio.name||'Selected studio'}
    const place=document.getElementById('summaryPlace');
    if(place)place.textContent=currentBuilderCity();
    const box=document.getElementById('matchTeam');
    if(box){box.dataset.selectedStudio=studio?.id||'';box.dataset.selectedStudioName=studio?.name||''}
  }
  function renderSelectableBuilderMatch(){
    const box=document.getElementById('matchTeam');if(!box)return;
    const studios=studioCandidates();
    const team=teamCandidates();
    builderSelection.studioCandidates=studios;
    builderSelection.team=team;
    if(!studios.some(item=>item.id===builderSelection.studioId))builderSelection.studioId=studios[0]?.id||null;
    const selected=studios.find(item=>item.id===builderSelection.studioId)||studios[0]||null;
    const studioRows=studios.map(item=>{
      const active=item.id===builderSelection.studioId;
      return `<button type="button" class="team-row match-choice ${active?'selected':''}" data-match-studio="${esc(item.id)}" aria-pressed="${active?'true':'false'}"><img src="${item.image}" alt="${esc(item.name)}"><span><small>${langText('Studio · auswählen','Studio · choose')}</small><strong>${esc(item.name)}</strong></span><span class="match-price"><b>${typeof priceLabel==='function'?priceLabel(item):`€${item.price}`}</b><i>${active?'✓':''}</i></span></button>`;
    }).join('');
    const teamRows=team.map(item=>`<div class="team-row match-team-member"><img src="${item.image}" alt="${esc(item.name)}"><span><small>${typeof listingType==='function'?listingType(item):item.category}</small><strong>${esc(item.name)}</strong></span><b>${typeof priceLabel==='function'?priceLabel(item):`€${item.price}`}</b></div>`).join('');
    box.innerHTML=`<div class="match-section-label"><strong>${langText('Studio auswählen','Choose your studio')}</strong><small>${langText('Audora empfiehlt – du entscheidest.','Audora recommends — you decide.')}</small></div>${studioRows}${teamRows?`<div class="match-section-label team-label"><strong>${langText('Empfohlenes Team','Suggested team')}</strong><small>${langText('Wird automatisch passend ergänzt.','Automatically matched to your session.')}</small></div>${teamRows}`:''}`;
    const genres=currentBuilderGenres();
    const headline=document.getElementById('matchHeadline');
    if(headline)headline.textContent=`${genres[0]||'Hip-Hop'} Session · ${currentBuilderCity()}`;
    if(typeof updateBuilderSummary==='function')updateBuilderSummary();
    updateBuilderSelectionSummary(selected,team);
  }
  if(typeof renderBuilderMatch==='function')renderBuilderMatch=renderSelectableBuilderMatch;

  document.addEventListener('click',e=>{
    const choice=e.target.closest('[data-match-studio]');
    if(!choice)return;
    e.preventDefault();
    builderSelection.studioId=choice.dataset.matchStudio;
    renderSelectableBuilderMatch();
    if(typeof showToast==='function'){
      const studio=builderSelection.studioCandidates.find(item=>item.id===builderSelection.studioId);
      showToast(langText(`${studio?.name||'Studio'} ausgewählt.`,`${studio?.name||'Studio'} selected.`));
    }
  });

  const selectionStyle=document.createElement('style');
  selectionStyle.textContent=`
    .match-section-label{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:4px 2px 1px;padding-top:2px}.match-section-label.team-label{margin-top:10px}.match-section-label strong,.match-section-label small{display:block}.match-section-label strong{font-size:9px}.match-section-label small{font-size:7px;color:#706979}.team-row.match-choice{width:100%;color:inherit;text-align:left;transition:.18s;position:relative}.team-row.match-choice:hover{background:rgba(150,92,255,.065);border-color:rgba(150,92,255,.28);transform:translateY(-1px)}.team-row.match-choice.selected{background:linear-gradient(90deg,rgba(150,92,255,.14),rgba(99,232,187,.035));border-color:rgba(99,232,187,.48);box-shadow:inset 0 0 0 1px rgba(99,232,187,.08)}.match-price{display:flex;align-items:center;gap:9px}.match-price b{white-space:nowrap}.match-price i{width:20px;height:20px;border-radius:50%;border:1px solid var(--line-strong);display:grid;place-items:center;font-style:normal;font-size:9px;color:var(--mint)}.match-choice.selected .match-price i{background:rgba(99,232,187,.12);border-color:rgba(99,232,187,.4)}@media(max-width:540px){.match-section-label{align-items:flex-start;flex-direction:column;gap:2px}.team-row.match-choice{grid-template-columns:42px 1fr auto}.match-price b{font-size:9px}}
  `;
  document.head.appendChild(selectionStyle);

  if(window.AudoraAPI?.createSession){
    const createSessionBase=window.AudoraAPI.createSession.bind(window.AudoraAPI);
    window.AudoraAPI.createSession=function(payload){
      if(builderSelection.studioId){
        return window.AudoraAPI.request('/sessions/selected/',{method:'POST',body:JSON.stringify({...payload,studio_id:builderSelection.studioId})});
      }
      return createSessionBase(payload);
    };
  }

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
