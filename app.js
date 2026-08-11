const BRAND={name:'Audora'};

const listings=[
  {id:'neon-room',category:'studio',name:'Neon Room Berlin',image:'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=85',rating:4.96,reviews:128,distance:'1.8 km',price:89,instant:true,top:true,genres:['Hip-Hop','R&B','Pop'],meta:{de:'Kreuzberg · Vocal Booth · 42 m²',en:'Kreuzberg · Vocal booth · 42 m²'},tags:{de:['Neumann U87','SSL','Vocal Booth'],en:['Neumann U87','SSL','Vocal booth']},about:{de:'Modernes Recording-Studio in Kreuzberg mit warmer Akustik, separater Vocal Booth und schnellem Workflow für Artists und Producer.',en:'Modern recording studio in Kreuzberg with warm acoustics, a separate vocal booth and a fast workflow for artists and producers.'}},
  {id:'atlas-sound',category:'studio',name:'Atlas Sound Loft',image:'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=85',rating:4.91,reviews:84,distance:'3.2 km',price:65,instant:true,top:false,genres:['Indie','Rock','Pop'],meta:{de:'Friedrichshain · Live Room · 68 m²',en:'Friedrichshain · Live room · 68 m²'},tags:{de:['Live Room','Drums','Analog'],en:['Live room','Drums','Analog']},about:{de:'Helles Loft-Studio für Bands, Live-Instrumente, Proben und kreative Production Sessions.',en:'Bright loft studio for bands, live instruments, rehearsals and creative production sessions.'}},
  {id:'noir-suite',category:'studio',name:'NOIR Recording Suite',image:'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=900&q=85',rating:4.99,reviews:201,distance:'4.6 km',price:110,instant:false,top:true,genres:['R&B','Hip-Hop','Soul'],meta:{de:'Charlottenburg · Premium · 55 m²',en:'Charlottenburg · Premium · 55 m²'},tags:{de:['Genelec','U87','Lounge'],en:['Genelec','U87','Lounge']},about:{de:'Premium-Suite für fokussierte Sessions mit hochwertigem Monitoring, Lounge und diskretem Zugang.',en:'Premium suite for focused sessions with high-end monitoring, lounge and discreet access.'}},
  {id:'jona-k',category:'producer',name:'Jona K.',image:'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=900&q=85',rating:4.98,reviews:76,distance:'2.1 km',price:180,instant:true,top:true,genres:['Hip-Hop','Trap','R&B'],meta:{de:'Producer · 38 Releases · 12 Mio. Streams',en:'Producer · 38 releases · 12M streams'},tags:{de:['Beatmaking','Vocal Production','Arrangement'],en:['Beatmaking','Vocal production','Arrangement']},about:{de:'Producer mit Fokus auf modernen Hip-Hop, Trap und R&B – von der ersten Idee bis zur finalen Vocal Production.',en:'Producer focused on modern hip-hop, trap and R&B, from the first idea through final vocal production.'}},
  {id:'lena-nova',category:'producer',name:'Lena Nova',image:'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85',rating:4.93,reviews:52,distance:'5.4 km',price:220,instant:false,top:true,genres:['Pop','Electronic','Indie'],meta:{de:'Producerin · Songwriterin · 8 Mio. Streams',en:'Producer · Songwriter · 8M streams'},tags:{de:['Production','Synths','Songwriting'],en:['Production','Synths','Songwriting']},about:{de:'Genreübergreifende Producerin und Songwriterin für Pop, Electronic und Indie mit Stärke in Arrangement und Artist Development.',en:'Genre-fluid producer and songwriter for pop, electronic and indie, strong in arrangement and artist development.'}},
  {id:'mia-l',category:'engineer',name:'Mia L.',image:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85',rating:4.97,reviews:109,distance:'2.9 km',price:120,instant:true,top:true,genres:['Hip-Hop','Pop','R&B'],meta:{de:'Mix-Toningenieurin · Dolby Atmos · 64 Credits',en:'Mix engineer · Dolby Atmos · 64 credits'},tags:{de:['Mixing','Mastering','Atmos'],en:['Mixing','Mastering','Atmos']},about:{de:'Mix-Toningenieurin für moderne Vocals und druckvolle Low-Ends. Remote oder vor Ort buchbar.',en:'Mix engineer for modern vocals and powerful low end. Available remotely or in person.'}},
  {id:'finn-audio',category:'engineer',name:'Finn Audio',image:'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=900&q=85',rating:4.90,reviews:68,distance:'4.1 km',price:95,instant:true,top:false,genres:['Rock','Indie','Pop'],meta:{de:'Recording & Mix · 47 Credits',en:'Recording & mix · 47 credits'},tags:{de:['Tracking','Mixing','Drums'],en:['Tracking','Mixing','Drums']},about:{de:'Recording und Mixing für Bands, Indie und Pop mit schnellem Editing und viel Erfahrung mit Live-Setups.',en:'Recording and mixing for bands, indie and pop with fast editing and strong live-setup experience.'}},
  {id:'nia-words',category:'songwriter',name:'Nia Words',image:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85',rating:4.95,reviews:61,distance:'3.6 km',price:160,instant:true,top:true,genres:['Pop','R&B','Soul'],meta:{de:'Songwriterin · Toplinerin · 31 Credits',en:'Songwriter · Topliner · 31 credits'},tags:{de:['Lyrics','Topline','Vocal Demo'],en:['Lyrics','Topline','Vocal demo']},about:{de:'Songwriterin und Toplinerin für Pop, R&B und Soul mit Fokus auf Hooks, Story und singbare Melodien.',en:'Songwriter and topliner for pop, R&B and soul, focused on hooks, story and singable melodies.'}}
];

const conversations=[
  {id:'jona',name:'Jona K.',image:listings.find(x=>x.id==='jona-k').image,preview:{de:'Passt. Ich bringe zwei Beat-Ideen mit.',en:'Perfect. I will bring two beat ideas.'},time:'12 Min.',messages:[
    {me:false,de:'Hey Alex, ich habe mir deine Referenzen angehört. Sehr klare Richtung.',en:'Hey Alex, I listened to your references. Very clear direction.',time:'18:21'},
    {me:true,de:'Perfekt. Ich will die Vocals eher dunkel und direkt halten.',en:'Perfect. I want to keep the vocals dark and direct.',time:'18:24'},
    {me:false,de:'Passt. Ich bringe zwei Beat-Ideen mit und wir entscheiden im Studio.',en:'Perfect. I will bring two beat ideas and we can decide in the studio.',time:'18:31'}]},
  {id:'mia',name:'Mia L.',image:listings.find(x=>x.id==='mia-l').image,preview:{de:'Session ist bestätigt ✓',en:'Session confirmed ✓'},time:'24 Min.',messages:[
    {me:false,de:'Session ist bestätigt ✓ Ich bin am Freitag ab 19:45 da.',en:'Session confirmed ✓ I will be there Friday from 19:45.',time:'18:07'},
    {me:true,de:'Super, bis Freitag!',en:'Great, see you Friday!',time:'18:09'}]},
  {id:'neon',name:'Neon Room Berlin',image:listings.find(x=>x.id==='neon-room').image,preview:{de:'Der Raum ist ab 19:30 frei.',en:'The room is free from 19:30.'},time:'1 Std.',messages:[
    {me:false,de:'Der Raum ist ab 19:30 frei. Ihr könnt gerne etwas früher rein.',en:'The room is free from 19:30. You are welcome to come in a little early.',time:'17:35'}]}
];

let sessions=[
  {id:'midnight',state:'upcoming',title:'Midnight EP',date:{de:'Fr. 14. Aug. · 20:00–23:00',en:'Fri, Aug 14 · 20:00–23:00'},place:'Neon Room Berlin',status:'confirmed',image:listings[0].image,team:['jona-k','mia-l'],total:567},
  {id:'vocal-test',state:'upcoming',title:'Vocal Test',date:{de:'Di. 18. Aug. · 18:00–20:00',en:'Tue, Aug 18 · 18:00–20:00'},place:'Atlas Sound Loft',status:'confirmed',image:listings[1].image,team:['finn-audio'],total:320},
  {id:'summer-single',state:'drafts',title:'Summer Single',date:{de:'Termin offen',en:'Date open'},place:{de:'Studio noch offen',en:'Studio not selected'},status:'draft',image:listings[4].image,team:['lena-nova'],total:0},
  {id:'first-demo',state:'past',title:'First Demo',date:{de:'22. Juli · abgeschlossen',en:'July 22 · completed'},place:'NOIR Recording Suite',status:'completed',image:listings[2].image,team:['mia-l'],total:410}
];

let lang=localStorage.getItem('audora-lang')||((navigator.language||'de').toLowerCase().startsWith('de')?'de':'en');
let route=(location.hash||'#home').slice(1);
let activeCategory='all';
let activeFilter='recommended';
let searchTerm='';
let favorites=new Set(JSON.parse(localStorage.getItem('audora-favorites')||'[]'));
let builderStep=1;
let builderGoal='';
let selectedGenres=new Set();
let activeSessionFilter='upcoming';
let activeChat='jona';
let providerMode=false;
let roomTab='overview';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const t=path=>path.split('.').reduce((o,k)=>o&&o[k],window.I18N[lang])||path;
const escapeHTML=str=>String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const routeTitles={
  home:['home.eyebrow','home.title'],discover:['discover.eyebrow','discover.title'],build:['build.eyebrow','build.title'],sessions:['sessions.eyebrow','sessions.title'],saved:['saved.eyebrow','saved.title'],inbox:['inbox.eyebrow','inbox.title'],profile:['profile.eyebrow','profile.title']
};
const categoryKey={studio:'card.studio',producer:'card.producer',engineer:'card.engineer',songwriter:'card.songwriter'};
const goalKey={record:'goals.record',produce:'goals.produce',mix:'goals.mix',write:'goals.write'};

function applyLanguage(){
  document.documentElement.lang=lang;
  document.title=`${BRAND.name} — ${t(routeTitles[route]?.[1]||'home.title')}`;
  $$('[data-brand]').forEach(el=>el.textContent=BRAND.name);
  $$('[data-i18n]').forEach(el=>{const v=t(el.dataset.i18n);if(v!==el.dataset.i18n)el.textContent=v});
  $$('[data-i18n-html]').forEach(el=>{const v=t(el.dataset.i18nHtml);if(v!==el.dataset.i18nHtml)el.innerHTML=v});
  $$('[data-i18n-placeholder]').forEach(el=>{const v=t(el.dataset.i18nPlaceholder);if(v!==el.dataset.i18nPlaceholder)el.placeholder=v});
  $('#currentLanguage').textContent=lang.toUpperCase();
  $$('#languageMenu [data-lang]').forEach(btn=>btn.classList.toggle('active',btn.dataset.lang===lang));
  updateRouteTitle();renderHome();renderDiscover();renderSaved();renderSessions();renderConversations();renderChat();renderBuilderMatch();renderSessionRoom();
}

function updateRouteTitle(){
  const keys=routeTitles[route]||routeTitles.home;
  $('#pageEyebrow').textContent=t(keys[0]);
  $('#pageTitle').textContent=t(keys[1]);
}

function go(next,push=true){
  if(!routeTitles[next]) next='home';
  route=next;
  if(push && location.hash!==`#${next}`) history.pushState(null,'',`#${next}`);
  $$('.app-view').forEach(v=>v.classList.toggle('active',v.dataset.view===next));
  $$('[data-route]').forEach(btn=>btn.classList.toggle('active',btn.dataset.route===next && (btn.classList.contains('side-link')||btn.closest('.mobile-nav'))));
  updateRouteTitle();document.title=`${BRAND.name} — ${t(routeTitles[next][1])}`;
  closeAllPanels();
  if(next==='saved') renderSaved();
  if(next==='sessions') renderSessions();
  if(next==='inbox'){renderConversations();renderChat()}
  if(next==='profile') syncProviderUI();
  window.scrollTo({top:0,behavior:'smooth'});
}

function listingType(item){return t(categoryKey[item.category]||'card.studio')}
function priceLabel(item){return `€${item.price}${item.category==='studio'?` ${t('card.hour')}`:''}`}
function isAvailable(item){return item.instant}

function miniCard(item,full=false){
  const fav=favorites.has(item.id);
  return `<article class="${full?'listing-card':'mini-listing'}" data-listing-card="${item.id}">
    <div class="mini-image"><img src="${item.image}" alt="${escapeHTML(item.name)}" loading="lazy"><button class="heart-btn ${fav?'active':''}" data-favorite="${item.id}" aria-label="${t(fav?'card.saved':'card.save')}"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg></button><span class="mini-badge">${isAvailable(item)?'● '+t('card.available'):'✓ '+t('card.verified')}</span></div>
    <div class="mini-body"><div class="mini-title"><h3>${escapeHTML(item.name)}</h3><span>★ ${item.rating.toFixed(2)}</span></div><div class="mini-meta">${listingType(item)} · ${item.meta[lang]} · ${item.distance} ${t('card.away')}</div>${full?`<div class="listing-tags">${item.tags[lang].map(x=>`<span>${escapeHTML(x)}</span>`).join('')}</div>`:''}<div class="mini-footer"><span><small>${t('card.from')}</small><strong>${priceLabel(item)}</strong></span>${full?`<div class="listing-actions"><button data-message-listing="${item.id}">${t('common.message')}</button><button class="primary-card" data-view-listing="${item.id}">${t('card.view')}</button></div>`:`<button data-view-listing="${item.id}">${t('card.view')}</button>`}</div></div>
  </article>`
}

function renderHome(){
  const box=$('#homeRecommendations');if(!box)return;
  box.innerHTML=[listings[0],listings[3],listings[5],listings[7]].map(i=>miniCard(i,false)).join('');
  updateFavoriteCounts();
}

function filteredListings(){
  let pool=listings.filter(x=>activeCategory==='all'||x.category===activeCategory);
  if(activeFilter==='instant') pool=pool.filter(x=>x.instant);
  if(activeFilter==='top') pool=pool.filter(x=>x.top);
  if(activeFilter==='budget') pool=pool.filter(x=>x.price<100);
  const term=searchTerm.trim().toLowerCase();
  if(term) pool=pool.filter(x=>[x.name,x.category,...x.genres,...x.tags.de,...x.tags.en,x.meta.de,x.meta.en].join(' ').toLowerCase().includes(term));
  return pool;
}

function renderDiscover(){
  const grid=$('#discoverGrid');if(!grid)return;
  const pool=filteredListings();
  grid.innerHTML=pool.length?pool.map(i=>miniCard(i,true)).join(''):`<div class="empty-state" style="grid-column:1/-1;min-height:300px"><span>⌕</span><h2>${lang==='de'?'Keine Treffer gefunden.':'No results found.'}</h2><p>${lang==='de'?'Ändere Kategorie, Filter oder Suchbegriff.':'Try another category, filter or search term.'}</p></div>`;
}

function updateFavoriteCounts(){
  const count=favorites.size;
  const el=$('#sideSavedCount');if(el)el.textContent=count;
}
function toggleFavorite(id){
  if(favorites.has(id)){favorites.delete(id);showToast(t('toast.removed'))}else{favorites.add(id);showToast(t('toast.saved'))}
  localStorage.setItem('audora-favorites',JSON.stringify([...favorites]));updateFavoriteCounts();renderHome();renderDiscover();renderSaved();
}
function renderSaved(){
  const grid=$('#savedGrid'),empty=$('#savedEmpty');if(!grid||!empty)return;
  const saved=listings.filter(x=>favorites.has(x.id));
  empty.style.display=saved.length?'none':'flex';grid.style.display=saved.length?'grid':'none';grid.innerHTML=saved.map(i=>miniCard(i,true)).join('');
}

function openListing(id){
  const item=listings.find(x=>x.id===id);if(!item)return;
  $('#listingDetail').innerHTML=`<div class="detail-hero"><img src="${item.image}" alt="${escapeHTML(item.name)}"><div class="detail-title"><small>${listingType(item)} · ★ ${item.rating.toFixed(2)} · ${item.reviews}</small><h2>${escapeHTML(item.name)}</h2><span class="live-pill"><i></i>${item.instant?t('card.available'):t('card.verified')}</span></div></div><div class="detail-content"><div><h3>${t('card.about')}</h3><p>${item.about[lang]}</p><h3>${t('card.highlights')}</h3><div class="detail-tags">${item.tags[lang].map(x=>`<span>${escapeHTML(x)}</span>`).join('')}</div></div><aside class="detail-book"><small>${t('card.from')}</small><strong>${priceLabel(item)}</strong><button class="primary-btn" data-book-listing="${item.id}">${t('card.book')}</button><button class="ghost-btn" data-message-listing="${item.id}">${t('card.message')}</button></aside></div>`;
  openModal('listingModal');
}
function bookListing(id){
  closeModals();builderGoal=listings.find(x=>x.id===id)?.category==='studio'?'record':'produce';go('build');setBuilderStep(2);syncGoalCards();showToast(t('toast.action'));
}
function messageListing(id){
  const item=listings.find(x=>x.id===id);if(!item)return;closeModals();
  activeChat=item.id==='mia-l'?'mia':item.id==='neon-room'?'neon':'jona';go('inbox');renderConversations();renderChat();
}

function setBuilderStep(step){
  builderStep=Math.max(1,Math.min(3,step));
  $$('.builder-page').forEach(p=>p.classList.toggle('active',Number(p.dataset.builderPage)===builderStep));
  $$('.builder-stepper button').forEach(b=>b.classList.toggle('active',Number(b.dataset.builderStep)<=builderStep));
  $('#builderBack').style.visibility=builderStep===1?'hidden':'visible';
  const next=$('#builderNext');next.querySelector('span').textContent=builderStep===3?t('build.finish'):t('common.next');
  if(builderStep===3) renderBuilderMatch();
}
function syncGoalCards(){
  $$('#goalCards [data-goal]').forEach(b=>b.classList.toggle('selected',b.dataset.goal===builderGoal));
  $('#summaryGoal').textContent=builderGoal?t(goalKey[builderGoal]):'—';
}
function updateBuilderSummary(){
  $('#summarySound').textContent=selectedGenres.size?[...selectedGenres].join(', '):'—';
  $('#summaryPlace').textContent=$('#buildCity').value||'Berlin';
  $('#budgetValue').textContent=`€${$('#budgetRange').value}`;
  const base=builderGoal==='mix'?410:builderGoal==='write'?360:567;$('#summaryTotal').textContent=`€${Math.min(Number($('#budgetRange').value),base)}`;
}
function renderBuilderMatch(){
  const box=$('#matchTeam');if(!box)return;
  const goal=builderGoal||'record';let picks=goal==='mix'?[listings[5],listings[0]]:goal==='write'?[listings[7],listings[0]]:[listings[0],listings[3],listings[5]];
  box.innerHTML=picks.map(x=>`<div class="team-row"><img src="${x.image}" alt="${escapeHTML(x.name)}"><span><small>${listingType(x)}</small><strong>${escapeHTML(x.name)}</strong></span><b>${priceLabel(x)}</b></div>`).join('');
  const genres=[...selectedGenres];$('#matchHeadline').textContent=`${genres[0]||'Hip-Hop'} Session · ${$('#buildCity')?.value||'Berlin'}`;updateBuilderSummary();
}
function confirmDemoBooking(){
  if(!sessions.some(s=>s.id==='new-demo'))sessions.unshift({id:'new-demo',state:'upcoming',title:lang==='de'?'Neue Audora Session':'New Audora Session',date:{de:'Termin reserviert · 20:00',en:'Slot reserved · 20:00'},place:$('#buildCity').value,status:'confirmed',image:listings[0].image,team:['jona-k','mia-l'],total:Number($('#summaryTotal').textContent.replace(/\D/g,''))||567});
  showToast(t('toast.booked'));go('sessions');activeSessionFilter='upcoming';syncSessionTabs();renderSessions();
}

function syncSessionTabs(){
  $$('#sessionTabs [data-session-filter]').forEach(b=>b.classList.toggle('active',b.dataset.sessionFilter===activeSessionFilter));
}
function statusText(status){return t(`sessions.${status}`)}
function renderSessions(){
  const box=$('#sessionList');if(!box)return;
  const items=sessions.filter(s=>s.state===activeSessionFilter);
  box.innerHTML=items.map(s=>{const team=s.team.map(id=>listings.find(x=>x.id===id)).filter(Boolean);return `<article class="session-item"><div class="session-cover"><img src="${s.image}" alt="${escapeHTML(s.title)}"><span>${statusText(s.status)}</span></div><div class="session-info"><small>${typeof s.date==='string'?s.date:s.date[lang]}</small><strong>${escapeHTML(s.title)}</strong><p>${typeof s.place==='string'?s.place:s.place[lang]}${s.total?` · €${s.total}`:''}</p><div class="session-team-mini">${team.map(x=>`<img src="${x.image}" alt="${escapeHTML(x.name)}">`).join('')}</div></div><div class="session-actions">${s.status==='draft'?`<button class="primary-btn" data-route="build">${t('sessions.continue')}</button>`:`<button class="secondary-btn" data-open-session="${s.id}">${t('sessions.open')}</button>`}</div></article>`}).join('');
}

function openSessionRoom(id){
  const s=sessions.find(x=>x.id===id)||sessions[0];$('#sessionRoom').dataset.session=id;$('#sessionRoom').classList.add('open');$('#sessionRoom').setAttribute('aria-hidden','false');roomTab='overview';syncRoomTabs();renderSessionRoom(s);
}
function closeSessionRoom(){const room=$('#sessionRoom');room.classList.remove('open');room.setAttribute('aria-hidden','true')}
function syncRoomTabs(){ $$('#roomTabs [data-room-tab]').forEach(b=>b.classList.toggle('active',b.dataset.roomTab===roomTab)) }
function renderSessionRoom(sessionArg){
  const box=$('#roomContent');if(!box)return;const s=sessionArg||sessions.find(x=>x.id===$('#sessionRoom').dataset.session)||sessions[0];
  const team=s.team.map(id=>listings.find(x=>x.id===id)).filter(Boolean);
  if(roomTab==='overview')box.innerHTML=`<small>${t('room.overview')}</small><h3>${escapeHTML(s.title)}</h3><div class="room-overview-grid"><div class="room-info-card"><small>${t('room.next')}</small><strong>${typeof s.date==='string'?s.date:s.date[lang]}</strong></div><div class="room-info-card"><small>${t('room.location')}</small><strong>${typeof s.place==='string'?s.place:s.place[lang]}</strong></div><div class="room-info-card"><small>${t('room.team')}</small><strong>${team.length+1} ${lang==='de'?'Personen':'people'}</strong></div><div class="room-info-card"><small>${t('room.total')}</small><strong>€${s.total||567}</strong></div></div><h3 style="margin-top:18px">${t('room.tasks')}</h3><div class="task-list"><div class="task-row"><span class="task-check done">✓</span><span><strong>${t('room.task1')}</strong><small>Alex</small></span><small>✓</small></div><div class="task-row"><button class="task-check" data-task-toggle> </button><span><strong>${t('room.task2')}</strong><small>Alex</small></span><small>Heute</small></div><div class="task-row"><button class="task-check" data-task-toggle> </button><span><strong>${t('room.task3')}</strong><small>Mia L.</small></span><small>FR</small></div></div>`;
  if(roomTab==='files')box.innerHTML=`<small>${t('room.files')}</small><h3>${t('room.filesTitle')}</h3><div class="file-list"><div class="file-row"><span>W</span><span><strong>mix_reference.wav</strong><small>32 MB · Alex</small></span><button class="secondary-btn" data-demo-action="file">↓</button></div><div class="file-row"><span>T</span><span><strong>lyrics_final.txt</strong><small>12 KB · Alex</small></span><button class="secondary-btn" data-demo-action="file">↓</button></div><div class="file-row"><span>P</span><span><strong>vocal_chain.pdf</strong><small>1.8 MB · Mia</small></span><button class="secondary-btn" data-demo-action="file">↓</button></div></div><button class="primary-btn" style="margin-top:12px" data-demo-action="upload">＋ ${lang==='de'?'Datei hochladen':'Upload file'}</button>`;
  if(roomTab==='team')box.innerHTML=`<small>${t('room.team')}</small><h3>${t('room.teamTitle')}</h3><div class="room-team-list">${[listings[0],...team].map(x=>`<div class="room-team-row"><img src="${x.image}" alt="${escapeHTML(x.name)}"><span><small>${listingType(x)}</small><strong>${escapeHTML(x.name)}</strong></span><button class="secondary-btn" data-message-listing="${x.id}">${t('common.message')}</button></div>`).join('')}</div>`;
  if(roomTab==='chat')box.innerHTML=`<small>${t('room.chat')}</small><h3>${t('room.chatTitle')}</h3><div class="room-chat"><div class="message">${lang==='de'?'Wir sind Freitag ab 19:30 bereit.':'We are ready Friday from 19:30.'}<span>Neon Room · 17:35</span></div><div class="message me">${lang==='de'?'Perfekt, wir kommen gegen 19:45.':'Perfect, we will be there around 19:45.'}<span>Alex · 17:42</span></div><div class="message">${lang==='de'?'Ich bringe die Vocal Chain als Preset mit.':'I will bring the vocal chain as a preset.'}<span>Mia · 18:07</span></div></div><form class="message-input" id="roomMessageForm" style="margin-top:12px;border:1px solid var(--line);border-radius:12px"><button type="button" class="attach-btn">＋</button><input id="roomMessageText" placeholder="${lang==='de'?'Nachricht schreiben…':'Write a message…'}"><button class="send-btn"><svg viewBox="0 0 24 24"><path d="m4 12 16-8-6 16-2-6Z"/></svg></button></form>`;
}

function renderConversations(){
  const box=$('#conversationList');if(!box)return;
  box.innerHTML=conversations.map(c=>`<button class="conversation-item ${c.id===activeChat?'active':''}" data-chat="${c.id}"><img src="${c.image}" alt="${escapeHTML(c.name)}"><span><strong>${escapeHTML(c.name)}</strong><small>${c.preview[lang]}</small></span><span class="conversation-time">${c.time}</span></button>`).join('');
}
function renderChat(){
  const chat=conversations.find(c=>c.id===activeChat)||conversations[0];if(!$('#chatHeader'))return;
  $('#chatHeader').innerHTML=`<button class="back-circle chat-back" id="chatBack"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><img src="${chat.image}" alt="${escapeHTML(chat.name)}"><span><strong>${escapeHTML(chat.name)}</strong><small>${t('inbox.online')} · ${t('inbox.session')}</small></span>`;
  $('#messages').innerHTML=chat.messages.map(m=>`<div class="message ${m.me?'me':''}">${m[lang]}<span>${m.time}</span></div>`).join('');
  requestAnimationFrame(()=>{$('#messages').scrollTop=$('#messages').scrollHeight});
}
function sendMessage(text,target='main'){
  const value=text.trim();if(!value)return;const chat=conversations.find(c=>c.id===activeChat);chat.messages.push({me:true,de:value,en:value,time:'18:44'});chat.preview={de:value,en:value};renderConversations();renderChat();showToast(t('toast.message'));
  if(target==='room'){roomTab='chat';renderSessionRoom()}
}

function toggleProvider(){providerMode=!providerMode;syncProviderUI();showToast(t(providerMode?'toast.providerOn':'toast.providerOff'))}
function syncProviderUI(){
  $('#providerSwitch').classList.toggle('active',providerMode);$('#profileProvider .toggle-switch').classList.toggle('active',providerMode);$('#providerDashboard').classList.toggle('open',providerMode);
}

function openSettings(kind){
  const map={payments:['settings.paymentsTitle','settings.paymentsText'],notifications:['settings.notificationsTitle','settings.notificationsText'],security:['settings.securityTitle','settings.securityText'],edit:['settings.editTitle','settings.editText']};const keys=map[kind]||map.edit;
  $('#settingsContent').innerHTML=`<h2>${t(keys[0])}</h2><p>${t(keys[1])}</p><button class="primary-btn" data-close-modal>${t('common.done')}</button>`;openModal('settingsModal');
}
function openFilterModal(){
  $('#settingsContent').innerHTML=`<h2>${lang==='de'?'Filter':'Filters'}</h2><p>${lang==='de'?'Dieser Prototyp zeigt bereits die Filterlogik. Zusätzliche Filter können später direkt an die API angebunden werden.':'This prototype already demonstrates filter logic. Additional filters can later connect directly to the API.'}</p><div class="builder-fields" style="grid-template-columns:1fr"><label><small>${lang==='de'?'ENTFERNUNG':'DISTANCE'}</small><select><option>5 km</option><option>10 km</option><option>25 km</option></select></label><label><small>${lang==='de'?'PREIS':'PRICE'}</small><select><option>€0–100</option><option>€100–250</option><option>€250+</option></select></label></div><button class="primary-btn" style="margin-top:12px" data-apply-filter>${lang==='de'?'Filter anwenden':'Apply filters'}</button>`;openModal('settingsModal');
}
function openModal(id){const m=$(`#${id}`);m.classList.add('open');m.setAttribute('aria-hidden','false')}
function closeModals(){ $$('.modal-backdrop.open').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true')}) }
function openPanel(id){closeAllPanels();const p=$(`#${id}`);p.classList.add('open');p.setAttribute('aria-hidden','false')}
function closeAllPanels(){ $$('.overlay-panel.open').forEach(p=>{p.classList.remove('open');p.setAttribute('aria-hidden','true')});$('#languageMenu').classList.remove('open') }
function showToast(message){const toast=$('#toast');toast.querySelector('p').textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2300)}

function runAI(action){
  closeAllPanels();if(action==='build'){builderGoal='record';selectedGenres=new Set(['Hip-Hop']);syncGoalCards();go('build');setBuilderStep(2);updateBuilderSummary()}else{activeCategory=action==='producer'?'producer':'studio';activeFilter=action==='studio'?'instant':'recommended';syncDiscoverControls();go('discover');renderDiscover()}showToast(t('toast.ai'));
}
function syncDiscoverControls(){
  $$('#categoryTabs [data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category===activeCategory));
  $$('#filterRow [data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===activeFilter));
}

function bindEvents(){
  document.addEventListener('click',e=>{
    const routeBtn=e.target.closest('[data-route]');if(routeBtn){e.preventDefault();go(routeBtn.dataset.route);return}
    const fav=e.target.closest('[data-favorite]');if(fav){e.stopPropagation();toggleFavorite(fav.dataset.favorite);return}
    const view=e.target.closest('[data-view-listing]');if(view){openListing(view.dataset.viewListing);return}
    const book=e.target.closest('[data-book-listing]');if(book){bookListing(book.dataset.bookListing);return}
    const msg=e.target.closest('[data-message-listing]');if(msg){messageListing(msg.dataset.messageListing);return}
    const openSession=e.target.closest('[data-open-session]');if(openSession){openSessionRoom(openSession.dataset.openSession);return}
    const closePanel=e.target.closest('[data-close-panel]');if(closePanel){const p=$(`#${closePanel.dataset.closePanel}`);p.classList.remove('open');p.setAttribute('aria-hidden','true');return}
    if(e.target.closest('[data-close-modal]')){closeModals();return}
    const goal=e.target.closest('[data-goal]');if(goal){builderGoal=goal.dataset.goal;syncGoalCards();updateBuilderSummary();return}
    const quickGoal=e.target.closest('[data-build-goal]');if(quickGoal){builderGoal=quickGoal.dataset.buildGoal;syncGoalCards();go('build');setBuilderStep(2);return}
    const catJump=e.target.closest('[data-category-jump]');if(catJump){activeCategory=catJump.dataset.categoryJump;syncDiscoverControls();renderDiscover();return}
    const cat=e.target.closest('#categoryTabs [data-category]');if(cat){activeCategory=cat.dataset.category;syncDiscoverControls();renderDiscover();return}
    const filter=e.target.closest('#filterRow [data-filter]');if(filter){activeFilter=filter.dataset.filter;syncDiscoverControls();renderDiscover();return}
    const sessionFilter=e.target.closest('#sessionTabs [data-session-filter]');if(sessionFilter){activeSessionFilter=sessionFilter.dataset.sessionFilter;syncSessionTabs();renderSessions();return}
    const chat=e.target.closest('[data-chat]');if(chat){activeChat=chat.dataset.chat;renderConversations();renderChat();$('#chatPanel').classList.add('mobile-open');return}
    const room=e.target.closest('#roomTabs [data-room-tab]');if(room){roomTab=room.dataset.roomTab;syncRoomTabs();renderSessionRoom();return}
    const task=e.target.closest('[data-task-toggle]');if(task){task.classList.toggle('done');task.textContent=task.classList.contains('done')?'✓':'';return}
    const ai=e.target.closest('[data-ai]');if(ai){runAI(ai.dataset.ai);return}
    const setting=e.target.closest('[data-settings]');if(setting){openSettings(setting.dataset.settings);return}
    const demo=e.target.closest('[data-demo-action]');if(demo){showToast(t('toast.action'));return}
    if(e.target.closest('[data-apply-filter]')){closeModals();showToast(t('toast.action'));return}
  });
  $('#languageButton').addEventListener('click',e=>{e.stopPropagation();$('#languageMenu').classList.toggle('open')});
  $$('#languageMenu [data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;localStorage.setItem('audora-lang',lang);applyLanguage();$('#languageMenu').classList.remove('open');showToast(t('toast.language'))}));
  $('#notificationButton').addEventListener('click',()=>openPanel('notificationPanel'));
  $('#aiFab').addEventListener('click',()=>openPanel('aiPanel'));$('#quickAi').addEventListener('click',()=>openPanel('aiPanel'));
  $('#providerSwitch').addEventListener('click',()=>{toggleProvider();go('profile')});$('#profileProvider').addEventListener('click',toggleProvider);
  $('#editProfile').addEventListener('click',()=>openSettings('edit'));$('#filterButton').addEventListener('click',openFilterModal);
  $('#mapToggle').addEventListener('click',()=>$('#discoverLayout').classList.toggle('map-open'));
  $('#discoverSearch').addEventListener('input',e=>{searchTerm=e.target.value;renderDiscover()});
  $('#goalCards').addEventListener('click',e=>{const b=e.target.closest('[data-goal]');if(b){builderGoal=b.dataset.goal;syncGoalCards()}});
  $('#genreChips').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;selectedGenres.has(b.textContent)?selectedGenres.delete(b.textContent):selectedGenres.add(b.textContent);b.classList.toggle('selected');updateBuilderSummary()});
  $('#buildCity').addEventListener('change',updateBuilderSummary);$('#budgetRange').addEventListener('input',updateBuilderSummary);
  $('#builderBack').addEventListener('click',()=>setBuilderStep(builderStep-1));$('#builderNext').addEventListener('click',()=>{if(builderStep===1 && !builderGoal){builderGoal='record';syncGoalCards()}if(builderStep<3)setBuilderStep(builderStep+1);else confirmDemoBooking()});
  $('#messageForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#messageText');sendMessage(input.value);input.value=''});
  $('#aiForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#aiText');if(input.value.trim()){builderGoal='record';selectedGenres=new Set(['Hip-Hop']);input.value='';runAI('build')}});
  $('#closeSessionRoom').addEventListener('click',closeSessionRoom);
  window.addEventListener('hashchange',()=>go((location.hash||'#home').slice(1),false));
  document.addEventListener('click',e=>{if(!e.target.closest('.language-switcher')&&!e.target.closest('.overlay-panel')&&!e.target.closest('#notificationButton')&&!e.target.closest('#aiFab')&&!e.target.closest('#quickAi'))closeAllPanels()});
  $$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModals()}));
  document.addEventListener('click',e=>{if(e.target.id==='chatBack')$('#chatPanel').classList.remove('mobile-open')});
  document.addEventListener('submit',e=>{if(e.target.id==='roomMessageForm'){e.preventDefault();const input=$('#roomMessageText');const text=input.value.trim();if(text){const holder=$('.room-chat');holder.insertAdjacentHTML('beforeend',`<div class="message me">${escapeHTML(text)}<span>Alex · 18:44</span></div>`);input.value='';showToast(t('toast.message'))}}});
}

function init(){
  if(!routeTitles[route])route='home';
  bindEvents();applyLanguage();syncDiscoverControls();syncGoalCards();updateBuilderSummary();setBuilderStep(1);syncSessionTabs();renderSessions();renderConversations();renderChat();renderSaved();updateFavoriteCounts();syncProviderUI();go(route,false);
}

document.addEventListener('DOMContentLoaded',init);
