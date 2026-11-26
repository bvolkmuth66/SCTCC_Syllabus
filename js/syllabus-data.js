/*
 * SCTCC Syllabus Builder — data model, import validation, and shared utilities
 *
 * createEmptySyllabusData() returns a complete, empty syllabus record.
 * validateSyllabusData() checks an imported or saved record and rebuilds it on top
 * of the empty model, so every expected field exists with the right type.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const SCHEMA_VERSION = "1.1";
  const EXPORT_FORMAT = "sctcc-syllabus-data";

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `syl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createDefaultGradingScale() {
    return [
      { label: "A", minPercent: 90, maxPercent: 100 },
      { label: "B", minPercent: 80, maxPercent: 89 },
      { label: "C", minPercent: 70, maxPercent: 79 },
      { label: "D", minPercent: 60, maxPercent: 69 },
      { label: "F", minPercent: 0, maxPercent: 59 }
    ];
  }

  /* Templates for items inside lists of objects (used when importing). */
  const ITEM_TEMPLATES = {
    "grading.categories": { name: "", count: 0, pointsEach: 0, weight: 0, notes: "" },
    "grading.scale": { label: "", minPercent: 0, maxPercent: 0 },
    "calendar.entries": {
      week: 0, meeting: 0, date: "", weekEnd: "", topic: "", preparation: "", due: "", notes: "",
      noClass: false, isFinals: false, manual: false, pending: false
    },
    "policies.additionalSections": { title: "", text: "" },
    "calendar.excludedDates": { date: "", label: "" },
    "vendors": {
      name: "", purpose: "", accessibilityUrl: "", noAccessibilityStatement: false, vpatUrl: "", privacyUrl: "",
      accountRequired: "", dataCollected: "", alternativeAccess: "", supportUrl: ""
    }
  };

  /* Lists of plain text values. */
  const STRING_LISTS = new Set([
    "course.meetingPattern.days",
    "course.prerequisites.items",
    "course.outcomes",
    "materials.required",
    "materials.recommended",
    "materials.requiredTechnologyAdditions",
    "materials.technicalSkills",
    "calendar.meetingDays",
    "calendar.firstWeekDays"
  ]);

  /* Older files stored some lists as plain text; convert them to the current item shape. */
  const FROM_TEXT = {
    "calendar.excludedDates": (text) => ({ date: String(text), label: "" })
  };

  function createEmptyVendor() {
    return JSON.parse(JSON.stringify(ITEM_TEMPLATES.vendors));
  }

  function createEmptySyllabusData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      institution: { name: "St. Cloud Technical & Community College" },
      meta: {
        id: createId(),
        syllabusVersion: "1.0",
        lastRevised: ""
      },
      course: {
        prefix: "",
        number: "",
        title: "",
        term: "",
        year: "",
        credits: { total: 0, lecture: 0, laboratory: 0, soe: 0 },
        modality: "",            /* "residential" | "hybrid" | "online" */
        modalityNote: "",
        location: "",
        startDate: "",           /* ISO yyyy-mm-dd */
        endDate: "",
        dropDate: "",
        withdrawalDate: "",
        meetingPattern: { meetingsPerWeek: 0, days: [], startTime: "", endTime: "" },
        courseLogin: "",
        prerequisites: { intro: "", items: [] },
        corequisites: "",
        description: "",
        outcomes: [],
        mnTransferGoal: ""
      },
      instructor: {
        name: "",
        credentials: "",
        email: "",
        phone: "",
        office: "",
        officeHours: "",
        preferredContactMethod: "",
        responseTime: "",
        biography: "",
        philosophy: "",
        photoUrl: "",            /* web address of a photo */
        photoData: "",           /* uploaded photo stored as a data: URL */
        photoAlt: ""
      },
      materials: {
        required: [],
        recommended: [],
        requiredTechnologyAdditions: [],
        technicalSkills: []
      },
      policies: {
        attendance: "",
        lateWork: "",
        acceptedFileFormats: "", /* blank = college default in navigating-d2l.html */
        classEnvironment: "",    /* blank = college sample text */
        programDiversity: "",
        additionalSections: []   /* { title, text } instructor-written sections */
      },
      grading: {
        calculationMethod: "points",   /* "points" | "weighted" */
        weightOverride: false,         /* instructor confirms weights that do not total 100% */
        intro: "",
        categories: [],
        scale: createDefaultGradingScale(),
        gradesNarrative: {
          postedWhere: "",
          turnaround: "",
          contact: "",
          additional: ""
        },
        timeCommitment: ""
      },
      calendar: {
        locationStatement: "",
        mode: "meetings",              /* "meetings" (one row per class) | "weekly" (one row per week) */
        startDate: "",                 /* blank = course begin date */
        endDate: "",                   /* blank = course end date */
        meetingsPerWeek: 0,
        meetingDays: [],
        useFirstWeekSchedule: false,
        firstWeekDays: [],
        includeFinalsWeek: true,
        showExcludedAsRows: true,
        excludedDates: [],             /* { date, label } */
        entries: []
      },
      vendors: [],
      optionalSections: {
        instructorPhoto: false,
        instructorBiography: false,
        educationalPhilosophy: false,
        courseLogin: false,
        mnTransferGoal: false,
        turnitin: false,
        classEnvironment: false,
        programDiversity: false,
        academicIntegrityExamples: false,
        timeCommitment: true,
        recommendedMaterials: true
      }
    };
  }

  /* ---------- Import validation ---------- */

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /*
   * Copy `incoming` onto `base`, keeping only known fields of the right type.
   * Problems are collected in `issues` as plain-language messages.
   */
  function mergeTyped(base, incoming, path, issues) {
    if (incoming === undefined || incoming === null) return base;
    const where = path || "file";

    if (Array.isArray(base)) {
      if (!Array.isArray(incoming)) {
        issues.push(`"${where}" should be a list; it was skipped.`);
        return base;
      }
      if (STRING_LISTS.has(path)) {
        return incoming
          .filter((item) => typeof item === "string" || typeof item === "number")
          .map((item) => String(item));
      }
      const template = ITEM_TEMPLATES[path];
      if (template) {
        const convert = FROM_TEXT[path];
        return incoming
          .map((item) => (convert && (typeof item === "string" || typeof item === "number") ? convert(item) : item))
          .filter(isPlainObject).map((item) =>
          mergeTyped(JSON.parse(JSON.stringify(template)), item, `${path}[]`, issues));
      }
      return base;
    }

    if (isPlainObject(base)) {
      if (!isPlainObject(incoming)) {
        issues.push(`"${where}" has the wrong format; it was skipped.`);
        return base;
      }
      Object.keys(base).forEach((key) => {
        base[key] = mergeTyped(base[key], incoming[key], path ? `${path}.${key}` : key, issues);
      });
      return base;
    }

    if (typeof base === "string") {
      if (typeof incoming === "string") return incoming;
      if (typeof incoming === "number") return String(incoming);
      issues.push(`"${where}" should be text; it was skipped.`);
      return base;
    }

    if (typeof base === "number") {
      const number = typeof incoming === "string" && incoming.trim() === "" ? NaN : Number(incoming);
      if (Number.isFinite(number)) return number;
      issues.push(`"${where}" should be a number; it was skipped.`);
      return base;
    }

    if (typeof base === "boolean") {
      if (typeof incoming === "boolean") return incoming;
      issues.push(`"${where}" should be true or false; it was skipped.`);
      return base;
    }

    return base;
  }

  /*
   * Validate a parsed JSON value. Accepts either an export file
   * ({ format: "sctcc-syllabus-data", syllabus: {...} }) or a bare syllabus object.
   * Returns { ok, data, errors, warnings, contentVersion }.
   */
  function validateSyllabusData(raw, options) {
    const settings = options || {};
    const result = { ok: false, data: null, errors: [], warnings: [], contentVersion: "" };

    let payload = raw;
    if (isPlainObject(raw) && raw.format === EXPORT_FORMAT) {
      if (!isPlainObject(raw.syllabus)) {
        result.errors.push("This export file does not contain a syllabus.");
        return result;
      }
      payload = raw.syllabus;
      result.contentVersion = typeof raw.contentVersion === "string" ? raw.contentVersion : "";
    }

    if (!isPlainObject(payload)) {
      result.errors.push("This file is not an SCTCC syllabus file.");
      return result;
    }
    if (!isPlainObject(payload.course) && !isPlainObject(payload.instructor)) {
      result.errors.push("This file does not look like an SCTCC syllabus file (no course or instructor information).");
      return result;
    }

    const version = String(payload.schemaVersion || "");
    const major = Number.parseInt(version, 10);
    if (!version) {
      result.warnings.push("The file has no version number; it was read as an older syllabus file.");
    } else if (Number.isFinite(major) && major > 1) {
      result.errors.push(`This file was made by a newer version of the builder (format ${version}). Update the builder and try again.`);
      return result;
    }

    const issues = [];
    const data = mergeTyped(createEmptySyllabusData(), payload, "", issues);
    data.schemaVersion = SCHEMA_VERSION;
    if (!data.meta.id) data.meta.id = createId();
    if (settings.newId) data.meta.id = createId();
    if (data.instructor.photoData && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(data.instructor.photoData)) {
      data.instructor.photoData = "";
      issues.push("The uploaded photo was not a supported image and was removed.");
    }

    if (issues.length) {
      const shown = issues.slice(0, 8);
      result.warnings.push(...shown);
      if (issues.length > shown.length) result.warnings.push(`…and ${issues.length - shown.length} more item(s) skipped.`);
    }
    if (settings.currentContentVersion && result.contentVersion && result.contentVersion !== settings.currentContentVersion) {
      result.warnings.push(
        `College content has been updated since this file was saved (${result.contentVersion} → ${settings.currentContentVersion}). ` +
        "Review the syllabus and make a new PDF before posting it."
      );
    }

    result.ok = true;
    result.data = data;
    return result;
  }

  function createExportEnvelope(data, contentVersion) {
    return {
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      contentVersion: contentVersion || "",
      syllabus: data
    };
  }

  /* ---------- Shared utilities ---------- */

  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* Parse yyyy-mm-dd as a local calendar date (avoids time-zone shifts). */
  function parseISODate(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /* style "long" → January 11, 2027; style "short" → 01/11/2027 */
  function formatDate(value, style) {
    const date = parseISODate(value);
    if (!date) return "";
    if (style === "short") {
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${mm}/${dd}/${date.getFullYear()}`;
    }
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function weekdayName(value, short) {
    const date = parseISODate(value);
    if (!date) return "";
    const name = WEEKDAYS[date.getDay()];
    return short ? name.slice(0, 3) : name;
  }

  /* "13:30" → "1:30 p.m." */
  function formatTime(value) {
    if (typeof value !== "string") return "";
    const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
    if (!match) return "";
    let hours = Number(match[1]);
    const suffix = hours >= 12 ? "p.m." : "a.m.";
    hours = hours % 12 || 12;
    return `${hours}:${match[2]} ${suffix}`;
  }

  /* Read a dotted path such as "course.withdrawalDate" or "vendors.0.name". */
  function getPath(source, path) {
    return String(path).split(".").reduce(
      (value, key) => (value !== null && value !== undefined ? value[key] : undefined),
      source
    );
  }

  /* Write a dotted path. Only existing containers are written to. */
  function setPath(target, path, value) {
    const keys = String(path).split(".");
    const last = keys.pop();
    const container = keys.reduce(
      (node, key) => (node !== null && node !== undefined ? node[key] : undefined),
      target
    );
    if (container === null || container === undefined || typeof container !== "object") return false;
    container[last] = value;
    return true;
  }

  /* ["Mondays", "Wednesdays"] → "Mondays and Wednesdays" */
  function joinWords(words) {
    const list = words.filter(Boolean);
    if (list.length <= 1) return list.join("");
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
  }

  window.SCTCC.SCHEMA_VERSION = SCHEMA_VERSION;
  window.SCTCC.createEmptySyllabusData = createEmptySyllabusData;
  window.SCTCC.createEmptyVendor = createEmptyVendor;
  window.SCTCC.createDefaultGradingScale = createDefaultGradingScale;
  window.SCTCC.validateSyllabusData = validateSyllabusData;
  window.SCTCC.createExportEnvelope = createExportEnvelope;
  window.SCTCC.util = Object.freeze({
    parseISODate,
    formatDate,
    formatTime,
    weekdayName,
    getPath,
    setPath,
    joinWords,
    createId
  });
})();
