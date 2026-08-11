const BRAND={name:'Audora'};

const listings=[
 {id:'neon-room',category:'studio',name:'Neon Room Berlin',city:'Berlin',image:'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=85',rating:4.96,reviews:128,distance:'1.8 km',price:89,instant:true,top:true,genres:['Hip-Hop','R&B','Pop'],meta:{de:'Kreuzberg · Vocal Booth · 42 m²',en:'Kreuzberg · Vocal booth · 42 m²'},tags:{de:['Neumann U87','SSL','Vocal Booth'],en:['Neumann U87','SSL','Vocal booth']},about:{de:'Moderner Recording Space in Kreuzberg mit warmem Sound, separater Vocal Booth und schnellem Workflow für Artists, Producer und Content.',en:'Modern recording space in Kreuzberg with a warm sound, separate vocal booth and a fast workflow for artists, producers and content.'}},
 {id:'atlas-sound',category:'studio',name:'Atlas Sound Loft',city:'Berlin',image:'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=85',rating:4.91,reviews:84,distance:'3.2 km',price:65,instant:true,top:false,genres:['Indie','Rock','Pop'],meta:{de:'Friedrichshain · Live Room · 68 m²',en:'Friedrichshain · Live room · 68 m²'},tags:{de:['Live Room','Drums','Analog'],en:['Live room','Drums','Analog']},about:{de:'Helles Loft-Studio für Bands und Live-Instrumente. Ideal für Recording, Rehearsals und kreative Production Sessions.',en:'Bright loft studio for bands and live instruments. Ideal for recording, rehearsals and creative production sessions.'}},
 {id:'noir-suite',category:'studio',name:'NOIR Recording Suite',city:'Berlin',image:'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=900&q=85',rating:4.99,reviews:201,distance:'4.6 km',price:110,instant:false,top:true,genres:['R&B','Hip-Hop','Soul'],meta:{de:'Charlottenburg · Premium · 55 m²',en:'Charlottenburg · Premium · 55 m²'},tags:{de:['Genelec','U87','Lounge'],en:['Genelec','U87','Lounge']},about:{de:'Premium Suite für fokussierte Sessions mit hochwertigem Monitoring, Lounge und diskretem Zugang.',en:'Premium suite for focused sessions with high-end monitoring, lounge and discreet access.'}},
 {id:'jona-k',category:'producer',name:'Jona K.',city:'Berlin',image:'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=900&q=85',rating:4.98,reviews:76,distance:'2.1 km',price:180,instant:true,top:true,genres:['Hip-Hop','Trap','R&B'],meta:{de:'Producer · 38 Releases · 12M Streams',en:'Producer · 38 releases · 12M streams'},tags:{de:['Beatmaking','Vocal Prod.','Arrangement'],en:['Beatmaking','Vocal prod.','Arrangement']},about:{de:'Producer mit Fokus auf modernen Hip-Hop, Trap und R&B. Von der ersten Idee bis zur finalen Vocal Production.',en:'Producer focused on modern hip-hop, trap and R&B. From the first idea through final vocal production.'}},
 {id:'lena-nova',category:'producer',name:'Lena Nova',city:'Berlin',image:'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85',rating:4.93,reviews:52,distance:'5.4 km',price:220,instant:false,top:true,genres:['Pop','Electronic','Indie'],meta:{de:'Producer · Songwriter · 8M Streams',en:'Producer · Songwriter · 8M streams'},tags:{de:['Production','Synths','Songwriting'],en:['Production','Synths','Songwriting']},about:{de:'Genre-fluid Producerin und Songwriterin für Pop, Electronic und Indie. Stark in Arrangement und Artist Development.',en:'Genre-fluid producer and songwriter for pop, electronic and indie. Strong in arrangement and artist development.'}},
 {id:'kai-metro',category:'producer',name:'Kai Metro',city:'Berlin',image:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85',rating:4.88,reviews:41,distance:'6.8 km',price:145,instant:true,top:false,genres:['Afrobeats','Hip-Hop','Pop'],meta:{de:'Producer · Beatmaker · 24 Credits',en:'Producer · Beatmaker · 24 credits'},tags:{de:['Afrobeats','Beatmaking','Remote'],en:['Afrobeats','Beatmaking','Remote']},about:{de:'Schneller, kollaborativer Producer für Afrobeats, Hip-Hop und Pop mit Remote- und In-Studio-Workflow.',en:'Fast, collaborative producer for Afrobeats, hip-hop and pop with remote and in-studio workflows.'}},
 {id:'mia-l',category:'engineer',name:'Mia L.',city:'Berlin',image:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85',rating:4.97,reviews:109,distance:'2.9 km',price:120,instant:true,top:true,genres:['Hip-Hop','Pop','R&B'],meta:{de:'Mix Engineer · Dolby Atmos · 64 Credits',en:'Mix engineer · Dolby Atmos · 64 credits'},tags:{de:['Mixing','Mastering','Atmos'],en:['Mixing','Mastering','Atmos']},about:{de:'Mix Engineer für detailreiche, moderne Vocals und druckvolle Low-Ends. Remote oder vor Ort buchbar.',en:'Mix engineer for detailed modern vocals and powerful low end. Available remotely or in person.'}},
 {id:'finn-audio',category:'engineer',name:'Finn Audio',city:'Berlin',image:'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=900&q=85',rating:4.90,reviews:68,distance:'4.1 km',price:95,instant:true,top:false,genres:['Rock','Indie','Pop'],meta:{de:'Recording & Mix Engineer · 47 Credits',en:'Recording & mix engineer · 47 credits'},tags:{de:['Tracking','Mixing','Drums'],en:['Tracking','Mixing','Drums']},about:{de:'Recording und Mixing für Bands, Indie und Pop. Sehr schnell im Editing und komfortabel mit Live-Setups.',en:'Recording and mixing for bands, indie and pop. Fast editing and very comfortable with live setups.'}},
 {id:'nia-words',category:'songwriter',name:'Nia Words',city:'Berlin',image:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85',rating:4.95,reviews:61,distance:'3.6 km',price:160,instant:true,top:true,genres:['Pop','R&B','Soul'],meta:{de:'Songwriter · Topliner · 31 Credits',en:'Songwriter · Topliner · 31 credits'},tags:{de:['Lyrics','Topline','Vocal Demo'],en:['Lyrics','Topline','Vocal demo']},about:{de:'Songwriterin und Toplinerin für Pop, R&B und Soul. Fokus auf starke Hooks, klare Story und singbare Melodien.',en:'Songwriter and topliner for pop, R&B and soul, focused on strong hooks, clear stories and singable melodies.'}},
 {id:'omar-lines',category:'songwriter',name:'Omar Lines',city:'Berlin',image:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=85',rating:4.89,reviews:44,distance:'7.2 km',price:130,instant:false,top:false,genres:['Hip-Hop','R&B','Afrobeats'],meta:{de:'Songwriter · Rap · 22 Credits',en:'Songwriter · Rap · 22 credits'},tags:{de:['Lyrics','Hooks','Co-writing'],en:['Lyrics','Hooks','Co-writing']},about:{de:'Co-Writer für Hip-Hop, R&B und Afrobeats mit Fokus auf Hooks, Storytelling und Artist Voice.',en:'Co-writer for hip-hop, R&B and Afrobeats focused on hooks, storytelling and artist voice.'}},
 {id:'luca-guitar',category:'session',name:'Luca V.',city:'Berlin',image:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85',rating:4.92,reviews:37,distance:'5.8 km',price:90,instant:true,top:false,genres:['Pop','Indie','Soul'],meta:{de:'Gitarre · Bass · Remote Recording',en:'Guitar · Bass · Remote recording'},tags:{de:['Guitar','Bass','Remote'],en:['Guitar','Bass','Remote']},about:{de:'Session-Gitarrist und Bassist für Pop, Indie und Soul. Liefert cleane DI-Spuren oder kommt direkt ins Studio.',en:'Session guitarist and bassist for pop, indie and soul. Delivers clean DI tracks or joins you directly in the studio.'}}
];

let lang=localStorage.getItem('audora-lang')||((navigator.language||'de').toLowerCase().startsWith('de')?'de':'en');
let activeCategory='studio';
let activeFilter='recommended';
let favorites=new Set();
let compare=new Set();
let builderStep=1;
let currentProfile=null;

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const t=(path)=>path.split('.').reduce((o,k)=>o&&o[k],window.I18N[lang])||path;

function applyBrand(){ $$('[data-brand]').forEach(el=>el.textContent=BRAND.name); }
function applyLanguage(){
 document.documentElement.lang=lang;
 document.title=lang==='de'?`${BRAND.name} — Deine perfekte Session`:`${BRAND.name} — Build your perfect session`;
 $$('[data-i18n]').forEach(el=>{const value=t(el.dataset.i18n);if(value!==el.dataset.i18n)el.textContent=value});
 $$('[data-i18n-html]').forEach(el=>{const value=t(el.dataset.i18nHtml);if(value!==el.dataset.i18nHtml)el.innerHTML=value});
 $$('[data-i18n-placeholder]').forEach(el=>{const value=t(el.dataset.i18nPlaceholder);if(value!==el.dataset.i18nPlaceholder)el.placeholder=value});
 $('#currentLanguage').textContent=lang.toUpperCase();
 $$('#languageMenu [data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
 renderListings();
 updateCompareBar();
 if(currentProfile&&$('#profileModal').classList.contains('open')) openProfile(currentProfile);
}

function localizedType(category){
 const map={studio:'types.studio',producer:'types.producer',engineer:'types.engineer',songwriter:'types.songwriter',session:'types.sessionMusicians'};
 return t(map[category]);
}
function priceUnit(item){ return item.category==='studio'?t('card.perHour'):''; }
function listingPool(){
 let pool=activeCategory==='all'?listings:listings.filter(x=>x.category===activeCategory);
 if(activeFilter==='instant') pool=pool.filter(x=>x.instant);
 if(activeFilter==='top') pool=pool.filter(x=>x.top);
 if(activeFilter==='budget') pool=pool.filter(x=>x.price<100);
 return pool;
}
function cardTemplate(item){
 const fav=favorites.has(item.id),comp=compare.has(item.id);
 return `<article class="listing-card" data-id="${item.id}">
   <div class="listing-image">
    <img src="${item.image}" alt="${item.name}" loading="lazy"><div class="listing-overlay"></div>
    <div class="listing-top"><span class="${item.instant?'instant-badge':'verified-badge'}"><span class="status-dot"></span>${item.instant?t('card.available'):t('card.verified')}</span><button class="favorite-button ${fav?'active':''}" data-favorite="${item.id}" aria-label="Favorite"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg></button></div>
    <div class="listing-bottom"><div class="listing-genre">${item.genres.slice(0,2).map(g=>`<span>${g}</span>`).join('')}</div><button class="audio-preview" data-audio="${item.id}" aria-label="${t('card.preview')}"><svg viewBox="0 0 24 24"><path d="m9 7 8 5-8 5Z"/></svg></button></div>
   </div>
   <div class="listing-body">
    <div class="listing-title-row"><h3>${item.name}</h3><span>★ ${item.rating.toFixed(2)}</span></div>
    <div class="listing-meta">${item.meta[lang]} · ${item.distance} ${t('card.away')}</div>
    <div class="listing-tags">${item.tags[lang].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="listing-footer"><div class="listing-price"><small>${t('card.from')}</small><strong>€${item.price} ${priceUnit(item)}</strong></div><div class="listing-actions"><button class="compare-toggle ${comp?'selected':''}" data-compare="${item.id}">⇄ ${t('card.compare')}</button><button class="view-button" data-view="${item.id}">${t('card.view')}</button></div></div>
   </div>
  </article>`;
}
function renderListings(){
 const grid=$('#marketGrid'); if(!grid)return;
 const pool=listingPool();
 grid.innerHTML=(pool.length?pool:listings.filter(x=>x.category===activeCategory)).slice(0,6).map(cardTemplate).join('');
 bindCardEvents();
}
function bindCardEvents(){
 $$('[data-favorite]').forEach(btn=>btn.onclick=(e)=>{e.stopPropagation();toggleFavorite(btn.dataset.favorite)});
 $$('[data-compare]').forEach(btn=>btn.onclick=(e)=>{e.stopPropagation();toggleCompare(btn.dataset.compare)});
 $$('[data-view]').forEach(btn=>btn.onclick=()=>openProfile(btn.dataset.view));
 $$('[data-audio]').forEach(btn=>btn.onclick=(e)=>{e.stopPropagation();btn.classList.toggle('playing');btn.innerHTML=btn.classList.contains('playing')?'<svg viewBox="0 0 24 24"><path d="M8 7h3v10H8zM14 7h3v10h-3z"/></svg>':'<svg viewBox="0 0 24 24"><path d="m9 7 8 5-8 5Z"/></svg>'});
}
function toggleFavorite(id){
 if(favorites.has(id)){favorites.delete(id);showToast(t('card.removedFavorite'))}else{favorites.add(id);showToast(t('card.addedFavorite'))}
 $('#favoriteCount').textContent=favorites.size;renderListings();
}
function toggleCompare(id){
 if(compare.has(id))compare.delete(id);else if(compare.size>=3){showToast(t('card.maxCompare'));return}else{compare.add(id);showToast(t('card.addedCompare'))}
 updateCompareBar();renderListings();
}
function updateCompareBar(){
 const bar=$('#compareBar'); if(!bar)return;
 $('#compareText').textContent=`${compare.size} / 3`;
 bar.classList.toggle('open',compare.size>0);
 const selected=[...compare].map(id=>listings.find(x=>x.id===id)).filter(Boolean);
 $('#compareThumbs').innerHTML=selected.map(x=>`<img src="${x.image}" alt="${x.name}">`).join('')+Array.from({length:Math.max(0,3-selected.length)},()=>'<span class="compare-placeholder"></span>').join('');
}
function openComparison(){
 const selected=[...compare].map(id=>listings.find(x=>x.id===id)).filter(Boolean);
 if(!selected.length)return;
 currentProfile=null;
 $('#profileContent').innerHTML=`<span class="kicker">${t('compare.label')}</span><h2 style="font-size:34px;margin:8px 0 22px">${t('compare.title')}</h2><div style="display:grid;grid-template-columns:repeat(${selected.length},1fr);gap:10px">${selected.map(x=>`<div style="border:1px solid var(--line);border-radius:16px;padding:10px"><img src="${x.image}" alt="${x.name}" style="width:100%;height:150px;object-fit:cover;border-radius:12px"><h3 style="font-size:16px;margin-top:12px">${x.name}</h3><p style="font-size:10px;color:var(--muted)">${x.meta[lang]}</p><div class="profile-tags">${x.tags[lang].map(a=>`<span>${a}</span>`).join('')}</div><p style="font-size:10px">★ ${x.rating.toFixed(2)} · ${x.reviews} ${t('card.reviews')}</p><strong style="font-size:20px">€${x.price} ${priceUnit(x)}</strong></div>`).join('')}</div>`;
 openModal('#profileModal');
}
function openProfile(id){
 const item=listings.find(x=>x.id===id);if(!item)return; currentProfile=id;
 $('#profileContent').innerHTML=`<div class="profile-hero"><img src="${item.image}" alt="${item.name}"><div class="profile-hero-info"><small>${localizedType(item.category)} · ${item.city}</small><h2>${item.name}</h2><small>★ ${item.rating.toFixed(2)} · ${item.reviews} ${t('card.reviews')} · ${item.distance} ${t('card.away')}</small></div></div>
 <div class="profile-body-grid"><div class="profile-about"><h3>${item.category==='studio'?t('profile.aboutStudio'):t('profile.aboutPro')}</h3><p>${item.about[lang]}</p><h3 style="margin-top:20px">${t('profile.includes')}</h3><div class="profile-tags">${[...item.genres,...item.tags[lang]].map(x=>`<span>${x}</span>`).join('')}</div></div><aside class="profile-book"><small>${t('profile.price')}</small><strong>€${item.price} ${priceUnit(item)}</strong><p style="font-size:9px;color:var(--muted)">${t('profile.availability')}<br><b style="color:var(--mint)">${item.instant?t('profile.slot'):'—'}</b></p><button class="button button-primary" data-profile-book>${t('profile.book')}</button><p style="font-size:8px;color:#6f6976;line-height:1.5">${t('profile.demoNotice')}</p></aside></div>`;
 openModal('#profileModal');
 $('[data-profile-book]').onclick=()=>{closeModal('#profileModal');openBuilder()};
}

function openModal(sel){$(sel).classList.add('open');$(sel).setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
function closeModal(sel){$(sel).classList.remove('open');$(sel).setAttribute('aria-hidden','true');if(!$('.modal-backdrop.open'))document.body.classList.remove('modal-open')}
function openBuilder(){builderStep=1;updateBuilder();openModal('#builderModal')}
function updateBuilder(){
 $$('.builder-step').forEach((el,i)=>el.classList.toggle('active',i===builderStep-1));
 $$('.builder-progress span').forEach((el,i)=>el.classList.toggle('active',i<=builderStep-1));
 $('#builderBack').style.visibility=builderStep===1?'hidden':'visible';
 const next=$('#builderNext');next.querySelector('span').textContent=builderStep===3?t('wizard.finish'):t('wizard.next');
}
function showToast(message){const toast=$('#toast');toast.querySelector('p').textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2200)}

function setupInteractions(){
 applyBrand();
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);$('#heroDate').value=tomorrow;$$('.wizard-fields input[type="date"]').forEach(x=>x.value=tomorrow);
 $('#languageButton').onclick=()=>{$('#languageMenu').classList.toggle('open');$('#languageButton').setAttribute('aria-expanded',$('#languageMenu').classList.contains('open'))};
 $$('#languageMenu [data-lang]').forEach(btn=>btn.onclick=()=>{lang=btn.dataset.lang;localStorage.setItem('audora-lang',lang);$('#languageMenu').classList.remove('open');applyLanguage();showToast(t('toast.language'))});
 document.addEventListener('click',e=>{if(!e.target.closest('.language-switcher'))$('#languageMenu').classList.remove('open')});

 $$('.category-card').forEach(btn=>btn.onclick=()=>{activeCategory=btn.dataset.category;activeFilter='recommended';$$('.category-card').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$$('.filter-pill').forEach(x=>x.classList.toggle('active',x.dataset.filter==='recommended'));renderListings()});
 $$('.filter-pill').forEach(btn=>btn.onclick=()=>{activeFilter=btn.dataset.filter;$$('.filter-pill').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderListings()});
 $$('.search-tabs button').forEach(btn=>btn.onclick=()=>{$$('.search-tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const c=btn.dataset.searchType;activeCategory=c;const categoryBtn=$(`.category-card[data-category="${c}"]`);if(categoryBtn){$$('.category-card').forEach(x=>x.classList.remove('active'));categoryBtn.classList.add('active')}renderListings()});
 $('#mapToggle').onclick=()=>{$('.market-layout').classList.toggle('map-open')};
 $('#heroSearch').onclick=()=>{const c=$('.search-tabs button.active').dataset.searchType;activeCategory=c;renderListings();$('#discover').scrollIntoView({behavior:'smooth'});showToast(t('toast.search'))};
 $('#showMore').onclick=()=>showToast(t('toast.more'));
 $('#favoriteHeader').onclick=()=>{activeCategory='all';activeFilter='recommended';const pool=listings.filter(x=>favorites.has(x.id));$('#marketGrid').innerHTML=pool.length?pool.map(cardTemplate).join(''):`<p style="color:var(--muted)">${lang==='de'?'Noch keine Favoriten gespeichert.':'No favorites saved yet.'}</p>`;bindCardEvents();$('#discover').scrollIntoView({behavior:'smooth'})};

 $('#budgetRange').oninput=e=>$('#budgetValue').textContent=`€${e.target.value}`;
 $('#generateMatch').onclick=()=>{const city=$('#matchCity').value,genre=$('#matchGenre').value;$('#matchResultTitle').textContent=`${genre} Session · ${city}`;$('#matchResult').animate([{transform:'scale(.97)',opacity:.6},{transform:'scale(1)',opacity:1}],{duration:350,easing:'ease-out'});showToast(t('toast.match'))};

 $$('[data-open-builder]').forEach(btn=>btn.onclick=(e)=>{if(btn.tagName==='A')e.preventDefault();openBuilder()});
 $$('[data-close-modal]').forEach(btn=>btn.onclick=()=>closeModal('#builderModal'));
 $('[data-profile-close]').onclick=()=>closeModal('#profileModal');
 $$('.modal-backdrop').forEach(back=>back.addEventListener('click',e=>{if(e.target===back)closeModal(`#${back.id}`)}));
 $$('.goal-grid button').forEach(btn=>btn.onclick=()=>{$$('.goal-grid button').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected')});
 $$('#vibeSelect button').forEach(btn=>btn.onclick=()=>btn.classList.toggle('selected'));
 $('#builderBack').onclick=()=>{if(builderStep>1){builderStep--;updateBuilder()}};
 $('#builderNext').onclick=()=>{if(builderStep<3){builderStep++;updateBuilder()}else{closeModal('#builderModal');showToast(t('toast.booked'))}};
 $('#compareClose').onclick=()=>{compare.clear();updateCompareBar();renderListings()};
 $('#compareButton').onclick=openComparison;

 $('#aiAssistant').onclick=()=>$('#assistantPopover').classList.toggle('open');
 $('#assistantClose').onclick=()=>$('#assistantPopover').classList.remove('open');
 $$('.assistant-suggestions button').forEach(btn=>btn.onclick=()=>{const input=$('.assistant-input input');input.value=btn.textContent;showToast(t('toast.assistant'))});
 $('.assistant-input button').onclick=()=>{if($('.assistant-input input').value.trim()){showToast(t('toast.assistant'));$('.assistant-input input').value=''}};
 $('.assistant-input input').addEventListener('keydown',e=>{if(e.key==='Enter')$('.assistant-input button').click()});

 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.08});$$('.reveal').forEach(el=>observer.observe(el));
}

document.addEventListener('DOMContentLoaded',()=>{setupInteractions();applyLanguage();renderListings();updateBuilder()});
