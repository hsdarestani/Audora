/* Product-logic UI guards: make backend rules visible before users hit an error. */
(() => {
  const txt=(de,en)=>typeof lang!=='undefined'&&lang==='de'?de:en;
  const esc=v=>typeof escapeHTML==='function'?escapeHTML(v):String(v??'').replace(/[&<>"']/g,'');

  /* Reviews: never let a provider review their own listing; show booking verification honestly. */
  if(typeof openListing==='function'&&window.AudoraAPI){
    const previousOpenListing=openListing;
    openListing=async function(id){
      await previousOpenListing(id);
      try{
        const reviewData=await window.AudoraAPI.reviews(id);
        const form=document.querySelector(`[data-review-form="${CSS.escape(id)}"]`);
        if(!form)return;
        const note=document.createElement('div');note.className='logic-note';
        if(reviewData.can_review===false){
          note.innerHTML=`<strong>${txt('Eigene Angebote können nicht bewertet werden.','You cannot review your own listing.')}</strong><small>${txt('So bleiben Bewertungen unabhängig und glaubwürdig.','This keeps reviews independent and trustworthy.')}</small>`;
          form.replaceWith(note);
        }else{
          note.classList.toggle('verified',!!reviewData.verified_booking);
          note.innerHTML=reviewData.verified_booking
            ? `<strong>✓ ${txt('Verifizierte Buchung','Verified booking')}</strong><small>${txt('Deine Bewertung wird als verifizierte Erfahrung markiert.','Your review will be marked as a verified experience.')}</small>`
            : `<strong>${txt('Noch keine abgeschlossene Buchung','No completed booking yet')}</strong><small>${txt('Du kannst Feedback geben, es wird aber nicht als verifizierte Buchung markiert.','You can leave feedback, but it will not be marked as a verified booking.')}</small>`;
          form.insertBefore(note,form.firstChild);
        }
        document.querySelectorAll('.review-item').forEach((article,index)=>{
          const row=reviewData.results?.[index];if(!row?.verified_booking)return;
          const header=article.querySelector('header');if(header&&!header.querySelector('.verified-review'))header.insertAdjacentHTML('beforeend',`<small class="verified-review">✓ ${txt('Buchung','booking')}</small>`);
        });
      }catch(err){console.error('[Audora review trust]',err)}
    };
  }

  /* Provider availability semantics are whitelist-like once an OPEN window exists. Explain that in place. */
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-provider-availability]');if(!button||!window.AudoraAPI)return;
    const id=button.dataset.providerAvailability;
    setTimeout(async()=>{
      try{
        const data=await window.AudoraAPI.availability(id);
        const form=document.getElementById('availabilityForm');if(!form)return;
        form.querySelector('.availability-rule-note')?.remove();
        const hasOpen=(data.slots||[]).some(slot=>slot.available);
        const note=document.createElement('div');note.className='logic-note availability-rule-note';
        note.innerHTML=hasOpen
          ? `<strong>${txt('Open-window-Modus aktiv','Open-window mode is active')}</strong><small>${txt('Weil mindestens ein freies Zeitfenster definiert ist, sind nur als „Frei“ markierte Zeiträume buchbar. Blockierte Zeiträume bleiben immer gesperrt.','Because at least one open window exists, only time inside windows marked “Open” can be booked. Blocked windows always stay unavailable.')}</small>`
          : `<strong>${txt('Standard: grundsätzlich verfügbar','Default: generally available')}</strong><small>${txt('Solange kein „Frei“-Fenster angelegt ist, ist der Kalender grundsätzlich buchbar und nur „Blockiert“-Fenster sowie bestehende Buchungen sperren Zeiten.','Until you add an “Open” window, the calendar is generally bookable and only blocked windows or existing bookings make time unavailable.')}</small>`;
        form.prepend(note);
      }catch(err){console.error('[Audora availability rules]',err)}
    },180);
  });

  /* Direct booking: show real provider windows instead of making users guess a valid time. */
  if(typeof window.openDirectBooking==='function'&&window.AudoraAPI){
    const previousDirectBooking=window.openDirectBooking;
    window.openDirectBooking=async function(id){
      await previousDirectBooking(id);
      try{
        const data=await window.AudoraAPI.availability(id);
        const form=document.getElementById('directBookingForm');if(!form)return;
        const openSlots=(data.slots||[]).filter(slot=>slot.available);
        if(!openSlots.length)return;
        const wrap=document.createElement('div');wrap.className='available-window-picker';
        wrap.innerHTML=`<span>${txt('VERFÜGBARE ZEITFENSTER','AVAILABLE WINDOWS')}</span><small>${txt('Wähle ein freies Fenster oder gib darunter eine Zeit innerhalb eines Fensters ein.','Choose an open window or enter a time inside one below.')}</small><div>${openSlots.slice(0,10).map(slot=>{const s=new Date(slot.start),e=new Date(slot.end);const label=`${s.toLocaleDateString(typeof lang!=='undefined'&&lang==='de'?'de-DE':'en-GB',{day:'2-digit',month:'short'})} · ${s.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}–${e.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;return `<button type="button" data-open-window-start="${esc(slot.start)}" data-open-window-end="${esc(slot.end)}">${esc(label)}</button>`}).join('')}</div>`;
        form.insertBefore(wrap,form.firstChild);
      }catch(err){console.error('[Audora booking windows]',err)}
    };
  }

  document.addEventListener('click',event=>{
    const slot=event.target.closest('[data-open-window-start]');if(!slot)return;
    const form=document.getElementById('directBookingForm');if(!form)return;
    const start=new Date(slot.dataset.openWindowStart),end=new Date(slot.dataset.openWindowEnd);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return;
    const local=new Date(start.getTime()-start.getTimezoneOffset()*60000).toISOString().slice(0,16);
    const input=form.querySelector('input[name=start]');if(input)input.value=local;
    const hours=Math.max(1,Math.min(6,Math.floor((end-start)/3600000)));
    const duration=form.querySelector('select[name=duration]');if(duration){const best=[...duration.options].map(o=>Number(o.value)).filter(v=>v<=hours).pop();if(best)duration.value=String(best)}
    form.querySelectorAll('[data-open-window-start]').forEach(b=>b.classList.toggle('selected',b===slot));
  });

  /* Never claim a setup is within budget when the live selection is not. */
  function syncBudgetTruth(){
    const fit=document.querySelector('[data-i18n="build.fitText"]');
    const totalEl=document.getElementById('summaryTotal');
    const budgetEl=document.getElementById('budgetRange');
    if(!fit||!totalEl||!budgetEl)return;
    const total=Number(String(totalEl.textContent||'').replace(/[^0-9.,-]/g,'').replace(',','.'))||0;
    const budget=Number(budgetEl.value||0);
    const delta=Math.round(total-budget);
    if(delta<=0){
      fit.textContent=txt(`Verfügbarkeit geprüft · €${Math.abs(delta)} Budget übrig`,`Availability checked · €${Math.abs(delta)} budget remaining`);
      fit.classList.remove('over-budget');
    }else{
      fit.textContent=txt(`Verfügbarkeit geprüft · €${delta} über deinem Budget`,`Availability checked · €${delta} over your budget`);
      fit.classList.add('over-budget');
    }
  }
  const summaryTotal=document.getElementById('summaryTotal');
  if(summaryTotal)new MutationObserver(syncBudgetTruth).observe(summaryTotal,{childList:true,characterData:true,subtree:true});
  document.getElementById('budgetRange')?.addEventListener('input',syncBudgetTruth);
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-builder-studio],[data-builder-role-choice]'))setTimeout(syncBudgetTruth,0);
    if(event.target.closest('[data-lang]'))setTimeout(syncBudgetTruth,30);
  });

  /* Provider queue: pending requests need an actual accept/decline flow. */
  function providerStatusLabel(status){
    const labels={pending:["Anfrage","Request"],confirmed:["Bestätigt","Confirmed"],completed:["Abgeschlossen","Completed"],cancelled:["Storniert","Cancelled"]};
    return txt(...(labels[status]||[status,status]));
  }
  function bookingDate(value){
    const d=new Date(value);if(Number.isNaN(d.getTime()))return value||'';
    return new Intl.DateTimeFormat(typeof lang!=='undefined'&&lang==='de'?'de-DE':'en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d);
  }
  async function renderProviderBookingQueue(){
    const dash=document.getElementById('providerDashboard');
    if(!dash||!dash.classList.contains('open')||!window.AudoraAPI?.request)return;
    let section=document.getElementById('providerBookingQueue');
    if(!section){section=document.createElement('section');section.id='providerBookingQueue';section.className='provider-booking-queue';dash.appendChild(section)}
    section.innerHTML=`<div class="provider-empty">${txt('Buchungsanfragen werden geladen…','Loading booking requests…')}</div>`;
    try{
      const data=await window.AudoraAPI.request('/provider/bookings/');
      const rows=Array.isArray(data.results)?data.results:[];
      section.innerHTML=`<div class="provider-queue-head"><div><small>${txt('BUCHUNGEN & ANFRAGEN','BOOKINGS & REQUESTS')}</small><h3>${data.pending||0} ${txt('offene Anfragen','pending requests')}</h3></div></div><div class="provider-request-list">${rows.slice(0,20).map(row=>{
        const actions=row.status==='pending'
          ? `<button data-provider-booking-status="confirmed" data-provider-booking="${row.id}" class="primary-btn">${txt('Annehmen','Accept')}</button><button data-provider-booking-status="cancelled" data-provider-booking="${row.id}" class="secondary-btn">${txt('Ablehnen','Decline')}</button>`
          : row.status==='confirmed'
            ? `<button data-provider-booking-status="completed" data-provider-booking="${row.id}" class="secondary-btn">${txt('Als erledigt markieren','Mark completed')}</button><button data-provider-booking-status="cancelled" data-provider-booking="${row.id}" class="secondary-btn">${txt('Stornieren','Cancel')}</button>`
            : `<span class="request-status ${row.status}">${providerStatusLabel(row.status)}</span>`;
        return `<article class="provider-request-row"><img src="${esc(row.listing?.image||'')}" alt=""><span><small>${esc(providerStatusLabel(row.status))} · ${esc(bookingDate(row.start_at))}</small><strong>${esc(row.listing?.name||'')}</strong><p>${esc(row.customer?.name||'')} · €${Math.round(Number(row.total||0))}</p></span><div class="provider-request-actions">${actions}</div></article>`;
      }).join('')||`<div class="provider-empty">${txt('Noch keine Buchungen oder Anfragen.','No bookings or requests yet.')}</div>`}</div>`;
    }catch(err){section.innerHTML=`<div class="provider-empty">${txt('Anfragen konnten nicht geladen werden.','Could not load booking requests.')}</div>`;console.error('[Audora provider requests]',err)}
  }

  document.addEventListener('click',async event=>{
    const action=event.target.closest('[data-provider-booking-status]');
    if(action){
      event.preventDefault();
      const bookingId=action.dataset.providerBooking,status=action.dataset.providerBookingStatus;
      action.disabled=true;
      try{
        await window.AudoraAPI.request(`/bookings/${encodeURIComponent(bookingId)}/`,{method:'PATCH',body:JSON.stringify({status})});
        showToast?.(status==='confirmed'?txt('Anfrage angenommen.','Request accepted.'):status==='completed'?txt('Buchung abgeschlossen.','Booking completed.'):txt('Buchung storniert.','Booking cancelled.'));
        await renderProviderBookingQueue();
      }catch(err){console.error('[Audora provider booking action]',err);showToast?.(txt('Status konnte nicht geändert werden.','Could not change booking status.'))}
      finally{action.disabled=false}
      return;
    }
    if(event.target.closest('#providerSwitch,#profileProvider,[data-route="profile"]'))setTimeout(renderProviderBookingQueue,220);
  });
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{syncBudgetTruth();renderProviderBookingQueue()},500));

  const style=document.createElement('style');style.textContent=`
    .logic-note{display:grid;gap:4px;padding:11px 12px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.025);margin:0 0 11px;color:var(--muted)}.logic-note strong{font-size:12px;color:var(--text)}.logic-note small{font-size:10px;line-height:1.55}.logic-note.verified{border-color:rgba(99,232,187,.25);background:rgba(99,232,187,.045)}.logic-note.verified strong,.verified-review{color:var(--mint)}.verified-review{font-size:9px;margin-left:auto}.available-window-picker{display:grid;gap:7px;padding:11px;border:1px solid rgba(150,92,255,.18);background:rgba(150,92,255,.035);border-radius:12px}.available-window-picker>span{font-size:10px;font-weight:800;letter-spacing:.08em}.available-window-picker>small{font-size:10px;color:var(--muted)}.available-window-picker>div{display:flex;flex-wrap:wrap;gap:6px}.available-window-picker button{border:1px solid var(--line);background:rgba(255,255,255,.035);color:var(--text);border-radius:9px;padding:8px 9px;font-size:10px;cursor:pointer}.available-window-picker button:hover,.available-window-picker button.selected{border-color:rgba(99,232,187,.42);background:rgba(99,232,187,.08)}[data-i18n="build.fitText"].over-budget{color:#ffb36b}.provider-booking-queue{margin-top:18px;padding-top:18px;border-top:1px solid var(--line);display:grid;gap:12px}.provider-queue-head small{font-size:10px;color:var(--purple-2);font-weight:800;letter-spacing:.1em}.provider-queue-head h3{font-size:18px;margin-top:4px}.provider-request-list{display:grid;gap:8px}.provider-request-row{display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:11px;padding:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.018)}.provider-request-row>img{width:46px;height:46px;border-radius:10px;object-fit:cover;background:rgba(255,255,255,.04)}.provider-request-row span{min-width:0}.provider-request-row small{display:block;font-size:10px;color:var(--muted)}.provider-request-row strong{display:block;font-size:13px;margin-top:2px}.provider-request-row p{font-size:11px;color:var(--muted);margin-top:2px}.provider-request-actions{display:flex;gap:6px;align-items:center}.provider-request-actions button{padding:8px 10px;font-size:10px}.request-status{font-size:10px;border:1px solid var(--line);border-radius:999px;padding:6px 8px}.request-status.completed{color:var(--mint)}.request-status.cancelled{color:#ff9aac}@media(max-width:700px){.provider-request-row{grid-template-columns:42px minmax(0,1fr)}.provider-request-actions{grid-column:1/-1}.provider-request-actions button{flex:1}}
  `;document.head.appendChild(style);
})();