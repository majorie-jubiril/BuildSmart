/* Shared financial rules. Amounts are stored in cedis and summed in pesewas. */
(function () {
  "use strict";
  const STAGE_WEIGHTS = Object.freeze({ foundation: 20, structure: 30, roofing: 20, windows: 10, finishing: 20 });
  const CATEGORIES = Object.freeze(["Materials", "Labour", "Equipment", "Transport", "Permits & fees", "Other"]);
  const id = () => window.crypto?.randomUUID?.() || `expense_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function cents(value, allowZero = false) {
    const text = String(value).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Enter a valid amount with at most two decimal places.");
    const amount = Number(text);
    const result = Math.round(amount * 100);
    if (!Number.isFinite(amount) || !Number.isSafeInteger(result) || (allowZero ? result < 0 : result <= 0)) {
      throw new Error("Enter a positive amount within the supported range.");
    }
    return result;
  }
  const format = value => value === null ? "Unavailable" : `GH₵${Number(value || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
  }
  function budget(project) {
    const value = project?.estimate?.totalCost ?? project?.budget ?? 0;
    const amount = Number(value);
    const rounded = Math.round(amount * 100);
    return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(rounded) ? rounded / 100 : 0;
  }
  function validate(project, input) {
    const amount = cents(input.amount) / 100;
    const description = String(input.description || "").trim();
    if (!description || description.length > 240) throw new Error("Enter a description of up to 240 characters.");
    if (!validDate(String(input.date || ""))) throw new Error("Enter a valid expense date.");
    if (!CATEGORIES.includes(input.category)) throw new Error("Choose an expense category.");
    const stageId = input.stageId || null;
    const taskId = input.taskId || null;
    const stage = project.stages?.find(item => item.id === stageId);
    if (stageId && !stage) throw new Error("Choose a stage from this project.");
    if (taskId && !stage?.tasks?.some(task => task.id === taskId)) throw new Error("Choose a task from the selected stage.");
    const notes = String(input.notes || "").trim();
    if (notes.length > 4000) throw new Error("Keep notes within 4,000 characters.");
    return { date: input.date, description, amount, category: input.category, stageId, taskId, notes };
  }
  function ledger(project) {
    if (project.expenses === undefined) return [];
    if (!Array.isArray(project.expenses)) throw new Error("Existing expense data is unfamiliar. It has been preserved; recording is paused until it can be reviewed.");
    const ids = new Set();
    let total = 0;
    for (const expense of project.expenses) {
      if (!expense || expense.projectId !== project.id || !expense.id || ids.has(expense.id) || typeof expense.createdAt !== "string" || typeof expense.updatedAt !== "string") throw new Error("Expense identity needs review. Existing records have been preserved.");
      validate(project, expense);
      ids.add(expense.id);
      total += cents(expense.amount);
      if (!Number.isSafeInteger(total)) throw new Error("Recorded expense total exceeds the supported range.");
    }
    return project.expenses;
  }
  function allocate(project) {
    if (!project.estimate || !Array.isArray(project.stages)) return;
    const total = cents(budget(project), true);
    const signature = project.stages.map(stage => `${stage.id}:${stage.tasks?.length || 0}`).join("|");
    if (project.allocationVersion === 1 && project.allocationBudgetCents === total && project.allocationTaskSignature === signature) return;
    const entries = Object.entries(STAGE_WEIGHTS).map(([key, weight]) => ({ key, value: Math.floor(total / 100) * weight + Math.floor((total % 100) * weight / 100), remainder: (total % 100) * weight % 100 }));
    let leftover = total - entries.reduce((sum, entry) => sum + entry.value, 0);
    for (const entry of [...entries].sort((a, b) => b.remainder - a.remainder)) {
      if (leftover-- > 0) entry.value++;
    }
    const breakdown = {};
    for (const entry of entries) {
      breakdown[entry.key] = entry.value / 100;
      const stage = project.stages.find(stage => stage.id === entry.key);
      if (!stage?.tasks?.length) continue;
      const base = Math.floor(entry.value / stage.tasks.length);
      const remainder = entry.value % stage.tasks.length;
      stage.tasks.forEach((task, index) => { task.estimatedCost = (base + (index < remainder ? 1 : 0)) / 100; });
    }
    project.estimate.breakdown = breakdown;
    project.budget = total / 100;
    project.costDistributed = true;
    project.allocationVersion = 1;
    project.allocationBudgetCents = total;
    project.allocationTaskSignature = signature;
  }
  function prepareProject(project) {
    if (!project.financialLedgerVersion) {
      if (!project.legacyFinancials) {
        project.legacyFinancials = {
          capturedAt: new Date().toISOString(),
          status: "unreconciled",
          spent: project.spent ?? 0,
          estimateTotal: project.estimate?.totalCost ?? project.budget ?? 0,
          taskActualCosts: (project.stages || []).flatMap(stage => (stage.tasks || []).map(task => ({ stageId: stage.id, taskId: task.id, actualCost: task.actualCost ?? 0 }))),
          estimateBreakdown: project.estimate?.breakdown ? JSON.parse(JSON.stringify(project.estimate.breakdown)) : null
        };
      }
      if (project.expenses === undefined) project.expenses = [];
      project.financialLedgerVersion = 1;
    }
    // No legacy amount is turned into an expense. Original spent/actualCost fields remain historical only.
    allocate(project);
    return project;
  }
  function calculate(project) {
    const planned = budget(project);
    const stages = {}, tasks = {};
    for (const stage of project?.stages || []) {
      stages[stage.id] = { planned: (stage.tasks || []).reduce((sum, task) => sum + Math.round((task.estimatedCost || 0) * 100), 0) / 100, actual: 0 };
      for (const task of stage.tasks || []) tasks[`${stage.id}/${task.id}`] = 0;
    }
    let entries;
    try { entries = ledger(project); } catch (error) { return { available: false, error: error.message, budget: planned, spent: null, remaining: null, variance: null, stages, tasks, count: 0 }; }
    let total = 0;
    for (const expense of entries) {
      const amount = cents(expense.amount);
      total += amount;
      if (expense.stageId) stages[expense.stageId].actual += amount;
      if (expense.taskId) tasks[`${expense.stageId}/${expense.taskId}`] += amount;
    }
    for (const stage of Object.values(stages)) stage.actual /= 100;
    for (const key of Object.keys(tasks)) tasks[key] /= 100;
    const spent = total / 100;
    return { available: true, budget: planned, spent, remaining: (Math.round(planned * 100) - total) / 100, variance: planned ? (spent - planned) / planned * 100 : 0, stages, tasks, count: entries.length };
  }
  const taskActual = (project, stageId, taskId) => {
    const financials = calculate(project);
    return financials.available ? financials.tasks[`${stageId}/${taskId}`] || 0 : null;
  };
  function upsert(project, input, expenseId, submissionId) {
    const entries = ledger(project);
    const values = validate(project, input);
    const duplicate = submissionId && entries.find(expense => expense.submissionId === submissionId);
    if (!expenseId && duplicate) return duplicate;
    const existing = expenseId ? entries.find(expense => expense.id === expenseId) : null;
    if (expenseId && !existing) throw new Error("This expense is no longer available. Refresh the list.");
    const stamp = new Date().toISOString();
    const expense = { ...existing, ...values, id: existing?.id || id(), projectId: project.id, createdAt: existing?.createdAt || stamp, updatedAt: stamp, submissionId: existing?.submissionId || submissionId || id() };
    const next = existing ? entries.map(item => item.id === expenseId ? expense : item) : [...entries, expense];
    let total = 0;
    for (const item of next) total += cents(item.amount);
    if (!Number.isSafeInteger(total)) throw new Error("Recorded expense total exceeds the supported range.");
    project.expenses = next;
    return expense;
  }
  function remove(project, expenseId) {
    const entries = ledger(project);
    if (!entries.some(expense => expense.id === expenseId)) throw new Error("This expense is no longer available.");
    project.expenses = entries.filter(expense => expense.id !== expenseId);
  }
  function forecast(project, stageId) {
    const financials = calculate(project);
    if (!financials.available || !financials.count) return null;
    const stages = (project.stages || []).filter(stage => !stageId || stage.id === stageId);
    let remainingCents = 0;
    for (const stage of stages) for (const task of stage.tasks) {
      if (task.status !== "completed") remainingCents += Math.max(0, Math.round(task.estimatedCost * 100) - Math.round(taskActual(project, stage.id, task.id) * 100));
    }
    const estimated = stageId ? financials.stages[stageId].planned : financials.budget;
    const actual = stageId ? financials.stages[stageId].actual : financials.spent;
    const projectedTotal = (Math.round(actual * 100) + remainingCents) / 100;
    const variance = Math.round((projectedTotal - estimated) * 100) / 100;
    return { estimated, actual, projectedTotal, variance, variancePercent: estimated ? (variance / estimated * 100).toFixed(1) : "0.0", isOver: variance > 0 };
  }
  window.Financials = Object.freeze({ STAGE_WEIGHTS, CATEGORIES, id, today, cents, format, budget, validate, ledger, allocate, prepareProject, calculate, taskActual, upsert, remove, forecast });
})();
