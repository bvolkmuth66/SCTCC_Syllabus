/*
 * SCTCC Syllabus Builder — course calendar workspace (calendar.html)
 *
 * A larger place to build the course calendar: a month view, a list view, the
 * selected class's details, the generator settings, and "Reuse last term's
 * schedule". It is opened from the builder, in its own window (for a second
 * screen) or full screen inside the builder.
 *
 * The workspace keeps no copy of the syllabus. It reads a snapshot from the
 * builder's calendar bridge and sends each change back as a small JSON request;
 * the builder applies it with the same calendar functions the editor uses.
 */
(function () {
  "use strict";

  const { el, announce } = window.SCTCC.dom;
  const util = window.SCTCC.util;
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const CONTENT_FIELDS = ["topic", "preparation", "due", "notes"];
  const embedded = new URLSearchParams(window.location.search).get("embedded") === "1";

  const state = {
    bridge: null,
    snap: null,
    view: "month",
    month: null,          /* { year, month } */
    selected: null,       /* index into calendar.entries */
    lost: false,
    reuse: null,          /* { label, entries, mode, keepFinals } */
    shift: null,          /* { method, oldDate, newDate, days, shiftCourse, replaceClosures } */
    message: null         /* { summary, warnings }: the latest result, kept through re-renders */
  };

  /* ---------- Talking to the builder ---------- */

  function findBridge() {
    try {
      if (embedded && window.parent !== window && window.parent.SCTCC && window.parent.SCTCC.calendarBridge) return window.parent.SCTCC.calendarBridge;
      if (window.opener && !window.opener.closed && window.opener.SCTCC && window.opener.SCTCC.calendarBridge) return window.opener.SCTCC.calendarBridge;
    } catch (error) {
      return null;
    }
    return null;
  }

  function builderAlive() {
    try {
      if (embedded) return Boolean(window.parent && window.parent.SCTCC && window.parent.SCTCC.calendarBridge === state.bridge);
      return Boolean(window.opener && !window.opener.closed && window.opener.SCTCC && window.opener.SCTCC.calendarBridge === state.bridge);
    } catch (error) {
      return false;
    }
  }

  function markLost() {
    if (state.lost) return;
    state.lost = true;
    document.getElementById("ws-lost").hidden = false;
    document.getElementById("ws-link-text").textContent = "Not connected to the builder";
    document.body.classList.add("is-lost");
    document.querySelectorAll("button, input, select, textarea").forEach((control) => {
      if (control.id !== "ws-close") control.disabled = true;
    });
    announce("The builder window was closed. Changes here cannot be saved.");
  }

  function send(op) {
    if (!builderAlive()) {
      markLost();
      return { ok: false, message: "Not connected to the builder." };
    }
    if (op.op !== "setField" && op.op !== "readSyllabusFile") state.message = null;
    const result = JSON.parse(state.bridge.apply(JSON.stringify(op)));
    readSnapshot();
    renderAll();
    return result;
  }

  function readSnapshot() {
    state.snap = JSON.parse(state.bridge.snapshot());
  }

  function onBuilderChange() {
    if (!builderAlive()) {
      markLost();
      return;
    }
    readSnapshot();
    renderAll();
    checkRequestedTool();
  }

  /* ---------- Small helpers ---------- */

  function entries() {
    return state.snap ? state.snap.calendar.entries : [];
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dayIndex(date) {
    return (date.getDay() + 6) % 7; /* Monday = 0 */
  }

  function longDate(value) {
    return util.formatDate(value, "long");
  }

  function weekdayDate(value) {
    const date = util.parseISODate(value);
    if (!date) return "";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function rowName(entry) {
    if (!entry.date) return "Unscheduled topic";
    if (state.snap.calendar.mode === "weekly") return `Week ${entry.week}`;
    if (entry.noClass) return `${weekdayDate(entry.date)} (no class)`;
    return `Meeting ${entry.meeting}`;
  }

  function hasContent(entry) {
    return CONTENT_FIELDS.some((field) => String(entry[field] || "").trim());
  }

  function closures() {
    const map = new Map();
    (state.snap.calendar.excludedDates || []).forEach((item) => {
      if (util.parseISODate(item.date) && !map.has(item.date)) map.set(item.date, String(item.label || "").trim() || "No class");
    });
    return map;
  }

  function finalsRange() {
    const term = state.snap.term;
    if (term && term.finalsStart && term.finalsEnd) return [term.finalsStart, term.finalsEnd];
    const finals = entries().filter((entry) => entry.isFinals && entry.date).map((entry) => entry.date).sort();
    return finals.length ? [finals[0], finals[finals.length - 1]] : null;
  }

  function inFocus(region) {
    return region.contains(document.activeElement) && document.activeElement !== region;
  }

  /* Remember which control had focus so a re-render can put it back. */
  function keepFocus(region, rebuild) {
    const active = document.activeElement;
    const key = region.contains(active) ? active.getAttribute("data-focus-key") : null;
    rebuild();
    if (key) {
      const again = region.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
      if (again && !again.disabled) again.focus();
    }
  }

  /* ---------- Header ---------- */

  function renderHeader() {
    const course = state.snap.course;
    const id = [course.prefix, course.number].filter(Boolean).join(" ");
    const name = [id, course.title].filter(Boolean).join(" ") || "Your course";
    const term = [course.term, course.year].filter(Boolean).join(" ");
    const dates = course.startDate && course.endDate ? `${weekdayDate(course.startDate)} – ${weekdayDate(course.endDate)}` : "course dates not entered yet";
    document.getElementById("ws-course").textContent = `${name}${term ? ` · ${term}` : ""} · ${dates}`;
    document.title = `Course Calendar – ${id || "Syllabus"} | SCTCC Syllabus Builder`;
  }

  /* ---------- Settings ---------- */

  function checkbox(id, label, checked, onChange, hint) {
    const input = el("input", { type: "checkbox", id, "data-focus-key": id, checked: checked || null });
    input.addEventListener("change", () => onChange(input.checked));
    return el("div", { class: "field-check" }, input, el("label", { for: id }, label), hint ? el("p", { class: "ws-hint" }, hint) : null);
  }

  function renderSettings() {
    const region = document.getElementById("settings-body");
    if (inFocus(region) && document.activeElement.matches("input[type=date], input[type=text]")) return;
    keepFocus(region, () => {
      const snap = state.snap;
      const calendar = snap.calendar;
      const weekly = calendar.mode === "weekly";
      region.textContent = "";

      const mode = el("select", { id: "set-mode", "data-focus-key": "set-mode" },
        el("option", { value: "meetings", selected: !weekly || null }, "By class meeting"),
        el("option", { value: "weekly", selected: weekly || null }, "By week (online)"));
      mode.addEventListener("change", () => send({ op: "setOption", key: "mode", value: mode.value }));
      region.appendChild(el("div", { class: "field" }, el("label", { for: "set-mode" }, "Calendar layout"), mode));

      if (!weekly) {
        const days = el("fieldset", { class: "field ws-days" }, el("legend", null, "Meeting days"),
          DAYS.map((day, index) => {
            const id = `set-day-${index}`;
            const input = el("input", { type: "checkbox", id, value: day, "data-focus-key": id, checked: (calendar.meetingDays || []).includes(day) || null });
            input.addEventListener("change", () => {
              const chosen = Array.from(region.querySelectorAll(".ws-days input:checked")).map((box) => box.value);
              send({ op: "setMeetingDays", days: chosen });
            });
            return el("span", { class: "ws-day" }, input, el("label", { for: id }, SHORT_DAYS[index]));
          }));
        region.appendChild(days);
        const courseDays = snap.course.meetingDays || [];
        if (courseDays.length && courseDays.join() !== (calendar.meetingDays || []).join()) {
          const copy = el("button", { type: "button", class: "btn btn-small", "data-focus-key": "copy-days" }, `Use the course meeting days (${courseDays.map((day) => day.slice(0, 3)).join(", ")})`);
          copy.addEventListener("click", () => report(send({ op: "copyCourseDays" }), "Copied the course meeting days."));
          region.appendChild(copy);
        }
      }

      region.appendChild(el("div", { class: "field" },
        el("p", { class: "field-label" }, "Dates"),
        el("p", null, snap.course.startDate && snap.course.endDate
          ? `${longDate(snap.course.startDate)} – ${longDate(snap.course.endDate)}`
          : "Enter the begin and end dates under Credits, modality, and dates in the builder."),
        el("p", { class: "ws-hint" }, "The calendar always uses the course dates.")));

      region.appendChild(checkbox("set-finals", "Include final exam week", calendar.includeFinalsWeek !== false,
        (value) => send({ op: "setOption", key: "includeFinalsWeek", value })));
      region.appendChild(checkbox("set-show-closed", "Show no-class dates in the calendar", calendar.showExcludedAsRows !== false,
        (value) => send({ op: "setOption", key: "showExcludedAsRows", value })));

      /* No-class dates */
      const list = el("ul", { class: "ws-closures" });
      (calendar.excludedDates || []).forEach((item, index) => {
        const remove = el("button", { type: "button", class: "btn btn-link", "data-focus-key": `remove-closure-${index}`, "aria-label": `Remove ${weekdayDate(item.date) || "date"} ${item.label || ""}`.trim() }, "Remove");
        remove.addEventListener("click", () => report(send({ op: "removeExcluded", index }), "Removed the no-class date. Generate the calendar again to update the rows."));
        list.appendChild(el("li", null, el("span", null, `${weekdayDate(item.date) || "No date"} · ${item.label || "No class"}`), remove));
      });
      const college = el("button", { type: "button", class: "btn btn-small", "data-focus-key": "add-college" }, "Add the college’s no-class dates");
      college.addEventListener("click", () => {
        const result = send({ op: "addCollegeClosures" });
        report(result, result.added ? `Added ${result.added} college no-class date${result.added === 1 ? "" : "s"}. Generate the calendar again to update the rows.` : "The college no-class dates are already listed.");
      });
      const date = el("input", { type: "date", id: "new-closure-date" });
      const reason = el("input", { type: "text", id: "new-closure-reason", placeholder: "" });
      const add = el("button", { type: "button", class: "btn btn-small", "data-focus-key": "add-closure" }, "Add date");
      add.addEventListener("click", () => {
        const result = send({ op: "addExcluded", date: date.value, label: reason.value.trim() });
        report(result, "Added the no-class date. Generate the calendar again to update the rows.");
      });
      region.appendChild(el("fieldset", { class: "field" },
        el("legend", null, "No-class dates"),
        list.childNodes.length ? list : el("p", { class: "ws-hint" }, "None yet."),
        college,
        el("div", { class: "ws-add-closure" },
          el("div", null, el("label", { for: "new-closure-date" }, "Date"), date),
          el("div", null, el("label", { for: "new-closure-reason" }, "Reason"), reason),
          add)));

      /* Problems and Generate */
      if (snap.settingsErrors.length) {
        region.appendChild(el("div", { class: "notice notice-error" },
          el("p", null, el("strong", null, "Before generating:")),
          el("ul", null, snap.settingsErrors.map((message) => el("li", null, message)))));
      }
      const all = entries();
      const classes = all.filter((entry) => entry.date && !entry.noClass).length;
      const withTopics = all.filter((entry) => entry.date && !entry.noClass && hasContent(entry)).length;
      region.appendChild(el("p", { class: "ws-count" },
        all.length ? `${classes} class ${calendar.mode === "weekly" ? "weeks" : "meetings"} · ${withTopics} with topics` : "No calendar yet."));
      const generate = el("button", { type: "button", class: "btn btn-primary", id: "ws-generate", "data-focus-key": "generate" }, all.length ? "Generate calendar again" : "Generate calendar");
      generate.addEventListener("click", () => {
        if (all.length && !window.confirm("Generate the calendar again?\n\nTopics, readings, due items, and notes stay with their dates. Rows whose dates are no longer class days are kept as unscheduled topics if they have content.")) return;
        const result = send({ op: "generate" });
        if (result.ok) {
          state.selected = null;
          announce(result.summary || "Calendar generated.");
          flash(result.summary, result.warnings);
        } else {
          announce("The calendar was not generated. Fix the settings first.");
        }
      });
      region.appendChild(generate);
      region.appendChild(el("p", { class: "ws-hint" }, "First-week schedules and other options are in the builder’s Course calendar section."));
      region.appendChild(el("div", { id: "ws-flash" }));
      showMessage();
    });
  }

  /* The latest result stays visible until the next change; screen readers hear it through announce(). */
  function showMessage() {
    const box = document.getElementById("ws-flash");
    if (!box) return;
    box.textContent = "";
    const message = state.message;
    if (!message) return;
    if (message.summary) box.appendChild(el("p", { class: "notice notice-info" }, message.summary));
    if (message.warnings && message.warnings.length) {
      box.appendChild(el("div", { class: "notice notice-warning" }, el("ul", null, message.warnings.map((text) => el("li", null, text)))));
    }
  }

  function flash(summary, warnings) {
    state.message = { summary: summary || "", warnings: warnings || [] };
    showMessage();
  }

  function report(result, success) {
    if (result.ok === false) {
      const message = result.message || (result.errors || []).join(" ") || "That could not be done.";
      flash(message);
      announce(message);
      return false;
    }
    if (success) announce(success);
    return true;
  }

  /* ---------- Month view ---------- */

  function monthRange() {
    const start = util.parseISODate(state.snap.course.startDate);
    const end = util.parseISODate(state.snap.course.endDate);
    const first = entries().find((entry) => entry.date);
    const fallback = first ? util.parseISODate(first.date) : new Date();
    return { start: start || fallback, end: end || start || fallback };
  }

  function clampMonth() {
    const { start, end } = monthRange();
    const min = start.getFullYear() * 12 + start.getMonth();
    const max = end.getFullYear() * 12 + end.getMonth();
    if (!state.month) {
      const selected = state.selected !== null && entries()[state.selected] && util.parseISODate(entries()[state.selected].date);
      const base = selected || start;
      state.month = { year: base.getFullYear(), month: base.getMonth() };
    }
    let value = state.month.year * 12 + state.month.month;
    value = Math.max(min, Math.min(max, value));
    state.month = { year: Math.floor(value / 12), month: value % 12 };
    return { atStart: value === min, atEnd: value === max };
  }

  function selectEntry(index, focusDetail) {
    state.selected = index;
    const entry = entries()[index];
    const date = entry && util.parseISODate(entry.date);
    if (date) state.month = { year: date.getFullYear(), month: date.getMonth() };
    renderAll();
    if (focusDetail) {
      const topic = document.getElementById("detail-topic");
      if (topic) topic.focus();
    }
    if (entry) announce(`${rowName(entry)} selected.`);
  }

  function entryButton(entry, index, compact) {
    const selected = state.selected === index;
    /* The spoken name starts with the visible words (WCAG 2.5.3); the date follows as hidden text. */
    const button = el("button", {
      type: "button",
      class: `ws-entry${entry.noClass ? " is-noclass" : ""}${entry.isFinals ? " is-finals" : ""}${selected ? " is-selected" : ""}`,
      "aria-pressed": selected ? "true" : "false",
      "data-focus-key": `entry-${index}`
    },
    el("span", { class: "ws-entry-head" }, entry.noClass ? "No class" : (state.snap.calendar.mode === "weekly" ? `Week ${entry.week}` : `${entry.isFinals ? "Finals · " : ""}Mtg ${entry.meeting}`)),
    el("span", { class: "ws-entry-topic" }, entry.noClass ? (entry.notes || "") : (entry.topic || "No topic yet")),
    !compact && entry.due && !entry.noClass ? el("span", { class: "ws-entry-due" }, `Due: ${entry.due}`) : null,
    el("span", { class: "visually-hidden" }, `, ${longDate(entry.date)}${compact && entry.due && !entry.noClass ? `, due: ${entry.due}` : ""}`));
    button.addEventListener("click", () => selectEntry(index, false));
    button.addEventListener("dblclick", () => selectEntry(index, true));
    return button;
  }

  function renderMonth(view) {
    const bounds = clampMonth();
    const { year, month } = state.month;
    const title = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    document.getElementById("month-title").textContent = title;
    document.getElementById("month-prev").disabled = bounds.atStart;
    document.getElementById("month-next").disabled = bounds.atEnd;

    const byDate = new Map();
    entries().forEach((entry, index) => {
      if (!entry.date) return;
      if (!byDate.has(entry.date)) byDate.set(entry.date, []);
      byDate.get(entry.date).push({ entry, index });
    });
    const closed = closures();
    const finals = finalsRange();
    const courseStart = state.snap.course.startDate || "";
    const courseEnd = state.snap.course.endDate || "";

    const first = new Date(year, month, 1);
    const cursor = new Date(year, month, 1 - dayIndex(first));
    const rows = [];
    for (let week = 0; week < 6; week += 1) {
      const cells = [];
      let anyInMonth = false;
      for (let day = 0; day < 7; day += 1) {
        const key = iso(cursor);
        const inMonth = cursor.getMonth() === month;
        anyInMonth = anyInMonth || inMonth;
        const items = inMonth ? (byDate.get(key) || []) : [];
        const closure = inMonth ? closed.get(key) : null;
        const isFinals = inMonth && finals && key >= finals[0] && key <= finals[1];
        const inCourse = key >= courseStart && key <= courseEnd;
        const classes = ["ws-day-cell"];
        if (!inMonth) classes.push("is-outside");
        else if (closure) classes.push("is-closed");
        else if (isFinals) classes.push("is-finals");
        else if (!inCourse) classes.push("is-off");
        cells.push(el("td", { class: classes.join(" ") },
          el("span", { class: "ws-day-number" }, inMonth ? String(cursor.getDate()) : ""),
          closure && !items.some(({ entry }) => entry.noClass) ? el("span", { class: "ws-closure" }, closure) : null,
          items.map(({ entry, index }) => entryButton(entry, index, items.length > 1))));
        cursor.setDate(cursor.getDate() + 1);
      }
      if (anyInMonth) rows.push(el("tr", null, cells));
    }
    view.appendChild(el("div", { class: "ws-month-wrap" },
      el("table", { class: "ws-month" },
        el("caption", { class: "visually-hidden" }, `${title}. Class meetings are buttons; choose one to see its details.`),
        el("thead", null, el("tr", null, DAYS.map((day, index) => el("th", { scope: "col", abbr: day }, SHORT_DAYS[index])))),
        el("tbody", null, rows))));
    if (!entries().some((entry) => entry.date)) {
      view.appendChild(el("p", { class: "notice notice-info" }, "No calendar yet. Check the settings on the left, then choose Generate calendar."));
    }
  }

  /* ---------- List view ---------- */

  function renderList(view) {
    const weekly = state.snap.calendar.mode === "weekly";
    const rows = entries().map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.date);
    if (!rows.length) {
      view.appendChild(el("p", { class: "notice notice-info" }, "No calendar yet. Check the settings on the left, then choose Generate calendar."));
      return;
    }
    view.appendChild(el("div", { class: "ws-table-wrap", role: "region", "aria-label": "All calendar rows", tabindex: "0" },
      el("table", { class: "ws-list" },
        el("caption", null, "All class " + (weekly ? "weeks" : "meetings")),
        el("thead", null, el("tr", null,
          el("th", { scope: "col" }, "Week"),
          weekly ? null : el("th", { scope: "col" }, "Meeting"),
          el("th", { scope: "col" }, "Date"),
          el("th", { scope: "col" }, "Topic"),
          el("th", { scope: "col" }, "Preparation/Reading"),
          el("th", { scope: "col" }, "Due"))),
        el("tbody", null, rows.map(({ entry, index }) => {
          const choose = el("button", { type: "button", class: "btn btn-link", "aria-pressed": state.selected === index ? "true" : "false", "data-focus-key": `list-${index}` },
            weekly && entry.weekEnd ? `${weekdayDate(entry.date)} – ${weekdayDate(entry.weekEnd)}` : weekdayDate(entry.date));
          choose.addEventListener("click", () => selectEntry(index, true));
          return el("tr", { class: `${entry.noClass ? "is-noclass" : ""}${entry.isFinals ? " is-finals" : ""}${state.selected === index ? " is-selected" : ""}` },
            el("td", null, String(entry.week || "")),
            weekly ? null : el("td", null, entry.noClass ? "—" : String(entry.meeting || "")),
            el("td", null, choose),
            el("td", null, entry.noClass ? `No class${entry.notes ? ` · ${entry.notes}` : ""}` : (entry.topic || "—")),
            el("td", null, entry.preparation || "—"),
            el("td", null, entry.due || "—"));
        })))));
  }

  function renderUnscheduled() {
    const section = document.getElementById("unscheduled");
    const list = document.getElementById("unscheduled-list");
    const items = entries().map((entry, index) => ({ entry, index })).filter(({ entry }) => !entry.date);
    section.hidden = !items.length;
    keepFocus(list, () => {
      list.textContent = "";
      items.forEach(({ entry, index }) => {
        const choose = el("button", { type: "button", class: `ws-entry is-unscheduled${state.selected === index ? " is-selected" : ""}`, "aria-pressed": state.selected === index ? "true" : "false", "data-focus-key": `entry-${index}` },
          el("span", { class: "ws-entry-topic" }, entry.topic || "Untitled topic"),
          entry.due ? el("span", { class: "ws-entry-due" }, `Due: ${entry.due}`) : null);
        choose.addEventListener("click", () => selectEntry(index, true));
        list.appendChild(el("li", null, choose));
      });
    });
  }

  function renderMain() {
    const view = document.getElementById("calendar-view");
    const month = state.view === "month";
    document.getElementById("view-month").setAttribute("aria-pressed", month ? "true" : "false");
    document.getElementById("view-list").setAttribute("aria-pressed", month ? "false" : "true");
    document.getElementById("month-nav").hidden = !month;
    keepFocus(view, () => {
      view.textContent = "";
      if (month) renderMonth(view);
      else renderList(view);
    });
    renderUnscheduled();
  }

  /* ---------- Details of the selected row ---------- */

  function textField(id, label, field, entry, index, multiline) {
    const attrs = { id, "data-focus-key": id, "data-field": field };
    const control = multiline ? el("textarea", Object.assign({ rows: 3 }, attrs)) : el("input", Object.assign({ type: "text" }, attrs));
    control.value = entry[field] || "";
    control.addEventListener("input", () => send({ op: "setField", index, field, value: control.value }));
    return el("div", { class: "field" }, el("label", { for: id }, label), control);
  }

  function renderDetail() {
    const region = document.getElementById("detail-body");
    const title = document.getElementById("detail-title");
    const entry = state.selected !== null ? entries()[state.selected] : null;
    if (state.selected !== null && !entry) state.selected = null;

    /* While typing in this panel, only refresh the fields that are not being edited. */
    if (entry && region.getAttribute("data-index") === String(state.selected) && inFocus(region)) {
      region.querySelectorAll("[data-field]").forEach((control) => {
        if (control !== document.activeElement) control.value = entry[control.getAttribute("data-field")] || "";
      });
      return;
    }
    keepFocus(region, () => {
      region.textContent = "";
      region.setAttribute("data-index", entry ? String(state.selected) : "");
      if (!entry) {
        title.textContent = "Class details";
        region.appendChild(el("p", { class: "ws-hint" }, "Choose a class day in the calendar to see and edit its topic, reading, due items, and notes."));
        return;
      }
      const index = state.selected;
      const weekly = state.snap.calendar.mode === "weekly";
      title.textContent = entry.date ? `${rowName(entry)} · ${longDate(entry.date)}` : "Unscheduled topic";
      region.appendChild(el("p", { class: "ws-hint" },
        entry.date ? `Week ${entry.week}${weekly && entry.weekEnd ? ` · ${weekdayDate(entry.date)} – ${weekdayDate(entry.weekEnd)}` : ""}${entry.isFinals ? " · Final exam week" : ""}` : "This topic has no class date yet."));

      if (entry.manual) {
        const date = el("input", { type: "date", id: "detail-date", "data-focus-key": "detail-date" });
        date.value = entry.date || "";
        date.addEventListener("change", () => send({ op: "setField", index, field: "date", value: date.value }));
        region.appendChild(el("div", { class: "field" }, el("label", { for: "detail-date" }, "Date"), date,
          el("p", { class: "ws-hint" }, "Unscheduled topics can have any date, or none.")));
      }
      region.appendChild(textField("detail-topic", "Topic", "topic", entry, index));
      region.appendChild(textField("detail-prep", "Preparation/Reading", "preparation", entry, index));
      region.appendChild(textField("detail-due", "Assignment due", "due", entry, index));
      region.appendChild(textField("detail-notes", "Notes", "notes", entry, index, true));
      if (entry.date) {
        region.appendChild(checkbox("detail-noclass", "No class this day (closure)", entry.noClass, (value) => {
          report(send({ op: "setField", index, field: "noClass", value }), value ? "Marked as no class. Meetings are renumbered." : "Marked as a class day.");
        }));
      }

      const buttons = el("div", { class: "button-row" });
      const all = entries();
      const earlier = el("button", { type: "button", class: "btn btn-small", "data-focus-key": "move-earlier", disabled: index === 0 || null }, "Move topic earlier");
      const later = el("button", { type: "button", class: "btn btn-small", "data-focus-key": "move-later", disabled: index === all.length - 1 || null }, "Move topic later");
      earlier.addEventListener("click", () => moveTopic(index, -1));
      later.addEventListener("click", () => moveTopic(index, 1));
      buttons.append(earlier, later);
      if (entry.date && !entry.noClass) {
        const shift = el("button", { type: "button", class: "btn btn-small", "data-focus-key": "shift" }, "Shift topics later from here");
        shift.addEventListener("click", () => {
          const result = send({ op: "shift", index });
          report(result, result.overflow ? "Topics shifted one class later. The last topic became an unscheduled topic." : "Topics shifted one class later. This class is now empty.");
        });
        buttons.append(shift);
      }
      if (entry.manual) {
        const remove = el("button", { type: "button", class: "btn btn-small btn-danger", "data-focus-key": "remove-row" }, "Remove this topic");
        remove.addEventListener("click", () => {
          if (hasContent(entry) && !window.confirm("Remove this topic?")) return;
          state.selected = null;
          report(send({ op: "removeRow", index }), "Removed the topic.");
        });
        buttons.append(remove);
      }
      region.appendChild(buttons);
      if (entry.date && !entry.noClass) {
        region.appendChild(el("p", { class: "ws-hint" }, "Shift is for an unplanned closure such as a snow day: this class is emptied and every later topic moves to the next class."));
      }
      const add = el("button", { type: "button", class: "btn btn-small", "data-focus-key": "add-row" }, "Add an unscheduled topic");
      add.addEventListener("click", () => {
        const result = send({ op: "addRow" });
        if (result.ok) selectEntry(result.index, true);
      });
      region.appendChild(add);
    });
  }

  function moveTopic(index, direction) {
    const result = send({ op: "move", index, direction });
    if (!result.ok) {
      report(result);
      return;
    }
    state.selected = result.index;
    renderAll();
    const key = direction < 0 ? "move-earlier" : "move-later";
    const button = document.querySelector(`[data-focus-key="${key}"]`);
    (button && !button.disabled ? button : document.getElementById("detail-topic")).focus();
    announce(`Moved the topic to ${rowName(entries()[result.index])}.`);
  }

  /* ---------- Reuse last term's schedule ---------- */

  function sourceTopics(oldEntries) {
    return oldEntries
      .filter((entry) => !entry.noClass && hasContent(entry))
      .sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) : (a.date ? -1 : (b.date ? 1 : 0))));
  }

  /* Position of a dated row within its week (1st class of the week, 2nd, …). */
  function positionInWeek(list) {
    const counts = new Map();
    return list.map((entry) => {
      const key = entry.week;
      const position = (counts.get(key) || 0) + 1;
      counts.set(key, position);
      return `${entry.week}-${position}`;
    });
  }

  function computePlan() {
    const reuse = state.reuse;
    const targets = entries().map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.date && !entry.noClass);
    const sources = sourceTopics(reuse.entries);
    const pairs = [];
    const leftovers = [];

    if (reuse.mode === "week") {
      const sourceKeys = positionInWeek(sources.filter((entry) => entry.date));
      const targetKeys = positionInWeek(targets.map(({ entry }) => entry));
      const byKey = new Map(targets.map((target, i) => [targetKeys[i], target]));
      sources.forEach((source) => {
        const key = source.date ? sourceKeys[sources.filter((entry) => entry.date).indexOf(source)] : null;
        const target = key ? byKey.get(key) : null;
        if (target) {
          pairs.push({ source, target });
          byKey.delete(key);
        } else leftovers.push(source);
      });
    } else {
      const finalsSources = reuse.keepFinals ? sources.filter((entry) => entry.isFinals) : [];
      const finalsTargets = reuse.keepFinals ? targets.filter(({ entry }) => entry.isFinals) : [];
      const useFinals = finalsSources.length && finalsTargets.length;
      const regularSources = useFinals ? sources.filter((entry) => !entry.isFinals) : sources;
      const regularTargets = useFinals ? targets.filter(({ entry }) => !entry.isFinals) : targets;
      regularSources.forEach((source, i) => {
        if (i < regularTargets.length) pairs.push({ source, target: regularTargets[i] });
        else leftovers.push(source);
      });
      if (useFinals) {
        finalsSources.forEach((source, i) => {
          if (i < finalsTargets.length) pairs.push({ source, target: finalsTargets[i] });
          else leftovers.push(source);
        });
      }
    }
    const used = new Set(pairs.map((pair) => pair.target.index));
    const open = targets.filter((target) => !used.has(target.index));
    const replacing = pairs.filter((pair) => hasContent(pair.target.entry)).length;
    pairs.sort((a, b) => a.target.index - b.target.index);
    return { pairs, leftovers, open, replacing, sources, targets };
  }

  function renderReuse() {
    const body = document.getElementById("reuse-body");
    body.textContent = "";
    const reuse = state.reuse;

    if (!reuse.entries) {
      body.appendChild(el("p", null, "Choose last term’s syllabus file, saved from this builder (.json). It is read on this computer; nothing is uploaded. Its topics, readings, due items, and notes are laid onto this term’s class meetings. Dates and closures come from this term."));
      const input = el("input", { type: "file", id: "reuse-file", accept: ".json,application/json" });
      input.addEventListener("change", () => readReuseFile(input.files && input.files[0]));
      body.appendChild(el("div", { class: "field" }, el("label", { for: "reuse-file" }, "Saved syllabus file"), input));
      if (reuse.error) body.appendChild(el("p", { class: "notice notice-error", role: "alert" }, reuse.error));
      body.appendChild(dialogButtons([["Cancel", closeReuse, "btn"]]));
      return;
    }

    const hasTargets = entries().some((entry) => entry.date && !entry.noClass);
    body.appendChild(el("p", null, "From ", el("strong", null, reuse.label), "."));
    if (!hasTargets) {
      body.appendChild(el("p", { class: "notice notice-warning" }, "This term’s calendar has not been generated yet. Check the settings, then generate it so the topics have class meetings to go into."));
      const generate = el("button", { type: "button", class: "btn btn-primary" }, "Generate this term’s calendar");
      generate.addEventListener("click", () => {
        const result = send({ op: "generate" });
        if (!result.ok) {
          state.reuse.error = (result.errors || []).join(" ") || "The calendar could not be generated.";
        }
        renderReuse();
      });
      body.appendChild(generate);
      if (reuse.error) body.appendChild(el("p", { class: "notice notice-error", role: "alert" }, reuse.error));
      body.appendChild(dialogButtons([["Cancel", closeReuse, "btn"]]));
      return;
    }

    const mode = el("fieldset", { class: "field ws-radios" }, el("legend", null, "How to place the topics"),
      [["order", "In meeting order (1st class → 1st class)"], ["week", "By week and weekday (week 3, 2nd class → week 3, 2nd class)"]].map(([value, label]) => {
        const id = `reuse-mode-${value}`;
        const input = el("input", { type: "radio", name: "reuse-mode", id, value, checked: reuse.mode === value || null });
        input.addEventListener("change", () => { state.reuse.mode = value; renderReuse(); document.getElementById(id).focus(); });
        return el("span", { class: "ws-radio" }, input, el("label", { for: id }, label));
      }));
    body.appendChild(mode);
    if (reuse.mode === "order") {
      const keep = el("input", { type: "checkbox", id: "reuse-finals", checked: reuse.keepFinals || null });
      keep.addEventListener("change", () => { state.reuse.keepFinals = keep.checked; renderReuse(); document.getElementById("reuse-finals").focus(); });
      body.appendChild(el("div", { class: "field-check" }, keep, el("label", { for: "reuse-finals" }, "Keep final exam week topics in final exam week")));
    }

    const plan = computePlan();
    body.appendChild(el("div", { class: "ws-table-wrap ws-preview", role: "region", "aria-label": "Preview of placed topics", tabindex: "0" },
      el("table", { class: "ws-list" },
        el("caption", null, "Preview"),
        el("thead", null, el("tr", null,
          el("th", { scope: "col" }, "Last term"),
          el("th", { scope: "col" }, "Topic"),
          el("th", { scope: "col" }, "This term"))),
        el("tbody", null,
          plan.pairs.map(({ source, target }) => el("tr", { class: target.entry.isFinals ? "is-finals" : "" },
            el("td", null, source.date ? weekdayDate(source.date) : "Unscheduled"),
            el("td", null, source.topic || source.preparation || source.due || "(no topic)"),
            el("td", null, `${weekdayDate(target.entry.date)}${target.entry.isFinals ? " · finals" : ""}${hasContent(target.entry) ? " (replaces current topic)" : ""}`))),
          plan.leftovers.map((source) => el("tr", { class: "is-leftover" },
            el("td", null, source.date ? weekdayDate(source.date) : "Unscheduled"),
            el("td", null, source.topic || "(no topic)"),
            el("td", null, "Unscheduled topic")))))));

    const notes = [`${plan.pairs.length} of ${plan.sources.length} topics go into class meetings.`];
    if (plan.leftovers.length) notes.push(`${plan.leftovers.length} will be kept as unscheduled topics for you to place, so nothing is lost.`);
    if (plan.open.length) notes.push(`${plan.open.length} class meeting${plan.open.length === 1 ? "" : "s"} will be left open (${plan.open.slice(0, 6).map(({ entry }) => weekdayDate(entry.date)).join(", ")}${plan.open.length > 6 ? ", …" : ""}).`);
    if (plan.replacing) notes.push(`${plan.replacing} class meeting${plan.replacing === 1 ? " already has a topic that" : "s already have topics that"} will be replaced.`);
    body.appendChild(el("p", { class: "notice notice-info" }, notes.join(" ")));

    body.appendChild(dialogButtons([
      ["Cancel", closeReuse, "btn"],
      [`Place ${plan.pairs.length + plan.leftovers.length} topics`, () => applyReuse(plan), "btn btn-primary"]
    ]));
  }

  function dialogButtons(list) {
    return el("div", { class: "button-row ws-dialog-buttons" }, list.map(([text, handler, className]) => {
      const button = el("button", { type: "button", class: className }, text);
      button.addEventListener("click", handler);
      return button;
    }));
  }

  function readReuseFile(file) {
    if (!file) return;
    file.text().then((text) => {
      const result = send({ op: "readSyllabusFile", text });
      if (!result.ok) {
        state.reuse.error = result.message;
        renderReuse();
        return;
      }
      const usable = sourceTopics(result.entries).length;
      if (!usable) {
        state.reuse.error = "That syllabus has no calendar topics to reuse.";
        renderReuse();
        return;
      }
      state.reuse = { label: result.label || file.name, entries: result.entries, mode: "order", keepFinals: true, error: "" };
      renderReuse();
      announce(`Read ${usable} topics from ${file.name}. Review the preview.`);
    });
  }

  function applyReuse(plan) {
    if (plan.replacing && !window.confirm(`${plan.replacing} class meeting${plan.replacing === 1 ? " already has a topic" : "s already have topics"}. Replace ${plan.replacing === 1 ? "it" : "them"}?`)) return;
    const pick = (source) => Object.fromEntries(CONTENT_FIELDS.map((field) => [field, source[field] || ""]));
    const result = send({
      op: "reuse",
      plan: plan.pairs.map(({ source, target }) => Object.assign({ index: target.index }, pick(source))),
      leftovers: plan.leftovers.map(pick)
    });
    if (!report(result)) return;
    closeReuse();
    const message = `Placed ${plan.pairs.length} topics${plan.leftovers.length ? ` and kept ${plan.leftovers.length} as unscheduled topics` : ""}.`;
    flash(message);
    announce(message);
  }

  function openReuse() {
    state.reuse = { entries: null, error: "" };
    renderReuse();
    const dialog = document.getElementById("reuse-dialog");
    dialog.showModal();
    const input = document.getElementById("reuse-file");
    if (input) input.focus();
  }

  function closeReuse() {
    const dialog = document.getElementById("reuse-dialog");
    if (dialog.open) dialog.close();
    document.getElementById("ws-reuse").focus();
  }

  /* ---------- Shift dates (like D2L's date offset) ---------- */

  const DAY_MS = 86400000;
  const TEXT_DATE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/i;

  function daysBetween(fromISO, toISO) {
    const from = util.parseISODate(fromISO);
    const to = util.parseISODate(toISO);
    if (!from || !to) return null;
    return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / DAY_MS);
  }

  function addDays(value, days) {
    const date = util.parseISODate(value);
    if (!date) return value;
    return iso(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
  }

  function weekdayName(value) {
    const date = util.parseISODate(value);
    return date ? date.toLocaleDateString("en-US", { weekday: "long" }) : "";
  }

  function shiftDefaults() {
    const snap = state.snap;
    const classDates = entries().filter((entry) => entry.date && !entry.noClass).map((entry) => entry.date).sort();
    const firstClass = classDates[0] || "";
    const courseStart = snap.course.startDate || "";
    const today = iso(new Date());
    /* The course dates were already updated for the new term; the calendar is still on the old one. */
    if (firstClass && courseStart && daysBetween(firstClass, courseStart) > 30) {
      return { method: "dates", oldDate: firstClass, newDate: courseStart, days: "", shiftCourse: false };
    }
    /* Everything is from an earlier term: move the course dates too. */
    const oldDate = courseStart || firstClass;
    const suggested = snap.term && snap.term.startDate && snap.term.startDate > oldDate ? snap.term.startDate : "";
    return { method: "dates", oldDate, newDate: suggested, days: "", shiftCourse: Boolean(courseStart && courseStart < today) };
  }

  function shiftDays() {
    const shift = state.shift;
    if (shift.method === "days") {
      const value = Number(shift.days);
      return Number.isFinite(value) && shift.days !== "" ? Math.round(value) : null;
    }
    return daysBetween(shift.oldDate, shift.newDate);
  }

  function describeOffset(days) {
    if (days === null) return "Enter both dates to see how far the calendar will move.";
    if (days === 0) return "The two dates are the same, so nothing would move.";
    const direction = days > 0 ? "forward" : "back";
    const size = Math.abs(days);
    const weeks = size % 7 === 0 ? ` (${size / 7} week${size === 7 ? "" : "s"})` : ` (${Math.floor(size / 7)} weeks and ${size % 7} day${size % 7 === 1 ? "" : "s"})`;
    return `Every calendar date moves ${direction} by ${size} day${size === 1 ? "" : "s"}${weeks}.`;
  }

  function renderShift() {
    const body = document.getElementById("shift-body");
    const shift = state.shift;
    const snap = state.snap;
    body.textContent = "";
    body.appendChild(el("p", null, "Moves every date in the calendar by the same number of days, the way D2L offsets dates when a course is copied. Topics, readings, due items, and notes stay with their classes. Class times are set once for the course, under Credits, modality, and dates, so only dates move."));

    if (!entries().some((entry) => entry.date)) {
      body.appendChild(el("p", { class: "notice notice-warning" }, "There are no calendar dates to move yet."));
      body.appendChild(dialogButtons([["Close", closeShift, "btn"]]));
      return;
    }

    const method = el("fieldset", { class: "field ws-radios" }, el("legend", null, "How far to move the dates"),
      [["dates", "By the difference between two dates"], ["days", "By a number of days"]].map(([value, label]) => {
        const id = `shift-method-${value}`;
        const input = el("input", { type: "radio", name: "shift-method", id, value, checked: shift.method === value || null });
        input.addEventListener("change", () => { state.shift.method = value; renderShift(); document.getElementById(id).focus(); });
        return el("span", { class: "ws-radio" }, input, el("label", { for: id }, label));
      }));
    body.appendChild(method);

    if (shift.method === "dates") {
      const oldInput = el("input", { type: "date", id: "shift-old", "aria-describedby": "shift-old-hint" });
      oldInput.value = shift.oldDate || "";
      const newInput = el("input", { type: "date", id: "shift-new", "aria-describedby": "shift-new-hint" });
      newInput.value = shift.newDate || "";
      oldInput.addEventListener("change", () => { state.shift.oldDate = oldInput.value; renderShift(); document.getElementById("shift-old").focus(); });
      newInput.addEventListener("change", () => { state.shift.newDate = newInput.value; renderShift(); document.getElementById("shift-new").focus(); });
      const termHint = snap.term && snap.term.startDate
        ? `The college calendar starts ${snap.term.term} ${snap.term.year} on ${longDate(snap.term.startDate)}.`
        : "Usually the new term’s first day of class.";
      body.appendChild(el("div", { class: "ws-shift-dates" },
        el("div", { class: "field" }, el("label", { for: "shift-old" }, "Old date (for example, the first day of class last time)"), oldInput,
          el("p", { class: "ws-hint", id: "shift-old-hint" }, shift.oldDate ? `${weekdayName(shift.oldDate)}` : "")),
        el("div", { class: "field" }, el("label", { for: "shift-new" }, "New date (the same day in the new term)"), newInput,
          el("p", { class: "ws-hint", id: "shift-new-hint" }, `${shift.newDate ? `${weekdayName(shift.newDate)}. ` : ""}${termHint}`))));
    } else {
      const daysInput = el("input", { type: "number", id: "shift-days", step: "1", inputmode: "numeric", "aria-describedby": "shift-days-hint" });
      daysInput.value = shift.days;
      daysInput.addEventListener("input", () => { state.shift.days = daysInput.value; renderShiftSummary(); });
      body.appendChild(el("div", { class: "field ws-narrow" }, el("label", { for: "shift-days" }, "Number of days"), daysInput,
        el("p", { class: "ws-hint", id: "shift-days-hint" }, "Use a negative number to move dates earlier. 364 days (52 weeks) keeps every class on the same weekday one year later.")));
    }

    const course = el("input", { type: "checkbox", id: "shift-course", checked: shift.shiftCourse || null });
    course.addEventListener("change", () => { state.shift.shiftCourse = course.checked; renderShiftSummary(); });
    body.appendChild(el("div", { class: "field-check" }, course,
      el("label", { for: "shift-course" }, "Also move the course begin, end, drop, and withdrawal dates"),
      el("p", { class: "ws-hint" }, `Now ${snap.course.startDate ? `${longDate(snap.course.startDate)} – ${longDate(snap.course.endDate)}` : "not entered"}. Leave this off if you already used Fill in these dates for the new term.`)));

    const closures = el("input", { type: "checkbox", id: "shift-closures", checked: (shift.replaceClosures && snap.term) || null, disabled: !snap.term || null });
    closures.addEventListener("change", () => { state.shift.replaceClosures = closures.checked; renderShiftSummary(); });
    body.appendChild(el("div", { class: "field-check" }, closures,
      el("label", { for: "shift-closures" }, snap.term ? `Replace the old no-class dates with the college’s dates for ${snap.term.term} ${snap.term.year}` : "Replace the old no-class dates with the college’s dates"),
      el("p", { class: "ws-hint" }, snap.term
        ? "Otherwise your no-class dates move by the same number of days, which rarely matches the new term’s holidays."
        : "Choose the new term and year under Course in the builder first, so the college’s no-class dates can be used.")));

    body.appendChild(meetingFields());

    body.appendChild(el("div", { id: "shift-summary", "aria-live": "polite" }));
    body.appendChild(el("div", { id: "shift-buttons" }));
    renderShiftSummary();
  }

  function timeRange(start, end) {
    const from = util.formatTime(start);
    const to = util.formatTime(end);
    return from && to ? `${from}–${to}` : (from || "no time set");
  }

  /* Class time and room often change from one term to the next; dates alone are not enough. */
  function meetingFields() {
    const course = state.snap.course;
    const shift = state.shift;
    const online = course.modality === "online";
    const fields = el("fieldset", { class: "field ws-meeting" },
      el("legend", null, "Class time and room for the new term"),
      el("p", { class: "ws-hint" }, shift.originalMeeting
        ? `From the saved syllabus: ${shift.originalMeeting}. Change them here if they are different this term; they are saved to the syllabus as you change them.`
        : "Change them here if they are different this term; they are saved to the syllabus as you change them."));
    if (online && !course.startTime && !course.endTime) {
      fields.appendChild(el("p", { class: "ws-hint" }, "This is an exclusively online course, so it has no class times."));
      return fields;
    }
    const start = el("input", { type: "time", id: "shift-start-time" });
    const end = el("input", { type: "time", id: "shift-end-time" });
    const room = el("input", { type: "text", id: "shift-room", autocomplete: "off" });
    start.value = course.startTime || "";
    end.value = course.endTime || "";
    room.value = course.location || "";
    const status = el("p", { class: "ws-hint", id: "shift-meeting-status", "aria-live": "polite" });
    const save = () => {
      const result = send({ op: "setMeeting", startTime: start.value, endTime: end.value, location: room.value.trim() });
      if (result.ok) status.textContent = `Saved: ${timeRange(start.value, end.value)}${room.value.trim() ? `, room ${room.value.trim()}` : ""}.`;
    };
    start.addEventListener("change", save);
    end.addEventListener("change", save);
    room.addEventListener("change", save);
    fields.appendChild(el("div", { class: "ws-meeting-row" },
      el("div", null, el("label", { for: "shift-start-time" }, "Start time"), start),
      el("div", null, el("label", { for: "shift-end-time" }, "End time"), end),
      el("div", null, el("label", { for: "shift-room" }, "Room"), room)));
    fields.appendChild(status);
    return fields;
  }

  function renderShiftSummary() {
    const summary = document.getElementById("shift-summary");
    const buttonsBox = document.getElementById("shift-buttons");
    if (!summary) return;
    const days = shiftDays();
    const shift = state.shift;
    const snap = state.snap;
    summary.textContent = "";
    buttonsBox.textContent = "";
    summary.appendChild(el("p", { class: "ws-offset" }, describeOffset(days)));

    if (days !== null && days !== 0) {
      const sample = entries().find((entry) => entry.date && !entry.noClass);
      if (sample && days % 7 !== 0) {
        summary.appendChild(el("p", { class: "notice notice-warning" },
          `Classes will move to different weekdays: ${weekdayName(sample.date)} becomes ${weekdayName(addDays(sample.date, days))}. To keep the same weekdays, use a multiple of 7 days, or use Reuse last term’s schedule instead.`));
      }
      /* Preview, with the closures the new dates will be checked against. */
      const closed = new Map();
      if (shift.replaceClosures && snap.term) snap.term.noClassDates.forEach((item) => closed.set(item.date, item.label));
      else (snap.calendar.excludedDates || []).forEach((item) => closed.set(addDays(item.date, days), item.label || "No class"));
      const start = shift.shiftCourse ? addDays(snap.course.startDate, days) : snap.course.startDate;
      const end = shift.shiftCourse ? addDays(snap.course.endDate, days) : snap.course.endDate;
      const moving = entries().filter((entry) => entry.date && !(entry.noClass && !["topic", "preparation", "due"].some((field) => String(entry[field] || "").trim())));
      const rows = moving.map((entry) => {
        const next = addDays(entry.date, days);
        let problem = "";
        if (!entry.noClass && closed.has(next)) problem = `No class: ${closed.get(next)}`;
        else if (!entry.noClass && ((start && next < start) || (end && next > end))) problem = "Outside the course dates";
        return { entry, next, problem };
      });
      const problems = rows.filter((row) => row.problem);
      const textDates = entries().filter((entry) => CONTENT_FIELDS.some((field) => TEXT_DATE.test(String(entry[field] || ""))));

      summary.appendChild(el("div", { class: "ws-table-wrap ws-preview", role: "region", "aria-label": "Preview of moved dates", tabindex: "0" },
        el("table", { class: "ws-list" },
          el("caption", null, `Preview (${rows.length} dates)`),
          el("thead", null, el("tr", null, el("th", { scope: "col" }, "Topic"), el("th", { scope: "col" }, "Old date"), el("th", { scope: "col" }, "New date"), el("th", { scope: "col" }, "Check"))),
          el("tbody", null, rows.map((row) => el("tr", { class: row.problem ? "is-leftover" : "" },
            el("td", null, row.entry.noClass ? "No class" : (row.entry.topic || "(no topic)")),
            el("td", null, weekdayDate(row.entry.date)),
            el("td", null, weekdayDate(row.next)),
            el("td", null, row.problem || "—")))))));

      const notes = [`${rows.length} dates will move.`];
      if (problems.length) notes.push(`${problems.length} class${problems.length === 1 ? "" : "es"} would land on a no-class date or outside the course; after shifting, use Generate calendar again (topics on those days become unscheduled topics) or Shift topics later.`);
      if (textDates.length) notes.push(`${textDates.length} row${textDates.length === 1 ? " has" : "s have"} a date typed in its text (for example “due 9/14”). Those are not changed; update them by hand.`);
      if (!shift.shiftCourse && start && rows.length && !rows.some((row) => !row.entry.noClass && row.next >= start && row.next <= end)) {
        notes.push("None of the moved dates fall within the course dates. Check the old and new dates, or also move the course dates.");
      }
      summary.appendChild(el("p", { class: `notice ${problems.length || textDates.length ? "notice-warning" : "notice-info"}` }, notes.join(" ")));
    }

    const ready = days !== null && days !== 0 && Math.abs(days) <= 3660;
    const apply = el("button", { type: "button", class: "btn btn-primary", disabled: !ready || null }, ready ? `Move ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ${days > 0 ? "later" : "earlier"}` : "Move dates");
    apply.addEventListener("click", () => applyShift(days));
    const cancel = el("button", { type: "button", class: "btn" }, "Cancel");
    cancel.addEventListener("click", closeShift);
    buttonsBox.appendChild(el("div", { class: "button-row ws-dialog-buttons" }, cancel, apply));
  }

  function applyShift(days) {
    const shift = state.shift;
    const result = send({ op: "shiftDates", days, shiftCourse: shift.shiftCourse, replaceClosures: Boolean(shift.replaceClosures && state.snap.term) });
    if (!report(result)) return;
    closeShift();
    state.month = null;
    renderAll();
    const parts = [`Moved ${result.moved} date${result.moved === 1 ? "" : "s"} ${days > 0 ? "later" : "earlier"} by ${Math.abs(days)} days.`];
    const course = state.snap.course;
    if (course.modality !== "online" || course.startTime) {
      parts.push(`Class time: ${timeRange(course.startTime, course.endTime)}${course.location ? `, room ${course.location}` : ""}.`);
    }
    if (result.replacedClosures) parts.push(`Added ${result.closuresAdded} college no-class date${result.closuresAdded === 1 ? "" : "s"}.`);
    const warnings = [];
    if (result.conflicts.length) warnings.push(`${result.conflicts.length} class${result.conflicts.length === 1 ? " falls" : "es fall"} on a no-class date: ${result.conflicts.slice(0, 5).map((item) => `${weekdayDate(item.date)} (${item.label})`).join("; ")}${result.conflicts.length > 5 ? "; …" : ""}. Use Generate calendar again or Shift topics later.`);
    if (result.outside.length) warnings.push(`${result.outside.length} class${result.outside.length === 1 ? " is" : "es are"} outside the course dates.`);
    flash(parts.join(" "), warnings);
    announce(parts.join(" ") + (warnings.length ? " Some classes need attention; see the notes under Settings." : ""));
  }

  function openShift() {
    if (!state.snap) return;
    const course = state.snap.course;
    const savedTime = course.startTime || course.endTime ? timeRange(course.startTime, course.endTime) : "";
    const originalMeeting = [savedTime, course.location ? `room ${course.location}` : ""].filter(Boolean).join(", ");
    state.shift = Object.assign({ replaceClosures: true, originalMeeting }, shiftDefaults());
    renderShift();
    const dialog = document.getElementById("shift-dialog");
    if (!dialog.open) dialog.showModal();
    const first = document.getElementById(state.shift.method === "dates" ? (state.shift.newDate ? "shift-old" : "shift-new") : "shift-days");
    if (first) first.focus();
  }

  function closeShift() {
    const dialog = document.getElementById("shift-dialog");
    if (dialog.open) dialog.close();
    document.getElementById("ws-shift").focus();
  }

  function checkRequestedTool() {
    const tool = (state.bridge && state.bridge.takePendingTool) ? state.bridge.takePendingTool() : "";
    if (tool === "shift") openShift();
  }

  /* ---------- Everything ---------- */

  function renderAll() {
    if (!state.snap) return;
    renderHeader();
    renderSettings();
    renderMain();
    renderDetail();
  }

  function setView(view) {
    state.view = view;
    renderMain();
    announce(view === "month" ? "Month view." : "List view.");
  }

  function close() {
    if (embedded && state.bridge) {
      state.bridge.closeEmbedded();
      return;
    }
    try {
      if (window.opener && !window.opener.closed) window.opener.focus();
    } catch (error) {
      /* the builder is gone; just close */
    }
    window.close();
  }

  function init() {
    document.body.classList.toggle("is-embedded", embedded);
    document.getElementById("ws-close").textContent = embedded ? "Close and return to the builder" : "Back to the builder";
    state.bridge = findBridge();
    if (!state.bridge) {
      document.getElementById("ws-course").textContent = "Open the course calendar from the syllabus builder.";
      document.getElementById("ws-link-text").textContent = "Not connected";
      document.getElementById("ws-lost").textContent = "This page works only when opened from the syllabus builder (Course calendar → Open the calendar workspace).";
      document.getElementById("ws-lost").hidden = false;
      document.querySelectorAll("button").forEach((button) => { if (button.id !== "ws-close") button.disabled = true; });
      document.getElementById("ws-close").addEventListener("click", close);
      return;
    }
    document.getElementById("ws-link-text").textContent = embedded
      ? "Part of your syllabus · edits appear in the builder as you type"
      : "Linked to your syllabus in the builder window · edits appear there as you type";

    const unsubscribe = state.bridge.subscribe(onBuilderChange);
    window.addEventListener("pagehide", () => { try { unsubscribe(); } catch (error) { /* builder gone */ } });
    window.setInterval(() => { if (!state.lost && !builderAlive()) markLost(); }, 2000);

    document.getElementById("view-month").addEventListener("click", () => setView("month"));
    document.getElementById("view-list").addEventListener("click", () => setView("list"));
    document.getElementById("month-prev").addEventListener("click", () => {
      state.month = { year: state.month.year, month: state.month.month - 1 };
      if (state.month.month < 0) state.month = { year: state.month.year - 1, month: 11 };
      renderMain();
      const prev = document.getElementById("month-prev");
      (prev.disabled ? document.getElementById("month-next") : prev).focus();
    });
    document.getElementById("month-next").addEventListener("click", () => {
      state.month = { year: state.month.year, month: state.month.month + 1 };
      if (state.month.month > 11) state.month = { year: state.month.year + 1, month: 0 };
      renderMain();
      const next = document.getElementById("month-next");
      (next.disabled ? document.getElementById("month-prev") : next).focus();
    });
    document.getElementById("ws-reuse").addEventListener("click", openReuse);
    document.getElementById("ws-shift").addEventListener("click", openShift);
    document.getElementById("ws-close").addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && embedded && !document.getElementById("reuse-dialog").open && !document.getElementById("shift-dialog").open) close();
    });

    readSnapshot();
    renderAll();
    announce("Course calendar workspace ready.");
    if (new URLSearchParams(window.location.search).get("tool") === "shift") openShift();
    else checkRequestedTool();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
