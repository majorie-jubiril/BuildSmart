/* Read-only, project-scoped card photography. Evidence binaries are never copied. */
(() => {
  'use strict';
  const types = ['image/jpeg', 'image/png', 'image/webp'];
  const urls = new Set();
  let generation = 0;
  function begin() {
    generation++;
    urls.forEach(url => URL.revokeObjectURL(url)); urls.clear();
  }
  function candidates(project) {
    const evidence = [], uploaded = [];
    function append(target, file, stageId, taskId, source) {
      if (!file || !types.includes(file.type) || typeof file.id !== 'string' ||
          file.projectId !== project.id || file.stageId !== stageId || file.taskId !== taskId || typeof taskId !== 'string') return;
      target.push({ ...file, source });
    }
    for (const stage of project.stages || []) {
      for (const task of stage.tasks || []) for (const file of Array.isArray(task.evidence) ? task.evidence : [])
        append(evidence, file, stage.id, task.id, 'task');
      for (const file of Array.isArray(stage.evidence) ? stage.evidence : [])
        append(evidence, file, stage.id, file?.taskId, 'task');
    }
    for (const file of Array.isArray(project.projectPhotos) ? project.projectPhotos : [])
      append(uploaded, file, '__project__', 'cover-photos', 'project');
    const ref = project.projectCover;
    const selected = ref?.kind === 'photo' && [...evidence, ...uploaded].find(file =>
      file.id === ref.evidenceId && file.source === ref.source && file.stageId === ref.stageId && file.taskId === ref.taskId);
    const date = file => Number.isFinite(Date.parse(file.createdAt)) ? Date.parse(file.createdAt) : 0;
    evidence.sort((a, b) => date(b) - date(a));
    return [...new Map([...(selected ? [selected] : []), ...evidence].map(file => [file.id, file])).values()];
  }
  function create(project) {
    const token = generation, choices = candidates(project);
    const media = document.createElement('div'); media.className = 'projects-card-media';
    const label = document.createElement('span'); label.className = 'projects-photo-label';
    media.append(label);
    const current = () => token === generation && media.isConnected;
    function release(url) { if (url) { URL.revokeObjectURL(url); urls.delete(url); } }
    function fallback() {
      media.dataset.photoSource = 'default';
      delete media.dataset.evidenceId;
      media.classList.remove('has-photo'); media.style.removeProperty('--card-photo');
      label.textContent = 'Architectural illustration';
      const image = new Image(); image.alt = 'BuildSmart architectural illustration, not this project';
      image.src = 'images/buildsmart-hero.png';
      image.onerror = () => { image.remove(); label.textContent = 'Project image unavailable'; };
      media.querySelector('img')?.remove(); media.prepend(image);
    }
    fallback();
    async function load(start) {
      for (let index = start; index < choices.length; index++) {
        const file = choices[index]; let url;
        try {
          const record = await EvidenceStore.get(file.id, { projectId: project.id, stageId: file.stageId, taskId: file.taskId });
          if (!current()) return;
          if (!(record.blob instanceof Blob) || !types.includes(record.blob.type)) continue;
          url = URL.createObjectURL(record.blob); urls.add(url);
          const image = new Image(); image.src = url;
          await image.decode();
          if (!current()) { release(url); return; }
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('Unreadable image');
          image.alt = `${project.projectName || 'Project'}: ${file.id === project.projectCover?.evidenceId ? 'selected cover photograph' : 'saved construction photograph'}`;
          image.onerror = () => { if (current()) { release(url); fallback(); void load(index + 1); } };
          media.querySelector('img')?.remove(); media.prepend(image);
          media.classList.add('has-photo'); media.style.setProperty('--card-photo', `url("${url}")`);
          media.dataset.photoSource = file.id === project.projectCover?.evidenceId ? 'cover' : 'evidence';
          media.dataset.evidenceId = file.id;
          label.textContent = media.dataset.photoSource === 'cover' ? 'Project cover' : 'Saved project photo';
          return;
        } catch { release(url); }
      }
      if (current()) fallback();
    }
    // Rendering is synchronous; wait until its card is attached before reading blobs.
    queueMicrotask(() => { if (current()) void load(0); });
    return media;
  }
  window.ProjectsMedia = Object.freeze({ begin, create });
  addEventListener('pagehide', begin);
  addEventListener('pageshow', event => { if (event.persisted) initProjectsPage(); });
})();
