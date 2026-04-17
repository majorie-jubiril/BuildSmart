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

  if (!state.spent) {
    state.spent = 0;
  }

  if (!state.currentStage) {
    state.currentStage = "foundation";
  }

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
  const index = projects.findIndex(p => p.id === projectState.id);

  if (index !== -1) {
    projects[index] = projectState;
  } else {
    projects.push(projectState);
  }

  // =========================
  // SAVE EVERYTHING
  // =========================
  localStorage.setItem("projects", JSON.stringify(projects));
  localStorage.setItem("currentProjectId", projectState.id);
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

  // =========================
  // GLOBAL FEATURES (ALL PAGES)
  // =========================
  initContractorSearch();
  initSaveButtonGlobal();

  // =========================
  // PAGE DETECTION
  // =========================
  const path = window.location.pathname;

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

      const { stageId, taskId } = currentTaskContext;

      if (stageId && taskId) {
        completeTask(stageId, taskId);
        closeTaskModal();
      }
    }

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
function completeTask(stageId, taskId) {
  if (!projectState) return;

  const stage = projectState.stages.find(s => s.id === stageId);
  if (!stage) return;

  const task = stage.tasks.find(t => t.id === taskId);
  if (!task || task.status === "completed") return;

  // =========================
  // REQUIRE CONTRACTOR
  // =========================
  const requiredCapability = task.requiredCapability;
  const hired = projectState?.hiredContractors || {};

  // 🔥 capability-based validation
  /*const hasCapability = hasRequiredCapability(hired, requiredCapability);

  if (!hasCapability) {
    showAlert(
      `This task requires ${requiredCapability || "specialized"} work. Please hire a suitable contractor.`,
      () => {
        window.location.href = "contractors.html";
      }
    );
    return;
  }*/

  const hasCapability = hasRequiredCapability(hired, requiredCapability);

  // TEMP FIX: allow completion even if capability check fails
    if (!hasCapability) {
      console.warn("⚠️ Capability check failed — allowing for now");
    }

  // =========================
  // MARK COMPLETE (CRITICAL FIX)
  // =========================
  task.status = "completed";
  task.progress = 100;
  showToast("Task completed successfully ✅");

  // =========================
  // 💰 ACTUAL COST SIMULATION
  // =========================
  task.actualCost = task.actualCost || task.estimatedCost;

  // add to project total spent
  projectState.spent = (projectState.spent || 0) + task.actualCost;

  // =========================
  // PERFORMANCE TRACKING
  // =========================
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
  const actual = task.actualCost || 0;
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

  // =========================
  // UNLOCK NEXT TASK (KEY FIX)
  // =========================
  const nextTask = stage.tasks.find(t => t.status !== "completed");

  if (nextTask) {
    nextTask.status = "pending"; // user must click Start
  }

  // =========================
  // STAGE COMPLETION (CRITICAL FIX)
  // =========================
  const allCompleted = stage.tasks.every(t => t.status === "completed");

  if (allCompleted) {
    showToast(`🎉 ${stage.name || "Stage"} completed!`);
    // ✅ mark stage complete
    if (!projectState.completedStages.includes(stageId)) {
      projectState.completedStages.push(stageId);
    }

    const nextStage = getNextStage(stageId);

    if (nextStage !== stageId) {
      projectState.currentStage = nextStage;
    } else {
      // ✅ FINAL PROJECT COMPLETION
      projectState.currentStage = null;
      projectState.isCompleted = true;
      showProjectCompletion();
      // 🆕 SET END DATE (SAFE)
      if (!projectState.endDate) {
        projectState.endDate = new Date().toISOString();
      }
    }
  }

  // =========================
  // STAGE COMPLETION
  // =========================
  saveProjectState();
  refreshUI();

  // ===========================
  // 🔔 NEXT TASK GUIDANCE
  // ===========================
  const currentStageObj = projectState.stages.find(
    s => s.id === projectState.currentStage
  );

  if (currentStageObj) {
    const nextTask = currentStageObj.tasks.find(
      t => t.status !== "completed"
    );

    if (nextTask) {
      const role = nextTask.requiredContractor;

      showAlert(
        `🎉 Task completed!\n\nNext: ${nextTask.name}\n\nYou may need a ${role}.`,
        () => {
          window.location.href = `contractors.html?role=${encodeURIComponent(role)}`;
        },
        "success"
      );
    }
}
}

// =========================
// 🕒 SET PROJECT START DATE
// =========================
  function renderProjectDates() {
  if (!projectState) return; // 🛑 CRITICAL GUARD

  const dateEl = document.getElementById("projectDates");
  if (!dateEl) return;

  const start = projectState.startDate;
  const end = projectState.endDate;

  if (!start) {
    dateEl.textContent = "Not started";
    return;
  }

  const startText = new Date(start).toLocaleDateString();

  if (end) {
    const endText = new Date(end).toLocaleDateString();
    dateEl.textContent = `Started: ${startText} • Completed: ${endText}`;
  } else {
    dateEl.textContent = `Started: ${startText}`;
  }
}

// ===============================
// START TASK (CONTROLLED)
// ===============================
function startTask(stageId, taskId) {
   console.log("START TASK CLICKED", stageId, taskId);
  if (!projectState) return;

  // 🆕 SET START DATE (ONLY ON FIRST ACTION)
  if (!projectState?.startDate) {
    projectState.startDate = new Date().toISOString();
  }

  const stage = projectState.stages.find(s => s.id === stageId);
  if (!stage) return;

  const task = stage.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.status = "active";
  task.progress = 0;

  saveProjectState();
  refreshUI();
}

// ===============================
// HELPERS
// ===============================

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
  currentTaskContext.stageId = stageId;
  currentTaskContext.taskId = taskId;

  // 🧠 GET CURRENT TASK
  const stage = projectState?.stages?.find(s => s.id === stageId);
  const task = stage?.tasks?.find(t => t.id === taskId);

  // 🧠 UPDATE MODAL TEXT
  const uploadLabel = document.getElementById("uploadLabel");
  const title = document.getElementById("taskModalTitle");

  if (uploadLabel && task) {
    uploadLabel.textContent = `Upload ${task.name} image`;
  }

  if (title && task) {
    title.textContent = `Complete ${task.name}`;
  }

  // 🚀 OPEN MODAL (AFTER updating content)
  const modal = document.getElementById("taskModal");
  if (modal) {
    modal.classList.remove("hidden");
  }
}

// ===============================
// CLOSE TASK MODAL
// ===============================
function closeTaskModal() {
  const modal = document.getElementById("taskModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  // reset inputs
  document.getElementById("taskCostInput").value = "";
  document.getElementById("taskNotesInput").value = "";
  document.getElementById("taskImageInput").value = "";
}

// ==========================
// TASK COMPLETION
// ==========================
function handleTaskCompletion() {

  console.log("CONFIRM CLICKED");

  // ===========================
  // GET CURRENT STAGE
  // ===========================
  const stage = projectState.stages.find(
    s => s.id === projectState.currentStage
  );
  if (!stage) return;

  // ===========================
  // GET ACTIVE TASK
  // ===========================
  const task = stage.tasks.find(
    t => t.status === "active"
  );
  if (!task) return;

  // ===========================
  // MARK TASK COMPLETE
  // ===========================
  task.status = "completed";

  // =========================
  // CHECK IF STAGE IS COMPLETE
  // =========================
  const allCompleted = stage.tasks.every(t => t.status === "completed");

  if (allCompleted) {
    console.log("🎉 Stage fully completed");

    const currentIndex = projectState.stages.findIndex(
      s => s.id === projectState.currentStage
    );

    const nextStage = projectState.stages[currentIndex + 1];

    if (nextStage) {
      console.log("➡️ Moving to next stage:", nextStage.id);
      projectState.currentStage = nextStage.id;
    } else {
      console.log("🏁 Project fully completed");
      projectState.isCompleted = true;
    }
  }

  // ===========================
  // GET NEXT TASK
  // ===========================
  const nextTask = stage.tasks.find(t => t.status !== "completed");

  // ===========================
  // CONTRACTOR ALERT
  // ===========================
  if (nextTask && nextTask.requiredContractor) {

    const role = nextTask.requiredContractor;

    alert(`You've moved to "${nextTask.name}".\n\nYou need a ${role} to continue.`);

    window.location.href = "contractors.html";
  }

  // ===========================
  // SAVE ACTUAL COST
  // ===========================
  const costInput = document.getElementById("actualCost");
  if (costInput) {
    const cost = parseFloat(costInput.value) || 0;
    projectState.spent = (projectState.spent || 0) + cost;
  }

  // ===========================
  // CLOSE MODAL
  // ===========================
  closeTaskModal();

  // ===========================
  // SAVE + REFRESH UI
  // ===========================
  saveProjectState();

  if (!nextTask || !nextTask.requiredContractor) {
    refreshUI();
  }
}

// ===========================
// 🔄 GLOBAL UI REFRESH
// ===========================
function refreshUI() {
  updateDashboardUI();        // index page
  renderTaskListUI();         // task list
  renderProjectInsights?.();
  renderRecommendations();
  renderStageTracker();
  renderCurrentActionButton();
  renderCurrentActionCard();
  renderTaskIntelligence();
}

// ===========================
// CURRENT ACTION BUTTON
// ===========================
function renderCurrentActionButton() {
  const container = document.getElementById("currentActionButton");
  if (!container || !projectState) return;

  container.innerHTML = "";

  const stage = projectState.stages.find(
    s => s.id === projectState.currentStage
  );
  if (!stage) return;

  const task = stage.tasks.find(t => t.status !== "completed");

  console.log("🎯 BUTTON TASK:", task);

  // =========================
  // ✅ NO TASK → STAGE COMPLETE UI
  // =========================
  if (!task) {
    const msg = document.createElement("div");
    msg.className = "stage-complete-message";
    msg.textContent = "🎉 Stage completed";

    container.appendChild(msg);
    return;
  }

  // =========================
  // ✅ NORMAL BUTTON FLOW
  // =========================
  const btn = document.createElement("button");
  btn.className = "btn-primary-full"; // 👈 CLEAN

  if (!task.status || task.status === "pending") {
    btn.textContent = "Start Task";

    btn.onclick = () => {
      task.status = "active";
      saveProjectState();
      refreshUI();
    };
  }

  else if (task.status === "active") {
    btn.textContent = "Continue";

    btn.onclick = () => {
      openTaskModal(stage.id, task.id);
    };
  }

  container.appendChild(btn);
}

// =======================
// CURRENT ACTION CARD
// =======================
function renderCurrentActionCard() {
  if (!projectState) return;

  // 🔍 DEBUG POINT 1 (TOP LEVEL STATE)
  console.log("PROJECT STATE:", projectState);
  console.log("CURRENT STAGE:", projectState.currentStage);
  console.log("STAGES:", projectState.stages);

  const stage = projectState.stages.find(
    s => s.id === projectState.currentStage
  );

  // 🔍 DEBUG POINT 2 (STAGE RESOLUTION)
  console.log("FOUND STAGE:", stage);

  if (!stage) return;

  const nextTask = stage.tasks.find(
    t => t.status === "pending" || t.status === "active"
  );

  // =========================
  // 🧱 FALLBACK UI (CRITICAL FIX)
  // =========================
  if (!nextTask) {

    const stageEl = document.querySelector(".action-stage");
    const taskEl = document.querySelector(".action-task");
    const insightList = document.querySelector(".insight-list");
    const costEl = document.querySelector(".action-cost");

    if (stageEl) stageEl.textContent = `${capitalize(stage.name)} • 100%`;
    if (taskEl) taskEl.textContent = "No active task";

    if (insightList) {
      insightList.innerHTML = `
        <li>🎉 All tasks in this stage are completed</li>
        <li>➡️ Preparing next stage...</li>
      `;
    }

    if (costEl) {
      costEl.textContent = "";
    }

    return; // 👈 keep return AFTER rendering fallback
  }

  // =========================
  // 🎯 UPDATE STAGE + TASK
  // =========================
  const stageEl = document.querySelector(".action-stage");
  const taskEl = document.querySelector(".action-task");

  const progress = getStageProgress(stage);
  if (stageEl) stageEl.textContent = `${capitalize(stage.name)} • ${progress}%`;
  if (taskEl) taskEl.textContent = nextTask.name;

  // =========================
  // 🧠 UPDATE INSIGHTS (DYNAMIC)
  // =========================
  const insightList = document.querySelector(".insight-list");

  if (insightList) {
    insightList.innerHTML = "";

    const insights = generateTaskInsights(nextTask, projectState);

    insights.forEach(insight => {
      if (insight.type === "action") return;

      const li = document.createElement("li");

      if (insight.type === "critical") {
        li.textContent = "⚠️ " + insight.message;
      } else {
        li.textContent = insight.message;
      }

      insightList.appendChild(li);
    });
  }

  // =========================
  // 💰 UPDATE COST
  // =========================
  const costEl = document.querySelector(".action-cost");

  if (costEl) {
    const cost = nextTask.estimatedCost || 0;
    costEl.textContent = `Estimated: ₵${cost.toLocaleString()}`;
  }
}

// ===============================
// TASK LIST UI
// ===============================
function renderTaskListUI() {

  const taskListEl = document.getElementById("taskList");
  if (!taskListEl) return;

  taskListEl.innerHTML = "";

  const stages = projectState.stages;

  stages.forEach(stage => {
    // =========================
    // 💰 STAGE FINANCIALS (NEW)
    // =========================
    let stageEstimated = 0;
    let stageActual = 0;

    stage.tasks.forEach(task => {
      stageEstimated += task.estimatedCost || 0;
      stageActual += task.actualCost || 0;
    });

    const prediction = generateStagePrediction(stage);
    const stageVariance = stageActual - stageEstimated;
    const stageVariancePercent = stageEstimated > 0
      ? ((stageVariance / stageEstimated) * 100).toFixed(1)
      : 0;

    const isOverBudget = stageVariance > 0;
    const card = document.createElement("div");
    card.className = "stage-card";

    const isCompleted = stage.tasks.every(t => t.status === "completed");
    const isCurrent = projectState.currentStage === stage.id;

    let stageStatus = "Locked";
    if (isCompleted) stageStatus = "Completed";
    else if (isCurrent) stageStatus = "In Progress";

    // =========================
    // HEADER
    // =========================
    const header = document.createElement("div");
    header.className = "stage-card-header";
    header.style.cursor = "pointer";

    header.innerHTML = `
      <div class="stage-header-top">
        <h3>${stage.name}</h3>
        <span class="stage-status">${stageStatus}</span>
      </div>

      <div class="stage-financial">
        ₵${stageActual.toLocaleString()} 
        <span class="stage-sub">
          / ₵${stageEstimated.toLocaleString()}
        </span>
        <span class="stage-variance ${isOverBudget ? "over" : "under"}">
          ${isOverBudget ? "+" : ""}₵${stageVariance.toLocaleString()} (${stageVariancePercent}%)
        </span>
      </div>
    `;

    header.onclick = () => {
      expandedStages[stage.id] = !expandedStages[stage.id];
      renderTaskListUI();
    };

    card.appendChild(header);

    if (prediction) {

      const isRisk = prediction.isOver;

      const forecast = document.createElement("div");
      forecast.className = `stage-prediction ${isRisk ? "risk" : "safe"}`;

      const trendIcon = isRisk ? "↑" : "↓";

      forecast.innerHTML = isRisk
        ? `⚠️ Projected Overrun ${trendIcon} ₵${prediction.variance.toLocaleString()} (${prediction.variancePercent}%)`
        : `✅ Projected Within Budget ${trendIcon}`;

      const note = document.createElement("div");
      note.className = "stage-note";

      note.textContent = isRisk
        ? "Upcoming tasks are likely to increase total cost"
        : "Current spending trend is stable";

      card.appendChild(forecast);
      card.appendChild(note);
    }

    // =========================
    // BODY
    // =========================
    const body = document.createElement("div");
    body.className = "stage-card-body";

    // =========================
    // COMPLETED STAGE
    // =========================
    if (isCompleted) {

    if (expandedStages[stage.id]) {

      stage.tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item completed";

        const estimated = task.estimatedCost || 0;
        const actual = task.actualCost || 0;

        const variance = actual - estimated;
        const variancePercent = estimated > 0
          ? ((variance / estimated) * 100).toFixed(1)
          : 0;

        const isOver = variance > 0;

        item.innerHTML = `
          ✔ ${task.name} — ₵${actual.toLocaleString()}
          <div class="task-sub">
            Est: ₵${estimated.toLocaleString()}
          </div>
          <div class="task-variance ${isOver ? "over" : "under"}">
            ${isOver ? "+" : ""}₵${variance.toLocaleString()} (${variancePercent}%)
          </div>
        `;

        body.appendChild(item);
      });
    }

}

    // =========================
    // CURRENT STAGE
    // =========================
    else if (isCurrent) {

      const nextTask = stage.tasks.find(t => t.status !== "completed");
      const completedTasks = stage.tasks.filter(t => t.status === "completed");
      const pendingTasks = stage.tasks.filter(t => t.status === "pending");

      // COMPLETED (TOGGLED BY HEADER)
      if (completedTasks.length > 0 && expandedStages[stage.id]) {

        completedTasks.forEach(task => {
          const item = document.createElement("div");
          item.className = "task-item completed";

          const estimated = task.estimatedCost || 0;
          const actual = task.actualCost || 0;

          const variance = actual - estimated;
          const variancePercent = estimated > 0
            ? ((variance / estimated) * 100).toFixed(1)
            : 0;

          const isOver = variance > 0;

          item.innerHTML = `
            ✔ ${task.name} — ₵${actual.toLocaleString()}
            <div class="task-sub">
              Est: ₵${estimated.toLocaleString()}
            </div>
            <div class="task-variance ${isOver ? "over" : "under"}">
              ${isOver ? "+" : ""}₵${variance.toLocaleString()} (${variancePercent}%)
            </div>
          `;

          body.appendChild(item);
        });

      }

      // CURRENT TASK
      if (nextTask) {

        const item = document.createElement("div");
        item.className = "task-item active-task";

        const label = document.createElement("span");

        // =========================
        // 💰 TASK COST UI (CURRENT TASK)
        // =========================
        const costEl = document.createElement("div");
        costEl.className = "task-cost";

        const estimated = nextTask.estimatedCost || 0;
        const actual = nextTask.actualCost || 0;

        if (nextTask.status === "completed") {
          costEl.textContent = `Estimated: ₵${estimated.toLocaleString()} • Actual: ₵${actual.toLocaleString()}`;
        } else {
          costEl.textContent = `Estimated: ₵${estimated.toLocaleString()}`;
        }

        // 🧠 FORCE TEST (IMPORTANT)
        console.log("INTELLIGENCE TEST:", nextTask);

        // 🧠 GENERATE INSIGHTS
        const insights = generateTaskInsights(nextTask, projectState);
        console.log("INSIGHTS RESULT:", insights);

        const insightsEl = renderTaskInsights(insights);

        if (nextTask.status === "active") {
          label.textContent = nextTask.name;

          const btn = document.createElement("button");
          btn.className = "task-btn primary";
          btn.textContent = "Mark as Completed";

          btn.onclick = () => {
            openTaskModal(stage.id, nextTask.id);
          };

          item.appendChild(label);
          item.appendChild(costEl);
          item.appendChild(btn);

          // 🧠 ATTACH INSIGHTS
        if (insightsEl) {
          item.appendChild(insightsEl);
        }

        } else {
          label.textContent = nextTask.name;

          item.appendChild(label);
          item.appendChild(costEl);
        }

        if (insightsEl) {
          item.appendChild(insightsEl);
        }
        body.appendChild(item);
      }

      // LOCKED TASKS
      pendingTasks.forEach(task => {
        if (nextTask && task.id === nextTask.id) return;

        const item = document.createElement("div");
        item.className = "task-item locked";
        item.textContent = `${task.name} — Locked`;

        body.appendChild(item);
      });

    }

    // =========================
    // LOCKED STAGE
    // =========================
    else {

      const msg = document.createElement("div");
      msg.className = "locked-msg";
      msg.textContent = "Complete previous stage to unlock";

      body.appendChild(msg);
    }

    // =========================
    // FINAL ATTACH
    // =========================
    card.appendChild(body);
    taskListEl.appendChild(card);

  });

}

  // =========================
  // 🎉 PROJECT COMPLETION MESSAGE
  // =========================
  const allStagesCompleted =
    projectState &&
    projectState.completedStages &&
    projectState.completedStages.length === projectState.stages.length;

  if (allStagesCompleted) {
    const finalMsg = document.createElement("div");
    finalMsg.className = "project-complete-msg";
    finalMsg.innerHTML = `
    <h3>🎉 Project Completed</h3>
    <p>Your building project has been successfully completed.</p>

    <div style="margin-top:10px;">
      <button class="primary-btn" onclick="goTo('projects.html')">View All Projects</button>
      <button class="secondary-btn" onclick="resetProject()">Start New Project</button>
    </div>
  `;

    taskListEl.appendChild(finalMsg);
}

// =========================
// STAGE TRACKER
// =========================
function renderStageTracker() {
  const container = document.getElementById("stageTracker");
  if (!container || !projectState) return;

    container.innerHTML = "";

  const stages = projectState.stages;
  const currentStage = projectState.currentStage;
  const completedStages = projectState.completedStages || [];

  // =========================
  // BUILD STAGE PILLS
  // =========================
  stages.forEach(stage => {
    const step = document.createElement("div");
    step.className = "stage-step";

    // =========================
    // STATE LOGIC
    // =========================
    if (completedStages.includes(stage.id)) {
      step.classList.add("completed");
      step.textContent = stage.name + " ✓";
    }
    else if (stage.id === currentStage) {
      step.classList.add("active");
      step.textContent = stage.name + " ⚡";
    }
    else {
      step.classList.add("locked");
      step.textContent = stage.name + " 🔒";
    }

    container.appendChild(step);
  });

  // =========================
  // META TEXT (CURRENT STAGE PROGRESS)
  // =========================
  const metaEl = document.getElementById("stageMeta");

  if (metaEl) {
    const stageObj = stages.find(s => s.id === currentStage);

    if (stageObj) {
      const total = stageObj.tasks.length;
      const completed = stageObj.tasks.filter(t => t.status === "completed").length;

      metaEl.textContent = `${stageObj.name} • ${completed} of ${total} tasks completed`;
    }
  }
}

// =========================
// HELPER FUNCTIONS
// =========================

function getStageProgress(stage) {
  if (!stage || !stage.tasks) return 0;

  const total = stage.tasks.length;
  const completed = stage.tasks.filter(t => t.status === "completed").length;

  if (total === 0) return 0;

  return Math.round((completed / total) * 100);
}

// ===============================
// 🧠 ROLE RESOLVER (MASTER FIX)
// ===============================
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
  return {
    name: card.dataset.name,
    role: card.dataset.role,
    rating: card.dataset.rating,
    reviews: card.dataset.reviews,
    location: card.dataset.location,
    image: card.dataset.image,
    experience: card.dataset.experience,
    projects: card.dataset.projects,
    about: card.dataset.about,
    projectList: card.dataset.projectlist,
    skills: card.dataset.skills,
    certs: card.dataset.certs
  };
}

// ===============================
// PROJECT FINANCIAL HELPERS
// ===============================
function calculateProjectFinancials(state) {
  if (!state) return { budget: 0, spent: 0, variance: 0 };

  const budget = state.estimate?.totalCost || state.budget || 0;
  const spent = state.spent || 0;

  const variance = budget > 0
    ? ((spent - budget) / budget) * 100
    : 0;

  return {
    budget,
    spent,
    variance
  };
}

// ===============================
// PROJECT PROGRESS HELPER
// ===============================
function calculateProjectProgress(project) {
  if (!project || !project.stages) return 0;

  let totalTasks = 0;
  let completedTasks = 0;

  project.stages.forEach(stage => {
    stage.tasks.forEach(task => {
      totalTasks++;
      if (task.status === "completed") {
        completedTasks++;
      }
    });
  });

  if (totalTasks === 0) return 0;

  return Math.round((completedTasks / totalTasks) * 100);
}

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

  const stageId = projectState?.currentStage;
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
  if (!projectState || !projectState.stages) return null;

  let totalEstimated = projectState.estimate?.totalCost || 0;
  let totalActual = 0;
  let completedTasks = 0;
  let remainingTasks = 0;

  projectState.stages.forEach(stage => {
    stage.tasks.forEach(task => {
      const est = task.estimatedCost || 0;
      const act = task.actualCost || 0;

      if (task.status === "completed") {
        totalActual += act;
        completedTasks++;
      } else {
        remainingTasks++;
      }
    });
  });

  if (completedTasks === 0) return null;

  const avgCost = totalActual / completedTasks;
  const projectedRemaining = avgCost * remainingTasks;
  const projectedTotal = totalActual + projectedRemaining;

  const variance = projectedTotal - totalEstimated;
  const variancePercent = totalEstimated > 0
    ? ((variance / totalEstimated) * 100).toFixed(1)
    : 0;

  return {
    projectedTotal,
    variance,
    variancePercent,
    isOver: variance > 0
  };
}

// ===============================
// 🔮 STAGE-LEVEL PREDICTION
// ===============================
function generateStagePrediction(stage) {
  if (!stage || !stage.tasks) return null;

  let estimated = 0;
  let actual = 0;
  let completed = 0;
  let remaining = 0;

  stage.tasks.forEach(task => {
    const est = task.estimatedCost || 0;
    const act = task.actualCost || 0;

    estimated += est;

    if (task.status === "completed") {
      actual += act;
      completed++;
    } else {
      remaining++;
    }
  });

  if (completed === 0) return null;

  const avg = actual / completed;
  const projectedRemaining = avg * remaining;
  const projectedTotal = actual + projectedRemaining;

  const variance = projectedTotal - estimated;
  const variancePercent = estimated > 0
    ? ((variance / estimated) * 100).toFixed(1)
    : 0;

  return {
    estimated,
    actual,
    projectedTotal,
    variance,
    variancePercent,
    isOver: variance > 0
  };
}

// ===============================
// RENDER TASK INSIGHTS (STRUCTURED)
// ===============================
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
  let saved = AppState.savedContractors;

  const exists = saved.find(c => c.name === contractor.name);

  if (exists) {
    saved = saved.filter(c => c.name !== contractor.name);
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
    el.textContent = "₵" + Math.round(value).toLocaleString();
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

  const stageId = projectState.currentStage;
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
  const spent = projectState.spent || 0;

  if (budget > 0) {
    const usage = (spent / budget) * 100;
    const remaining = budget - spent;

    if (usage > 100) {
      insights.critical.push({
        type: "critical",
        message: `Project is over budget by ₵${Math.abs(remaining).toLocaleString()}`
      });
    } 
    else if (usage > 85) {
      insights.warning.push({
        type: "warning",
        message: `Budget risk: ${Math.round(usage)}% used. Only ₵${remaining.toLocaleString()} remaining`
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
        message: `Budget healthy. ₵${remaining.toLocaleString()} remaining`
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
        message: `Hire a ${nextTask.requiredContractor} to proceed`
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

  const stage = state.stages.find(s => s.id === state.currentStage);
  const tasks = stage?.tasks || [];

  const nextTask = tasks.find(t => t.status !== "completed");
  const required = resolveRole(nextTask?.requiredContractor);
  console.log("🔍 REQUIRED:", required);
  console.log("🔍 HIRED MAP:", projectState.hiredContractor);
  console.log("🔍 HIRED:", projectState.hiredContractor);
  const hired = projectState.hiredContractor;

  const budget = state.estimate?.totalCost || 0;
  const spent = state.spent || 0;

  // =========================
  // 1. 🚨 NO CONTRACTOR
  // =========================
  if (!hired && nextTask) {
    actions.push({
      type: "critical",
      message: `Hire a ${nextTask.requiredContractor} to proceed`,
      action: () => {

      const role = nextTask.requiredContractor;

      // Persist
      localStorage.setItem("projectState", JSON.stringify(state));

      // Refresh UI
      refreshUI?.();

      // Navigate
      window.location.href = `contractors.html?role=${role}`;
    }
    });

    return actions; // highest priority → stop here
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
        message: insight.message,
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

  const insights = generateProjectInsights(projectState);

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

  const container = document.getElementById("recommendationList");
  if (!container) return;

  container.innerHTML = "";

  // =========================
  // DATA
  // =========================
  const prediction = generatePrediction(projectState);
  const actions = generateRecommendations(projectState);

  // =========================
  // MAIN PANEL
  // =========================
  const panel = document.createElement("div");
  panel.className = "intelligence-panel";

  // =========================
  // STATUS BLOCK
  // =========================
  const statusBlock = document.createElement("div");
  statusBlock.className = "intel-block";

  if (prediction) {

  const variance = prediction.variance || 0;
  const percent = prediction.variancePercent || 0;

  if (prediction.isOver) {
    statusBlock.innerHTML = `
      <h4>⚠️ Budget Status</h4>
      <p>Projected over budget by <strong>₵${variance.toLocaleString()}</strong> (${percent}%)</p>
    `;
  } else {
    statusBlock.innerHTML = `
      <h4>✅ Budget Status</h4>
      <p>Projected within budget</p>
    `;
  }

} else {
  statusBlock.innerHTML = `
    <h4>📊 Budget Status</h4>
    <p>No data yet</p>
  `;
}

  // =========================
  // RECOMMENDATION BLOCK
  // =========================
  const recBlock = document.createElement("div");
  recBlock.className = "intel-block";

  if (!actions || actions.length === 0) {
    recBlock.innerHTML = `
      <h4>💡 Recommendations</h4>
      <p>✅ No actions needed</p>
    `;
  } else {
    recBlock.innerHTML = `
      <h4>💡 Recommendations</h4>
      <ul>
        ${actions.map(a => `<li>${a.message}</li>`).join("")}
      </ul>
    `;
  }

  // =========================
  // OPTIONAL: CLICKABLE ACTIONS
  // =========================
  if (actions && actions.length > 0) {
    setTimeout(() => {
      const items = panel.querySelectorAll("li");
      items.forEach((el, i) => {
        if (actions[i].action) {
          el.style.cursor = "pointer";
          el.onclick = actions[i].action;
        }
      });
    }, 0);
  }

  // =========================
  // BUILD PANEL
  // =========================
  panel.appendChild(statusBlock);
  panel.appendChild(recBlock);

  container.appendChild(panel);
}

// ===============================
// CHART RENDER
// ===============================
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
function initContractorList() {
  if (!window.location.pathname.includes("contractors.html")) return;

  const noContractorMessage = document.getElementById("noContractorMessage");
  const container = document.getElementById("contractorList");
  const cards = document.querySelectorAll(".contractor-card");

  if (!container || !cards.length) return;

  // ===========================
  // 🎯 URL ROLE
  // ===========================
  const params = new URLSearchParams(window.location.search);
  const roleFromURL = params.get("role");
  const normalizedRole = (roleFromURL || "").toLowerCase().trim();

  const normalizedURLRole =
    CONTRACTOR_ROLE_MAP[roleFromURL?.toLowerCase()]?.toLowerCase() || "";

  console.log("🎯 Role from URL:", roleFromURL);

  // ===========================
  // 🎯 PROJECT CONTEXT
  // ===========================
  const stageId = projectState.currentStage;
  const stage = projectState.stages.find(s => s.id === stageId);

  if (!stage) return;

  if (!stage.tasks || stage.tasks.length === 0) {
    stage.tasks = generateStageTasks(stageId);
    saveProjectState();
  }

  const nextTask = stage.tasks.find(t => t.status !== "completed");
  if (!nextTask) return;

  const requiredRoles =
    TASK_ROLE_MAP[nextTask.id]?.map(normalizeRole) || [];

  // ===========================
  // 🎯 SCORE CONTRACTORS
  // ===========================
  const contractorArray = [];

  cards.forEach(card => {
    const rawRole = card.dataset?.role;
    const role = normalizeRole(typeof rawRole === "string" ? rawRole : "");

    let score = 0;
    let result = { status: "none" };

    // ✅ URL override (STRICT MATCH)
    if (normalizedURLRole) {
      const ROLE_ALIASES = {
        electrician: ["electrical engineer", "electrician"],
        mason: ["mason", "blockwork"],
        carpenter: ["carpenter", "woodwork"],
        plumber: ["plumber", "piping"],
        tiler: ["tiler", "tiles", "finishing"],
        roofer: ["roofer", "carpenter", "finishing"],
        painter: ["painter", "finishing"],
        surveyor: ["surveyor", "layout", "marking"],
        excavation: ["excavation", "excavation specialist"],
        foundation: ["foundation", "foundation specialist"],
      };

      const aliases = ROLE_ALIASES[normalizedURLRole] || [normalizedURLRole];

      if (aliases.some(a => role.includes(a))) {
        score = 3;
        result = { status: "best" };
      } else {
        score = 0;
      }

    } else {
      // ✅ KEEP your intelligence system exactly as is
      result = evaluateContractor(role, requiredRoles);

      if (result.status === "best") score = 3;
      else if (result.status === "acceptable") score = 2;
      else score = 0;
    }

    contractorArray.push({ card, score, result });
  });

  // ===========================
  // 🎯 SORT
  // ===========================
  contractorArray.sort((a, b) => b.score - a.score);

  // ===========================
  // 🎯 RENDER
  // ===========================
  let visibleCount = 0;

  contractorArray.forEach(({ card, score, result }) => {
    console.log("Contractor:", card.dataset.role, "Score:", score);

    card.classList.remove("best-match");

    if (score === 0) {
      card.style.display = "none";
    } else {
      visibleCount++;
      card.style.display = "block";

      if (result.status === "best") {
        card.classList.add("best-match");
      }
    }

    container.appendChild(card);

    const contractorData = extractContractorData(card);
    const trustScore = calculateTrustScore(contractorData);

    const trustEl = card.querySelector(".trust-score");
    if (trustEl) {
      trustEl.textContent = `${trustScore}% Reliable`;
    }
  });

  // ✅ FALLBACK (PUT IT RIGHT HERE)
  if (visibleCount === 0 && roleFromURL) {
    if (noContractorMessage) {
      noContractorMessage.style.display = "block";
    }

    contractorArray.forEach(({ card }) => {
      card.style.display = "block";
    });

  } else {
    if (noContractorMessage) {
      noContractorMessage.style.display = "none";
    }
  }


  // ===========================
  // 🎯 EMPTY STATE (FIXED)
  // ===========================
  if (noContractorMessage) {
    if (visibleCount === 0) {
      noContractorMessage.textContent =
        "No matching contractors available. Try another category or add one.";
      noContractorMessage.style.display = "block";
    } else {
      noContractorMessage.style.display = "none";
    }
  }

  // ===========================
  // 🎯 PROFILE NAVIGATION
  // ===========================
  document.querySelectorAll(".view-profile-btn").forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault();

      const card = this.closest(".contractor-card");
      const contractor = extractContractorData(card);

      localStorage.setItem(
        "selectedContractor",
        JSON.stringify(contractor)
      );

      window.location.href = "contractor-profile.html";
    };
  });

  // ===========================
  // 🎯 CARD CLICK
  // ===========================
  cards.forEach(card => {
    card.onclick = function (e) {
      if (e.target.closest("button")) return;

      const contractor = extractContractorData(card);
      localStorage.setItem(
        "selectedContractor",
        JSON.stringify(contractor)
      );

      window.location.href = "contractor-profile.html";
    };
  });

  // ===========================
// 🎯 FILTER BUTTONS (UI ONLY)
// ===========================
const filterButtons = document.querySelectorAll(".filter-btn");

  filterButtons.forEach(btn => {
    btn.onclick = () => {
      const selectedFilter = (btn.dataset.filter || "").toLowerCase().trim();

      // Active state
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      let visibleCount = 0;

      cards.forEach(card => {
        const role = String(card.dataset.role || "").toLowerCase().trim();

        const match =
          selectedFilter === "all" ||
          role === selectedFilter ||
          role.includes(selectedFilter);

        card.style.display = match ? "block" : "none";

        if (match) visibleCount++;
      });

      // ===========================
      // 🚨 EMPTY STATE (ONLY WHEN NEEDED)
      // ===========================
      if (noContractorMessage) {
        if (visibleCount === 0) {
          // ✅ Show message
          noContractorMessage.style.display = "block";

          // ✅ Show ALL contractors (fallback)
          cards.forEach(card => {
            card.style.display = "block";
          });

        } else {
          // ✅ Hide message if matches exist
          noContractorMessage.style.display = "none";
        }
      }
    };
  });

  // ✅ THIS PART GOES HERE (outside the loop)
  const defaultFilterBtn = document.querySelector(".filter-btn.active");

  if (defaultFilterBtn) {
    defaultFilterBtn.click();
  }
}

// ===============================
// CONTRACTOR SEARCH (FIXED)
// ===============================
function initContractorSearch() {
  const input = document.querySelector(".search-bar");
  if (!input) return;

  input.addEventListener("input", function () {
    const query = this.value.toLowerCase();

    document.querySelectorAll(".contractor-card").forEach(card => {
      const name = (card.dataset.name || "").toLowerCase();
      const role = (card.dataset.role || "").toLowerCase();
      const location = (card.dataset.location || "").toLowerCase();

      const match =
        name.includes(query) ||
        role.includes(query) ||
        location.includes(query);

      card.style.display = match ? "" : "none";
    });
  });
}

// ===============================
// CONTRACTOR PROFILE
// ===============================
function initContractorProfile() {
  if (!window.location.pathname.includes("contractor-profile.html")) return;

  const raw = localStorage.getItem("selectedContractor");

  let contractor;
  try {
    contractor = JSON.parse(raw);
  } catch {
    return;
  }

  if (!contractor) return;

  setText("contractorName", contractor.name);
  setText("contractorRole", contractor.role);
  setText("contractorRating", `⭐ ${contractor.rating}`);
  setText("contractorLocation", contractor.location);

  const img = document.getElementById("contractorImage");
  if (img) img.src = contractor.image;

  setText("contractorExperience", contractor.experience);
  setText("contractorProjects", contractor.projects);

  const about = document.querySelector("#about p");
  if (about) about.textContent = contractor.about;

  initHireButton(contractor);
}

// ===============================
// SAVED CONTRACTORS PAGE (RESTORED)
// ===============================
function initSavedPage() {

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
function initHireButton(contractor) {
  const btn = document.getElementById("hireContractorBtn");
  if (!btn) return;

  btn.onclick = () => {

    if (!projectState) {
      console.error("❌ No project state found");
      return;
    }

    // ✅ SAVE AS SINGLE OBJECT (CRITICAL FIX)
    projectState.hiredContractor = contractor;

    saveProjectState();

    console.log("✅ Contractor saved:", projectState.hiredContractor);

    alert(`${contractor.name} hired successfully`);

    window.location.href = "estimate-result.html";
  };
}

// ===============================
// CREATE PROJECT (CLEAN + ISOLATED)
// ===============================
function initCreateProject() {
  if (!window.location.pathname.includes("create-project.html")) return;

  const form = document.getElementById("projectForm");
  if (!form) return;

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

  handleSelection(bedroomBtns, val => bedrooms = val);
  handleSelection(floorBtns, val => floors = val);

  function updateEstimate() {
    const size = parseInt(houseSize?.value);
    const loc = location?.value?.toLowerCase();

    if (!size || !bedrooms || !floors) return;

    const estimate = calculateEstimate(size, bedrooms, floors, loc);

    const display = document.getElementById("liveEstimate");
    if (display) {
      display.textContent = "₵" + Math.round(estimate).toLocaleString();
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

    const totalCost = calculateEstimate(
      Number(houseSize),
      Number(bedrooms),
      Number(floors),
      location.toLowerCase()
    );

    // =========================
    // SAVE ESTIMATE INTO PROJECT
    // =========================

    if (projectState) {
      projectState.budget = totalCost;

      // Update in projects array
      const projectIndex = projects.findIndex(p => p.id === currentProjectId);
      if (projectIndex !== -1) {
        projects[projectIndex] = projectState;
      }

      // Persist
      localStorage.setItem("projects", JSON.stringify(projects));
    }

    // ✅ UPDATE ACTIVE PROJECT
  if (projectState) {
    projectState.budget = totalCost;

    // 🔁 persist to projects array
    const projects = JSON.parse(localStorage.getItem("projects")) || [];

    const updatedProjects = projects.map(p =>
      p.id === projectState.id ? projectState : p
    );

    localStorage.setItem("projects", JSON.stringify(updatedProjects));
  }

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
      breakdown: {
        foundation: totalCost * 0.2,
        structure: totalCost * 0.25,
        roofing: totalCost * 0.15,
        finishing: totalCost * 0.3,
        others: totalCost * 0.1
      }
    };

    saveProjectState();

    // =========================
    // NAVIGATE
    // =========================
    window.location.href = "contractors.html";
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
    console.error("No estimate data found");
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
    estimateValue.textContent = "₵" + Math.round(totalCost).toLocaleString();
  }

  const estimateLocation = document.getElementById("estimateLocation");
  if (estimateLocation) {
    estimateLocation.textContent = "Location: " + data.location;
  }

  // =========================
  // STAGE BREAKDOWN
  // =========================
  const stageWeights = {
    foundation: 0.2,
    structure: 0.3,
    roofing: 0.2,
    windows: 0.1,
    finishing: 0.2
  };

  const breakdown = {};

  Object.keys(stageWeights).forEach(stage => {
    breakdown[stage] = totalCost * stageWeights[stage];
  });

  updateStage(".foundation .amount", breakdown.foundation);
  updateStage(".structure .amount", breakdown.structure);
  updateStage(".roofing .amount", breakdown.roofing);
  updateStage(".windows .amount", breakdown.windows);
  updateStage(".finishing .amount", breakdown.finishing);

  // =========================
  // DISTRIBUTE COST (RUN ONCE)
  // =========================
  if (!projectState.costDistributed) {

    const breakdown = projectState.estimate?.breakdown || {};

    projectState.stages.forEach(stage => {
      const stageCost = breakdown[stage.id] || 0;

      if (!stage.tasks || stage.tasks.length === 0) return;

      const costPerTask = stageCost / stage.tasks.length;

      stage.tasks.forEach(task => {
        task.estimatedCost = Math.round(costPerTask);
      });

    });

    projectState.costDistributed = true;
    localStorage.setItem("projectState", JSON.stringify(projectState));
  }

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
  }, 0);
}

// ===============================
// CHART RENDER (FIXED)
// ===============================
function renderChart(values) {
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
        data: values,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// ===========================
// DASHBOARD UI (INDEX PAGE)
// ===========================
function updateDashboardUI() {
  if (!projectState) return;

  const state = projectState;

  // =========================
  // NO PROJECT STATE
  // =========================
  if (!state || !state.stages) {
    const nameEl = document.getElementById("projectName");
    const currentNameEl = document.getElementById("currentProjectName");

    if (currentNameEl) {
      currentNameEl.textContent = state.projectName || "My Project";
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
    if (budgetEl) budgetEl.textContent = "₵0";

    return;
  }

  // =========================
  // CALCULATE PROGRESS
  // =========================
  let totalTasks = 0;
  let completedTasks = 0;

  state.stages.forEach(stage => {
    totalTasks += stage.tasks.length;
    completedTasks += stage.tasks.filter(t => t.status === "completed").length;
  });

  const progress = totalTasks === 0
    ? 0
    : Math.round((completedTasks / totalTasks) * 100);

  // =========================
  // CURRENT STAGE
  // =========================
  const currentStageObj = getCurrentStage(state);

  const allCompleted = state.isCompleted === true;

  const hasStarted = state.stages.some(stage =>
    stage.tasks.some(t => t.status === "completed")
  );

  console.log("Dashboard Stage Check:", {
  currentStage: state.currentStage,
  stages: state.stages.map(s => s.id),
  found: currentStageObj
});

  // =========================
  // UPDATE UI
  // =========================
  const nameEl = document.getElementById("projectName");
  const progressEl = document.getElementById("progressPercent");
  const fillEl = document.getElementById("progressFill");
  const stageEl = document.getElementById("stageText");
  const budgetEl = document.getElementById("projectBudget");

  if (nameEl) {
    nameEl.textContent = state.projectName || "My Project";
  }

  if (progressEl) {
    progressEl.textContent = progress + "%";
  }

  if (fillEl) {
    fillEl.style.width = progress + "%";
  }

  if (stageEl) {
    if (!hasStarted) {
      stageEl.textContent = "Not started";
    } 
    else if (allCompleted) {
      stageEl.textContent = "Completed";
    } 
    else if (currentStageObj) {
      stageEl.textContent = currentStageObj.name;
    } 
    else {
      stageEl.textContent = "Not started";
    }
  }

  const { budget: budgetValue, spent: spentValue, variance } =
  calculateProjectFinancials(state);

  if (budgetEl) {
    budgetEl.textContent = "₵" + Math.round(budgetValue).toLocaleString();
  }

  const spentEl = document.getElementById("projectSpent");
  const varianceEl = document.getElementById("projectVariance");

  if (varianceEl) {
    const absValue = Math.abs(variance).toFixed(1);

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
    spentEl.textContent = "₵" + Math.round(spentValue).toLocaleString();
  }

  if (varianceEl) {
    const sign = variance > 0 ? "+" : "";
    varianceEl.textContent = sign + variance.toFixed(1) + "%";
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
    updateDashboardUI();
  };
}

// ===============================
// PROJECT MANAGER PAGE
// ===============================
function initProjectsPage() {
  const container = document.getElementById("projectList");
  if (!container) return;

  container.innerHTML = "";
  const activeProject = projects.find(p => !p.isCompleted);
  const otherProjects = projects.filter(p => p.id !== activeProject?.id);

  if (!projects || projects.length === 0) {
    container.innerHTML = "<p>No projects yet</p>";
    return;
  }

  if (activeProject) {
  const card = document.createElement("div");
  card.className = "project-card active-project";

  const progress = calculateProjectProgress(activeProject);

  const stageObj = activeProject.stages?.find(s => s.id === activeProject.currentStage);
  const stageName = stageObj?.name || "In progress";

  card.innerHTML = `
    <div class="project-header">
      <div class="project-title">
        ${activeProject.projectName || "Untitled Project"}
      </div>
      <div class="project-status active">In Progress</div>
    </div>

    <div class="project-progress">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
    </div>

    <div class="project-card-meta">
      <span>₵${(activeProject.spent || 0).toLocaleString()}</span>
      <span>${stageName}</span>
    </div>

    <div class="project-actions">
      <button class="open-btn">Continue Project</button>
      <button class="delete-btn">Delete</button>
    </div>
  `;

  // OPEN
  card.querySelector(".open-btn").onclick = () => {
    currentProjectId = activeProject.id;
    localStorage.setItem("currentProjectId", activeProject.id);
    goTo("estimate-result.html");
  };

  // DELETE
    card.querySelector(".delete-btn").onclick = () => {
      const confirmDelete = confirm(`Delete "${activeProject.projectName}"?`);
      if (!confirmDelete) return;

      projects = projects.filter(p => p.id !== activeProject.id);
      localStorage.setItem("projects", JSON.stringify(projects));

      if (activeProject.id === currentProjectId) {
        currentProjectId = projects[0]?.id || null;
        localStorage.setItem("currentProjectId", currentProjectId);
      }

      initProjectsPage();
    };

    container.appendChild(card);
  }
  otherProjects.forEach(project => {
    const card = document.createElement("div");
    card.className = "project-card";

    // =========================
    // CALCULATE PROGRESS
    // =========================
    const progress = calculateProjectProgress(project);
    
    // =========================
    // CURRENT STAGE
    // =========================
    const stageObj = project.stages?.find(s => s.id === project.currentStage);
    const stageName = project.isCompleted
      ? "Completed"
      : (stageObj?.name || "Not started");

    card.innerHTML = `
      <div class="project-header">
        <div class="project-title">
          ${project.projectName || "Untitled Project"}
        </div>
      </div>

      ${!project.isCompleted ? `
        <div class="project-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
      ` : ``}

      <div class="project-card-meta">
        <span>₵${(project.spent || 0).toLocaleString()}</span>
        <span>${project.isCompleted ? "Completed" : stageName}</span>
      </div>

      <div class="project-actions">
        <button class="open-btn">Open</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    // =========================
    // OPEN PROJECT
    // =========================
    card.querySelector(".open-btn").onclick = () => {
      currentProjectId = project.id;
      localStorage.setItem("currentProjectId", project.id);
      goTo("estimate-result.html");
    };

    // =========================
    // DELETE PROJECT
    // =========================
    card.querySelector(".delete-btn").onclick = () => {
      const confirmDelete = confirm(`Delete "${project.projectName}"?`);
      if (!confirmDelete) return;

      projects = projects.filter(p => p.id !== project.id);

      localStorage.setItem("projects", JSON.stringify(projects));

      if (project.id === currentProjectId) {
        currentProjectId = projects[0]?.id || null;
        localStorage.setItem("currentProjectId", currentProjectId);
      }

      initProjectsPage();
    };

    container.appendChild(card);
  });
}

// ===============================
// 📄 DOWNLOAD PROJECT SUMMARY
// ===============================
function downloadProjectSummary() {
  if (!projectState) return;

  const data = {
    name: projectState.projectName,
    budget: projectState.estimate?.totalCost || 0,
    spent: projectState.spent || 0,
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
  console.log("Completion state:", projectState);
  const modal = document.getElementById("projectCompleteModal");
  if (!modal) return;

  document.getElementById("summaryBudget").textContent =
    `₵${(projectState.budget || 0).toLocaleString()}`;

  document.getElementById("summarySpent").textContent =
    `₵${(projectState.spent || 0).toLocaleString()}`;

  modal.classList.remove("hidden");

  // 🎊 ADD THIS LINE
  launchConfetti();
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
  const box = document.getElementById("taskIntelligence");
  if (!box || !projectState) return;

  const stage = projectState.stages.find(
    s => s.id === projectState.currentStage
  );

  if (!stage) return;

  const task = stage.tasks.find(
    t => t.status === "pending" || t.status === "active"
  );

  if (!task) return;

  // ✅ USE YOUR EXISTING ENGINE
  const insights = generateTaskInsights(task, projectState);

  // ✅ RENDER USING YOUR EXISTING RENDERER
  const insightsEl = renderTaskInsights(insights);

  box.innerHTML = ""; // clear

  if (insightsEl) {
    box.appendChild(insightsEl);
  }
}

// ========================
//    TOGGLE SECTION
// ========================
document.querySelectorAll(".toggle-header").forEach(header => {
  header.addEventListener("click", function () {
    const section = this.parentElement;
    section.classList.toggle("active");
  });
});

// ===============================
// 💬 SHOW CUSTOM ALERT (WITH CALLBACK)
// ===============================
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
