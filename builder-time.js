/* Audora Builder schedule — no hidden 20:00 default in backend requests. */
(() => {
  const txt=(de,en)=>typeof lang!=='undefined'&&lang==='de'?de:en;

  function ensureTimeField(){
    const date=document.getElementById('buildDate');
    if(!date||document.getElementById('buildTime'))return;
    const label=document.createElement('label');
    label.className='builder-time-field';
    label.innerHTML=`<small>${txt('UHRZEIT','TIME')}</small><input id="buildTime" type="time" value="20:00" step="1800" required>`;
    date.closest('label')?.insertAdjacentElement('afterend',label);
    label.querySelector('input')?.addEventListener('change',()=>{
      if(typeof builderStep!=='undefined'&&builderStep===3)window.renderAudoraBuilderChoices?.(true);
      updateScheduleSummary();
    });
    updateScheduleSummary();
  }

  function scheduleISO(){
    const date=document.getElementById('buildDate')?.value;
    const time=document.getElementById('buildTime')?.value;
    if(!date||!time)return null;
    const value=new Date(`${date}T${time}:00`);
    return Number.isNaN(value.getTime())?null:value.toISOString();
  }
  window.AudoraBuilderScheduleISO=scheduleISO;

  function updateScheduleSummary(){
    const iso=scheduleISO();
    const lines=document.querySelector('.summary-lines');
    if(!lines)return;
    let row=document.getElementById('summaryScheduleRow');
    if(!row){
      row=document.createElement('div');row.id='summaryScheduleRow';
      row.innerHTML='<span></span><strong id="summarySchedule">—</strong>';
      const place=document.getElementById('summaryPlace')?.closest('div');
      if(place)place.insertAdjacentElement('afterend',row);else lines.appendChild(row);
    }
    row.querySelector('span').textContent=txt('Termin','Schedule');
    const out=document.getElementById('summarySchedule');
    if(!out)return;
    if(!iso){out.textContent='—';return}
    const d=new Date(iso);
    out.textContent=new Intl.DateTimeFormat(typeof lang!=='undefined'&&lang==='de'?'de-DE':'en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d);
  }

  function rewriteBody(options){
    if(!options?.body||typeof options.body!=='string')return options;
    try{
      const payload=JSON.parse(options.body);
      const iso=scheduleISO();
      if(iso)payload.start_at=iso;
      return {...options,body:JSON.stringify(payload)};
    }catch(_e){return options}
  }

  function installAPIOverrides(){
    const api=window.AudoraAPI;if(!api||api.__scheduleAware)return false;
    const baseRequest=api.request.bind(api);
    api.request=function(path,options={}){
      if(path==='/builder/candidates/')options=rewriteBody(options);
      return baseRequest(path,options);
    };
    if(typeof api.createSession==='function'){
      const baseCreate=api.createSession.bind(api);
      api.createSession=function(payload){
        const iso=scheduleISO();
        return baseCreate({...payload,...(iso?{start_at:iso}:{})});
      };
    }
    api.__scheduleAware=true;
    return true;
  }

  /* Capture guard: confirmed sessions always need both a date and an explicit time. */
  document.addEventListener('click',event=>{
    const next=event.target.closest('#builderNext');
    const direct=event.target.closest('[data-builder-step="3"]');
    const validate=(next&&typeof builderStep!=='undefined'&&builderStep===2)||direct;
    if(!validate)return;
    ensureTimeField();
    const date=document.getElementById('buildDate'),time=document.getElementById('buildTime');
    if(date?.value&&time?.value)return;
    event.preventDefault();event.stopImmediatePropagation();
    const input=!date?.value?date:time;input?.focus();input?.classList.add('logic-invalid');input?.setAttribute('aria-invalid','true');
    showToast?.(txt('Bitte wähle Datum und Uhrzeit.','Please choose a date and time.'));
  },true);

  document.addEventListener('change',event=>{
    if(!['buildDate','buildTime'].includes(event.target.id))return;
    event.target.classList.remove('logic-invalid');event.target.removeAttribute('aria-invalid');
    updateScheduleSummary();
    if(typeof builderStep!=='undefined'&&builderStep===3)window.renderAudoraBuilderChoices?.(true);
  });

  const style=document.createElement('style');
  style.textContent=`.builder-time-field{min-width:0}.builder-time-field small{display:block}.builder-time-field input{width:100%}@media(min-width:700px){.builder-fields{grid-template-columns:repeat(3,minmax(0,1fr))!important}}`;
  document.head.appendChild(style);

  ensureTimeField();
  let tries=0;const timer=setInterval(()=>{tries++;ensureTimeField();const installed=installAPIOverrides();if((installed&&document.getElementById('buildTime'))||tries>30)clearInterval(timer)},150);
  document.addEventListener('DOMContentLoaded',()=>{ensureTimeField();installAPIOverrides();setTimeout(updateScheduleSummary,50)});
})();
