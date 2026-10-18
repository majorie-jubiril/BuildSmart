/* Presentation and navigation only; Construction owns task transitions. */
(() => {
  'use strict';
  let selected;
  function ordered(project) {
    return (project?.stages || []).flatMap((stage, si) => {
      const underway = stage.tasks?.some(t => t.status === 'active' || t.status === 'completed');
      return (stage.tasks || []).map((task, ti) => {
        const warning = Construction.guidance(project, stage.id, task.id);
        const rank = task.status === 'active' ? 0 : underway ? 1 : warning.unfinished.length ? 3 : 2;
        return { stage, task, rank, si, ti, warning };
      });
    }).sort((a, b) => a.rank - b.rank || a.si - b.si || a.ti - b.ti);
  }
  const unfinished = project => ordered(project).filter(x => x.task.status !== 'completed');
  const registerUrl = project => `estimate-result.html?view=tasks&project=${encodeURIComponent(project?.id || '')}#task-register`;
  const taskUrl = (project, stageId, taskId) => `estimate-result.html?project=${encodeURIComponent(project?.id || '')}&stage=${encodeURIComponent(stageId)}&task=${encodeURIComponent(taskId)}#task-register`;
  function remember(stageId, taskId) { selected = { projectId: projectState?.id, stageId, taskId }; }
  function current(project) {
    if (selected?.projectId !== project?.id) return null;
    try { return { ...Construction.locate(project, selected.stageId, selected.taskId), ...selected }; } catch { return null; }
  }
  function reveal() {
    const wrapper = document.getElementById('task-register');
    wrapper?.classList.add('active');
    wrapper?.querySelector('.toggle-header')?.setAttribute('aria-expanded', 'true');
    return wrapper;
  }
  function focusTask(stageId, taskId) {
    if (!projectState) return;
    try { Construction.locate(projectState, stageId, taskId); } catch { ConstructionUI.message('This task is not available in the selected project.'); return; }
    remember(stageId, taskId); reveal(); expandedStages[stageId] = true;
    window.ContractorSupport?.reopen(stageId, taskId);
    renderTaskListUI(); renderCurrentActionButton(); renderCurrentActionCard(); renderTaskIntelligence();
    const target = document.getElementById(`construction-task-${stageId}-${taskId}`);
    target?.classList.add('is-selected'); target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function fromUrl() {
    if (!document.getElementById('taskList') || !projectState) return;
    const params = new URLSearchParams(location.search);
    if (params.get('project') && params.get('project') !== projectState.id) {
      reveal(); ConstructionUI.message('This task link belongs to another project. Select that project before following the link.'); return;
    }
    if (params.get('task')) {
      focusTask(params.get('stage'), params.get('task'));
      if(params.get('details')==='1')try{Construction.locate(projectState,params.get('stage'),params.get('task'));openTaskModal(params.get('stage'),params.get('task'));}catch{}
      return;
    }
    if (params.get('view') === 'tasks' || location.hash === '#task-register') {
      projectState.stages.forEach(stage => { expandedStages[stage.id] = true; });
      const target = reveal(); renderTaskListUI();
      target?.scrollIntoView({ block: 'start' }); target?.querySelector('.toggle-header')?.focus({ preventScroll: true });
    } else if (params.get('stage')) { reveal(); ConstructionUI.focusStage(params.get('stage')); }
  }
  window.TaskNavigation = Object.freeze({ ordered, unfinished, registerUrl, taskUrl, remember, current, reveal, focusTask, fromUrl });
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    loadProjectState(); refreshUI(); fromUrl();
  });
})();
