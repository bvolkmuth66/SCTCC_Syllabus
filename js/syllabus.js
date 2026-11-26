/*
 * SCTCC Syllabus Builder — page rendering and app controller
 *
 * Renders the syllabus from the structured data object plus the institutional
 * fragments loaded by content-loader.js. Instructor-entered text is always
 * inserted as text (textContent / text nodes), never as HTML.
 *
 * Also owns the syllabus data for the page: re-rendering after edits,
 * tracking unsaved changes, and printing to PDF. The builder never stores a
 * syllabus; instructors save files to their own computer or OneDrive.
 */
(function () {
  "use strict";

  const SCTCC = window.SCTCC;
  const config = SCTCC.config;
  const util = SCTCC.util;
  const { el, appendChildren, announce } = SCTCC.dom;

  const state = {
    data: null,
    content: { manifest: null, sections: [], errors: [] },
    renderTimer: null,
    printSnapshot: null,
    dirty: false,
    fileName: ""
  };

  /* Friendly names for missing-value markers in college content tokens. */
  const FIELD_LABELS = {
    "course.withdrawalDate": "Withdrawal date",
    "course.dropDate": "Drop date",
    "course.startDate": "Begin date",
    "course.endDate": "End date"
  };

  function describeField(field) {
    return FIELD_LABELS[field] || field.split(".").pop().replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }

  /* ---------- Small rendering helpers ---------- */

  function missing(label) {
    return el("span", { class: "missing-value" }, `[${label} needed]`);
  }

  function valueOr(value, label) {
    const text = value === null || value === undefined ? "" : String(value).trim();
    return text ? text : missing(label);
  }

  /* Web addresses in instructor text become working links (https:// and http:// only). */
  const URL_IN_TEXT = /(https?:\/\/[^\s<>()"]+[^\s<>()".,;:!?'])/g;

  function appendLinkedText(parent, line) {
    let last = 0;
    line.replace(URL_IN_TEXT, (url, _match, offset) => {
      if (offset > last) parent.appendChild(document.createTextNode(line.slice(last, offset)));
      parent.appendChild(el("a", { href: url }, url));
      last = offset + url.length;
      return url;
    });
    if (last < line.length) parent.appendChild(document.createTextNode(line.slice(last)));
  }

  /* Split free text into paragraphs on blank lines; single line breaks become <br>. */
  function textBlocks(text, missingLabel) {
    const value = typeof text === "string" ? text.trim() : "";
    if (!value) return missingLabel ? [el("p", null, missing(missingLabel))] : [];
    return value.split(/\n\s*\n/).map((paragraph) => {
      const p = el("p");
      paragraph.split(/\n/).forEach((line, index) => {
        if (index) p.appendChild(el("br"));
        appendLinkedText(p, line);
      });
      return p;
    });
  }

  function listOf(items, ordered, missingLabel) {
    const values = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
    if (!values.length) return missingLabel ? el("p", null, missing(missingLabel)) : null;
    return el(ordered ? "ol" : "ul", null, values.map((value) => el("li", null, value)));
  }

  function isWebUrl(value) {
    return typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim());
  }

  function isImageData(value) {
    return typeof value === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value);
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
    return String(value).trim();
  }

  /* Instructor-written blocks that a manifest entry can append after its college text. */
  const INSTRUCTOR_BLOCKS = {
    vendors: renderVendors
  };

  function fragmentBlock(entry) {
    const definition = entry.definition;
    const overrideText = definition.overrideField ? resolveField(definition.overrideField) : "";

    if (overrideText) {
      return el("div", { class: "instructor-content", "data-section-id": definition.id },
        el("p", { class: "content-source instructor-only" }, "Your text (replaces the college sample)"),
        textBlocks(overrideText));
    }

    const wrapper = el("div", { class: "institutional-content", "data-section-id": definition.id });
    const reviewed = entry.meta["last-reviewed"] ? ` · reviewed ${entry.meta["last-reviewed"]}` : "";
    wrapper.appendChild(el("p", { class: "content-source instructor-only" },
      `College content · ${entry.meta.owner || definition.owner || "owner not set"}${reviewed}`));
    appendChildren(wrapper, [instructorNote(definition.instructorNote)]);

    if (entry.fragment) {
      const holder = el("div", { class: "fragment-body" });
      holder.appendChild(entry.fragment.cloneNode(true));
      SCTCC.contentLoader.applyFieldTokens(holder, resolveField, describeField);
      wrapper.appendChild(holder);
    } else {
      wrapper.appendChild(el("p", { class: "notice notice-error instructor-only", role: "note" },
        el("strong", null, "Not loaded: "), entry.error || "Unknown problem."));
      wrapper.appendChild(el("p", { class: "student-only" },
        `${definition.title} information is temporarily unavailable. Please check D2L or contact your instructor.`));
    }

    const extra = definition.appendInstructorBlock && INSTRUCTOR_BLOCKS[definition.appendInstructorBlock];
    if (!extra) return wrapper;
    return [wrapper, extra()];
  }

  /* Instructor-written sections that a manifest entry can place right after itself. */
  const FOLLOWING_SECTIONS = {
    programDiversity: () => {
      const text = String(state.data.policies.programDiversity || "").trim();
      if (!isOptionalEnabled("programDiversity") || !text) return null;
      return subsection("Program Diversity Statement",
        el("div", { class: "instructor-content" },
          el("p", { class: "content-source instructor-only" }, "Your program’s statement"),
          textBlocks(text)), 3, "instructor-section");
    }
  };

  function placementBlocks(placement) {
    return state.content.sections
      .filter((entry) => entry.definition.placement === placement && isSectionEnabled(entry.definition))
      .flatMap((entry) => {
        const block = entry.definition.showTitle
          ? subsection(entry.definition.title, fragmentBlock(entry), 3, "institutional-section")
          : fragmentBlock(entry);
        const follow = FOLLOWING_SECTIONS[entry.definition.followWith];
        return follow ? [block, follow()] : [block];
      });
  }

  /* ---------- Header ---------- */

  function courseIdentifier() {
    const course = state.data.course;
    return [course.prefix, course.number].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
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
    if (!state.printSnapshot) {
      document.title = `${id ? `${id} ` : ""}${course.title || "Course"} Syllabus | ${config.institutionShortName}`;
    }
  }

  /* ---------- Instructor Information ---------- */

  function photoSource() {
    const instructor = state.data.instructor;
    if (isImageData(instructor.photoData)) return instructor.photoData;
    if (isWebUrl(instructor.photoUrl)) return instructor.photoUrl.trim();
    return "";
  }

  function renderInstructorInformation() {
    const instructor = state.data.instructor;
    const children = [];

    const photo = isOptionalEnabled("instructorPhoto") ? photoSource() : "";
    if (photo) {
      children.push(el("img", {
        class: "instructor-photo",
        src: photo,
        alt: instructor.photoAlt.trim() || `Photo of ${instructor.name.trim() || "the instructor"}`,
        width: "160"
      }));
    } else if (isOptionalEnabled("instructorPhoto")) {
      children.push(el("p", { class: "instructor-only" }, missing("Photo (upload one or turn off “Include my photo”)")));
    }

    const nameLine = el("p", { class: "instructor-name" },
      el("strong", null, valueOr(instructor.name, "Instructor name")),
      instructor.credentials.trim() ? `, ${instructor.credentials.trim()}` : "");

    const emailText = instructor.email.trim();
    const email = emailText
      ? el("a", { href: `mailto:${emailText}` }, emailText)
      : missing("Email address");

    const details = el("dl", { class: "contact-list" },
      el("dt", null, "Email"), el("dd", null, email),
      instructor.phone.trim() ? [el("dt", null, "Telephone"), el("dd", null, instructor.phone.trim())] : null,
      el("dt", null, "Office"), el("dd", null, valueOr(instructor.office, "Office location")),
      el("dt", null, "Office hours"), el("dd", null, textBlocks(instructor.officeHours, "Office hours")));

    children.push(el("address", { class: "instructor-contact" }, nameLine, details));

    const contactSentence = [];
    if (instructor.preferredContactMethod.trim()) {
      contactSentence.push(`The best way to contact me is by ${instructor.preferredContactMethod.trim().replace(/\.$/, "")}.`);
    }
    if (instructor.responseTime.trim()) contactSentence.push(instructor.responseTime.trim());
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
      return [missing("Course modality")];
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

  function dateOrMissing(value, label) {
    return value ? util.formatDate(value) || missing(label) : missing(label);
  }

  function renderCourseInformation() {
    const course = state.data.course;
    const materials = state.data.materials;

    const general = subsection("General Information", [
      el("p", null, el("strong", null, valueOr(courseIdentifier(), "Course prefix & number"), ": ", valueOr(course.title, "Title"))),
      el("p", null, creditsLine()),
      el("p", null, meetingSentence()),
      textBlocks(course.modalityNote),
      el("p", null,
        "Begin date: ", el("strong", null, dateOrMissing(course.startDate, "Begin date")),
        " – End date: ", el("strong", null, dateOrMissing(course.endDate, "End date"))),
      placementBlocks("general-information"),
      el("p", null, "Last day to drop and receive full refund is ",
        el("strong", null, dateOrMissing(course.dropDate, "Drop date")), "."),
      el("p", null, "Last day to withdraw with a grade of “W” is ",
        el("strong", null, dateOrMissing(course.withdrawalDate, "Withdrawal date")), ".")
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
    const hasPrereqs = prerequisites.intro.trim() || prerequisites.items.length;
    const prereqSection = subsection("Pre/Co-Requisites", [
      hasPrereqs ? textBlocks(prerequisites.intro) : el("p", null, missing("Prerequisites (from the SCTCC Course Outline)")),
      listOf(prerequisites.items, true),
      course.corequisites.trim() ? textBlocks(`Corequisites: ${course.corequisites.trim()}`) : null
    ]);

    const outcomes = subsection("Course Description & Outcomes", [
      textBlocks(course.description, "Course description (from the SCTCC Course Outline)"),
      subsection("Student Learning Outcomes", [
        el("p", null, "Upon completion of this course, students will be able to:"),
        listOf(course.outcomes, false, "Course outcomes (from the SCTCC Course Outline)")
      ], 4)
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
      (policies.additionalSections || [])
        .filter((section) => section.title.trim() || section.text.trim())
        .map((section, index) => el("section", { class: "subsection instructor-section", "aria-labelledby": `extra-section-${index}` },
          el("h3", { id: `extra-section-${index}` }, section.title.trim() || missing("Section title")),
          textBlocks(section.text, "Section text"))),
      placementBlocks("course-policies")
    ]);
  }

  /* Course tools, shown after the college Accessibility & Data Privacy text. */
  function renderVendors() {
    const vendors = (state.data.vendors || []).filter((vendor) => vendor.name.trim());
    if (!vendors.length) return null;

    const linkOr = (url, text, fallback) => (isWebUrl(url) ? el("a", { href: url.trim() }, text) : fallback);
    const withoutPolicy = vendors
      .filter((vendor) => !isWebUrl(vendor.accessibilityUrl) && !isWebUrl(vendor.vpatUrl))
      .map((vendor) => vendor.name.trim());

    return el("div", { class: "instructor-content vendor-list" },
      el("p", { class: "content-source instructor-only" }, "Your course tools"),
      el("p", null, "This course also uses the following tools:"),
      vendors.map((vendor) => {
        const name = vendor.name.trim();
        const account = vendor.accountRequired === "yes" ? "Yes" : (vendor.accountRequired === "no" ? "No" : "");
        return el("section", { class: "vendor", "aria-labelledby": `vendor-${slug(name)}` },
          el("h4", { id: `vendor-${slug(name)}` }, name),
          el("dl", { class: "vendor-details" },
            vendor.purpose.trim() ? [el("dt", null, "Purpose in this course"), el("dd", null, vendor.purpose.trim())] : null,
            el("dt", null, "Accessibility"),
            el("dd", null,
              linkOr(vendor.accessibilityUrl, `${name} accessibility statement`,
                linkOr(vendor.vpatUrl, `${name} VPAT (Voluntary Product Accessibility Template)`,
                  "No accessibility statement or VPAT is available for this tool."))),
            isWebUrl(vendor.accessibilityUrl) && isWebUrl(vendor.vpatUrl)
              ? [el("dt", null, "VPAT"), el("dd", null, el("a", { href: vendor.vpatUrl.trim() }, `${name} VPAT`))]
              : null,
            el("dt", null, "Data privacy"),
            el("dd", null, linkOr(vendor.privacyUrl, `${name} privacy policy`, "No data privacy policy was found for this tool.")),
            account ? [el("dt", null, "Student account required"), el("dd", null, account)] : null,
            vendor.dataCollected.trim() ? [el("dt", null, "Student data collected"), el("dd", null, vendor.dataCollected.trim())] : null,
            vendor.alternativeAccess.trim() ? [el("dt", null, "Alternative access"), el("dd", null, vendor.alternativeAccess.trim())] : null,
            isWebUrl(vendor.supportUrl) ? [el("dt", null, "Technical support"), el("dd", null, el("a", { href: vendor.supportUrl.trim() }, `${name} support`))] : null));
      }),
      withoutPolicy.length
        ? el("p", null, `Sites without Accessibility Policies or Voluntary Product Accessibility Templates (VPATs) used in this course include ${util.joinWords(withoutPolicy)}.`)
        : null);
  }

  /* ---------- Grading ---------- */

  const grading = SCTCC.grading;

  function formatPercent(value) {
    return `${grading.formatNumber(value)}%`;
  }

  function tableWrap(label, table) {
    return el("div", { class: "table-wrap", role: "region", "aria-label": label, tabindex: "0" }, table);
  }

  function categoryHeader(category) {
    return el("th", { scope: "row" }, category.name || missing("Category"),
      category.notes ? el("span", { class: "row-note" }, category.notes) : null);
  }

  /* Instructor-only list of grading problems, shown under the tables in the preview. */
  function gradingNotice(errors, warnings) {
    if (!errors.length && !warnings.length) return null;
    return el("div", { class: `notice ${errors.length ? "notice-error" : "notice-warning"} instructor-only` },
      el("p", null, el("strong", null, errors.length ? "Grading problems to fix before printing:" : "Grading items to check:")),
      el("ul", null, [...errors, ...warnings].map((message) => el("li", null, message))));
  }

  function gradingTable() {
    const data = state.data.grading;
    const categories = data.categories || [];
    if (!categories.length) return el("p", null, missing("Assessment categories"));

    if (data.calculationMethod === "weighted") {
      const showCount = categories.some((category) => Number(category.count) > 0);
      const totalWeight = grading.weightTotal(categories);
      return tableWrap("Assessments table", el("table", { class: "data-table" },
        el("caption", null, "Assessments and percentage of final grade"),
        el("thead", null, el("tr", null,
          el("th", { scope: "col" }, "Assessment"),
          showCount ? el("th", { scope: "col", class: "num" }, "Number") : null,
          el("th", { scope: "col", class: "num" }, "Percent of grade"))),
        el("tbody", null, categories.map((category) => el("tr", null,
          categoryHeader(category),
          showCount ? el("td", { class: "num" }, Number(category.count) > 0 ? String(category.count) : "—") : null,
          el("td", { class: "num" }, formatPercent(Number(category.weight) || 0))))),
        el("tfoot", null, el("tr", null,
          el("th", { scope: "row" }, "Total"),
          showCount ? el("td", { class: "num" }, "") : null,
          el("td", { class: "num" }, formatPercent(totalWeight))))));
    }

    const courseTotal = grading.pointsTotal(categories);
    return tableWrap("Assessments table", el("table", { class: "data-table" },
      el("caption", null, "Assessments, points, and percentage of final grade"),
      el("thead", null, el("tr", null,
        el("th", { scope: "col" }, "Assessment"),
        el("th", { scope: "col", class: "num" }, "Number"),
        el("th", { scope: "col", class: "num" }, "Points each"),
        el("th", { scope: "col", class: "num" }, "Total points"),
        el("th", { scope: "col", class: "num" }, "Percent of grade"))),
      el("tbody", null, categories.map((category) => {
        const total = grading.categoryTotal(category);
        return el("tr", null,
          categoryHeader(category),
          el("td", { class: "num" }, grading.formatNumber(Number(category.count) || 0)),
          el("td", { class: "num" }, grading.formatNumber(Number(category.pointsEach) || 0)),
          el("td", { class: "num" }, grading.formatNumber(total)),
          el("td", { class: "num" }, courseTotal ? formatPercent((total / courseTotal) * 100) : "—"));
      })),
      el("tfoot", null, el("tr", null,
        el("th", { scope: "row" }, "Total Points & Percentage"),
        el("td", { class: "num" }, ""),
        el("td", { class: "num" }, ""),
        el("td", { class: "num" }, grading.formatNumber(courseTotal)),
        el("td", { class: "num" }, courseTotal ? "100%" : "—")))));
  }

  function gradingScaleTable() {
    const data = state.data.grading;
    const scale = data.scale || [];
    if (!scale.length) return el("p", null, missing("Grading scale"));

    const courseTotal = data.calculationMethod === "points" ? grading.pointsTotal(data.categories) : 0;
    const ranges = grading.pointRanges(scale, courseTotal);
    const showPoints = ranges.size > 0;

    return tableWrap("Grading scale table", el("table", { class: "data-table grading-scale" },
      el("caption", null, "Grading scale"),
      el("thead", null, el("tr", null,
        el("th", { scope: "col" }, "Grade"),
        el("th", { scope: "col", class: "num" }, "Percentage"),
        showPoints ? el("th", { scope: "col", class: "num" }, "Points") : null)),
      el("tbody", null, grading.sortedScale(scale).map(({ row, index }) => {
        const range = ranges.get(index);
        return el("tr", null,
          el("th", { scope: "row" }, String(row.label || "").trim() || missing("Grade label")),
          el("td", { class: "num" }, `${grading.formatNumber(Number(row.minPercent) || 0)}–${grading.formatNumber(Number(row.maxPercent) || 0)}%`),
          showPoints ? el("td", { class: "num" }, range ? `${range.min}–${range.max}` : "—") : null);
      }))));
  }

  function renderGrading() {
    const data = state.data.grading;
    const narrative = data.gradesNarrative || {};
    const check = grading.checkGrading(data);
    return majorSection("grading", "Grading", [
      subsection("Assignments & Points", [textBlocks(data.intro), gradingTable()]),
      subsection("Grading Scale", gradingScaleTable()),
      gradingNotice(check.errors, check.warnings),
      subsection("Grades", [
        textBlocks(narrative.postedWhere, "Where grades are posted"),
        textBlocks(narrative.turnaround, "Grading turnaround"),
        textBlocks(narrative.contact),
        textBlocks(narrative.additional)
      ]),
      isOptionalEnabled("timeCommitment")
        ? subsection("Time Commitment", textBlocks(data.timeCommitment, "Time commitment"))
        : null
    ]);
  }

  /* ---------- Course Calendar ---------- */

  function weekCell(entry) {
    if (!entry.week) return "";
    return entry.isFinals ? `${entry.week} (Finals)` : String(entry.week);
  }

  function topicCell(entry) {
    if (!entry.noClass) return entry.topic || "";
    return [el("strong", null, "No Class"), entry.topic ? ` – ${entry.topic}` : ""];
  }

  function renderCalendar() {
    const calendar = state.data.calendar;
    const entries = calendar.entries || [];
    const weekly = calendar.mode === "weekly";
    const statement = textBlocks(calendar.locationStatement, entries.length ? null : "Statement of where the course schedule is located");
    if (!entries.length) return majorSection("course-calendar", "Course Calendar", [statement]);

    const header = weekly
      ? ["Week", "Dates", "Topic", "Preparation/Reading", "Assignment Due", "Notes"]
      : ["Week", "Meeting", "Date", "Day", "Topic", "Preparation/Reading", "Assignment Due", "Notes"];

    const rows = entries.map((entry) => {
      const date = util.formatDate(entry.date, "short");
      const cells = weekly
        ? [
          el("td", null, weekCell(entry)),
          el("th", { scope: "row" }, date ? `${date}${entry.weekEnd ? `–${util.formatDate(entry.weekEnd, "short")}` : ""}` : "Unscheduled")
        ]
        : [
          el("td", null, weekCell(entry)),
          el("td", null, entry.meeting ? String(entry.meeting) : ""),
          el("th", { scope: "row" }, date || "Unscheduled"),
          el("td", null, util.weekdayName(entry.date, true))
        ];
      return el("tr", { class: entry.noClass ? "no-class" : null },
        cells,
        el("td", null, topicCell(entry)),
        el("td", null, entry.preparation || ""),
        el("td", null, entry.due || ""),
        el("td", null, entry.notes || ""));
    });

    const table = tableWrap("Course calendar table", el("table", { class: `data-table calendar-table${weekly ? " calendar-weekly" : ""}` },
      el("caption", null, weekly ? "Course calendar by week" : "Course calendar"),
      el("thead", null, el("tr", null, header.map((label) => el("th", { scope: "col" }, label)))),
      el("tbody", null, rows)));

    return majorSection("course-calendar", "Course Calendar", [statement, table]);
  }

  /* ---------- Footer, TOC, status panel ---------- */

  function renderFooter() {
    const slot = document.getElementById("slot-footer");
    slot.textContent = "";
    appendChildren(slot, placementBlocks("footer"));
  }

  /*
   * Numbers the major sections (1, 2, 3 …) and their subsections (1.1, 1.2 …) so
   * instructors and students can refer to a part of the syllabus by number.
   * Numbers follow whatever sections are turned on, so they never skip.
   */
  function numberSections(main) {
    main.querySelectorAll(":scope > section.major-section").forEach((section, index) => {
      const major = index + 1;
      const heading = section.querySelector("h2");
      heading.prepend(el("span", { class: "section-number" }, `${major}. `));
      section.querySelectorAll("h3").forEach((subheading, subIndex) => {
        subheading.prepend(el("span", { class: "section-number" }, `${major}.${subIndex + 1} `));
      });
    });
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
      `${courseIdentifier() || "Course"}${course.title.trim() ? `: ${course.title.trim()}` : ""} Syllabus`,
      [course.term, course.year].map((part) => String(part || "").trim()).filter(Boolean).join(" "),
      `Version ${state.data.meta.syllabusVersion.trim() || "1.0"}`
    ].filter(Boolean);
    style.textContent = `@media print { @page { @bottom-left { content: ${cssString(parts.join(" · "))}; } } }`;
  }

  function renderStatusPanel() {
    const panel = document.getElementById("builder-status-body");
    if (!panel) return;
    panel.textContent = "";
    const manifest = state.content.manifest;

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

    const academic = state.content.academicCalendar;
    if (academic) {
      const terms = academic.terms.map((term) => `${term.term} ${term.year}`).join(", ") || "none";
      const notes = {
        official: ["", academic.lastReviewed ? ` Last reviewed ${academic.lastReviewed}.` : ""],
        published: ["Academic calendar: ", " Copied from the published academic calendar; not yet confirmed by Records & Registration."],
        sample: ["Sample academic calendar: ", " These dates are samples until Records & Registration replaces them with the official calendar."]
      }[academic.status];
      panel.appendChild(el("p", { class: academic.status === "official" ? null : "notice notice-warning" },
        notes[0] ? el("strong", null, notes[0]) : null,
        `College dates are available for: ${terms}.`,
        notes[1]));
    }

    if (state.content.errors.length) {
      panel.appendChild(el("div", { class: "notice notice-error" },
        el("p", null, el("strong", null, "Content problems: "), `${state.content.errors.length} found.`),
        el("ul", null, state.content.errors.map((message) => el("li", null, message)))));
    }

    if (state.content.sections.length) {
      panel.appendChild(tableWrap("College content files", el("table", { class: "data-table compact-table" },
        el("caption", null, "College sections loaded from the repository"),
        el("thead", null, el("tr", null,
          ["Section", "Owner", "Reviewed", "Status"].map((label) => el("th", { scope: "col" }, label)))),
        el("tbody", null, state.content.sections.map((entry) => el("tr", null,
          el("th", { scope: "row" }, entry.definition.title || entry.definition.id),
          el("td", null, entry.meta.owner || entry.definition.owner || ""),
          el("td", null, entry.meta["last-reviewed"] || ""),
          el("td", null, entry.fragment
            ? (isSectionEnabled(entry.definition) ? "Shown" : "Off")
            : el("strong", null, "Error"))))))));
    }
  }

  /* ---------- Rendering ---------- */

  function render() {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = null;
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
    if (config.numberSections !== false) numberSections(main);
    renderTableOfContents();
    document.dispatchEvent(new CustomEvent("syllabus:rendered"));
    renderStatusPanel();
    updatePrintFooter();
    document.body.classList.toggle("print-link-urls", Boolean(config.printLinkUrls));
  }

  /* ---------- Unsaved changes ---------- */
  /*
   * The builder never stores a syllabus. It only tracks whether the open syllabus
   * has changes that have not been saved to the instructor's own file.
   */

  function contentVersion() {
    return (state.content.manifest && state.content.manifest.contentVersion) || "";
  }

  /* True when nothing has been entered yet. */
  function isBlank(data) {
    const blank = SCTCC.createEmptySyllabusData();
    blank.meta.id = data.meta.id;
    return JSON.stringify(blank) === JSON.stringify(data);
  }

  function hasUnsavedChanges() {
    return state.dirty && !isBlank(state.data);
  }

  function updateFileStatus() {
    SCTCC.editor.setFileStatus(state.fileName, hasUnsavedChanges());
  }

  /* Called by the editor after every change. */
  function dataChanged() {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(render, config.previewDelayMs);
    state.dirty = true;
    updateFileStatus();
  }

  /*
   * Replace the whole syllabus (new, open, sample, clear).
   * options.fileName: the file it came from; options.dirty: whether it still needs saving.
   */
  function replaceData(data, options) {
    const opts = options || {};
    state.data = data;
    state.fileName = opts.fileName || "";
    state.dirty = Boolean(opts.dirty);
    render();
    updateFileStatus();
  }

  /* Called after a successful save. */
  function markSaved(fileName) {
    state.fileName = fileName || state.fileName;
    state.dirty = false;
    updateFileStatus();
  }

  /* ---------- Modes and printing ---------- */

  function setMode(mode) {
    const next = mode === "student" ? "student" : "instructor";
    document.body.setAttribute("data-mode", next);
    const button = document.getElementById("toggle-mode");
    button.setAttribute("aria-pressed", next === "student" ? "true" : "false");
    button.textContent = next === "student" ? "Back to editor" : "Student preview";
  }

  function suggestedFileName() {
    const course = state.data.course;
    const parts = [course.prefix, course.number, course.term, course.year, "Syllabus"]
      .map((part) => String(part || "").trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, ""))
      .filter(Boolean);
    return parts.join("-") || "Syllabus";
  }

  /*
   * Title of the PDF, for example "ITEC 0000 Sample Course Syllabus, Spring 2027".
   * Chrome uses it both as the PDF's title (announced by screen readers, shown in
   * PDF viewers) and as the suggested file name, so characters that file names
   * cannot contain are removed.
   */
  function pdfTitle() {
    const course = state.data.course;
    const clean = (text) => String(text || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const name = [clean(course.prefix), clean(course.number), clean(course.title), "Syllabus"].filter(Boolean).join(" ");
    const term = [clean(course.term), clean(course.year)].filter(Boolean).join(" ");
    return term ? `${name}, ${term}` : name;
  }

  /* Runs for the Print to PDF button and for the browser's own Print command. */
  function enterPrintMode() {
    if (state.printSnapshot) return;
    if (state.renderTimer) render();
    state.printSnapshot = { mode: document.body.getAttribute("data-mode"), title: document.title };
    document.title = pdfTitle();
    setMode("student");
  }

  function exitPrintMode() {
    if (!state.printSnapshot) return;
    const snapshot = state.printSnapshot;
    state.printSnapshot = null;
    document.title = snapshot.title;
    setMode(snapshot.mode);
  }

  /* Run every check before printing (see js/syllabus-validation.js). */
  function runChecks() {
    if (state.renderTimer) render();
    return SCTCC.validation.validate({
      data: state.data,
      content: state.content,
      previewRoot: document.querySelector(".page"),
      config
    });
  }

  /*
   * Print to PDF button: check first, then guide the instructor through saving.
   * Problems that must be fixed stop printing. The browser's own Print command
   * cannot be stopped, but the same problems are shown in the editor.
   */
  function printToPdf() {
    const result = runChecks();
    SCTCC.printCheck.open(result, {
      fileName: pdfTitle(),
      onPrint: () => {
        enterPrintMode();
        window.print();
      }
    });
  }

  function bindPageEvents() {
    document.getElementById("toggle-mode").addEventListener("click", () => {
      const next = document.body.getAttribute("data-mode") === "student" ? "instructor" : "student";
      setMode(next);
      announce(next === "student" ? "Showing the student view." : "Showing the editor.");
    });
    document.getElementById("print-pdf").addEventListener("click", printToPdf);
    document.getElementById("toolbar-save").addEventListener("click", () => SCTCC.editor.save(false));
    document.getElementById("toolbar-open").addEventListener("click", () => SCTCC.editor.open());
    window.addEventListener("beforeprint", enterPrintMode);
    window.addEventListener("afterprint", exitPrintMode);
    /* Warn before leaving the page with unsaved changes. */
    window.addEventListener("beforeunload", (event) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  /* ---------- Startup ---------- */

  const app = Object.freeze({
    getData: () => state.data,
    contentReady: () => state.contentPromise,
    collegeTexts: () => state.content.sections
      .filter((entry) => entry.fragment)
      .map((entry) => ({ id: entry.definition.id, title: entry.definition.title, text: entry.fragment.textContent })),
    academicCalendar: () => state.content.academicCalendar || null,
    dataChanged,
    replaceData,
    markSaved,
    hasUnsavedChanges,
    contentVersion,
    suggestedFileName,
    pdfTitle,
    runChecks,
    showEditor: () => setMode("instructor")
  });

  async function init() {
    /* Remove any syllabus copies left in this browser by earlier preview builds. */
    const erased = SCTCC.files.eraseBrowserCopies(config.legacyStoragePrefixes || []);

    state.data = SCTCC.createEmptySyllabusData();
    setMode(config.mode);
    bindPageEvents();
    SCTCC.editor.init(app);
    render(); /* show the blank syllabus immediately while college content loads */
    updateFileStatus();
    if (erased) {
      SCTCC.editor.showMessages("info", "Removed syllabus copies that an earlier preview of this builder had kept in this browser.",
        ["The builder no longer stores syllabi. Open your saved file to keep working."]);
    }

    state.contentPromise = SCTCC.contentLoader.loadContent(config);
    SCTCC.startScreen.init(app);
    SCTCC.startScreen.show();
    state.content = await state.contentPromise;
    render();
    SCTCC.editor.refreshCollegeDates();
    document.body.classList.add("content-ready");

    announce(state.content.errors.length
      ? `Builder ready, with ${state.content.errors.length} college content problem(s).`
      : "Builder ready.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
