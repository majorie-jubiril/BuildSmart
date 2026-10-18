/* Project-scoped cover references and completion-review presentation.
   Task completion and expense totals remain owned by Construction/Financials. */
(() => {
  'use strict';
  const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const PROJECT_SCOPE = { stageId: '__project__', taskId: 'cover-photos' };
  const page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') + '.html';
  let viewKey = '', coverToken = 0, coverUrl, activeDialog, invalidatedState;
  const el = (tag, text, className) => {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  };
  const signature = project => JSON.stringify(project.projectCover ?? null);
  function trapFocus(dialog) {
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const candidates = [...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
        .filter(item => !item.disabled && item.tabIndex >= 0 && item.getClientRects().length);
      const stops = candidates.filter(item => item.type !== 'radio' || !item.name ||
        (candidates.find(other => other.type === 'radio' && other.name === item.name && other.checked) ||
          candidates.find(other => other.type === 'radio' && other.name === item.name)) === item);
      if (!stops.length) { event.preventDefault(); dialog.focus(); return; }
      const first = stops[0], last = stops[stops.length - 1], focused = document.activeElement;
      if (event.shiftKey && (focused === first || !dialog.contains(focused) || focused === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (focused === last || !dialog.contains(focused) || focused === dialog)) {
        event.preventDefault(); first.focus();
      }
    });
  }
  function load(id) {
    if (!id || projectState?.id !== id || currentProjectId !== id || localStorage.getItem('currentProjectId') !== id) throw new Error('Project selection changed. Reopen this project before saving.');
    const collection = JSON.parse(localStorage.getItem('projects') || '[]');
    if (!Array.isArray(collection)) throw new Error('Project records need review. No data was replaced.');
    const index = collection.findIndex(project => project.id === id);
    if (index < 0) throw new Error('This project is no longer available.');
    return { collection, index, project: structuredClone(collection[index]) };
  }
  function photos(project) {
    const result = [];
    function append(file, stageId, taskId, label, source) {
      if (!file || !PHOTO_TYPES.includes(file.type) || file.projectId !== project.id || file.stageId !== stageId || file.taskId !== taskId || typeof file.id !== 'string') return;
      result.push({ ...file, label, source });
    }
    for (const stage of project.stages || []) for (const task of stage.tasks || []) {
      for (const file of Array.isArray(task.evidence) ? task.evidence : []) append(file, stage.id, task.id, task.name, 'task');
    }
    for (const file of Array.isArray(project.projectPhotos) ? project.projectPhotos : []) append(file, PROJECT_SCOPE.stageId, PROJECT_SCOPE.taskId, 'Project photograph', 'project');
    return result;
  }
  function findPhoto(project, reference) {
    return photos(project).find(file => file.id === reference?.evidenceId && file.stageId === reference.stageId && file.taskId === reference.taskId && file.source === reference.source);
  }
  async function decode(blob) {
    if (!(blob instanceof Blob) || !PHOTO_TYPES.includes(blob.type)) throw new Error('Choose a JPEG, PNG or WebP photograph.');
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Unreadable image');
    } catch { throw new Error('This photograph cannot be displayed. Choose another image or keep the default cover.'); }
    finally { URL.revokeObjectURL(url); }
  }
  async function readPhoto(project, file) {
    const record = await EvidenceStore.get(file.id, { projectId: project.id, stageId: file.stageId, taskId: file.taskId });
    await decode(record.blob);
    return record.blob;
  }
  function reference(file) {
    return { kind: 'photo', source: file.source, evidenceId: file.id, stageId: file.stageId, taskId: file.taskId };
  }
  function sizePhotoHero(hero) {
    // Measure the original composition so a narrower photo layout cannot shrink it.
    hero.classList.remove('has-project-photo');
    hero.style.removeProperty('--project-cover-min-height');
    const height = hero.getBoundingClientRect().height;
    hero.style.setProperty('--project-cover-min-height', `${height}px`);
    hero.classList.add('has-project-photo');
  }
  let coverObserver;
  function resetHero(hero, reason = '') {
    hero?.style.removeProperty('--project-cover-image');
    hero?.style.removeProperty('--project-cover-min-height');
    hero?.classList.remove('has-project-photo');
    hero?.querySelector('.project-hero-photo')?.remove();
    const label = document.querySelector('.hero-imagery-label');
    if (label) {
      label.textContent = reason ? 'Illustration · selected photo unavailable' : 'Architectural illustration';
      label.setAttribute('aria-label', reason || 'Illustrative architectural image, not a photograph of this project');
    }
  }
  async function renderCover(project) {
    const hero = document.querySelector('.reference-dashboard .current-project-card');
    const token = ++coverToken;
    if (coverUrl) { URL.revokeObjectURL(coverUrl); coverUrl = null; }
    resetHero(hero);
    if (!hero || project?.projectCover?.kind !== 'photo') return;
    try {
      const file = findPhoto(project, project.projectCover);
      if (!file) throw new Error('The selected photograph is not available for this project. The default illustration is shown.');
      const blob = await readPhoto(project, file);
      if (token !== coverToken) return;
      coverUrl = URL.createObjectURL(blob);
      hero.style.setProperty('--project-cover-image', `url("${coverUrl}")`);
      const media = el('div', undefined, 'project-hero-photo');
      const image = el('img');
      image.alt = 'Your selected project photograph';
      image.src = coverUrl;
      image.onerror = () => {
        if (token !== coverToken) return;
        resetHero(hero, 'The selected photograph cannot be displayed. The default illustration is shown; your saved selection is preserved.');
        URL.revokeObjectURL(coverUrl); coverUrl = null;
      };
      media.append(image);
      hero.append(media);
      sizePhotoHero(hero);
      if (!coverObserver) {
        let width = hero.getBoundingClientRect().width;
        coverObserver = new ResizeObserver(() => {
          const next = hero.getBoundingClientRect().width;
          if (next === width) return;
          width = next;
          if (hero.classList.contains('has-project-photo')) sizePhotoHero(hero);
        });
        coverObserver.observe(hero);
      }
      const label = hero.querySelector('.hero-imagery-label');
      label.textContent = 'Your selected project photo';
      label.setAttribute('aria-label', 'Photograph selected by you from this project');
    } catch {
      if (token === coverToken) resetHero(hero, 'The selected project photograph is unavailable in this browser. The default architectural illustration is shown. Your saved selection and evidence have been preserved.');
    }
  }
  function refresh() {
    if (!['index.html', 'estimate-result.html', ''].includes(page)) return;
    const project = typeof projectState !== 'undefined' ? projectState : null;
    const summary = Construction.summary(project);
    const invalidated = project && (project === invalidatedState || localStorage.getItem('currentProjectId') !== project.id);
    const key = JSON.stringify([project?.id, project?.projectCover, summary.completed, summary.total, project?.completionReview, project ? photos(project).map(file => [file.id, file.sha256, file.stageId, file.taskId]) : [], !!invalidated]);
    if (key === viewKey) return;
    viewKey = key;
    if (invalidated) {
      activeDialog?.dismiss(true);
      document.querySelectorAll('#projectExperienceActions button').forEach(button => { button.disabled = true; });
      renderCover(null);
      ConstructionUI.message(localStorage.getItem('currentProjectId') !== project.id
        ? 'Project selection changed. Reload to open the selected project before changing its cover.'
        : 'Project records changed in another tab. Reload to continue with the latest records.');
      return;
    }
    if (activeDialog && activeDialog.projectId !== project?.id) activeDialog.dismiss(true);
    let toolbar = document.getElementById('projectExperienceActions');
    if (!toolbar) {
      toolbar = el('section', undefined, 'project-experience-toolbar');
      toolbar.id = 'projectExperienceActions'; toolbar.setAttribute('aria-label', 'Project cover and completion');
      const hero = document.querySelector('.reference-dashboard .current-project-card');
      if (hero) hero.after(toolbar); else document.querySelector('main')?.prepend(toolbar);
    }
    toolbar.replaceChildren(); toolbar.hidden = !project;
    if (project) {
      const status = el('p', summary.isCompleted ? 'Completed · all recorded tasks finished' : 'Make this project your own');
      toolbar.append(status);
      const cover = el('button', 'Change project cover', 'construction-secondary');
      cover.id = 'changeProjectCover'; cover.type = 'button'; cover.onclick = openCover;
      toolbar.append(cover);
      if (summary.isCompleted) {
        const review = el('button', project.completionReview?.confirmedAt ? 'View completion review' : 'Review project completion', 'primary-btn');
        review.type = 'button'; review.id = 'reviewProjectCompletion'; review.onclick = openReview;
        toolbar.append(review);
      }
      const next = document.querySelector('.next-step-card strong');
      if (next) next.textContent = summary.isCompleted ? 'View completed construction plan' : window.TaskNavigation ? 'Continue Task' : 'Continue your project';
    }
    renderCover(project);
  }
  function tell(error) { ConstructionUI.message(error.message || String(error)); }
  function summaryContent(dialog, project) {
    const summary = Construction.summary(project), money = Financials.calculate(project);
    const heading = el('div', undefined, 'completion-project-heading');
    heading.append(el('h3', project.projectName || 'Untitled project'), el('p', project.location || project.estimate?.location || 'Location not recorded'));
    dialog.append(heading);
    const stages = el('ul', undefined, 'completion-stage-summary');
    summary.stages.forEach(stage => stages.append(el('li', `${stage.name} · ${stage.completed}/${stage.total} tasks · ${stage.label}`)));
    dialog.append(stages, el('p', `${summary.completed} of ${summary.total} applicable tasks completed.`, 'completion-task-total'));
    const finances = el('dl', undefined, 'completion-financial-summary');
    for (const [label, value] of [['Final planned budget', money.budget], ['Recorded expenditure', money.spent], [money.remaining < 0 ? 'Amount over budget' : 'Remaining budget', money.remaining === null ? null : Math.abs(money.remaining)]]) {
      const item = el('div'); item.append(el('dt', label), el('dd', Financials.format(value))); finances.append(item);
    }
    dialog.append(finances);
    if (!money.available) dialog.append(el('p', 'Recorded expense totals are unavailable. Existing ledger data is preserved; review it in Expenditure.', 'finance-notice'));
    const legacy = legacyFinancialNotice(project);
    if (legacy) dialog.append(el('p', legacy, 'finance-notice'));
    dialog.append(el('p', 'Budget differences describe the records you entered. They do not establish construction quality or cost-management performance. BuildSmart has not inspected or certified the construction.', 'completion-disclaimer'));
  }
  function openCover() { return open(false); }
  function openReview() { return open(true); }
  function open(review) {
    let project;
    try {
      project = load(projectState?.id).project;
      if (review && !Construction.summary(project).isCompleted) throw new Error('Complete every applicable task before reviewing project completion.');
    } catch (error) { tell(error); return; }
    if (activeDialog) { activeDialog.dialog.focus(); return; }
    const projectId = project.id, baseCover = signature(project), urls = new Set();
    const dialog = el('dialog', undefined, 'project-experience-dialog');
    dialog.id = review ? 'projectReviewDialog' : 'projectCoverDialog';
    dialog.setAttribute('aria-labelledby', 'projectExperienceTitle');
    const title = el('h2', review ? 'Project Completion Review' : 'Choose your project cover'); title.id = 'projectExperienceTitle';
    dialog.append(el('p', review ? 'A RECORDED PROJECT MILESTONE' : 'YOUR PROJECT, YOUR COVER', 'completion-eyebrow'), title);
    if (review) summaryContent(dialog, project);
    else dialog.append(el('p', 'Choose a saved photo, upload a project photo or keep the default illustration. This does not change tasks or expenditure.'));
    dialog.append(el('h3', review ? 'Final project photograph' : 'Dashboard photograph'));
    const choices = el('fieldset', undefined, 'project-cover-choices');
    choices.append(el('legend', 'A photograph is optional'));
    const group = 'project-cover-choice';
    function choice(value, label, checked) {
      const item = el('label', undefined, 'project-cover-option');
      const input = el('input'); input.type = 'radio'; input.name = group; input.value = value; input.checked = !!checked;
      item.append(input, el('span', label)); choices.append(item);
      return { item, input };
    }
    choice('default', 'Keep the default BuildSmart cover', project.projectCover?.kind !== 'photo');
    const galleryTitle = el('h4', 'Choose from existing progress and project photos'); choices.append(galleryTitle);
    const gallery = el('div', undefined, 'project-cover-gallery'); choices.append(gallery);
    const files = photos(project), fileMap = new Map();
    if (!files.length) gallery.append(el('p', 'No saved project photographs yet. You can upload one or continue with the default.', 'ui-empty'));
    files.forEach((file, index) => {
      const value = `photo-${index}`, item = el('label', undefined, 'project-cover-photo');
      fileMap.set(value, file);
      const input = el('input'); input.type = 'radio'; input.name = group; input.value = value;
      input.checked = project.projectCover?.kind === 'photo' && findPhoto(project, project.projectCover)?.id === file.id;
      const preview = el('div', 'Loading photograph…', 'cover-photo-preview');
      item.append(input, preview, el('strong', file.label), el('small', file.name)); gallery.append(item);
      readPhoto(project, file).then(blob => {
        if (!dialog.isConnected) return;
        const url = URL.createObjectURL(blob); urls.add(url);
        const image = el('img'); image.src = url; image.alt = file.label;
        preview.replaceChildren(image);
      }).catch(() => { if (dialog.isConnected) { input.disabled = true; preview.textContent = 'Photo unavailable in this browser. Choose another option.'; } });
    });
    const upload = choice('upload', review ? 'Upload a final project photograph' : 'Upload a project photograph', false);
    const input = el('input'); input.type = 'file'; input.id = 'finalProjectPhoto'; input.accept = PHOTO_TYPES.join(',');
    const fileLabel = el('label', 'Choose a JPEG, PNG or WebP photograph'); fileLabel.htmlFor = input.id;
    choices.append(fileLabel, input, el('p', 'Up to 3 MiB per image. Six project-level photos, 20 MiB per project and 50 MiB per browser, shared with task evidence. Files stay in this browser; clearing site data can remove them.', 'cover-storage-note'));
    input.onchange = () => { if (input.files.length) upload.input.checked = true; };
    dialog.append(choices);
    const errorBox = el('p', undefined, 'project-experience-error'); errorBox.id = 'projectExperienceError'; errorBox.setAttribute('role', 'alert'); dialog.append(errorBox);
    const actions = el('div', undefined, 'project-experience-actions');
    const cancel = el('button', review ? 'Review later' : 'Cancel', 'construction-secondary'); cancel.type = 'button';
    const save = el('button', review ? 'Confirm review & celebrate' : 'Save cover', 'primary-btn'); save.type = 'button'; save.id = review ? 'confirmProjectReview' : 'saveProjectCover';
    actions.append(cancel, save); dialog.append(actions);
    let busy = false;
    function dismiss(force = false) {
      if (busy && !force) return;
      urls.forEach(url => URL.revokeObjectURL(url)); dialog.close(); dialog.remove();
      if (activeDialog?.dialog === dialog) activeDialog = null;
      document.getElementById(review ? 'reviewProjectCompletion' : 'changeProjectCover')?.focus();
    }
    cancel.onclick = () => dismiss();
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    save.onclick = async () => {
      if (busy) return;
      busy = true; errorBox.textContent = '';
      const value = dialog.querySelector(`input[name="${group}"]:checked`)?.value;
      const selected = fileMap.get(value), uploaded = input.files[0];
      const controls = [...dialog.querySelectorAll('button,input')].map(control => [control, control.disabled]); controls.forEach(([control]) => { control.disabled = true; });
      dialog.setAttribute('aria-busy', 'true');
      let stored = { createdIds: [], attachments: [] }, committed = false;
      const scope = { projectId, ...PROJECT_SCOPE };
      try {
        let fresh = load(projectId);
        if (signature(fresh.project) !== baseCover) throw new Error('The project cover changed in another tab. Reopen the chooser to review it.');
        if (review && !Construction.summary(fresh.project).isCompleted) throw new Error('Task records changed. All applicable tasks must be completed before confirming.');
        let photo;
        if (value === 'upload') {
          if (!uploaded || !PHOTO_TYPES.includes(uploaded.type)) throw new Error('Choose a JPEG, PNG or WebP photograph, or keep the default cover.');
          const inspected = await EvidenceStore.inspect(uploaded); await decode(uploaded);
          const duplicate = photos(fresh.project).find(file => file.sha256 === inspected.sha256);
          if (duplicate) {
            try { await readPhoto(fresh.project, duplicate); photo = duplicate; } catch { /* Missing originals may be replaced by a new project-level record. */ }
          }
          if (!photo) {
            if (fresh.project.projectPhotos !== undefined && !Array.isArray(fresh.project.projectPhotos)) throw new Error('Saved project-photo metadata needs review. Existing records were not replaced.');
            try { stored = await EvidenceStore.putMany(scope, [uploaded]); }
            catch (error) {
              if (error.message.includes('A task can hold up to 6')) throw new Error('This project already holds six project-level photographs. Choose a saved photograph or keep the default cover.');
              throw error;
            }
            photo = { ...stored.attachments[0], source: 'project' };
          }
        } else if (selected) {
          photo = photos(fresh.project).find(file => file.id === selected.id && file.stageId === selected.stageId && file.taskId === selected.taskId);
          if (!photo) throw new Error('That photograph no longer belongs to this project. Choose another option.');
          await readPhoto(fresh.project, photo);
        } else if (value !== 'default') throw new Error('Choose a cover option. A photograph is optional.');
        // Re-read after asynchronous file work, retaining all fresh task/ledger/custom fields.
        fresh = load(projectId);
        if (signature(fresh.project) !== baseCover) throw new Error('The project cover changed while this photograph was being saved. Reopen the chooser.');
        if (review && !Construction.summary(fresh.project).isCompleted) throw new Error('Task records changed. Reopen the completion review.');
        if (photo && !stored.attachments.length && !photos(fresh.project).some(file => file.id === photo.id && file.stageId === photo.stageId && file.taskId === photo.taskId)) throw new Error('The selected photograph changed. Reopen the chooser.');
        if (stored.attachments.length) {
          if (fresh.project.projectPhotos !== undefined && !Array.isArray(fresh.project.projectPhotos)) throw new Error('Project-photo metadata changed. Reopen the chooser.');
          const entries = new Map((fresh.project.projectPhotos || []).map(file => [file.id, file]));
          stored.attachments.forEach(file => entries.set(file.id, file)); fresh.project.projectPhotos = [...entries.values()];
        }
        const stamp = new Date().toISOString(), nextCover = photo ? reference(photo) : { kind: 'default' };
        const old = fresh.project.projectCover;
        const sameCover = old?.kind === nextCover.kind && (nextCover.kind === 'default' || old.evidenceId === nextCover.evidenceId && old.stageId === nextCover.stageId && old.taskId === nextCover.taskId && old.source === nextCover.source);
        if (!sameCover && !(old === undefined && nextCover.kind === 'default')) fresh.project.projectCover = { ...nextCover, updatedAt: stamp, revision: Financials.id() };
        if (review) {
          const existing = fresh.project.completionReview;
          if (existing !== undefined && (!existing || typeof existing !== 'object' || Array.isArray(existing))) throw new Error('Saved completion-review metadata needs review. The completed project is preserved.');
          fresh.project.completionReview = { ...existing, version: 1, confirmedAt: existing?.confirmedAt || stamp, confirmationId: existing?.confirmationId || Financials.id() };
        }
        fresh.collection[fresh.index] = fresh.project;
        localStorage.setItem('projects', JSON.stringify(fresh.collection)); committed = true;
        projects = fresh.collection; projectState = fresh.project; invalidatedState = null;
        busy = false; dismiss(); viewKey = ''; refreshUI(); refresh();
        if (review) congratulations(projectId);
        else {
          ConstructionUI.message('Project cover saved. Tasks and expenditure are unchanged.');
          document.getElementById('changeProjectCover')?.focus();
        }
      } catch (error) {
        errorBox.textContent = error.message;
        if (!dialog.isConnected) tell(error);
      } finally {
        if (!committed && stored.createdIds.length) {
          try { await EvidenceStore.removeCreated(stored.createdIds, scope); } catch { errorBox.textContent += ' File cleanup was blocked; bounded storage may contain an unlinked image.'; }
        }
        busy = false; controls.forEach(([control, disabled]) => { control.disabled = disabled; }); dialog.removeAttribute('aria-busy');
      }
    };
    activeDialog = { dialog, projectId, dismiss };
    trapFocus(dialog); document.body.append(dialog); dialog.showModal(); cancel.focus();
  }
  function congratulations(projectId) {
    const fresh = load(projectId).project;
    if (!Construction.summary(fresh).isCompleted) return;
    const dialog = el('dialog', undefined, 'project-experience-dialog congratulations-dialog'); dialog.id = 'projectCongratulationsDialog';
    dialog.setAttribute('aria-labelledby', 'projectCongratulationsTitle');
    const title = el('h2', 'Congratulations'); title.id = 'projectCongratulationsTitle';
    dialog.append(el('p', 'A PROJECT MILESTONE', 'completion-eyebrow'), title, el('h3', fresh.projectName || 'Your project'), el('p', 'All applicable construction tasks are recorded as completed. Your task history, expenses and photographs remain available.'), el('p', 'This milestone reflects your records. BuildSmart has not inspected or certified the construction.', 'completion-disclaimer'));
    const button = el('button', 'Open completed project dashboard', 'primary-btn'); button.id = 'openCompletedDashboard'; button.type = 'button';
    const dismiss = () => { dialog.close(); dialog.remove(); activeDialog = null; document.getElementById('reviewProjectCompletion')?.focus(); };
    button.onclick = () => { try { load(projectId); dismiss(); location.href = 'index.html'; } catch (error) { dismiss(); tell(error); } };
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); }); dialog.append(button);
    activeDialog = { dialog, projectId, dismiss }; trapFocus(dialog); document.body.append(dialog); dialog.showModal(); button.focus();
  }
  window.addEventListener('storage', event => {
    if (event.key === 'currentProjectId' && activeDialog) activeDialog.dismiss(true);
    if (event.key === 'projects' || event.key === 'currentProjectId') {
      viewKey = ''; ++coverToken; invalidatedState = projectState;
      refresh();
      ConstructionUI.message('Project records changed in another tab. Reload to view the latest records.');
    }
  });
  window.addEventListener('pagehide', () => { ++coverToken; viewKey = ''; if (coverUrl) URL.revokeObjectURL(coverUrl); activeDialog?.dismiss(true); });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  document.addEventListener('DOMContentLoaded', refresh);
  window.ProjectExperience = Object.freeze({ refresh, openCover, openReview });
})();
