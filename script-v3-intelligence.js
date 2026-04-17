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
  "General Contractor": ["general", "site clearing", "excavation"],
  "Surveyor": ["survey", "layout", "marking"],
  "Excavation Specialist": ["excavation", "site clearing"],
  "Foundation Specialist": ["foundation", "blockwork", "mason", "concrete works"],
  "Mason": ["mason", "blockwork", "foundation"],
  "Structural Engineer": ["structural", "inspection", "design"]
};

// =========================
// GLOBAL NAVIGATION
// =========================
function goTo(page) {
  window.location.href = page;
}

// ===============================
// ROLE NORMALIZATION
// ===============================
function normalizeRole(role) {
  if (!role) return "";
  return role.toLowerCase().trim();
}

// ===============================
// DYNAMIC TASK GENERATOR (CLEAN)
// ===============================
function generateStageTasks(stageId) {
  const taskMap = {

    foundation: [
      { id: "site-clearing", name: "Site Clearing", requiredContractor: "general", critical: false },
      { id: "site-layout", name: "Site Layout & Marking", requiredContractor: "surveyor", critical: false },
      { id: "excavation", name: "Excavation", requiredContractor: "general", critical: false },
      { id: "footing", name: "Footing Construction", requiredContractor: "mason", critical: true },
      { id: "foundation-wall", name: "Foundation Blockwork", requiredContractor: "mason", critical: false },
      { id: "dpc", name: "Damp Proof Course (DPC)", requiredContractor: "mason", critical: false },
      { id: "backfilling", name: "Backfilling & Compaction", requiredContractor: "general", critical: false }
    ],

    structure: [
      { id: "blockwork-super", name: "Wall Blockwork", requiredContractor: "mason", critical: false },
      { id: "columns", name: "Column Reinforcement", requiredContractor: "engineer", critical: true },
      { id: "lintel", name: "Lintel Casting", requiredContractor: "mason", critical: false },
      { id: "beam", name: "Beam Construction", requiredContractor: "engineer", critical: true },
      { id: "slab", name: "Slab Casting", requiredContractor: "engineer", critical: true }
    ],

    roofing: [
      { id: "roof-frame", name: "Roof Framing", requiredContractor: "carpenter", critical: false },
      { id: "roof-cover", name: "Roof Covering", requiredContractor: "roofer", critical: false },
      { id: "roof-waterproof", name: "Waterproofing", requiredContractor: "roofer", critical: false },
      { id: "gutter", name: "Gutter Installation", requiredContractor: "plumber", critical: false }
    ],

    windows: [
      { id: "window-install", name: "Window Installation", requiredContractor: "general", critical: false },
      { id: "door-install", name: "Door Installation", requiredContractor: "carpenter", critical: false },
      { id: "frame-fix", name: "Frame Fixing", requiredContractor: "carpenter", critical: false }
    ],

    finishing: [
      { id: "plastering", name: "Plastering", requiredContractor: "mason", critical: false },
      { id: "screeding", name: "Screeding", requiredContractor: "mason", critical: false },
      { id: "ceiling", name: "Ceiling Installation", requiredContractor: "carpenter", critical: false },
      { id: "tiling", name: "Tiling", requiredContractor: "tiler", critical: false },
      { id: "painting", name: "Painting", requiredContractor: "painter", critical: false },
      { id: "electrical", name: "Electrical Works", requiredContractor: "electrician", critical: true },
      { id: "plumbing", name: "Plumbing Works", requiredContractor: "plumber", critical: true },
      { id: "fixtures", name: "Fixtures", requiredContractor: "general", critical: false }
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
  if (required === "general") {
    if (role.includes("general")) return { status: "perfect" };
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
// INITIALIZE PROJECT STATE (CONTROLLED)
// ===============================
function initializeProjectState() {
  let state = null;

  // =========================
  // LOAD FROM MULTI PROJECTS
  // =========================
  if (projects.length > 0 && currentProjectId) {
    state = projects.find(p => p.id === currentProjectId);
  }

  // ✅ FIRST: handle null state
  if (!state) {
    state = {
      id: "project_" + Date.now(),
      projectName: "",
      location: "",
      budget: 0,
      spent: 0,
      currentStage: "foundation",
      startDate: null,
      endDate: null,
      hiredContractor: null,
      completedStages: [],
      stages: getDefaultStages()
    };

    // ✅ ADD TO PROJECTS ARRAY
    projects.push(state);
    currentProjectId = state.id;

    localStorage.setItem("projects", JSON.stringify(projects));
    localStorage.setItem("currentProjectId", currentProjectId);
  }

  // ✅ THEN: ensure field exists (for old data)
  if (!state.completedStages) {
    state.completedStages = [];
  }

  // 🔧 ENSURE TASKS EXIST (SINGLE SOURCE OF TRUTH)
  state.stages.forEach(stage => {
    if (!stage.tasks || stage.tasks.length === 0) {
      stage.tasks = generateStageTasks(stage.id);
    }
  });

  // 🔧 ENSURE CURRENT STAGE EXISTS
  const hasStarted = state.stages.some(stage =>
    stage.tasks.some(t => t.status === "completed")
  );

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
    initProjectDashboard();
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
    handleTaskCompletion();
  }

  // ✅ CANCEL BUTTON
  if (e.target.id === "cancelTaskBtn") {
    closeTaskModal();
  }

});
}

// =========================
// MODAL BUTTON EVENTS
// =========================
function openTaskModal(stageId, taskId) {
  currentTaskContext.stageId = stageId;
  currentTaskContext.taskId = taskId;

  const modal = document.getElementById("taskModal");
  if (modal) {
    modal.classList.remove("hidden");
  }
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
  if (!projectState.hiredContractor) {
    alert("You must hire a contractor before completing this task.");
    return;
  }

  // =========================
  // MARK COMPLETE (CRITICAL FIX)
  // =========================
  task.status = "completed";
  task.progress = 100;

  // =========================
  // 💰 ACTUAL COST SIMULATION
  // =========================
  task.actualCost = task.actualCost || task.estimatedCost;

  // add to project total spent
  projectState.spent = (projectState.spent || 0) + task.actualCost;

  // =========================
  // PERFORMANCE TRACKING
  // =========================
  const contractor = projectState.hiredContractor;

  if (contractor) {
  let performance = JSON.parse(localStorage.getItem("contractorPerformance")) || {};

  // =========================
  // 🧠 CONTRACTOR PERFORMANCE (UPGRADED)
  // =========================

  if (!performance[contractor.name]) {
    performance[contractor.name] = {
      completed: 0,
      totalVariance: 0,
      onBudget: 0
    };
  }

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
  performance[contractor.name].completed += 1;
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

// ===============================
// OPEN TASK MODAL
// ===============================
function openTaskModal(stageId, taskId) {
  currentTaskContext.stageId = stageId;
  currentTaskContext.taskId = taskId;

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
  const { stageId, taskId } = currentTaskContext;

  if (!stageId || !taskId) return;

  const cost = document.getElementById("taskCostInput").value;
  const notes = document.getElementById("taskNotesInput").value;
  const image = document.getElementById("taskImageInput").files[0];

  const stage = projectState.stages.find(s => s.id === stageId);
  if (!stage) return;

  const task = stage.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.actualCost = Number(cost) || 0;
  task.notes = notes || "";

  if (image) {
    task.imageName = image.name;
  }

  completeTask(stageId, taskId);
  closeTaskModal();
}

// ===============================
// RENDER PROJECT DATES
// ===============================
function renderProjectDates() {
  const dateEl = document.getElementById("projectDates");
  if (!dateEl) return;

  const start = projectState.startDate;
  const end = projectState.endDate;

  if (!start) {
    dateEl.textContent = "";
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

// ===========================
// 🔄 GLOBAL UI REFRESH
// ===========================
function refreshUI() {
  updateDashboardUI();        // index page
  renderTaskListUI();         // task list
  renderProjectInsights?.();
  renderRecommendations();
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

          const btn = document.createElement("button");
          btn.className = "task-btn primary";
          btn.textContent = "Start Task";

          btn.onclick = () => {
            startTask(stage.id, nextTask.id);
          };

          item.appendChild(label);
          item.appendChild(costEl);
          item.appendChild(btn);
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

  stages.forEach(stage => {
    const step = document.createElement("div");
    step.className = "stage-step";

    // =========================
    // STATE LOGIC
    // =========================
    const hasStarted = stages.some(stage =>
      stage.tasks.some(t => t.status === "completed")
    );

    if (!hasStarted) {
      step.classList.add("locked");
    }
    else if (completedStages.includes(stage.id)) {
      step.classList.add("completed");
    }
    else if (stage.id === currentStage) {
      step.classList.add("active");
    }
    else {
      step.classList.add("locked");
    }
  });
}

// ===============================
// PROJECT DASHBOARD INIT
// ===============================
function initProjectDashboard() {
  console.log("📊 Dashboard Initialized");

  if (!projectState) {
    console.error("No project state");
    return;
  }

  renderTaskListUI();
  renderProjectInsights();
  renderDashboardChart();
  renderRecommendations();
}

// ===============================
// STAGE TOGGLE STATE (UI MEMORY)
// ===============================
function getStageToggleState(stageId) {
  const state = JSON.parse(localStorage.getItem("stageToggleState")) || {};
  return state[stageId] || false;
}

function setStageToggleState(stageId, value) {
  const state = JSON.parse(localStorage.getItem("stageToggleState")) || {};
  state[stageId] = value;
  localStorage.setItem("stageToggleState", JSON.stringify(state));
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
// 🧠 INTELLIGENCE MAP (CENTRALIZED)
// ===============================
const INTELLIGENCE_MAP = {

  // ===============================
  // FOUNDATION
  // ===============================
  foundation: {

    "site-clearing": [
      {
        type: "info",
        message: "Proper clearing ensures accurate layout and prevents future structural misalignment."
      }
    ],

    "site-layout": [
      {
        type: "critical",
        message: "Incorrect layout leads to structural misalignment and legal boundary issues."
      }
    ],

    "excavation": [
      {
        type: "critical",
        message: "Improper excavation depth weakens foundation stability and load distribution."
      }
    ],

    "footing": [
      {
        type: "critical",
        message: "This stage determines structural stability. Poor reinforcement or weak concrete will lead to cracks and costly repairs later."
      },
      {
        type: "info",
        message: "Verify rebar spacing and concrete mix before pouring."
      },
      {
        type: "info",
        message: "Proper curing improves long-term strength."
      }
    ],

    "foundation-wall": [
      {
        type: "info",
        message: "Block alignment affects load transfer and wall durability."
      }
    ],

    "dpc": [
      {
        type: "critical",
        message: "Missing or poorly installed DPC leads to rising damp and long-term wall damage."
      }
    ],

    "backfilling": [
      {
        type: "info",
        message: "Proper compaction prevents settlement and future cracks."
      }
    ]
  },

  // ===============================
  // STRUCTURE
  // ===============================
  structure: {

    "blockwork-super": [
      {
        type: "info",
        message: "Wall alignment affects structural load distribution and finishing quality."
      }
    ],

    "columns": [
      {
        type: "critical",
        message: "Column reinforcement is critical to structural integrity. Errors may lead to collapse."
      }
    ],

    "lintel": [
      {
        type: "info",
        message: "Lintels distribute load above openings and prevent cracks."
      }
    ],

    "beam": [
      {
        type: "critical",
        message: "Beams carry structural loads. Poor casting compromises entire structure."
      }
    ],

    "slab": [
      {
        type: "critical",
        message: "Slab integrity affects building safety and load distribution."
      }
    ]
  },

  // ===============================
  // ROOFING
  // ===============================
  roofing: {

    "roof-frame": [
      {
        type: "critical",
        message: "Poor framing leads to roof instability and failure under load."
      }
    ],

    "roof-cover": [
      {
        type: "info",
        message: "Proper installation prevents leakage and weather damage."
      }
    ],

    "roof-waterproof": [
      {
        type: "critical",
        message: "Poor waterproofing leads to long-term leakage and structural damage."
      }
    ],

    "gutter": [
      {
        type: "info",
        message: "Proper drainage prevents water damage to foundation and walls."
      }
    ]
  },

  // ===============================
  // WINDOWS
  // ===============================
  windows: {

    "window-install": [
      {
        type: "info",
        message: "Incorrect installation leads to air leakage and water penetration."
      }
    ],

    "door-install": [
      {
        type: "info",
        message: "Poor alignment affects usability and finishing quality."
      }
    ],

    "frame-fix": [
      {
        type: "info",
        message: "Proper fixing ensures structural stability of openings."
      }
    ]
  },

  // ===============================
  // FINISHING
  // ===============================
  finishing: {

    "plastering": [
      {
        type: "info",
        message: "Surface preparation affects final wall smoothness and durability."
      }
    ],

    "screeding": [
      {
        type: "info",
        message: "Poor screeding leads to uneven flooring and finishing issues."
      }
    ],

    "ceiling": [
      {
        type: "info",
        message: "Incorrect installation affects aesthetics and durability."
      }
    ],

    "tiling": [
      {
        type: "info",
        message: "Proper spacing and leveling prevent cracks and detachment."
      }
    ],

    "painting": [
      {
        type: "info",
        message: "Surface preparation determines paint durability and finish quality."
      }
    ],

    "electrical": [
      {
        type: "critical",
        message: "Poor electrical work poses safety risks including fire hazards."
      }
    ],

    "plumbing": [
      {
        type: "critical",
        message: "Faulty plumbing leads to leaks and long-term structural damage."
      }
    ],

    "fixtures": [
      {
        type: "info",
        message: "Proper installation ensures usability and finishing quality."
      }
    ]
  }

};

// ===============================
// TASK INTELLIGENCE ENGINE (ADVISOR SYSTEM)
// ===============================
function generateTaskInsights(task, projectState) {
  const stageId = projectState?.currentStage;
  const hiredType = projectState?.hiredContractor?.type;

  let insights = [];

  // ===============================
  // BASE INTELLIGENCE (FROM MAP)
  // ===============================
  const stageMap = INTELLIGENCE_MAP[stageId];
  const taskInsights = stageMap?.[task.id];

  if (taskInsights) {
    insights = [...taskInsights];
  }

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
// RENDER TASK INSIGHTS (STRUCTURED)
// ===============================
function renderTaskInsights(insights) {
  if (!insights || insights.length === 0) return null;

  const container = document.createElement("div");
  container.className = "task-insights";

  // ===============================
  // GROUP INSIGHTS
  // ===============================
  const groups = {
    critical: [],
    warning: [],
    info: [],
    positive: []
  };

  insights.forEach(insight => {
    if (groups[insight.type]) {
      groups[insight.type].push(insight);
    }
  });

  // ===============================
  // RENDER GROUP
  // ===============================
  function renderGroup(title, items, type) {
    if (items.length === 0) return;

    const group = document.createElement("div");
    group.className = "insight-group";

    const heading = document.createElement("div");
    heading.className = `insight-heading ${type}`;
    heading.textContent = title;

    group.appendChild(heading);

    items.forEach(insight => {
      const item = document.createElement("div");
      item.className = `insight ${insight.type}`;
      item.textContent = insight.message;
      group.appendChild(item);
    });

    container.appendChild(group);
  }

  // ===============================
  // ORDER (VERY IMPORTANT)
  // ===============================
  renderGroup("🚨 Critical", groups.critical, "critical");
  renderGroup("⚠ Considerations", groups.warning, "warning");
  renderGroup("💡 Guidance", groups.info, "info");

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

  const nextTask = tasks.find(t => !t.status === "completed");
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const totalTasks = tasks.length;

  const hired = projectState.hiredContractor;
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
    insights.push({
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
  const hired = state.hiredContractor;

  const budget = state.estimate?.totalCost || 0;
  const spent = state.spent || 0;

  // =========================
  // 1. 🚨 NO CONTRACTOR
  // =========================
  if (!hired && nextTask) {
    actions.push({
      type: "critical",
      message: `Hire a ${nextTask.requiredContractor} to proceed`,
      action: () => goTo("contractors.html")
    });

    return actions; // highest priority → stop here
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

  const actions = generateRecommendations(projectState);

  if (!actions.length) {
    container.innerHTML = "<p>No actions needed</p>";
    return;
  }

  container.innerHTML = actions.map(action => `
    <div class="recommendation ${action.type}">
      <span>${action.message}</span>
    </div>
  `).join("");

  // attach click handlers
  container.querySelectorAll(".recommendation").forEach((el, i) => {
    if (actions[i].action) {
      el.style.cursor = "pointer";
      el.onclick = actions[i].action;
    }
  });
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
// CONTRACTOR LIST (SMART FILTER)
// ===============================
function initContractorList() {
  if (!window.location.pathname.includes("contractors.html")) return;

  console.log("👷 Contractor List Initialized");

  const cards = document.querySelectorAll(".contractor-card");

  if (!projectState || !projectState.stages) return;

  const stageId = projectState.currentStage;
  const stage = projectState.stages.find(s => s.id === stageId);

  if (!stage) return;

  // 🔧 Ensure tasks exist
  if (!stage.tasks || stage.tasks.length === 0) {
    stage.tasks = generateStageTasks(stageId);
    saveProjectState();
  }

  // 🔥 Get next task
  const task = stage.tasks.find(t => !t.status === "completed");
  if (!task) return;

  const required = task.requiredContractor;

  let visibleCount = 0;

  cards.forEach(card => {

  const role = (card.dataset.role || "").toLowerCase();

  // =========================
  // RESET UI
  // =========================
  card.classList.remove("hidden");

  // =========================
  // GET REQUIRED TASK
  // =========================
  const stage = projectState.stages.find(s => s.id === projectState.currentStage);
  const nextTask = stage?.tasks.find(t => t.status !== "completed");

  if (!nextTask) return;

  const required = nextTask.requiredContractor;

  // =========================
  // EVALUATE CONTRACTOR
  // =========================
  const result = evaluateContractor(role, required);

  if (result.status === "invalid") {
    card.classList.add("hidden");
    return;
  }

  visibleCount++;

  // =========================
  // TRUST SCORE
  // =========================
  const contractorData = extractContractorData(card);
  const trustScore = calculateTrustScore(contractorData);

  const trustEl = card.querySelector(".trust-score");

  if (trustEl) {
    trustEl.textContent = `Reliability: ${trustScore}%`;
  }

  // =========================
  // FIT BADGE (NEW SYSTEM)
  // =========================
  const fitEl = card.querySelector(".fit-badge");

  if (fitEl) {

    if (result.status === "perfect") {
      fitEl.textContent = "Best Fit";
      fitEl.className = "fit-badge best";
    }

    else if (result.status === "acceptable") {
      fitEl.textContent = "Good Fit";
      fitEl.className = "fit-badge good";
    }

    else if (result.status === "overqualified") {
      fitEl.textContent = "Overqualified";
      fitEl.className = "fit-badge over";
    }

    else {
      fitEl.textContent = "Not Suitable";
      fitEl.className = "fit-badge bad";
    }

  }

});

  // =========================
  // EMPTY STATE
  // =========================
  const empty = document.getElementById("noContractorMessage");

  if (empty) {
    empty.style.display = visibleCount === 0 ? "block" : "none";
  }

  // =========================
  // PROFILE NAVIGATION
  // =========================
  document.querySelectorAll(".view-profile-btn").forEach(btn => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();

      const card = this.closest(".contractor-card");
      const contractor = extractContractorData(card);

      localStorage.setItem("selectedContractor", JSON.stringify(contractor));

      window.location.href = "contractor-profile.html";
    });
  });
}

// =========================
// CARD CLICK (NEW)
// =========================
document.querySelectorAll(".contractor-card").forEach(card => {

  card.style.cursor = "pointer";

  card.addEventListener("click", function (e) {

    // ❌ Prevent conflict with buttons
    if (e.target.closest("button")) return;

    const contractor = extractContractorData(card);

    localStorage.setItem("selectedContractor", JSON.stringify(contractor));

    window.location.href = "contractor-profile.html";
  });

});

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
// HIRE CONTRACTOR (CLEAN)
// ===============================
function initHireButton(contractor) {
  const btn = document.getElementById("hireContractorBtn");
  if (!btn) return;

  btn.onclick = () => {
    projectState.hiredContractor = contractor;
    saveProjectState();

    alert(`${contractor.name} hired successfully`);

    window.location.href = "estimate-result.html";
  };
}

// ===============================
// CREATE PROJECT (FIXED)
// ===============================
function initCreateProject() {
  if (!window.location.pathname.includes("create-project.html")) return;

  const form = document.getElementById("projectForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const nameInput = document.getElementById("projectName");
    const name = nameInput?.value.trim();

    if (!name) {
      alert("Please enter a project name");
      return;
    }

   const newProject = {
  id: "project_" + Date.now(),
  projectName: name,
  location: "",
  budget: 0,
  spent: 0,
  currentStage: "foundation",
  hiredContractor: null,
  completedStages: [],
  stages: getDefaultStages()
};

projects.push(newProject);
currentProjectId = newProject.id;

localStorage.setItem("projects", JSON.stringify(projects));
localStorage.setItem("currentProjectId", currentProjectId);

// ✅ SET ACTIVE STATE
projectState = newProject;

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

  if (!projects || projects.length === 0) {
    container.innerHTML = "<p>No projects yet</p>";
    return;
  }

  projects.forEach(project => {
    const card = document.createElement("div");
    card.className = "project-card";

    // =========================
    // CALCULATE PROGRESS
    // =========================
    let total = 0;
    let completed = 0;

    project.stages?.forEach(stage => {
      total += stage.tasks.length;
      completed += stage.tasks.filter(t => t.status === "completed").length;
    });

    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    // =========================
    // CURRENT STAGE
    // =========================
    const stageObj = project.stages?.find(s => s.id === project.currentStage);
    const stageName = stageObj?.name || "Not started";

    card.innerHTML = `
      <div class="project-header">
        <h3>${project.projectName || "Untitled Project"}</h3>
      </div>

      <div class="project-progress-bar">
        <div class="project-progress-fill" style="width: ${progress}%"></div>
      </div>

      <div class="project-meta">
        <span>Progress: ${progress}%</span>
        <span>Stage: ${stageName}</span>
      </div>

      <div class="project-actions">
        <button class="primary-btn">Open</button>
        <button class="danger-btn">Delete</button>
      </div>
    `;

    // =========================
    // OPEN PROJECT
    // =========================
    card.querySelector(".primary-btn").onclick = () => {
      currentProjectId = project.id;
      localStorage.setItem("currentProjectId", project.id);

      goTo("estimate-result.html");
    };

    // =========================
    // DELETE PROJECT
    // =========================
    card.querySelector(".danger-btn").onclick = () => {
      const confirmDelete = confirm(`Delete "${project.projectName}"?`);
      if (!confirmDelete) return;

      projects = projects.filter(p => p.id !== project.id);

      localStorage.setItem("projects", JSON.stringify(projects));

      // if deleted project was active → reset
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
