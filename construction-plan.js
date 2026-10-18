/* Construction Plan presentation. All mutations remain in the existing domain APIs. */
(() => {
  'use strict';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const byId=id=>document.getElementById(id);
  const button=(text,fn,cls='construction-secondary')=>{const n=el('button',text,cls);n.type='button';n.onclick=fn;return n;};
  const money=Financials.format;
  let mediaKey='',generation=0;
  let confirmTaskDiscard=()=>true;
  const urls=new Set();
  function release(){++generation;urls.forEach(URL.revokeObjectURL);urls.clear();}
  function current(){return TaskNavigation.current(projectState)||TaskNavigation.unfinished(projectState)[0];}
  function register(){
    const list=byId('taskList');if(!list)return;list.replaceChildren();list.classList.add('construction-task-list');
    if(!projectState){list.append(el('li','Select or create a project to see its construction tasks.'));return;}
    const finances=Financials.calculate(projectState),progress=Construction.summary(projectState);
    byId('planRegisterMeta').textContent=`${progress.stages.length} stages · ${progress.total} tasks · ${progress.completed} completed`;
    for(const stage of projectState.stages){
      const state=Construction.stageSummary(stage),finance=finances.stages[stage.id];
      const card=el('li',undefined,'stage-card construction-stage');card.id=`construction-stage-${stage.id}`;card.dataset.stageId=stage.id;
      const open=expandedStages[stage.id]??stage.id===(projectState.currentStage||projectState.stages[0]?.id);
      const header=button('',()=>{expandedStages[stage.id]=!open;register();},'construction-stage-toggle');
      header.setAttribute('aria-expanded',String(open));header.setAttribute('aria-controls',`construction-tasks-${stage.id}`);
      header.append(el('span',state.status==='completed'?'✓':state.status==='active'?'◔':'○',`plan-stage-marker ${state.status}`),el('strong',stage.name),el('span',`${state.label} · ${state.completed}/${state.total} tasks completed`,'plan-stage-count'),el('span',state.label,'plan-stage-label'),el('span',`Planned: ${money(finance.planned)}  |  Recorded: ${money(finances.available?finance.actual:null)}`,'stage-financial'),el('span',open?'⌃':'⌄','plan-chevron'));
      const body=el('div',undefined,'stage-card-body');body.id=`construction-tasks-${stage.id}`;body.hidden=!open;
      const headings=el('div',undefined,'plan-table-heading');for(const label of ['Task','Status','Planned (GH₵)','Recorded (GH₵)','Files','Actions'])headings.append(el('span',label));body.append(headings);
      for(const task of stage.tasks){
        const row=el('article',undefined,`task-item construction-task ${task.status}`);row.id=`construction-task-${stage.id}-${task.id}`;row.tabIndex=-1;row.dataset.taskId=task.id;
        const name=el('div',undefined,'plan-task-name');name.append(el('h4',task.name));if(task.critical){const hint=el('span','Guidance','plan-critical-marker');hint.title=Construction.guidance(projectState,stage.id,task.id).critical;name.append(hint);}
        const status=el('span',Construction.LABELS[task.status]||'Older status preserved','construction-task-status');status.dataset.label='Status';
        const planned=el('span',money(task.estimatedCost||0),'plan-task-money');planned.dataset.label='Planned';planned.setAttribute('aria-label',`Planned: ${planned.textContent}`);
        const actual=el('span',money(Financials.taskActual(projectState,stage.id,task.id)),'plan-task-money');actual.dataset.label='Recorded';actual.setAttribute('aria-label',`Recorded: ${actual.textContent}`);
        const fileCount=Array.isArray(task.evidence)?task.evidence.length:0;
        const evidence=el('span',`${fileCount} ${fileCount===1?'file':'files'}`,'construction-evidence-count');evidence.dataset.label='Files';
        const actions=el('div',undefined,'construction-actions');const details=button('View details ›',()=>openTaskModal(stage.id,task.id));details.dataset.action='details';details.setAttribute('aria-label',`View details for ${task.name}`);actions.append(details);
        if(task.status!=='completed'){
          const start=task.status!=='active';const action=button(start?'Start task':'Complete task',()=>start?startTask(stage.id,task.id):openTaskModal(stage.id,task.id),'plan-text-button');action.dataset.action=start?'start':'complete';actions.append(action);
          // Completion is also available before starting, as in the existing flexible workflow.
          if(start){const complete=button('Complete task',()=>openTaskModal(stage.id,task.id),'plan-text-button plan-direct-complete');complete.dataset.action='complete';actions.append(complete);}
        }
        row.append(name,status,planned,actual,evidence,actions);body.append(row);
      }
      card.append(header,body);list.append(card);
    }
    const all=projectState.stages.every(s=>expandedStages[s.id]??s.id===(projectState.currentStage||projectState.stages[0]?.id));
    byId('planExpandAll').textContent=all?'Collapse all':'Expand all';byId('planExpandAll').onclick=()=>{projectState.stages.forEach(s=>expandedStages[s.id]=!all);register();};
    ContractorSupport.workspace();
  }
  function taskDetails(stage,task){
    byId('planTaskExtra')?.remove();
    const extra=el('div',undefined,'plan-task-extra');extra.id='planTaskExtra';
    const fields=['taskNotesInput','taskCostInput','taskExpenseDescription','taskExpenseDate','taskExpenseCategory'];
    const initial=fields.map(id=>byId(id).value);
    const canLeave=()=>{
      if(taskUpdateBusy){ConstructionUI.message('Saving task details. Please wait.');return false;}
      const draft=fields.some((id,i)=>byId(id).value!==initial[i])||byId('taskImageInput').files.length>0;
      return !draft||window.confirm('Discard unsaved task details before leaving this task?');
    };
    const leave=action=>{if(closeTaskModal())action();};
    confirmTaskDiscard=canLeave;
    const warning=Construction.guidance(projectState,stage.id,task.id);
    byId('taskStageName').textContent=stage.name;
    byId('taskDetailStatus').className=task.status;
    byId('taskOverviewPlanned').textContent=money(task.estimatedCost||0);
    byId('taskOverviewRecorded').textContent=money(Financials.taskActual(projectState,stage.id,task.id));
    byId('taskCompletionAction').hidden=task.status==='completed';
    for(const [field,row,target]of [['startDate','taskStartDateRow','taskOverviewStart'],['completedAt','taskCompletedDateRow','taskOverviewCompleted']]){
      const valid=Number.isFinite(Date.parse(task[field]));byId(row).hidden=!valid;byId(target).textContent=valid?new Date(task[field]).toLocaleDateString():'';
    }
    if(warning.unfinished.length)extra.append(el('p',`Prerequisite work not recorded complete: ${warning.unfinished.join(', ')}. Sequencing reminders are advisory.`,'construction-critical'));
    if(warning.critical)extra.append(el('p',warning.critical,'construction-critical'));
    if(task.status==='pending')extra.append(button('Start task',()=>leave(()=>startTask(stage.id,task.id))));
    appendTaskExpenseAction(extra,stage,task);
    extra.querySelector('.task-expense-link')?.addEventListener('click',event=>{if(!canLeave())event.preventDefault();});
    const support=button('Contractor options (optional)',()=>leave(()=>{TaskNavigation.focusTask(stage.id,task.id);byId('planRecommendationMount').scrollIntoView({block:'center'});byId('taskContractorRecommendations')?.querySelector('summary')?.focus();}));support.dataset.action='contractors';extra.append(support);
    byId('taskOverviewDetails').replaceChildren(extra);
    window.ContractorSupport?.modal(stage,task);
  }
  function photoEntries(project){
    const entries=[];
    for(const stage of project.stages||[])for(const task of stage.tasks||[])for(const f of Array.isArray(task.evidence)?task.evidence:[]){
      if(f&&f.projectId===project.id&&f.stageId===stage.id&&f.taskId===task.id&&typeof f.id==='string'&&/^image\/(jpeg|png|webp)$/.test(f.type))entries.push({...f,taskName:task.name});
    }
    return entries.sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
  }
  async function image(file,project,token){
    const record=await EvidenceStore.get(file.id,{projectId:project.id,stageId:file.stageId,taskId:file.taskId});
    if(token!==generation||!(record.blob instanceof Blob)||!/^image\/(jpeg|png|webp)$/.test(record.blob.type))throw new Error('Unavailable photo');
    const url=URL.createObjectURL(record.blob);urls.add(url);const img=new Image();img.src=url;
    try{await img.decode();if(token!==generation)throw new Error('Changed project');return img;}catch(error){URL.revokeObjectURL(url);urls.delete(url);throw error;}
  }
  function tile(file,project,token){
    const tile=button('',()=>openTaskModal(file.stageId,file.taskId),'plan-photo');const frame=el('span','Photo unavailable','plan-photo-frame');
    tile.append(frame,el('strong',file.taskName),el('small',Number.isFinite(Date.parse(file.createdAt))?new Date(file.createdAt).toLocaleDateString('en-GB'):'Date not recorded'));
    void image(file,project,token).then(img=>{if(tile.isConnected&&token===generation){img.alt=`${file.taskName}: saved task photograph`;frame.replaceChildren(img);}else{URL.revokeObjectURL(img.src);urls.delete(img.src);}}).catch(()=>{});return tile;
  }
  function gallery(project,entries,token){
    const dialog=el('dialog',undefined,'construction-guidance plan-gallery');dialog.setAttribute('aria-labelledby','planGalleryTitle');const title=el('h2','Project progress photos');title.id='planGalleryTitle';
    const previous=new Set(urls);
    const dismiss=()=>{dialog.close();dialog.remove();for(const url of urls)if(!previous.has(url)){URL.revokeObjectURL(url);urls.delete(url);}byId('planViewPhotos').focus();};
    const close=button('Close',dismiss);const grid=el('div',undefined,'plan-photo-grid');
    dialog.append(title,close,grid);document.body.append(dialog);dialog.showModal();
    dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
    if(!entries.length)grid.append(el('p','No task photographs recorded. Upload photos or files through a task’s details.'));
    for(const file of entries){const t=tile(file,project,token);t.onclick=()=>{dismiss();openTaskModal(file.stageId,file.taskId);};grid.append(t);}close.focus();
  }
  function media(project){
    const entries=photoEntries(project),key=JSON.stringify([project.id,project.projectCover,project.projectPhotos,entries]);if(key===mediaKey)return;mediaKey=key;release();const token=generation;
    const cover=byId('planCover');cover.replaceChildren();const fallback=new Image();fallback.src='images/buildsmart-hero.png';fallback.alt='BuildSmart architectural illustration, not this project';fallback.onerror=()=>fallback.remove();cover.append(fallback,el('small','Architectural illustration'));
    const ref=project.projectCover;
    const selected=ref?.kind==='photo'&&(ref.source==='task'?entries:(Array.isArray(project.projectPhotos)?project.projectPhotos:[])).find(f=>f.id===ref.evidenceId&&f.projectId===project.id&&f.stageId===ref.stageId&&f.taskId===ref.taskId&&(ref.source==='task'||f.stageId==='__project__'&&f.taskId==='cover-photos'));
    if(selected)void image(selected,project,token).then(img=>{if(token===generation){img.alt='Selected project cover';cover.replaceChildren(img,el('small','Project cover'));cover.classList.add('has-photo');}}).catch(()=>{});
    cover.classList.remove('has-photo');
    const grid=byId('planPhotos');grid.replaceChildren();if(!entries.length)grid.append(el('p','No task photographs yet. Upload photos or files to a task to build your project record.','plan-photo-empty'));
    for(const file of entries.slice(0,5))grid.append(tile(file,project,token));
    const add=button('',()=>{const next=current()||TaskNavigation.ordered(project)[0];if(next)openTaskModal(next.stage.id,next.task.id);},'plan-add-photo');add.append(el('span','＋'),el('strong','Add photos'),el('small','Attach to any task'));grid.append(add);
    byId('planViewPhotos').onclick=()=>gallery(project,entries,token);
  }
  function refresh(){
    if(!projectState){byId('planNextDescription').textContent='Create or select a project to manage its construction plan.';byId('planRecommendationMount').replaceChildren(el('p','Select a project to see relevant specialties.'));return;}
    const p=projectState,s=Construction.summary(p),f=Financials.calculate(p);byId('projectNameDisplay').textContent=p.projectName||'Untitled project';byId('estimateLocation').textContent=p.location||p.estimate?.location||'Location not recorded';byId('estimateValue').textContent=p.estimate?money(f.budget):'No estimate yet';byId('projectSpent').textContent=money(f.spent);byId('planBalance').textContent=money(f.remaining);
    byId('planStatus').textContent=s.isCompleted?'Completed':s.begun?'In progress':'Not started';byId('planActivity').textContent=Construction.projectLabel(p);byId('planActivity').hidden=byId('planStatus').textContent.toLowerCase()===byId('planActivity').textContent.toLowerCase();byId('planPercent').textContent=`${s.percent}%`;byId('planRing').style.setProperty('--completion',`${s.percent}%`);byId('planTaskCount').textContent=`${s.completed}/${s.total} tasks completed`;
    const tasks=p.stages.flatMap(s=>s.tasks);byId('planCounts').replaceChildren(...[['completed','Completed'],['active','In progress'],['pending','Not started']].map(([status,label])=>el('li',`${tasks.filter(t=>t.status===status).length} ${label}`,status)));
    byId('planNextDescription').classList.toggle('project-complete-msg',s.isCompleted);
    byId('planNextDescription').textContent=s.isCompleted?'Great work! All project tasks have been completed. You can still review details, add expenses or upload more photos.':'Review guidance, save notes and upload photos or files. Record work across stages when appropriate for your project.';
    if(s.isCompleted)byId('currentActionButton').replaceChildren(button('View completion review',()=>ProjectExperience.openReview(),'primary-btn'));
    byId('planGuidance').onclick=()=>{const next=current();if(next)openTaskModal(next.stage.id,next.task.id);else ConstructionUI.message('All recorded tasks are completed. Open any task to review its details and guidance.');};
    media(p);
  }
  const paths={next:'M4 3h16v18H4Zm4 5h8M8 12h8M8 16h5',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-4m-1-12a4 4 0 0 1 0 8',photo:'M3 6h5l2-3h4l2 3h5v15H3Zm9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8',guide:'M9 21h6m-5-4h4c0-4 4-4 4-9a6 6 0 0 0-12 0c0 5 4 5 4 9Z'};
  document.querySelectorAll('[data-plan-icon]').forEach(n=>{n.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n.dataset.planIcon]}"/></svg>`;});
  byId('taskModal').querySelector('.modal-overlay').onclick=()=>closeTaskModal();
  window.ConstructionPlan=Object.freeze({register,refresh,taskDetails,confirmTaskDiscard:()=>confirmTaskDiscard()});
  addEventListener('pagehide',()=>{release();mediaKey='';});
})();
