/*
 * SCTCC Syllabus Builder — College Content Editor (content-editor.html)
 *
 * Lets the office that owns a college section edit its wording as plain text, see it as it
 * will look in the syllabus, check it, and send the change by email to the reviewer.
 * Nothing is saved or published from this page: the reviewer opens the emailed change
 * (bottom of the page), downloads the updated file, and publishes it through GitHub.
 */
(function () {
  "use strict";

  const config = window.SCTCC.config;
  const contentText = window.SCTCC.contentText;
  const sanitize = window.SCTCC.contentLoader.sanitizeFragmentHtml;
  const reviewer = config.contentReviewer || { name: "", email: "" };
  const START = "SCTCC college content change";
  const TEXT_START = "----- NEW WORDING (plain text) -----";
  const TEXT_END = "----- END OF CHANGE -----";

  const state = {
    manifest: null,
    sections: [],          /* manifest sections that have a file to edit */
    section: null,         /* the chosen manifest entry */
    source: null,          /* fromHtml() of the current file */
    original: "",          /* the current wording as plain text */
    fileText: "",          /* the current file, as it is in the repository */
    sentText: null,        /* the wording last sent, to tell unsent edits apart */
    reviewerFile: null     /* the updated file a reviewer can download */
  };

  const $ = (id) => document.getElementById(id);

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      node.setAttribute(key, value === true ? "" : value);
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined) return;
      node.append(child instanceof Node ? child : String(child));
    });
    return node;
  }

  function today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function contentUrl(name) {
    return new URL(name, new URL(config.contentBaseUrl || "./content/", window.location.href));
  }

  async function fetchText(name) {
    const response = await fetch(contentUrl(name), { cache: "no-cache" });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.text();
  }

  function headerValue(header, key) {
    const match = new RegExp(`${key}:\\s*([^\\n]*)`).exec(header || "");
    return match ? match[1].trim() : "";
  }

  /* ---------------- Step 1: choose a section ---------------- */

  async function loadManifest() {
    try {
      state.manifest = JSON.parse(await fetchText(config.manifestFile || "content-manifest.json"));
    } catch (error) {
      const box = $("ce-load-error");
      box.hidden = false;
      box.textContent = "The list of college sections could not be loaded. Check that you are online and that this page was opened from its web address, then reload the page.";
      $("ce-section").replaceChildren(el("option", { value: "" }, "Not available"));
      return;
    }
    state.sections = (state.manifest.sections || []).filter((section) => /^[a-z0-9-]+\.html$/.test(section.file || ""));
    const sorted = state.sections.slice().sort((a, b) => a.title.localeCompare(b.title));
    $("ce-section").replaceChildren(
      el("option", { value: "" }, "Choose a section"),
      ...sorted.map((section) => el("option", { value: section.id }, section.title)));
  }

  async function chooseSection(id, options) {
    if (state.section && hasUnsentEdits() && !(options && options.force)) {
      if (!window.confirm("Switch sections? Your unsent changes to this section will be lost.")) {
        $("ce-section").value = state.section.id;
        return false;
      }
    }
    const section = state.sections.find((candidate) => candidate.id === id) || null;
    state.section = section;
    state.sentText = null;
    $("ce-send-result").hidden = true;
    if (!section) {
      $("ce-section-info").replaceChildren();
      $("ce-step2").hidden = true;
      $("ce-step3").hidden = true;
      return false;
    }
    try {
      state.fileText = await fetchText(section.file);
    } catch (error) {
      $("ce-section-info").replaceChildren(el("p", { class: "ce-notice ce-error", role: "alert" }, `The current wording of ${section.title} could not be loaded. Reload the page and try again.`));
      return false;
    }
    state.source = contentText.fromHtml(state.fileText);
    state.original = state.source.text;
    showSectionInfo(section);
    $("ce-text-title").textContent = section.title;
    $("ce-text").value = state.original;
    $("ce-step2").hidden = false;
    $("ce-step3").hidden = false;
    update();
    return true;
  }

  function showSectionInfo(section) {
    const header = state.source.header;
    const placements = (state.manifest && state.manifest.placements) || {};
    const rows = [
      ["Owner", section.owner || headerValue(header, "OWNER") || "To be confirmed"],
      ["Last reviewed", headerValue(header, "LAST-REVIEWED") || "Not recorded"],
      ["Where it appears", placements[section.placement] || section.placement || ""],
      ["In every syllabus?", section.required ? "Yes, required" : "Only when an instructor turns it on"]
    ];
    const info = el("dl", { class: "ce-facts" }, rows.flatMap(([term, value]) => [el("dt", null, term), el("dd", null, value)]));
    const notes = [];
    if (section.pending) notes.push(el("p", { class: "ce-notice" }, "This section is waiting for its first college statement. Type the approved wording below and send it; the reviewer will add it to the syllabus."));
    if (state.source.fields.length) notes.push(el("p", { class: "ce-notice" }, `This section has ${state.source.fields.length === 1 ? "a fill-in" : "fill-ins"} that each instructor’s syllabus supplies: ${state.source.fields.map((field) => `{${field.label}}`).join(", ")}. Keep ${state.source.fields.length === 1 ? "it" : "them"} where ${state.source.fields.length === 1 ? "it is" : "they are"}.`));
    $("ce-section-info").replaceChildren(info, ...notes);
  }

  /* ---------------- Step 2: edit, preview, check ---------------- */

  function update() {
    if (!state.section) return;
    const text = $("ce-text").value;
    const converted = contentText.toHtml(text, state.source);
    const preview = $("ce-preview");
    const title = el("h4", { class: "ce-preview-heading" }, state.section.title);
    const body = el("div", { class: "ce-preview-body" });
    body.append(sanitize(converted.html));
    /* Fill-ins show as labeled tags in the preview. */
    body.querySelectorAll("span[data-field]").forEach((span) => {
      const field = state.source.fields.find((candidate) => candidate.key === span.getAttribute("data-field"));
      span.replaceChildren(`[${field ? field.label : "Fill-in"}]`);
      span.className = "ce-fill-in";
    });
    preview.replaceChildren(state.section.showTitle === false ? "" : title, body);
    showChecks(contentText.check(text, state.source));
    showDiff();
  }

  let checksTimer = 0;
  function showChecks(problems) {
    window.clearTimeout(checksTimer);
    checksTimer = window.setTimeout(() => {
      const box = $("ce-checks");
      if (!problems.length) {
        box.replaceChildren(el("p", { class: "ce-ok" }, "✓ No problems found."));
        return;
      }
      const errors = problems.filter((problem) => problem.level === "error");
      const warnings = problems.filter((problem) => problem.level !== "error");
      const list = (items, label) => items.length ? [
        el("p", { class: label === "Fix before sending" ? "ce-label-error" : "ce-label-warning" }, `${label} (${items.length})`),
        el("ul", null, items.map((problem) => el("li", null,
          problem.line ? el("button", { type: "button", class: "ce-link-button", "data-line": problem.line }, `Line ${problem.line}`) : null,
          problem.line ? ": " : "", problem.message)))
      ] : [];
      box.replaceChildren(...list(errors, "Fix before sending"), ...list(warnings, "Please check"));
    }, 400);
  }

  function goToLine(lineNumber) {
    const textarea = $("ce-text");
    const lines = textarea.value.split("\n");
    const start = lines.slice(0, lineNumber - 1).reduce((sum, line) => sum + line.length + 1, 0);
    const end = start + (lines[lineNumber - 1] || "").length;
    textarea.focus();
    textarea.setSelectionRange(start, end);
  }

  /* Formatting buttons insert the plain-text markers at the selection. */
  function applyFormat(kind) {
    const textarea = $("ce-text");
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const selected = value.slice(start, end);
    let insert;
    let selectFrom;
    let selectTo;

    if (kind === "bold" || kind === "italic") {
      const mark = kind === "bold" ? "**" : "*";
      const words = selected || (kind === "bold" ? "bold words" : "italic words");
      insert = `${mark}${words}${mark}`;
      selectFrom = start + mark.length;
      selectTo = selectFrom + words.length;
    } else if (kind === "link") {
      const address = window.prompt("Web address for the link (starting with https://):", "https://");
      if (address === null) { textarea.focus(); return; }
      const words = selected || window.prompt("Words people click (say where the link goes, not “click here”):", "") || "";
      insert = `[${words || "link words"}](${address.trim()})`;
      selectFrom = start + 1;
      selectTo = selectFrom + (words || "link words").length;
    } else {
      const prefix = kind === "bullet" ? "- " : kind === "subbullet" ? "    - " : "1. ";
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
      const block = value.slice(lineStart, lineEnd);
      const changed = block.split("\n").map((line, index) => {
        const bare = line.replace(/^\s*(- |\* |• |\d+[.)] )/, "");
        const marker = kind === "numbered" ? `${index + 1}. ` : prefix;
        return line.trim() ? `${marker}${bare}` : line;
      }).join("\n");
      textarea.setRangeText(changed || prefix, lineStart, lineEnd, "end");
      textarea.focus();
      update();
      return;
    }
    textarea.setRangeText(insert, start, end, "end");
    textarea.focus();
    textarea.setSelectionRange(selectFrom, selectTo);
    update();
  }

  /* ---------------- Step 3: changes, send ---------------- */

  function hasUnsentEdits() {
    const text = $("ce-text").value;
    return Boolean(state.section) && text !== state.original && text !== state.sentText;
  }

  /* Word-by-word comparison (longest common subsequence), for the "Your changes" view. */
  function diffWords(before, after) {
    const split = (text) => text.match(/\s+|[^\s]+/g) || [];
    const a = split(before);
    const b = split(after);
    const rows = a.length + 1;
    const cols = b.length + 1;
    if (rows * cols > 4000000) return [{ type: "del", text: before }, { type: "ins", text: after }];
    const table = new Uint32Array(rows * cols);
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        table[i * cols + j] = a[i] === b[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
      }
    }
    const parts = [];
    const push = (type, text) => {
      const last = parts[parts.length - 1];
      if (last && last.type === type) last.text += text; else parts.push({ type, text });
    };
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { push("same", a[i]); i += 1; j += 1; }
      else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) { push("del", a[i]); i += 1; }
      else { push("ins", b[j]); j += 1; }
    }
    while (i < a.length) { push("del", a[i]); i += 1; }
    while (j < b.length) { push("ins", b[j]); j += 1; }
    return parts;
  }

  let diffTimer = 0;
  function showDiff() {
    window.clearTimeout(diffTimer);
    diffTimer = window.setTimeout(() => {
      const after = $("ce-text").value;
      const parts = diffWords(state.original, after);
      const count = (type) => parts.filter((part) => part.type === type).reduce((sum, part) => sum + (part.text.match(/[^\s]+/g) || []).length, 0);
      const added = count("ins");
      const removed = count("del");
      $("ce-diff-summary").textContent = !added && !removed
        ? "No changes yet: this is the current wording."
        : `${added} word${added === 1 ? "" : "s"} added and ${removed} word${removed === 1 ? "" : "s"} removed. Added words are underlined; removed words are struck through.`;
      $("ce-diff").replaceChildren(...parts.map((part) => {
        if (part.type === "same") return document.createTextNode(part.text);
        const tag = part.type === "ins" ? "ins" : "del";
        return el(tag, null, el("span", { class: "visually-hidden" }, part.type === "ins" ? "[added: " : "[removed: "), part.text, el("span", { class: "visually-hidden" }, "]"));
      }));
    }, 300);
  }

  function submissionText() {
    const name = $("ce-name").value.trim();
    const title = $("ce-title").value.trim();
    const reason = $("ce-reason").value.trim();
    return [
      START,
      `Section: ${state.section.title} (content/${state.section.file})`,
      `Based on the version last reviewed: ${headerValue(state.source.header, "LAST-REVIEWED") || "not recorded"}`,
      `From: ${name}, ${title}`,
      `Date: ${today()}`,
      `What changed and why: ${reason || "(not given)"}`,
      "",
      TEXT_START,
      $("ce-text").value.trim(),
      TEXT_END
    ].join("\n");
  }

  function readyToSend() {
    const errors = contentText.check($("ce-text").value, state.source).filter((problem) => problem.level === "error");
    if ($("ce-text").value === state.original) {
      return { ok: false, focus: $("ce-text"), message: "There are no changes to send yet. Edit the wording in step 2 first." };
    }
    if (errors.length) {
      return { ok: false, focus: $("ce-checks-title"), message: `Fix ${errors.length === 1 ? "the problem" : `the ${errors.length} problems`} under Checks in step 2 first.` };
    }
    if (!$("ce-name").value.trim()) return { ok: false, focus: $("ce-name"), message: "Type your name, so the reviewer knows who sent the change." };
    if (!$("ce-title").value.trim()) return { ok: false, focus: $("ce-title"), message: "Type your title or office." };
    return { ok: true };
  }

  function showResult(box, message, isError) {
    box.hidden = false;
    box.classList.toggle("ce-error", Boolean(isError));
    box.replaceChildren(...(Array.isArray(message) ? message : [message]));
  }

  let lastMailto = "";

  async function send() {
    const result = $("ce-send-result");
    const ready = readyToSend();
    if (!ready.ok) {
      showResult(result, ready.message, true);
      if (ready.focus) {
        if (ready.focus.tagName === "H3") ready.focus.setAttribute("tabindex", "-1");
        ready.focus.focus();
      }
      return;
    }
    const text = submissionText();
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (error) { /* the message below says how to get the text another way */ }

    const subject = `College content change: ${state.section.title}`;
    const fullBody = `${reviewer.name ? `Hello ${reviewer.name.split(" ")[0]},` : "Hello,"}\n\nHere is a change to the college wording for review.\n\n${text}\n`;
    /* Long email addresses (mailto links) are cut off by some mail programs, so long changes are pasted instead. */
    const fits = encodeURIComponent(fullBody).length < 1800;
    const body = fits ? fullBody
      : `${reviewer.name ? `Hello ${reviewer.name.split(" ")[0]},` : "Hello,"}\n\nHere is a change to the college wording for review.\n\n[Press Ctrl+V (Command+V on a Mac) here to paste the change.]\n`;
    const href = `mailto:${encodeURIComponent(reviewer.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    state.sentText = $("ce-text").value;
    lastMailto = href;
    window.location.href = href;

    const steps = [
      el("p", null, el("strong", null, "Your email program should open with a new message to the reviewer.")),
      el("ol", null,
        fits ? el("li", null, "Check that your change is in the message.")
          : el("li", null, copied
            ? "Your change is copied. Click in the message where it says to paste, and press Ctrl+V (Command+V on a Mac)."
            : "Your change could not be copied automatically. Choose “Save a copy of my change” below and attach that file to the email."),
        el("li", null, "Send the email."),
        el("li", null, "The reviewer checks your change and lets you know when it is published.")),
      el("p", null, "No email opened? Write to ", reviewer.email ? el("a", { href: `mailto:${reviewer.email}` }, reviewer.email) : "the reviewer",
        copied ? " and paste your change (Ctrl+V) into the message." : " and attach the copy you save with the button below.")
    ];
    showResult(result, steps, false);
    result.setAttribute("tabindex", "-1");
    result.focus();
  }

  function downloadText(fileName, text, type) {
    const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: fileName });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadCopy() {
    if (!state.section) return;
    downloadText(`${state.section.id}-change-${today()}.txt`, submissionText());
  }

  /* ---------------- For the reviewer ---------------- */

  function parseSubmission(text) {
    const value = String(text || "").replace(/\r\n?/g, "\n");
    if (!value.includes(START) || !value.includes(TEXT_START) || !value.includes(TEXT_END)) return null;
    const file = (/Section:.*\(content\/([a-z0-9-]+\.html)\)/.exec(value) || [])[1];
    const from = ((/From:\s*([^\n]*)/.exec(value) || [])[1] || "").trim();
    const based = ((/Based on the version last reviewed:\s*([^\n]*)/.exec(value) || [])[1] || "").trim();
    const wording = value.slice(value.indexOf(TEXT_START) + TEXT_START.length, value.indexOf(TEXT_END)).replace(/^\n+|\n+$/g, "");
    return { file, from, based, wording };
  }

  async function openSubmission() {
    const result = $("ce-reviewer-result");
    const parsed = parseSubmission($("ce-submission").value);
    $("ce-download-file").hidden = true;
    if (!parsed || !parsed.file) {
      showResult(result, "This doesn’t look like a whole change. Paste everything from “SCTCC college content change” to “END OF CHANGE”.", true);
      return;
    }
    const section = state.sections.find((candidate) => candidate.file === parsed.file);
    if (!section) {
      showResult(result, `The section file content/${parsed.file} is not in the list of college sections.`, true);
      return;
    }
    $("ce-section").value = section.id;
    const loaded = await chooseSection(section.id, { force: true });
    if (!loaded) return;
    $("ce-text").value = parsed.wording;
    state.sentText = parsed.wording;
    update();

    const problems = contentText.check(parsed.wording, state.source);
    const errors = problems.filter((problem) => problem.level === "error");
    const current = headerValue(state.source.header, "LAST-REVIEWED") || "not recorded";
    const messages = [el("p", null, `Opened the change to ${section.title} from ${parsed.from || "an unnamed sender"}. Its changes are shown in step 3.`)];
    if (parsed.based && parsed.based !== current) {
      messages.push(el("p", { class: "ce-label-warning" }, `Note: the change was based on the version reviewed ${parsed.based}, but the current file was reviewed ${current}. Check that it doesn’t undo a newer change.`));
    }
    if (errors.length) {
      messages.push(el("p", { class: "ce-label-error" }, `It has ${errors.length} problem${errors.length === 1 ? "" : "s"} to fix first (see Checks in step 2). Fix them, or ask the sender.`));
    } else {
      const editedBy = parsed.from || "";
      state.reviewerFile = { name: section.file, editedBy };
      $("ce-download-file").hidden = false;
      messages.push(el("p", null, `Choose Download the updated file, then upload it to the content folder on GitHub (Add file → Upload files) and create a pull request. Any edits you make above are included in the download.`));
      if (section.pending) messages.push(el("p", { class: "ce-label-warning" }, `This section is marked "pending" in content-manifest.json. Remove "pending": true in the same pull request, or the new wording won’t appear.`));
    }
    showResult(result, messages, errors.length > 0);
    $("ce-step3-title").scrollIntoView({ block: "start" });
  }

  function downloadUpdatedFile() {
    if (!state.section || !state.reviewerFile) return;
    const errors = contentText.check($("ce-text").value, state.source).filter((problem) => problem.level === "error");
    if (errors.length) {
      showResult($("ce-reviewer-result"), "Fix the problems under Checks in step 2 before downloading the file.", true);
      return;
    }
    const built = contentText.toFile($("ce-text").value, state.source, { date: today(), editedBy: state.reviewerFile.editedBy });
    downloadText(state.section.file, built.file, "text/html;charset=utf-8");
  }

  /* ---------------- start-up ---------------- */

  function bind() {
    $("ce-section").addEventListener("change", (event) => chooseSection(event.target.value));
    let typing = 0;
    $("ce-text").addEventListener("input", () => {
      window.clearTimeout(typing);
      typing = window.setTimeout(update, 150);
    });
    $("ce-text").addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "b" || key === "i" || key === "k") {
        event.preventDefault();
        applyFormat(key === "b" ? "bold" : key === "i" ? "italic" : "link");
      }
    });
    document.querySelectorAll("[data-format]").forEach((button) => {
      button.addEventListener("click", () => applyFormat(button.getAttribute("data-format")));
    });
    $("ce-start-over").addEventListener("click", () => {
      if ($("ce-text").value !== state.original && !window.confirm("Start over? This brings back the current wording and removes your changes.")) return;
      $("ce-text").value = state.original;
      update();
      $("ce-text").focus();
    });
    $("ce-checks").addEventListener("click", (event) => {
      const button = event.target.closest("[data-line]");
      if (button) goToLine(Number(button.getAttribute("data-line")));
    });
    $("ce-send").addEventListener("click", send);
    $("ce-download-copy").addEventListener("click", downloadCopy);
    $("ce-open-submission").addEventListener("click", openSubmission);
    $("ce-download-file").addEventListener("click", downloadUpdatedFile);
    window.addEventListener("beforeunload", (event) => {
      if (hasUnsentEdits()) { event.preventDefault(); event.returnValue = ""; }
    });
    $("ce-reviewer-name").textContent = reviewer.name || "the syllabus builder reviewer";
  }

  bind();
  loadManifest();

  window.SCTCC.contentEditor = { parseSubmission, diffWords, lastMailto: () => lastMailto };
})();
