/*
 * SCTCC Syllabus Builder — saving and opening syllabus files
 *
 * A finished syllabus is the instructor's intellectual property. The builder
 * never stores it: not in the browser, not on GitHub, not on any server.
 * Instructors save it as a .json file to a location they choose, such as a
 * folder on their computer or their OneDrive folder.
 *
 * Chrome and Edge (desktop) show the system Save / Open dialogs through the
 * File System Access API, and Save then updates the same file. Other browsers
 * fall back to a download (to the browser's download folder) and a file chooser.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const FILE_TYPES = [{ description: "SCTCC syllabus file", accept: { "application/json": [".json"] } }];

  /* The file the open syllabus was last saved to or opened from (Chrome/Edge only). */
  let currentHandle = null;

  function supportsFilePicker() {
    return typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";
  }

  function serialize(data, contentVersion) {
    return JSON.stringify(window.SCTCC.createExportEnvelope(data, contentVersion), null, 2);
  }

  function isCancel(error) {
    return error && error.name === "AbortError";
  }

  async function writeToHandle(handle, text) {
    if (typeof handle.queryPermission === "function") {
      let permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission !== "granted" && typeof handle.requestPermission === "function") {
        permission = await handle.requestPermission({ mode: "readwrite" });
      }
      if (permission !== "granted") throw new Error("permission-denied");
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  /* Fallback for browsers without the file dialogs: download the file. */
  function download(text, fileName) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /*
   * Save As: always asks where to save.
   * Resolves { ok, fileName, method } or { ok: false, cancelled } or { ok: false, message }.
   */
  async function saveAs(data, contentVersion, baseName) {
    const fileName = `${baseName || "Syllabus"}.json`;
    const text = serialize(data, contentVersion);

    if (!supportsFilePicker()) {
      download(text, fileName);
      currentHandle = null;
      return { ok: true, fileName, method: "download" };
    }

    try {
      const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: FILE_TYPES, startIn: "documents" });
      await writeToHandle(handle, text);
      currentHandle = handle;
      return { ok: true, fileName: handle.name || fileName, method: "file" };
    } catch (error) {
      if (isCancel(error)) return { ok: false, cancelled: true };
      return { ok: false, message: "The file could not be saved there. Try Save as and choose another folder." };
    }
  }

  /*
   * Save another kind of file (for example the calendar as CSV) to a location the
   * instructor chooses. Does not change which syllabus file Save updates.
   */
  async function exportText(text, fileName, description, mimeType, extension) {
    if (!supportsFilePicker()) {
      const blob = new Blob([text], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true, fileName, method: "download" };
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description, accept: { [mimeType]: [extension] } }],
        startIn: "documents"
      });
      await writeToHandle(handle, text);
      return { ok: true, fileName: handle.name || fileName, method: "file" };
    } catch (error) {
      if (isCancel(error)) return { ok: false, cancelled: true };
      return { ok: false, message: "The file could not be saved there. Try again and choose another folder." };
    }
  }

  /* Save: updates the current file if there is one, otherwise behaves like Save As. */
  async function save(data, contentVersion, baseName) {
    if (!currentHandle) return saveAs(data, contentVersion, baseName);
    try {
      await writeToHandle(currentHandle, serialize(data, contentVersion));
      return { ok: true, fileName: currentHandle.name, method: "file" };
    } catch (error) {
      if (isCancel(error)) return { ok: false, cancelled: true };
      return { ok: false, message: "The file could not be updated (it may have been moved, or permission was refused). Use Save as to choose where to save." };
    }
  }

  function parseText(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (error) {
      return { ok: false, error: "That file is not valid JSON. Choose a .json file saved from this builder." };
    }
  }

  /* Open with the system dialog (Chrome/Edge). Resolves { ok, value, fileName } or { cancelled } or { error }. */
  async function openWithPicker() {
    try {
      const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false, startIn: "documents" });
      const file = await handle.getFile();
      if (file.size > MAX_FILE_BYTES) return { ok: false, error: "That file is too large to be a syllabus file (over 5 MB)." };
      const parsed = parseText(await file.text());
      if (!parsed.ok) return parsed;
      return { ok: true, value: parsed.value, fileName: handle.name, handle };
    } catch (error) {
      if (isCancel(error)) return { ok: false, cancelled: true };
      return { ok: false, error: "The file could not be opened." };
    }
  }

  /* Read a file chosen with <input type="file"> (fallback browsers). */
  function readChosenFile(file) {
    return new Promise((resolve) => {
      if (!file) {
        resolve({ ok: false, cancelled: true });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        resolve({ ok: false, error: "That file is too large to be a syllabus file (over 5 MB)." });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseText(String(reader.result));
        resolve(parsed.ok ? { ok: true, value: parsed.value, fileName: file.name, handle: null } : parsed);
      };
      reader.onerror = () => resolve({ ok: false, error: "The file could not be read." });
      reader.readAsText(file);
    });
  }

  /* Remember (or forget) which file Save should update after an open succeeds. */
  function setCurrentFile(handle) {
    currentHandle = handle || null;
  }

  /*
   * Earlier preview builds kept an autosave copy in this browser. Erase any such
   * copies so no syllabus remains on a shared computer.
   */
  function eraseBrowserCopies(prefixes) {
    let removed = 0;
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key);
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
      removed = keys.length;
    } catch (error) {
      /* Storage unavailable: nothing to erase. */
    }
    return removed;
  }

  window.SCTCC.files = Object.freeze({
    supportsFilePicker,
    save,
    saveAs,
    openWithPicker,
    readChosenFile,
    setCurrentFile,
    eraseBrowserCopies,
    exportText,
    hasCurrentFile: () => Boolean(currentHandle)
  });
})();
