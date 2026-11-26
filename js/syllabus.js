/*
 * SCTCC Syllabus Builder — page rendering
 *
 * Renders the syllabus from the structured data object plus the institutional
 * fragments loaded by content-loader.js. Instructor-entered text is always
 * inserted as text (textContent / text nodes), never as HTML.
 *
 * Phase 1: renders sample data, instructor/student preview, optional-section
 * toggles, and a basic Print to PDF button. Editing, autosave, validation,
 * the grading editor, and the calendar generator arrive in later phases.
 */
(function () {
  "use strict";

  const SCTCC = window.SCTCC;
  const config = SCTCC.config;
  const util = SCTCC.util;

  const state = {
    data: null,
    content: { manifest: null, sections: [], errors: [] },
    usingSampleData: false
  };

  /* Friendly names for missing-value markers. */
  const FIELD_LABELS = {
    "course.prefix": "Course prefix",
    "course.number": "Course number",
    "course.title": "Course title",
    "course.term": "Term",
    "course.year": "Year",
    "course.startDate": "Begin date",
    "course.endDate": "End date",
    "course.dropDate": "Last day to drop",
    "course.withdrawalDate": "Withdrawal date",
    "course.location": "Room number",
    "instructor.name": "Instructor name",
    "instructor.email": "Email address"
  };

  function describeField(field) {
    return FIELD_LABELS[field] || field.split(".").pop().replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }

  /* ---------- Small DOM helpers ---------- */

  function appendChildren(node, children) {
    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined || child === false || child === "") return;
      node.appendChild(typeof child === "string" || typeof child === "number"
        ? document.createTextNode(String(child))
        : child);
    });
    return node;
  }

  function el(tag, attributes, ...children) {
    const node = document.createElement(tag);
    Object.entries(attributes || {}).forEach(([name, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (name === "class") node.className = value;
      else node.setAttribute(name, value === true ? "" : String(value));
    });
    return appendChildren(node, children);
  }

  function missing(label) {
    return el("span", { class: "missing-value" }, `[${label} needed]`);
  }

  function valueOr(value, label) {
    const text = value === null || value === undefined ? "" : String(value).trim();
    return text ? text : missing(label);
  }

  /* Split free text into paragraphs on blank lines; single line breaks become <br>. */
  function textBlocks(text, missingLabel) {
    const value = typeof text === "string" ? text.trim() : "";
    if (!value) return missingLabel ? [el("p", null, missing(missingLabel))] : [];
    return value.split(/\n\s*\n/).map((paragraph) => {
      const p = el("p");
      paragraph.split(/\n/).forEach((line, index) => {
        if (index) p.appendChild(el("br"));
        p.appendChild(document.createTextNode(line));
      });
      return p;
    });
  }

  function listOf(items, ordered, missingLabel) {
    const values = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
    if (!values.length) return missingLabel ? el("p", null, missing(missingLabel)) : null;
    return el(ordered ? "ol" : "ul", null, values.map((value) => el("li", null, value)));
  }

  function isSafeUrl(value) {
    return typeof value === "string" && /^(https?:\/\/|\.{0,2}\/|assets\/)/i.test(value.trim());
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function majorSection(id, title, children) {
    const headingId = `${id}-heading`;
    return el("section", { id, class: "major-section", "aria-labelledby": headingId },
      el("h2", { id: headingId }, title),
      children,
      el("p", { class: "back-to-top screen-only" }, el("a", { href: "#top" }, "Back to top")));
  }

  function subsection(title, children, level, extraClass) {
    const headingLevel = level || 3;
    const id = `${slug(title)}-${headingLevel}`;
    return el("section", { class: `subsection${extraClass ? ` ${extraClass}` : ""}`, "aria-labelledby": id },
      el(`h${headingLevel}`, { id }, title),
      children);
  }

  function instructorNote(text) {
    if (!text) return null;
    return el("aside", { class: "instructor-note instructor-only", "aria-label": "Instructor note" },
      el("p", null, el("strong", null, "Instructor note: "), text));
  }

  /* ---------- Institutional fragments ---------- */

  function isOptionalEnabled(key) {
    return Boolean(state.data.optionalSections && state.data.optionalSections[key]);
  }

  function isSectionEnabled(definition) {
    if (definition.required && !config.allowRequiredSectionOverride) return true;
    if (definition.optionalKey) return isOptionalEnabled(definition.optionalKey);
    return definition.defaultEnabled !== false;
  }

  function resolveField(field, format) {
    const value = util.getPath(state.data, field);
    if (value === null || value === undefined || String(value).trim() === "") return "";
    if (format === "date") return util.formatDate(String(value), "long");
    if (format === "date-short") return util.formatDate(String(value), "short");
    return String(value);
  }

  function fragmentBlock(entry) {
    const definition = entry.definition;
    const wrapper = el("div", { class: "institutional-content", "data-section-id": definition.id });

    const reviewed = entry.meta["last-reviewed"] ? ` · reviewed ${entry.meta["last-reviewed"]}` : "";
    wrapper.appendChild(el("p", { class: "content-source instructor-only" },
      `College content · ${entry.meta.owner || definition.owner || "owner not set"}${reviewed}`));
    appendChildren(wrapper, [instructorNote(definition.instructorNote)]);

    if (entry.fragment) {
      const content = entry.fragment.cloneNode(true);
      const holder = el("div", { class: "fragment-body" });
      holder.appendChild(content);
      SCTCC.contentLoader.applyFieldTokens(holder, resolveField, describeField);
      wrapper.appendChild(holder);
    } else {
      wrapper.appendChild(el("p", { class: "notice notice-error instructor-only", role: "note" },
        el("strong", null, "Not loaded: "), entry.error || "Unknown problem."));
      wrapper.appendChild(el("p", { class: "student-only" },
        `${definition.title} information is temporarily unavailable. Please check D2L or contact your instructor.`));
    }
    return wrapper;
  }

  function placementBlocks(placement) {
    return state.content.sections
      .filter((entry) => entry.definition.placement === placement && isSectionEnabled(entry.definition))
      .map((entry) => (entry.definition.showTitle
        ? subsection(entry.definition.title, fragmentBlock(entry), 3, "institutional-section")
        : fragmentBlock(entry)));
  }

  /* ---------- Header ---------- */

  function courseIdentifier() {
    const course = state.data.course;
    return [course.prefix, course.number].filter(Boolean).join(" ").trim();
  }

  function renderHeader() {
    const course = state.data.course;
    const title = document.getElementById("syllabus-title");
    title.textContent = "";
    appendChildren(title, [
      valueOr(courseIdentifier(), "Course number"), ": ",
      valueOr(course.title, "Course name"), " Syllabus"
    ]);

    const term = document.getElementById("syllabus-term");
    term.textContent = "";
    appendChildren(term, [valueOr(course.term, "Term"), " ", valueOr(course.year, "Year")]);

    const logo = document.getElementById("college-logo");
    logo.src = config.logo.src;
    logo.alt = config.logo.isPlaceholder ? config.logo.alt : config.logo.officialAlt;
    logo.classList.toggle("is-placeholder", Boolean(config.logo.isPlaceholder));

    const slot = document.getElementById("slot-header");
    slot.textContent = "";
    appendChildren(slot, placementBlocks("header"));

    const id = courseIdentifier();
    document.title = `${id ? `${id} ` : ""}${course.title || "Course"} Syllabus | ${config.institutionShortName}`;
  }

  /* ---------- Instructor Information ---------- */

  function renderInstructorInformation() {
    const instructor = state.data.instructor;
    const children = [];

    if (isOptionalEnabled("instructorPhoto") && isSafeUrl(instructor.photoUrl)) {
      children.push(el("img", {
        class: "instructor-photo",
        src: instructor.photoUrl.trim(),
        alt: instructor.photoAlt || `Photo of ${instructor.name || "the instructor"}`,
        width: "160"
      }));
    }

    const nameLine = el("p", { class: "instructor-name" },
      el("strong", null, valueOr(instructor.name, "Instructor name")),
      instructor.credentials ? `, ${instructor.credentials}` : "");

    const email = instructor.email && instructor.email.trim()
      ? el("a", { href: `mailto:${instructor.email.trim()}` }, instructor.email.trim())
      : missing("Email address");

    const details = el("dl", { class: "contact-list" },
      el("dt", null, "Email"), el("dd", null, email),
      instructor.phone ? [el("dt", null, "Telephone"), el("dd", null, instructor.phone)] : null,
      el("dt", null, "Office"), el("dd", null, valueOr(instructor.office, "Office location")),
      el("dt", null, "Office hours"), el("dd", null, textBlocks(instructor.officeHours, "Office hours")));

    children.push(el("address", { class: "instructor-contact" }, nameLine, details));

    const contactSentence = [];
    if (instructor.preferredContactMethod) {
      contactSentence.push(`The best way to contact me is by ${instructor.preferredContactMethod}.`);
    }
    if (instructor.responseTime) contactSentence.push(instructor.responseTime);
    if (contactSentence.length) children.push(el("p", null, contactSentence.join(" ")));

    if (isOptionalEnabled("instructorBiography")) {
      children.push(subsection("Instructor Bio", textBlocks(instructor.biography, "Instructor bio")));
    }
    if (isOptionalEnabled("educationalPhilosophy")) {
      children.push(subsection("Educational Philosophy", textBlocks(instructor.philosophy, "Educational philosophy")));
    }
    return majorSection("instructor-information", "Instructor Information", children);
  }

  /* ---------- Course Information ---------- */

  function creditsLine() {
    const credits = state.data.course.credits || {};
    const total = Number(credits.total) || 0;
    if (!total) return missing("Credits");
    return `${total} ${total === 1 ? "credit" : "credits"}: Lecture – ${credits.lecture || 0}, Laboratory – ${credits.laboratory || 0}, SOE – ${credits.soe || 0}`;
  }

  function meetingSentence() {
    const course = state.data.course;
    const pattern = course.meetingPattern || {};
    if (course.modality === "online") {
      return ["This is an exclusively online course with no face-to-face meetings."];
    }
    if (course.modality !== "residential" && course.modality !== "hybrid") {
      return [missing("Course modality (residential, hybrid, or online)")];
    }
    const days = (pattern.days || []).map((day) => `${day}s`);
    const start = util.formatTime(pattern.startTime);
    const end = util.formatTime(pattern.endTime);
    return [
      `This is a ${course.modality} course which meets `,
      days.length ? util.joinWords(days) : missing("Meeting days"),
      " from ", start || missing("Start time"),
      " to ", end || missing("End time"),
      " in room ", valueOr(course.location, "Room number"), "."
    ];
  }

  function renderCourseInformation() {
    const course = state.data.course;
    const materials = state.data.materials;
    const definitionSection = state.content.sections.find((entry) => entry.definition.placement === "general-information");

    const general = subsection("General Information", [
      el("p", null, el("strong", null, valueOr(courseIdentifier(), "Course prefix & number"), ": ", valueOr(course.title, "Title"))),
      el("p", null, creditsLine()),
      el("p", null, meetingSentence()),
      textBlocks(course.modalityNote),
      el("p", null,
        "Begin date: ", el("strong", null, course.startDate ? util.formatDate(course.startDate) : missing("Begin date")),
        " – End date: ", el("strong", null, course.endDate ? util.formatDate(course.endDate) : missing("End date"))),
      definitionSection ? placementBlocks("general-information") : null,
      el("p", null, "Last day to drop and receive full refund is ",
        el("strong", null, course.dropDate ? util.formatDate(course.dropDate) : missing("Drop date")), "."),
      el("p", null, "Last day to withdraw with a grade of “W” is ",
        el("strong", null, course.withdrawalDate ? util.formatDate(course.withdrawalDate) : missing("Withdrawal date")), ".")
    ]);

    const login = isOptionalEnabled("courseLogin")
      ? subsection("Course Log-In", textBlocks(course.courseLogin, "Course log-in requirement"))
      : null;

    const materialsSection = subsection("Materials", [
      subsection("Required", listOf(materials.required, false, "Required materials"), 4),
      isOptionalEnabled("recommendedMaterials") && materials.recommended.length
        ? subsection("Recommended", listOf(materials.recommended, false), 4)
        : null,
      subsection("Required Technology", [
        placementBlocks("required-technology"),
        materials.requiredTechnologyAdditions.length
          ? [el("p", null, "This course also requires:"), listOf(materials.requiredTechnologyAdditions)]
          : null
      ], 4),
      subsection("Suggested Technical Skills", [
        listOf(materials.technicalSkills),
        placementBlocks("technical-skills")
      ], 4)
    ]);

    const prerequisites = course.prerequisites || { intro: "", items: [] };
    const prereqSection = subsection("Pre/Co-Requisites", [
      textBlocks(prerequisites.intro, prerequisites.items.length ? null : "Prerequisites (from the SCTCC Course Outline)"),
      listOf(prerequisites.items, true),
      course.corequisites ? textBlocks(`Corequisites: ${course.corequisites}`) : null
    ]);

    const outcomes = subsection("Course Description & Outcomes", [
      textBlocks(course.description, "Course description (from the SCTCC Course Outline)"),
      el("p", null, "Upon completion of this course, students will be able to:"),
      listOf(course.outcomes, true, "Course outcomes (from the SCTCC Course Outline)")
    ]);

    const mntc = isOptionalEnabled("mnTransferGoal")
      ? subsection("MN Transfer Curriculum Goal Area", el("p", null,
        "This course fulfills Goal ", el("strong", null, valueOr(course.mnTransferGoal, "Goal number")),
        " of the Minnesota General Education Transfer Curriculum."))
      : null;

    return majorSection("course-information", "Course Information",
      [general, login, materialsSection, prereqSection, outcomes, mntc]);
  }

  /* ---------- Policies ---------- */

  function renderCollegePolicies() {
    return majorSection("college-policies", "College Policies & Procedures", placementBlocks("college-policies"));
  }

  function renderCoursePolicies() {
    const policies = state.data.policies;
    return majorSection("course-policies", "Course Policies & Procedures", [
      subsection("Attendance", [
        placementBlocks("attendance"),
        textBlocks(policies.attendance, "Attendance policy")
      ]),
      subsection("Late Policy", textBlocks(policies.lateWork, "Late-work policy")),
      placementBlocks("course-policies")
    ]);
  }

  /* ---------- Grading ---------- */

  function categoryTotal(category) {
    return (Number(category.count) || 0) * (Number(category.pointsEach) || 0);
  }

  function formatPercent(value) {
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
  }

  function gradingTable() {
    const grading = state.data.grading;
    const categories = grading.categories || [];
    if (!categories.length) return el("p", null, missing("Assessment categories"));

    const wrap = (table) => el("div", { class: "table-wrap", role: "region", "aria-label": "Assessments table", tabindex: "0" }, table);

    if (grading.calculationMethod === "weighted") {
      const totalWeight = categories.reduce((sum, category) => sum + (Number(category.weight) || 0), 0);
      return wrap(el("table", { class: "data-table" },
        el("caption", null, "Assessments and percentage of final grade"),
        el("thead", null, el("tr", null,
          el("th", { scope: "col" }, "Assessment"),
          el("th", { scope: "col", class: "num" }, "Number"),
          el("th", { scope: "col", class: "num" }, "Percent of grade"))),
        el("tbody", null, categories.map((category) => el("tr", null,
          el("th", { scope: "row" }, category.name || missing("Category"), category.notes ? el("span", { class: "row-note" }, category.notes) : null),
          el("td", { class: "num" }, category.count ? String(category.count) : "—"),
          el("td", { class: "num" }, formatPercent(Number(category.weight) || 0))))),
        el("tfoot", null, el("tr", null,
          el("th", { scope: "row" }, "Total"),
          el("td", { class: "num" }, ""),
          el("td", { class: "num" }, formatPercent(totalWeight))))));
    }

    const courseTotal = categories.reduce((sum, category) => sum + categoryTotal(category), 0);
    return wrap(el("table", { class: "data-table" },
      el("caption", null, "Assessments, points, and percentage of final grade"),
      el("thead", null, el("tr", null,
        el("th", { scope: "col" }, "Assessment"),
        el("th", { scope: "col", class: "num" }, "Number"),
        el("th", { scope: "col", class: "num" }, "Points each"),
        el("th", { scope: "col", class: "num" }, "Total points"),
        el("th", { scope: "col", class: "num" }, "Percent of grade"))),
      el("tbody", null, categories.map((category) => {
        const total = categoryTotal(category);
        return el("tr", null,
          el("th", { scope: "row" }, category.name || missing("Category"), category.notes ? el("span", { class: "row-note" }, category.notes) : null),
          el("td", { class: "num" }, String(Number(category.count) || 0)),
          el("td", { class: "num" }, String(Number(category.pointsEach) || 0)),
          el("td", { class: "num" }, String(total)),
          el("td", { class: "num" }, courseTotal ? formatPercent((total / courseTotal) * 100) : "—"));
      })),
      el("tfoot", null, el("tr", null,
        el("th", { scope: "row" }, "Total Points & Percentage"),
        el("td", { class: "num" }, ""),
        el("td", { class: "num" }, ""),
        el("td", { class: "num" }, String(courseTotal)),
        el("td", { class: "num" }, courseTotal ? "100%" : "—")))));
  }

  function gradingScaleTable() {
    const grading = state.data.grading;
    const scale = [...(grading.scale || [])].sort((a, b) => (Number(b.minPercent) || 0) - (Number(a.minPercent) || 0));
    if (!scale.length) return el("p", null, missing("Grading scale"));

    const showPoints = grading.calculationMethod === "points";
    const courseTotal = showPoints
      ? (grading.categories || []).reduce((sum, category) => sum + categoryTotal(category), 0)
      : 0;
    const minPoints = scale.map((row) => Math.ceil((courseTotal * (Number(row.minPercent) || 0)) / 100));

    return el("div", { class: "table-wrap", role: "region", "aria-label": "Grading scale table", tabindex: "0" },
      el("table", { class: "data-table grading-scale" },
        el("caption", null, "Grading scale"),
        el("thead", null, el("tr", null,
          el("th", { scope: "col" }, "Grade"),
          el("th", { scope: "col", class: "num" }, "Percentage"),
          showPoints && courseTotal ? el("th", { scope: "col", class: "num" }, "Points") : null)),
        el("tbody", null, scale.map((row, index) => {
          const highPoints = index === 0 ? courseTotal : minPoints[index - 1] - 1;
          return el("tr", null,
            el("th", { scope: "row" }, row.label || missing("Grade label")),
            el("td", { class: "num" }, `${row.minPercent}–${row.maxPercent}%`),
            showPoints && courseTotal ? el("td", { class: "num" }, `${minPoints[index]}–${highPoints}`) : null);
        }))));
  }

  function renderGrading() {
    const grading = state.data.grading;
    const narrative = grading.gradesNarrative || {};
    return majorSection("grading", "Grading", [
      subsection("Assignments & Points", [textBlocks(grading.intro), gradingTable()]),
      subsection("Grading Scale", gradingScaleTable()),
      subsection("Grades", [
        textBlocks(narrative.postedWhere, "Where grades are posted"),
        textBlocks(narrative.turnaround, "Grading turnaround"),
        textBlocks(narrative.contact),
        textBlocks(narrative.additional)
      ]),
      isOptionalEnabled("timeCommitment")
        ? subsection("Time Commitment", textBlocks(grading.timeCommitment, "Time commitment"))
        : null
    ]);
  }

  /* ---------- Course Calendar ---------- */

  function renderCalendar() {
    const calendar = state.data.calendar;
    const entries = calendar.entries || [];
    const statement = textBlocks(calendar.locationStatement, entries.length ? null : "Statement of where the course schedule is located");

    const table = entries.length
      ? el("div", { class: "table-wrap", role: "region", "aria-label": "Course calendar table", tabindex: "0" },
        el("table", { class: "data-table calendar-table" },
          el("caption", null, "Course calendar"),
          el("thead", null, el("tr", null,
            ["Week", "Meeting", "Date", "Day", "Topic", "Preparation/Reading", "Assignment Due", "Notes"]
              .map((label) => el("th", { scope: "col" }, label)))),
          el("tbody", null, entries.map((entry) => el("tr", { class: entry.noClass ? "no-class" : null },
            el("td", null, entry.week ? String(entry.week) : ""),
            el("td", null, entry.meeting ? String(entry.meeting) : ""),
            el("th", { scope: "row" }, util.formatDate(entry.date, "short") || entry.date || ""),
            el("td", null, util.weekdayName(entry.date, true)),
            el("td", null, entry.noClass ? el("strong", null, "No Class") : (entry.topic || ""), entry.noClass && entry.topic ? ` – ${entry.topic}` : ""),
            el("td", null, entry.preparation || ""),
            el("td", null, entry.due || ""),
            el("td", null, entry.notes || ""))))))
      : null;

    return majorSection("course-calendar", "Course Calendar", [statement, table]);
  }

  /* ---------- Footer, TOC, status panel ---------- */

  function renderFooter() {
    const slot = document.getElementById("slot-footer");
    slot.textContent = "";
    appendChildren(slot, placementBlocks("footer"));
  }

  function renderTableOfContents() {
    const list = document.getElementById("toc-list");
    list.textContent = "";
    document.querySelectorAll("#main > section.major-section").forEach((section) => {
      const heading = section.querySelector("h2");
      list.appendChild(el("li", null, el("a", { href: `#${section.id}` }, heading.textContent)));
    });
  }

  function cssString(text) {
    return `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ")}"`;
  }

  /* Print footer text uses @page margin boxes (Chrome/Edge 131+). */
  function updatePrintFooter() {
    let style = document.getElementById("print-footer-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "print-footer-style";
      document.head.appendChild(style);
    }
    const course = state.data.course;
    const parts = [
      config.institutionName,
      `${courseIdentifier() || "Course"}${course.title ? `: ${course.title}` : ""} Syllabus`,
      [course.term, course.year].filter(Boolean).join(" "),
      `Version ${state.data.meta.syllabusVersion || "1.0"}`
    ].filter(Boolean);
    style.textContent = `@media print { @page { @bottom-left { content: ${cssString(parts.join(" · "))}; } } }`;
  }

  function renderStatusPanel() {
    const panel = document.getElementById("builder-status-body");
    panel.textContent = "";
    const manifest = state.content.manifest;

    if (state.usingSampleData) {
      panel.appendChild(el("p", { class: "notice notice-info" },
        el("strong", null, "Sample data: "),
        "This preview shows the sample course from examples/sample-course-data.js. The editing forms arrive in Phase 2."));
    }

    if (config.logo.isPlaceholder) {
      panel.appendChild(el("p", { class: "notice notice-warning" },
        el("strong", null, "Logo placeholder: "),
        "Replace it with the official SCTCC logo from Marketing (see the README)."));
    }

    if (manifest) {
      panel.appendChild(el("p", null,
        "College content version ", el("strong", null, manifest.contentVersion || "unknown"),
        ", last updated ", el("strong", null, manifest.lastUpdated || "unknown"),
        `. ${state.content.sections.filter((entry) => entry.fragment).length} of ${state.content.sections.length} sections loaded.`));
    }

    const errorBox = el("div", { class: "status-errors" });
    if (state.content.errors.length) {
      errorBox.appendChild(el("p", { class: "notice notice-error" },
        el("strong", null, "Content problems: "), `${state.content.errors.length} found.`));
      errorBox.appendChild(el("ul", null, state.content.errors.map((message) => el("li", null, message))));
    }
    panel.appendChild(errorBox);

    const toggles = el("fieldset", { class: "optional-toggles" }, el("legend", null, "Optional sections"));
    const labels = {
      instructorPhoto: "Instructor photograph",
      instructorBiography: "Instructor biography",
      educationalPhilosophy: "Educational philosophy",
      courseLogin: "Course log-in requirements",
      mnTransferGoal: "MN Transfer Curriculum goal area",
      turnitin: "Turnitin",
      academicIntegrityExamples: "Academic dishonesty examples",
      classEnvironment: "Class Environment",
      timeCommitment: "Time Commitment",
      recommendedMaterials: "Recommended Materials"
    };
    Object.entries(labels).forEach(([key, label]) => {
      const id = `optional-${key}`;
      const input = el("input", { type: "checkbox", id, "data-optional-key": key });
      input.checked = isOptionalEnabled(key);
      toggles.appendChild(el("div", { class: "checkbox-row" }, input, el("label", { for: id }, label)));
    });
    panel.appendChild(toggles);

    if (state.content.sections.length) {
      panel.appendChild(el("details", { class: "content-inventory" },
        el("summary", null, "College content files"),
        el("div", { class: "table-wrap", role: "region", "aria-label": "College content files", tabindex: "0" },
          el("table", { class: "data-table" },
            el("caption", null, "Institutional sections loaded from the repository"),
            el("thead", null, el("tr", null,
              ["Section", "File", "Owner", "Last reviewed", "Status"].map((label) => el("th", { scope: "col" }, label)))),
            el("tbody", null, state.content.sections.map((entry) => el("tr", null,
              el("th", { scope: "row" }, entry.definition.title || entry.definition.id),
              el("td", null, el("code", null, entry.definition.file)),
              el("td", null, entry.meta.owner || entry.definition.owner || ""),
              el("td", null, entry.meta["last-reviewed"] || ""),
              el("td", null, entry.fragment
                ? (isSectionEnabled(entry.definition) ? "Loaded" : "Loaded (turned off)")
                : el("strong", null, "Error")))))))));
    }
  }

  /* ---------- Rendering and modes ---------- */

  function render() {
    renderHeader();
    const main = document.getElementById("main");
    main.textContent = "";
    appendChildren(main, [
      renderInstructorInformation(),
      renderCourseInformation(),
      renderCollegePolicies(),
      renderCoursePolicies(),
      renderGrading(),
      renderCalendar()
    ]);
    renderFooter();
    renderTableOfContents();
    renderStatusPanel();
    updatePrintFooter();
    document.body.classList.toggle("print-link-urls", Boolean(config.printLinkUrls));
  }

  function announce(message) {
    const region = document.getElementById("live-status");
    region.textContent = "";
    window.setTimeout(() => { region.textContent = message; }, 50);
  }

  function setMode(mode) {
    const next = mode === "student" ? "student" : "instructor";
    document.body.setAttribute("data-mode", next);
    const button = document.getElementById("toggle-mode");
    button.setAttribute("aria-pressed", next === "student" ? "true" : "false");
    button.textContent = next === "student" ? "Back to instructor view" : "Student preview";
  }

  function suggestedFileName() {
    const course = state.data.course;
    const parts = [course.prefix, course.number, course.term, course.year, "Syllabus"]
      .map((part) => String(part || "").trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, ""))
      .filter(Boolean);
    return parts.join("-") || "Syllabus";
  }

  /* Phase 1 print: student view + suggested file name. Validation is added in Phase 5. */
  function printToPdf() {
    const previousMode = document.body.getAttribute("data-mode");
    const previousTitle = document.title;
    const restore = () => {
      document.title = previousTitle;
      setMode(previousMode);
    };
    document.title = suggestedFileName();
    setMode("student");
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  }

  function bindEvents() {
    document.getElementById("toggle-mode").addEventListener("click", () => {
      const next = document.body.getAttribute("data-mode") === "student" ? "instructor" : "student";
      setMode(next);
      announce(next === "student" ? "Showing the student view." : "Showing the instructor view.");
    });
    document.getElementById("print-pdf").addEventListener("click", printToPdf);
    document.getElementById("builder-status-body").addEventListener("change", (event) => {
      const key = event.target.getAttribute("data-optional-key");
      if (!key) return;
      state.data.optionalSections[key] = event.target.checked;
      render();
      const restored = document.getElementById(`optional-${key}`);
      if (restored) restored.focus();
      announce(`${event.target.labels[0] ? event.target.labels[0].textContent : "Section"} ${event.target.checked ? "shown" : "hidden"}.`);
    });
  }

  function loadInitialData() {
    const empty = SCTCC.createEmptySyllabusData();
    if (config.loadSampleData && window.SCTCC_SAMPLE_DATA) {
      state.usingSampleData = true;
      /* Merge sample over the empty model so every expected key exists. */
      const sample = JSON.parse(JSON.stringify(window.SCTCC_SAMPLE_DATA));
      return deepMerge(empty, sample);
    }
    return empty;
  }

  function deepMerge(base, override) {
    Object.keys(override).forEach((key) => {
      const value = override[key];
      if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
        deepMerge(base[key], value);
      } else {
        base[key] = value;
      }
    });
    return base;
  }

  async function init() {
    state.data = loadInitialData();
    setMode(config.mode);
    bindEvents();
    render(); /* render immediately with instructor data while content loads */
    state.content = await SCTCC.contentLoader.loadContent(config);
    render();
    document.body.classList.add("content-ready");
    announce(state.content.errors.length
      ? `Syllabus loaded with ${state.content.errors.length} content problem(s).`
      : "Syllabus loaded.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
