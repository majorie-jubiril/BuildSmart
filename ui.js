/* Presentation only: no storage writes or lifecycle/financial calculations. */
(() => {
  const paths={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',projects:'M3 5h7l2 3h9v13H3Z',workspace:'M4 3h16v18H4Zm4 5h8M8 12h8M8 16h5',estimate:'M5 3h14v18H5Zm3 4h8M8 11h1m5 0h1m-7 4h1m5 0h1',expenses:'M3 6h18v14H3Zm0 4h18m-6 5h3',contractors:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-4m-1-12a4 4 0 0 1 0 8',saved:'M6 3h12v19l-6-4-6 4Z',account:'M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8'};
  function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.workspace}"/></svg>`;}
  const file=(location.pathname.split('/').pop()||'index').replace(/\.html$/,'')+'.html';
  paths.photo='M3 6h5l2-3h4l2 3h5v15H3Zm9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8';
  paths.search='M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14';
  paths.foundation='m16 3 5 5-4 4-5-5Zm-2 6-9 9m-2-3 6 6m-6-6-1 7 7-1';
  paths.structure='M3 21V8h6v13m0-18h8v18m0-10h4v10M2 21h20M5 11h1m-1 4h1m6-9h2m-2 4h2m-2 4h2m-2 4h2';
  paths.roofing='m2 13 10-10 10 10M5 11v10h14V11m-10 10v-7h6v7';
  paths.windows='M4 3h16v18H4Zm8 0v18M4 12h16';
  paths.finishing='M3 3h14v7H3Zm14 3h4v9h-9v7H9v-9h9V8';
  const pages=[['index.html','Home','home'],['projects.html','Projects','projects'],['estimate-result.html','Construction plan','workspace'],['estimator.html','Estimator','estimate'],['expenditure.html','Expenses','expenses'],['contractors.html','Contractors','contractors'],['saved.html','Saved','saved'],['account.html','Account','account']];
  const title=file==='create-project.html'?'Create project':pages.find(x=>x[0]===file)?.[1]||document.title;
  const shell=document.createElement('div');shell.className='app-shell';
  shell.innerHTML=`<a class="skip-link" href="#mainContent">Skip to content</a><aside class="app-sidebar" id="appNavigation"><a class="app-brand" href="index.html"><span class="brand-mark">${icon('home')}</span><span>BuildSmart GH<span class="brand-country">Plan · Track · Build with confidence</span></span></a><nav aria-label="Main navigation">${pages.map(([href,label,key])=>`<a href="${href}" ${file===href?'aria-current="page"':''}>${icon(key)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-note">Clarity at every stage.<br><small>Your construction workspace</small></div></aside><header class="app-topbar"><button class="menu-toggle" type="button" aria-controls="appNavigation" aria-expanded="false" aria-label="Open navigation">☰</button><form class="topbar-search" action="index.html" role="search">${icon('search')}<input type="search" name="q" aria-label="Search current project tasks" placeholder="Search your project's tasks…"></form><span class="topbar-title">${title}</span><a class="account-shortcut" href="account.html">${icon('account')}<span>Your account</span></a><a class="topbar-action" href="create-project.html">+ New project</a></header>`;
  document.body.prepend(shell);document.body.classList.add('premium-app');
  const main=document.querySelector('main')||document.querySelector('body > .container');if(main){main.id='mainContent';main.setAttribute('tabindex','-1');}
  const toggle=shell.querySelector('.menu-toggle');
  function close(){document.body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation');}
  toggle.onclick=()=>{const open=document.body.classList.toggle('nav-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open')){close();toggle.focus();}});
  document.addEventListener('click',e=>{if(!shell.contains(e.target))close();});
  let taskFilter='all';
  const search=shell.querySelector('input[type="search"]');
  search.value=new URLSearchParams(location.search).get('q')||'';
  if(file==='index.html'){
    search.addEventListener('input',()=>{observer.disconnect();refreshOverview();observer.observe(document.body,{childList:true,subtree:true});});
    shell.querySelector('.topbar-search').addEventListener('submit',event=>{event.preventDefault();document.getElementById('overviewTasks')?.scrollIntoView({block:'center'});});
    document.querySelectorAll('[data-task-filter]').forEach(button=>button.addEventListener('click',()=>{taskFilter=button.dataset.taskFilter;document.querySelectorAll('[data-task-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));observer.disconnect();refreshOverview();observer.observe(document.body,{childList:true,subtree:true});}));
  }
  // Replace decorative emoji with consistent line icons, keeping all semantic text.
  function polish(root){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(n.parentElement.closest('.action-icon,.action-header,.toggle-header,.insight-card h3,.insight-card h4,#recommendationList,#projectInsightList,.task-intelligence,.quick-actions h3')&&!n.parentElement.closest('input,textarea')){const clean=n.textContent.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'');if(clean!==n.textContent)n.textContent=clean;}});
    root.querySelectorAll?.('.action-card[onclick],.insights-toggle,.toggle-header').forEach(el=>{if(el.tagName==='BUTTON')return;el.tabIndex=0;el.setAttribute('role','button');if(el.matches('.toggle-header'))el.setAttribute('aria-expanded',String(el.parentElement.classList.contains('active')));if(!el.dataset.keyboardReady){el.dataset.keyboardReady='1';el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});if(el.matches('.toggle-header'))el.addEventListener('click',()=>el.setAttribute('aria-expanded',String(el.parentElement.classList.contains('active'))));if(el.matches('.insights-toggle')){el.setAttribute('aria-expanded','false');el.setAttribute('aria-controls','projectInsights');el.addEventListener('click',()=>{const open=document.getElementById('projectInsights')?.classList.toggle('ui-open');el.setAttribute('aria-expanded',String(!!open));});}}});
    root.querySelectorAll?.('.action-icon').forEach((el,i)=>{if(!el.querySelector('svg'))el.innerHTML=icon(['projects','estimate','contractors','workspace'][i%4]);});
    root.querySelectorAll?.('[data-icon]').forEach(el=>{if(!el.querySelector('svg'))el.innerHTML=icon(el.dataset.icon);});
    root.querySelectorAll?.('input,select,textarea').forEach(el=>{if(!el.labels?.length&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.placeholder||el.id.replace(/([A-Z])/g,' $1')||'Input');});
  }
  polish(document.body);
  let queued=false;
  const observer=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{observer.disconnect();polish(document.body);refreshOverview();observer.observe(document.body,{childList:true,subtree:true});queued=false;});}});
  let photoKey='',photoVersion=0;
  const photoUrls=new Set();
  window.addEventListener('pagehide',()=>photoUrls.forEach(url=>URL.revokeObjectURL(url)));
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
  function renderPhotos(state,tasks){
    const target=document.getElementById('overviewPhotos');if(!target)return;
    const images=tasks.flatMap(task=>(Array.isArray(task.evidence)?task.evidence:[]).filter(file=>file&&['image/jpeg','image/png','image/webp'].includes(file.type)).map(file=>({file,task}))).slice(-5).reverse();
    const key=JSON.stringify([state?.id,images.map(x=>[x.file.id,x.file.sha256])]);if(key===photoKey)return;photoKey=key;const version=++photoVersion;
    photoUrls.forEach(url=>URL.revokeObjectURL(url));photoUrls.clear();target.replaceChildren();
    if(!images.length){const empty=node('div',undefined,'photo-empty');empty.innerHTML=icon('photo');empty.append(node('strong','Your build, documented'),node('p','No progress photos saved yet. Add evidence to a task to see it here.'));target.append(empty);}
    for(const {file,task} of images){
      const tile=node('a',undefined,'progress-photo');tile.href=`estimate-result.html?stage=${encodeURIComponent(task.stageId)}`;
      const preview=node('div','Loading photo…','photo-preview');tile.append(preview,node('strong',task.name));
      if(Number.isFinite(Date.parse(file.createdAt)))tile.append(node('small',new Date(file.createdAt).toLocaleDateString('en-GB')));
      target.append(tile);
      EvidenceStore.get(file.id,{projectId:state.id,stageId:task.stageId,taskId:task.id}).then(record=>{if(version!==photoVersion)return;const url=URL.createObjectURL(record.blob);photoUrls.add(url);const img=node('img');img.src=url;img.alt=`Progress evidence for ${task.name}`;img.onerror=()=>{URL.revokeObjectURL(url);photoUrls.delete(url);preview.textContent='Photo unavailable in this browser';};preview.replaceChildren(img);}).catch(()=>{if(version===photoVersion)preview.textContent='Photo unavailable in this browser';});
    }
    const add=node('a',undefined,'add-photos');add.href='estimate-result.html';add.innerHTML=icon('photo');add.append(node('strong','Add photos'),node('small','Attach to a task'));target.append(add);
  }
  function refreshOverview(){
    if(file!=='index.html')return;
    const state=typeof projectState!=='undefined'?projectState:null;
    const loc=document.getElementById('overviewLocation');if(loc)loc.textContent=state?.location||state?.estimate?.location||'Location not recorded';
    const target=document.getElementById('overviewTasks'),activity=document.getElementById('overviewActivity');if(!target)return;
    const tasks=(state?.stages||[]).flatMap(s=>(s.tasks||[]).map(t=>({...t,stage:s.name,stageId:s.id})));
    const summary=Construction.summary(state);
    document.getElementById('heroTaskCount').textContent=`${summary.completed} of ${summary.total} tasks completed`;
    const ordered=TaskNavigation.ordered(state),unfinished=ordered.filter(x=>x.task.status!=='completed');
    const active=tasks.filter(t=>t.status==='active');
    document.getElementById('nextTaskLabel').textContent=unfinished[0]?.task.name||(state?'All recorded tasks completed':'Create or select a project');
    const nextLink=document.querySelector('.next-step-card');
    if(nextLink){nextLink.href=unfinished.length?TaskNavigation.taskUrl(state,unfinished[0].stage.id,unfinished[0].task.id):state?TaskNavigation.registerUrl(state):'create-project.html';nextLink.querySelector('strong').textContent=unfinished.length?'Continue Task':state?'View completed tasks':'Create a project';}
    const viewAll=document.getElementById('viewAllTasks');if(viewAll)viewAll.href=state?TaskNavigation.registerUrl(state):'create-project.html';
    for(const [id,count] of [['allTaskCount',unfinished.length],['activeTaskCount',active.length],['completedTaskCount',summary.completed]])document.getElementById(id).textContent=`(${count})`;
    const query=search.value.trim().toLocaleLowerCase();
    const visible=ordered.filter(({task:t})=>(taskFilter==='all'?t.status!=='completed':t.status===taskFilter)&&(!query||`${t.name} ${t.stage}`.toLocaleLowerCase().includes(query)));
    function rows(el,items,empty){el.replaceChildren();if(!items.length){const p=document.createElement('p');p.className='ui-empty';p.textContent=empty;el.append(p);}for(const [a,b] of items){const row=document.createElement('div');row.className='overview-row';const name=document.createElement('strong'),meta=document.createElement('span');name.textContent=a;meta.textContent=b;row.append(name,meta);el.append(row);}}
    target.replaceChildren();
    if(!visible.length)target.append(node('p',!state?'Create or select a project to see your tasks.':summary.isCompleted&&taskFilter!=='completed'?'All project tasks are completed. Choose Completed or View All Tasks to review your work.':'No tasks match this view.','ui-empty'));
    for(const {task:stored,stage} of visible.slice(0,5)){
      const task={...stored,stage:stage.name,stageId:stage.id};
      const row=node('a',undefined,`dashboard-task-row ${task.status}`);row.href=TaskNavigation.taskUrl(state,task.stageId,task.id);
      const marker=node('span',task.status==='completed'?'✓':'','task-marker'),body=node('span',undefined,'task-row-body'),badge=node('span',Construction.LABELS[task.status]||'Not Started','task-status-badge');
      body.append(node('strong',task.name),node('small',task.stage));row.append(marker,body,badge,node('span','›','task-chevron'));target.append(row);
    }
    for(const stage of summary.stages){
      const button=[...document.querySelectorAll('#stageTracker [data-stage-id]')].find(el=>el.dataset.stageId===stage.id);if(!button)continue;
      if(!button.querySelector('.ui-stage-icon')){const glyph=node('span',undefined,'ui-stage-icon');glyph.innerHTML=icon(stage.id);button.prepend(glyph);button.append(node('span',undefined,'ui-stage-bar'),node('span',undefined,'ui-stage-count'));}
      button.querySelector('span:not([class])').textContent=stage.label;
      button.querySelector('.ui-stage-bar').style.setProperty('--stage-progress',`${stage.percent}%`);
      button.querySelector('.ui-stage-count').textContent=`${stage.completed} / ${stage.total} tasks`;
    }
    const finances=Financials.calculate(state||{}),percent=finances.available&&finances.budget>0?Math.round(finances.spent/finances.budget*100):null;
    document.getElementById('budgetSpentPercent').textContent=percent===null?'—':`${percent}%`;
    document.getElementById('budgetRing').style.setProperty('--spent',`${Math.min(100,Math.max(0,percent||0))}%`);
    document.getElementById('dashboardBudget').textContent=Financials.format(finances.budget);
    document.getElementById('dashboardBalance').textContent=Financials.format(finances.remaining===null?null:Math.abs(finances.remaining));
    document.getElementById('budgetBalanceCaption').textContent=finances.remaining<0?'Over budget':'Remaining budget';
    document.getElementById('budgetEmptyState').textContent=!state?'Select a project to view its budget.':!finances.available?'Recorded expense totals are unavailable. Review the ledger.':!finances.budget?'No planned budget recorded yet.':'';
    const events=tasks.flatMap(t=>[
      {date:t.completedAt,label:`Completed ${t.name}`},{date:t.startDate,label:`Started ${t.name}`},{date:t.notesUpdatedAt,label:`Updated notes: ${t.name}`},
      ...(Array.isArray(t.evidence)?t.evidence:[]).filter(Boolean).map(e=>({date:e.createdAt,label:`Added evidence: ${t.name}`}))
    ]).concat((Array.isArray(state?.expenses)?state.expenses:[]).map(e=>({date:e.createdAt,label:`Expense recorded: ${e.description}`}))).filter(e=>Number.isFinite(Date.parse(e.date))).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,4);
    rows(activity,events.map(e=>[e.label,new Date(e.date).toLocaleDateString('en-GB')]),'No dated activity recorded yet. Your saved task and expense updates will appear here.');
    renderPhotos(state,tasks);
    window.ProjectExperience?.refresh();
  }
  refreshOverview();observer.observe(document.body,{childList:true,subtree:true});
})();
