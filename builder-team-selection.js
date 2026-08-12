/* Audora Session Builder — goal-aware, availability-driven and user-controlled. */
(() => {
  const text=(de,en)=>typeof lang!=='undefined'&&lang==='de'?de:en;
  const esc=v=>typeof escapeHTML==='function'?escapeHTML(v):String(v??'').replace(/[&<>"']/g,'');
  const state=window.AudoraBuilderSelection||(window.AudoraBuilderSelection={});
  Object.assign(state,{studioId:null,studioCandidates:[],team:[],selectedTeamByRole:{},candidateRoles:{},rules:null,loading:false,lastKey:'',requestSeq:0,lastGoal:null});

  if(window.I18N?.de?.build)window.I18N.de.build.finish='Session bestätigen';
  if(window.I18N?.en?.build)window.I18N.en.build.finish='Confirm session';
  if(window.I18N?.de?.toast)window.I18N.de.toast.booked='Session bestätigt und gespeichert.';
  if(window.I18N?.en?.toast)window.I18N.en.toast.booked='Session confirmed and saved.';
  if(typeof goalKey!=='undefined')goalKey.studio='goals.studio';

  const roleConfig={
    producer:{de:'Producer',en:'Producer'},engineer:{de:'Toningenieur',en:'Engineer'},songwriter:{de:'Songwriter',en:'Songwriter'}
  };
  const localRules={
    record:{studio_required:true,studio_optional:false,roles:['producer','engineer'],required_roles:[]},
    studio:{studio_required:true,studio_optional:false,roles:[],required_roles:[]},
    produce:{studio_required:false,studio_optional:true,roles:['producer','engineer'],required_roles:['producer']},
    mix:{studio_required:false,studio_optional:true,roles:['engineer'],required_roles:['engineer']},
    write:{studio_required:false,studio_optional:true,roles:['songwriter'],required_roles:['songwriter']}
  };

  function goal(){return typeof builderGoal!=='undefined'?(builderGoal||'record'):'record'}
  function rules(){return state.rules||localRules[goal()]||localRules.record}
  function city(){return document.getElementById('buildCity')?.value||'Berlin'}
  function genres(){return typeof selectedGenres!=='undefined'?[...selectedGenres]:[]}
  function duration(){return 3}
  function dateISO(){
    const value=document.getElementById('buildDate')?.value;
    if(!value)return null;
    const d=new Date(`${value}T20:00:00`);
    return Number.isNaN(d.getTime())?null:d.toISOString();
  }
  function roleName(role){const cfg=roleConfig[role]||{de:role,en:role};return cfg[typeof lang!=='undefined'?lang:'de']}
  function money(item){return item.category==='studio'?`€${Math.round(Number(item.price||0))} ${text('/ Std.','/ hr')}`:`€${Math.round(Number(item.price||0))}`}

  function ensureGoalOptions(){
    const cards=document.getElementById('goalCards');
    if(cards&&!cards.querySelector('[data-goal="studio"]')){
      const button=document.createElement('button');
      button.dataset.goal='studio';
      button.innerHTML=`<span>🏠</span><strong data-i18n="goals.studio">${text('Studio finden','Find a studio')}</strong><small data-i18n="goals.studioSub">${text('Nur Raum & Termin','Room and time only')}</small>`;
      const mix=cards.querySelector('[data-goal="mix"]');
      cards.insertBefore(button,mix||null);
    }
    const select=document.getElementById('buildCity');
    if(select&&![...select.options].some(o=>o.value==='Remote')){
      const option=document.createElement('option');option.value='Remote';option.textContent='Remote';select.appendChild(option);
    }
  }

  function goalCopy(){
    const map={
      record:{title:['Wie soll die Aufnahme klingen?','How should the recording sound?'],lead:['Wähle Sound, Ort und Datum. Danach zeigen wir nur gleichzeitig verfügbare Optionen.','Choose sound, place and date. Then we only show options available at the same time.'],match:['Stelle dein Recording-Team zusammen.','Build your recording team.']},
      studio:{title:['Wann und wo brauchst du ein Studio?','When and where do you need a studio?'],lead:['Genre, Ort, Termin und Budget helfen uns, passende Räume zu priorisieren.','Genre, place, date and budget help us prioritize the right rooms.'],match:['Wähle dein Studio.','Choose your studio.']},
      produce:{title:['Wie soll dein Track entstehen?','How should your track come together?'],lead:['Finde einen passenden Producer. Ein Studio und Engineer kannst du optional ergänzen.','Find the right producer. You can optionally add a studio and engineer.'],match:['Stelle dein Production-Setup zusammen.','Build your production setup.']},
      mix:{title:['Wie soll dein Mix klingen?','How should your mix sound?'],lead:['Mixing kann remote stattfinden. Ein Studio ist optional — der Engineer ist der Kern des Matches.','Mixing can be remote. A studio is optional — the engineer is the core match.'],match:['Wähle deinen Mix-Engineer.','Choose your mix engineer.']},
      write:{title:['Welche Richtung soll der Song haben?','What direction should the song take?'],lead:['Finde einen Songwriter für Co-Writing oder Topline. Ein Raum kann optional ergänzt werden.','Find a songwriter for co-writing or topline. A room can be added optionally.'],match:['Wähle deinen Songwriting-Partner.','Choose your songwriting partner.']}
    };
    return map[goal()]||map.record;
  }

  function applyGoalUI(){
    ensureGoalOptions();
    const copy=goalCopy();
    const page2=document.querySelector('[data-builder-page="2"]');
    const page3=document.querySelector('[data-builder-page="3"]');
    if(page2){const h=page2.querySelector('h2'),p=h?.nextElementSibling;if(h)h.textContent=text(...copy.title);if(p?.tagName==='P')p.textContent=text(...copy.lead)}
    if(page3){const h=page3.querySelector('h2');if(h)h.textContent=text(...copy.match)}
    const select=document.getElementById('buildCity');
    if(select&&['record','studio'].includes(goal())&&select.value==='Remote')select.value='Berlin';
    const remote=select?.querySelector('option[value="Remote"]');if(remote)remote.disabled=['record','studio'].includes(goal());
    if(typeof syncGoalCards==='function')syncGoalCards();
  }

  function candidateKey(){return JSON.stringify({goal:goal(),city:city(),genres:genres().slice().sort(),date:dateISO(),duration:duration()})}
  function fallbackCandidates(){
    const all=typeof listings!=='undefined'?listings:[];
    const requested=city().toLowerCase();
    const sortRows=category=>all.filter(x=>x.category===category).sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)).map(x=>({...x,out_of_city:requested!=='remote'&&!String(x.city||'').toLowerCase().includes(requested)}));
    const r=localRules[goal()]||localRules.record;
    return {rules:r,studios:sortRows('studio').slice(0,3),roles:Object.fromEntries(r.roles.map(role=>[role,sortRows(role).slice(0,3)]))};
  }

  async function loadCandidates(force=false){
    const key=candidateKey();
    if(!force&&state.lastKey===key&&(state.studioCandidates.length||Object.keys(state.candidateRoles).length))return;
    const seq=++state.requestSeq;state.loading=true;state.lastKey=key;
    renderLoading();
    try{
      const payload={goal:goal(),city:city(),genres:genres(),duration_hours:duration(),start_at:dateISO()};
      const data=window.AudoraAPI?.request?await window.AudoraAPI.request('/builder/candidates/',{method:'POST',body:JSON.stringify(payload)}):fallbackCandidates();
      if(seq!==state.requestSeq)return;
      state.rules=data.rules||localRules[goal()]||localRules.record;
      state.studioCandidates=Array.isArray(data.studios)?data.studios:[];
      state.candidateRoles=data.roles||{};
      syncDefaults(true);
    }catch(err){
      console.error('[Audora builder candidates]',err);
      if(seq!==state.requestSeq)return;
      const data=fallbackCandidates();state.rules=data.rules;state.studioCandidates=data.studios;state.candidateRoles=data.roles;syncDefaults(true);
      if(typeof showToast==='function')showToast(text('Live-Verfügbarkeit konnte nicht geladen werden. Lokale Vorschläge werden angezeigt.','Live availability could not be loaded. Showing local suggestions.'));
    }finally{
      if(seq===state.requestSeq){state.loading=false;renderChoices()}
    }
  }

  function roleCandidates(role){return Array.isArray(state.candidateRoles?.[role])?state.candidateRoles[role]:[]}
  function syncDefaults(resetInvalid=false){
    const r=rules();
    const studioValid=state.studioCandidates.some(x=>x.id===state.studioId);
    if(r.studio_required){if(!studioValid)state.studioId=state.studioCandidates[0]?.id||null}
    else if(resetInvalid&&!studioValid)state.studioId=null;
    for(const role of r.roles){
      const options=roleCandidates(role);const current=state.selectedTeamByRole[role];const required=r.required_roles.includes(role);
      if(current===undefined||(!options.some(x=>x.id===current)&&current!==null))state.selectedTeamByRole[role]=options[0]?.id||null;
      if(required&&state.selectedTeamByRole[role]===null)state.selectedTeamByRole[role]=options[0]?.id||null;
    }
    for(const key of Object.keys(state.selectedTeamByRole))if(!r.roles.includes(key))delete state.selectedTeamByRole[key];
    state.team=selectedTeam();
  }
  function selectedStudio(){return state.studioCandidates.find(x=>x.id===state.studioId)||null}
  function selectedTeam(){return rules().roles.map(role=>{const id=state.selectedTeamByRole[role];return id?roleCandidates(role).find(x=>x.id===id):null}).filter(Boolean)}
  function requiredSelectionsReady(){
    const r=rules();if(r.studio_required&&!selectedStudio())return false;
    for(const role of r.required_roles)if(!state.selectedTeamByRole[role])return false;
    return !!(selectedStudio()||selectedTeam().length);
  }
  function syncConfirmButton(){const next=document.getElementById('builderNext');if(next&&typeof builderStep!=='undefined'&&builderStep===3)next.disabled=state.loading||!requiredSelectionsReady()}

  function locationHint(item){
    if(!item)return '';
    if(item.out_of_city){
      return item.category==='studio'?text(`${item.city} · außerhalb deiner Suche`,`${item.city} · outside your search`):text(`${item.city} · Remote/außerhalb`,`${item.city} · remote/out of city`);
    }
    return item.city||'';
  }
  function choiceRow(item,kind,active){
    const attr=kind==='studio'?`data-builder-studio="${esc(item.id)}"`:`data-builder-role-choice="${esc(kind)}" data-builder-member="${esc(item.id)}"`;
    const subtitle=kind==='studio'?text('Studio auswählen','Choose studio'):text(`${roleName(kind)} auswählen`,`Choose ${roleName(kind)}`);
    return `<button type="button" class="team-row builder-select-row ${active?'selected':''}" ${attr} aria-pressed="${active?'true':'false'}"><img src="${esc(item.image||'')}" alt="${esc(item.name)}"><span><small>${subtitle}${locationHint(item)?` · ${esc(locationHint(item))}`:''}</small><strong>${esc(item.name)}</strong></span><span class="builder-choice-price"><b>${money(item)}</b><i>${active?'✓':''}</i></span></button>`;
  }
  function skipRow(kind,active,label){
    const attr=kind==='studio'?'data-builder-studio=""':`data-builder-role-choice="${esc(kind)}" data-builder-member=""`;
    return `<button type="button" class="team-row builder-select-row builder-skip ${active?'selected':''}" ${attr} aria-pressed="${active?'true':'false'}"><span class="builder-skip-icon">−</span><span><small>${kind==='studio'?'Studio':roleName(kind)}</small><strong>${label}</strong></span><span class="builder-choice-price"><b>€0</b><i>${active?'✓':''}</i></span></button>`;
  }
  function section(title,sub,rows,required=false){return `<div class="builder-choice-section"><div class="match-section-label"><div><strong>${title}</strong><small>${sub}</small></div><span class="builder-role-badge ${required?'required':''}">${required?text('ERFORDERLICH','REQUIRED'):text('OPTIONAL','OPTIONAL')}</span></div><div class="builder-choice-list">${rows||`<div class="builder-no-match">${text('Keine verfügbare Option für diesen Termin.','No available option for this time.')}</div>`}</div></div>`}
  function renderLoading(){const box=document.getElementById('matchTeam');if(box)box.innerHTML=`<div class="builder-loading"><span></span><strong>${text('Verfügbarkeit wird live geprüft…','Checking live availability…')}</strong><small>${text('Studio und Team werden für denselben Termin abgeglichen.','Studio and team are checked for the same time.')}</small></div>`;syncConfirmButton()}

  function updateSummary(){
    const studio=selectedStudio(),team=selectedTeam();
    const total=(studio?Number(studio.price||0)*duration():0)+team.reduce((sum,x)=>sum+Number(x.price||0),0);
    const totalEl=document.getElementById('summaryTotal');if(totalEl)totalEl.textContent=`€${Math.round(total)}`;
    const visual=document.querySelector('.summary-visual img');const hero=studio||team[0];if(visual&&hero?.image){visual.src=hero.image;visual.alt=hero.name||'Selected match'}
    const place=document.getElementById('summaryPlace');
    if(place)place.textContent=studio?.city||(city()==='Remote'?text('Remote','Remote'):city());
    const box=document.getElementById('matchTeam');if(box){box.dataset.selectedStudio=studio?.id||'';box.dataset.selectedTeam=team.map(x=>x.id).join(',')}
    state.team=team;syncConfirmButton();
  }

  function renderChoices(){
    const box=document.getElementById('matchTeam');if(!box)return;syncDefaults();const r=rules();let html='';
    if(r.studio_required||r.studio_optional){
      let rows=state.studioCandidates.map(item=>choiceRow(item,'studio',item.id===state.studioId)).join('');
      if(r.studio_optional)rows=skipRow('studio',state.studioId===null,text('Ohne Studio / remote','No studio / remote'))+rows;
      html+=section(r.studio_required?text('Studio auswählen','Choose your studio'):text('Studio hinzufügen','Add a studio'),r.studio_required?text('Nur Studios, die zum gewählten Termin verfügbar sind.','Only studios available at your chosen time.'):text('Optional, falls du einen Raum brauchst.','Optional if you need a room.'),rows,r.studio_required);
    }
    for(const role of r.roles){
      const required=r.required_roles.includes(role);const options=roleCandidates(role);const selected=state.selectedTeamByRole[role]??null;
      let rows=options.map(item=>choiceRow(item,role,item.id===selected)).join('');
      if(!required)rows+=skipRow(role,selected===null,text('Ohne diese Rolle fortfahren','Continue without this role'));
      html+=section(`${roleName(role)} ${text('auswählen','choose')}`,required?text('Diese Rolle wird für dieses Ziel benötigt.','This role is required for this goal.'):text('Empfehlung ändern oder Rolle überspringen.','Change the recommendation or skip this role.'),rows,required);
    }
    if(!html)html=`<div class="builder-no-match">${text('Für dieses Ziel ist keine zusätzliche Auswahl nötig.','No extra selection is needed for this goal.')}</div>`;
    box.innerHTML=html;
    const headline=document.getElementById('matchHeadline');if(headline)headline.textContent=`${genres()[0]||text('Deine','Your')} ${text('Session','session')} · ${city()}`;
    updateSummary();
  }

  async function renderFullMatch(force=false){applyGoalUI();await loadCandidates(force);if(!state.loading)renderChoices()}
  if(typeof renderBuilderMatch==='function')renderBuilderMatch=()=>renderFullMatch(false);
  window.renderAudoraBuilderChoices=renderFullMatch;

  document.addEventListener('click',event=>{
    const studioButton=event.target.closest('[data-builder-studio]');
    if(studioButton){event.preventDefault();state.studioId=studioButton.dataset.builderStudio||null;renderChoices();if(typeof showToast==='function')showToast(text('Studio-Auswahl aktualisiert.','Studio selection updated.'));return}
    const roleButton=event.target.closest('[data-builder-role-choice]');
    if(roleButton){event.preventDefault();const role=roleButton.dataset.builderRoleChoice;state.selectedTeamByRole[role]=roleButton.dataset.builderMember||null;renderChoices();if(typeof showToast==='function')showToast(text(`${roleName(role)} aktualisiert.`,`${roleName(role)} updated.`));return}
    const goalButton=event.target.closest('#goalCards [data-goal]');
    if(goalButton)setTimeout(()=>{state.rules=null;state.studioId=null;state.selectedTeamByRole={};state.lastKey='';state.lastGoal=goal();applyGoalUI()},0);
  });

  ['buildCity','buildDate'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{state.lastKey='';if(typeof builderStep!=='undefined'&&builderStep===3)renderFullMatch(true)}));
  document.getElementById('genreChips')?.addEventListener('click',()=>{state.lastKey='';if(typeof builderStep!=='undefined'&&builderStep===3)setTimeout(()=>renderFullMatch(true),0)});

  if(typeof applyLanguage==='function'){
    const originalApplyLanguage=applyLanguage;applyLanguage=function(){originalApplyLanguage();applyGoalUI();if(typeof builderStep!=='undefined'&&builderStep===3)setTimeout(()=>renderFullMatch(false),0)};
  }

  if(window.AudoraAPI){
    window.AudoraAPI.createSession=payload=>window.AudoraAPI.request('/sessions/selected/',{method:'POST',body:JSON.stringify({...payload,studio_id:state.studioId||'',team_ids:selectedTeam().map(x=>x.id)})});
  }

  const style=document.createElement('style');
  style.textContent=`
    .builder-choice-section{display:grid;gap:7px;margin-top:13px}.builder-choice-section+.builder-choice-section{margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}.builder-choice-list{display:grid;gap:7px}.match-section-label{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 2px 2px}.match-section-label>div strong,.match-section-label>div small{display:block}.match-section-label strong{font-size:12px}.match-section-label small{font-size:10px;color:#8d8695;margin-top:3px}.builder-role-badge{font-size:9px;font-weight:800;letter-spacing:.09em;color:#8e7aa9;border:1px solid var(--line);border-radius:999px;padding:5px 7px}.builder-role-badge.required{color:var(--mint);border-color:rgba(99,232,187,.28);background:rgba(99,232,187,.06)}.team-row.builder-select-row{width:100%;color:inherit;text-align:left;transition:.18s;position:relative;cursor:pointer}.team-row.builder-select-row:hover{background:rgba(150,92,255,.065);border-color:rgba(150,92,255,.28);transform:translateY(-1px)}.team-row.builder-select-row.selected{background:linear-gradient(90deg,rgba(150,92,255,.14),rgba(99,232,187,.035));border-color:rgba(99,232,187,.48);box-shadow:inset 0 0 0 1px rgba(99,232,187,.08)}.builder-choice-price{display:flex;align-items:center;gap:9px}.builder-choice-price b{white-space:nowrap}.builder-choice-price i{width:21px;height:21px;border-radius:50%;border:1px solid var(--line-strong);display:grid;place-items:center;font-style:normal;font-size:10px;color:var(--mint)}.builder-select-row.selected .builder-choice-price i{background:rgba(99,232,187,.12);border-color:rgba(99,232,187,.4)}.builder-skip-icon{width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,.04);display:grid;place-items:center;font-size:20px;color:#77717f}.builder-skip{grid-template-columns:42px 1fr auto!important}.builder-loading,.builder-no-match{border:1px solid var(--line);border-radius:14px;padding:18px;color:var(--muted);display:grid;gap:5px}.builder-loading span{width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.12);border-top-color:var(--purple);animation:spin .8s linear infinite}.builder-loading strong{color:var(--text)}.builder-loading small{font-size:11px}.builder-no-match{font-size:12px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:540px){.match-section-label{align-items:flex-start;flex-direction:column;gap:6px}.match-section-label small{font-size:10px}.builder-choice-price b{font-size:11px}.team-row.builder-select-row{grid-template-columns:42px 1fr auto}}
  `;
  document.head.appendChild(style);

  ensureGoalOptions();applyGoalUI();
})();
