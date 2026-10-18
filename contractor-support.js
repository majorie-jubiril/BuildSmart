/* Compact optional discovery and association controls; no hiring transaction. */
(() => {
  'use strict';
  const M = ContractorModel;
  let modalGeneration=0;
  const dismissed = new Set();
  const supportKey = (stageId,taskId) => `${projectState?.id}/${stageId}/${taskId}`;
  function reopen(stageId,taskId){dismissed.delete(supportKey(stageId,taskId));}
  const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
  function announce(text){ConstructionUI.message(text);const status=document.getElementById('profileStatus');if(status)status.textContent=text;const target=document.getElementById('taskProfessionalMessage');if(target&&!document.getElementById('taskModal')?.classList.contains('hidden')){target.textContent=text;target.tabIndex=-1;target.focus({preventScroll:true});}}
  const notify = error => announce(error.message || String(error));
  const safeImage = value => typeof value==='string' && /^images\/[a-z0-9 _.-]+\.(jpg|jpeg|png|webp)$/i.test(value) ? value : 'images/default.jpg';
  const glyphs={person:'M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',save:'M6 3h12v19l-6-4-6 4Z',search:'m21 21-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',grid:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',list:'M8 5h13M8 12h13M8 19h13M3 5h1m-1 7h1m-1 7h1',arrow:'m9 5 7 7-7 7',target:'M21 12a9 9 0 1 1-9-9m6 9a6 6 0 1 1-6-6m0 6 9-9m-5 0h5v5',info:'M12 11v6m0-10v1m9 4a9 9 0 1 1-18 0 9 9 0 0 1 18 0',phone:'M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4c0 2-2 3-4 2A22 22 0 0 1 3 7c-1-2 0-4 2-4Z',chat:'M21 11a9 9 0 0 1-13 8l-5 2 1-5a9 9 0 1 1 17-5Z',work:'M3 7h18v14H3Zm5 0V3h8v4M3 12h18m-10 0v3h2v-3'};
  function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',glyphs[name]||glyphs.person);svg.append(path);return svg;}
  function portrait(c,cls='listing-portrait',id){
    const frame=el('div',undefined,cls),fallback=el('span',undefined,'listing-avatar');fallback.append(icon('person'));fallback.setAttribute('role','img');fallback.setAttribute('aria-label','No listing photograph available');frame.append(fallback);
    if(c.image&&safeImage(c.image)===c.image){const image=el('img');if(id)image.id=id;image.alt='Recorded listing image; identity unconfirmed';image.loading='lazy';image.onerror=()=>{image.remove();frame.classList.add('image-unavailable');};image.src=c.image;frame.append(image);}
    return frame;
  }
  function saveControl(c,onchange){const button=el('button',undefined,'save-btn');button.type='button';const update=()=>{const saved=AppState.savedContractors.some(x=>M.identity(x)===M.identity(c));button.replaceChildren(icon('save'),el('span',saved?'Unsave':'Save'));button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',`${saved?'Unsave':'Save'} ${c.name}`);};update();button.onclick=event=>{event.stopImmediatePropagation();toggleSave(c);update();onchange?.();};return button;}
  function openProfile(c, context) {
    if(!beforeNavigate())return;
    context=context||rawContext();
    localStorage.setItem('selectedContractor',JSON.stringify(c));
    const params = new URLSearchParams();
    if(context) { params.set('project',context.projectId); if(context.taskId){params.set('stage',context.stageId);params.set('task',context.taskId);} }
    goTo(`contractor-profile.html${params.size?'?'+params:''}`);
  }
  function beforeNavigate(){const modal=document.getElementById('taskModal');return !modal||modal.classList.contains('hidden')||closeTaskModal();}
  function rawContext(){const params=new URLSearchParams(location.search);return params.get('project')?{projectId:params.get('project'),stageId:params.get('stage'),taskId:params.get('task')}:null;}
  function journeyContext(){
    const params=new URLSearchParams(location.search),projectId=params.get('project');
    if(!projectId||projectState?.id!==projectId)return null;
    const stageId=params.get('stage'),taskId=params.get('task');
    if(stageId||taskId){try{Construction.locate(projectState,stageId,taskId);}catch{return null;}}
    return {projectId,stageId:stageId||null,taskId:taskId||null};
  }
  function contextUrl(page,context,extra={}){
    const params=new URLSearchParams();if(context){params.set('project',context.projectId);if(context.taskId){params.set('stage',context.stageId);params.set('task',context.taskId);}}
    for(const [key,value]of Object.entries(extra))params.set(key,value);
    return `${page}${params.size?'?'+params:''}${page==='estimate-result.html'?'#task-register':''}`;
  }
  function profileLabel(c){return c.profileSource==='sample'?'Sample profile':c.profileSource==='legacy'?'Unconfirmed legacy listing':'Recorded details · unconfirmed';}
  function provenance(c){return el('small',profileLabel(c),'support-provenance');}
  function journey(main){
    if(!main)return;document.getElementById('contractorJourney')?.remove();
    const context=journeyContext(),params=new URLSearchParams(location.search),bar=el('section',undefined,'support-journey');bar.id='contractorJourney';
    if(context?.taskId){const {task}=Construction.locate(projectState,context.stageId,context.taskId);const back=el('a',`Return to ${task.name}`);back.href=contextUrl('estimate-result.html',context,{details:'1'});back.className='support-return-task';bar.append(back);}
    else if(params.get('project')&&params.get('project')!==projectState?.id){bar.append(el('p','This journey belongs to another project. Select that project before returning to its task.'));const choose=el('a','Choose a project');choose.href='projects.html';bar.append(choose);}
    const browse=el('a','All contractors');browse.href=contextUrl('contractors.html',context||rawContext());const saved=el('a','Saved contractors');saved.href=contextUrl('saved.html',context||rawContext());bar.append(browse,saved);main.prepend(bar);
  }
  function contactActions(c) {
    const row=el('div',undefined,'support-contacts'),links=M.contacts(c);
    for(const [key,label]of [['phone','Call'],['whatsapp','WhatsApp']]) {
      const action=el(links[key]?'a':'button',links[key]?label:`${label} unavailable`,'construction-secondary');
      action.prepend(icon(key==='phone'?'phone':'chat'));
      if(links[key]) { action.href=links[key]; if(key==='whatsapp'){action.target='_blank';action.rel='noopener noreferrer';} }
      else {action.type='button';action.disabled=true;action.title='No confirmed contact details recorded for this profile.';}
      action.addEventListener('click',event=>event.stopPropagation());row.append(action);
    }
    if(!links.phone||!links.whatsapp) row.append(el('small','Only confirmed contact details are enabled.'));
    return row;
  }
  function refresh() {
    window.ContractorSupport?.workspace();
    const target=document.getElementById('profileAssignments');
    if(target&&projectState){target.replaceChildren();assignmentRows(projectState,target);}
    const context=typeof currentTaskContext!=='undefined'?currentTaskContext:null;
    if(context?.projectId===projectState?.id&&!document.getElementById('taskModal')?.classList.contains('hidden')){
      try{const {stage,task}=Construction.locate(projectState,context.stageId,context.taskId);modal(stage,task);}catch{}
    }
  }
  function associate(c, context) {
    try { M.assign(context.projectId,c,context.stageId||null,context.taskId||null); refresh(); announce('Contractor assigned. Tasks and expenditure are unchanged.'); }
    catch(error){notify(error);}
  }
  function assignmentRows(project, target, scope) {
    try {
      const data=M.model(project),items=scope?data.items.filter(a=>a.stageId===scope.stageId&&a.taskId===scope.taskId||scope.includeProject&&!a.stageId&&!a.taskId):data.items;
      if(!items.length) target.append(el('p','No contractor assigned. You can manage this work independently.','support-muted'));
      for(const a of items) {
        const row=el('div',undefined,'support-assignment');
        const name=el('button',a.contractor.name,'support-profile-link');name.type='button';name.onclick=()=>openProfile(a.contractor,{projectId:project.id,stageId:scope?.taskId?scope.stageId:a.stageId,taskId:scope?.taskId||a.taskId});
        const scopeName=a.taskId?project.stages?.find(s=>s.id===a.stageId)?.tasks?.find(t=>t.id===a.taskId)?.name:'Project';
        const remove=el('button','Remove association','construction-secondary');remove.type='button';
        remove.setAttribute('aria-label',`Remove association with ${a.contractor.name}`);
        remove.onclick=()=>{try{M.remove(project.id,a.id);refresh();announce('Association removed. Progress, files and expenditure are unchanged.');}catch(error){notify(error);}};
        row.append(name,el('span',scopeName||'Previous task association'),remove);target.append(row);
      }
      if(!scope&&data.history.length) {
        const history=el('details',undefined,'support-history');history.append(el('summary','Previous contractor records (preserved)'));
        for(const a of data.history) {
          const row=el('div');row.append(el('p',`${a.contractor.name} · ${a.contractor.role||'Specialty not recorded'} · historical association`));
          const view=el('button','View preserved profile','construction-secondary');view.type='button';
          view.onclick=()=>openProfile(a.contractor,{projectId:project.id,stageId:a.stageId,taskId:a.taskId});
          row.append(view);history.append(row);
        }
        target.append(history);
      }
      if(!scope&&(project.hiredContractors||project.hiredContractor)&&!data.history.length)
        target.append(el('p','Older contractor information is preserved but could not be interpreted as an association.','support-muted'));
    }catch(error){target.append(el('p',error.message,'support-muted'));}
  }
  function taskControls(item,stage,task) {
    const row=el('div',undefined,'support-task-entry'),button=el('button','Contractor options (optional)','construction-secondary');button.type='button';
    button.dataset.action='contractors';button.onclick=()=>TaskNavigation.focusTask(stage.id,task.id);
    row.append(button);item.append(row);
  }
  function taskPanel() {
    document.querySelectorAll('.task-contractors').forEach(n=>n.remove());
    if(!document.getElementById('taskList')||!projectState)return;
    const mount=document.getElementById('planRecommendationMount');
    const unfinished=TaskNavigation.unfinished(projectState);
    if(!unfinished.length&&TaskNavigation.ordered(projectState).length){
      const panel=el('details',undefined,'task-contractors support-completed');panel.id='taskContractorRecommendations';panel.open=true;panel.append(el('summary','Project completed · optional support'),el('p','All project tasks are completed. Browse professionals for additional work or maintenance. Previously associated contractors remain available below.','support-muted'));
      const browse=el('a','Browse all contractors');browse.href=contextUrl('contractors.html',{projectId:projectState.id});panel.append(browse);mount?.replaceChildren(panel);return;
    }
    const chosen=TaskNavigation.current(projectState)||unfinished[0];
    if(!chosen){if(mount){mount.replaceChildren(el('p','All tasks are completed. You can still browse listed specialties or review a task for optional support.','support-muted'));}return;}
    const {stage,task}=chosen,project=projectState;
    const item=document.getElementById(`construction-task-${stage.id}-${task.id}`);if(!item)return;
    const panel=el('details',undefined,'task-contractors');panel.id='taskContractorRecommendations';
    panel.append(el('summary',`Optional support · ${M.requirements(task).label}`));
    panel.append(el('p','Listed specialties suggest possible relevance, not qualifications or verification. Arrange any work outside BuildSmart.','support-muted'));
    const assigned=el('div');assignmentRows(project,assigned,{stageId:stage.id,taskId:task.id});panel.append(assigned);
    const results=el('div',undefined,'support-results');panel.append(results);
    const browse=el('a','Browse all contractors');browse.href=contextUrl('contractors.html',{projectId:project.id,stageId:stage.id,taskId:task.id});panel.append(browse);
    let requested=false;
    panel.addEventListener('toggle',async()=>{
      if(!panel.isConnected)return;
      if(!panel.open){dismissed.add(supportKey(stage.id,task.id));return;}
      if(!panel.open||requested)return;requested=true;results.replaceChildren(el('p','Finding recorded specialties…','support-muted'));
      try {
        const matches=M.matches(await M.catalog(),task,project.location||project.estimate?.location);
        if(!panel.isConnected||projectState?.id!==project.id)return;
        results.replaceChildren();
        if(!matches.length)results.append(el('p','No matching professionals are currently listed. You can continue independently or browse all contractors.','support-muted'));
        for(const {contractor:c,reason,local}of matches.slice(0,mount?2:3)) {
          const row=el('article',undefined,'support-recommendation'),details=el('button',mount?'View Profile':'View details','construction-secondary');details.type='button';
          details.onclick=()=>openProfile(c,{projectId:project.id,stageId:stage.id,taskId:task.id});
          const assign=el('button','Associate with Task','construction-secondary');assign.type='button';
          assign.onclick=()=>associate(c,{projectId:project.id,stageId:stage.id,taskId:task.id});
          row.append(el('strong',c.name),provenance(c),el('p',`${reason}${c.location?' · '+c.location:''}${local?' · matches project location preference':''}`),contactActions(c));
          const actions=el('div',undefined,'construction-actions');actions.append(details,assign);row.append(actions);results.append(row);
        }
      }catch(error){if(panel.isConnected)results.replaceChildren(el('p',error.message,'support-muted'));}
    });
    if(mount){panel.classList.add('plan-context-support');mount.replaceChildren(panel);}
    else item.append(panel);
    if((mount||TaskNavigation.current(projectState))&&!dismissed.has(supportKey(stage.id,task.id)))panel.open=true;
  }
  function modal(stage,task){
    const host=document.getElementById('taskCompletionAction');if(!host||!projectState)return;
    const generation=++modalGeneration,project=projectState,context={projectId:project.id,stageId:stage.id,taskId:task.id},key=JSON.stringify(context);
    let panel=document.getElementById('taskSuggestedProfessionals');
    if(!panel){panel=el('details',undefined,'modal-professionals');panel.id='taskSuggestedProfessionals';host.before(panel);}
    const open=panel.dataset.context===key?panel.open:true;panel.dataset.context=key;panel.replaceChildren();
    const summary=el('summary','Suggested Professionals (Optional)');const count=el('span','Finding listed specialties…','professional-count');summary.append(count);panel.append(summary);
    panel.append(el('p','Arrange work outside BuildSmart. These are recorded specialties, not verified qualifications. Contact is optional; only confirmed details are enabled.','professional-explanation'));
    const message=el('p','','professional-message');message.id='taskProfessionalMessage';message.setAttribute('role','status');panel.append(message);
    const assigned=el('details',undefined,'professional-associations');assigned.append(el('summary','Associated with this task or project'));const assignedRows=el('div');assignmentRows(project,assignedRows,{stageId:stage.id,taskId:task.id,includeProject:true});assigned.append(assignedRows);
    try{if(M.list(project).some(a=>!a.taskId||a.stageId===stage.id&&a.taskId===task.id))assigned.open=true;}catch{assigned.open=true;}panel.append(assigned);
    const results=el('div',undefined,'professional-results');panel.append(results);
    const browse=el('a','Browse all contractors');browse.href=contextUrl('contractors.html',context);browse.onclick=event=>{if(!beforeNavigate())event.preventDefault();};panel.append(browse);panel.open=open;
    const active=()=>generation===modalGeneration&&panel.isConnected&&panel.dataset.context===key&&projectState?.id===project.id&&currentTaskContext.projectId===project.id&&currentTaskContext.stageId===stage.id&&currentTaskContext.taskId===task.id;
    void M.catalog().then(records=>{
      if(!active())return;const matches=M.matches(records,task,project.location||project.estimate?.location).slice(0,3);count.textContent=`${matches.length} ${matches.length===1?'profile':'profiles'}`;
      if(!matches.length){results.append(el('p','No matching professionals are currently listed. You can continue independently or browse all contractors.','support-muted'));return;}
      for(const {contractor:c}of matches){
        const card=el('article',undefined,'professional-card');card.dataset.contractorId=M.identity(c);
        card.append(el('strong',c.name),el('span',c.role||'Specialty not recorded'),el('small',c.location||'Location not recorded'),provenance(c));
        const view=el('button','View Profile','construction-secondary');view.type='button';view.onclick=()=>openProfile(c,context);card.append(view);
        const options=el('details',undefined,'professional-options');options.append(el('summary','Contact & assignment'),contactActions(c));
        const actions=el('div',undefined,'professional-assignment-actions');
        for(const [label,scope]of [['Associate with Task',context],['Associate with Project',{projectId:project.id}]]){const assign=el('button',label,'construction-secondary');assign.type='button';assign.onclick=()=>associate(c,scope);actions.append(assign);}
        options.append(actions);card.append(options);results.append(card);
      }
    }).catch(error=>{if(active()){count.textContent='Listings unavailable';results.append(el('p',error.message,'support-muted'));}});
  }
  function workspace() {
    if(!document.getElementById('taskList')||!projectState)return;
    const selected=TaskNavigation.current(projectState);
    document.querySelectorAll('.construction-task').forEach(item=>item.classList.toggle('is-selected',
      !!selected&&item.id===`construction-task-${selected.stage.id}-${selected.task.id}`));
    const summary=document.getElementById('contractorSummary');
    if(summary) {
      summary.replaceChildren();summary.style.display='block';
      const details=el('details',undefined,'project-associations');details.append(el('summary','Optional contractor associations'));
      assignmentRows(projectState,details);if(document.getElementById('planRecommendationMount'))details.open=true;summary.append(details);
    }
    taskPanel();
  }
  function marketplace() {
    const container=document.getElementById('contractorList');if(!container)return;
    const records=[...container.querySelectorAll('.contractor-card')].map(M.extract).filter(c=>c.name?.trim()),cards=[];
    const main=document.querySelector('main');journey(main);
    const layout=el('div',undefined,'directory-layout'),primary=el('section',undefined,'directory-primary'),aside=el('aside',undefined,'directory-support');aside.setAttribute('aria-label','Discovery support');
    const hero=document.querySelector('.contractor-hero'),specialties=document.querySelector('.specialty-section');
    if(hero)primary.append(hero);if(specialties)primary.append(specialties);
    const notice=el('div',undefined,'support-directory-notice');notice.id='contractorListingNotice';notice.append(icon('info'),el('p','Unconfirmed listings: identities, credentials and availability have not been checked. Only confirmed contact methods are enabled.'));primary.append(notice);
    const toolbar=el('div',undefined,'directory-toolbar'),result=el('p');result.id='contractorResultCount';result.setAttribute('role','status');result.setAttribute('aria-live','polite');
    const sortLabel=el('label','Sort by: ','directory-sort'),sort=el('select');sort.id='contractorSort';for(const [value,text]of [['relevant','Most relevant'],['name','Name A–Z'],['location','Location A–Z']]){const option=el('option',text);option.value=value;sort.append(option);}sortLabel.append(sort);
    const modes=el('div',undefined,'directory-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Display style');
    for(const mode of ['grid','list']){const button=el('button');button.type='button';button.append(icon(mode));button.setAttribute('aria-label',`${mode==='grid'?'Grid':'List'} view`);button.setAttribute('aria-pressed',String(mode==='grid'));button.onclick=()=>{container.classList.toggle('list-view',mode==='list');modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};modes.append(button);}
    toolbar.append(result,sortLabel,modes);primary.append(toolbar,container);layout.append(primary,aside);main.append(layout);
    container.replaceChildren();
    const empty=el('section',undefined,'directory-empty');empty.id='emptyState';empty.append(icon('search'),el('h2',records.length?'No matching professionals':'No professionals listed yet'),el('p',records.length?'Try another name, specialty or location. You can also clear your search and filters.':'You can continue your construction plan independently and check back for listed professionals.'));
    const reset=el('button','Clear search & filters','construction-secondary');reset.type='button';reset.onclick=()=>{filter='';if(search)search.value='';syncFilters();apply();};if(records.length)empty.append(reset);container.append(empty);
    const query=new URLSearchParams(location.search).get('role')||'';let filter=query;
    const filters=document.getElementById('filterContainer');filters?.replaceChildren();
    const search=document.querySelector('.search-bar');if(search){search.type='search';search.setAttribute('aria-label','Search contractors by name, specialty or location');search.setAttribute('aria-controls','contractorList');const wrapper=el('div',undefined,'directory-search');search.before(wrapper);wrapper.append(icon('search'),search);}
    const context=journeyContext(),taskContext=context?.taskId?Construction.locate(projectState,context.stageId,context.taskId):null;
    const completed=projectState&&Construction.summary(projectState).isCompleted;
    sort.options[0].textContent=taskContext&&!completed?'Task relevance':'Catalogue order';
    const recommended=taskContext&&!completed?M.matches(records,taskContext.task,projectState.location||projectState.estimate?.location):[];
    const ranks=new Map(recommended.map(({contractor:c},i)=>[M.identity(c),i]));
    function syncFilters(){filters?.querySelectorAll('button').forEach(b=>{const active=filter?M.specialty(b.dataset.filter)===M.specialty(filter):b.dataset.filter==='all';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
    function apply(){let count=0;const text=M.norm(search?.value);
      cards.sort((a,b)=>sort.value==='name'?a.c.name.localeCompare(b.c.name):sort.value==='location'?(a.c.location||'\uffff').localeCompare(b.c.location||'\uffff')||a.c.name.localeCompare(b.c.name):(ranks.get(M.identity(a.c))??999)-(ranks.get(M.identity(b.c))??999)||a.index-b.index);
      for(const {card,c}of cards){const roleMatch=!filter||M.matches([c],{requiredContractor:filter,requiredCapability:filter}).length>0;
        const searchMatch=!text||M.norm(`${c.name} ${c.role} ${c.location||''} ${c.skills||''}`).includes(text);
        card.hidden=!(roleMatch&&searchMatch);container.append(card);if(!card.hidden)count++;}
      empty.hidden=count>0;empty.classList.toggle('hidden',count>0);
      result.replaceChildren(el('strong',String(count)),document.createTextNode(` ${count===1?'contractor':'contractors'} found`));
    }
    for(const role of ['All',...new Set(records.map(c=>c.role).filter(Boolean))]) {
      const button=el('button',role,'filter-btn');button.type='button';button.dataset.filter=role==='All'?'all':role;
      button.onclick=()=>{filter=role==='All'?'':role;syncFilters();apply();};filters?.append(button);
    }
    for(const c of records) {
      const card=el('article',undefined,'contractor-card');
      for(const [key,value]of Object.entries(c))if(value!==undefined)card.dataset[key==='projectList'?'projectlist':key]=String(value);
      const header=el('div',undefined,'contractor-header'),title=el('div',undefined,'listing-details'),place=el('p',c.location||'Location not recorded','listing-location');place.prepend(icon('pin'));
      title.append(el('h3',c.name),el('p',c.role||'Specialty not recorded','listing-role'),place);
      header.append(portrait(c),title);const skills=el('p',c.skills?c.skills.split('|').join(', '):'No additional skills recorded.','listing-skills');skills.prepend(icon('work'));
      card.append(header,skills,provenance(c));
      const actions=el('div',undefined,'contractor-actions'),save=saveControl(c,renderSaved),view=el('button','View Profile','view-profile-btn');view.type='button';
      view.onclick=event=>{event.stopPropagation();openProfile(c);};actions.append(view,save);card.append(actions,contactActions(c));container.append(card);cards.push({card,c,index:cards.length});
    }
    function panel(title,glyph){const section=el('section',undefined,'directory-panel'),heading=el('h2',title);heading.prepend(icon(glyph));section.append(heading);aside.append(section);return section;}
    function compact(c){const button=el('button',undefined,'directory-mini-profile');button.type='button';button.append(portrait(c),el('span',undefined,'mini-details'),icon('arrow'));const details=button.querySelector('.mini-details');details.append(el('strong',c.name),el('span',c.role||'Specialty not recorded'),el('small',c.location||'Location not recorded'));button.onclick=()=>openProfile(c);return button;}
    const recommendations=panel('Task-linked recommendations','target');recommendations.id='directoryRecommendations';
    if(completed)recommendations.append(el('h3','Project completed'),el('p','Browse listed professionals for additional work or maintenance. Your previously associated contractors remain accessible.'));
    else if(taskContext){recommendations.append(el('p',`Listed specialties for ${taskContext.task.name}. Engagement is optional.`));for(const {contractor:c}of recommended.slice(0,3))recommendations.append(compact(c));if(!recommended.length)recommendations.append(el('p','No matching professionals are currently listed. You can continue independently or browse all contractors.'));}
    else recommendations.append(el('p','Open Contractor options from a task in your construction plan to discover relevant listed specialties. You can also browse independently.'));
    const plan=el('a',completed?'View completed construction plan':taskContext?'Return to task':'Open construction plan','directory-panel-link');plan.href=contextUrl('estimate-result.html',context||{projectId:projectState?.id||''},taskContext?{details:'1'}:{});if(!projectState&&!context)plan.href='projects.html';recommendations.append(plan);
    const savedPanel=panel('Saved contractors','save');savedPanel.id='directorySaved';
    function renderSaved(){savedPanel.querySelectorAll(':scope > :not(h2)').forEach(n=>n.remove());const entries=AppState.savedContractors||[];savedPanel.querySelector('h2').replaceChildren(icon('save'),document.createTextNode(`Saved contractors (${entries.length})`));for(const c of entries.slice(0,3))savedPanel.append(compact(c));if(!entries.length)savedPanel.append(el('p','Save a listed professional to keep their details close at hand.'));const link=el('a','View all saved contractors','directory-panel-link');link.href=contextUrl('saved.html',context||rawContext());savedPanel.append(link);}
    renderSaved();if(search)search.oninput=apply;sort.onchange=apply;syncFilters();apply();
  }
  function saved(){
    const container=document.getElementById('savedList');if(!container)return;
    journey(document.querySelector('main'));container.replaceChildren();const records=AppState.savedContractors||[];
    const empty=document.getElementById('emptyState');if(empty)empty.style.display=records.length?'none':'block';
    for(const c of records){
      const card=el('article',undefined,'contractor-card'),header=el('div',undefined,'contractor-header'),image=el('img');image.src=safeImage(c.image);image.alt='';
      const title=el('div');title.append(el('h3',c.name),el('p',c.role||'Specialty not recorded'),el('p',c.location||'Location not recorded'),provenance(c));header.append(image,title);card.append(header);
      const actions=el('div',undefined,'contractor-actions'),remove=el('button','Saved','save-btn'),view=el('button','View Profile','view-profile-btn');remove.type=view.type='button';
      card.style.cursor='pointer';card.onclick=event=>{if(!event.target.closest('button,a,summary'))openProfile(c);};
      remove.onclick=()=>{toggleSave(c);saved();};view.onclick=()=>openProfile(c);actions.append(remove,view);card.append(actions);container.append(card);
    }
  }
  let profileReady=false;
  function profile() {
    const page=(location.pathname.split('/').pop()||'index').replace(/\.html$/,'')+'.html';
    if(page!=='contractor-profile.html'||profileReady)return;profileReady=true;
    let c;try{c=JSON.parse(localStorage.getItem('selectedContractor'));}catch{}
    const main=document.querySelector('.profile-page');if(!c?.name){main?.replaceChildren(el('p','Choose a contractor profile to view its recorded details.'));return;}
    journey(main);main?.querySelector('.profile-identity')?.append(provenance(c));
    for(const [id,value]of [['contractorName',c.name],['contractorRole',c.role||'Specialty not recorded'],['contractorRating','Listed profile · credentials not checked by BuildSmart'],['contractorLocation',c.location||'Not recorded'],['contractorExperience',c.experience||'Not recorded'],['contractorProjects',c.projects||'Not recorded']]) {
      const n=document.getElementById(id);if(n)n.textContent=value;
    }
    const image=document.getElementById('profilePortrait');if(image){image.replaceChildren(portrait(c,'profile-photo','contractorImage'),el('small',c.image?'Recorded listing image · identity unconfirmed':'No listing photograph available'));}
    const about=document.querySelector('#about p');if(about)about.textContent='Confirm the scope of work, qualifications and any licensing directly. Arrangements and engagement happen outside BuildSmart.';
    const skills=document.querySelector('.skills');if(skills){skills.replaceChildren();for(const skill of String(c.skills||'').split('|').filter(Boolean))skills.append(el('span',skill));if(!skills.children.length)skills.append(el('p','No additional skills or services recorded.'));}
    const certs=document.querySelector('.certs');if(certs){certs.replaceChildren(el('li','No independently checked qualification information is available.'));certs.parentElement.querySelector('h3').textContent='Qualifications information';}
    const reviews=document.getElementById('reviews');if(reviews)reviews.replaceChildren(el('h3','Reviews'),el('p','No independently checked review details are available.'));
    const projectsBlock=document.querySelector('.project-item');if(projectsBlock){projectsBlock.replaceChildren(el('h3','Listed project experience'));for(const value of String(c.projectList||'').split('|').filter(Boolean))projectsBlock.append(el('p',value));if(!c.projectList)projectsBlock.append(el('p','No project descriptions recorded.'));}
    const actions=document.querySelector('.action-buttons');if(!actions)return;
    actions.replaceChildren(contactActions(c));
    actions.append(saveControl(c));
    const context=new URLSearchParams(location.search),wrong=context.get('project')&&context.get('project')!==projectState?.id;
    const project=projectState;
    if(!project||wrong){actions.append(el('p',wrong?'This link belongs to a different project. Select that project before associating a contractor.':'Select a project to make an optional association.','support-muted'));const link=el('a','Choose a project');link.href='projects.html';actions.append(link);return;}
    const projectButton=el('button','Associate with Project','construction-secondary');projectButton.id='hireContractorBtn';projectButton.type='button';projectButton.onclick=()=>associate(c,{projectId:project.id});actions.append(projectButton);
    if(context.get('task')) {
      try{Construction.locate(project,context.get('stage'),context.get('task'));const taskButton=el('button','Associate with Task','construction-secondary');taskButton.id='associateTaskBtn';taskButton.type='button';taskButton.onclick=()=>associate(c,{projectId:project.id,stageId:context.get('stage'),taskId:context.get('task')});actions.append(taskButton);}catch{actions.append(el('p','The linked task is unavailable. Project association remains optional.'));}
    }
    actions.append(el('p',`Optional association with ${project.projectName||'this project'}. This does not hire anyone or record expenditure.`,'support-muted'));
    const assigned=el('div');assigned.id='profileAssignments';actions.after(assigned);
    assignmentRows(project,assigned);
  }
  window.ContractorSupport=Object.freeze({ contactActions, taskControls, taskPanel, modal, workspace, marketplace, saved, profile, openProfile, reopen });
})();
