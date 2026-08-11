/* Direct booking flow layered onto the full-stack Audora frontend. */
(() => {
  function langText(de,en){return typeof lang!=='undefined'&&lang==='de'?de:en}
  function esc(v){return typeof escapeHTML==='function'?escapeHTML(v):String(v).replace(/[&<>"']/g,'')}
  function modal(){return document.getElementById('functionalModal')}
  function body(){return document.getElementById('functionalBody')}
  function open(html){const m=modal();if(!m)return;body().innerHTML=html;document.getElementById('functionalContent')?.classList.remove('wide');m.classList.add('open');m.setAttribute('aria-hidden','false')}
  function close(){const m=modal();if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}

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
