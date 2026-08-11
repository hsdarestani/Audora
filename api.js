/* Audora backend bridge — keeps the polished frontend while persisting real state. */
(() => {
  const API = {
    async request(path, options={}) {
      const opts={credentials:'same-origin',headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(options.headers||{})},...options};
      const response=await fetch(`/api${path}`,opts);
      let data={};
      try{data=await response.json()}catch(_e){}
      if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
      return data;
    },
    bootstrap(){return this.request('/bootstrap/')},
    listings(){return this.request('/listings/')},
    favorite(id, active){return this.request(`/favorites/${encodeURIComponent(id)}/`,{method:active?'POST':'DELETE',body:active?JSON.stringify({toggle:false}):undefined})},
    createSession(payload){return this.request('/sessions/',{method:'POST',body:JSON.stringify(payload)})},
    session(id){return this.request(`/sessions/${id}/`)},
    task(id,done){return this.request(`/tasks/${id}/`,{method:'PATCH',body:JSON.stringify({done})})},
    upload(sessionId,file){const form=new FormData();form.append('file',file);return this.request(`/sessions/${sessionId}/files/`,{method:'POST',body:form})},
    conversations(){return this.request('/conversations/')},
    conversation(id){return this.request(`/conversations/${id}/`)},
    message(id,text){return this.request(`/conversations/${id}/`,{method:'POST',body:JSON.stringify({text})})},
    conversationForListing(slug){return this.request(`/conversations/listing/${encodeURIComponent(slug)}/`,{method:'POST',body:'{}'})},
    notifications(){return this.request('/notifications/')},
    readNotifications(){return this.request('/notifications/',{method:'PATCH',body:JSON.stringify({all:true})})},
    provider(active){return this.request('/provider/dashboard/',{method:'PATCH',body:JSON.stringify({active})})},
    match(payload){return this.request('/match/',{method:'POST',body:JSON.stringify(payload)})},
  };
  window.AudoraAPI=API;

  const localizedDate=(iso)=>{
    if(!iso)return {de:'Termin offen',en:'Date open'};
    const d=new Date(iso);
    if(Number.isNaN(d.getTime()))return {de:iso,en:iso};
    return {
      de:new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d),
      en:new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d)
    };
  };

  const appSession=(s)=>({
    id:s.id,state:s.state,title:s.title,date:localizedDate(s.date),place:s.place,status:s.status,image:s.image,
    team:(s.team||[]).map(x=>x.id),total:s.total||0,server:true
  });

  const appConversation=(c)=>({
    id:c.id,name:c.name,image:c.image||'',preview:{de:c.preview||'',en:c.preview||''},time:formatTime(c.time),
    messages:(c.messages||[]).map(m=>({me:m.me,de:m.text,en:m.text,time:formatTime(m.time)})),server:true
  });

  function formatTime(value){
    if(!value)return '';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return value;
    return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }

  function notifyError(err){
    console.error('[Audora API]',err);
    try{showToast(lang==='de'?'Server-Verbindung fehlgeschlagen. Bitte erneut versuchen.':'Server connection failed. Please try again.')}catch(_e){}
  }

  let serverNotifications=[];
  let currentServerSession=null;

  async function hydrate(){
    try{
      const [boot,listingData]=await Promise.all([API.bootstrap(),API.listings()]);
      if(Array.isArray(listingData.results)&&listingData.results.length){
        listings.splice(0,listings.length,...listingData.results);
      }
      favorites.clear();(boot.favorites||[]).forEach(id=>favorites.add(id));
      localStorage.removeItem('audora-favorites');
      if(Array.isArray(boot.sessions)&&boot.sessions.length){sessions.splice(0,sessions.length,...boot.sessions.map(appSession));}
      if(Array.isArray(boot.conversations)&&boot.conversations.length){
        conversations.splice(0,conversations.length,...boot.conversations.map(appConversation));
        activeChat=conversations[0]?.id||activeChat;
      }
      providerMode=!!boot.provider_mode;
      serverNotifications=boot.notifications||[];
      renderHome();renderDiscover();renderSaved();renderSessions();renderConversations();renderChat();updateFavoriteCounts();syncProviderUI();renderNotifications();
      document.body.dataset.backend='online';
    }catch(err){document.body.dataset.backend='offline';notifyError(err)}
  }

  function renderNotifications(){
    const list=document.querySelector('#notificationPanel .notification-list');
    if(!list||!serverNotifications.length)return;
    list.innerHTML=serverNotifications.map(n=>`<button data-notification-id="${n.id}"><span class="activity-icon ${n.read?'':'purple'}">${n.read?'✓':'•'}</span><p><strong>${escapeHTML(n.title?.[lang]||'')}</strong><small>${escapeHTML(n.text?.[lang]||'')}</small></p></button>`).join('');
    const unread=serverNotifications.filter(n=>!n.read).length;
    const badge=document.querySelector('.notification-badge');if(badge){badge.textContent=unread;badge.style.display=unread?'grid':'none'}
  }

  const originalToggleFavorite=toggleFavorite;
  toggleFavorite=async function(id){
    const shouldAdd=!favorites.has(id);
    originalToggleFavorite(id);
    try{await API.favorite(id,shouldAdd)}catch(err){originalToggleFavorite(id);notifyError(err)}
  };

  const originalConfirm=confirmDemoBooking;
  confirmDemoBooking=async function(){
    const city=$('#buildCity')?.value||'Berlin';
    const dateValue=document.querySelector('#buildDate')?.value||document.querySelector('.builder-fields input[type=date]')?.value;
    let startAt=null;
    if(dateValue){const d=new Date(`${dateValue}T20:00:00`);if(!Number.isNaN(d.getTime()))startAt=d.toISOString()}
    const payload={
      title:lang==='de'?'Neue Audora Session':'New Audora Session',goal:builderGoal||'record',city,
      genres:[...selectedGenres],budget:Number($('#budgetRange')?.value||1000),duration_hours:3,start_at:startAt,status:'confirmed'
    };
    try{
      const created=await API.createSession(payload);
      sessions.unshift(appSession(created));
      showToast(t('toast.booked'));go('sessions');activeSessionFilter='upcoming';syncSessionTabs();renderSessions();
    }catch(err){notifyError(err)}
  };

  messageListing=async function(id){
    try{
      const c=await API.conversationForListing(id);
      let existing=conversations.find(x=>x.id===c.id);
      if(!existing){existing=appConversation(c);conversations.unshift(existing)}
      activeChat=c.id;go('inbox');renderConversations();renderChat();
      if($('#chatPanel'))$('#chatPanel').classList.add('mobile-open');
    }catch(err){notifyError(err)}
  };

  sendMessage=async function(text,target='main'){
    const value=(text||'').trim();if(!value)return;
    const chat=conversations.find(c=>c.id===activeChat);
    if(!chat){notifyError(new Error('conversation_not_found'));return}
    const optimistic={me:true,de:value,en:value,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
    chat.messages.push(optimistic);chat.preview={de:value,en:value};renderConversations();renderChat();
    try{
      const saved=await API.message(activeChat,value);
      optimistic.time=formatTime(saved.time);showToast(t('toast.message'));
    }catch(err){chat.messages=chat.messages.filter(x=>x!==optimistic);renderChat();notifyError(err)}
  };

  const originalToggleProvider=toggleProvider;
  toggleProvider=async function(){
    providerMode=!providerMode;syncProviderUI();
    try{await API.provider(providerMode);showToast(t(providerMode?'toast.providerOn':'toast.providerOff'))}catch(err){providerMode=!providerMode;syncProviderUI();notifyError(err)}
  };

  const originalOpenSessionRoom=openSessionRoom;
  openSessionRoom=async function(id){
    const session=sessions.find(x=>x.id===id);
    if(!session?.server){originalOpenSessionRoom(id);return}
    const room=$('#sessionRoom');room.dataset.session=id;room.classList.add('open');room.setAttribute('aria-hidden','false');roomTab='overview';syncRoomTabs();
    try{currentServerSession=await API.session(id);renderSessionRoom(currentServerSession)}catch(err){closeSessionRoom();notifyError(err)}
  };

  renderSessionRoom=function(sessionArg){
    const box=$('#roomContent');if(!box)return;
    const s=sessionArg||currentServerSession;if(!s)return;
    currentServerSession=s;
    const team=[...(s.studio?[s.studio]:[]),...(s.team||[])];
    if(roomTab==='overview'){
      box.innerHTML=`<small>${t('room.overview')}</small><h3>${escapeHTML(s.title)}</h3><div class="room-overview-grid"><div class="room-info-card"><small>${t('room.next')}</small><strong>${escapeHTML(localizedDate(s.date)[lang])}</strong></div><div class="room-info-card"><small>${t('room.location')}</small><strong>${escapeHTML(s.place||s.city)}</strong></div><div class="room-info-card"><small>${t('room.team')}</small><strong>${team.length} ${lang==='de'?'Partner':'partners'}</strong></div><div class="room-info-card"><small>${t('room.total')}</small><strong>€${Number(s.total||0).toFixed(0)}</strong></div></div><h3 style="margin-top:18px">${t('room.tasks')}</h3><div class="task-list">${(s.tasks||[]).map(task=>`<div class="task-row"><button class="task-check ${task.done?'done':''}" data-server-task="${task.id}">${task.done?'✓':''}</button><span><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.assignee||'')}</small></span><small>${escapeHTML(task.due||'')}</small></div>`).join('')}</div>`;
    }else if(roomTab==='files'){
      box.innerHTML=`<small>${t('room.files')}</small><h3>${t('room.filesTitle')}</h3><div class="file-list">${(s.files||[]).map(f=>`<div class="file-row"><span>F</span><span><strong>${escapeHTML(f.name)}</strong><small>${Math.max(1,Math.round((f.size||0)/1024))} KB</small></span><a class="secondary-btn" href="${f.url}" target="_blank" rel="noopener">↓</a></div>`).join('')||`<div class="empty-state" style="min-height:160px"><p>${lang==='de'?'Noch keine Dateien hochgeladen.':'No files uploaded yet.'}</p></div>`}</div><label class="primary-btn" style="margin-top:12px;cursor:pointer">＋ ${lang==='de'?'Datei hochladen':'Upload file'}<input type="file" data-session-upload="${s.id}" hidden></label>`;
    }else if(roomTab==='team'){
      box.innerHTML=`<small>${t('room.team')}</small><h3>${t('room.teamTitle')}</h3><div class="room-team-list">${team.map(x=>`<div class="room-team-row"><img src="${x.image}" alt="${escapeHTML(x.name)}"><span><small>${escapeHTML(x.category)}</small><strong>${escapeHTML(x.name)}</strong></span><button class="secondary-btn" data-message-listing="${x.id}">${t('common.message')}</button></div>`).join('')}</div>`;
    }else{
      box.innerHTML=`<small>${t('room.chat')}</small><h3>${t('room.chatTitle')}</h3><div class="empty-state" style="min-height:220px"><span>↗</span><h2>${lang==='de'?'Team-Chat':'Team chat'}</h2><p>${lang==='de'?'Öffne einen Teamkontakt im Inbox-Bereich. Alle Nachrichten werden serverseitig gespeichert.':'Open a team contact in Inbox. All messages are stored on the server.'}</p><button class="primary-btn" data-route="inbox">${lang==='de'?'Inbox öffnen':'Open inbox'}</button></div>`;
    }
  };

  document.addEventListener('click',async e=>{
    const task=e.target.closest('[data-server-task]');
    if(task){e.preventDefault();e.stopImmediatePropagation();const next=!task.classList.contains('done');task.classList.toggle('done',next);task.textContent=next?'✓':'';try{await API.task(task.dataset.serverTask,next)}catch(err){task.classList.toggle('done',!next);task.textContent=!next?'✓':'';notifyError(err)}return}
    const notif=e.target.closest('[data-notification-id]');
    if(notif){try{await API.readNotifications();serverNotifications.forEach(n=>n.read=true);renderNotifications()}catch(err){notifyError(err)}}
  },true);

  document.addEventListener('change',async e=>{
    const input=e.target.closest('[data-session-upload]');if(!input||!input.files?.[0])return;
    input.disabled=true;
    try{await API.upload(input.dataset.sessionUpload,input.files[0]);currentServerSession=await API.session(input.dataset.sessionUpload);renderSessionRoom(currentServerSession);showToast(lang==='de'?'Datei hochgeladen.':'File uploaded.')}catch(err){notifyError(err)}finally{input.disabled=false}
  });

  const originalRunAI=runAI;
  runAI=async function(action){
    if(action!=='build'){originalRunAI(action);return}
    closeAllPanels();builderGoal='record';selectedGenres=new Set(['Hip-Hop']);syncGoalCards();go('build');setBuilderStep(2);updateBuilderSummary();
    try{
      const match=await API.match({goal:builderGoal,city:$('#buildCity')?.value||'Berlin',genres:[...selectedGenres],budget:Number($('#budgetRange')?.value||1000)});
      if(match?.total)$('#summaryTotal').textContent=`€${Math.round(match.total)}`;
      showToast(t('toast.ai'));
    }catch(err){notifyError(err)}
  };

  document.addEventListener('DOMContentLoaded',()=>setTimeout(hydrate,0));
})();
