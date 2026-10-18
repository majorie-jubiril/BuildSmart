/* Bounded browser-local binary storage. No data URLs or binary localStorage values. */
(function () {
  "use strict";
  const LIMITS = Object.freeze({ fileBytes: 3 * 1024 * 1024, taskFiles: 6, projectBytes: 20 * 1024 * 1024, totalBytes: 50 * 1024 * 1024 });
  const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  let connection;
  function open() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("File storage is unavailable. You can save notes and progress without attaching files."));
      let settled = false;
      const request = indexedDB.open("BuildSmartEvidence", 1);
      const timer = setTimeout(() => { settled = true; reject(new Error("File storage is blocked. Close other BuildSmart tabs and try again, or save without files.")); }, 5000);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("files", { keyPath: "id" });
        store.createIndex("projectId", "projectId", { unique: false });
      };
      request.onerror = () => { clearTimeout(timer); reject(new Error("Could not open file storage. No task data was replaced.")); };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (settled) return request.result.close();
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    }).catch(error => { connection = null; throw error; });
    return connection;
  }
  async function inspect(file) {
    if (!file || file.size <= 0 || file.size > LIMITS.fileBytes) throw new Error("Each file must be nonempty and no larger than 3 MB.");
    if (!TYPES.includes(file.type)) throw new Error("Choose a JPEG, PNG, WebP image or PDF. Other file types are not supported.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = file.type === "image/png" ? [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)
      : file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === "image/webp" ? String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP"
      : String.fromCharCode(...bytes.slice(0,5)) === "%PDF-";
    if (!signature) throw new Error("The file contents do not match the selected image or PDF type.");
    if (!crypto.subtle) throw new Error("This browser needs HTTPS or localhost for file storage. Notes can be saved without files.");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    return { file, sha256: hash };
  }
  const metadata = record => ({ id: record.id, name: record.name, type: record.type, size: record.size, sha256: record.sha256, createdAt: record.createdAt, projectId: record.projectId, stageId: record.stageId, taskId: record.taskId });
  async function putMany(scope, files) {
    if (files.length > LIMITS.taskFiles) throw new Error("Choose at most 6 files for one task.");
    const inspected = await Promise.all([...files].map(inspect));
    if (!inspected.length) return { attachments: [], createdIds: [] };
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      const store = transaction.objectStore("files");
      const request = store.getAll();
      const attachments = [], createdIds = [];
      let failure;
      request.onsuccess = () => {
        try {
          const records = request.result;
          let projectBytes = records.filter(record => record.projectId === scope.projectId).reduce((sum, record) => sum + record.size, 0);
          let totalBytes = records.reduce((sum, record) => sum + record.size, 0);
          const own = records.filter(record => record.projectId === scope.projectId && record.stageId === scope.stageId && record.taskId === scope.taskId);
          for (const { file, sha256 } of inspected) {
            const duplicate = own.find(record => record.sha256 === sha256);
            if (duplicate) { attachments.push(metadata(duplicate)); continue; }
            if (own.length >= LIMITS.taskFiles) throw new Error("A task can hold up to 6 files. Existing files are preserved.");
            if (projectBytes + file.size > LIMITS.projectBytes || totalBytes + file.size > LIMITS.totalBytes) throw new Error("File storage limit reached (20 MB per project, 50 MB in this browser). Existing files are preserved.");
            const record = { ...scope, id: Financials.id(), name: file.name.slice(0, 160), type: file.type, size: file.size, sha256, createdAt: new Date().toISOString(), blob: file };
            store.add(record);
            own.push(record);
            attachments.push(metadata(record));
            createdIds.push(record.id);
            projectBytes += file.size;
            totalBytes += file.size;
          }
        } catch (error) { failure = error; transaction.abort(); }
      };
      transaction.oncomplete = () => resolve({ attachments, createdIds });
      transaction.onabort = transaction.onerror = () => reject(failure || new Error("Files could not be saved (storage unavailable or full). Notes and progress have not been changed."));
    });
  }
  async function get(id, scope) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction("files", "readonly").objectStore("files").get(id);
      request.onerror = () => reject(new Error("Files could not be read in this browser."));
      request.onsuccess = () => {
        const record = request.result;
        if (!record || record.projectId !== scope.projectId || record.stageId !== scope.stageId || record.taskId !== scope.taskId) return reject(new Error("This file is unavailable in this browser. Its task record has been preserved."));
        resolve(record);
      };
    });
  }
  async function removeCreated(ids, scope) {
    if (!ids.length) return;
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      const store = transaction.objectStore("files");
      for (const id of ids) {
        const request = store.get(id);
        request.onsuccess = () => {
          const record = request.result;
          if (record && record.projectId === scope.projectId && record.stageId === scope.stageId && record.taskId === scope.taskId) store.delete(id);
        };
      }
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(new Error("File cleanup was blocked; the unlinked file remains bounded in browser storage."));
    });
  }
  window.EvidenceStore = Object.freeze({ LIMITS, TYPES, inspect, putMany, get, removeCreated });
})();
