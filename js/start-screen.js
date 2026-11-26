/*
 * SCTCC Syllabus Builder — start screen and import review
 *
 * When the builder opens, the instructor chooses how to begin:
 *   1. Import a previous syllabus (Word .docx or PDF), reviewed before anything is used
 *   2. Open a syllabus saved from this builder (.json)
 *   3. Start from scratch
 *   or see the sample course.
 * Both screens are native <dialog> elements: focus stays inside, Escape closes.
 * Imported files are read in the browser only and are never uploaded.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const SCTCC = window.SCTCC;
  const { el, announce } = SCTCC.dom;

  let app = null;
  let wordInput = null;
  let analysis = null;

  function startDialog() {
    return document.getElementById("start-dialog");
  }

  function importDialog() {
    return document.getElementById("import-dialog");
  }

  /* ---------- Start screen ---------- */

  function option(action, title, description, primary) {
    return el("button", { type: "button", class: `start-option${primary ? " is-primary" : ""}`, "data-start": action },
      el("span", { class: "start-option-title" }, title),
      el("span", { class: "start-option-text" }, description));
  }

  function buildStartDialog() {
    const dialog = startDialog();
    dialog.textContent = "";
    dialog.append(
      el("h2", { id: "start-title", tabindex: "-1" }, "How would you like to start?"),
      el("p", { id: "start-intro" },
        "Your syllabus stays on your computer. Files you open or import are read here in your browser and are never uploaded."),
      el("div", { class: "start-options" },
        option("import", "Import a previous syllabus (Word or PDF)",
          "Using the builder for the first time? Choose last term’s syllabus. A Word (.docx) file works best; a PDF works too. You will see everything found and choose what to keep. College policies and this term’s dates come from the college.", true),
        option("open", "Open a syllabus saved from this builder",
          "After your first term: open your saved .json file. Everything comes back exactly as you saved it."),
        option("blank", "Start from scratch",
          "A blank syllabus, with hints in every section.")),
      el("p", { class: "start-example" },
        el("button", { type: "button", class: "btn btn-link", "data-start": "sample" }, "See an example: open the sample course")),
      el("p", { id: "start-status", class: "editor-note", "aria-live": "polite" }));
  }

  function show() {
    const dialog = startDialog();
    if (dialog.open) return;
    buildStartDialog();
    dialog.showModal();
    dialog.querySelector("#start-title").focus();
  }

  function closeStart() {
    if (startDialog().open) startDialog().close();
  }

  function chooseWordFile() {
    wordInput.value = "";
    wordInput.click();
  }

  async function handleStartChoice(choice) {
    if (choice === "blank") {
      closeStart();
      SCTCC.editor.startBlank();
    } else if (choice === "sample") {
      closeStart();
      SCTCC.editor.loadSample();
    } else if (choice === "open") {
      closeStart();
      await SCTCC.editor.open();
    } else if (choice === "import") {
      chooseWordFile();
    }
  }

  /* ---------- Reading the Word file ---------- */

  function showProblem(message, lines) {
    if (startDialog().open) {
      startDialog().querySelector("#start-status").textContent = `${message} ${lines ? lines.join(" ") : ""}`.trim();
    } else {
      SCTCC.editor.showMessages("error", message, lines);
    }
    announce(message);
  }

  async function importWordFile(file) {
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const status = startDialog().open ? startDialog().querySelector("#start-status") : null;
    if (status) status.textContent = isPdf ? "Reading your PDF syllabus… this can take a few seconds." : "Reading your syllabus…";
    try {
      const docx = isPdf ? await SCTCC.pdf.readPdf(file) : await SCTCC.docx.readDocx(file);
      await app.contentReady();
      analysis = SCTCC.syllabusImport.analyze(docx, { collegeTexts: app.collegeTexts() });
      if (!analysis.items.length) {
        showProblem("Nothing could be read from that file.", ["It may not be a syllabus, or it may use a layout the importer does not recognize. Start from scratch instead."]);
        return;
      }
      closeStart();
      openReview();
    } catch (error) {
      const known = error instanceof SCTCC.docx.DocxError || error instanceof SCTCC.pdf.PdfError;
      const message = known ? error.message : `That file could not be read as a ${isPdf ? "PDF" : "Word document"}.`;
      showProblem(message);
    }
  }

  /* ---------- Review screen ---------- */

  function preview(text) {
    const value = String(text || "");
    if (value.length <= 260) return el("p", { class: "import-preview" }, value);
    return el("details", { class: "import-preview-long" },
      el("summary", null, `${value.slice(0, 200).replace(/\s+\S*$/, "")}… `, el("span", { class: "show-all" }, "Show all")),
      el("p", { class: "import-preview" }, value));
  }

  function photoChoices() {
    const candidates = analysis.photoCandidates;
    if (!candidates.length) return null;
    const max = SCTCC.config.maxPhotoBytes;
    const suggested = candidates.find((candidate) => candidate.suggested && candidate.size <= max);
    return el("fieldset", { class: "field-group import-group" },
      el("legend", null, "Instructor photo"),
      el("p", { class: "editor-note" }, "Pictures found in your syllabus. Choose your photo, if one of them is."),
      el("div", { class: "photo-choices" },
        candidates.map((candidate, index) => {
          const id = `import-photo-${index}`;
          const tooBig = candidate.size > max;
          return el("div", { class: "photo-choice" },
            el("input", { type: "radio", name: "import-photo", id, value: candidate.id, disabled: tooBig, checked: suggested === candidate }),
            el("label", { for: id },
              el("img", { src: candidate.dataUrl(), alt: `Picture ${index + 1} from your syllabus`, width: "96" }),
              el("span", null, tooBig ? `Too large to use (${Math.round(candidate.size / 1024)} KB)` : `Use picture ${index + 1} as my photo`)));
        }),
        el("div", { class: "photo-choice" },
          el("input", { type: "radio", name: "import-photo", id: "import-photo-none", value: "", checked: !suggested }),
          el("label", { for: "import-photo-none" }, el("span", null, "Don’t import a photo")))));
  }

  function openReview() {
    const dialog = importDialog();
    const groups = new Map();
    analysis.items.forEach((item) => {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group).push(item);
    });

    dialog.textContent = "";
    dialog.append(
      el("h2", { id: "import-title", tabindex: "-1" }, "Review your imported syllabus"),
      el("p", null, `Found ${analysis.items.length} items in “${analysis.fileName}.” Untick anything you don’t want. Items that need your decision start unticked. Nothing is saved until you click Save.`),
      analysis.notes.length ? el("ul", { class: "import-notes" }, analysis.notes.map((noteText) => el("li", null, noteText))) : null,
      el("div", { class: "import-body" },
        photoChoices(),
        Array.from(groups.entries()).map(([groupName, items]) => el("fieldset", { class: "field-group import-group" },
          el("legend", null, groupName),
          items.map((item) => {
            const id = `import-${item.id}`;
            return el("div", { class: "import-item" },
              el("div", { class: "field-toggle" },
                el("input", { type: "checkbox", id, "data-item": item.id, checked: item.checked, "aria-describedby": item.note ? `${id}-note` : null }),
                el("label", { for: id }, item.label)),
              item.note ? el("p", { id: `${id}-note`, class: "field-hint" }, item.note) : null,
              preview(item.preview));
          }))),
        el("details", { class: "import-skipped" },
          el("summary", null, "Left out on purpose"),
          el("ul", null, analysis.skipped.map((line) => el("li", null, line))))),
      el("div", { class: "button-row dialog-actions" },
        el("button", { type: "button", class: "btn btn-primary", "data-review": "apply" }, "Import selected"),
        el("button", { type: "button", class: "btn", "data-review": "cancel" }, "Cancel")));

    dialog.showModal();
    dialog.querySelector("#import-title").focus();
    announce(`Found ${analysis.items.length} items. Review them, then choose Import selected.`);
  }

  function applyReview() {
    const dialog = importDialog();
    const data = SCTCC.createEmptySyllabusData();
    let applied = 0;
    analysis.items.forEach((item) => {
      const box = dialog.querySelector(`[data-item="${item.id}"]`);
      if (box && box.checked) {
        item.apply(data);
        applied += 1;
      }
    });
    const photo = dialog.querySelector("input[name='import-photo']:checked");
    if (photo && photo.value) {
      const candidate = analysis.photoCandidates.find((c) => c.id === photo.value);
      if (candidate && candidate.size <= SCTCC.config.maxPhotoBytes) {
        data.instructor.photoData = candidate.dataUrl();
        data.optionalSections.instructorPhoto = true;
        applied += 1;
      }
    }
    const hasTopics = data.calendar.entries.some((entry) => entry.pending);
    const fileName = analysis.fileName;
    dialog.close();
    analysis = null;

    SCTCC.editor.openImported(data, `Imported ${applied} item${applied === 1 ? "" : "s"} from “${fileName}.” Next steps:`, [
      "Course: choose the new term and year.",
      "Credits, modality, and dates: click “Fill in these dates,” and update any dates in your course log-in text.",
      `Course calendar: add the college’s no-class dates and generate the calendar.${hasTopics ? " Your imported topics will be placed in order." : ""}`,
      "Grading: check the categories and the scale.",
      "Review each section in the preview, then Save your syllabus to your own folder or OneDrive."
    ]);
  }

  /* ---------- Setup ---------- */

  function init(appInterface) {
    app = appInterface;
    wordInput = el("input", {
      type: "file",
      id: "import-word-file",
      accept: ".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf",
      class: "visually-hidden",
      tabindex: "-1",
      "aria-hidden": "true"
    });
    document.body.appendChild(wordInput);
    wordInput.addEventListener("change", () => importWordFile(wordInput.files && wordInput.files[0]));

    startDialog().addEventListener("click", (event) => {
      const choice = event.target.closest("[data-start]");
      if (choice) handleStartChoice(choice.getAttribute("data-start"));
    });

    importDialog().addEventListener("click", (event) => {
      const action = event.target.closest("[data-review]");
      if (!action) return;
      if (action.getAttribute("data-review") === "apply") {
        applyReview();
      } else {
        importDialog().close();
        analysis = null;
        announce("Import cancelled. Nothing was changed.");
      }
    });
    importDialog().addEventListener("cancel", () => {
      analysis = null;
    });
  }

  window.SCTCC.startScreen = Object.freeze({ init, show, chooseWordFile });
})();
