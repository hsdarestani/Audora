/* Audora Session Builder: user-controlled studio + creative team selection. */
(() => {
  const text=(de,en)=>typeof lang!=='undefined'&&lang==='de'?de:en;
  const esc=v=>typeof escapeHTML==='function'?escapeHTML(v):String(v??'').replace(/[&<>"']/g,'');

  // This is a live backend flow now, not a fake/demo-only booking action.
  if(window.I18N?.de?.build)window.I18N.de.build.finish='Session bestätigen';
  if(window.I18N?.en?.build)window.I18N.en.build.finish='Confirm session';
  if(window.I18N?.de?.toast)window.I18N.de.toast.booked='Session bestätigt und gespeichert.';
  if(window.I18N?.en?.toast)window.I18N.en.toast.booked='Session confirmed and saved.';

  const state=window.AudoraBuilderSelection||(window.AudoraBuilderSelection={studioId:null,studioCandidates:[],team:[]});
  state.selectedTeamByRole=state.selectedTeamByRole||{};

  const roleConfig={
    producer:{de:'Producer',en:'Producer'},
    engineer:{de:'Toningenieur',en:'Engineer'},
    songwriter:{de:'Songwriter',en:'Songwriter'},
  };

  function goalRoles(){
    const goal=typeof builderGoal!=='undefined'?(builderGoal||'record'):'record';
    if(goal==='mix')return ['engineer'];
    if(goal==='write')return ['songwriter'];
    return ['producer','engineer'];
  }
  function city(){return document.getElementById('buildCity')?.value||'Berlin'}
  function genres(){return typeof selectedGenres!=='undefined'?[...selectedGenres]:[]}
  function score(item){
    const hits=genres().reduce((n,g)=>n+((item.genres||[]).includes(g)?1:0),0);
    return hits*100+(item.top?25:0)+Number(item.rating||0)*5-Number(item.price||0)/100;
  }
  function pool(category){
    const all=(typeof listings!=='undefined'?listings:[]).filter(x=>x.category===category);
    const needle=city().trim().toLowerCase();
    const local=all.filter(x=>String(x.city||'').toLowerCase().includes(needle));
    return (local.length?local:all).slice().sort((a,b)=>score(b)-score(a));
  }
  function studios(){return pool('studio').slice(0,3)}
  function roleCandidates(role){return pool(role).slice(0,3)}

  function syncDefaults(){
    const studioOptions=studios();
    if(!studioOptions.some(x=>x.id===state.studioId))state.studioId=studioOptions[0]?.id||null;
    for(const role of goalRoles()){
      const options=roleCandidates(role);
      const current=state.selectedTeamByRole[role];
      if(current===null)continue;
      if(!options.some(x=>x.id===current))state.selectedTeamByRole[role]=options[0]?.id||null;
    }
    for(const key of Object.keys(state.selectedTeamByRole)){
      if(!goalRoles().includes(key))delete state.selectedTeamByRole[key];
    }
    state.studioCandidates=studioOptions;
    state.team=selectedTeam();
  }
  function selectedStudio(){return studios().find(x=>x.id===state.studioId)||studios()[0]||null}
  function selectedTeam(){
    return goalRoles().map(role=>{
      const id=state.selectedTeamByRole[role];
      return id?roleCandidates(role).find(x=>x.id===id):null;
    }).filter(Boolean);
  }
  function money(item){return typeof priceLabel==='function'?priceLabel(item):`€${Math.round(Number(item.price||0))}`}
  function roleName(role){const cfg=roleConfig[role]||{de:role,en:role};return cfg[typeof lang!=='undefined'?lang:'de']}

  function choiceRow(item,kind,active){
    const attr=kind==='studio'?`data-builder-studio="${esc(item.id)}"`:`data-builder-role-choice="${esc(kind)}" data-builder-member="${esc(item.id)}"`;
    const subtitle=kind==='studio'?text('Studio · auswählen','Studio · choose'):`${roleName(kind)} · ${text('auswählen','choose')}`;
    return `<button type="button" class="team-row builder-select-row ${active?'selected':''}" ${attr} aria-pressed="${active?'true':'false'}"><img src="${item.image}" alt="${esc(item.name)}"><span><small>${subtitle}</small><strong>${esc(item.name)}</strong></span><span class="builder-choice-price"><b>${money(item)}</b><i>${active?'✓':''}</i></span></button>`;
  }
  function skipRow(role,active){
    return `<button type="button" class="team-row builder-select-row builder-skip ${active?'selected':''}" data-builder-role-choice="${esc(role)}" data-builder-member="" aria-pressed="${active?'true':'false'}"><span class="builder-skip-icon">−</span><span><small>${roleName(role)}</small><strong>${text('Ohne diese Rolle fortfahren','Continue without this role')}</strong></span><span class="builder-choice-price"><b>€0</b><i>${active?'✓':''}</i></span></button>`;
  }
  function section(title,sub,rows,extra=''){
    return `<div class="builder-choice-section"><div class="match-section-label"><div><strong>${title}</strong><small>${sub}</small></div>${extra}</div><div class="builder-choice-list">${rows}</div></div>`;
  }

  function updateSummary(){
    syncDefaults();
    const studio=selectedStudio();
    const team=selectedTeam();
    const total=(studio?Number(studio.price||0)*3:0)+team.reduce((sum,x)=>sum+Number(x.price||0),0);
    const totalEl=document.getElementById('summaryTotal');if(totalEl)totalEl.textContent=`€${Math.round(total)}`;
    const visual=document.querySelector('.summary-visual img');if(visual&&studio?.image){visual.src=studio.image;visual.alt=studio.name||'Selected studio'}
    const place=document.getElementById('summaryPlace');if(place)place.textContent=city();
    const box=document.getElementById('matchTeam');if(box){box.dataset.selectedStudio=studio?.id||'';box.dataset.selectedTeam=team.map(x=>x.id).join(',')}
    state.team=team;
  }

  function renderFullMatch(){
    const box=document.getElementById('matchTeam');if(!box)return;
    syncDefaults();
    const studioOptions=studios();
    const studioRows=studioOptions.map(item=>choiceRow(item,'studio',item.id===state.studioId)).join('');
    let html=section(
      text('Studio auswählen','Choose your studio'),
      text('Audora empfiehlt – du entscheidest.','Audora recommends — you decide.'),
      studioRows
    );
    for(const role of goalRoles()){
      const options=roleCandidates(role);
      const selected=state.selectedTeamByRole[role]??null;
      const rows=options.map(item=>choiceRow(item,role,item.id===selected)).join('')+skipRow(role,selected===null);
      html+=section(
        `${roleName(role)} ${text('auswählen','choose')}`,
        text('Empfehlung ändern oder Rolle überspringen.','Change the recommendation or skip this role.'),
        rows,
        `<span class="builder-role-badge">${text('OPTIONAL','OPTIONAL')}</span>`
      );
    }
    box.innerHTML=html;
    const headline=document.getElementById('matchHeadline');
    if(headline)headline.textContent=`${genres()[0]||'Hip-Hop'} Session · ${city()}`;
    if(typeof updateBuilderSummary==='function')updateBuilderSummary();
    updateSummary();
  }

  if(typeof renderBuilderMatch==='function')renderBuilderMatch=renderFullMatch;
  window.renderAudoraBuilderChoices=renderFullMatch;

  document.addEventListener('click',event=>{
    const studioButton=event.target.closest('[data-builder-studio]');
    if(studioButton){
      event.preventDefault();
      state.studioId=studioButton.dataset.builderStudio;
      renderFullMatch();
      if(typeof showToast==='function')showToast(text('Studio ausgewählt.','Studio selected.'));
      return;
    }
    const roleButton=event.target.closest('[data-builder-role-choice]');
    if(roleButton){
      event.preventDefault();
      const role=roleButton.dataset.builderRoleChoice;
      state.selectedTeamByRole[role]=roleButton.dataset.builderMember||null;
      renderFullMatch();
      if(typeof showToast==='function')showToast(text(`${roleName(role)} aktualisiert.`,`${roleName(role)} updated.`));
    }
  });

  ['buildCity','budgetRange'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{
    if(typeof builderStep!=='undefined'&&builderStep===3)renderFullMatch();
  }));
  document.getElementById('genreChips')?.addEventListener('click',()=>{
    if(typeof builderStep!=='undefined'&&builderStep===3)setTimeout(renderFullMatch,0);
  });
  document.getElementById('goalCards')?.addEventListener('click',()=>{
    state.selectedTeamByRole={};
  });

  if(window.AudoraAPI?.createSession){
    const previousCreate=window.AudoraAPI.createSession.bind(window.AudoraAPI);
    window.AudoraAPI.createSession=payload=>previousCreate({
      ...payload,
      team_ids:selectedTeam().map(x=>x.id),
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    .builder-choice-section{display:grid;gap:7px;margin-top:13px}.builder-choice-section+.builder-choice-section{margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}.builder-choice-list{display:grid;gap:7px}.match-section-label{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 2px 2px}.match-section-label>div strong,.match-section-label>div small{display:block}.match-section-label strong{font-size:11px}.match-section-label small{font-size:9px;color:#817a89;margin-top:3px}.builder-role-badge{font-size:8px;font-weight:800;letter-spacing:.1em;color:#8570a7;border:1px solid var(--line);border-radius:999px;padding:5px 7px}.team-row.builder-select-row{width:100%;color:inherit;text-align:left;transition:.18s;position:relative}.team-row.builder-select-row:hover{background:rgba(150,92,255,.065);border-color:rgba(150,92,255,.28);transform:translateY(-1px)}.team-row.builder-select-row.selected{background:linear-gradient(90deg,rgba(150,92,255,.14),rgba(99,232,187,.035));border-color:rgba(99,232,187,.48);box-shadow:inset 0 0 0 1px rgba(99,232,187,.08)}.builder-choice-price{display:flex;align-items:center;gap:9px}.builder-choice-price b{white-space:nowrap}.builder-choice-price i{width:21px;height:21px;border-radius:50%;border:1px solid var(--line-strong);display:grid;place-items:center;font-style:normal;font-size:9px;color:var(--mint)}.builder-select-row.selected .builder-choice-price i{background:rgba(99,232,187,.12);border-color:rgba(99,232,187,.4)}.builder-skip-icon{width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,.04);display:grid;place-items:center;font-size:20px;color:#77717f}.builder-skip{grid-template-columns:42px 1fr auto!important}@media(max-width:540px){.match-section-label{align-items:flex-start}.match-section-label small{font-size:9px}.builder-choice-price b{font-size:10px}.team-row.builder-select-row{grid-template-columns:42px 1fr auto}}
  `;
  document.head.appendChild(style);
})();
