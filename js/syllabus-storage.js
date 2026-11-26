/*
 * SCTCC Syllabus Builder — saving in this browser, and export/import files
 *
 * Autosave uses the browser's localStorage. It stays on this computer, in this
 * browser only, and is never sent anywhere. Each syllabus is stored separately
 * by its id, so an instructor can keep several courses. Export a JSON file to
 * keep a backup or move a syllabus to another computer.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const PREFIX = (window.SCTCC.config && window.SCTCC.config.storageKeyPrefix) || "sctcc-syllabus:";
  const INDEX_KEY = `${PREFIX}index`;
  const CURRENT_KEY = `${PREFIX}current`;
  const RECORD_PREFIX = `${PREFIX}record:`;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

  function isAvailable() {
    try {
      const probe = `${PREFIX}probe`;
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readJson(key) {
    try {
      const text = window.localStorage.getItem(key);
      return text ? JSON.parse(text) : null;
    } catch (error) {
      return null;
    }
  }

  function readIndex() {
    const index = readJson(INDEX_KEY);
    return Array.isArray(index)
      ? index.filter((item) => item && typeof item.id === "string")
      : [];
  }

  function labelFor(data) {
    const course = (data && data.course) || {};
    const id = [course.prefix, course.number].filter(Boolean).join(" ");
    const term = [course.term, course.year].filter(Boolean).join(" ");
    const title = course.title ? ` ${course.title}` : "";
    const label = `${id}${title}${term ? ` (${term})` : ""}`.trim();
    return label || "Untitled syllabus";
  }

  /* Save one syllabus. Returns { ok, message }. */
  function save(data, contentVersion) {
    if (!data || !data.meta || !data.meta.id) return { ok: false, message: "Nothing to save." };
    const savedAt = new Date().toISOString();
    const record = { id: data.meta.id, savedAt, contentVersion: contentVersion || "", syllabus: data };
    try {
      window.localStorage.setItem(RECORD_PREFIX + data.meta.id, JSON.stringify(record));
      const index = readIndex().filter((item) => item.id !== data.meta.id);
      index.push({ id: data.meta.id, label: labelFor(data), savedAt });
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
      window.localStorage.setItem(CURRENT_KEY, data.meta.id);
      return { ok: true, savedAt };
    } catch (error) {
      const full = error && (error.name === "QuotaExceededError" || error.code === 22);
      return {
        ok: false,
        message: full
          ? "This browser’s storage is full (a large instructor photo can cause this). Export your syllabus to a file to keep your work."
          : "This browser is not allowing the builder to save. Export your syllabus to a file to keep your work."
      };
    }
  }

  function load(id) {
    const record = readJson(RECORD_PREFIX + id);
    return record && record.syllabus ? record : null;
  }

  function loadCurrent() {
    let id = null;
    try {
      id = window.localStorage.getItem(CURRENT_KEY);
    } catch (error) {
      return null;
    }
    return id ? load(id) : null;
  }

  function list() {
    return readIndex().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }

  function remove(id) {
    try {
      window.localStorage.removeItem(RECORD_PREFIX + id);
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(readIndex().filter((item) => item.id !== id)));
      if (window.localStorage.getItem(CURRENT_KEY) === id) window.localStorage.removeItem(CURRENT_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* Remove every syllabus this builder saved in this browser. */
  function clearAll() {
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(PREFIX)) keys.push(key);
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
      return true;
    } catch (error) {
      return false;
    }
  }

  /* Download the syllabus as a JSON file. */
  function exportFile(data, contentVersion, baseFileName) {
    const envelope = window.SCTCC.createExportEnvelope(data, contentVersion);
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseFileName || "Syllabus"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return link.download;
  }

  /* Read a chosen file and parse it. Resolves { ok, value, error }. */
  function readImportFile(file) {
    return new Promise((resolve) => {
      if (!file) {
        resolve({ ok: false, error: "No file was chosen." });
        return;
      }
      if (file.size > MAX_IMPORT_BYTES) {
        resolve({ ok: false, error: "That file is too large to be a syllabus file (over 5 MB)." });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve({ ok: true, value: JSON.parse(String(reader.result)) });
        } catch (error) {
          resolve({ ok: false, error: "That file is not valid JSON. Choose a .json file exported from this builder." });
        }
      };
      reader.onerror = () => resolve({ ok: false, error: "The file could not be read." });
      reader.readAsText(file);
    });
  }

  window.SCTCC.storage = Object.freeze({
    isAvailable,
    save,
    load,
    loadCurrent,
    list,
    remove,
    clearAll,
    exportFile,
    readImportFile,
    labelFor
  });
})();
