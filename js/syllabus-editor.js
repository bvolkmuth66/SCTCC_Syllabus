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

    return el("div", { class: `field field-${kind}${opts.narrow ? " field-narrow" : ""}${opts.className ? ` ${opts.className}` : ""}` },
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

  /* A checkbox bound to any true/false field. */
  function checkbox(path, label, hint) {
    const id = fieldId(path);
    return el("div", { class: "field field-toggle" },
      el("input", { type: "checkbox", id, "data-path": path, "data-kind": "boolean", "aria-describedby": hint ? `${id}-hint` : null }),
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
      el("summary", null, el("span", { class: "group-number" }), el("span", { class: "group-title" }, title)),
      el("div", { class: "group-body" }, children));
  }

  /*
   * Which syllabus sections each editor group fills in. "#id" is a major section;
   * other entries are subsection heading ids. Numbers are read from the preview
   * after each render, so they always match the preview and the PDF.
   */
  const GROUP_SECTIONS = {
    "editor-course": [], /* the title block at the top of the syllabus */
    "editor-instructor": ["#instructor-information"],
    "editor-schedule": ["general-information-3", "course-log-in-3"],
    "editor-description": ["pre-co-requisites-3", "course-description-and-outcomes-3", "mn-transfer-curriculum-goal-area-3"],
    "editor-materials": ["materials-3"],
    "editor-policies": ["#college-policies", "#course-policies"],
    "editor-vendors": ["accessibility-and-data-privacy-policies-3"],
    "editor-grading": ["#grading"],
    "editor-calendar": ["#course-calendar"]
  };

  function sectionNumber(target) {
    const heading = target.startsWith("#")
      ? document.querySelector(`${target} > h2`)
      : document.getElementById(target);
    const number = heading && heading.querySelector(".section-number");
    return number ? number.textContent.replace(/\.?\s*$/, "") : "";
  }

  /* "2.3, 2.4, 2.5" becomes "2.3–2.5". */
  function formatNumbers(numbers) {
    if (numbers.length <= 2) return numbers.join(", ");
    const parts = numbers.map((number) => number.split(".").map(Number));
    const sameMajor = parts.every((part) => part.length === 2 && part[0] === parts[0][0]);
    const consecutive = sameMajor && parts.every((part, index) => index === 0 || part[1] === parts[index - 1][1] + 1);
    return consecutive ? `${numbers[0]}–${numbers[numbers.length - 1]}` : numbers.join(", ");
  }

  function updateSectionNumbers() {
    if (!root) return;
    Object.entries(GROUP_SECTIONS).forEach(([groupId, targets]) => {
      const slot = root.querySelector(`#${groupId} > summary .group-number`);
      if (!slot) return;
      const numbers = [...new Set(targets.map(sectionNumber).filter(Boolean))];
      slot.textContent = numbers.length ? `${formatNumbers(numbers)} ` : "";
      slot.title = numbers.length ? `Syllabus section ${formatNumbers(numbers)}` : "";
    });
  }

  document.addEventListener("syllabus:rendered", updateSectionNumbers);

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
    return group("editor-data", "Save and open your syllabus", [
      el("p", { id: "file-status", class: "save-status", role: "status" }, "New syllabus — not saved yet."),
      el("div", { id: "data-messages", class: "data-messages", "aria-live": "polite" }),
      el("div", { class: "button-row" },
        actionButton("save", "Save", "btn-primary", { "aria-keyshortcuts": "Control+S Meta+S" }),
        actionButton("save-as", "Save as…"),
        actionButton("open", "Open…")),
      el("div", { class: "button-row" },
        actionButton("import-docx", "Import a previous syllabus…"),
        actionButton("start-over", "Start over…"),
        actionButton("reset", "Clear this syllabus", "btn-danger")),
      importInput,
      el("div", { class: "ip-notice" },
        el("p", null, el("strong", null, "Your syllabus is your intellectual property. "),
          "This builder never stores it — not in this browser, not on GitHub, and not on any server. ",
          "Save it as a file to your own computer or your OneDrive folder."),
        el("p", { id: "save-method-note" }))
    ], true);
  }

  function checkGroup() {
    return group("editor-check", "Check before printing", [
      note("Print to PDF runs these checks automatically. You can also check at any time."),
      el("div", { class: "button-row" }, actionButton("run-check", "Check my syllabus", "btn-primary", { id: "run-check" })),
      el("div", { id: "check-results", "aria-live": "polite" })
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
      el("div", { id: "college-dates", class: "college-dates" }),
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
      field("lines", "course.outcomes", "Student learning outcomes", { rows: 6, hint: "One outcome per line. They are shown as a bulleted list under the heading Student Learning Outcomes." }),
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
      ]),
      fieldset("Program Diversity Statement", [
        note("The College Diversity Statement is always included. Add your program’s own statement here if it has one; it appears right after the college statement."),
        toggle("programDiversity", "Include a Program Diversity Statement"),
        field("textarea", "policies.programDiversity", "Program Diversity Statement", { rows: 5 })
      ]),
      fieldset("Additional course sections", [
        note("Your own sections, such as Exams, Lab Safety, or Student Responsibilities. Each appears under Course Policies & Procedures after the Late Policy."),
        el("div", { id: "extra-rows" }),
        actionButton("add-extra", "Add a section", "btn-primary", { id: "add-extra" })
      ])
    ]);
  }

  /* ---------- Additional course sections ---------- */

  function extraLegend(index, title) {
    return `Section ${index + 1}${title ? `: ${title}` : ""}`;
  }

  function buildExtraRows() {
    const container = root.querySelector("#extra-rows");
    container.textContent = "";
    const sections = app.getData().policies.additionalSections;
    if (!sections.length) {
      container.appendChild(note("None added."));
      return;
    }
    sections.forEach((section, index) => {
      const base = `policies.additionalSections.${index}`;
      const name = section.title.trim() || `section ${index + 1}`;
      container.appendChild(el("fieldset", { class: "field-group extra-row" },
        el("legend", { id: `extra-legend-${index}` }, extraLegend(index, section.title.trim())),
        field("text", `${base}.title`, "Section title"),
        field("textarea", `${base}.text`, "Section text", { rows: 5, hint: "Blank lines start new paragraphs. Web addresses become links." }),
        el("div", { class: "button-row" },
          actionButton("move-extra", "Move up", null, { "data-index": String(index), "data-direction": "-1", "aria-label": `Move up: ${name}`, disabled: index === 0 }),
          actionButton("move-extra", "Move down", null, { "data-index": String(index), "data-direction": "1", "aria-label": `Move down: ${name}`, disabled: index === sections.length - 1 }),
          actionButton("remove-extra", "Remove", "btn-danger", { "data-index": String(index), "aria-label": `Remove ${name}` }))));
    });
    populate(container);
  }

  function vendorsGroup() {
    return group("editor-vendors", "Tools and vendors (Accessibility & Data Privacy)", [
      note("List technology this course uses that is not already under the Resources tab in D2L: publisher platforms, plagiarism tools, web conferencing, polling, recording tools, social media, mobile apps, and similar."),
      note("Every tool needs its accessibility statement. If the vendor has none, check “This tool has no accessibility statement” and link its VPAT; if neither exists, the syllabus says so. Link the data privacy policy of any tool that may collect student data."),
      el("div", { id: "vendor-rows" }),
      actionButton("add-vendor", "Add a tool", "btn-primary", { id: "add-vendor" })
    ]);
  }

  function gradingGroup() {
    return group("editor-grading", "Grading", [
      field("select", "grading.calculationMethod", "How the final grade is calculated", {
        choices: [
          ["points", "Points: assignments add up to a course point total"],
          ["weighted", "Percentage weights: categories add up to 100%"]
        ]
      }),
      field("textarea", "grading.intro", "Assignments & points introduction", {
        rows: 4,
        optionalLabel: true,
        hint: "Sample: There are eight units in this course… Assessments for the course include:"
      }),

      el("h3", { class: "editor-subheading" }, "Assessment categories"),
      note("Each category is one row of the grading table, for example Labs, Quizzes, or Final Exam."),
      el("div", { id: "category-rows" }),
      el("div", { class: "button-row" }, actionButton("add-category", "Add a category", "btn-primary", { id: "add-category" })),
      el("div", { id: "category-summary", class: "grading-summary", "aria-live": "polite" }),
      el("div", { id: "weight-override-wrap", class: "field field-toggle weighted-only" },
        el("input", {
          type: "checkbox",
          id: "f-grading-weightOverride",
          "data-path": "grading.weightOverride",
          "data-kind": "boolean",
          "aria-describedby": "f-grading-weightOverride-hint"
        }),
        el("label", { for: "f-grading-weightOverride" }, "Publish with weights that do not total 100%"),
        el("p", { id: "f-grading-weightOverride-hint", class: "field-hint" },
          "Only if this is intentional (for example, extra credit). Explain it under “Additional grading information.” The builder never changes your percentages.")),

      el("h3", { class: "editor-subheading" }, "Grading scale"),
      note("Each range includes both ends, for example A = 90–100% and B = 80–89%. Point ranges are calculated from the course total."),
      el("div", { id: "scale-rows" }),
      el("div", { class: "button-row" },
        actionButton("add-grade", "Add a grade", "btn-primary", { id: "add-grade" }),
        actionButton("scale-default", "Reset to A–F"),
        actionButton("scale-plusminus", "Use plus/minus sample")),
      el("div", { id: "scale-summary", class: "grading-summary", "aria-live": "polite" }),

      fieldset("Grades", [
        field("textarea", "grading.gradesNarrative.postedWhere", "Where grades are posted", {
          hint: "Sample: You can check your grade through D2L Brightspace Grades at any point during the semester."
        }),
        field("textarea", "grading.gradesNarrative.turnaround", "Grading turnaround", {
          hint: "Sample: You can expect to have graded assignments returned within 5 days of the due date. (A 3- to 5-day turnaround is encouraged.)"
        }),
        field("textarea", "grading.gradesNarrative.contact", "Questions about grades", { optionalLabel: true }),
        field("textarea", "grading.gradesNarrative.additional", "Additional grading information", { optionalLabel: true })
      ]),
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
      field("textarea", "calendar.locationStatement", "Statement about the course schedule", {
        optionalLabel: true,
        hint: "Shown above the calendar, or by itself if you do not build a calendar. For example: The complete, current schedule is posted in D2L under Content > Course Schedule."
      }),

      el("h3", { class: "editor-subheading" }, "Calendar settings"),
      field("select", "calendar.mode", "Calendar layout", {
        choices: [
          ["meetings", "One row per class meeting"],
          ["weekly", "One row per week (online courses)"]
        ]
      }),
      el("p", { id: "calendar-dates-note", class: "field-hint", "aria-live": "polite" }),
      el("div", { class: "button-row" },
        actionButton("calendar-copy-course", "Use the course meeting days")),
      el("div", { class: "meetings-only" },
        field("select", "calendar.meetingsPerWeek", "Meetings per week", {
          narrow: true,
          choices: [["0", "Choose"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]]
        }),
        checkboxGroup("calendar.meetingDays", "Meeting days", DAYS, "Choose exactly as many days as meetings per week."),
        checkbox("calendar.useFirstWeekSchedule", "The first week has a different schedule"),
        el("div", { id: "first-week-days" },
          checkboxGroup("calendar.firstWeekDays", "First-week meeting days", DAYS)),
        note("Class times come from Credits, modality, and dates.")),
      checkbox("calendar.includeFinalsWeek", "Include final exam week", "The last week of the course is marked as finals week."),
      checkbox("calendar.showExcludedAsRows", "Show no-class dates in the calendar", "Holidays and closures appear as “No Class” rows instead of being left out."),

      fieldset("No-class dates (holidays and closures)", [
        el("div", { class: "button-row" },
          actionButton("add-college-closures", "Add the college’s no-class dates", "btn-primary", { id: "add-college-closures" })),
        el("div", { id: "excluded-rows" }),
        actionButton("add-excluded", "Add a no-class date", null, { id: "add-excluded" })
      ]),

      el("div", { id: "calendar-settings-summary", class: "grading-summary", "aria-live": "polite" }),
      el("div", { class: "button-row" },
        actionButton("calendar-generate", "Generate calendar", "btn-primary", { id: "calendar-generate" }),
        actionButton("calendar-add-row", "Add an unscheduled row", null, { id: "calendar-add-row" })),
      el("div", { class: "button-row" },
        actionButton("calendar-export", "Export calendar (.csv)"),
        actionButton("calendar-clear", "Remove all calendar rows", "btn-danger")),

      el("h3", { id: "calendar-rows-heading", class: "editor-subheading", tabindex: "-1" }, "Calendar rows"),
      note("Topics, readings, due items, and notes stay with their dates when you generate the calendar again."),
      el("div", { id: "calendar-rows" })
    ]);
  }

  /* ---------- Calendar rows ---------- */

  function calendarRowLabel(row) {
    const parts = [];
    if (row.week) parts.push(`Week ${row.week}${row.isFinals ? " (finals)" : ""}`);
    if (row.manual) parts.push("Unscheduled");
    if (row.date) {
      parts.push(row.weekEnd
        ? `${util.formatDate(row.date, "short")}–${util.formatDate(row.weekEnd, "short")}`
        : `${util.weekdayName(row.date, true)} ${util.formatDate(row.date, "short")}`);
    }
    if (row.noClass) parts.push("No class");
    const topic = String(row.topic || "").trim();
    parts.push(topic || "(no topic)");
    return parts.join(" · ");
  }

  function buildExcludedRows() {
    const container = root.querySelector("#excluded-rows");
    container.textContent = "";
    const items = app.getData().calendar.excludedDates;
    if (!items.length) {
      container.appendChild(note("None added."));
      return;
    }
    items.forEach((item, index) => {
      const base = `calendar.excludedDates.${index}`;
      container.appendChild(el("div", { class: "excluded-row" },
        el("div", { class: "field-row" },
          field("date", `${base}.date`, "Date", { narrow: true }),
          field("text", `${base}.label`, "Reason", { hint: "For example: Spring break" })),
        actionButton("remove-excluded", "Remove", "btn-danger", {
          "data-index": String(index),
          "aria-label": `Remove no-class date ${index + 1}${item.label ? ` (${item.label})` : ""}`
        })));
    });
    populate(container);
  }

  function buildCalendarRows(openIndexes) {
    const container = root.querySelector("#calendar-rows");
    const keepOpen = openIndexes || new Set(
      Array.from(container.querySelectorAll("details.calendar-row[open]")).map((row) => Number(row.getAttribute("data-index"))));
    container.textContent = "";
    const rows = app.getData().calendar.entries;
    root.querySelector("#calendar-rows-heading").textContent = `Calendar rows (${rows.length})`;
    if (!rows.length) {
      container.appendChild(note("No rows yet. Choose the settings above and click Generate calendar."));
      return;
    }
    rows.forEach((row, index) => {
      const base = `calendar.entries.${index}`;
      container.appendChild(el("details", { class: `calendar-row${row.noClass ? " is-no-class" : ""}`, "data-index": String(index), open: keepOpen.has(index) },
        el("summary", { id: `calendar-summary-${index}` }, calendarRowLabel(row)),
        el("div", { class: "group-body" },
          row.manual
            ? field("date", `${base}.date`, "Date", { narrow: true, optionalLabel: true, hint: "Unscheduled rows can have any date, or none." })
            : null,
          field("text", `${base}.topic`, "Topic"),
          field("text", `${base}.preparation`, "Preparation/Reading", { optionalLabel: true }),
          field("text", `${base}.due`, "Assignment due", { optionalLabel: true }),
          field("text", `${base}.notes`, "Notes", { optionalLabel: true }),
          checkbox(`${base}.noClass`, "No class (holiday or closure)"),
          el("div", { class: "button-row" },
            actionButton("calendar-move", "Move topic earlier", null, { "data-index": String(index), "data-direction": "-1", disabled: index === 0 }),
            actionButton("calendar-move", "Move topic later", null, { "data-index": String(index), "data-direction": "1", disabled: index === rows.length - 1 })),
          el("div", { class: "button-row" },
            actionButton("calendar-shift", "Shift topics later from here", null, { "data-index": String(index) }),
            actionButton("calendar-remove", "Remove row", "btn-danger", { "data-index": String(index) })))));
    });
    populate(container);
  }

  function refreshCalendarSettings() {
    const data = app.getData();
    const groupElement = root.querySelector("#editor-calendar");
    groupElement.setAttribute("data-mode", data.calendar.mode === "weekly" ? "weekly" : "meetings");
    root.querySelector("#first-week-days").hidden = !data.calendar.useFirstWeekSchedule;
    const settings = SCTCC.calendar.resolveSettings(data);
    const check = SCTCC.calendar.checkSettings(settings);
    summaryBlock(root.querySelector("#calendar-settings-summary"), "", check.errors, check.warnings, "Fix before generating the calendar:");
  }

  function refreshCalendarLabels() {
    app.getData().calendar.entries.forEach((row, index) => {
      const summary = root.querySelector(`#calendar-summary-${index}`);
      if (summary) {
        summary.textContent = calendarRowLabel(row);
        summary.parentElement.classList.toggle("is-no-class", Boolean(row.noClass));
      }
    });
  }

  /* ---------- College academic calendar ---------- */

  function currentTerm() {
    const data = app.getData();
    return SCTCC.calendar.findTerm(app.academicCalendar(), data.course.term, data.course.year);
  }

  /* The calendar uses the course begin and end dates; show them beside the calendar settings. */
  function refreshCalendarDates() {
    const note = root && root.querySelector("#calendar-dates-note");
    if (!note) return;
    const course = app.getData().course;
    const fmt = (iso) => (iso ? SCTCC.util.formatDate(iso, "long") : "");
    note.textContent = course.startDate && course.endDate
      ? `The calendar runs from the course begin date (${fmt(course.startDate)}) to the course end date (${fmt(course.endDate)}). Change these under Credits, modality, and dates.`
      : "The calendar uses the course begin and end dates. Enter them under Credits, modality, and dates first.";
  }

  function refreshCollegeDates() {
    const box = root && root.querySelector("#college-dates");
    if (!box) return;
    box.textContent = "";
    const academic = app.academicCalendar();
    const course = app.getData().course;
    if (!academic) {
      box.appendChild(note("College dates are not available right now. Enter your dates from the SCTCC Academic Calendar."));
      return;
    }
    if (!course.term || !String(course.year).trim()) {
      box.appendChild(note("Choose the term and year under Course to fill in the college’s official dates."));
      return;
    }
    const term = currentTerm();
    if (!term) {
      box.appendChild(note(`The college calendar has no dates for ${course.term} ${course.year} yet. Enter your dates from the SCTCC Academic Calendar.`));
      return;
    }

    const span = (from, to) => (from && to ? `${util.formatDate(from)} – ${util.formatDate(to)}` : util.formatDate(from || to));
    const flag = academic.status === "sample"
      ? ["Sample dates: ", "not the college calendar. Check them against the official academic calendar."]
      : (academic.status !== "official" || !term.verified
        ? ["From the published academic calendar: ", "not yet confirmed by Records & Registration."]
        : null);
    box.appendChild(el("div", { class: "notice notice-info" },
      el("p", null, el("strong", null, `College dates for ${term.term} ${term.year}`)),
      flag ? el("p", { class: "sample-flag" }, el("strong", null, flag[0]), flag[1]) : null,
      el("dl", { class: "vendor-details" },
        el("dt", null, "Semester"), el("dd", null, span(term.startDate, term.endDate)),
        term.finalsStart ? [el("dt", null, "Final exam week"), el("dd", null, span(term.finalsStart, term.finalsEnd))] : null,
        term.lastDayToDrop ? [el("dt", null, "Last day to drop"), el("dd", null, util.formatDate(term.lastDayToDrop))] : null,
        term.lastDayToWithdraw ? [el("dt", null, "Last day to withdraw"), el("dd", null, util.formatDate(term.lastDayToWithdraw))] : null,
        !term.lastDayToDrop && !term.lastDayToWithdraw
          ? [el("dt", null, "Drop and withdraw"), el("dd", null, "Deadlines vary by course; use the dates for your course in eServices.")]
          : null,
        el("dt", null, "No-class dates"), el("dd", null, String(term.noClassDates.length))),
      term.lastDayToDrop || term.lastDayToWithdraw
        ? el("p", { class: "editor-note" }, "Drop and withdrawal dates are for full-semester courses. If your course runs on different dates, use the dates shown in eServices.")
        : null,
      el("div", { class: "button-row" }, actionButton("fill-college-dates", "Fill in these dates", "btn-primary", { id: "fill-college-dates" }))));

    const warnings = SCTCC.calendar.termWarnings(term, course);
    if (warnings.length) {
      box.appendChild(el("div", { class: "notice notice-warning" },
        el("p", null, el("strong", null, "Please check:")),
        el("ul", null, warnings.map((message) => el("li", null, message)))));
    }
  }

  function buildCalendar() {
    buildExcludedRows();
    buildCalendarRows(new Set());
    refreshCalendarSettings();
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
        field("url", `${base}.accessibilityUrl`, "Accessibility statement web address", {
          hint: "Required. Check the box below only if the vendor has no accessibility statement."
        }),
        checkbox(`${base}.noAccessibilityStatement`, "This tool has no accessibility statement"),
        field("url", `${base}.vpatUrl`, "VPAT web address", { optionalLabel: true, hint: "Use when there is no accessibility statement." }),
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

  /* ---------- Grading rows ---------- */

  function categoryLegend(index, name) {
    return `Category ${index + 1}${name ? `: ${name}` : ""}`;
  }

  function gradeLegend(index, label) {
    return `Grade ${index + 1}${label ? `: ${label}` : ""}`;
  }

  function rowName(prefix, index, name) {
    return String(name || "").trim() || `${prefix} ${index + 1}`;
  }

  function buildCategoryRows() {
    const container = root.querySelector("#category-rows");
    container.textContent = "";
    const categories = app.getData().grading.categories;
    if (!categories.length) {
      container.appendChild(note("No categories yet."));
      return;
    }
    categories.forEach((category, index) => {
      const base = `grading.categories.${index}`;
      const name = rowName("category", index, category.name);
      container.appendChild(el("fieldset", { class: "field-group category-row" },
        el("legend", { id: `category-legend-${index}` }, categoryLegend(index, category.name)),
        field("text", `${base}.name`, "Category name", { hint: "For example: Labs" }),
        el("div", { class: "field-row" },
          field("number", `${base}.count`, "Number of assignments", { narrow: true, step: "1" }),
          field("number", `${base}.pointsEach`, "Points each", { narrow: true, className: "points-only" }),
          field("number", `${base}.weight`, "Weight (%)", { narrow: true, className: "weighted-only" })),
        el("p", { class: "row-total points-only" },
          "Category total: ", el("output", { id: `category-total-${index}`, for: `${fieldId(`${base}.count`)} ${fieldId(`${base}.pointsEach`)}` }, "0"), " points"),
        field("text", `${base}.notes`, "Note shown under the category", { optionalLabel: true, hint: "For example: Taken during final exam week" }),
        el("div", { class: "button-row" },
          actionButton("move-category", "Move up", null, { "data-index": String(index), "data-direction": "-1", "aria-label": `Move up: ${name}`, disabled: index === 0 }),
          actionButton("move-category", "Move down", null, { "data-index": String(index), "data-direction": "1", "aria-label": `Move down: ${name}`, disabled: index === categories.length - 1 }),
          actionButton("remove-category", "Remove", "btn-danger", { "data-index": String(index), "aria-label": `Remove ${name}` }))));
    });
    populate(container);
  }

  function buildScaleRows() {
    const container = root.querySelector("#scale-rows");
    container.textContent = "";
    const scale = app.getData().grading.scale;
    if (!scale.length) {
      container.appendChild(note("No grades yet."));
      return;
    }
    scale.forEach((row, index) => {
      const base = `grading.scale.${index}`;
      const name = rowName("grade", index, row.label);
      container.appendChild(el("fieldset", { class: "field-group scale-row" },
        el("legend", { id: `grade-legend-${index}` }, gradeLegend(index, row.label)),
        el("div", { class: "field-row field-row-3" },
          field("text", `${base}.label`, "Grade", { narrow: true }),
          field("number", `${base}.minPercent`, "From (%)", { narrow: true }),
          field("number", `${base}.maxPercent`, "To (%)", { narrow: true })),
        el("p", { class: "row-total points-only" },
          "Points: ", el("output", { id: `grade-points-${index}` }, "—")),
        el("div", { class: "button-row" },
          actionButton("remove-grade", "Remove", "btn-danger", { "data-index": String(index), "aria-label": `Remove grade ${name}` }))));
    });
    populate(container);
  }

  function summaryBlock(container, label, errors, warnings, errorTitle) {
    container.textContent = "";
    if (label) container.appendChild(el("p", { class: "grading-total" }, label));
    if (errors.length) {
      container.appendChild(el("div", { class: "notice notice-error" },
        el("p", null, el("strong", null, errorTitle || (errors.length === 1 ? "Fix before printing:" : `Fix these ${errors.length} problems before printing:`))),
        el("ul", null, errors.map((message) => el("li", null, message)))));
    }
    if (warnings.length) {
      container.appendChild(el("div", { class: "notice notice-warning" },
        el("p", null, el("strong", null, "Please check:")),
        el("ul", null, warnings.map((message) => el("li", null, message)))));
    }
  }

  /* Update totals, point ranges, and messages without rebuilding the inputs. */
  function refreshGrading() {
    const grading = app.getData().grading;
    const method = grading.calculationMethod === "weighted" ? "weighted" : "points";
    root.querySelector("#editor-grading").setAttribute("data-method", method);

    grading.categories.forEach((category, index) => {
      const output = root.querySelector(`#category-total-${index}`);
      if (output) output.textContent = SCTCC.grading.formatNumber(SCTCC.grading.categoryTotal(category));
    });

    const summary = SCTCC.grading.summarizeCategories(grading);
    summaryBlock(root.querySelector("#category-summary"), summary.label, summary.errors, summary.warnings);

    const overrideWrap = root.querySelector("#weight-override-wrap");
    const weightsOff = method === "weighted" && summary.total !== 100;
    overrideWrap.hidden = !(weightsOff || grading.weightOverride);

    const ranges = SCTCC.grading.pointRanges(grading.scale, method === "points" ? summary.total : 0);
    grading.scale.forEach((row, index) => {
      const output = root.querySelector(`#grade-points-${index}`);
      if (!output) return;
      const range = ranges.get(index);
      output.textContent = range ? `${range.min}–${range.max}` : "—";
    });

    const scaleCheck = SCTCC.grading.validateScale(grading.scale);
    summaryBlock(root.querySelector("#scale-summary"), "", scaleCheck.errors, scaleCheck.warnings);
  }

  function buildGrading() {
    buildCategoryRows();
    buildScaleRows();
    refreshGrading();
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
      buildExtraRows();
      buildGrading();
      buildCalendar();
      refreshCollegeDates();
      refreshCalendarDates();
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

  function showMessages(kind, title, lines) {
    const box = root.querySelector("#data-messages");
    box.textContent = "";
    if (!title) return;
    box.appendChild(el("div", { class: `notice notice-${kind}` },
      el("p", null, el("strong", null, title)),
      lines && lines.length ? el("ul", null, lines.map((line) => el("li", null, line))) : null));
  }

  /* Open the editor at the field for a data path (used by "Go to field"). */
  const FOCUS_FALLBACK = {
    "grading.categories": "add-category",
    "grading.scale": "add-grade"
  };

  function focusField(path) {
    app.showEditor();
    const groupId = SCTCC.validation.groupForPath(path);
    if (groupId) root.querySelector(`#${groupId}`).open = true;
    const row = /^calendar\.entries\.(\d+)\./.exec(path);
    if (row) {
      const details = root.querySelector(`details.calendar-row[data-index="${row[1]}"]`);
      if (details) details.open = true;
    }
    let target = document.getElementById(fieldId(path))
      || root.querySelector(`[data-group="${path}"]`)
      || (FOCUS_FALLBACK[path] ? document.getElementById(FOCUS_FALLBACK[path]) : null);
    if (!target && groupId) target = root.querySelector(`#${groupId} > summary`);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  }

  function setFileStatus(fileName, unsaved) {
    const status = root && root.querySelector("#file-status");
    if (!status) return;
    if (!fileName) {
      status.textContent = unsaved ? "Unsaved changes — not saved to a file yet." : "New syllabus — not saved yet.";
    } else {
      status.textContent = unsaved ? `${fileName} — unsaved changes` : `${fileName} — all changes saved`;
    }
    status.classList.toggle("is-unsaved", Boolean(unsaved));
  }

  function describeSaveMethod() {
    const note = root.querySelector("#save-method-note");
    note.textContent = SCTCC.files.supportsFilePicker()
      ? "Save asks where to put the file the first time; after that, Save (or Ctrl+S) updates the same file. To use OneDrive, choose your OneDrive folder in the Save dialog."
      : "This browser saves by downloading the file to your Downloads folder. Move it to your own folder or OneDrive afterward. Chrome or Edge can save straight to a folder you choose.";
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
      if (path.startsWith("calendar.")) refreshCalendarSettings();
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
    const extraTitle = /^policies\.additionalSections\.(\d+)\.title$/.exec(path);
    if (extraTitle) {
      const legend = root.querySelector(`#extra-legend-${extraTitle[1]}`);
      if (legend) legend.textContent = extraLegend(Number(extraTitle[1]), value.trim());
    }
    const categoryName = /^grading\.categories\.(\d+)\.name$/.exec(path);
    if (categoryName) {
      const legend = root.querySelector(`#category-legend-${categoryName[1]}`);
      if (legend) legend.textContent = categoryLegend(Number(categoryName[1]), value);
    }
    const gradeLabel = /^grading\.scale\.(\d+)\.label$/.exec(path);
    if (gradeLabel) {
      const legend = root.querySelector(`#grade-legend-${gradeLabel[1]}`);
      if (legend) legend.textContent = gradeLegend(Number(gradeLabel[1]), value);
    }
    if (path.startsWith("grading.")) refreshGrading();
    if (/^course\.(term|year|startDate|endDate)$/.test(path)) refreshCollegeDates();
    if (/^course\.(startDate|endDate)$/.test(path)) refreshCalendarDates();
    if (path === "calendar.meetingsPerWeek") util.setPath(data, path, Number(value) || 0);
    if (path.startsWith("calendar.entries.")) {
      if (/\.(noClass|date)$/.test(path)) {
        SCTCC.calendar.renumber(data.calendar.entries, SCTCC.calendar.resolveSettings(data));
      }
      refreshCalendarLabels();
    } else if (path.startsWith("calendar.")) {
      refreshCalendarSettings();
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

  function openData(data, title, warnings, options) {
    app.replaceData(data, options);
    populate();
    showMessages(warnings && warnings.length ? "warning" : "info", title, warnings);
    announce(title);
  }

  /* Ask before throwing away unsaved work. */
  function okToDiscard(actionText) {
    if (!app.hasUnsavedChanges()) return true;
    return window.confirm(`You have unsaved changes. ${actionText} anyway?\n\nChoose Cancel, then Save, to keep your changes.`);
  }

  function finishOpen(read) {
    if (read.cancelled) return;
    if (!read.ok) {
      showMessages("error", "The file could not be opened.", [read.error]);
      announce("The file could not be opened.");
      return;
    }
    const result = SCTCC.validateSyllabusData(read.value, { currentContentVersion: app.contentVersion() });
    if (!result.ok) {
      showMessages("error", "The file could not be opened.", result.errors);
      announce("The file could not be opened.");
      return;
    }
    SCTCC.files.setCurrentFile(read.handle);
    openData(result.data, `Opened ${read.fileName}.`, result.warnings, { fileName: read.fileName });
  }

  async function handleOpen() {
    if (!okToDiscard("Open another file")) return;
    if (SCTCC.files.supportsFilePicker()) {
      finishOpen(await SCTCC.files.openWithPicker());
    } else {
      importInput.click();
    }
  }

  async function handleSave(saveAs) {
    if (app.hasUnsavedChanges() === false && !saveAs && SCTCC.files.hasCurrentFile()) {
      showMessages("info", "All changes are already saved.");
      announce("All changes are already saved.");
      return;
    }
    const data = app.getData();
    const result = saveAs
      ? await SCTCC.files.saveAs(data, app.contentVersion(), app.suggestedFileName())
      : await SCTCC.files.save(data, app.contentVersion(), app.suggestedFileName());
    if (result.cancelled) return;
    if (!result.ok) {
      showMessages("error", "Not saved.", [result.message]);
      announce("Not saved.");
      return;
    }
    app.markSaved(result.fileName);
    if (result.method === "download") {
      showMessages("info", `Downloaded ${result.fileName}.`,
        ["Move it from your Downloads folder to your own folder or OneDrive. To keep editing later, use Open… and choose that file."]);
      announce(`Downloaded ${result.fileName}.`);
    } else {
      showMessages("info", `Saved ${result.fileName}.`);
      announce(`Saved ${result.fileName}.`);
    }
  }

  function handleAction(action, button) {
    const data = app.getData();
    switch (action) {
      case "save":
        handleSave(false);
        break;

      case "save-as":
        handleSave(true);
        break;

      case "open":
        handleOpen();
        break;

      case "import-docx":
        if (!okToDiscard("Import a previous syllabus")) return;
        SCTCC.startScreen.chooseWordFile();
        break;

      case "start-over":
        if (!okToDiscard("Start over")) return;
        SCTCC.startScreen.show();
        break;

      case "add-extra": {
        data.policies.additionalSections.push({ title: "", text: "" });
        buildExtraRows();
        app.dataChanged();
        const index = data.policies.additionalSections.length - 1;
        root.querySelector(`#${fieldId(`policies.additionalSections.${index}.title`)}`).focus();
        announce(`Added section ${index + 1}.`);
        break;
      }

      case "remove-extra": {
        const index = Number(button.getAttribute("data-index"));
        const section = data.policies.additionalSections[index];
        if (section && (section.title.trim() || section.text.trim()) && !window.confirm(`Remove the section “${section.title.trim() || `section ${index + 1}`}”?`)) return;
        data.policies.additionalSections.splice(index, 1);
        buildExtraRows();
        app.dataChanged();
        root.querySelector("#add-extra").focus();
        announce("Section removed.");
        break;
      }

      case "move-extra": {
        const index = Number(button.getAttribute("data-index"));
        const direction = Number(button.getAttribute("data-direction"));
        const list = data.policies.additionalSections;
        const target = index + direction;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        buildExtraRows();
        app.dataChanged();
        const same = root.querySelector(`[data-action='move-extra'][data-index='${target}'][data-direction='${direction}']`);
        const other = root.querySelector(`[data-action='move-extra'][data-index='${target}'][data-direction='${-direction}']`);
        (same && !same.disabled ? same : other).focus();
        announce(`Moved to position ${target + 1} of ${list.length}.`);
        break;
      }

      case "new":
        if (!okToDiscard("Start a new syllabus")) return;
        SCTCC.files.setCurrentFile(null);
        openData(SCTCC.createEmptySyllabusData(), "Started a new, blank syllabus.");
        break;

      case "sample": {
        if (!okToDiscard("Load the sample course")) return;
        const result = SCTCC.validateSyllabusData(window.SCTCC_SAMPLE_DATA || {}, { newId: true });
        if (!result.ok) {
          showMessages("error", "The sample course could not be loaded.", result.errors);
          return;
        }
        SCTCC.files.setCurrentFile(null);
        openData(result.data, "Loaded the sample course. It is not saved unless you save it.", [], { dirty: true });
        break;
      }

      case "reset": {
        if (!window.confirm("Clear every field in this syllabus?\n\nYour saved file is not changed unless you save afterward.")) return;
        const blank = SCTCC.createEmptySyllabusData();
        blank.meta.id = data.meta.id;
        app.replaceData(blank, { fileName: "", dirty: false });
        SCTCC.files.setCurrentFile(null);
        populate();
        showMessages("info", "Cleared this syllabus. Your saved file was not changed.");
        announce("Cleared this syllabus.");
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

      case "add-category": {
        data.grading.categories.push({ name: "", count: 1, pointsEach: 0, weight: 0, notes: "" });
        buildCategoryRows();
        refreshGrading();
        app.dataChanged();
        const index = data.grading.categories.length - 1;
        root.querySelector(`#${fieldId(`grading.categories.${index}.name`)}`).focus();
        announce(`Added category ${index + 1}.`);
        break;
      }

      case "remove-category": {
        const index = Number(button.getAttribute("data-index"));
        const name = rowName("category", index, data.grading.categories[index] && data.grading.categories[index].name);
        if (data.grading.categories[index] && data.grading.categories[index].name.trim()
          && !window.confirm(`Remove the “${name}” category?`)) return;
        data.grading.categories.splice(index, 1);
        buildCategoryRows();
        refreshGrading();
        app.dataChanged();
        root.querySelector("#add-category").focus();
        announce(`Removed ${name}.`);
        break;
      }

      case "move-category": {
        const index = Number(button.getAttribute("data-index"));
        const direction = Number(button.getAttribute("data-direction"));
        const target = index + direction;
        const list = data.grading.categories;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        buildCategoryRows();
        refreshGrading();
        app.dataChanged();
        const name = rowName("category", target, list[target].name);
        const same = root.querySelector(`[data-action='move-category'][data-index='${target}'][data-direction='${direction}']`);
        const other = root.querySelector(`[data-action='move-category'][data-index='${target}'][data-direction='${-direction}']`);
        (same && !same.disabled ? same : other).focus();
        announce(`Moved ${name} to position ${target + 1} of ${list.length}.`);
        break;
      }

      case "add-grade": {
        data.grading.scale.push({ label: "", minPercent: 0, maxPercent: 0 });
        buildScaleRows();
        refreshGrading();
        app.dataChanged();
        const index = data.grading.scale.length - 1;
        root.querySelector(`#${fieldId(`grading.scale.${index}.label`)}`).focus();
        announce(`Added grade ${index + 1}.`);
        break;
      }

      case "remove-grade": {
        const index = Number(button.getAttribute("data-index"));
        const name = rowName("grade", index, data.grading.scale[index] && data.grading.scale[index].label);
        data.grading.scale.splice(index, 1);
        buildScaleRows();
        refreshGrading();
        app.dataChanged();
        root.querySelector("#add-grade").focus();
        announce(`Removed grade ${name}.`);
        break;
      }

      case "scale-default":
      case "scale-plusminus": {
        const plusMinus = action === "scale-plusminus";
        if (!window.confirm(`Replace your grading scale with ${plusMinus ? "the plus/minus sample" : "the default A–F scale"}?`)) return;
        data.grading.scale = plusMinus ? SCTCC.grading.plusMinusSampleScale() : SCTCC.createDefaultGradingScale();
        buildScaleRows();
        refreshGrading();
        app.dataChanged();
        button.focus();
        const message = plusMinus
          ? "Plus/minus sample scale added. These cutoffs are only a starting point; confirm them for your program."
          : "Grading scale reset to A–F.";
        root.querySelector("#scale-summary").prepend(el("p", { class: "notice notice-info" }, message));
        announce(message);
        break;
      }

      case "calendar-copy-course": {
        const course = data.course;
        if (course.meetingPattern.days.length) {
          data.calendar.meetingDays = course.meetingPattern.days.slice();
          data.calendar.meetingsPerWeek = Math.min(4, course.meetingPattern.days.length);
        }
        if (course.modality === "online") data.calendar.mode = "weekly";
        populate(root.querySelector("#editor-calendar"));
        refreshCalendarSettings();
        app.dataChanged();
        announce("Copied the course dates and meeting days into the calendar settings.");
        break;
      }

      case "run-check": {
        const result = app.runChecks();
        SCTCC.printCheck.renderFindings(root.querySelector("#check-results"), result, 3);
        announce(result.errors.length
          ? `${result.errors.length} problem${result.errors.length === 1 ? "" : "s"} to fix, ${result.warnings.length} to review.`
          : `Ready to print. ${result.warnings.length} item${result.warnings.length === 1 ? "" : "s"} to review.`);
        break;
      }

      case "fill-college-dates": {
        const term = currentTerm();
        if (!term) return;
        const course = data.course;
        const updates = {
          startDate: term.startDate,
          endDate: term.endDate,
          dropDate: term.lastDayToDrop,
          withdrawalDate: term.lastDayToWithdraw
        };
        const changes = Object.entries(updates).filter(([key, value]) => value && course[key] && course[key] !== value);
        if (changes.length && !window.confirm("Replace the dates you entered with the college dates for this term?")) return;
        Object.entries(updates).forEach(([key, value]) => { if (value) course[key] = value; });
        populate(root.querySelector("#editor-schedule"));
        refreshCollegeDates();
        refreshCalendarDates();
        refreshCalendarSettings();
        app.dataChanged();
        const fill = root.querySelector("#fill-college-dates");
        if (fill) fill.focus();
        announce(`Filled in the college dates for ${term.term} ${term.year}.`);
        break;
      }

      case "add-college-closures": {
        const term = currentTerm();
        const summary = root.querySelector("#calendar-settings-summary");
        if (!term) {
          const course = data.course;
          const message = course.term && course.year
            ? `The college calendar has no dates for ${course.term} ${course.year} yet.`
            : "Choose the term and year under Course first.";
          summary.prepend(el("p", { class: "notice notice-warning" }, message));
          announce(message);
          return;
        }
        const added = SCTCC.calendar.addTermClosures(data.calendar, term);
        buildExcludedRows();
        refreshCalendarSettings();
        app.dataChanged();
        const message = added
          ? `Added ${added} college no-class date${added === 1 ? "" : "s"} for ${term.term} ${term.year}.${data.calendar.entries.length ? " Generate the calendar again to update the rows." : ""}`
          : `The college no-class dates for ${term.term} ${term.year} are already listed.`;
        root.querySelector("#calendar-settings-summary").prepend(el("p", { class: "notice notice-info" }, message));
        root.querySelector("#add-college-closures").focus();
        announce(message);
        break;
      }

      case "add-excluded": {
        data.calendar.excludedDates.push({ date: "", label: "" });
        buildExcludedRows();
        app.dataChanged();
        const index = data.calendar.excludedDates.length - 1;
        root.querySelector(`#${fieldId(`calendar.excludedDates.${index}.date`)}`).focus();
        announce(`Added no-class date ${index + 1}.`);
        break;
      }

      case "remove-excluded": {
        const index = Number(button.getAttribute("data-index"));
        data.calendar.excludedDates.splice(index, 1);
        buildExcludedRows();
        refreshCalendarSettings();
        app.dataChanged();
        root.querySelector("#add-excluded").focus();
        announce("Removed the no-class date. Generate the calendar again to update the rows.");
        break;
      }

      case "calendar-generate": {
        const settingsCheck = SCTCC.calendar.checkSettings(SCTCC.calendar.resolveSettings(data));
        if (settingsCheck.errors.length) {
          refreshCalendarSettings();
          const box = root.querySelector("#calendar-settings-summary .notice");
          if (box) {
            box.setAttribute("tabindex", "-1");
            box.focus();
          }
          announce("The calendar was not generated. Fix the settings first.");
          return;
        }
        if (data.calendar.entries.length && !window.confirm("Generate the calendar again?\n\nTopics, readings, due items, and notes stay with their dates. Rows whose dates are no longer class days are kept as unscheduled rows if they have content.")) return;
        const result = SCTCC.calendar.generate(data);
        data.calendar.entries = result.entries;
        buildCalendarRows(new Set());
        refreshCalendarSettings();
        app.dataChanged();
        summaryBlock(root.querySelector("#calendar-settings-summary"), result.summary, [], result.warnings);
        root.querySelector("#calendar-rows-heading").focus();
        announce(result.summary);
        break;
      }

      case "calendar-add-row": {
        data.calendar.entries.push(SCTCC.calendar.blankRow({ manual: true }));
        SCTCC.calendar.renumber(data.calendar.entries, SCTCC.calendar.resolveSettings(data));
        const index = data.calendar.entries.length - 1;
        buildCalendarRows(new Set([index]));
        app.dataChanged();
        root.querySelector(`#${fieldId(`calendar.entries.${index}.date`)}`).focus();
        announce("Added an unscheduled row at the end of the calendar.");
        break;
      }

      case "calendar-move": {
        const index = Number(button.getAttribute("data-index"));
        const direction = Number(button.getAttribute("data-direction"));
        const target = index + direction;
        if (!SCTCC.calendar.swapContent(data.calendar.entries, index, target)) return;
        buildCalendarRows(new Set([target]));
        app.dataChanged();
        const same = root.querySelector(`[data-action='calendar-move'][data-index='${target}'][data-direction='${direction}']`);
        const other = root.querySelector(`[data-action='calendar-move'][data-index='${target}'][data-direction='${-direction}']`);
        (same && !same.disabled ? same : other).focus();
        announce(`Moved the topic to ${calendarRowLabel(data.calendar.entries[target])}.`);
        break;
      }

      case "calendar-shift": {
        const index = Number(button.getAttribute("data-index"));
        const result = SCTCC.calendar.shiftContentLater(data.calendar.entries, index);
        SCTCC.calendar.renumber(data.calendar.entries, SCTCC.calendar.resolveSettings(data));
        buildCalendarRows(new Set([index]));
        app.dataChanged();
        const again = root.querySelector(`[data-action='calendar-shift'][data-index='${index}']`);
        if (again) again.focus();
        announce(result.overflow
          ? "Topics shifted one class later. The last topic moved to a new unscheduled row at the end."
          : "Topics shifted one class later. This row is now empty.");
        break;
      }

      case "calendar-remove": {
        const index = Number(button.getAttribute("data-index"));
        const row = data.calendar.entries[index];
        if (SCTCC.calendar.hasContent(row) && !window.confirm(`Remove the row “${calendarRowLabel(row)}”?`)) return;
        data.calendar.entries.splice(index, 1);
        SCTCC.calendar.renumber(data.calendar.entries, SCTCC.calendar.resolveSettings(data));
        buildCalendarRows();
        app.dataChanged();
        const next = root.querySelector(`#calendar-summary-${Math.min(index, data.calendar.entries.length - 1)}`);
        (next || root.querySelector("#calendar-generate")).focus();
        announce("Removed the calendar row.");
        break;
      }

      case "calendar-clear": {
        if (!data.calendar.entries.length) return;
        if (!window.confirm("Remove every calendar row, including topics and notes?")) return;
        data.calendar.entries = [];
        buildCalendarRows(new Set());
        app.dataChanged();
        root.querySelector("#calendar-generate").focus();
        announce("Removed all calendar rows.");
        break;
      }

      case "calendar-export": {
        if (!data.calendar.entries.length) {
          announce("There are no calendar rows to export.");
          return;
        }
        SCTCC.files.exportText(SCTCC.calendar.toCsv(data), `${app.suggestedFileName().replace(/-Syllabus$/, "")}-Calendar.csv`,
          "Spreadsheet (CSV)", "text/csv", ".csv").then((result) => {
          if (result.ok) {
            showMessages("info", `Exported ${result.fileName}.`, ["It opens in Excel or Google Sheets."]);
            announce(`Exported ${result.fileName}.`);
          } else if (!result.cancelled) {
            showMessages("error", "The calendar was not exported.", [result.message]);
          }
        });
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
      checkGroup(),
      courseGroup(),
      instructorGroup(),
      scheduleGroup(),
      materialsGroup(),
      descriptionGroup(),
      policiesGroup(),
      vendorsGroup(),
      gradingGroup(),
      calendarGroup(),
      statusGroup()));

    updateSectionNumbers(); /* the preview may already be numbered */

    const form = root.querySelector("#syllabus-editor");
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("input", (event) => {
      if (event.target.type === "file" || event.target.id === "saved-list") return;
      handleInput(event);
    });
    form.addEventListener("change", (event) => {
      const target = event.target;
      if (target.id === "photo-upload") handlePhotoUpload(target);
      else if (target.id === "import-file") {
        SCTCC.files.readChosenFile(target.files && target.files[0]).then((read) => {
          importInput.value = "";
          finishOpen(read);
        });
      }
    });
    form.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go-path]");
      if (go) {
        focusField(go.getAttribute("data-go-path"));
        return;
      }
      const button = event.target.closest("[data-action]");
      if (button) handleAction(button.getAttribute("data-action"), button);
    });

    /* Ctrl+S / Cmd+S saves to the instructor's file instead of saving the web page. */
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
        if (document.body.getAttribute("data-mode") !== "instructor") return;
        event.preventDefault();
        handleSave(event.shiftKey);
      }
    });

    populate();
    describeSaveMethod();
    SCTCC.printCheck.setGoTo(focusField);
  }

  /* Used by the start screen and the toolbar. */
  function startBlank() {
    SCTCC.files.setCurrentFile(null);
    openData(SCTCC.createEmptySyllabusData(), "Started a new, blank syllabus.");
  }

  function loadSample() {
    const result = SCTCC.validateSyllabusData(window.SCTCC_SAMPLE_DATA || {}, { newId: true });
    if (!result.ok) {
      showMessages("error", "The sample course could not be loaded.", result.errors);
      return;
    }
    SCTCC.files.setCurrentFile(null);
    openData(result.data, "Loaded the sample course. It is not saved unless you save it.", [], { dirty: true });
  }

  function openImported(data, title, lines) {
    SCTCC.files.setCurrentFile(null);
    app.replaceData(data, { fileName: "", dirty: true });
    populate();
    showMessages("info", title, lines);
    const notice = root.querySelector("#data-messages .notice");
    root.querySelector("#editor-data").open = true;
    if (notice) {
      notice.setAttribute("tabindex", "-1");
      notice.scrollIntoView({ block: "start" });
      notice.focus({ preventScroll: true });
    }
    announce(title);
  }

  window.SCTCC.editor = Object.freeze({
    init,
    populate: () => populate(),
    setFileStatus,
    showMessages,
    focusField,
    refreshCollegeDates,
    save: (saveAs) => handleSave(Boolean(saveAs)),
    open: () => handleOpen(),
    okToDiscard,
    startBlank,
    loadSample,
    openImported
  });
})();
