/*
 * SCTCC Syllabus Builder — data model and shared utilities
 *
 * createEmptySyllabusData() returns a complete, empty syllabus record.
 * Every instructor-entered value lives in this structure; the student view is
 * rendered from it. Phase 2 adds editing, autosave, and JSON import/export.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const SCHEMA_VERSION = "1.1";

  function createDefaultGradingScale() {
    return [
      { label: "A", minPercent: 90, maxPercent: 100 },
      { label: "B", minPercent: 80, maxPercent: 89 },
      { label: "C", minPercent: 70, maxPercent: 79 },
      { label: "D", minPercent: 60, maxPercent: 69 },
      { label: "F", minPercent: 0, maxPercent: 59 }
    ];
  }

  function createEmptySyllabusData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      institution: { name: "St. Cloud Technical & Community College" },
      meta: {
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
        modalityNote: "",        /* e.g. "The lecture component of this course is online..." */
        location: "",
        startDate: "",           /* ISO yyyy-mm-dd */
        endDate: "",
        dropDate: "",
        withdrawalDate: "",
        meetingPattern: { meetingsPerWeek: 2, days: [], startTime: "", endTime: "" },
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
        photoUrl: "",
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
        lateWork: ""
      },
      grading: {
        calculationMethod: "points",   /* "points" | "weighted" */
        intro: "",
        categories: [],                /* { name, count, pointsEach, weight, notes } */
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
        startDate: "",
        endDate: "",
        meetingsPerWeek: 2,
        meetingDays: [],
        excludedDates: [],
        entries: []                    /* { week, meeting, date, topic, preparation, due, notes, noClass } */
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
        academicIntegrityExamples: false,
        timeCommitment: true,
        recommendedMaterials: true
      }
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
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return "";
    let hours = Number(match[1]);
    const suffix = hours >= 12 ? "p.m." : "a.m.";
    hours = hours % 12 || 12;
    return `${hours}:${match[2]} ${suffix}`;
  }

  /* Read a dotted path such as "course.withdrawalDate" from an object. */
  function getPath(source, path) {
    return String(path).split(".").reduce(
      (value, key) => (value !== null && value !== undefined ? value[key] : undefined),
      source
    );
  }

  /* ["Monday", "Wednesday"] → "Mondays and Wednesdays" */
  function joinWords(words) {
    const list = words.filter(Boolean);
    if (list.length <= 1) return list.join("");
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
  }

  window.SCTCC.SCHEMA_VERSION = SCHEMA_VERSION;
  window.SCTCC.createEmptySyllabusData = createEmptySyllabusData;
  window.SCTCC.createDefaultGradingScale = createDefaultGradingScale;
  window.SCTCC.util = Object.freeze({
    parseISODate,
    formatDate,
    formatTime,
    weekdayName,
    getPath,
    joinWords
  });
})();
