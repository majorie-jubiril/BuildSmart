console.log("SCRIPT LOADED");

// =========================
// GLOBAL STATE
// =========================
const AppState = {
  selectedContractor: null,
  savedContractors: JSON.parse(localStorage.getItem("savedContractors")) || [],
  estimateData: JSON.parse(localStorage.getItem("estimateData")) || null,
};

// =========================
// PROJECT/TASK STATE (SINGLE SOURCE OF TRUTH)
// =========================
let projectState = null;
let currentTaskContext = {
  stageId: null,
  taskId: null
};

// =========================
// TASK ROLE
// =========================
const TASK_ROLE_MAP = {
  "site-clearing": ["excavation"],
  "site-layout": ["surveyor"],
  "foundation": ["foundation specialist", "mason"],
  "blockwork": ["mason"],
  "roofing": ["carpenter"],
  "plumbing": ["plumber"],
  "electrical": ["electrician"]
};

// =========================
// NORMALIZE ROLE
// =========================
function normalizeRole(role) {
  return String(role || "").toLowerCase().trim();
}

// =========================
// ROLE RESOLVER
// =========================
function resolveRole(role) {
  return String(role || "").toLowerCase().trim();
}

// =========================
// ROLE COMPATIBILITY
// =========================
const ROLE_COMPATIBILITY = {
  engineer: ["engineer", "structural engineer"],
  mason: ["mason", "foundation specialist"],
  surveyor: ["surveyor"],
  "excavation specialist": ["excavation specialist"]
};

// =========================
// UI STATE (STAGE TOGGLE)
// =========================
let expandedStages = {};

// =========================
// MULTI PROJECT STORAGE
// =========================
let projects = JSON.parse(localStorage.getItem("projects")) || [];
let currentProjectId = localStorage.getItem("currentProjectId") || null;

// =========================
// CONTRACTOR CAPABILITY MATRIX
// =========================
const capabilityMatrix = {
  "Surveyor": ["survey", "layout", "marking"],

  "Excavation Specialist": ["excavation", "site-clearing", "earthworks"],

  "Foundation Specialist": ["foundation", "footing", "concrete", "blockwork"],

  "Mason": ["blockwork", "plastering", "screeding", "concrete"],

  "Structural Engineer": ["structural", "inspection", "reinforcement", "design"],

  "Carpenter": ["roof-frame", "ceiling", "formwork", "door-install", "frame-fix"],

  "Roofer": ["roof-cover", "roofing", "waterproofing", "carpenter", "mason" ],

  "Plumber": ["plumbing", "pipes", "drainage", "gutter"],

  "Electrician": ["electrical", "wiring", "installation"],

  "Tiler": ["tiling", "flooring", "mason"],

  "Painter": ["painting", "finishing"]
};

// ===============================
// 🧠 CAPABILITY CHECK HELPER
// ===============================
function hasRequiredCapability(hiredContractors, requiredCapability) {
  if (!hiredContractors || Object.keys(hiredContractors).length === 0) {
    return false;
  }

  return Object.keys(hiredContractors).some(role => {
    const normalizedRole = resolveRole(role);

    // 🔥 IMPORTANT: your matrix keys are capitalized
    const formattedRole =
      normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);

    const capabilities = capabilityMatrix[formattedRole] || [];

    return capabilities.some(c =>
      c.toLowerCase().includes(requiredCapability.toLowerCase())
    );
  });
}

// ===============================
// 🎯 CONTRACTOR ROUTING MAP (NEW)
// ===============================
const CONTRACTOR_ROLE_MAP = {
  general: "General Contractor",
  surveyor: "Surveyor",
  excavation: "Excavation Specialist",
  mason: "Mason",
  engineer: "Structural Engineer",
  carpenter: "Carpenter",
  roofer: "Roofer",
  plumber: "Plumber",
  electrician: "Electrician",
  tiler: "Tiler",
  painter: "Painter"
};

// =========================
// GLOBAL NAVIGATION
// =========================
function goTo(page) {
  window.location.href = page;
}

// ===============================
// 🚀 ROUTE TO CONTRACTORS (SMART)
// ===============================
function routeToContractors(requiredRole) {
  if (!requiredRole) {
    window.location.href = "contractors.html";
    return;
  }

  const roleKey = resolveRole(requiredRole);

  // 🔍 Check availability BEFORE routing
  const cards = document.querySelectorAll(".contractor-card");

  const available = Array.from(cards).some(card => {
    const role = resolveRole(card.dataset.role);
    return role === roleKey;
  });

  if (!available) {
    showAlert(
      `No ${roleKey} available right now. You can still browse or add one.`,
      () => {
        window.location.href = "contractors.html";
      }
    );
    return; // 🚨 IMPORTANT: stop immediate navigation
  }

  window.location.href = "contractors.html";
}

// ===============================
// DYNAMIC TASK GENERATOR (CLEAN)
// ===============================
function generateStageTasks(stageId) {
  const taskMap = {

    foundation: [
      { id: "site-clearing", name: "Site Clearing", requiredContractor: "foundation specialist", requiredCapability: "site clearing", critical: false },
      { id: "site-layout", name: "Site Layout & Marking", requiredContractor: "surveyor", requiredCapability: "survey", critical: false },
      { id: "excavation", name: "Excavation", requiredContractor: "excavation specialist", requiredCapability: "excavation", critical: false },
      { id: "footing", name: "Footing Construction", requiredContractor: "mason", requiredCapability: "foundation", critical: true },
      { id: "foundation-wall", name: "Foundation Blockwork", requiredContractor: "mason", requiredCapability: "blockwork", critical: false },
      { id: "dpc", name: "Damp Proof Course (DPC)", requiredContractor: "mason", requiredCapability: "concrete works", critical: false },
      { id: "backfilling", name: "Backfilling & Compaction", requiredContractor: "foundation specialist", requiredCapability: "site clearing", critical: false }
    ],

    structure: [
      { id: "blockwork-super", name: "Wall Blockwork", requiredContractor: "mason", requiredCapability: "blockwork", critical: false },
      { id: "columns", name: "Column Reinforcement", requiredContractor: "engineer", requiredCapability: "structural design", critical: true },
      { id: "lintel", name: "Lintel Casting", requiredContractor: "mason", requiredCapability: "concrete works", critical: false },
      { id: "beam", name: "Beam Construction", requiredContractor: "engineer", requiredCapability: "structural design", critical: true },
      { id: "slab", name: "Slab Casting", requiredContractor: "engineer", requiredCapability: "structural design", critical: true }
    ],

    roofing: [
      { id: "roof-frame", name: "Roof Framing", requiredContractor: "carpenter", requiredCapability: "woodwork", critical: false },
      { id: "roof-cover", name: "Roof Covering", requiredContractor: "roofer", requiredCapability: "roofing", critical: false },
      { id: "roof-waterproof", name: "Waterproofing", requiredContractor: "roofer", requiredCapability: "roofing", critical: false },
      { id: "gutter", name: "Gutter Installation", requiredContractor: "plumber", requiredCapability: "plumbing", critical: false }
    ],

    windows: [
      { id: "window-install", name: "Window Installation", requiredContractor: "carpenter", requiredCapability: "woodwork", critical: false },
      { id: "door-install", name: "Door Installation", requiredContractor: "carpenter", requiredCapability: "woodwork", critical: false },
      { id: "frame-fix", name: "Frame Fixing", requiredContractor: "carpenter", requiredCapability: "woodwork", critical: false }
    ],

    finishing: [
      { id: "plastering", name: "Plastering", requiredContractor: "mason", requiredCapability: "plastering", critical: false },
      { id: "screeding", name: "Screeding", requiredContractor: "mason", requiredCapability: "plastering", critical: false },
      { id: "ceiling", name: "Ceiling Installation", requiredContractor: "carpenter", requiredCapability: "woodwork", critical: false },
      { id: "tiling", name: "Tiling", requiredContractor: "tiler", requiredCapability: "tiling", critical: false },
      { id: "painting", name: "Painting", requiredContractor: "painter", requiredCapability: "painting", critical: false },
      { id: "electrical", name: "Electrical Works", requiredContractor: "electrician", requiredCapability: "electrical", critical: true },
      { id: "plumbing", name: "Plumbing Works", requiredContractor: "plumber", requiredCapability: "plumbing", critical: true },
      { id: "fixtures", name: "Fixtures", requiredContractor: "carpenter", requiredCapability: "woodwork", critical: false }
    ]
  };

  return (taskMap[stageId] || []).map((task, index) => ({
    ...task,
    status: "pending",
    progress: 0,

    // 🆕 INTELLIGENCE LAYER
    estimatedCost: 0,
    actualCost: 0
  }));
}

// ===============================
// CONTRACTOR EVALUATION ENGINE (FIXED)
// ===============================
function evaluateContractor(contractorRole, requiredRole) {
  const role = normalizeRole(contractorRole);
  const required = normalizeRole(requiredRole);

  let mappedRole = role;

  // 🔁 ROLE MAPPING (CLEAN)
  if (role.includes("foundation")) mappedRole = "mason";
  if (role.includes("block")) mappedRole = "mason";
  if (role.includes("structural")) mappedRole = "engineer";
  if (role.includes("electrical")) mappedRole = "electrician";

  // =========================
  // GENERAL TASK (FLEXIBLE)
  // =========================
  if (required === "any") {
    return { status: "acceptable" };
  }

  // =========================
  // STRICT SPECIALIZATION
  // =========================
  if (required === "engineer") {
    return mappedRole === "engineer"
      ? { status: "perfect" }
      : { status: "invalid" };
  }

  if (required === "electrician") {
    return mappedRole === "electrician"
      ? { status: "perfect" }
      : { status: "invalid" };
  }

  if (required === "mason") {
    if (mappedRole === "mason") return { status: "perfect" };
  }

  // =========================
  // FLEX MATCH
  // =========================
  if (mappedRole.includes(required)) {
    return { status: "perfect" };
  }

  // =========================
  // SMART FALLBACKS
  // =========================
  if (required === "mason" && role.includes("foundation")) {
    return { status: "acceptable" };
  }

  if (mappedRole === "engineer" && required !== "engineer") {
    return { status: "overqualified" };
  }

  return { status: "invalid" };
}

// ===============================
// DEFAULT STAGES
// ===============================
function getDefaultStages() {
  return [
    { id: "foundation", name: "Foundation", tasks: [] },
    { id: "structure", name: "Structure", tasks: [] },
    { id: "roofing", name: "Roofing", tasks: [] },
    { id: "windows", name: "Windows", tasks: [] },
    { id: "finishing", name: "Finishing", tasks: [] }
  ];
}

// ===============================
// INITIALIZE PROJECT STATE (STRICT + SAFE)
// ===============================
function initializeProjectState() {
  let state = null;

  // =========================
  // LOAD ACTIVE PROJECT
  // =========================
  if (currentProjectId) {
    state = projects.find(p => p.id === currentProjectId) || null;
  }

  // =========================
  // 🚫 NO FALLBACK CREATION
  // =========================
  if (!state) {
    currentProjectId = null;
    localStorage.removeItem("currentProjectId");
    console.warn("⚠️ No active project found");
    return null; // ❗ STOP here — do NOT fabricate a project
  }

  console.log("📦 Loaded project state:", state);

  // =========================
  // ✅ DATA HYDRATION (BACKWARD COMPATIBILITY)
  // =========================

  if (!state.completedStages) {
    state.completedStages = [];
  }

  // Compatibility stage selection is reconciled from tasks below.

  if (!state.stages || state.stages.length === 0) {
    state.stages = getDefaultStages();
  }

  // =========================
  // 🔧 ENSURE TASK STRUCTURE
  // =========================
  state.stages.forEach(stage => {
    // Ensure tasks exist
    if (!stage.tasks || stage.tasks.length === 0) {
      stage.tasks = generateStageTasks(stage.id);
    }

    // 🔥 ALWAYS normalize tasks (CRITICAL FIX)
    stage.tasks = stage.tasks.map(task => ({
      status: task.status || "pending", // preserve existing if present
      ...task
    }));
});

  // =========================
  // 🔁 SYNC BACK TO STORAGE (IMPORTANT)
  // =========================
  Construction.reconcile(state);
  Financials.prepareProject(state);
  const index = projects.findIndex(p => p.id === state.id);
  if (index !== -1) {
    projects[index] = state;
    localStorage.setItem("projects", JSON.stringify(projects));
  }

  return state;
}

// ===============================
// SAVE PROJECT STATE
// ===============================
function saveProjectState() {
  if (!projectState) return;

  // =========================
  // UPDATE CURRENT PROJECT
  // =========================
  const fresh = JSON.parse(localStorage.getItem("projects") || "[]");
  if (!Array.isArray(fresh)) throw new Error("Project records need review. No data was replaced.");
  const index = fresh.findIndex(p => p.id === projectState.id);
  if (index === -1) throw new Error("This project is no longer available. Reopen your projects.");
  // Nonfinancial actions must not replace newer ledger records from another tab.
  if (fresh[index].expenses !== undefined) projectState.expenses = fresh[index].expenses;
  if (fresh[index].legacyFinancials) projectState.legacyFinancials = fresh[index].legacyFinancials;
  // Cover/review edits commit independently against fresh records, like the ledger.
  for (const field of ["projectCover", "projectPhotos", "completionReview", "contractorAssignments"]) {
    if (Object.prototype.hasOwnProperty.call(fresh[index], field)) projectState[field] = fresh[index][field];
    else delete projectState[field];
  }
  fresh[index] = projectState;

  // =========================
  // SAVE EVERYTHING
  // =========================
  localStorage.setItem("projects", JSON.stringify(fresh));
  localStorage.setItem("currentProjectId", projectState.id);
  projects = fresh;
}

// ===============================
// LOAD PROJECT STATE INTO MEMORY
// ===============================
function loadProjectState() {
  projectState = initializeProjectState();

  // ✅ SAFETY: ensure pointer is always valid
  if (projectState?.id) {
    currentProjectId = projectState.id;
    localStorage.setItem("currentProjectId", currentProjectId);
  }
}

// Estimation and management always belong to an explicitly selected project.
function requireProjectContext() {
  if (projectState?.id === currentProjectId &&
      projects.some(project => project.id === currentProjectId)) {
    return true;
  }

  window.location.replace("create-project.html?reason=project-required");
  return false;
}

// Financial edits commit a fresh project collection before updating the visible state.
function persistExpenseChange(operation) {
  const storedId = localStorage.getItem("currentProjectId");
  if (!projectState || storedId !== currentProjectId || projectState.id !== currentProjectId) {
    throw new Error("Project selection changed. Reopen the project before recording an expense.");
  }
  const fresh = JSON.parse(localStorage.getItem("projects") || "[]");
  if (!Array.isArray(fresh)) throw new Error("Project records need review. No data was replaced.");
  const index = fresh.findIndex(project => project.id === currentProjectId);
  if (index < 0) throw new Error("This project is no longer available. No expense was saved.");
  const candidate = JSON.parse(JSON.stringify(fresh[index]));
  Financials.prepareProject(candidate);
  const result = operation(candidate);
  fresh[index] = candidate;
  localStorage.setItem("projects", JSON.stringify(fresh));
  projects = fresh;
  projectState = candidate;
  return result;
}

function legacyFinancialNotice(project) {
  const legacy = project?.legacyFinancials;
  if (!legacy) return "";
  const oldSpent = Number(legacy.spent) || 0;
  const oldTaskTotal = (legacy.taskActualCosts || []).reduce((sum, task) => sum + (Number(task.actualCost) || 0), 0);
  if (!oldSpent && !oldTaskTotal) return "";
  return `Unreconciled historical amounts: project figure ${Financials.format(oldSpent)}; task figures total ${Financials.format(oldTaskTotal)}. These may overlap and may have been generated from estimates. They are preserved separately and excluded from recorded spending. Add only expenses you can substantiate; do not add both totals automatically.`;
}

let taskUpdateBusy = false;

function recordTaskCompletion() { return updateTaskFromModal("completed"); }

async function updateTaskFromModal(target) {
  const modal = document.getElementById("taskModal");
  if (!modal || modal.classList.contains("hidden")) return { changed: false };
  const context = { ...currentTaskContext };
  const amount = document.getElementById("taskCostInput").value.trim();
  const expense = amount ? { amount, description: document.getElementById("taskExpenseDescription").value, date: document.getElementById("taskExpenseDate").value, category: document.getElementById("taskExpenseCategory").value, stageId: context.stageId, taskId: context.taskId, notes: document.getElementById("taskNotesInput").value } : null;
  const result = await requestTaskTransition(context.stageId, context.taskId, target, {
    projectId: context.projectId, notes: document.getElementById("taskNotesInput").value,
    files: [...document.getElementById("taskImageInput").files], expense,
    submissionId: context.submissionId, expectedUpdatedAt: context.updatedAt, fromModal: true
  });
  if (result.saved) closeTaskModal({ saved: true });
  return result;
}

async function requestTaskTransition(stageId, taskId, target, options = {}) {
  if (taskUpdateBusy) return { changed: false, busy: true };
  taskUpdateBusy = true;
  const buttons = [document.getElementById("confirmTaskBtn"), document.getElementById("saveTaskInfoBtn")].filter(Boolean);
  buttons.forEach(button => { button.disabled = true; });
  let storedFiles = { attachments: [], createdIds: [] };
  const scope = { projectId: options.projectId || projectState?.id, stageId, taskId };
  let committed = false;
  try {
    const load = () => {
      if (!projectState || scope.projectId !== projectState.id || currentProjectId !== scope.projectId || localStorage.getItem("currentProjectId") !== scope.projectId) throw new Error("Project selection changed. Reopen the project before updating this task.");
      const collection = JSON.parse(localStorage.getItem("projects") || "[]");
      if (!Array.isArray(collection)) throw new Error("Project records need review. No task data was replaced.");
      const index = collection.findIndex(project => project.id === scope.projectId);
      if (index < 0) throw new Error("This project is no longer available.");
      const candidate = JSON.parse(JSON.stringify(collection[index]));
      const reference = Construction.locate(candidate, stageId, taskId);
      return { collection, index, candidate, ...reference };
    };
    let loaded = load();
    if (options.fromModal && loaded.task.updatedAt !== options.expectedUpdatedAt) throw new Error("This task changed in another tab. Reopen it before saving your changes.");
    if (target && (loaded.task.status === "completed" || loaded.task.status === target)) return { changed: false, saved: false };
    const expectedUpdatedAt = loaded.task.updatedAt;
    if (options.notes !== undefined && (typeof options.notes !== "string" || options.notes.length > 4000)) throw new Error("Keep task notes within 4,000 characters.");
    if (options.expense) Financials.validate(loaded.candidate, options.expense);
    const files = options.files || [];
    if (files.length && loaded.task.evidence !== undefined && !Array.isArray(loaded.task.evidence)) throw new Error("Existing file records need review. They have been preserved; save notes without new files.");
    if (target) {
      const guidance = Construction.guidance(loaded.candidate, stageId, taskId);
      if (!options.acknowledged && !await ConstructionUI.confirmGuidance(guidance)) return { changed: false, cancelled: true };
    }
    if (files.length) storedFiles = await EvidenceStore.putMany(scope, files);
    loaded = load();
    if (loaded.task.updatedAt !== expectedUpdatedAt) throw new Error("This task changed in another tab. Reopen it before saving your changes.");
    if (target && loaded.task.status === "completed") return { changed: false, saved: false };
    const wasComplete = Construction.summary(loaded.candidate).isCompleted;
    const transition = target ? Construction.transition(loaded.candidate, stageId, taskId, target, true) : { changed: false };
    if (options.notes !== undefined) {
      if (loaded.task.notes !== options.notes) loaded.task.notesUpdatedAt = new Date().toISOString();
      loaded.task.notes = options.notes;
    }
    if (storedFiles.attachments.length) {
      const entries = new Map((loaded.task.evidence || []).map(entry => [entry.id, entry]));
      storedFiles.attachments.forEach(entry => entries.set(entry.id, entry));
      if (entries.size > EvidenceStore.LIMITS.taskFiles) throw new Error("A task can hold up to 6 files. Existing files have been preserved.");
      loaded.task.evidence = [...entries.values()];
    }
    if (options.notes !== undefined || storedFiles.attachments.length) loaded.task.updatedAt = new Date().toISOString();
    if (options.expense) Financials.upsert(loaded.candidate, options.expense, null, options.submissionId);
    const progress = Construction.reconcile(loaded.candidate);
    loaded.collection[loaded.index] = loaded.candidate;
    localStorage.setItem("projects", JSON.stringify(loaded.collection));
    committed = true;
    projects = loaded.collection;
    projectState = loaded.candidate;
    if (target === "completed" && transition.changed) {
      try { recordContractorTaskCompletion(stageId, loaded.task); } catch (error) { console.warn("Contractor performance record was not updated:", error); }
    }
    if (target === 'active') window.TaskNavigation?.remember(stageId, taskId);
    refreshUI();
    if (!wasComplete && progress.isCompleted) showProjectCompletion();
    ConstructionUI.message(target === "completed" ? "Task completed. Spending changes only when you explicitly record an expense." : target === "active" ? "Task started. Other stages remain available." : "Task details saved.");
    return { changed: transition.changed, saved: true };
  } catch (error) {
    if (options.fromModal) document.getElementById("taskExpenseError").textContent = error.message;
    ConstructionUI.message(error.message);
    return { changed: false, saved: false, error: error.message };
  } finally {
    if (!committed && storedFiles.createdIds.length) {
      try { await EvidenceStore.removeCreated(storedFiles.createdIds, scope); } catch (error) { ConstructionUI.message(error.message); }
    }
    buttons.forEach(button => { button.disabled = false; });
    taskUpdateBusy = false;
  }
}


function recordContractorTaskCompletion(stageId, task) {
const contractor = Object.values(projectState.hiredContractors || {})[0];

  if (contractor) {
  let performance = JSON.parse(localStorage.getItem("contractorPerformance")) || {};

  // =========================
  // 🧠 CONTRACTOR PERFORMANCE (UPGRADED)
  // =========================

  performance[contractor.name] = {
    completed: 0,
    totalVariance: 0,
    onBudget: 0,
    successful: 0 // ✅ FIX
  };

  const estimated = task.estimatedCost || 0;
  const actual = Financials.taskActual(projectState, stageId, task.id);
  const variance = actual - estimated;

  // update metrics
  performance[contractor.name].completed += 1;
  performance[contractor.name].totalVariance += variance;

  // on-budget tracker
  if (actual <= estimated) {
    performance[contractor.name].onBudget += 1;
  }

  localStorage.setItem("contractorPerformance", JSON.stringify(performance));

  // ✅ update inside the block (CRITICAL)
  performance[contractor.name].successful += 1;

  localStorage.setItem("contractorPerformance", JSON.stringify(performance));
}
}

function appendTaskExpenseAction(container, stage, task) {
  const link = document.createElement("a");
  link.className = "task-expense-link";
  link.href = `expenditure.html?new=1&stage=${encodeURIComponent(stage.id)}&task=${encodeURIComponent(task.id)}`;
  link.textContent = "Record expense";
  container.appendChild(link);
}

// ===============================
// RESET PROJECT
// ===============================
function resetProject() {
  if (!currentProjectId) return;

  // =========================
  // REMOVE CURRENT PROJECT ONLY
  // =========================
  projects = projects.filter(p => p.id !== currentProjectId);

  localStorage.setItem("projects", JSON.stringify(projects));

  // =========================
  // SET NEW CURRENT PROJECT
  // =========================
  if (projects.length > 0) {
    currentProjectId = projects[0].id;
  } else {
    currentProjectId = null;
  }

  localStorage.setItem("currentProjectId", currentProjectId);

  // =========================
  // RELOAD STATE
  // =========================
  projectState = initializeProjectState();

  alert("Project reset");

  window.location.href = "estimator.html";
}

// ===============================
// INIT CONTROLLER (SINGLE ENTRY POINT)
// ===============================
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  console.log("🚀 App Initialized");

  // =========================
  // LOAD STATE FIRST (CRITICAL)
  // =========================
  loadProjectState();

  const path = window.location.pathname;
  const requiresProject = ["estimator.html", "estimate-result.html", "project-details.html", "expenditure.html"]
    .some(page => path.endsWith(page));
  if (requiresProject && !requireProjectContext()) return;

  // =========================
  // GLOBAL FEATURES (ALL PAGES)
  // =========================
  initContractorSearch();
  initSaveButtonGlobal();

  // =========================
  // PAGE DETECTION
  // =========================

  if (path.includes("estimator.html")) {
    initEstimatorUI();
    initEstimateButton();
  }

  if (path.includes("contractors.html")) {
    initContractorList();
  }

  if (path.includes("contractor-profile.html")) {
    initContractorProfile();
  }

  if (path.includes("saved.html")) {
    initSavedPage();
  }

  if (path.includes("estimate-result.html")) {
    initEstimateResultPage();
  }

  if (path.includes("create-project.html")) {
    initCreateProject();
  }

  if (path.includes("index.html") || path === "/" || path === "") {
    updateDashboardUI();
  }

  if (path.includes("projects.html")) {
    initProjectsPage();
  }

  document.addEventListener("click", function (e) {

    // ✅ CONFIRM BUTTON
    if (e.target.id === "confirmTaskBtn") {
      console.log("CONFIRM CLICKED");

      recordTaskCompletion();
    }

    if (e.target.id === "saveTaskInfoBtn") { updateTaskFromModal(null); }

    // ✅ CANCEL BUTTON
    if (e.target.id === "cancelTaskBtn") {
      closeTaskModal();
    }

  });
}

// ===============================
// GLOBAL SAVE BUTTON HANDLER (CARDS)
// ===============================
function initSaveButtonGlobal() {
  document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const card = this.closest(".contractor-card");
      const contractor = extractContractorData(card);

      toggleSave(contractor);

      this.textContent = AppState.savedContractors.find(c => c.name === contractor.name)
        ? "❤️ Saved"
        : "🤍 Save";
    });
  });
}

// ===============================
// GET NEXT STAGE
// ===============================
function getNextStage(currentStage) {
  const order = ["foundation", "structure", "roofing", "windows", "finishing"];
  const index = order.indexOf(currentStage);
  return order[index + 1] || currentStage;
}

// ===============================
// COMPLETE CURRENT TASK (WRAPPER)
// ===============================
function completeTask(stageId, taskId, options = {}) {
  return requestTaskTransition(stageId, taskId, "completed", options);
}

function renderProjectDates() {
  const target = document.getElementById("projectDates");
  if (!target || !projectState) return;
  const progress = Construction.summary(projectState);
  const parts = [];
  if (Number.isFinite(Date.parse(projectState.startDate))) parts.push("Started: " + new Date(projectState.startDate).toLocaleDateString());
  else if (progress.begun) parts.push("Start date not recorded for older progress");
  if (progress.isCompleted) parts.push(Number.isFinite(Date.parse(projectState.endDate)) ? "Completed: " + new Date(projectState.endDate).toLocaleDateString() : "Completed · completion date not recorded");
  target.textContent = parts.join(" · ") || "Not started";
}

function startTask(stageId, taskId, options = {}) {
  return requestTaskTransition(stageId, taskId, "active", options);
}

function getCurrentStage(state) {
  if (!state || !state.stages) return null;
  return state.stages.find(s => s.id === state.currentStage) || null;
}

// =====================
// SHOW ALERT
// =====================
function showAlert(message, onClose, type = "warning") {
  const overlay = document.getElementById("customAlert");
  const box = overlay?.querySelector(".alert-box");
  const text = document.getElementById("alertMessage");
  const btn = document.getElementById("alertOkBtn");

  if (!overlay || !text || !btn || !box) return;

  text.textContent = message;

  // 🔥 Apply type
  box.classList.remove("alert-success", "alert-error", "alert-warning");
  box.classList.add(`alert-${type}`);

  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  btn.onclick = () => {
    overlay.classList.add("hidden");
    document.body.style.overflow = "";

    if (onClose) onClose();
  };
}

// ===============================
// OPEN TASK MODAL
// ===============================
function openTaskModal(stageId, taskId) {
  if (taskUpdateBusy) { ConstructionUI.message("Please finish the current task update before opening another task."); return; }
  const existingModal = document.getElementById("taskModal");
  if (existingModal && !existingModal.classList.contains("hidden") && window.ConstructionPlan && !ConstructionPlan.confirmTaskDiscard()) return;
  const reference = (() => { try { return Construction.locate(projectState, stageId, taskId); } catch (error) { ConstructionUI.message(error.message); return null; } })();
  if (!reference) return;
  window.TaskNavigation?.remember(stageId, taskId);
  window.ContractorSupport?.workspace();
  currentTaskContext.projectId = projectState.id;
  currentTaskContext.updatedAt = reference.task.updatedAt;
  currentTaskContext.stageId = stageId;
  currentTaskContext.taskId = taskId;
  currentTaskContext.submissionId = Financials.id();

  // 🧠 GET CURRENT TASK
  const stage = projectState?.stages?.find(s => s.id === stageId);
  const task = stage?.tasks?.find(t => t.id === taskId);
  document.getElementById("taskCostInput").value = "";
  document.getElementById("taskNotesInput").value = typeof task.notes === "string" ? task.notes : "";
  document.getElementById("taskImageInput").value = "";
  document.getElementById("confirmTaskBtn").hidden = task.status === "completed";
  document.getElementById("taskDetailStatus").textContent = Construction.LABELS[task.status] || "Older status preserved";
  ConstructionUI.evidenceList(projectState, stageId, task);
  document.getElementById("taskExpenseDescription").value = `${task?.name || "Task"} expense`;
  document.getElementById("taskExpenseDate").value = Financials.today();
  document.getElementById("taskExpenseCategory").value = "Materials";
  document.getElementById("taskExpenseError").textContent = "";

  // 🧠 UPDATE MODAL TEXT
  const uploadLabel = document.getElementById("uploadLabel");
  const title = document.getElementById("taskModalTitle");

  if (uploadLabel && task) {
    uploadLabel.textContent = "Upload photos or files";
  }

  if (title && task) {
    title.textContent = `Task details: ${task.name}`;
  }

  // 🚀 OPEN MODAL (AFTER updating content)
  window.ConstructionPlan?.taskDetails(stage, task);
  const modal = document.getElementById("taskModal");
  if (modal) {
    currentTaskContext.returnFocus = document.activeElement;
    document.body.appendChild(modal);
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "taskModalTitle");
    if (modal.classList.contains("hidden")) modal.dataset.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.classList.remove("hidden");
    modal.querySelector(".task-dialog-body")?.scrollTo(0, 0);
    document.getElementById("taskModalTitle").focus();
    modal.onkeydown = event => {
      if (event.key === "Escape") closeTaskModal();
      if (event.key !== "Tab") return;
      const controls = [...modal.querySelectorAll("a[href],input,textarea,select,button,summary")].filter(control => !control.disabled && control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
  }
}

// ===============================
// CLOSE TASK MODAL
// ===============================
function closeTaskModal(options = {}) {
  if (taskUpdateBusy) { ConstructionUI.message("Saving task details. Please wait."); return; }
  if (!options.saved && window.ConstructionPlan && !ConstructionPlan.confirmTaskDiscard()) return false;
  ConstructionUI.releaseEvidenceUrls();
  const modal = document.getElementById("taskModal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = modal.dataset.previousOverflow || "";
  }

  // reset inputs
  document.getElementById("taskCostInput").value = "";
  document.getElementById("taskNotesInput").value = "";
  document.getElementById("taskImageInput").value = "";
  currentTaskContext.returnFocus?.focus();
  return true;
}

// ==========================
// TASK COMPLETION
// ==========================
function handleTaskCompletion() {
  return recordTaskCompletion();
}

function refreshUI() {
  updateDashboardUI();        // index page
  renderTaskListUI();         // task list
  renderProjectInsights?.();
  renderRecommendations();
  renderStageTracker();
  renderCurrentActionButton();
  renderCurrentActionCard();
  renderTaskIntelligence();
  renderProjectDates();
  const notice = document.getElementById("workspaceLegacyFinancials");
  if (notice) {
    notice.textContent = legacyFinancialNotice(projectState);
    notice.hidden = !notice.textContent;
  }
  window.ProjectExperience?.refresh();
  window.ConstructionPlan?.refresh();
}

// ===========================
// CURRENT ACTION BUTTON
// ===========================
function renderCurrentActionButton() { ConstructionUI.currentButton(); }

function renderCurrentActionCard() { ConstructionUI.currentCard(); window.ConstructionPlan?.refresh(); }

function renderTaskListUI() { ConstructionUI.tasks(); }

function renderStageTracker() { ConstructionUI.tracker(); }

function getStageProgress(stage) { return Construction.stageSummary(stage).percent; }

function resolveRole(role) {
  if (!role) return "";

  const r = role.toLowerCase().trim();

  if (r.includes("engineer")) return "engineer";
  if (r.includes("structural")) return "engineer";

  if (r.includes("mason")) return "mason";

  if (r.includes("roofer")) return "roofer";
  if (r.includes("roof")) return "roofer";

  if (r.includes("carpenter")) return "carpenter";

  if (r.includes("plumber")) return "plumber";

  if (r.includes("electric")) return "electrician";

  if (r.includes("tiler")) return "tiler";

  if (r.includes("painter")) return "painter";

  if (r.includes("excavation")) return "excavation specialist";

  return r;
}

// ===============================
// TEXT HELPERS
// ===============================
function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setText(id, value, html = false) {
  const el = document.getElementById(id);
  if (!el) return;
  html ? el.innerHTML = value : el.textContent = value;
}

// ===============================
// DATA HELPERS
// ===============================
function extractContractorData(card) {
  if (window.ContractorModel) return ContractorModel.extract(card);
  return { name:card.dataset.name, role:card.dataset.role, location:card.dataset.location, image:card.dataset.image,
    rating:card.dataset.rating, reviews:card.dataset.reviews, experience:card.dataset.experience, projects:card.dataset.projects,
    about:card.dataset.about, skills:card.dataset.skills, certs:card.dataset.certs, projectList:card.dataset.projectlist };
}

function calculateProjectFinancials(state) {
  return state ? Financials.calculate(state) : { available: true, budget: 0, spent: 0, remaining: 0, variance: 0, stages: {}, tasks: {} };
}

function calculateProjectProgress(project) { return Construction.summary(project).percent; }

// ===============================
// 🧠 INTELLIGENCE MAP (CENTRALIZED)
// ===============================
const INTELLIGENCE_MAP = {

  // ===============================
  // FOUNDATION
  // ===============================
  foundation: {

      "site-clearing": [
        { type: "critical", message: "Poor site clearing can affect layout accuracy and foundation alignment." },
        { type: "info", message: "Remove all debris and vegetation before marking begins." },
        { type: "info", message: "Ensure the ground is level and accessible." },
        { type: "action", message: "Hire a general contractor for site clearing.", role: "general" }
      ],

      "site-layout": [
        { type: "critical", message: "Incorrect layout leads to structural misalignment and boundary disputes." },
        { type: "info", message: "Mark all corners clearly before excavation." },
        { type: "info", message: "Use accurate measurements to avoid rework." },
        { type: "action", message: "Hire a surveyor for accurate site layout.", role: "surveyor" }
      ],

      "excavation": [
        { type: "critical", message: "Improper excavation depth weakens foundation stability." },
        { type: "info", message: "Follow structural drawings strictly." },
        { type: "info", message: "Check soil condition during digging." },
        { type: "action", message: "Hire an excavation specialist.", role: "excavation" }
      ],

      "footing": [
        { type: "critical", message: "Weak footing leads to cracks and structural failure." },
        { type: "info", message: "Verify reinforcement before pouring." },
        { type: "info", message: "Ensure proper concrete mix." },
        { type: "action", message: "Hire a mason for footing construction.", role: "mason" }
      ],

      "foundation-wall": [
        { type: "critical", message: "Poor blockwork affects load transfer." },
        { type: "info", message: "Ensure vertical alignment." },
        { type: "info", message: "Use correct mortar ratio." },
        { type: "action", message: "Hire a mason for foundation wall construction.", role: "mason" }
      ],

      "dpc": [
        { type: "critical", message: "Missing DPC leads to rising damp." },
        { type: "info", message: "Ensure continuous installation." },
        { type: "info", message: "Use waterproof materials." },
        { type: "action", message: "Hire a mason to install damp proof course.", role: "mason" }
      ],

      "backfilling": [
        { type: "critical", message: "Poor compaction causes settlement and cracks." },
        { type: "info", message: "Compact soil in layers." },
        { type: "info", message: "Avoid organic materials." },
        { type: "action", message: "Hire a contractor for proper backfilling.", role: "mason" }
      ]
    },

    // ===============================
    // STRUCTURE
    // ===============================
    structure: {

      "blockwork-super": [
        { type: "critical", message: "Poor wall alignment affects structural stability." },
        { type: "info", message: "Maintain consistent block joints." },
        { type: "info", message: "Check vertical alignment frequently." },
        { type: "action", message: "Hire a mason for blockwork construction.", role: "mason" }
      ],

      "columns": [
        { type: "critical", message: "Incorrect reinforcement may lead to collapse." },
        { type: "info", message: "Use correct rebar sizes." },
        { type: "info", message: "Secure reinforcement properly." },
        { type: "action", message: "Hire a structural specialist for columns.", role: "engineer" }
      ],

      "lintel": [
        { type: "critical", message: "Weak lintels cause cracks above openings." },
        { type: "info", message: "Ensure proper curing time." },
        { type: "info", message: "Use correct reinforcement." },
        { type: "action", message: "Hire a mason for lintel casting.", role: "mason" }
      ],

      "beam": [
        { type: "critical", message: "Weak beams compromise the entire structure." },
        { type: "info", message: "Check reinforcement layout." },
        { type: "info", message: "Ensure proper formwork." },
        { type: "action", message: "Hire a structural specialist for beam construction.", role: "engineer" }
      ],

      "slab": [
        { type: "critical", message: "Poor slab casting affects load distribution." },
        { type: "info", message: "Ensure proper thickness." },
        { type: "info", message: "Allow full curing before loading." },
        { type: "action", message: "Hire a structural specialist for slab work.", role: "engineer" }
      ]
    },

    // ===============================
    // ROOFING
    // ===============================
    roofing: {

      "roof-frame": [
        { type: "critical", message: "Weak framing leads to roof failure." },
        { type: "info", message: "Use treated materials." },
        { type: "info", message: "Secure all joints properly." },
        { type: "action", message: "Hire a carpenter for roof framing.", role: "carpenter" }
      ],

      "roof-cover": [
        { type: "critical", message: "Poor installation causes leaks." },
        { type: "info", message: "Align sheets properly." },
        { type: "info", message: "Use correct fasteners." },
        { type: "action", message: "Hire a roofing specialist.", role: "roofer" }
      ],

      "roof-waterproof": [
        { type: "critical", message: "Poor waterproofing causes long-term damage." },
        { type: "info", message: "Seal all joints properly." },
        { type: "info", message: "Test for leaks." },
        { type: "action", message: "Hire a waterproofing specialist.", role: "roofer" }
      ],

      "gutter": [
        { type: "critical", message: "Improper drainage damages walls and foundation." },
        { type: "info", message: "Ensure proper slope." },
        { type: "info", message: "Keep gutters clean." },
        { type: "action", message: "Hire a plumber for gutter installation.", role: "plumber" }
      ]
    },

    // ===============================
    // WINDOWS
    // ===============================
    windows: {

      "window-install": [
        { type: "critical", message: "Improper installation leads to leakage." },
        { type: "info", message: "Seal edges properly." },
        { type: "info", message: "Ensure level placement." },
        { type: "action", message: "Hire a contractor for window installation.", role: "carpenter" }
      ],

      "door-install": [
        { type: "critical", message: "Misalignment affects usability." },
        { type: "info", message: "Check swing clearance." },
        { type: "info", message: "Ensure firm fixing." },
        { type: "action", message: "Hire a carpenter for door installation.", role: "carpenter" }
      ],

      "frame-fix": [
        { type: "critical", message: "Weak fixing compromises stability." },
        { type: "info", message: "Secure frames firmly." },
        { type: "info", message: "Use proper anchors." },
        { type: "action", message: "Hire a carpenter for frame fixing.", role: "carpenter" }
      ]
    },

    // ===============================
    // FINISHING
    // ===============================
    finishing: {

      "plastering": [
        { type: "critical", message: "Poor plastering leads to cracks." },
        { type: "info", message: "Prepare surfaces properly." },
        { type: "info", message: "Apply evenly." },
        { type: "action", message: "Hire a mason for plastering.", role: "mason" }
      ],

      "screeding": [
        { type: "critical", message: "Uneven screeding affects flooring." },
        { type: "info", message: "Use leveling tools." },
        { type: "info", message: "Allow proper drying." },
        { type: "action", message: "Hire a mason for screeding.", role: "mason" }
      ],

      "ceiling": [
        { type: "critical", message: "Poor ceiling installation affects durability." },
        { type: "info", message: "Ensure proper suspension." },
        { type: "info", message: "Align correctly." },
        { type: "action", message: "Hire a carpenter for ceiling work.", role: "carpenter" }
      ],

      "tiling": [
        { type: "critical", message: "Poor tiling leads to cracks and detachment." },
        { type: "info", message: "Use spacers." },
        { type: "info", message: "Ensure strong bonding." },
        { type: "action", message: "Hire a tiler.", role: "tiler" }
      ],

      "painting": [
        { type: "critical", message: "Poor preparation affects finish durability." },
        { type: "info", message: "Apply primer first." },
        { type: "info", message: "Use multiple coats." },
        { type: "action", message: "Hire a painter.", role: "painter" }
      ],

      "electrical": [
        { type: "critical", message: "Faulty wiring poses fire hazards." },
        { type: "info", message: "Use certified electrician." },
        { type: "info", message: "Ensure proper insulation." },
        { type: "action", message: "Hire a certified electrician.", role: "electrician" }
      ],

      "plumbing": [
        { type: "critical", message: "Leaks cause structural damage." },
        { type: "info", message: "Test pipes before closing walls." },
        { type: "info", message: "Use quality materials." },
        { type: "action", message: "Hire a plumber.", role: "plumber" }
      ],

      "fixtures": [
        { type: "critical", message: "Incorrect installation affects usability." },
        { type: "info", message: "Ensure proper positioning." },
        { type: "info", message: "Secure fixtures properly." },
        { type: "action", message: "Hire a contractor for fixture installation.", role: "carpenter" }
      ]
    }

  };

// ===============================
// TASK INTELLIGENCE ENGINE (ADVISOR SYSTEM)
// ===============================


function generateTaskInsights(task, projectState) {
  // 🛑 GUARD: No task (happens after project completion)
  if (!task) {
    console.warn("⚠️ No active task → skipping insights");
    return [];
  }

  const stageId = projectState?.stages?.find(stage => stage.tasks.some(item => item.id === task.id))?.id;
  const hiredType = projectState?.hiredContractor?.type;

  let insights = [];

  // ===============================
  // BASE INTELLIGENCE (FROM MAP)
  // ===============================
  const stageMap = INTELLIGENCE_MAP[stageId];
  if (!stageMap) {
    console.warn("⚠️ No stage map found");
    return [];
  }

  const taskInsights = stageMap?.[task.id];

  if (taskInsights) {
    insights = [...taskInsights];
  }

  // ===============================
  // ✅ SMART CONTRACTOR STATE SYNC (FINAL)
  // ===============================
  insights = insights.map(insight => {

    if (insight.type === "action" && insight.role) {

      const requiredRole = resolveRole(insight.role);

      const hired =
        projectState?.hiredContractors?.[requiredRole];

      if (hired) {
        return {
          type: "positive",
          message: `${capitalize(requiredRole)} hired for this task`
        };
      }
    }

    return insight;
  });

  // ===============================
  // 🧠 CONTRACTOR-AWARE LAYER
  // ===============================
  if (task.requiredContractor && hiredType) {

    if (hiredType !== task.requiredContractor) {
      insights.unshift({
        type: "critical",
        message: `The current contractor (${hiredType}) may not be ideal for this task. This can affect quality, safety, and long-term durability.`
      });
    }

  }

  // ===============================
  // DEFAULT FALLBACK
  // ===============================
  if (insights.length === 0) {
    insights.push({
      type: "info",
      message: "Execution quality at this stage affects overall project outcome."
    });
  }

  return insights;
}

// ===============================
// 🔮 PREDICTIVE INTELLIGENCE
// ===============================
function generatePrediction(projectState) {
  return projectState ? Financials.forecast(projectState) : null;
}

function generateStagePrediction(stage) {
  return projectState && stage ? Financials.forecast(projectState, stage.id) : null;
}

function renderTaskInsights(insights) {
  if (!insights || insights.length === 0) return null;

  const container = document.createElement("div");
  container.className = "task-insights";

  // ===============================
  // FLAT RENDER (NEW UX)
  // ===============================
  insights.forEach(insight => {
    const row = document.createElement("div");
    row.className = `insight ${insight.type}`;

    const icon = document.createElement("span");
    icon.className = "insight-icon";

    if (insight.type === "critical") icon.textContent = "🚨";
    if (insight.type === "warning") icon.textContent = "⚠️";
    if (insight.type === "info") icon.textContent = "💡";
    if (insight.type === "action") icon.textContent = "🛠️";
    if (insight.type === "positive") icon.textContent = "✅";

    const text = document.createElement("span");

    // ✅ CLICKABLE ACTION
    text.textContent = insight.message;

    row.appendChild(icon);
    row.appendChild(text);
    container.appendChild(row);
  });

  return container;
}

// ===============================
// SAVE SYSTEM
// ===============================
function toggleSave(contractor) {
  let saved = JSON.parse(localStorage.getItem('savedContractors') || '[]');

  const same = c => window.ContractorModel ? ContractorModel.identity(c) === ContractorModel.identity(contractor) : c.name === contractor.name;
  const exists = saved.find(same);

  if (exists) {
    saved = saved.filter(c => !same(c));
  } else {
    saved.push(contractor);
  }

  localStorage.setItem("savedContractors", JSON.stringify(saved));
  AppState.savedContractors = saved;
}

// ===============================
// SELECTION HANDLER
// ===============================
function handleSelection(buttons, callback) {
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      callback(parseInt(btn.dataset.value));
    });
  });
}

// ===============================
// ESTIMATE ENGINE
// ===============================
function calculateEstimate(size, bedrooms, floors, location) {
  let baseRate = 1200;

  let locationFactor =
    location?.includes("accra") ? 1.25 :
    location?.includes("kumasi") ? 1.15 : 1.05;

  let floorFactor = 1 + (floors - 1) * 0.15;
  let bedroomFactor = 1 + (bedrooms - 1) * 0.05;

  return size * baseRate * locationFactor * floorFactor * bedroomFactor;
}

// ===============================
// TRUST SCORE
// ===============================
function calculateTrustScore(contractor) {
  if (!contractor) return 0;

  const rating = parseFloat(contractor.rating) || 0;
  const reviews = parseInt(contractor.reviews) || 0;
  const projects = parseInt(contractor.projects) || 0;

  const performance = JSON.parse(localStorage.getItem("contractorPerformance")) || {};
  const data = performance[contractor.name];

  let successRate = 0;
  let costControlScore = 0;

  if (data && data.completed > 0) {
    successRate = data.onBudget / data.completed;

    // lower variance = better
    const avgVariance = data.totalVariance / data.completed;
    costControlScore = avgVariance <= 0 ? 1 : Math.max(0, 1 - (avgVariance / 10000));
  }

  const ratingScore = (rating / 5) * 25;
  const reviewScore = Math.min(reviews / 200, 1) * 15;
  const projectScore = Math.min(projects / 100, 1) * 20;
  const performanceScore = (successRate * 20) + (costControlScore * 20);

  return Math.round(ratingScore + reviewScore + projectScore + performanceScore);
}

// ===============================
// INSIGHT ICON
// ===============================
function getInsightIcon(type) {
  switch (type) {
    case "critical": return "🚨";
    case "warning": return "⚠️";
    case "suggestion": return "👉";
    case "success": return "✅";
    case "info": return "ℹ️";
    default: return "•";
  }
}

function updateStage(selector, value) {
  const el = document.querySelector(selector);

  if (el) {
    el.textContent = Financials.format(value);
  }
}

// ===============================
// PROJECT INSIGHTS
// ===============================
function generateProjectInsights(projectState) {
  const insights = {
    critical: [],
    warning: [],
    suggestion: [],
    info: [],
    success: []
  };

  if (!projectState) return insights;
  const financials = Financials.calculate(projectState);
  if (!financials.available) return [{ type: "critical", message: financials.error }];

  const stageId = Construction.nextTask(projectState)?.stage.id;
  const stageObj = projectState.stages.find(s => s.id === stageId);
  const tasks = stageObj?.tasks || [];

  const nextTask = tasks.find(t => t.status !== "completed");
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const totalTasks = tasks.length;

  const hired = projectState.hiredContractors;
  const role = hired?.role?.toLowerCase();

  // =========================
  // PROJECT LEVEL INSIGHTS
  // =========================
  const allCompleted = projectState.isCompleted === true;

  if (allCompleted) {
  insights.success.push({
    type: "success",
    message: "Project completed successfully 🎉"
  });

  return [
    ...insights.critical,
    ...insights.warning,
    ...insights.suggestion,
    ...insights.info,
    ...insights.success
  ];
}

  // =========================
  // 💰 BUDGET INTELLIGENCE
  // =========================
  const budget = projectState.estimate?.totalCost || projectState.budget || 0;
  const spent = Financials.calculate(projectState).spent;

  if (budget > 0) {
    const usage = (spent / budget) * 100;
    const remaining = budget - spent;

    if (usage > 100) {
      insights.critical.push({
        type: "critical",
        message: `Project is over budget by GH₵${Math.abs(remaining).toLocaleString()}`
      });
    } 
    else if (usage > 85) {
      insights.warning.push({
        type: "warning",
        message: `Budget risk: ${Math.round(usage)}% used. Only ${Financials.format(remaining)} remaining`
      });
    } 
    else if (usage > 60) {
      insights.info.push({
        type: "info",
        message: `Budget usage at ${Math.round(usage)}%. Monitor upcoming stages`
      });
    }
    else {
      insights.success.push({
        type: "success",
        message: `Budget healthy. ${Financials.format(remaining)} remaining`
      });
    }
  }

  // =========================
  // STAGE PROGRESS INSIGHT
  // =========================
  if (totalTasks > 0) {
    const percent = Math.round((completedCount / totalTasks) * 100);

  if (percent === 100) {
    insights.success.push({
      type: "success",
      message: `${stageObj.name} completed`
    });
  } else if (percent > 0) {
    insights.info.push({
      type: "info",
      message: `${percent}% of ${stageObj.name} completed`
    });
  }
}

  // =========================
  // NEXT ACTION INTELLIGENCE
  // =========================
  if (nextTask) {
    if (!hired) {
      insights.critical.push({
        type: "critical",
        message: `Optional support: consult a ${nextTask.requiredContractor} if needed. You can record progress independently.`
      });
    } else if (nextTask.status !== "active") {
      insights.suggestion.push({
        type: "suggestion",
        message: `Next: ${nextTask.name}`
      });
    } else {
      insights.info.push({
        type: "info",
        message: `${nextTask.name} in progress`
      });
    }
  }

  // =========================
  // CONTRACTOR VALIDATION
  // =========================
    if (hired && nextTask) {
    const result = evaluateContractor(hired.role, nextTask.requiredContractor);

    if (result.status === "invalid") {
      insights.critical.push({
        type: "critical",
        message: `Wrong contractor for ${nextTask.name}`
      });
    }

    if (result.status === "acceptable") {
      insights.warning.push({
        type: "warning",
        message: `Contractor is not ideal for ${nextTask.name}`
      });
    }

    if (result.status === "overqualified") {
      insights.warning.push({
        type: "warning",
        message: "Overqualified contractor — may increase cost"
      });
    }
  }

  // =========================
  // STAGE COMPLETION SIGNAL
  // =========================
  if (completedCount === totalTasks && totalTasks > 0) {
    insights.success.push({
      type: "success",
      message: `${stageObj.name} completed`
    });
  }

  return [
    ...insights.critical,
    ...insights.warning,
    ...insights.suggestion,
    ...insights.info,
    ...insights.success
  ];
}

// ===============================
// 🧠 SMART RECOMMENDATION ENGINE
// ===============================
function generateRecommendations(state) {
  const actions = [];

  if (!state) return actions;

  const focus = Construction.nextTask(state);
  const stage = focus?.stage;
  const tasks = stage?.tasks || [];

  const nextTask = focus?.task;
  const required = resolveRole(nextTask?.requiredContractor);
  console.log("🔍 REQUIRED:", required);
  console.log("🔍 HIRED MAP:", projectState.hiredContractor);
  console.log("🔍 HIRED:", projectState.hiredContractor);
  const hired = projectState.hiredContractor;

  const budget = state.estimate?.totalCost || 0;
  const spent = Financials.calculate(state).spent;

  // =========================
  // 1. 🚨 NO CONTRACTOR
  // =========================
  if (!hired && nextTask) {
    actions.push({
      type: "critical",
      message: `Optional support: consult a ${nextTask.requiredContractor} if needed. You can record progress independently.`,
      action: () => {

      const role = nextTask.requiredContractor;

      // Persist
      saveProjectState();

      // Refresh UI
      refreshUI?.();

      // Navigate
      window.location.href = `contractors.html?role=${role}`;
    }
    });

    // Contractor discovery is optional; task actions remain available below.
  }

  // =========================
  // 1b. ✅ CONTRACTOR HIRED
  // =========================
  if (hired && nextTask) {
    actions.push({
      type: "positive",
      message: `${capitalize(nextTask.requiredContractor)} hired`,
    });
  }

  // =========================
  // 2. 🚨 WRONG CONTRACTOR
  // =========================
  if (hired && nextTask) {
    const result = evaluateContractor(hired.role, nextTask.requiredContractor);

    if (result.status === "invalid") {
      actions.push({
        type: "critical",
        message: `Replace contractor for ${nextTask.name}`,
        action: () => goTo("contractors.html")
      });
    }
  }

  // =========================
  // 3. 💰 BUDGET RISK
  // =========================
  if (budget > 0) {
    const usage = (spent / budget) * 100;

    if (usage > 100) {
      actions.push({
        type: "critical",
        message: "Project is over budget — pause execution",
        action: null
      });
    } 
    else if (usage > 85) {
      actions.push({
        type: "warning",
        message: "High budget usage — review next stage carefully",
        action: null
      });
    }
  }

  // =========================
  // 4. ▶ NEXT TASK FLOW
  // =========================
  if (nextTask) {
    if (nextTask.status !== "active") {
      actions.push({
        type: "primary",
        message: `Start ${nextTask.name}`,
        action: () => startTask(stage.id, nextTask.id)
      });
    } else {
      actions.push({
        type: "primary",
        message: `Complete ${nextTask.name}`,
        action: () => openTaskModal(stage.id, nextTask.id)
      });
    }
  }

  // =========================
  // 5. 🧠 ACTION INTELLIGENCE (NEW)
  // =========================
  const insights = generateTaskInsights(nextTask, state);

  insights.forEach(insight => {
    if (insight.type === "action") {
      actions.push({
        type: "suggestion",
        message: insight.message.replace(/^Hire /, "Optional support: consult "),
        action: () => goTo("contractors.html") // 🔧 we’ll refine later
      });
    }
  });
  return actions;
}

// ===============================
// RENDER PROJECT INSIGHTS
// ===============================
function renderProjectInsights() {
  const insightList = document.getElementById("projectInsightList");
  if (!insightList) return;

  const insights = generateProjectInsights(projectState).filter(item => !/contractor|hired|overqualified/i.test(item.message));

  if (insights.length === 0) {
    insightList.innerHTML = "<li>No updates yet</li>";
    return;
  }

    insightList.innerHTML = insights.map(item => `
      <li class="insight-item ${item.type}">
        <span class="icon">${getInsightIcon(item.type)}</span>
        <span class="message">${item.message}</span>
      </li>
    `).join("");
}    

// ===============================
// RENDER RECOMMENDATIONS
// ===============================
function renderRecommendations() {
  document.getElementById('recommendationList')?.replaceChildren();
  window.ContractorSupport?.workspace();
}

function renderDashboardChart() {
  const canvas = document.getElementById("costChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (window.costChartInstance) {
    window.costChartInstance.destroy();
  }

  window.costChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Foundation", "Structure", "Roofing", "Windows", "Finishing"],
      datasets: [{
        data: [25, 30, 20, 10, 15],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// ===============================
// CONTRACTOR LIST (SMART FILTER CLEAN)
// ===============================
function initContractorList() { if (location.pathname.endsWith('contractors.html')) ContractorSupport.marketplace(); }

function initContractorSearch() { /* Combined search and specialty filtering is bound by ContractorSupport.marketplace. */ }

function initContractorProfile() { window.ContractorSupport?.profile(); }

function initSavedPage() {
  if (window.ContractorSupport?.saved) return ContractorSupport.saved();

  const container = document.getElementById("savedList");
  const emptyState = document.getElementById("emptyState");

  if (!container) return;

  const saved = AppState.savedContractors || [];

  container.innerHTML = "";

  // =========================
  // EMPTY STATE
  // =========================
  if (saved.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  // =========================
  // RENDER CARDS
  // =========================
  saved.forEach(contractor => {

    const card = document.createElement("div");
    card.className = "contractor-card";

    // preserve dataset structure (important for reuse)
    card.dataset.name = contractor.name;
    card.dataset.role = contractor.role;
    card.dataset.rating = contractor.rating;
    card.dataset.reviews = contractor.reviews;
    card.dataset.location = contractor.location;
    card.dataset.image = contractor.image;
    card.dataset.experience = contractor.experience;
    card.dataset.projects = contractor.projects;
    card.dataset.about = contractor.about;

    card.innerHTML = `
      <div class="contractor-header">
        <img src="${contractor.image}" alt="${contractor.name}">
        <div>
          <h3>${contractor.name}</h3>
          <p>${contractor.role}</p>
          <p>⭐ ${contractor.rating} (${contractor.reviews})</p>
          <p>${contractor.location}</p>
        </div>
      </div>

      <div class="contractor-actions">
        <button class="save-btn">❤️ Saved</button>
        <button class="view-profile-btn">View Profile</button>
      </div>
    `;

    // =========================
    // CARD CLICK
    // =========================
    card.style.cursor = "pointer";

    card.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;

      localStorage.setItem("selectedContractor", JSON.stringify(contractor));
      window.location.href = "contractor-profile.html";
    });

    // =========================
    // REMOVE FROM SAVED
    // =========================
    const saveBtn = card.querySelector(".save-btn");

    saveBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      toggleSave(contractor); // removes

      card.remove();

      const remaining = document.querySelectorAll(".contractor-card").length;

      if (remaining === 0 && emptyState) {
        emptyState.style.display = "block";
      }
    });

    // =========================
    // VIEW PROFILE
    // =========================
    const viewBtn = card.querySelector(".view-profile-btn");

    viewBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      localStorage.setItem("selectedContractor", JSON.stringify(contractor));
      window.location.href = "contractor-profile.html";
    });

    container.appendChild(card);
  });
}

// ===============================
// HIRE CONTRACTOR (FIXED)
// ===============================
function initHireButton(contractor) { window.ContractorSupport?.profile(); }

function initCreateProject() {
  if (!window.location.pathname.includes("create-project.html")) return;

  const form = document.getElementById("projectForm");
  if (!form) return;

  if (new URLSearchParams(window.location.search).get("reason") === "project-required") {
    const guidance = document.querySelector(".form-subtext");
    if (guidance) {
      guidance.textContent = "Create a project before estimating or managing construction. Your existing projects are preserved.";
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    console.log("🚀 Creating project...");

    const nameInput = document.getElementById("projectName");
    const name = nameInput?.value.trim();

    if (!name) {
      alert("Please enter a project name");
      return;
    }

    // 🚫 DO NOT TOUCH estimateData HERE
    // Project creation must be independent

    const newProject = {
      id: "project_" + Date.now(),
      projectName: name,
      location: "",
      budget: 0, // ✅ ALWAYS start clean
      spent: 0,
      currentStage: "foundation",
      hiredContractor: null,
      completedStages: [],
      stages: getDefaultStages()
    };

    // ✅ Add to project list
    projects.push(newProject);

    // ✅ Set as active project
    currentProjectId = newProject.id;
    projectState = newProject;

    // ✅ Persist
    localStorage.setItem("projects", JSON.stringify(projects));
    localStorage.setItem("currentProjectId", currentProjectId);

    console.log("✅ New project created:", newProject);

    // 🚀 Move to estimator (fresh state)
    window.location.href = "estimator.html";
  });
}

// ===============================
// ESTIMATOR UI
// ===============================
function initEstimatorUI() {
  if (!window.location.pathname.includes("estimator.html")) return;

  let bedrooms = null;
  let floors = null;

  const bedroomBtns = document.querySelectorAll("#bedroomOptions button");
  const floorBtns = document.querySelectorAll("#floorOptions button");

  const houseSize = document.getElementById("houseSize");
  const location = document.getElementById("location");

  handleSelection(bedroomBtns, val => { bedrooms = val; updateEstimate(); });
  handleSelection(floorBtns, val => { floors = val; updateEstimate(); });

  function updateEstimate() {
    const size = Number(houseSize?.value);
    const loc = location?.value?.toLowerCase();

    if (!Number.isFinite(size) || size <= 0 || !bedrooms || !floors) {
      const display = document.getElementById("liveEstimate");
      if (display) display.textContent = "GH₵ —";
      return;
    }

    const estimate = calculateEstimate(size, bedrooms, floors, loc);

    const display = document.getElementById("liveEstimate");
    if (display) {
      display.textContent = Financials.format(Math.round(estimate * 100) / 100);
    }
  }

  houseSize?.addEventListener("input", updateEstimate);
  location?.addEventListener("input", updateEstimate);
}

// ===============================
// ESTIMATE BUTTON (SAVE + ROUTE)
// ===============================
function initEstimateButton() {
  if (!window.location.pathname.includes("estimator.html")) return;

  const btn = document.getElementById("calculateBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {

    if (!requireProjectContext()) return;

    const houseSize = document.getElementById("houseSize")?.value;
    const location = document.getElementById("location")?.value;

    const bedroomBtn = document.querySelector("#bedroomOptions .active");
    const floorBtn = document.querySelector("#floorOptions .active");

    const bedrooms = bedroomBtn?.dataset.value;
    const floors = floorBtn?.dataset.value;

    if (!houseSize || !location || !bedrooms || !floors) {
      alert("Please complete all fields");
      return;
    }

    const rawTotal = calculateEstimate(
      Number(houseSize),
      Number(bedrooms),
      Number(floors),
      location.toLowerCase()
    );

    // =========================
    // SAVE ESTIMATE INTO PROJECT
    // =========================

    if (!Number.isFinite(Number(houseSize)) || Number(houseSize) <= 0 || !Number.isFinite(rawTotal) || rawTotal <= 0 || !Number.isSafeInteger(Math.round(rawTotal * 100))) {
      alert("Enter a positive house size and valid building specifications.");
      return;
    }
    const totalCost = Math.round(rawTotal * 100) / 100;
    if (projectState.estimate) {
      projectState.estimateRevisions = projectState.estimateRevisions || [];
      projectState.estimateRevisions.push({ revisedAt: new Date().toISOString(), previousEstimate: JSON.parse(JSON.stringify(projectState.estimate)) });
    }
    projectState.budget = totalCost;

    // ✅ SAVE ESTIMATE DATA
    const estimateData = {
      totalCost: totalCost
    };

    localStorage.setItem("estimateData", JSON.stringify(estimateData));

    console.log("✅ Estimate saved:", estimateData);

    projectState.estimate = {
      totalCost,
      size: houseSize,
      bedrooms,
      floors,
      location,

      // =========================
      // 💰 COST BREAKDOWN (NEW)
      // =========================
      breakdown: {}
    };

    projectState.allocationVersion = 0;
    Financials.allocate(projectState);
    saveProjectState();

    // =========================
    // NAVIGATE
    // =========================
    window.location.href = "estimate-result.html";
  });
}

// ===============================
// ESTIMATE RESULT PAGE (CLEAN + STABLE)
// ===============================
function initEstimateResultPage() {
  if (!window.location.pathname.includes("estimate-result.html")) return;

  console.log("📊 Estimate Result Page Loaded");

  // =========================
  // LOAD STATE
  // =========================
  if (!projectState) return;

  const data = projectState.estimate;

  if (!data) {
    const name = document.getElementById("projectNameDisplay");
    if (name) name.textContent = projectState.projectName || "Untitled Project";
    const estimate = document.getElementById("estimateValue");
    if (estimate) estimate.textContent = "No estimate yet";
    refreshUI();
    window.TaskNavigation?.fromUrl();
    return;
  }

  // =========================
  // 🏷️ PROJECT NAME
  // =========================
  const nameEl = document.getElementById("projectNameDisplay");
  if (nameEl) {
    nameEl.textContent = projectState.projectName || "Untitled Project";
  }

  // =========================
  // 📅 PROJECT DATES (REACTIVE)
  // =========================
  renderProjectDates();

  const totalCost = data.totalCost;
  const { budget, spent, variance } =
  calculateProjectFinancials(projectState);

  // =========================
  // 👷 CONTRACTOR
  // =========================
  const contractor = projectState.hiredContractor;

  if (contractor) {
    const container = document.getElementById("contractorSummary");
    const nameEl = document.getElementById("contractorNameSmall");
    const imgEl = document.getElementById("contractorImageSmall");

    if (container && nameEl && imgEl) {
      container.style.display = "block";

      nameEl.textContent = contractor.name;
      imgEl.src = contractor.image;

      // Prevent rebinding
      if (!nameEl.dataset.bound) {
        nameEl.onclick = () => {
          localStorage.setItem("selectedContractor", JSON.stringify(contractor));
          window.location.href = "contractor-profile.html";
        };
        nameEl.dataset.bound = "true";
      }
    }
  }

  // =========================
  // 💰 TOTAL COST
  // =========================
  const estimateValue = document.getElementById("estimateValue");
  if (estimateValue) {
    estimateValue.textContent = Financials.format(totalCost);
  }

  const estimateLocation = document.getElementById("estimateLocation");
  if (estimateLocation) {
    estimateLocation.textContent = "Location: " + data.location;
  }

  // =========================
  // STAGE BREAKDOWN
  // =========================
  Financials.allocate(projectState);
  const breakdown = projectState.estimate.breakdown;
  for (const stageId of Object.keys(Financials.STAGE_WEIGHTS)) {
    updateStage("." + stageId + " .amount", breakdown[stageId]);
  }
  saveProjectState();

  // =========================
  // MATERIAL ESTIMATION
  // =========================
  const materials = document.querySelectorAll(".material-item");

  if (materials.length >= 5) {
    const size = parseInt(data.size);

    materials[0].children[1].textContent = Math.round(size * 8);
    materials[1].children[1].textContent = (size * 0.04).toFixed(1) + " tons";
    materials[2].children[1].textContent = Math.round(size * 70);
    materials[3].children[1].textContent = Math.ceil(size / 10);
    materials[4].children[1].textContent = Math.round(size * 1.2);
  }

  // =========================
  // CHART
  // =========================
  renderChart([
    breakdown.foundation,
    breakdown.structure,
    breakdown.roofing,
    breakdown.windows,
    breakdown.finishing
  ]);

  // =========================
  // CONNECT TO PROJECT SYSTEM
  // =========================
  setTimeout(() => {
    refreshUI();
    window.TaskNavigation?.fromUrl();
  }, 0);
}

// ===============================
// CHART RENDER (FIXED)
// ===============================
function renderChart(values) {
  const canvas = document.getElementById("costChart");
  if (!canvas) return;

  if (typeof window.Chart !== "function") {
    console.warn("Cost chart unavailable; project workspace remains accessible.");
    return;
  }

  try {

  const ctx = canvas.getContext("2d");

  if (window.costChartInstance) {
    window.costChartInstance.destroy();
  }

  window.costChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Foundation", "Structure", "Roofing", "Windows", "Finishing"],
      datasets: [{
        data: values,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
  } catch (error) {
    console.warn("Cost chart could not be rendered:", error);
  }
}

// ===========================
// DASHBOARD UI (INDEX PAGE)
// ===========================
function updateDashboardUI() {
  const state = projectState;

  // =========================
  // NO PROJECT STATE
  // =========================
  if (!state || !state.stages) {
    const nameEl = document.getElementById("projectName");
    const currentNameEl = document.getElementById("currentProjectName");

    if (currentNameEl) {
      currentNameEl.textContent = "No project selected";
    }
    const progressEl = document.getElementById("progressPercent");
    const fillEl = document.getElementById("progressFill");
    const stageEl = document.getElementById("stageText");
    const budgetEl = document.getElementById("projectBudget");
    const spentEl = document.getElementById("projectSpent");

    if (nameEl) nameEl.textContent = "No project yet";
    if (progressEl) progressEl.textContent = "0%";
    if (fillEl) fillEl.style.width = "0%";
    if (stageEl) stageEl.textContent = "Not started";
    if (budgetEl) budgetEl.textContent = "GH₵0";

    return;
  }

  // =========================
  // CALCULATE PROGRESS
  // =========================
  const construction = Construction.summary(state);
  const progress = construction.percent;

  // =========================
  // UPDATE UI
  // =========================
  const nameEl = document.getElementById("projectName");
  const currentNameEl = document.getElementById("currentProjectName");
  const progressEl = document.getElementById("progressPercent");
  const fillEl = document.getElementById("progressFill");
  const stageEl = document.getElementById("stageText");
  const budgetEl = document.getElementById("projectBudget");

  if (nameEl) {
    nameEl.textContent = state.projectName || "My Project";
  }
  if (currentNameEl) {
    currentNameEl.textContent = state.projectName || "Untitled Project";
  }

  if (progressEl) {
    progressEl.textContent = progress + "%";
  }

  if (fillEl) {
    fillEl.style.width = progress + "%";
  }

  if (stageEl) stageEl.textContent = Construction.projectLabel(state);

  const { budget: budgetValue, spent: spentValue, variance } =
  calculateProjectFinancials(state);

  if (budgetEl) {
    budgetEl.textContent = Financials.format(budgetValue);
  }

  const spentEl = document.getElementById("projectSpent");
  const varianceEl = document.getElementById("projectVariance");

  if (varianceEl) {
    const absValue = Math.abs(variance || 0).toFixed(1);

    if (variance < 0) {
      varianceEl.textContent = absValue + "% under budget";
      varianceEl.style.color = "#16a34a"; // green
    } 
    else if (variance > 0) {
      varianceEl.textContent = "+" + absValue + "% over budget";
      varianceEl.style.color = "#dc2626"; // red
    } 
    else {
      varianceEl.textContent = "On budget";
      varianceEl.style.color = "#6b7280"; // neutral
    }
  }
  if (spentEl) {
    spentEl.textContent = Financials.format(spentValue);
  }

  if (varianceEl) {
    const sign = variance > 0 ? "+" : "";
    varianceEl.textContent = variance === null ? "Unavailable" : sign + variance.toFixed(1) + "%";
  }

  renderStageTracker(); 
  renderProjectSwitcher();
}

// ===============================
// PROJECT SWITCHER UI
// ===============================
function renderProjectSwitcher() {
  const select = document.getElementById("projectSwitcher");
  if (!select) return;

  select.innerHTML = "";

  projects.forEach(project => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.projectName || "Untitled Project";

    if (project.id === currentProjectId) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  // =========================
  // SWITCH HANDLER
  // =========================
  select.onchange = function () {
    const selectedId = this.value;

    currentProjectId = selectedId;
    localStorage.setItem("currentProjectId", selectedId);

    // reload state cleanly
    loadProjectState();
    expandedStages = {};
    refreshUI();
  };
}

// ===============================
// PROJECT MANAGER PAGE
// ===============================
function initProjectsPage() {
  const container = document.getElementById('projectList');
  if (!container) return;
  projects = JSON.parse(localStorage.getItem('projects')) || [];
  currentProjectId = localStorage.getItem('currentProjectId');
  window.ProjectsMedia?.begin();
  container.replaceChildren();
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const summaryText = document.getElementById('projectsSummary');
  if (summaryText) summaryText.textContent = projects.length
    ? `${projects.length} project${projects.length === 1 ? '' : 's'} · ${projects.filter(p => Construction.summary(p).isCompleted).length} completed`
    : 'Your building journey starts here';
  if (!projects.length) {
    const empty = node('section', undefined, 'projects-empty');
    const icon = node('span', undefined, 'projects-empty-icon'); icon.dataset.icon = 'projects';
    const link = node('a', 'Create your first project', 'new-project-btn'); link.href = 'create-project.html';
    empty.append(icon, node('h2', 'A place for every project'), node('p', 'Create a project to plan your budget, track construction tasks and keep your expenditure together.'), link);
    container.append(empty);
    return;
  }
  const ordered = [...projects.filter(p => p.id === currentProjectId), ...projects.filter(p => p.id !== currentProjectId)];
  for (const project of ordered) {
    const selected = project.id === currentProjectId;
    const summary = Construction.summary(project), financials = Financials.calculate(project);
    const card = node('article', undefined, `project-card project-${summary.status}${selected ? ' active-project' : ''}`);
    card.dataset.projectId = project.id;
    const name = project.projectName || 'Untitled Project';
    const headingId = `project-heading-${projects.indexOf(project)}`;
    card.setAttribute('aria-labelledby', headingId);
    const top = ProjectsMedia.create(project);
    if (selected) top.append(node('span', 'Selected project', 'projects-selected'));
    const badge = node('span', summary.label, `projects-status ${summary.status}`);
    top.append(badge);
    const heading = node('h2', name, 'project-title'); heading.id = headingId;
    const location = node('p', project.location || project.estimate?.location || 'Location not recorded', 'projects-location');
    const identity = node('p', `Project ${projects.indexOf(project) + 1}`, 'projects-reference');
    const dateKey = stamp => typeof stamp === 'string' && Number.isFinite(Date.parse(stamp))
      ? new Date(stamp).toLocaleDateString('en-GB') : '';
    identity.hidden = projects.filter(other => other.projectName === project.projectName &&
      (other.location || other.estimate?.location || '') === (project.location || project.estimate?.location || '') &&
      dateKey(other.createdAt) === dateKey(project.createdAt)).length < 2;
    const progress = node('div', undefined, 'project-progress');
    const progressLabel = node('div', undefined, 'projects-progress-label');
    progressLabel.append(node('span', 'Task completion'), node('strong', `${summary.percent}%`));
    const bar = node('div', undefined, 'progress-bar');
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', `${name}: task completion`);
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', String(summary.percent));
    const fill = node('div', undefined, 'progress-fill'); fill.style.width = `${summary.percent}%`; bar.append(fill);
    progress.append(progressLabel, bar, node('p', `${summary.completed} of ${summary.total} tasks completed`, 'project-task-summary'));
    const metrics = node('dl', undefined, 'projects-finances');
    const rawBudget = project.estimate?.totalCost ?? project.budget;
    const hasBudget = project.estimate || Number(rawBudget) > 0;
    const validBudget = rawBudget !== null && rawBudget !== undefined && Number.isFinite(Number(rawBudget)) && Number(rawBudget) >= 0;
    for (const [label, value] of [
      ['Planned budget', !hasBudget ? 'Not estimated' : validBudget ? Financials.format(financials.budget) : 'Unavailable'],
      ['Recorded expenditure', Financials.format(financials.spent)]
    ]) {
      const metric = node('div'), caption = node('dt'), icon = node('span');
      icon.dataset.icon = label === 'Planned budget' ? 'estimate' : 'expenses';
      caption.append(icon, node('span', label));
      metric.append(caption, node('dd', value)); metrics.append(metric);
    }
    const meta = node('div', undefined, 'projects-card-meta');
    const stamp = project.createdAt;
    const date = typeof stamp === 'string' && stamp.trim() ? new Date(stamp) : null;
    if (date && Number.isFinite(date.getTime())) {
      const time = node('time', `Created ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);
      time.dateTime = stamp; meta.append(time);
    } else meta.append(node('span', 'Creation date not recorded'));
    card.append(top, heading, location, meta, identity, progress, metrics);
    if (!financials.available) card.append(node('p', 'Expense records need review. Existing data is preserved.', 'projects-data-note'));
    else if (legacyFinancialNotice(project)) card.append(node('p', 'Historical totals are kept separately from recorded expenditure.', 'projects-data-note'));
    const actions = node('div', undefined, 'project-actions');
    const actionContext = `${name}, ${location.textContent}, ${meta.textContent}${identity.hidden ? '' : `, ${identity.textContent}`}`;
    const open = node('button', summary.isCompleted ? 'View Project' : 'Open Project', 'open-btn'); open.type = 'button';
    open.setAttribute('aria-label', `${open.textContent}: ${actionContext}`);
    open.onclick = () => {
      currentProjectId = project.id;
      localStorage.setItem('currentProjectId', project.id);
      goTo('estimate-result.html');
    };
    const remove = node('button', 'Delete', 'delete-btn'); remove.type = 'button';
    remove.setAttribute('aria-label', `Delete project: ${actionContext}`);
    remove.onclick = () => {
      if (!confirm(`Delete "${name}"?\nReference: ${project.id}\nThis removes this project's saved record.`)) return;
      // Read again so deleting a card cannot overwrite updates saved in another tab.
      const fresh = JSON.parse(localStorage.getItem('projects')) || [];
      projects = fresh.filter(p => p.id !== project.id);
      localStorage.setItem('projects', JSON.stringify(projects));
      currentProjectId = localStorage.getItem('currentProjectId');
      if (project.id === currentProjectId) {
        currentProjectId = projects[0]?.id || null;
        if (currentProjectId) localStorage.setItem('currentProjectId', currentProjectId);
        else localStorage.removeItem('currentProjectId');
      }
      initProjectsPage();
      (container.querySelector('.open-btn') || document.querySelector('.projects-header .new-project-btn'))?.focus();
    };
    actions.append(open, remove); card.append(actions); container.append(card);
  }
}


// ===============================
// 📄 DOWNLOAD PROJECT SUMMARY
// ===============================
function downloadProjectSummary() {
  if (!projectState) return;

  const data = {
    name: projectState.projectName,
    budget: projectState.estimate?.totalCost || 0,
    spent: Financials.calculate(projectState).spent,
    expenses: projectState.expenses || [],
    legacyFinancials: projectState.legacyFinancials || null,
    startDate: projectState.startDate,
    endDate: projectState.endDate,
    contractor: projectState.hiredContractor?.name || "None",
    stages: projectState.stages.map(stage => ({
      name: stage.name,
      completed: stage.tasks.every(t => t.status === "completed")
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "project-summary.json";
  a.click();

  URL.revokeObjectURL(url);
}

// ===============================
// 🎯 FILTER CONTRACTORS BY ROLE
// ===============================
function filterContractorsByRole() {
  console.log("🚫 Filter disabled");
  return;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;

  toast.style.position = "fixed";
  toast.style.bottom = "90px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#111827";
  toast.style.color = "#fff";
  toast.style.padding = "14px 22px";
  toast.style.borderRadius = "10px";
  toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
  toast.style.zIndex = "9999";
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "500";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

// ===============================
// SHOW PROJECT COMPLETION
// ===============================
function showProjectCompletion() {
  if (window.ProjectExperience) return ProjectExperience.openReview();
  ConstructionUI.message("All recorded tasks are completed. Open the project dashboard to review completion.");
}

// ===============================
//      GO TO PROJECTS
// ===============================
function goToProjects() {
  window.location.href = "projects.html";
}

function startNewProject() {
  localStorage.removeItem("currentProjectId");
  localStorage.removeItem("estimateData");

  projectState = null;

  window.location.href = "create-project.html";
}

// ===============================
//    LAUNCH CONFETTI
// ===============================
function launchConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const pieces = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 6 + 4,
    speed: Math.random() * 3 + 2,
    color: ["#2563eb", "#22c55e", "#f59e0b", "#ef4444"][Math.floor(Math.random()*4)]
  }));

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach(p => {
      p.y += p.speed;
      if (p.y > canvas.height) p.y = -10;

      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    requestAnimationFrame(update);
  }

  update();
}

// ============================
//    TASK INTELLIGENCE
// ============================
function renderTaskIntelligence() {
  const box = document.getElementById('taskIntelligence'); if(!box)return;box.replaceChildren();
  const next = window.TaskNavigation?.unfinished(projectState)[0] || Construction.nextTask(projectState);
  if(!next)return;
  const text=document.createElement('p');text.textContent='Choose any stage or task below. Professional support is optional.';box.append(text);
}

document.querySelectorAll(".toggle-header").forEach(header => {
  header.addEventListener("click", function () {
    this.parentElement.classList.toggle("active");
  });
});

function showAlert(message, onClose) {
  const overlay = document.getElementById("customAlert");
  const text = document.getElementById("alertMessage");
  const btn = document.getElementById("alertOkBtn");

  if (!overlay || !text || !btn) return;

  text.textContent = message;
  overlay.classList.remove("hidden");

  btn.onclick = () => {
    overlay.classList.add("hidden");

    if (onClose) onClose(); // ✅ run after closing
  };
}
