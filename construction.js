/* Task-count lifecycle rules. Dependencies are advisory planning reminders only. */
(function () {
  "use strict";
  const LABELS = Object.freeze({ pending: "Not Started", active: "In Progress", completed: "Completed" });
  const DEPENDENCIES = Object.freeze({
    "foundation/site-layout": ["foundation/site-clearing"],
    "foundation/excavation": ["foundation/site-layout"],
    "foundation/footing": ["foundation/excavation"],
    "foundation/foundation-wall": ["foundation/footing"],
    "foundation/dpc": ["foundation/foundation-wall"],
    "foundation/backfilling": ["foundation/dpc"],
    "structure/blockwork-super": ["foundation/backfilling"],
    "structure/columns": ["foundation/footing"],
    "structure/lintel": ["structure/blockwork-super", "structure/columns"],
    "structure/beam": ["structure/columns"],
    "structure/slab": ["structure/beam"],
    "roofing/roof-frame": ["structure/beam"],
    "roofing/roof-cover": ["roofing/roof-frame"],
    "roofing/roof-waterproof": ["roofing/roof-cover"],
    "roofing/gutter": ["roofing/roof-cover"],
    "windows/window-install": ["structure/blockwork-super"],
    "windows/door-install": ["structure/blockwork-super"],
    "windows/frame-fix": ["structure/blockwork-super"],
    "finishing/plastering": ["structure/blockwork-super"],
    "finishing/screeding": ["foundation/backfilling"],
    "finishing/ceiling": ["roofing/roof-cover"],
    "finishing/tiling": ["finishing/screeding"],
    "finishing/painting": ["finishing/plastering"],
    "finishing/electrical": ["structure/blockwork-super"],
    "finishing/plumbing": ["foundation/backfilling"],
    "finishing/fixtures": ["finishing/painting"]
  });
  function locate(project, stageId, taskId) {
    const stage = project?.stages?.find(stage => stage.id === stageId);
    const task = stage?.tasks?.find(task => task.id === taskId);
    if (!project?.id || !stage || !task) throw new Error("This task is not available in the selected project. Reload the workspace.");
    return { stage, task };
  }
  function stageSummary(stage) {
    const tasks = stage?.tasks || [];
    const completed = tasks.filter(task => task.status === "completed").length;
    const begun = tasks.filter(task => task.status === "active" || task.status === "completed").length;
    const status = tasks.length && completed === tasks.length ? "completed" : begun ? "active" : "pending";
    return { total: tasks.length, completed, begun, status, label: LABELS[status], percent: tasks.length ? Math.round(completed / tasks.length * 100) : 0 };
  }
  function summary(project) {
    const stages = (project?.stages || []).map(stage => ({ ...stageSummary(stage), id: stage.id, name: stage.name }));
    const total = stages.reduce((sum, stage) => sum + stage.total, 0);
    const completed = stages.reduce((sum, stage) => sum + stage.completed, 0);
    const begun = stages.reduce((sum, stage) => sum + stage.begun, 0);
    const isCompleted = total > 0 && total === completed;
    return { stages, total, completed, begun, isCompleted, status: isCompleted ? "completed" : begun ? "active" : "pending", label: isCompleted ? "Completed" : begun ? "In Progress" : "Not Started", percent: total ? Math.round(completed / total * 100) : 0 };
  }
  function projectLabel(project) {
    const result = summary(project);
    if (result.isCompleted || !result.begun) return result.label;
    const active = result.stages.filter(stage => stage.status === "active");
    if (active.length > 1) return `${active.length} stages in progress`;
    if (active.length === 1) return `${active[0].name} in progress`;
    return `${result.stages.filter(stage => stage.status === "completed").length} stage(s) completed`;
  }
  const validDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  function reconcile(project) {
    if (!project.lifecycleVersion) {
      project.legacyLifecycle = project.legacyLifecycle || {
        capturedAt: new Date().toISOString(), currentStage: project.currentStage ?? null,
        completedStages: project.completedStages, isCompleted: project.isCompleted,
        startDate: project.startDate, endDate: project.endDate,
        tasks: (project.stages || []).flatMap(stage => (stage.tasks || []).map(task => ({ stageId: stage.id, taskId: task.id, status: task.status, progress: task.progress, startDate: task.startDate, completedAt: task.completedAt, endDate: task.endDate })))
      };
      project.lifecycleVersion = 1;
    }
    for (const stage of project.stages || []) for (const task of stage.tasks || []) {
      if (!task.status) task.status = "pending";
      task.progress = task.status === "completed" ? 100 : 0;
      if (!task.completedAt && task.status === "completed" && validDate(task.endDate)) task.completedAt = task.endDate;
    }
    const result = summary(project);
    project.completedStages = result.stages.filter(stage => stage.status === "completed").map(stage => stage.id);
    project.isCompleted = result.isCompleted;
    const dates = [project.startDate, ...(project.stages || []).flatMap(stage => (stage.tasks || []).map(task => task.startDate))].filter(validDate);
    if (dates.length) project.startDate = dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    if (result.isCompleted) {
      project.currentStage = null;
      const completionDates = (project.stages || []).flatMap(stage => (stage.tasks || []).map(task => task.completedAt)).filter(validDate);
      if (validDate(project.endDate)) completionDates.push(project.endDate);
      if (completionDates.length && (validDate(project.endDate) || completionDates.length === result.total)) project.endDate = completionDates.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    } else {
      project.endDate = null; // Original inconsistent compatibility dates remain in legacyLifecycle.
      if (!result.stages.some(stage => stage.id === project.currentStage && stage.status !== "completed")) {
        project.currentStage = result.stages.find(stage => stage.status === "active")?.id || result.stages.find(stage => stage.status !== "completed")?.id || null;
      }
    }
    return result;
  }
  function nextTask(project) {
    const stages = project?.stages || [];
    const preferred = stages.find(stage => stage.id === project.currentStage);
    const order = preferred ? [preferred, ...stages.filter(stage => stage !== preferred)] : stages;
    for (const status of ["active", "pending"]) for (const stage of order) {
      const task = stage.tasks?.find(task => task.status === status);
      if (task) return { stage, task };
    }
    return null;
  }
  function guidance(project, stageId, taskId) {
    const { task } = locate(project, stageId, taskId);
    const unfinished = (DEPENDENCIES[`${stageId}/${taskId}`] || []).map(key => {
      const [stage, taskId] = key.split("/");
      try { return locate(project, stage, taskId); } catch { return null; }
    }).filter(item => item && item.task.status !== "completed");
    return { unfinished: unfinished.map(item => `${item.stage.name}: ${item.task.name}`), critical: task.critical ? "Safety-sensitive work: seek qualified professional involvement and appropriate inspection for your design and site. BuildSmart does not certify construction safety or professional competence." : "" };
  }
  function transition(project, stageId, taskId, target, acknowledged = false) {
    const { task } = locate(project, stageId, taskId);
    if (!["active", "completed"].includes(target)) throw new Error("Unsupported task transition.");
    if (task.status === "completed" || task.status === target) return { changed: false, task, summary: summary(project) };
    const warning = guidance(project, stageId, taskId);
    if (!acknowledged && (warning.unfinished.length || warning.critical)) throw new Error("Acknowledge the task guidance before continuing.");
    const stamp = new Date().toISOString();
    if (!validDate(task.startDate) && (target === "active" || task.status === "pending")) task.startDate = stamp;
    task.status = target;
    task.progress = target === "completed" ? 100 : 0;
    task.updatedAt = stamp;
    if (target === "completed" && !validDate(task.completedAt)) task.completedAt = stamp;
    project.currentStage = stageId;
    const result = reconcile(project);
    if (result.isCompleted && !validDate(project.endDate)) project.endDate = stamp;
    return { changed: true, task, summary: result };
  }
  window.Construction = Object.freeze({ LABELS, DEPENDENCIES, locate, stageSummary, summary, projectLabel, reconcile, nextTask, guidance, transition });
})();
