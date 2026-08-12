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

  const style=document.createElement('style');style.textContent=`
    .logic-note{display:grid;gap:4px;padding:11px 12px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.025);margin:0 0 11px;color:var(--muted)}.logic-note strong{font-size:12px;color:var(--text)}.logic-note small{font-size:10px;line-height:1.55}.logic-note.verified{border-color:rgba(99,232,187,.25);background:rgba(99,232,187,.045)}.logic-note.verified strong,.verified-review{color:var(--mint)}.verified-review{font-size:9px;margin-left:auto}.available-window-picker{display:grid;gap:7px;padding:11px;border:1px solid rgba(150,92,255,.18);background:rgba(150,92,255,.035);border-radius:12px}.available-window-picker>span{font-size:10px;font-weight:800;letter-spacing:.08em}.available-window-picker>small{font-size:10px;color:var(--muted)}.available-window-picker>div{display:flex;flex-wrap:wrap;gap:6px}.available-window-picker button{border:1px solid var(--line);background:rgba(255,255,255,.035);color:var(--text);border-radius:9px;padding:8px 9px;font-size:10px;cursor:pointer}.available-window-picker button:hover,.available-window-picker button.selected{border-color:rgba(99,232,187,.42);background:rgba(99,232,187,.08)}
  `;document.head.appendChild(style);
})();
