(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    if (!projectState || !document.getElementById("expenseForm")) return;
    const $ = id => document.getElementById(id);
    let editingId = null;
    let editingUpdatedAt = null;
    let submissionId = null;
    let saving = false;
    const option = (select, value, label) => {
      const element = document.createElement("option");
      element.value = value;
      element.textContent = label;
      select.appendChild(element);
    };
    for (const select of [$("expenseCategory"), $("filterCategory")]) {
      option(select, "", select.id === "filterCategory" ? "All categories" : "Choose category");
      Financials.CATEGORIES.forEach(category => option(select, category, category));
    }
    for (const select of [$("expenseStage"), $("filterStage")]) {
      option(select, "", select.id === "filterStage" ? "All stages" : "No stage");
      projectState.stages.forEach(stage => option(select, stage.id, stage.name));
    }
    function populateTasks(taskId = "") {
      $("expenseTask").replaceChildren();
      option($("expenseTask"), "", "No task");
      const stage = projectState.stages.find(stage => stage.id === $("expenseStage").value);
      stage?.tasks.forEach(task => option($("expenseTask"), task.id, task.name));
      $("expenseTask").value = taskId;
      $("expenseTask").disabled = !stage;
    }
    $("expenseStage").addEventListener("change", () => populateTasks());
    function openEditor(expense = null) {
      editingId = expense?.id || null;
      editingUpdatedAt = expense?.updatedAt || null;
      submissionId = Financials.id();
      $("expenseForm").reset();
      $("expenseEditorTitle").textContent = expense ? "Edit expense" : "Add expense";
      $("expenseDate").value = expense?.date || Financials.today();
      $("expenseAmount").value = expense?.amount ?? "";
      $("expenseDescription").value = expense?.description || "";
      $("expenseCategory").value = expense?.category || "";
      $("expenseStage").value = expense?.stageId || "";
      populateTasks(expense?.taskId || "");
      $("expenseNotes").value = expense?.notes || "";
      $("expenseFormError").textContent = "";
      $("expenseEditor").hidden = false;
      $("expenseDescription").focus();
    }
    function closeEditor() {
      $("expenseEditor").hidden = true;
      editingId = null;
      submissionId = null;
      $("addExpenseBtn").focus();
    }
    $("addExpenseBtn").addEventListener("click", () => openEditor());
    $("cancelExpenseBtn").addEventListener("click", closeEditor);
    $("expenseForm").addEventListener("submit", event => {
      event.preventDefault();
      if (saving || !submissionId || $("expenseEditor").hidden) return;
      saving = true;
      $("saveExpenseBtn").disabled = true;
      try {
        const values = { date: $("expenseDate").value, amount: $("expenseAmount").value, description: $("expenseDescription").value, category: $("expenseCategory").value, stageId: $("expenseStage").value, taskId: $("expenseTask").value, notes: $("expenseNotes").value };
        persistExpenseChange(project => {
          if (editingId && project.expenses.find(expense => expense.id === editingId)?.updatedAt !== editingUpdatedAt) {
            throw new Error("This expense changed in another tab. Cancel and reload before editing it.");
          }
          return Financials.upsert(project, values, editingId, submissionId);
        });
        $("financeMessage").textContent = editingId ? "Expense updated." : "Expense recorded.";
        closeEditor();
        render();
      } catch (error) {
        $("expenseFormError").textContent = error.message;
      } finally {
        saving = false;
        $("saveExpenseBtn").disabled = false;
      }
    });
    function paragraph(parent, text, className = "") {
      const element = document.createElement("p");
      element.textContent = text;
      if (className) element.className = className;
      parent.appendChild(element);
      return element;
    }
    function render() {
      const financials = Financials.calculate(projectState);
      $("expenseProjectName").textContent = projectState.projectName || "Untitled Project";
      $("financeBudget").textContent = Financials.format(financials.budget);
      $("financeSpent").textContent = Financials.format(financials.spent);
      $("financeBalanceLabel").textContent = financials.remaining < 0 ? "Over budget by" : "Remaining budget";
      $("financeBalance").textContent = Financials.format(financials.remaining === null ? null : Math.abs(financials.remaining));
      $("financeBalance").classList.toggle("finance-over", financials.remaining < 0);
      $("financeRevision").textContent = projectState.estimateRevisions?.length ? `Estimate revised ${projectState.estimateRevisions.length} time(s). Recorded expenses and completed work are preserved.` : "";
      const legacyText = legacyFinancialNotice(projectState);
      $("financeLegacy").hidden = !legacyText;
      $("financeLegacy").textContent = legacyText;
      $("addExpenseBtn").disabled = !financials.available;
      if (!financials.available) $("financeMessage").textContent = financials.error;
      const list = $("expenseList");
      list.replaceChildren();
      let entries = [];
      if (financials.available) entries = Financials.ledger(projectState).filter(expense =>
        (!$("filterCategory").value || expense.category === $("filterCategory").value) &&
        (!$("filterStage").value || expense.stageId === $("filterStage").value) &&
        (!$("filterFrom").value || expense.date >= $("filterFrom").value) &&
        (!$("filterTo").value || expense.date <= $("filterTo").value)
      ).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      const filteredCents = entries.reduce((sum, expense) => sum + Financials.cents(expense.amount), 0);
      $("expenseFilterSummary").textContent = financials.available ? `${entries.length} expense(s) shown · ${Financials.format(filteredCents / 100)}. Summary above includes all recorded expenses.` : "Expense records need review before totals can be shown.";
      if (!entries.length) paragraph(list, financials.available ? (financials.count ? "No expenses match these filters." : "No expenses recorded yet. Add an expense here or from a task; completing a task alone does not add spending.") : "Existing records are preserved. No financial records were replaced.", "finance-empty");
      for (const expense of entries) {
        const article = document.createElement("article");
        article.className = "finance-expense";
        article.dataset.expenseId = expense.id;
        const header = document.createElement("div");
        header.className = "finance-expense-header";
        const title = document.createElement("h3");
        title.textContent = expense.description;
        const amount = document.createElement("strong");
        amount.textContent = Financials.format(expense.amount);
        header.append(title, amount);
        article.appendChild(header);
        const stage = projectState.stages.find(stage => stage.id === expense.stageId);
        const task = stage?.tasks.find(task => task.id === expense.taskId);
        paragraph(article, [expense.date, expense.category, stage?.name || "No stage", task?.name].filter(Boolean).join(" · "));
        if (expense.notes) paragraph(article, expense.notes);
        const actions = document.createElement("div");
        actions.className = "finance-actions";
        for (const action of ["Edit", "Delete"]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "secondary-btn";
          button.textContent = action;
          button.setAttribute("aria-label", `${action} expense: ${expense.description}`);
          button.addEventListener("click", () => {
            if (action === "Edit") return openEditor(expense);
            if (!window.confirm(`Delete expense "${expense.description}" (${Financials.format(expense.amount)})?`)) return;
            try {
              persistExpenseChange(project => {
                if (project.expenses.find(item => item.id === expense.id)?.updatedAt !== expense.updatedAt) {
                  throw new Error("This expense changed in another tab. Reload before deleting it.");
                }
                Financials.remove(project, expense.id);
              });
              if (editingId === expense.id) closeEditor();
              $("financeMessage").textContent = "Expense deleted. Recorded totals have been updated.";
              render();
            } catch (error) { $("financeMessage").textContent = error.message; }
          });
          actions.appendChild(button);
        }
        article.appendChild(actions);
        list.appendChild(article);
      }
      $("financeStages").replaceChildren();
      for (const stage of projectState.stages) {
        const card = document.createElement("section");
        card.className = "finance-stage";
        const title = document.createElement("h3");
        title.textContent = stage.name;
        card.appendChild(title);
        const summary = financials.stages[stage.id];
        paragraph(card, `Planned: ${Financials.format(summary.planned)}`);
        paragraph(card, `Recorded: ${Financials.format(financials.available ? summary.actual : null)}`);
        $("financeStages").appendChild(card);
      }
      const assigned = Object.values(financials.stages).reduce((sum, stage) => sum + Math.round(stage.actual * 100), 0) / 100;
      $("financeUnallocated").textContent = financials.available ? `Recorded without a stage: ${Financials.format(Math.round((financials.spent - assigned) * 100) / 100)}. Stage totals include task-linked expenses; expenses without a task remain included in their stage.` : "";
    }
    ["filterCategory", "filterStage", "filterFrom", "filterTo"].forEach(id => $(id).addEventListener("change", render));
    $("clearExpenseFilters").addEventListener("click", () => { ["filterCategory", "filterStage", "filterFrom", "filterTo"].forEach(id => { $(id).value = ""; }); render(); });
    render();
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1" && Financials.calculate(projectState).available) {
      openEditor();
      const stage = projectState.stages.find(stage => stage.id === params.get("stage"));
      if (stage) {
        $("expenseStage").value = stage.id;
        const task = stage.tasks.find(task => task.id === params.get("task"));
        populateTasks(task?.id || "");
        if (task) $("expenseDescription").value = `${task.name} expense`;
      }
    }
    window.addEventListener("storage", event => {
      if (event.key === "projects" || event.key === "currentProjectId") {
        $("financeMessage").textContent = "Project data changed in another tab. Reload before editing further.";
      }
    });
  });
})();
