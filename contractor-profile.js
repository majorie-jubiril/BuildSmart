// ===============================
  // CONTRACTOR PROFILE SELECTION
  // ===============================
  const buttons = document.querySelectorAll(".view-profile-btn");

  if (buttons.length > 0) {
    buttons.forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();

        const card = this.closest(".contractor-card");

        const contractor = {
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

        localStorage.setItem("selectedContractor", JSON.stringify(contractor));

        window.location.href = "contractor-profile.html";
      });
    });
  }


  // ===============================
  // LOAD CONTRACTOR PROFILE DATA
  // ===============================
  const data = localStorage.getItem("selectedContractor");

  let contractor = null;

  try {
   contractor = JSON.parse(data);
  } catch (error) {
    console.error("Invalid JSON in selectedContractor:", data);
  }

  if (contractor) {

      console.log("Loaded contractor:", contractor);

    // ===== BASIC INFO =====
    const nameEl = document.getElementById("contractorName");
    const roleEl = document.getElementById("contractorRole");
    const ratingEl = document.getElementById("contractorRating");
    const locationEl = document.getElementById("contractorLocation");
    const imageEl = document.getElementById("contractorImage");

    if (nameEl) nameEl.innerHTML = contractor.name + ' <span class="verified">✓ Verified</span>';
    if (roleEl) roleEl.textContent = contractor.role;
    if (ratingEl) ratingEl.textContent = `⭐ ${contractor.rating} (${contractor.reviews} reviews)`;
    if (locationEl) locationEl.textContent = contractor.location;
    if (imageEl) imageEl.src = contractor.image;

    // ===== STATS =====
    const projEl = document.getElementById("contractorProjects");
    if (projEl) projEl.textContent = contractor.projects;

    const expEl = document.getElementById("contractorExperience");
    if (expEl) expEl.textContent = contractor.experience;

    // ===== ABOUT =====
    const aboutEl = document.querySelector("#about p");
    if (aboutEl) aboutEl.textContent = contractor.about;

    // ===== PROJECTS =====
    const projectContainer = document.getElementById("projects");
    if (projectContainer && contractor.projectList) {
      const items = contractor.projectList.split("|");

      projectContainer.innerHTML = `
        <h3>Projects</h3>
        ${items.map(p => `<p>🏗 ${p}</p>`).join("")}
      `;
    }

    // ===== SKILLS =====
    const skillsContainer = document.querySelector(".skills");
    if (skillsContainer && contractor.skills) {
      const skills = contractor.skills.split("|");
      skillsContainer.innerHTML = skills.map(s => `<span>${s}</span>`).join("");
    }

    // ===== CERTIFICATIONS =====
    const certContainer = document.querySelector(".certs");
    if (certContainer && contractor.certs) {
      const certs = contractor.certs.split("|");
      certContainer.innerHTML = certs.map(c => `<li>✔ ${c}</li>`).join("");
    }
  }

// ===============================
// TAB SWITCHING
// ===============================
function switchTab(tabId, el) {

  document.querySelectorAll(".tab-content").forEach(section => {
    section.style.display = "none";
  });

  document.getElementById(tabId).style.display = "block";

  document.querySelectorAll(".profile-tabs span").forEach(tab => {
    tab.classList.remove("active");
  });

  if (el) el.classList.add("active");
}