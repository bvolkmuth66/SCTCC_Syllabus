/*
 * SCTCC Syllabus Builder — checks before printing
 *
 * Reports findings at three levels:
 *   errors   — must be fixed before Print to PDF (blocking)
 *   warnings — should be reviewed; printing is allowed
 *   notices  — information only
 * Each finding can name the data path of the field to fix, so the editor can
 * take the instructor straight to it. Instructor values are never changed here.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const SCTCC = window.SCTCC;
  const util = SCTCC.util;

  /* Which editor group holds each part of the data. */
  const GROUPS = [
    [/^(course\.(prefix|number|title|term|year)|meta\.)/, "editor-course"],
    [/^instructor\./, "editor-instructor"],
    [/^course\.(credits|modality|modalityNote|meetingPattern|location|startDate|endDate|dropDate|withdrawalDate|courseLogin)/, "editor-schedule"],
    [/^course\.(description|outcomes|prerequisites|corequisites|mnTransferGoal)/, "editor-description"],
    [/^materials\./, "editor-materials"],
    [/^policies\./, "editor-policies"],
    [/^vendors\./, "editor-vendors"],
    [/^grading\./, "editor-grading"],
    [/^calendar\./, "editor-calendar"]
  ];

  const OPTIONAL_PATHS = {
    instructorPhoto: "instructor.photoUrl",
    instructorBiography: "instructor.biography",
    educationalPhilosophy: "instructor.philosophy",
    courseLogin: "course.courseLogin",
    mnTransferGoal: "course.mnTransferGoal",
    turnitin: "policies.attendance",
    academicIntegrityExamples: "policies.attendance",
    classEnvironment: "policies.classEnvironment",
    timeCommitment: "grading.timeCommitment",
    recommendedMaterials: "materials.recommended"
  };

  function groupForPath(path) {
    if (!path) return null;
    const optional = /^optionalSections\.(\w+)$/.exec(path);
    const lookup = optional ? (OPTIONAL_PATHS[optional[1]] || "") : path;
    const match = GROUPS.find(([pattern]) => pattern.test(lookup));
    return match ? match[1] : null;
  }

  /*
   * "[Label needed]" markers the preview shows for missing information,
   * mapped to the field that fills them.
   */
  const MARKER_PATHS = {
    "Course number": "course.number",
    "Course prefix & number": "course.prefix",
    "Course name": "course.title",
    "Title": "course.title",
    "Term": "course.term",
    "Year": "course.year",
    "Instructor name": "instructor.name",
    "Email address": "instructor.email",
    "Office location": "instructor.office",
    "Office hours": "instructor.officeHours",
    "Instructor bio": "instructor.biography",
    "Educational philosophy": "instructor.philosophy",
    "Credits": "course.credits.total",
    "Course modality": "course.modality",
    "Meeting days": "course.meetingPattern.days",
    "Start time": "course.meetingPattern.startTime",
    "End time": "course.meetingPattern.endTime",
    "Room number": "course.location",
    "Begin date": "course.startDate",
    "End date": "course.endDate",
    "Drop date": "course.dropDate",
    "Withdrawal date": "course.withdrawalDate",
    "Course log-in requirement": "course.courseLogin",
    "Required materials": "materials.required",
    "Prerequisites (from the SCTCC Course Outline)": "course.prerequisites.items",
    "Course description (from the SCTCC Course Outline)": "course.description",
    "Course outcomes (from the SCTCC Course Outline)": "course.outcomes",
    "Goal number": "course.mnTransferGoal",
    "Attendance policy": "policies.attendance",
    "Late-work policy": "policies.lateWork",
    "Assessment categories": "grading.categories",
    "Category": "grading.categories",
    "Grading scale": "grading.scale",
    "Grade label": "grading.scale",
    "Where grades are posted": "grading.gradesNarrative.postedWhere",
    "Grading turnaround": "grading.gradesNarrative.turnaround",
    "Time commitment": "grading.timeCommitment",
    "Statement of where the course schedule is located": "calendar.locationStatement",
    "Section title": "policies.additionalSections",
    "Section text": "policies.additionalSections"
  };

  const FRIENDLY_MARKERS = {
    "Course prefix & number": "Course prefix and number",
    "Title": "Course title",
    "Course name": "Course title",
    "Statement of where the course schedule is located": "Course calendar, or a statement of where the schedule is located"
  };

  /* Template placeholders that must never reach students. */
  const PLACEHOLDERS = [
    /\bXXX+\b/,
    /\bYOUR (COURSE )?NAME\b/,
    /\bCOURSE NAME\b/,
    /\bGIVE (WITHDRAWAL )?DATE\b/,
    /\bGIVE TIME\b/,
    /\bLIST ASSIGNMENT\b/,
    /\bDATE & TIME\b/,
    /\bCODE NUMBER\b/,
    /\b1-XXX\b/
  ];

  const SKIP_SCAN = new Set(["instructor.photoData", "meta.id", "schemaVersion", "institution.name"]);

  function finding(message, path, extra) {
    return Object.assign({ message, path: path || "", group: groupForPath(path) }, extra || {});
  }

  /* Walk every instructor text value and report template placeholders. */
  function scanPlaceholders(value, path, out) {
    if (SKIP_SCAN.has(path)) return;
    if (typeof value === "string") {
      const hit = PLACEHOLDERS.find((pattern) => pattern.test(value));
      if (hit) out.push(finding(`A template placeholder (“${value.match(hit)[0]}”) is still in your text. Replace it with the real information.`, path));
      return;
    }
    if (Array.isArray(value)) {
      if (value.every((item) => typeof item === "string")) {
        const hit = value.find((item) => PLACEHOLDERS.some((pattern) => pattern.test(item)));
        if (hit) {
          const pattern = PLACEHOLDERS.find((candidate) => candidate.test(hit));
          out.push(finding(`A template placeholder (“${hit.match(pattern)[0]}”) is still in your text. Replace it with the real information.`, path));
        }
        return;
      }
      value.forEach((item, index) => scanPlaceholders(item, `${path}.${index}`, out));
      return;
    }
    if (value && typeof value === "object") {
      Object.keys(value).forEach((key) => scanPlaceholders(value[key], path ? `${path}.${key}` : key, out));
    }
  }

  /* Missing-information markers the student would see in the preview. */
  function scanMarkers(previewRoot, out) {
    if (!previewRoot) return;
    const seen = new Set();
    previewRoot.querySelectorAll(".missing-value").forEach((marker) => {
      if (marker.closest(".instructor-only")) return;
      const match = /^\[(.+) needed\]$/.exec(marker.textContent.trim());
      const label = match ? match[1] : marker.textContent.trim();
      const shown = FRIENDLY_MARKERS[label] || label;
      const path = MARKER_PATHS[label] || "";
      const key = path || shown;
      if (seen.has(key)) return; /* the same field can be marked in more than one place */
      seen.add(key);
      out.push(finding(`Missing: ${shown}.`, path, { kind: "missing" }));
    });
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function checkDates(course, errors) {
    const start = util.parseISODate(course.startDate);
    const end = util.parseISODate(course.endDate);
    const drop = util.parseISODate(course.dropDate);
    const withdraw = util.parseISODate(course.withdrawalDate);
    const fmt = (value) => util.formatDate(value, "short");
    if (start && end && end <= start) {
      errors.push(finding(`The end date (${fmt(course.endDate)}) must be after the begin date (${fmt(course.startDate)}).`, "course.endDate"));
    }
    if (start && drop && drop < start) {
      errors.push(finding(`The last day to drop (${fmt(course.dropDate)}) is before the course begins (${fmt(course.startDate)}).`, "course.dropDate"));
    }
    if (drop && withdraw && withdraw <= drop) {
      errors.push(finding(`The last day to withdraw (${fmt(course.withdrawalDate)}) must be after the last day to drop (${fmt(course.dropDate)}).`, "course.withdrawalDate"));
    }
    if (end && withdraw && withdraw > end) {
      errors.push(finding(`The last day to withdraw (${fmt(course.withdrawalDate)}) is after the course ends (${fmt(course.endDate)}).`, "course.withdrawalDate"));
    }
  }

  function checkCalendar(data, warnings, notices) {
    const entries = data.calendar.entries || [];
    if (!entries.length) return;
    const start = util.parseISODate(data.course.startDate);
    const end = util.parseISODate(data.course.endDate);
    entries.forEach((entry, index) => {
      const date = util.parseISODate(entry.date);
      if (!date || !start || !end) return;
      if (date < start || date > end) {
        const message = `Calendar row ${index + 1} (${util.formatDate(entry.date, "short")}) is outside the course dates.`;
        if (entry.manual) notices.push(finding(`${message} It is an unscheduled row, so it is allowed.`, `calendar.entries.${index}.date`));
        else warnings.push(finding(`${message} Generate the calendar again or remove the row.`, `calendar.entries.${index}.topic`));
      }
    });
    if (!entries.some((entry) => SCTCC.calendar.hasContent(entry, ["topic", "preparation", "due"]))) {
      warnings.push(finding("The course calendar has no topics yet.", "calendar.entries.0.topic"));
    }
  }

  function checkContent(content, data, errors, warnings, notices) {
    if (!content.manifest) {
      errors.push(finding("The college content could not be loaded, so required college policies are missing. Reload the page; if it continues, contact the builder's maintainer."));
      return;
    }
    content.sections.forEach((entry) => {
      if (entry.fragment) return;
      const definition = entry.definition;
      const enabled = definition.required || (definition.optionalKey && data.optionalSections[definition.optionalKey]);
      if (!enabled) return;
      const message = `The college section “${definition.title}” could not be loaded.`;
      if (definition.required) errors.push(finding(`${message} Reload the page; if it continues, contact the builder's maintainer.`));
      else warnings.push(finding(`${message} Turn it off or try again later.`, `optionalSections.${definition.optionalKey}`));
    });

    let vagueLinks = 0;
    content.sections.forEach((entry) => {
      if (!entry.fragment) return;
      entry.fragment.querySelectorAll("a").forEach((link) => {
        if (/^(here|click here|link|more)$/i.test(link.textContent.trim())) vagueLinks += 1;
      });
    });
    if (vagueLinks) {
      notices.push(finding(`${vagueLinks} link${vagueLinks === 1 ? "" : "s"} in the college content read “here.” The content owners have been asked to give them descriptive text; nothing for you to do.`));
    }
  }

  function checkInstructorExtras(data, warnings, notices) {
    const optional = data.optionalSections;
    const instructor = data.instructor;
    if (optional.instructorPhoto && !instructor.photoData && !/^https?:\/\//i.test(String(instructor.photoUrl || "").trim())) {
      warnings.push(finding("“Include my photo” is on, but there is no photo. Upload one or turn the option off.", "optionalSections.instructorPhoto"));
    }
    if (optional.recommendedMaterials && !data.materials.recommended.length) {
      notices.push(finding("“Include recommended materials” is on but the list is empty, so the section is left out.", "materials.recommended"));
    }
    (data.vendors || []).forEach((vendor, index) => {
      const name = vendor.name.trim();
      if (!name && (vendor.purpose || vendor.accessibilityUrl || vendor.privacyUrl)) {
        warnings.push(finding(`Tool ${index + 1} has details but no name, so it is left out of the syllabus.`, `vendors.${index}.name`));
      }
      ["accessibilityUrl", "vpatUrl", "privacyUrl", "supportUrl"].forEach((key) => {
        const value = String(vendor[key] || "").trim();
        if (value && !/^https?:\/\/\S+$/i.test(value)) {
          warnings.push(finding(`${name || `Tool ${index + 1}`}: the web address “${value}” is not a full address starting with https://, so it is not shown.`, `vendors.${index}.${key}`));
        }
      });
      if (name && !String(vendor.privacyUrl || "").trim()) {
        notices.push(finding(`${name} has no privacy policy link, so the syllabus says none was found.`, `vendors.${index}.privacyUrl`));
      }
    });
  }

  function checkCollegeDates(data, academicCalendar, warnings, notices) {
    const term = SCTCC.calendar.findTerm(academicCalendar, data.course.term, data.course.year);
    if (!term) return;
    SCTCC.calendar.termWarnings(term, data.course).forEach((message) => {
      warnings.push(finding(message, /begins/.test(message) ? "course.startDate" : "course.endDate"));
    });
    if (academicCalendar.status !== "official" || !term.verified) {
      notices.push(finding(`The college dates for ${term.term} ${term.year} have not yet been confirmed by Records & Registration. Double-check your dates in eServices.`));
    }
  }

  /*
   * Run every check.
   * input: { data, content, previewRoot, config }
   * Returns { errors[], warnings[], notices[] }.
   */
  function validate(input) {
    const data = input.data;
    const content = input.content || { manifest: null, sections: [] };
    const errors = [];
    const warnings = [];
    const notices = [];

    scanMarkers(input.previewRoot, errors);

    const instructorEmail = String(data.instructor.email || "").trim();
    if (instructorEmail && !isEmail(instructorEmail)) {
      errors.push(finding(`“${instructorEmail}” is not a complete email address.`, "instructor.email"));
    }
    checkDates(data.course, errors);
    scanPlaceholders(data, "", errors);

    const categories = SCTCC.grading.summarizeCategories(data.grading);
    const scale = SCTCC.grading.validateScale(data.grading.scale);
    const notMissingList = (message) => !/Add at least one assessment category/.test(message); /* shown as a missing marker */
    categories.errors.filter(notMissingList).forEach((message) => errors.push(finding(message, "grading.categories")));
    scale.errors.forEach((message) => errors.push(finding(message, "grading.scale")));
    categories.warnings.filter(notMissingList).forEach((message) => {
      warnings.push(finding(message, /You chose to publish/.test(message) ? "grading.weightOverride" : "grading.categories"));
    });
    scale.warnings.forEach((message) => warnings.push(finding(message, "grading.scale")));

    checkCalendar(data, warnings, notices);
    checkContent(content, data, errors, warnings, notices);
    checkInstructorExtras(data, warnings, notices);
    checkCollegeDates(data, content.academicCalendar, warnings, notices);

    if (input.config && input.config.logo && input.config.logo.isPlaceholder) {
      notices.push(finding("The college logo is still a placeholder in this trial version of the builder."));
    }
    return { errors, warnings, notices };
  }

  window.SCTCC.validation = Object.freeze({ validate, groupForPath, PLACEHOLDERS });
})();
