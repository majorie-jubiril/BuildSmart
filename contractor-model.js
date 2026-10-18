/* Specialty matching, confirmed external contacts and guarded optional associations. */
(() => {
  'use strict';
  const norm = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = {
    'structural engineer':'engineer', 'civil engineer':'engineer', 'electrical engineer':'electrician',
    'electrical contractor':'electrician', 'electrical':'electrician', 'foundation specialist':'foundation',
    'excavation specialist':'excavation', 'surveying':'surveyor', 'survey':'surveyor',
    'masonry':'mason', 'block laying':'blockwork', 'concrete structures':'concrete works',
    'electrical wiring':'electrical', 'plumbing works':'plumbing', 'roofing works':'roofing',
    'wood work':'woodwork', 'site clearance':'site clearing', 'structural engineering':'structural design',
    'masonry contractor':'mason', 'masonry professional':'mason', 'excavation contractor':'excavation',
    'earthworks contractor':'excavation', 'earthworks':'excavation', 'roofing contractor':'roofer',
    'roofing professional':'roofer', 'carpentry contractor':'carpenter', 'steel fixing':'steel fixer',
    'foundation works':'foundation', 'concrete':'concrete works'
  };
  const specialty = value => { let key=norm(value);for(let i=0;i<5&&aliases[key];i++)key=aliases[key];return key; };
  const identity = c => typeof c.id === 'string' && c.id.trim() ? c.id : `listed:${encodeURIComponent([norm(c.name),norm(c.role),norm(c.location)].join('|'))}`;
  function extract(card) {
    const d = card.dataset;
    return { id:d.id, name:d.name, role:d.role, rating:d.rating, reviews:d.reviews, location:d.location,
      image:d.image, experience:d.experience, projects:d.projects, about:d.about,
      projectList:d.projectlist, skills:d.skills, certs:d.certs, phone:d.phone, whatsapp:d.whatsapp,
      contactConfirmed:d.contactConfirmed === 'true', phoneConfirmed:d.phoneConfirmed === 'true',
      whatsappConfirmed:d.whatsappConfirmed === 'true', profileSource:d.profileSource || 'legacy' };
  }
  let catalogPromise;
  async function catalog() {
    if (!catalogPromise) catalogPromise = (async () => {
      let root = document.getElementById('contractorList');
      if (!root) {
        const response = await fetch('contractors.html', { credentials:'same-origin' });
        if (!response.ok) throw new Error('Contractor profiles are unavailable. You can continue independently.');
        root = new DOMParser().parseFromString(await response.text(), 'text/html');
      }
      return [...root.querySelectorAll('.contractor-card')].map(extract).filter(c => typeof c.name === 'string' && c.name.trim());
    })().catch(() => { catalogPromise = null; throw new Error('Contractor profiles could not be loaded. You can continue independently or browse all contractors.'); });
    return catalogPromise;
  }
  function requirements(task) {
    let declared=task || {};
    // Read existing task definitions for older records with missing discovery metadata.
    if(!declared.requiredContractor&&!declared.requiredCapability&&declared.id&&typeof generateStageTasks==='function'){
      const definition=['foundation','structure','roofing','windows','finishing'].flatMap(generateStageTasks).find(t=>t.id===declared.id);
      if(definition)declared=definition;
    }
    const role=specialty(declared.requiredContractor),capability=specialty(declared.requiredCapability);
    let roles=role?[role]:[],capabilities=capability?[capability]:[],label=declared.requiredContractor || 'recorded construction specialties';
    if(task?.id==='site-clearing'&&role==='foundation'&&capability==='site clearing'){
      roles=['excavation'];capabilities=['site clearing'];label='excavation / earthworks';
    }
    if(task?.id==='columns'&&role==='engineer'&&capability==='structural design'){
      roles.push('steel fixer','structural contractor');capabilities.push('reinforcement');
    }
    if(task?.id==='roof-frame'&&role==='carpenter'&&capability==='woodwork')roles.push('roofer');
    return {roles,capabilities,label};
  }
  function matches(records, task, location = '') {
    if (!task) return [];
    const required=requirements(task);
    const place = norm(location).replace('greater accra', 'accra').split(' ').filter(x => x.length > 3 && !['region','greater','ghana'].includes(x));
    return records.flatMap(c => {
      const roles = String(c.role || '').split(/[|,/]/).map(specialty);
      const skills = String(c.skills || '').split('|').map(specialty);
      const roleMatch = roles.some(role=>required.roles.includes(role));
      const skillMatch = skills.some(skill=>required.capabilities.includes(skill));
      if (!roleMatch && !skillMatch) return [];
      const recordedPlace = norm(c.location).replace('greater accra','accra').split(' ');
      const local = !!c.location && place.some(word => recordedPlace.includes(word));
      return [{ contractor:c, local, reason:roleMatch ? `Listed specialty: ${c.role}` : `Listed skill: ${String(c.skills).split('|').find(skill=>required.capabilities.includes(specialty(skill)))}` }];
    }).sort((a,b) => Number(b.local) - Number(a.local));
  }
  function contacts(c) {
    if(c.profileSource==='sample')return {phone:null,whatsapp:null};
    const confirmed = value => value === true || value === 'true';
    const valid = value => /^\+[1-9]\d{7,14}$/.test(value || '') && value !== '+233241234567';
    const phone = String(c.phone || '').replace(/[ ()-]/g, '');
    const wa = String(c.whatsapp || '').replace(/[ ()-]/g, '');
    return { phone:(confirmed(c.phoneConfirmed) || confirmed(c.contactConfirmed)) && valid(phone) ? `tel:${phone}` : null,
      whatsapp:(confirmed(c.whatsappConfirmed) || confirmed(c.contactConfirmed)) && valid(wa.startsWith('+') ? wa : `+${wa}`) ? `https://wa.me/${wa.replace(/^\+/,'')}` : null };
  }
  function legacy(project) {
    const entries = [];
    function append(value, key, stageId = null, taskId = null) {
      if (value && typeof value === 'object' && typeof value.name === 'string' && value.name.trim()) {
        const sourceKey=`${key}:${identity(value)}`;
        entries.push({ id:`legacy:${sourceKey}`, key:sourceKey, projectId:project.id, contractorId:identity(value), contractor:structuredClone(value), stageId, taskId, legacy:true });
      }
    }
    append(project.hiredContractor, 'hiredContractor');
    const map = project.hiredContractors;
    if (map?.name) append(map, 'hiredContractors');
    else if (map && typeof map === 'object') Object.entries(map).forEach(([key,value]) => append(value, `hiredContractors.${key}`));
    for (const s of project.stages || []) for (const t of s.tasks || [])
      for (const field of ['contractor','assignedContractor','hiredContractor']) append(t[field], `${s.id}/${t.id}/${field}`, s.id, t.id);
    return entries;
  }
  function model(project) {
    const saved = project.contractorAssignments;
    if (saved !== undefined && (!saved || saved.version !== 1 || !Array.isArray(saved.items) || !Array.isArray(saved.importedLegacyKeys) || saved.importedLegacyKeys.some(key=>typeof key!=='string') || saved.items.some(a => typeof a?.id !== 'string' || !a.id || a.projectId !== project.id || typeof a.contractorId !== 'string' || typeof a.contractor?.name !== 'string' || !a.contractor.name.trim())))
      throw new Error('Existing contractor associations need review. No records were replaced.');
    const data = saved ? structuredClone(saved) : { version:1, items:[], importedLegacyKeys:[], revision:0 };
    const history = legacy(project);
    const pending = history.filter(a => !data.importedLegacyKeys.includes(a.key));
    const merged=[...data.items,...pending],seen=new Set();
    const items=merged.filter(a=>{const key=JSON.stringify([a.contractorId,a.stageId,a.taskId]);if(seen.has(key))return false;seen.add(key);return true;});
    return { ...data, items, history, importedLegacyKeys:[...data.importedLegacyKeys,...pending.map(a=>a.key)] };
  }
  function list(project, stageId, taskId) {
    const items = model(project).items;
    return stageId === undefined ? items : items.filter(a => a.stageId === stageId && a.taskId === taskId);
  }
  function edit(projectId, operation) {
    if (!projectId || projectState?.id !== projectId || currentProjectId !== projectId || localStorage.getItem('currentProjectId') !== projectId)
      throw new Error('Project selection changed. Reopen the intended project before changing an association.');
    const records = JSON.parse(localStorage.getItem('projects') || '[]');
    if (!Array.isArray(records)) throw new Error('Project records need review. No data was replaced.');
    const index = records.findIndex(p => p.id === projectId);
    if (index < 0) throw new Error('This project is no longer available.');
    const project = structuredClone(records[index]), data = model(project);
    operation(data, project);
    const { history, ...saved } = data;
    project.contractorAssignments = { ...saved, revision:(Number(data.revision) || 0)+1 };
    records[index] = project;
    localStorage.setItem('projects', JSON.stringify(records));
    projects = records; projectState = project;
    return project;
  }
  function assign(projectId, contractor, stageId = null, taskId = null) {
    if (typeof contractor?.name !== 'string' || !contractor.name.trim()) throw new Error('Choose an available contractor profile.');
    return edit(projectId, (data, project) => {
      if (stageId || taskId) Construction.locate(project, stageId, taskId);
      const contractorId = identity(contractor);
      if (data.items.some(a => a.contractorId === contractorId && a.stageId === stageId && a.taskId === taskId)) return;
      data.items.push({ id:Financials.id(), projectId, contractorId, contractor:structuredClone(contractor), stageId, taskId, assignedAt:new Date().toISOString() });
    });
  }
  function remove(projectId, id) { return edit(projectId, data => { data.items = data.items.filter(a => a.id !== id); }); }
  window.ContractorModel = Object.freeze({ norm, specialty, requirements, identity, extract, catalog, matches, contacts, legacy, model, list, assign, remove });
})();
