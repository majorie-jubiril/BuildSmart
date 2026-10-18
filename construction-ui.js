(function () {
  "use strict";
  const urls = new Set();
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function message(text) {
    let target = document.getElementById("constructionMessage");
    if (!target && document.querySelector("main")) {
      target = element("p", "", "construction-message");
      target.id = "constructionMessage";
      target.setAttribute("role", "status");
      document.querySelector("main").prepend(target);
    }
    if (target) target.textContent = text;
    else console.warn(text);
  }
  function confirmGuidance(warning) {
    if (!warning.unfinished.length && !warning.critical) return Promise.resolve(true);
    return new Promise(resolve => {
      const dialog = element("dialog", undefined, "construction-guidance");
      dialog.id = "taskGuidanceDialog";
      dialog.setAttribute("aria-labelledby", "taskGuidanceTitle");
      const title = element("h2", "Review task guidance");
      title.id = "taskGuidanceTitle";
      dialog.appendChild(title);
      if (warning.unfinished.length) {
        dialog.appendChild(element("p", "This prerequisite work is not recorded as completed. Review what applies to your site before proceeding:"));
        const list = element("ul");
        warning.unfinished.forEach(name => list.appendChild(element("li", name)));
        dialog.appendChild(list);
      }
      if (warning.critical) dialog.appendChild(element("p", warning.critical, "construction-critical"));
      dialog.appendChild(element("p", "Work sequencing varies by design and site. These are advisory planning reminders, not safety approval. Continuing changes only the task you selected. Contractor assignment is optional."));
      const actions = element("div", undefined, "construction-actions");
      const cancel = element("button", "Go back", "construction-secondary");
      const accept = element("button", "Acknowledge & continue", "primary-btn");
      cancel.type = accept.type = "button";
      accept.id = "acknowledgeTaskGuidance";
      let finished = false;
      const finish = result => {
        if (finished) return;
        finished = true;
        dialog.close(); dialog.remove(); resolve(result);
      };
      cancel.onclick = () => finish(false);
      accept.onclick = () => finish(true);
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
      actions.append(cancel, accept);
      dialog.appendChild(actions);
      document.body.appendChild(dialog);
      dialog.showModal();
      cancel.focus();
    });
  }
  function focusStage(stageId) {
    if (!projectState?.stages.some(stage => stage.id === stageId)) return;
    expandedStages[stageId] = true;
    renderTaskListUI();
    const card = document.getElementById(`construction-stage-${stageId}`);
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
    card?.querySelector(".construction-stage-toggle")?.focus({ preventScroll: true });
  }
  function tracker() {
    const container = document.getElementById("stageTracker");
    if (!container) return;
    container.replaceChildren();
    container.classList.add("construction-tracker");
    if (!projectState) return;
    const result = Construction.summary(projectState);
    for (const stage of result.stages) {
      const button = element("button", undefined, `stage-step ${stage.status === "completed" ? "completed" : stage.status === "active" ? "active" : ""}`);
      button.type = "button";
      button.dataset.stageId = stage.id;
      button.append(element("strong", stage.name), element("span", `${stage.label} · ${stage.completed}/${stage.total} tasks`));
      button.onclick = () => {
        if (document.getElementById("taskList")) focusStage(stage.id);
        else goTo(`estimate-result.html?stage=${encodeURIComponent(stage.id)}`);
      };
      container.appendChild(button);
    }
    const meta = document.getElementById("stageMeta");
    if (meta) meta.textContent = `${result.completed}/${result.total} tasks completed (${result.percent}%). Task completion is not certified physical construction progress.`;
  }
  const taskDates = task => {
    const parts = [];
    if (Number.isFinite(Date.parse(task.startDate))) parts.push(`Started: ${new Date(task.startDate).toLocaleDateString()}`);
    if (Number.isFinite(Date.parse(task.completedAt))) parts.push(`Completed: ${new Date(task.completedAt).toLocaleDateString()}`);
    return parts.join(" · ") || (task.status === "pending" ? "No start date yet" : "Dates not recorded for older progress");
  };
  function tasks() {
    if (window.ConstructionPlan) return ConstructionPlan.register();
    const list = document.getElementById("taskList");
    if (!list) return;
    list.replaceChildren();
    list.classList.add("construction-task-list");
    if (!projectState) return;
    const progress = Construction.summary(projectState);
    const finances = Financials.calculate(projectState);
    const summary = element("li", undefined, "construction-summary");
    summary.append(element("h3", `Task completion: ${progress.percent}%`), element("p", `${progress.completed} of ${progress.total} tasks completed across all stages. This is task completion, not certified physical construction progress.`), element("p", "Open any stage. You may record work across stages and continue without assigning a contractor."));
    list.appendChild(summary);
    for (const stage of projectState.stages) {
      const state = Construction.stageSummary(stage);
      const card = element("li", undefined, "stage-card construction-stage");
      card.id = `construction-stage-${stage.id}`;
      card.dataset.stageId = stage.id;
      const header = element("button", undefined, "construction-stage-toggle");
      header.type = "button";
      const open = expandedStages[stage.id] ?? (stage.id === (projectState.currentStage || projectState.stages[0]?.id));
      header.setAttribute("aria-expanded", String(open));
      header.setAttribute("aria-controls", `construction-tasks-${stage.id}`);
      header.append(element("strong", stage.name), element("span", `${state.label} · ${state.completed}/${state.total} tasks (${state.percent}%)`));
      header.onclick = () => { expandedStages[stage.id] = !open; tasks(); };
      card.appendChild(header);
      const finance = finances.stages[stage.id];
      card.appendChild(element("p", `Recorded: ${Financials.format(finances.available ? finance.actual : null)} / Planned: ${Financials.format(finance.planned)}`, "stage-financial"));
      const body = element("div", undefined, "stage-card-body");
      body.id = `construction-tasks-${stage.id}`;
      body.hidden = !open;
      for (const task of stage.tasks) {
        const item = element("article", undefined, `task-item construction-task ${task.status}`);
        item.id = `construction-task-${stage.id}-${task.id}`;
        item.tabIndex = -1;
        item.dataset.taskId = task.id;
        item.append(element("h4", task.name), element("span", Construction.LABELS[task.status] || "Not Started (older status preserved)", "construction-task-status"));
        item.appendChild(element("p", `Planned: ${Financials.format(task.estimatedCost || 0)} · Recorded: ${Financials.format(Financials.taskActual(projectState, stage.id, task.id))}`));
        item.appendChild(element("p", taskDates(task), "construction-task-dates"));
        if (task.critical) item.appendChild(element("p", Construction.guidance(projectState, stage.id, task.id).critical, "construction-critical"));
        item.appendChild(element("p", typeof task.notes === "string" && task.notes ? task.notes : "No task notes yet.", "construction-note-preview"));
        item.appendChild(element("p", Array.isArray(task.evidence) && task.evidence.length ? `${task.evidence.length} evidence file(s) attached` : "No evidence attached.", "construction-evidence-count"));
        const actions = element("div", undefined, "construction-actions");
        if (task.status !== "completed") {
          if (task.status !== "active") {
            const start = element("button", "Start task", "construction-secondary");
            start.type = "button"; start.dataset.action = "start";
            start.onclick = () => startTask(stage.id, task.id);
            actions.appendChild(start);
          }
          const complete = element("button", "Complete task", "primary-btn");
          complete.type = "button"; complete.dataset.action = "complete";
          complete.onclick = () => openTaskModal(stage.id, task.id);
          actions.appendChild(complete);
        }
        const details = element("button", task.status === "completed" ? "View details" : "Notes & evidence", "construction-secondary");
        details.type = "button"; details.dataset.action = "details";
        details.onclick = () => openTaskModal(stage.id, task.id);
        actions.appendChild(details);
        item.appendChild(actions);
        appendTaskExpenseAction(item, stage, task);
        window.ContractorSupport?.taskControls(item, stage, task);
        body.appendChild(item);
      }
      card.appendChild(body); list.appendChild(card);
    }
    if (progress.isCompleted) {
      const complete = element("li", undefined, "project-complete-msg construction-summary");
      complete.append(element("h3", "Project Completed"), element("p", "All recorded project tasks are completed. This is not a construction safety certification."));
      const link = element("a", "View all projects"); link.href = "projects.html";
      const create = element("a", "Create another project"); create.href = "create-project.html";
      const actions = element("div", undefined, "construction-actions"); actions.append(link, create); complete.appendChild(actions);
      list.appendChild(complete);
    }
    window.ContractorSupport?.workspace();
  }
  function currentButton() {
    const container = document.getElementById("currentActionButton");
    if (!container) return;
    container.replaceChildren();
    if (!projectState) return;
    const selected = window.TaskNavigation?.current(projectState);
    const next = selected?.task.status !== 'completed' && selected ? selected : window.TaskNavigation?.unfinished(projectState)[0] || Construction.nextTask(projectState);
    if (!next) { container.appendChild(element("p", "All project tasks completed. Revisit any stage to view notes and files.")); return; }
    const button = element("button", next.task.status === "active" ? "Continue" : "Start Task", "btn-primary-full");
    button.type = "button";
    button.onclick = () => next.task.status === "active" ? openTaskModal(next.stage.id, next.task.id) : startTask(next.stage.id, next.task.id);
    container.appendChild(button);
  }
  function currentCard() {
    if (!projectState) return;
    const selected = window.TaskNavigation?.current(projectState);
    const next = selected?.task.status !== 'completed' && selected ? selected : window.TaskNavigation?.unfinished(projectState)[0] || Construction.nextTask(projectState);
    const stage = document.querySelector(".action-stage"), task = document.querySelector(".action-task"), cost = document.querySelector(".action-cost"), insights = document.querySelector(".insight-list");
    if (stage) stage.textContent = Construction.projectLabel(projectState);
    if (task) task.textContent = next ? `${next.stage.name}: ${next.task.name}` : "All project tasks completed";
    if (cost) cost.textContent = next ? `Planned: ${Financials.format(next.task.estimatedCost || 0)} · Recorded: ${Financials.format(Financials.taskActual(projectState, next.stage.id, next.task.id))}` : "";
    if (insights) {
      insights.replaceChildren();
      insights.appendChild(element("li", "Task completion is recorded independently of expenditure. Contractor assignment is optional."));
      if (next?.task.critical) insights.appendChild(element("li", Construction.guidance(projectState, next.stage.id, next.task.id).critical));
    }
  }
  function releaseEvidenceUrls() { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); }
  function evidenceList(project, stageId, task) {
    releaseEvidenceUrls();
    const list = document.getElementById("taskEvidenceList");
    if (!list) return;
    list.replaceChildren();
    const entries = Array.isArray(task.evidence) ? task.evidence : [];
    if (!entries.length) { list.appendChild(element("p", "No files uploaded to this task yet.")); return; }
    for (const entry of entries) {
      if (!entry || typeof entry.id !== "string" || typeof entry.type !== "string" || typeof entry.name !== "string") {
        list.appendChild(element("p", "An older file record is preserved but cannot be previewed here."));
        continue;
      }
      const row = element("div", undefined, "construction-evidence-entry");
      row.appendChild(element("p", `${entry.name} · ${Math.ceil(entry.size / 1024)} KB`));
      const button = element("button", entry.type.startsWith("image/") ? "View image" : "Download PDF", "construction-secondary");
      button.type = "button";
      button.onclick = async () => {
        button.disabled = true;
        try {
          const file = await EvidenceStore.get(entry.id, { projectId: project.id, stageId, taskId: task.id });
          if (currentTaskContext.projectId !== project.id || currentTaskContext.taskId !== task.id) return;
          const url = URL.createObjectURL(file.blob); urls.add(url);
          if (entry.type.startsWith("image/")) {
            row.querySelector("img")?.remove();
            const image = element("img"); image.alt = `Task file: ${entry.name}`; image.src = url; image.className = "construction-evidence-preview"; row.appendChild(image);
          } else {
            const link = element("a"); link.href = url; link.download = file.name; link.click();
          }
        } catch (error) { row.appendChild(element("p", error.message, "construction-error")); }
        finally { button.disabled = false; }
      };
      row.appendChild(button); list.appendChild(row);
    }
  }
  window.ConstructionUI = Object.freeze({ message, confirmGuidance, focusStage, tracker, tasks, currentButton, currentCard, releaseEvidenceUrls, evidenceList });
})();
