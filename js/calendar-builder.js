/*
 * SCTCC Syllabus Builder — course calendar generator
 *
 * Builds calendar rows from the course dates and meeting pattern, and keeps the
 * instructor's topics, readings, due dates, and notes attached to their dates
 * when the calendar is generated again.
 *
 * Two modes:
 *   "meetings" — one row per class meeting (1 to 4 meetings per week)
 *   "weekly"   — one row per week (asynchronous online courses)
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const util = window.SCTCC.util;
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const CONTENT_FIELDS = ["topic", "preparation", "due", "notes"];
  const MAX_WEEKS = 30;
  const DAY_MS = 86400000;

  /* ---------- Date helpers (local calendar dates, no time zones) ---------- */

  function toISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  /* Weeks run Monday through Sunday. */
  function mondayOf(date) {
    return addDays(date, -((date.getDay() + 6) % 7));
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / DAY_MS);
  }

  function weekNumber(dateISO, startISO) {
    const date = util.parseISODate(dateISO);
    const start = util.parseISODate(startISO);
    if (!date || !start) return 0;
    return Math.floor(daysBetween(mondayOf(start), mondayOf(date)) / 7) + 1;
  }

  function shortDate(iso) {
    return util.formatDate(iso, "short");
  }

  /* ---------- Settings ---------- */

  /* Calendar settings, falling back to the course dates when the calendar's are blank. */
  function resolveSettings(data) {
    const calendar = data.calendar;
    const course = data.course;
    return {
      mode: calendar.mode === "weekly" ? "weekly" : "meetings",
      startDate: calendar.startDate || course.startDate,
      endDate: calendar.endDate || course.endDate,
      meetingsPerWeek: Number(calendar.meetingsPerWeek) || 0,
      meetingDays: (calendar.meetingDays || []).filter((day) => DAY_NAMES.includes(day)),
      useFirstWeekSchedule: Boolean(calendar.useFirstWeekSchedule),
      firstWeekDays: (calendar.firstWeekDays || []).filter((day) => DAY_NAMES.includes(day)),
      excluded: (calendar.excludedDates || []).filter((item) => util.parseISODate(item.date)),
      includeFinalsWeek: calendar.includeFinalsWeek !== false,
      showExcludedAsRows: calendar.showExcludedAsRows !== false
    };
  }

  /* Returns { errors[], warnings[] } for the generator settings. */
  function checkSettings(settings) {
    const errors = [];
    const warnings = [];
    const start = util.parseISODate(settings.startDate);
    const end = util.parseISODate(settings.endDate);

    if (!start) errors.push("Enter the calendar start date (or the course begin date).");
    if (!end) errors.push("Enter the calendar end date (or the course end date).");
    if (start && end) {
      if (end < start) errors.push("The end date is before the start date.");
      else if (daysBetween(mondayOf(start), mondayOf(end)) / 7 + 1 > MAX_WEEKS) {
        errors.push(`The dates span more than ${MAX_WEEKS} weeks. Check the start and end dates.`);
      }
    }

    if (settings.mode === "meetings") {
      const count = settings.meetingsPerWeek;
      const chosen = settings.meetingDays.length;
      if (count < 1 || count > 4) {
        errors.push("Choose how many times the class meets each week (1 to 4).");
      } else if (chosen !== count) {
        errors.push(`You chose ${count} meeting${count === 1 ? "" : "s"} per week, so choose exactly ${count} meeting day${count === 1 ? "" : "s"} (${chosen} ${chosen === 1 ? "is" : "are"} chosen now).`);
      }
      if (settings.useFirstWeekSchedule && !settings.firstWeekDays.length) {
        errors.push("Choose the first-week meeting days, or turn off the special first-week schedule.");
      }
    }

    settings.excluded.forEach((item) => {
      const date = util.parseISODate(item.date);
      if (start && end && (date < start || date > end)) {
        warnings.push(`${shortDate(item.date)}${item.label ? ` (${item.label})` : ""} is outside the calendar dates and will be ignored.`);
      }
    });
    return { errors, warnings };
  }

  /* ---------- Generation ---------- */

  function blankRow(fields) {
    return Object.assign({
      week: 0, meeting: 0, date: "", weekEnd: "",
      topic: "", preparation: "", due: "", notes: "",
      noClass: false, isFinals: false, manual: false
    }, fields);
  }

  function excludedMap(settings) {
    const map = new Map();
    settings.excluded.forEach((item) => {
      if (!map.has(item.date)) map.set(item.date, String(item.label || "").trim());
    });
    return map;
  }

  function generateMeetingRows(settings) {
    const start = util.parseISODate(settings.startDate);
    const end = util.parseISODate(settings.endDate);
    const finalsMonday = toISO(mondayOf(end));
    const firstMonday = toISO(mondayOf(start));
    const closures = excludedMap(settings);
    const rows = [];

    for (let day = start; day <= end; day = addDays(day, 1)) {
      const iso = toISO(day);
      const monday = toISO(mondayOf(day));
      const isFinals = monday === finalsMonday && finalsMonday !== firstMonday;
      if (isFinals && !settings.includeFinalsWeek) continue;

      const days = settings.useFirstWeekSchedule && monday === firstMonday ? settings.firstWeekDays : settings.meetingDays;
      if (!days.includes(DAY_NAMES[day.getDay()])) continue;

      if (closures.has(iso)) {
        if (settings.showExcludedAsRows) {
          rows.push(blankRow({ date: iso, noClass: true, notes: closures.get(iso), isFinals }));
        }
        continue;
      }
      rows.push(blankRow({ date: iso, isFinals }));
    }
    return rows;
  }

  function generateWeeklyRows(settings) {
    const start = util.parseISODate(settings.startDate);
    const end = util.parseISODate(settings.endDate);
    const lastMonday = mondayOf(end);
    const firstMonday = mondayOf(start);
    const rows = [];

    for (let monday = firstMonday; monday <= lastMonday; monday = addDays(monday, 7)) {
      const isFinals = toISO(monday) === toISO(lastMonday) && toISO(monday) !== toISO(firstMonday);
      if (isFinals && !settings.includeFinalsWeek) continue;
      const weekStart = monday < start ? start : monday;
      const sunday = addDays(monday, 6);
      const weekEnd = sunday > end ? end : sunday;

      const closures = settings.excluded
        .filter((item) => {
          const date = util.parseISODate(item.date);
          return date >= weekStart && date <= weekEnd;
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => `${util.weekdayName(item.date, true)} ${shortDate(item.date)}${item.label ? ` (${item.label})` : ""}`);

      rows.push(blankRow({
        date: toISO(weekStart),
        weekEnd: toISO(weekEnd),
        isFinals,
        notes: closures.length ? `No classes: ${closures.join("; ")}` : ""
      }));
    }
    return rows;
  }

  function hasContent(row, fields) {
    return (fields || CONTENT_FIELDS).some((field) => String(row[field] || "").trim());
  }

  /* Rows with a date in date order; rows without a date stay at the end in their order. */
  function sortRows(rows) {
    const dated = rows.filter((row) => util.parseISODate(row.date));
    const undated = rows.filter((row) => !util.parseISODate(row.date));
    dated.sort((a, b) => a.date.localeCompare(b.date));
    return [...dated, ...undated];
  }

  /* Recompute week and meeting numbers after any change. */
  function renumber(rows, settings) {
    let meeting = 0;
    const end = util.parseISODate(settings.endDate);
    const finalsMonday = end ? toISO(mondayOf(end)) : "";
    rows.forEach((row) => {
      const date = util.parseISODate(row.date);
      row.week = date ? weekNumber(row.date, settings.startDate) : 0;
      if (row.manual && date) row.isFinals = toISO(mondayOf(date)) === finalsMonday && row.week > 1;
      if (settings.mode === "meetings" && date && !row.noClass) {
        meeting += 1;
        row.meeting = meeting;
      } else {
        row.meeting = 0;
      }
    });
    return rows;
  }

  /*
   * Generate rows and carry over what the instructor already entered.
   * Content is matched by date (meetings) or week start date (weekly).
   * Returns { ok, entries, errors[], warnings[], summary }.
   */
  function generate(data) {
    const settings = resolveSettings(data);
    const check = checkSettings(settings);
    if (check.errors.length) return { ok: false, entries: data.calendar.entries, errors: check.errors, warnings: check.warnings };

    const generated = settings.mode === "weekly" ? generateWeeklyRows(settings) : generateMeetingRows(settings);
    const existing = data.calendar.entries || [];
    const byDate = new Map();
    existing.forEach((row) => {
      if (!row.manual && row.date && !byDate.has(row.date)) byDate.set(row.date, row);
    });

    const warnings = [...check.warnings];
    const used = new Set();
    let kept = 0;

    const merged = generated.map((row) => {
      const previous = byDate.get(row.date);
      if (!previous) return row;
      used.add(previous);
      if (hasContent(previous)) kept += 1;
      const next = Object.assign({}, row, {
        topic: previous.topic,
        preparation: previous.preparation,
        due: previous.due,
        notes: String(previous.notes || "").trim() ? previous.notes : row.notes,
        noClass: row.noClass || Boolean(previous.noClass)
      });
      if (row.noClass && !previous.noClass && hasContent(previous, ["topic", "preparation", "due"])) {
        warnings.push(`${shortDate(row.date)} is now a no-class date but had a topic or due date. It was kept; use “Shift topics later” on that row if it should move.`);
      }
      return next;
    });

    let unmatched = 0;
    existing.forEach((row) => {
      if (used.has(row)) return;
      if (row.manual) {
        merged.push(Object.assign({}, row));
      } else if (hasContent(row)) {
        unmatched += 1;
        merged.push(Object.assign({}, row, { manual: true }));
      }
    });
    if (unmatched) {
      warnings.push(`${unmatched} row${unmatched === 1 ? "" : "s"} with topics no longer fell on a class date. ${unmatched === 1 ? "It was" : "They were"} kept as unscheduled row${unmatched === 1 ? "" : "s"}; move or remove ${unmatched === 1 ? "it" : "them"}.`);
    }

    const entries = renumber(sortRows(merged), settings);
    const classRows = entries.filter((row) => !row.manual).length;
    const summary = settings.mode === "weekly"
      ? `Generated ${classRows} weekly rows.`
      : `Generated ${classRows} rows (${entries.filter((row) => row.meeting).length} class meetings).`;
    return {
      ok: true,
      entries,
      errors: [],
      warnings,
      summary: kept ? `${summary} Kept the topics and notes from ${kept} existing row${kept === 1 ? "" : "s"}.` : summary
    };
  }

  /* ---------- Row editing helpers ---------- */

  function takeContent(row) {
    return { topic: row.topic, preparation: row.preparation, due: row.due, notes: row.notes };
  }

  function emptyContent() {
    return { topic: "", preparation: "", due: "", notes: "" };
  }

  /* Swap topics, readings, due items, and notes between two rows; dates stay put. */
  function swapContent(rows, a, b) {
    if (!rows[a] || !rows[b]) return false;
    const first = takeContent(rows[a]);
    Object.assign(rows[a], takeContent(rows[b]));
    Object.assign(rows[b], first);
    return true;
  }

  /*
   * Move the content of this row and every later class row down by one class row
   * (skipping no-class rows), leaving this row empty. Used after an unplanned
   * closure. If the last row had content, it moves to a new unscheduled row.
   * Returns { overflow }.
   */
  function shiftContentLater(rows, index) {
    const targets = [];
    for (let i = index; i < rows.length; i += 1) {
      if (i === index || (!rows[i].noClass && !rows[i].manual)) targets.push(i);
    }
    let carry = emptyContent();
    targets.forEach((i) => {
      const current = takeContent(rows[i]);
      Object.assign(rows[i], carry);
      carry = current;
    });
    const overflow = hasContent(carry);
    if (overflow) rows.push(blankRow(Object.assign({ manual: true }, carry)));
    return { overflow };
  }

  /* ---------- Export ---------- */

  function csvCell(value) {
    const text = String(value === null || value === undefined ? "" : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  }

  function toCsv(data) {
    const mode = data.calendar.mode === "weekly" ? "weekly" : "meetings";
    const rows = data.calendar.entries || [];
    const header = mode === "weekly"
      ? ["Week", "Start", "End", "Topic", "Preparation/Reading", "Assignment Due", "Notes", "No Class"]
      : ["Week", "Meeting", "Date", "Day", "Topic", "Preparation/Reading", "Assignment Due", "Notes", "No Class"];
    const lines = [header.map(csvCell).join(",")];
    rows.forEach((row) => {
      const week = row.week ? `${row.week}${row.isFinals ? " (Finals)" : ""}` : "";
      const cells = mode === "weekly"
        ? [week, shortDate(row.date), shortDate(row.weekEnd), row.topic, row.preparation, row.due, row.notes, row.noClass ? "Yes" : ""]
        : [week, row.meeting || "", shortDate(row.date), util.weekdayName(row.date, true), row.topic, row.preparation, row.due, row.notes, row.noClass ? "Yes" : ""];
      lines.push(cells.map(csvCell).join(","));
    });
    return `﻿${lines.join("\r\n")}\r\n`; /* byte-order mark so Excel reads accents correctly */
  }

  window.SCTCC.calendar = Object.freeze({
    DAY_NAMES,
    resolveSettings,
    checkSettings,
    generate,
    renumber,
    sortRows,
    hasContent,
    swapContent,
    shiftContentLater,
    blankRow,
    toCsv,
    weekNumber
  });
})();
