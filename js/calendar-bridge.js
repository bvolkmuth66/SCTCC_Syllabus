/*
 * SCTCC Syllabus Builder — calendar workspace bridge (builder side)
 *
 * The calendar workspace (calendar.html) opens in its own window, or full screen
 * inside the builder when a new window is blocked. It never keeps its own copy of
 * the syllabus: it reads a snapshot from here and sends every change here, where
 * the same calendar functions as the editor apply it. The builder stays the one
 * place the syllabus lives, so Save, the preview, and the PDF always match.
 *
 * Messages are plain JSON strings, so objects never cross between windows
 * (lists made in one window are not recognized as lists by another's checks).
 * Nothing is stored and nothing leaves the computer.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const SCTCC = window.SCTCC;
  const CONTENT_FIELDS = ["topic", "preparation", "due", "notes"];
  const WORKSPACE_URL = "calendar.html";
  const listeners = new Set();
  let app = null;
  let workspaceWindow = null;
  let pendingTool = "";

  function data() {
    return app.getData();
  }

  function text(value) {
    return String(value === null || value === undefined ? "" : value).slice(0, 2000);
  }

  function entryAt(index) {
    const entries = data().calendar.entries;
    return Number.isInteger(index) && index >= 0 && index < entries.length ? entries[index] : null;
  }

  function renumber() {
    SCTCC.calendar.renumber(data().calendar.entries, SCTCC.calendar.resolveSettings(data()));
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDaysISO(value, days) {
    const date = SCTCC.util.parseISODate(value);
    if (!date) return value;
    return isoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
  }

  function currentTerm() {
    const course = data().course;
    return SCTCC.calendar.findTerm(app.academicCalendar(), course.term, course.year);
  }

  /* ---------- Reading ---------- */

  function snapshot() {
    const syllabus = data();
    const course = syllabus.course;
    const settings = SCTCC.calendar.resolveSettings(syllabus);
    const check = SCTCC.calendar.checkSettings(settings);
    const term = currentTerm();
    return JSON.stringify({
      course: {
        prefix: course.prefix, number: course.number, title: course.title,
        term: course.term, year: course.year,
        startDate: course.startDate, endDate: course.endDate,
        location: course.location, modality: course.modality,
        meetingDays: course.meetingPattern.days, startTime: course.meetingPattern.startTime, endTime: course.meetingPattern.endTime
      },
      calendar: syllabus.calendar,
      term: term ? { term: term.term, year: term.year, startDate: term.startDate, endDate: term.endDate, finalsStart: term.finalsStart, finalsEnd: term.finalsEnd, noClassDates: term.noClassDates || [] } : null,
      settingsErrors: check.errors,
      settingsWarnings: check.warnings
    });
  }

  /* ---------- Changing ---------- */

  const OPERATIONS = {
    setField(op) {
      const entry = entryAt(op.index);
      if (!entry) return { ok: false, message: "That calendar row no longer exists." };
      if (op.field === "noClass") {
        entry.noClass = Boolean(op.value);
        renumber();
        return { ok: true };
      }
      if (op.field === "date" && entry.manual) {
        entry.date = SCTCC.util.parseISODate(op.value) ? op.value : "";
        renumber();
        return { ok: true };
      }
      if (!CONTENT_FIELDS.includes(op.field)) return { ok: false, message: "That field cannot be changed here." };
      entry[op.field] = text(op.value);
      if (entry.pending) entry.pending = false;
      return { ok: true };
    },

    move(op) {
      const target = op.index + (op.direction < 0 ? -1 : 1);
      if (!SCTCC.calendar.swapContent(data().calendar.entries, op.index, target)) return { ok: false, message: "That topic cannot move further." };
      return { ok: true, index: target };
    },

    shift(op) {
      if (!entryAt(op.index)) return { ok: false, message: "That calendar row no longer exists." };
      const result = SCTCC.calendar.shiftContentLater(data().calendar.entries, op.index);
      renumber();
      return { ok: true, overflow: Boolean(result.overflow) };
    },

    generate() {
      const syllabus = data();
      const check = SCTCC.calendar.checkSettings(SCTCC.calendar.resolveSettings(syllabus));
      if (check.errors.length) return { ok: false, errors: check.errors };
      const result = SCTCC.calendar.generate(syllabus);
      syllabus.calendar.entries = result.entries;
      return { ok: true, summary: result.summary, warnings: result.warnings || [] };
    },

    /* The course meeting days (Credits, modality, and dates), which the calendar follows. */
    setMeetingDays(op) {
      const days = (Array.isArray(op.days) ? op.days : []).filter((day) => SCTCC.calendar.DAY_NAMES.includes(day));
      const pattern = data().course.meetingPattern;
      pattern.days = days.slice();
      pattern.meetingsPerWeek = days.length;
      return { ok: true };
    },

    setOption(op) {
      const calendar = data().calendar;
      if (op.key === "mode") calendar.mode = op.value === "weekly" ? "weekly" : "meetings";
      else if (op.key === "includeFinalsWeek" || op.key === "showExcludedAsRows") calendar[op.key] = Boolean(op.value);
      else return { ok: false, message: "That setting cannot be changed here." };
      return { ok: true };
    },

    addCollegeClosures() {
      const term = currentTerm();
      if (!term) return { ok: false, message: "The college calendar has no dates for this term yet, or the term and year are not chosen." };
      return { ok: true, added: SCTCC.calendar.addTermClosures(data().calendar, term) };
    },

    addExcluded(op) {
      if (!SCTCC.util.parseISODate(op.date)) return { ok: false, message: "Enter a date." };
      data().calendar.excludedDates.push({ date: op.date, label: text(op.label).slice(0, 120) });
      return { ok: true };
    },

    removeExcluded(op) {
      const list = data().calendar.excludedDates;
      if (!(op.index >= 0 && op.index < list.length)) return { ok: false };
      list.splice(op.index, 1);
      return { ok: true };
    },

    addRow() {
      const entries = data().calendar.entries;
      entries.push(SCTCC.calendar.blankRow({ manual: true }));
      renumber();
      return { ok: true, index: entries.length - 1 };
    },

    removeRow(op) {
      if (!entryAt(op.index)) return { ok: false };
      data().calendar.entries.splice(op.index, 1);
      renumber();
      return { ok: true };
    },

    /*
     * Move every calendar date by the same number of days (like D2L's date offset).
     * Old no-class rows without content are dropped (they were the old term's closures);
     * the college's no-class dates for the chosen term can replace the old ones.
     */
    shiftDates(op) {
      const days = Math.round(Number(op.days));
      if (!Number.isFinite(days) || days === 0 || Math.abs(days) > 3660) return { ok: false, message: "Enter how many days to move the calendar (up to 10 years)." };
      const syllabus = data();
      const calendar = syllabus.calendar;
      const course = syllabus.course;
      /* Old no-class rows hold only the old holiday's name in their notes; keep one only if a topic, reading, or due item was put on it. */
      calendar.entries = calendar.entries.filter((entry) => !(entry.noClass && !["topic", "preparation", "due"].some((field) => String(entry[field] || "").trim())));
      let moved = 0;
      calendar.entries.forEach((entry) => {
        if (entry.date) {
          entry.date = addDaysISO(entry.date, days);
          moved += 1;
        }
        if (entry.weekEnd) entry.weekEnd = addDaysISO(entry.weekEnd, days);
      });
      if (op.shiftCourse) {
        ["startDate", "endDate", "dropDate", "withdrawalDate"].forEach((key) => {
          if (course[key]) course[key] = addDaysISO(course[key], days);
        });
      }
      let closuresAdded = 0;
      const term = currentTerm();
      if (op.replaceClosures && term) {
        calendar.excludedDates = [];
        closuresAdded = SCTCC.calendar.addTermClosures(calendar, term);
      } else {
        calendar.excludedDates.forEach((item) => { item.date = addDaysISO(item.date, days); });
      }
      renumber();
      const closed = new Map(calendar.excludedDates.map((item) => [item.date, item.label || "No class"]));
      const conflicts = [];
      const outside = [];
      calendar.entries.forEach((entry, index) => {
        if (!entry.date || entry.noClass) return;
        if (closed.has(entry.date)) conflicts.push({ index, date: entry.date, label: closed.get(entry.date) });
        else if ((course.startDate && entry.date < course.startDate) || (course.endDate && entry.date > course.endDate)) outside.push({ index, date: entry.date });
      });
      return { ok: true, moved, conflicts, outside, closuresAdded, replacedClosures: Boolean(op.replaceClosures && term) };
    },

    /* Class time and room, which can change from one term to the next (shown in Shift dates). */
    setMeeting(op) {
      const course = data().course;
      const time = (value) => (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "");
      if ("startTime" in op) course.meetingPattern.startTime = time(op.startTime);
      if ("endTime" in op) course.meetingPattern.endTime = time(op.endTime);
      if ("location" in op) course.location = text(op.location).slice(0, 60);
      return { ok: true };
    },

    /* Read a syllabus file saved from the builder; only its calendar is returned. */
    readSyllabusFile(op) {
      let raw;
      try {
        raw = JSON.parse(String(op.text || ""));
      } catch (error) {
        return { ok: false, message: "That file is not a syllabus saved from this builder (.json)." };
      }
      const result = SCTCC.validateSyllabusData(raw);
      if (!result.ok) return { ok: false, message: result.errors.join(" ") || "That file could not be read." };
      const course = result.data.course;
      return {
        ok: true,
        label: [course.prefix, course.number, course.title].filter(Boolean).join(" ") + (course.term ? ` (${course.term} ${course.year})` : ""),
        entries: result.data.calendar.entries
      };
    },

    /* Place last term's topics: plan = [{ index, topic, preparation, due, notes }], leftovers = [{ … }]. */
    reuse(op) {
      const entries = data().calendar.entries;
      (Array.isArray(op.plan) ? op.plan : []).forEach((item) => {
        const entry = entryAt(item.index);
        if (!entry) return;
        CONTENT_FIELDS.forEach((field) => { entry[field] = text(item[field]); });
        entry.pending = false;
      });
      (Array.isArray(op.leftovers) ? op.leftovers : []).forEach((item) => {
        const row = SCTCC.calendar.blankRow({ manual: true });
        CONTENT_FIELDS.forEach((field) => { row[field] = text(item[field]); });
        entries.push(row);
      });
      renumber();
      return { ok: true };
    }
  };

  function apply(message) {
    let op;
    try {
      op = JSON.parse(message);
    } catch (error) {
      return JSON.stringify({ ok: false, message: "The request could not be read." });
    }
    const handler = op && Object.prototype.hasOwnProperty.call(OPERATIONS, op.op) ? OPERATIONS[op.op] : null;
    if (!handler) return JSON.stringify({ ok: false, message: "Unknown request." });
    const result = handler(op) || { ok: true };
    if (op.op !== "readSyllabusFile" && result.ok !== false) {
      app.dataChanged();
      if (op.op === "setMeeting" || op.op === "shiftDates" || op.op === "setMeetingDays") {
        if (SCTCC.editor && SCTCC.editor.populate) SCTCC.editor.populate(); /* course fields changed too */
      } else if (SCTCC.editor && SCTCC.editor.refreshCalendar) {
        SCTCC.editor.refreshCalendar();
      }
    }
    return JSON.stringify(result);
  }

  /* ---------- Keeping the workspace up to date ---------- */

  function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function notify() {
    listeners.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        listeners.delete(callback); /* that workspace has closed */
      }
    });
  }

  /* ---------- Opening and closing ---------- */

  function dialog() {
    return document.getElementById("calendar-dialog");
  }

  function openEmbedded(tool) {
    const box = dialog();
    const frame = document.getElementById("calendar-frame");
    frame.src = `${WORKSPACE_URL}?embedded=1${tool ? `&tool=${encodeURIComponent(tool)}` : ""}`;
    if (!box.open) box.showModal();
    frame.focus();
  }

  function closeEmbedded() {
    const box = dialog();
    if (box.open) box.close();
  }

  /* Returns "window", "embedded" (the browser blocked a new window), or "focused". */
  function openWindow(tool) {
    pendingTool = tool || "";
    if (workspaceWindow && !workspaceWindow.closed) {
      workspaceWindow.focus();
      notify(); /* the open workspace picks up the requested tool */
      return "focused";
    }
    const width = Math.min(1440, Math.max(900, window.screen.availWidth - 80));
    const height = Math.min(1000, Math.max(700, window.screen.availHeight - 80));
    workspaceWindow = window.open(WORKSPACE_URL, "sctccCalendarWorkspace", `popup,width=${width},height=${height}`);
    if (!workspaceWindow) {
      pendingTool = "";
      openEmbedded(tool);
      return "embedded";
    }
    return "window";
  }

  function init(appInterface) {
    app = appInterface;
    document.addEventListener("syllabus:rendered", notify);
    const box = dialog();
    if (box) {
      box.addEventListener("close", () => {
        document.getElementById("calendar-frame").src = "about:blank";
        const opener = document.getElementById("calendar-open-here");
        if (opener) opener.focus();
      });
    }
    window.addEventListener("pagehide", () => {
      if (workspaceWindow && !workspaceWindow.closed) workspaceWindow.close();
    });
  }

  SCTCC.calendarBridge = Object.freeze({
    init,
    snapshot,
    apply,
    subscribe,
    openWindow,
    openEmbedded,
    closeEmbedded,
    pdfTitle: () => (app && app.pdfTitle ? app.pdfTitle() : ""),
    /* A tool the builder asked the workspace window to open ("shift"), taken once. */
    takePendingTool() {
      const tool = pendingTool;
      pendingTool = "";
      return tool;
    }
  });
})();
