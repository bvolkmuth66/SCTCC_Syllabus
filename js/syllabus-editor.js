/*
 * SCTCC Syllabus Builder — instructor editor panel
 *
 * Builds labelled form controls, each tied to a path in the syllabus data
 * (data-path="course.title"). Typing updates the data object; the app then
 * re-renders the preview and autosaves. Controls are filled from the data only
 * when a syllabus is opened, imported, or reset, so typing is never interrupted.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const SCTCC = window.SCTCC;
  const { el, announce } = SCTCC.dom;
  const util = SCTCC.util;

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const TERMS = [["", "Choose a term"], ["Fall", "Fall"], ["Spring", "Spring"], ["Summer", "Summer"]];
  const MODALITIES = [
    ["", "Choose a modality"],
    ["residential", "Residential (face-to-face)"],
    ["hybrid", "Hybrid"],
    ["online", "Exclusively online"]
  ];

  let app = null;
  let root = null;
  let importInput = null;

  /* ---------- Control builders ---------- */

  function fieldId(path) {
    return `f-${path.replace(/[^A-Za-z0-9]+/g, "-")}`;
  }

  function hintFor(id, hint) {
    return hint ? el("p", { id: `${id}-hint`, class: "field-hint" }, hint) : null;
  }

  /*
   * kind: "text" | "email" | "tel" | "url" | "date" | "time" | "number" | "textarea" | "lines" | "select"
   * "lines" edits a list: one item per line.
   */
  function field(kind, path, label, options) {
    const opts = options || {};
    const id = fieldId(path);
    const describedBy = opts.hint ? `${id}-hint` : null;
    let control;

    if (kind === "textarea" || kind === "lines") {
      control = el("textarea", {
        id,
        rows: opts.rows || (kind === "lines" ? 4 : 3),
        "data-path": path,
        "data-kind": kind === "lines" ? "lines" : "text",
        "aria-describedby": describedBy,
        spellcheck: "true"
      });
    } else if (kind === "select") {
      control = el("select", { id, "data-path": path, "data-kind": "text", "aria-describedby": describedBy },
        opts.choices.map(([value, text]) => el("option", { value }, text)));
    } else {
      control = el("input", {
        id,
        type: kind,
        "data-path": path,
        "data-kind": kind === "number" ? "number" : "text",
        "aria-describedby": describedBy,
        autocomplete: opts.autocomplete || "off",
        inputmode: opts.inputmode || null,
        min: kind === "number" ? "0" : null,
        step: kind === "number" ? (opts.step || "any") : null,
        spellcheck: kind === "text" ? "true" : null
      });
    }

    return el("div", { class: `field field-${kind}${opts.narrow ? " field-narrow" : ""}` },
      el("label", { for: id }, label, opts.optionalLabel ? el("span", { class: "field-optional" }, " (optional)") : null),
      hintFor(id, opts.hint),
      control);
  }

  /* A checkbox that turns an optional syllabus section on or off. */
  function toggle(key, label, hint) {
    const path = `optionalSections.${key}`;
    const id = fieldId(path);
    return el("div", { class: "field field-toggle" },
      el("input", {
        type: "checkbox",
        id,
        "data-path": path,
        "data-kind": "boolean",
        "aria-describedby": hint ? `${id}-hint` : null
      }),
      el("label", { for: id }, label),
      hintFor(id, hint));
  }

  function checkboxGroup(path, legend, values, hint) {
    const groupId = fieldId(path);
    return el("fieldset", { class: "field-group", "aria-describedby": hint ? `${groupId}-hint` : null },
      el("legend", null, legend),
      hintFor(groupId, hint),
      el("div", { class: "checkbox-grid" }, values.map((value) => {
        const id = `${groupId}-${value.toLowerCase()}`;
        return el("div", { class: "checkbox-row" },
          el("input", { type: "checkbox", id, value, "data-group": path, "data-kind": "checkbox-group" }),
          el("label", { for: id }, value));
      })));
  }

  function fieldset(legend, children, extraClass) {
    return el("fieldset", { class: `field-group${extraClass ? ` ${extraClass}` : ""}` }, el("legend", null, legend), children);
  }

  function group(id, title, children, open) {
    return el("details", { class: "editor-group", id, open: Boolean(open) },
      el("summary", null, title),
      el("div", { class: "group-body" }, children));
  }

  function note(text) {
    return el("p", { class: "editor-note" }, text);
  }

  function actionButton(action, text, extraClass, attrs) {
    return el("button", Object.assign({ type: "button", class: `btn${extraClass ? ` ${extraClass}` : ""}`, "data-action": action }, attrs || {}), text);
  }

  /* ---------- Groups ---------- */

  function dataGroup() {
    importInput = el("input", {
      type: "file",
      id: "import-file",
      accept: ".json,application/json",
      class: "visually-hidden",
      tabindex: "-1",
      "aria-hidden": "true"
    });
    return group("editor-data", "Save, open, and share", [
      el("p", { id: "save-status", class: "save-status", role: "status" }, "Not saved yet."),
      el("div", { id: "data-messages", class: "data-messages", "aria-live": "polite" }),
      note("Your work saves automatically in this browser on this computer only. It is not sent anywhere. Export a file to keep a backup or to move a syllabus to another computer."),
      el("div", { class: "field" },
        el("label", { for: "saved-list" }, "Syllabi saved in this browser"),
        el("select", { id: "saved-list" }),
        el("div", { class: "button-row" },
          actionButton("open-saved", "Open"),
          actionButton("delete-saved", "Delete from this browser", "btn-danger"))),
      el("div", { class: "button-row" },
        actionButton("new", "New syllabus"),
        actionButton("sample", "Load sample course"),
        actionButton("export", "Export to file (.json)"),
        actionButton("import", "Import from file")),
      importInput,
      el("div", { class: "button-row" },
        actionButton("reset", "Clear this syllabus", "btn-danger"),
        actionButton("clear-all", "Delete all saved syllabi", "btn-danger"))
    ], true);
  }

  function courseGroup() {
    return group("editor-course", "Course", [
      note("Use the information from the official SCTCC Course Outline."),
      el("div", { class: "field-row" },
        field("text", "course.prefix", "Course prefix", { hint: "For example: CPTR", narrow: true }),
        field("text", "course.number", "Course number", { hint: "For example: 1118", narrow: true, inputmode: "numeric" })),
      field("text", "course.title", "Course title"),
      el("div", { class: "field-row" },
        field("select", "course.term", "Term", { choices: TERMS, narrow: true }),
        field("text", "course.year", "Year", { narrow: true, inputmode: "numeric" })),
      el("div", { class: "field-row" },
        field("text", "meta.syllabusVersion", "Syllabus version", { hint: "Shown in the PDF footer", narrow: true }),
        field("date", "meta.lastRevised", "Last revised", { narrow: true, optionalLabel: true }))
    ], true);
  }

  function instructorGroup() {
    return group("editor-instructor", "Instructor", [
      field("text", "instructor.name", "Name", { autocomplete: "name" }),
      field("text", "instructor.credentials", "Credentials", { hint: "For example: MSIA, CCNA", optionalLabel: true }),
      field("email", "instructor.email", "Email", { autocomplete: "email" }),
      field("tel", "instructor.phone", "Telephone", { autocomplete: "tel", optionalLabel: true }),
      field("text", "instructor.office", "Office location", { hint: "Room number, or residential/virtual" }),
      field("textarea", "instructor.officeHours", "Office hours", { hint: "One line per day or time block" }),
      field("text", "instructor.preferredContactMethod", "Best way to contact me", { hint: "Completes the sentence “The best way to contact me is by …” For example: email" }),
      field("textarea", "instructor.responseTime", "Response time", { hint: "For example: You can expect a response to email questions within 24 hours Mondays–Thursdays." }),
      fieldset("Photo", [
        toggle("instructorPhoto", "Include my photo"),
        el("div", { class: "field" },
          el("label", { for: "photo-upload" }, "Upload a photo"),
          hintFor("photo-upload", "PNG, JPEG, or WebP, up to 300 KB. It is saved with this syllabus."),
          el("input", { type: "file", id: "photo-upload", accept: "image/png,image/jpeg,image/webp", "aria-describedby": "photo-upload-hint" })),
        el("p", { id: "photo-status", class: "editor-note", "aria-live": "polite" }),
        actionButton("remove-photo", "Remove uploaded photo"),
        field("url", "instructor.photoUrl", "Or photo web address", { hint: "Used only when no photo is uploaded", optionalLabel: true }),
        field("text", "instructor.photoAlt", "Photo description for screen readers", { hint: "Leave blank to use “Photo of [your name]”", optionalLabel: true })
      ]),
      fieldset("Instructor bio", [
        toggle("instructorBiography", "Include an instructor bio"),
        field("textarea", "instructor.biography", "Bio", { rows: 4 })
      ]),
      fieldset("Educational philosophy", [
        toggle("educationalPhilosophy", "Include my educational philosophy"),
        field("textarea", "instructor.philosophy", "Educational philosophy", { rows: 4 })
      ])
    ]);
  }

  function scheduleGroup() {
    return group("editor-schedule", "Credits, modality, and dates", [
      fieldset("Credits", el("div", { class: "field-row field-row-4" },
        field("number", "course.credits.total", "Total", { narrow: true }),
        field("number", "course.credits.lecture", "Lecture", { narrow: true }),
        field("number", "course.credits.laboratory", "Laboratory", { narrow: true }),
        field("number", "course.credits.soe", "SOE", { narrow: true }))),
      field("select", "course.modality", "Modality", { choices: MODALITIES }),
      checkboxGroup("course.meetingPattern.days", "Meeting days", DAYS, "Not needed for exclusively online courses."),
      el("div", { class: "field-row" },
        field("time", "course.meetingPattern.startTime", "Start time", { narrow: true }),
        field("time", "course.meetingPattern.endTime", "End time", { narrow: true })),
      field("text", "course.location", "Room number", { hint: "For example: 1-405", narrow: true }),
      field("textarea", "course.modalityNote", "Additional modality information", {
        optionalLabel: true,
        hint: "For example (hybrid): The lecture component of this course is online with pre-recorded lectures."
      }),
      note("Use the college’s official dates. The course must not begin before the official semester start date and must include final exam week."),
      el("div", { class: "field-row" },
        field("date", "course.startDate", "Begin date", { narrow: true }),
        field("date", "course.endDate", "End date", { narrow: true })),
      el("div", { class: "field-row" },
        field("date", "course.dropDate", "Last day to drop (full refund)", { narrow: true }),
        field("date", "course.withdrawalDate", "Last day to withdraw (“W”)", { narrow: true })),
      fieldset("Course log-in (online courses)", [
        toggle("courseLogin", "Include course log-in requirements"),
        field("textarea", "course.courseLogin", "Log-in requirement", {
          rows: 4,
          hint: "Sample: If you have not logged in to the course and participated in the Discussions by [date and time], you will be dropped from the course during the first week."
        })
      ])
    ]);
  }

  function descriptionGroup() {
    return group("editor-description", "Description, outcomes, and requisites", [
      note("Copy these from the official SCTCC Course Outline and eServices."),
      field("textarea", "course.description", "Course description", { rows: 5 }),
      field("lines", "course.outcomes", "Course outcomes", { rows: 6, hint: "One outcome per line. They are numbered automatically." }),
      field("text", "course.prerequisites.intro", "Prerequisite introduction", {
        optionalLabel: true,
        hint: "For example: This course requires any of these 2 prerequisite categories:"
      }),
      field("lines", "course.prerequisites.items", "Prerequisites", { hint: "One per line (Accuplacer scores, courses, etc.). Numbered automatically." }),
      field("textarea", "course.corequisites", "Corequisites", { optionalLabel: true, rows: 2 }),
      fieldset("Minnesota Transfer Curriculum", [
        toggle("mnTransferGoal", "This course fulfills a MnTC goal area"),
        field("text", "course.mnTransferGoal", "Goal area number", { narrow: true })
      ])
    ]);
  }

  function materialsGroup() {
    return group("editor-materials", "Materials and technology", [
      field("lines", "materials.required", "Required materials", { hint: "One per line: textbooks, software beyond the standard list, other materials." }),
      fieldset("Recommended materials", [
        toggle("recommendedMaterials", "Include recommended materials"),
        field("lines", "materials.recommended", "Recommended materials", { hint: "One per line." })
      ]),
      field("lines", "materials.requiredTechnologyAdditions", "Additional required technology", {
        optionalLabel: true,
        hint: "Listed after the college’s standard list (SCTCC email, internet access, Microsoft Office). One per line."
      }),
      field("lines", "materials.technicalSkills", "Suggested technical skills", {
        hint: "One per line. For example: keyboarding speed, word processing, website navigation, computer fundamentals."
      })
    ]);
  }

  function policiesGroup() {
    return group("editor-policies", "Course policies", [
      field("textarea", "policies.attendance", "Attendance", {
        rows: 5,
        hint: "Appears after the college’s first-week and administrative-withdrawal text. Sample: Please see me or send me an email with any attendance-related issues throughout the semester."
      }),
      field("textarea", "policies.lateWork", "Late policy", { hint: "Sample: Late work is not accepted." }),
      field("text", "policies.acceptedFileFormats", "Accepted file formats for D2L Assignments", {
        optionalLabel: true,
        hint: "Leave blank to use the college default: Microsoft Word or PDF."
      }),
      fieldset("College policy options", [
        toggle("academicIntegrityExamples", "Include examples of academic dishonesty",
          "The list ends with a course penalty: a zero for a first instance and an F for the course for a second. Include it only if that is your policy."),
        toggle("turnitin", "Include the Turnitin statement")
      ]),
      fieldset("Class Environment", [
        toggle("classEnvironment", "Include a Class Environment section"),
        field("textarea", "policies.classEnvironment", "Your Class Environment text", {
          rows: 5,
          optionalLabel: true,
          hint: "Leave blank to use the college sample text. Anything you write here replaces it."
        })
      ])
    ]);
  }

  function vendorsGroup() {
    return group("editor-vendors", "Tools and vendors (Accessibility & Data Privacy)", [
      note("List technology this course uses that is not already under the Resources tab in D2L: publisher platforms, plagiarism tools, web conferencing, polling, recording tools, social media, mobile apps, and similar."),
      note("Link each tool’s accessibility statement. If there is none, link its VPAT. If neither exists, leave both blank and the syllabus will say so. Link the data privacy policy of any tool that may collect student data."),
      el("div", { id: "vendor-rows" }),
      actionButton("add-vendor", "Add a tool", "btn-primary", { id: "add-vendor" })
    ]);
  }

  function gradingGroup() {
    return group("editor-grading", "Grading text", [
      note("The assignments table and grading scale editor arrive in Phase 3. Imported files and the sample course keep their tables."),
      field("textarea", "grading.intro", "Assignments & points introduction", {
        rows: 4,
        optionalLabel: true,
        hint: "Sample: There are eight units in this course… Assessments for the course include:"
      }),
      field("textarea", "grading.gradesNarrative.postedWhere", "Where grades are posted", {
        hint: "Sample: You can check your grade through D2L Brightspace Grades at any point during the semester."
      }),
      field("textarea", "grading.gradesNarrative.turnaround", "Grading turnaround", {
        hint: "Sample: You can expect to have graded assignments returned within 5 days of the due date. (A 3- to 5-day turnaround is encouraged.)"
      }),
      field("textarea", "grading.gradesNarrative.contact", "Questions about grades", { optionalLabel: true }),
      field("textarea", "grading.gradesNarrative.additional", "Additional grading information", { optionalLabel: true }),
      fieldset("Time commitment", [
        toggle("timeCommitment", "Include a Time Commitment section"),
        field("textarea", "grading.timeCommitment", "Time commitment", {
          rows: 4,
          hint: "Sample: You should expect to spend two hours outside of class for each hour of lecture and one hour outside of class for each hour of lab…"
        })
      ])
    ]);
  }

  function calendarGroup() {
    return group("editor-calendar", "Course calendar", [
      note("The calendar generator arrives in Phase 4. Imported files and the sample course keep their calendar rows."),
      field("textarea", "calendar.locationStatement", "Where the course schedule is located", {
        hint: "For example: The complete, current schedule is posted in D2L under Content > Course Schedule."
      })
    ]);
  }

  function statusGroup() {
    return group("editor-status", "College content status", [
      el("div", { id: "builder-status-body" }, el("p", null, "Loading college content…"))
    ]);
  }

  /* ---------- Vendor rows ---------- */

  function vendorLegend(index, name) {
    return `Tool ${index + 1}${name ? `: ${name}` : ""}`;
  }

  function buildVendorRows() {
    const container = root.querySelector("#vendor-rows");
    container.textContent = "";
    const vendors = app.getData().vendors;
    if (!vendors.length) {
      container.appendChild(note("No tools added."));
      return;
    }
    vendors.forEach((vendor, index) => {
      const base = `vendors.${index}`;
      container.appendChild(el("fieldset", { class: "field-group vendor-row" },
        el("legend", { id: `vendor-legend-${index}` }, vendorLegend(index, vendor.name)),
        field("text", `${base}.name`, "Tool or vendor name"),
        field("textarea", `${base}.purpose`, "Purpose in this course", { rows: 2 }),
        field("url", `${base}.accessibilityUrl`, "Accessibility statement web address", { optionalLabel: true }),
        field("url", `${base}.vpatUrl`, "VPAT web address", { optionalLabel: true }),
        field("url", `${base}.privacyUrl`, "Data privacy policy web address", { optionalLabel: true }),
        field("select", `${base}.accountRequired`, "Student account required?", {
          choices: [["", "Choose"], ["yes", "Yes"], ["no", "No"]],
          narrow: true
        }),
        field("textarea", `${base}.dataCollected`, "Student data collected", { rows: 2, optionalLabel: true }),
        field("textarea", `${base}.alternativeAccess`, "Alternative access method", { rows: 2, optionalLabel: true }),
        field("url", `${base}.supportUrl`, "Technical support web address", { optionalLabel: true }),
        actionButton("remove-vendor", `Remove tool ${index + 1}`, "btn-danger", { "data-index": String(index) })));
    });
    populate(container);
  }

  /* ---------- Filling controls from data ---------- */

  function populate(scope) {
    const data = app.getData();
    const area = scope || root;
    area.querySelectorAll("[data-path]").forEach((control) => {
      const value = util.getPath(data, control.getAttribute("data-path"));
      const kind = control.getAttribute("data-kind");
      if (kind === "boolean") control.checked = Boolean(value);
      else if (kind === "lines") control.value = Array.isArray(value) ? value.join("\n") : "";
      else if (kind === "number") control.value = value || value === 0 ? String(value) : "";
      else control.value = value === null || value === undefined ? "" : String(value);
    });
    area.querySelectorAll("[data-kind='checkbox-group']").forEach((box) => {
      const values = util.getPath(data, box.getAttribute("data-group"));
      box.checked = Array.isArray(values) && values.includes(box.value);
    });
    if (!scope) {
      buildVendorRows();
      updatePhotoStatus();
    }
  }

  function updatePhotoStatus() {
    const data = app.getData();
    const status = root.querySelector("#photo-status");
    const removeButton = root.querySelector("[data-action='remove-photo']");
    const hasUpload = Boolean(data.instructor.photoData);
    status.textContent = hasUpload ? "An uploaded photo is saved with this syllabus." : "";
    removeButton.hidden = !hasUpload;
  }

  /* ---------- Messages ---------- */

  function setSaveStatus(text) {
    const status = root && root.querySelector("#save-status");
    if (status) status.textContent = text;
  }

  function showMessages(kind, title, lines) {
    const box = root.querySelector("#data-messages");
    box.textContent = "";
    if (!title) return;
    box.appendChild(el("div", { class: `notice notice-${kind}` },
      el("p", null, el("strong", null, title)),
      lines && lines.length ? el("ul", null, lines.map((line) => el("li", null, line))) : null));
  }

  function refreshSavedList() {
    const select = root.querySelector("#saved-list");
    const currentId = app.getData().meta.id;
    select.textContent = "";
    const saved = SCTCC.storage.list();
    if (!saved.length) {
      select.appendChild(el("option", { value: "" }, "No saved syllabi yet"));
      select.disabled = true;
      return;
    }
    select.disabled = false;
    saved.forEach((item) => {
      const when = item.savedAt ? new Date(item.savedAt) : null;
      const stamp = when && !Number.isNaN(when.getTime()) ? ` — saved ${when.toLocaleDateString()}` : "";
      const option = el("option", { value: item.id }, `${item.label}${item.id === currentId ? " (open now)" : ""}${stamp}`);
      if (item.id === currentId) option.selected = true;
      select.appendChild(option);
    });
  }

  /* ---------- Events ---------- */

  function readControl(control) {
    const kind = control.getAttribute("data-kind");
    if (kind === "boolean") return control.checked;
    if (kind === "lines") return control.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (kind === "number") {
      if (control.value.trim() === "") return 0;
      const number = Number(control.value);
      return Number.isFinite(number) ? number : undefined;
    }
    return control.value;
  }

  function handleInput(event) {
    const control = event.target;
    const data = app.getData();

    if (control.getAttribute("data-kind") === "checkbox-group") {
      const path = control.getAttribute("data-group");
      const chosen = Array.from(root.querySelectorAll(`[data-group='${path}']`))
        .filter((box) => box.checked)
        .map((box) => box.value);
      util.setPath(data, path, chosen);
      if (path === "course.meetingPattern.days") data.course.meetingPattern.meetingsPerWeek = chosen.length;
      app.dataChanged();
      return;
    }

    const path = control.getAttribute("data-path");
    if (!path) return;
    const value = readControl(control);
    if (value === undefined) return;
    util.setPath(data, path, value);

    const vendorName = /^vendors\.(\d+)\.name$/.exec(path);
    if (vendorName) {
      const legend = root.querySelector(`#vendor-legend-${vendorName[1]}`);
      if (legend) legend.textContent = vendorLegend(Number(vendorName[1]), value);
    }
    app.dataChanged();
  }

  function handlePhotoUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const maxBytes = SCTCC.config.maxPhotoBytes;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      showMessages("error", "That photo is not a PNG, JPEG, or WebP image.");
      input.value = "";
      return;
    }
    if (file.size > maxBytes) {
      showMessages("error", `That photo is ${Math.round(file.size / 1024)} KB. Please use an image of ${Math.round(maxBytes / 1024)} KB or smaller.`,
        ["Tip: resize it to about 400 pixels wide before uploading."]);
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = app.getData();
      data.instructor.photoData = String(reader.result);
      data.optionalSections.instructorPhoto = true;
      populate(root.querySelector("#editor-instructor"));
      updatePhotoStatus();
      showMessages("info", "Photo added and “Include my photo” turned on.");
      app.dataChanged();
      input.value = "";
    };
    reader.onerror = () => showMessages("error", "The photo could not be read.");
    reader.readAsDataURL(file);
  }

  function openData(data, title, warnings) {
    app.replaceData(data);
    populate();
    refreshSavedList();
    showMessages(warnings && warnings.length ? "warning" : "info", title, warnings);
    announce(title);
  }

  async function handleImport(file) {
    const read = await SCTCC.storage.readImportFile(file);
    importInput.value = "";
    if (!read.ok) {
      showMessages("error", "Import failed.", [read.error]);
      announce("Import failed.");
      return;
    }
    const result = SCTCC.validateSyllabusData(read.value, { currentContentVersion: app.contentVersion() });
    if (!result.ok) {
      showMessages("error", "Import failed.", result.errors);
      announce("Import failed.");
      return;
    }
    openData(result.data, `Imported “${SCTCC.storage.labelFor(result.data)}”.`, result.warnings);
  }

  function handleAction(action, button) {
    const data = app.getData();
    switch (action) {
      case "new":
        openData(SCTCC.createEmptySyllabusData(), "Started a new, blank syllabus. Your previous syllabus is still saved in this browser.");
        break;

      case "sample": {
        const result = SCTCC.validateSyllabusData(window.SCTCC_SAMPLE_DATA || {}, { newId: true });
        if (result.ok) openData(result.data, "Loaded the sample course as a new syllabus. Your previous syllabus is still saved.");
        else showMessages("error", "The sample course could not be loaded.", result.errors);
        break;
      }

      case "open-saved": {
        const id = root.querySelector("#saved-list").value;
        if (!id) return;
        const record = SCTCC.storage.load(id);
        if (!record) {
          showMessages("error", "That saved syllabus could not be opened.");
          return;
        }
        const result = SCTCC.validateSyllabusData(
          { format: "sctcc-syllabus-data", contentVersion: record.contentVersion, syllabus: record.syllabus },
          { currentContentVersion: app.contentVersion() }
        );
        if (result.ok) openData(result.data, `Opened “${SCTCC.storage.labelFor(result.data)}”.`, result.warnings);
        else showMessages("error", "That saved syllabus could not be opened.", result.errors);
        break;
      }

      case "delete-saved": {
        const select = root.querySelector("#saved-list");
        const id = select.value;
        if (!id) return;
        const label = select.selectedOptions[0] ? select.selectedOptions[0].textContent : "this syllabus";
        if (!window.confirm(`Delete “${label}” from this browser?\n\nThis cannot be undone. Export it to a file first if you may need it.`)) return;
        SCTCC.storage.remove(id);
        if (id === data.meta.id) {
          openData(SCTCC.createEmptySyllabusData(), "Deleted the open syllabus from this browser and started a new one.");
        } else {
          refreshSavedList();
          showMessages("info", "Deleted from this browser.");
          announce("Deleted from this browser.");
        }
        break;
      }

      case "export": {
        const name = SCTCC.storage.exportFile(data, app.contentVersion(), app.suggestedFileName());
        showMessages("info", `Exported ${name}.`, ["Keep this file somewhere safe. Use Import from file to open it again on any computer."]);
        announce(`Exported ${name}.`);
        break;
      }

      case "import":
        importInput.click();
        break;

      case "reset": {
        if (!window.confirm("Clear every field in this syllabus?\n\nThis cannot be undone. Export it to a file first if you may need it.")) return;
        const blank = SCTCC.createEmptySyllabusData();
        blank.meta.id = data.meta.id;
        openData(blank, "Cleared this syllabus.");
        break;
      }

      case "clear-all": {
        if (!window.confirm("Delete every syllabus saved in this browser?\n\nThis cannot be undone. Export any you may need first.")) return;
        SCTCC.storage.clearAll();
        openData(SCTCC.createEmptySyllabusData(), "Deleted all syllabi saved in this browser and started a new one.");
        break;
      }

      case "add-vendor": {
        data.vendors.push(SCTCC.createEmptyVendor());
        buildVendorRows();
        app.dataChanged();
        const index = data.vendors.length - 1;
        const first = root.querySelector(`#${fieldId(`vendors.${index}.name`)}`);
        if (first) first.focus();
        announce(`Added tool ${index + 1}.`);
        break;
      }

      case "remove-vendor": {
        const index = Number(button.getAttribute("data-index"));
        const name = data.vendors[index] && data.vendors[index].name;
        if (name && !window.confirm(`Remove “${name}” from the tools list?`)) return;
        data.vendors.splice(index, 1);
        buildVendorRows();
        app.dataChanged();
        root.querySelector("#add-vendor").focus();
        announce(`Removed tool ${index + 1}.`);
        break;
      }

      case "remove-photo":
        data.instructor.photoData = "";
        updatePhotoStatus();
        app.dataChanged();
        root.querySelector("#photo-upload").focus();
        announce("Uploaded photo removed.");
        break;

      default:
        break;
    }
  }

  /* ---------- Setup ---------- */

  function init(appInterface) {
    app = appInterface;
    root = document.getElementById("editor-body");
    root.textContent = "";
    root.appendChild(el("form", { id: "syllabus-editor", class: "editor-form", novalidate: true },
      dataGroup(),
      courseGroup(),
      instructorGroup(),
      scheduleGroup(),
      descriptionGroup(),
      materialsGroup(),
      policiesGroup(),
      vendorsGroup(),
      gradingGroup(),
      calendarGroup(),
      statusGroup()));

    const form = root.querySelector("#syllabus-editor");
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("input", (event) => {
      if (event.target.type === "file" || event.target.id === "saved-list") return;
      handleInput(event);
    });
    form.addEventListener("change", (event) => {
      const target = event.target;
      if (target.id === "photo-upload") handlePhotoUpload(target);
      else if (target.id === "import-file") handleImport(target.files && target.files[0]);
    });
    form.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (button) handleAction(button.getAttribute("data-action"), button);
    });

    populate();
    refreshSavedList();
    if (!SCTCC.storage.isAvailable()) {
      setSaveStatus("Autosave is not available in this browser. Use Export to file to keep your work.");
    }
  }

  window.SCTCC.editor = Object.freeze({
    init,
    populate: () => populate(),
    refreshSavedList,
    setSaveStatus,
    showMessages
  });
})();
