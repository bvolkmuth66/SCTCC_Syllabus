/*
 * SCTCC Syllabus Builder — institutional content loader
 *
 * 1. Reads content/content-manifest.json.
 * 2. Fetches every listed fragment (enabled or not, so toggling needs no refetch).
 * 3. Reads the curator header comment (OWNER, LAST-REVIEWED, VERSION).
 * 4. Sanitizes the HTML with an allowlist. Scripts never run: DOMParser does not
 *    execute them, and the sanitizer drops them before anything reaches the page.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  /* Tags kept as-is. Anything not listed is unwrapped (its text is kept). */
  const ALLOWED_TAGS = new Set([
    "P", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A", "BR",
    "H4", "H5", "SPAN", "BLOCKQUOTE", "ABBR", "CODE"
  ]);

  /* Tags removed together with everything inside them. */
  const DROPPED_TAGS = new Set([
    "SCRIPT", "STYLE", "IFRAME", "FRAME", "OBJECT", "EMBED", "FORM", "INPUT",
    "BUTTON", "TEXTAREA", "SELECT", "OPTION", "TEMPLATE", "LINK", "META",
    "NOSCRIPT", "SVG", "MATH", "IMG", "PICTURE", "VIDEO", "AUDIO", "CANVAS",
    "BASE", "HEAD", "TITLE"
  ]);

  const ALLOWED_CLASSES = new Set(["mission"]);
  const SAFE_HREF = /^(https?:|mailto:|tel:|#)/i;
  const SAFE_FILE_NAME = /^[a-z0-9][a-z0-9-]*\.html$/;
  const FIELD_NAME = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/;

  class ContentLoadError extends Error {
    constructor(message) {
      super(message);
      this.name = "ContentLoadError";
    }
  }

  function resolveBaseUrl(config) {
    return new URL(config.contentBaseUrl || "./content/", window.location.href);
  }

  async function fetchText(url) {
    let response;
    try {
      response = await fetch(url, { cache: "no-cache" });
    } catch (networkError) {
      if (window.location.protocol === "file:") {
        throw new ContentLoadError(
          "The page was opened directly from a file. Browsers block loading content this way; " +
          "open it through GitHub Pages or a local web server (see the README)."
        );
      }
      throw new ContentLoadError("The file could not be reached. Check your connection and the content address.");
    }
    if (!response.ok) {
      throw new ContentLoadError(`The server answered ${response.status} (${response.statusText || "error"}).`);
    }
    return response.text();
  }

  function validateManifest(manifest) {
    const problems = [];
    if (!manifest || typeof manifest !== "object") {
      return ["The manifest is not a JSON object."];
    }
    if (!Array.isArray(manifest.sections)) {
      return ["The manifest has no \"sections\" list."];
    }
    const seen = new Set();
    manifest.sections.forEach((section, index) => {
      const label = section && section.id ? `"${section.id}"` : `#${index + 1}`;
      if (!section || typeof section.id !== "string" || !section.id) {
        problems.push(`Section ${label} has no id.`);
        return;
      }
      if (seen.has(section.id)) problems.push(`Section ${label} is listed more than once.`);
      seen.add(section.id);
      if (typeof section.file !== "string" || !SAFE_FILE_NAME.test(section.file)) {
        problems.push(`Section ${label} has an invalid file name. Use lowercase letters, numbers, and hyphens ending in .html.`);
      }
      if (typeof section.placement !== "string" || !section.placement) {
        problems.push(`Section ${label} has no placement.`);
      }
    });
    return problems;
  }

  async function loadManifest(config) {
    const url = new URL(config.manifestFile || "content-manifest.json", resolveBaseUrl(config));
    const text = await fetchText(url);
    let manifest;
    try {
      manifest = JSON.parse(text);
    } catch (parseError) {
      throw new ContentLoadError("content-manifest.json is not valid JSON. Check for a missing comma or quotation mark.");
    }
    const problems = validateManifest(manifest);
    if (problems.length && !Array.isArray(manifest.sections)) {
      throw new ContentLoadError(problems.join(" "));
    }
    return { manifest, problems };
  }

  /* Read "KEY: value" lines from the first HTML comment in a fragment. */
  function readCuratorHeader(text) {
    const meta = {};
    const match = /<!--([\s\S]*?)-->/.exec(text);
    if (!match) return meta;
    match[1].split(/\r?\n/).forEach((line) => {
      const pair = /^\s*([A-Z][A-Z-]*)\s*:\s*(.+?)\s*$/.exec(line);
      if (pair && ["SECTION", "OWNER", "LAST-REVIEWED", "VERSION", "SOURCE"].includes(pair[1])) {
        meta[pair[1].toLowerCase()] = pair[2];
      }
    });
    return meta;
  }

  function copySafeAttributes(source, target) {
    const tag = source.tagName;
    if (tag === "A") {
      const href = (source.getAttribute("href") || "").trim();
      if (SAFE_HREF.test(href)) target.setAttribute("href", href);
      const title = source.getAttribute("title");
      if (title) target.setAttribute("title", title);
    }
    if (tag === "ABBR") {
      const title = source.getAttribute("title");
      if (title) target.setAttribute("title", title);
    }
    if (tag === "SPAN") {
      const field = source.getAttribute("data-field");
      if (field && FIELD_NAME.test(field)) {
        target.setAttribute("data-field", field);
        const format = source.getAttribute("data-format");
        if (format === "date" || format === "date-short") target.setAttribute("data-format", format);
        const fallback = source.getAttribute("data-default");
        if (fallback) target.setAttribute("data-default", fallback.slice(0, 200));
      }
    }
    if (tag === "OL") {
      const type = source.getAttribute("type");
      if (type && /^[1aAiI]$/.test(type)) target.setAttribute("type", type);
    }
    const classes = (source.getAttribute("class") || "").split(/\s+/).filter((name) => ALLOWED_CLASSES.has(name));
    if (classes.length) target.setAttribute("class", classes.join(" "));
  }

  function sanitizeInto(sourceParent, targetParent) {
    sourceParent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        targetParent.appendChild(document.createTextNode(node.nodeValue));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return; /* comments and others are dropped */
      const tag = node.tagName.toUpperCase();
      if (DROPPED_TAGS.has(tag)) return;
      if (!ALLOWED_TAGS.has(tag)) {
        sanitizeInto(node, targetParent); /* unwrap unknown tags, keep their text */
        return;
      }
      const clean = document.createElement(tag.toLowerCase());
      copySafeAttributes(node, clean);
      sanitizeInto(node, clean);
      targetParent.appendChild(clean);
    });
  }

  /* Returns a DocumentFragment containing only allowlisted markup. */
  function sanitizeFragmentHtml(htmlText) {
    const parsed = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${htmlText}</body></html>`, "text/html");
    const output = document.createDocumentFragment();
    sanitizeInto(parsed.body, output);
    return output;
  }

  async function loadSection(definition, baseUrl) {
    const result = { definition, fragment: null, meta: {}, error: null };
    if (typeof definition.file !== "string" || !SAFE_FILE_NAME.test(definition.file)) {
      result.error = "The manifest lists an invalid file name for this section.";
      return result;
    }
    try {
      const text = await fetchText(new URL(definition.file, baseUrl));
      result.meta = readCuratorHeader(text);
      result.fragment = sanitizeFragmentHtml(text);
      if (!result.fragment.textContent.trim()) {
        result.error = "The file loaded but contains no text.";
      }
    } catch (error) {
      result.error = error instanceof ContentLoadError ? error.message : "The file could not be loaded.";
    }
    return result;
  }

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const TERM_DATE_FIELDS = ["startDate", "endDate", "finalsStart", "finalsEnd", "lastDayToDrop", "lastDayToWithdraw"];

  /*
   * Check the academic calendar file. Bad entries are skipped and reported;
   * the rest is kept. Returns { calendar, problems[] }.
   */
  function validateAcademicCalendar(raw) {
    const problems = [];
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.terms)) {
      return { calendar: null, problems: ["academic-calendar.json has no \"terms\" list."] };
    }
    const terms = [];
    raw.terms.forEach((term, index) => {
      const name = term && term.term && term.year ? `${term.term} ${term.year}` : `term #${index + 1}`;
      if (!term || typeof term.term !== "string" || !String(term.year || "").trim()) {
        problems.push(`Academic calendar: ${name} needs a "term" and a "year"; it was skipped.`);
        return;
      }
      const clean = { term: term.term.trim(), year: String(term.year).trim(), verified: term.verified === true, noClassDates: [] };
      let valid = true;
      TERM_DATE_FIELDS.forEach((fieldName) => {
        const value = term[fieldName];
        if (value === undefined || value === null || value === "") {
          clean[fieldName] = "";
        } else if (typeof value === "string" && ISO_DATE.test(value)) {
          clean[fieldName] = value;
        } else {
          problems.push(`Academic calendar: ${name} "${fieldName}" should be a date like 2027-01-11.`);
          clean[fieldName] = "";
        }
      });
      if (!clean.startDate || !clean.endDate) {
        problems.push(`Academic calendar: ${name} needs a start and end date; it was skipped.`);
        valid = false;
      }
      (Array.isArray(term.noClassDates) ? term.noClassDates : []).forEach((item) => {
        if (item && typeof item.date === "string" && ISO_DATE.test(item.date)) {
          clean.noClassDates.push({ date: item.date, label: typeof item.label === "string" ? item.label.trim() : "" });
        } else {
          problems.push(`Academic calendar: ${name} has a no-class date that is not a date like 2027-01-18.`);
        }
      });
      if (valid) terms.push(clean);
    });
    return {
      calendar: {
        status: ["official", "published"].includes(raw.status) ? raw.status : "sample",
        lastReviewed: typeof raw.lastReviewed === "string" ? raw.lastReviewed : "",
        owner: typeof raw.owner === "string" ? raw.owner : "",
        terms
      },
      problems
    };
  }

  async function loadAcademicCalendar(fileName, baseUrl) {
    if (typeof fileName !== "string" || !/^[a-z0-9][a-z0-9-]*\.json$/.test(fileName)) {
      return { calendar: null, problems: ["The manifest lists an invalid academic calendar file name."] };
    }
    try {
      const text = await fetchText(new URL(fileName, baseUrl));
      let raw;
      try {
        raw = JSON.parse(text);
      } catch (parseError) {
        return { calendar: null, problems: [`${fileName} is not valid JSON. Check for a missing comma or quotation mark.`] };
      }
      return validateAcademicCalendar(raw);
    } catch (error) {
      return { calendar: null, problems: [`${fileName}: ${error instanceof ContentLoadError ? error.message : "could not be loaded."}`] };
    }
  }

  /* The college default grading scale (content/grading-scale.json). */
  async function loadGradingScale(fileName, baseUrl) {
    if (typeof fileName !== "string" || !/^[a-z0-9][a-z0-9-]*\.json$/.test(fileName)) {
      return { scale: null, problems: ["The manifest lists an invalid grading scale file name."] };
    }
    try {
      const text = await fetchText(new URL(fileName, baseUrl));
      let raw;
      try {
        raw = JSON.parse(text);
      } catch (parseError) {
        return { scale: null, problems: [`${fileName} is not valid JSON. Check for a missing comma or quotation mark.`] };
      }
      const rows = raw && Array.isArray(raw.scale) ? raw.scale : null;
      const scale = rows && rows.every((row) => row && typeof row.label === "string" && Number.isFinite(row.minPercent) && Number.isFinite(row.maxPercent))
        ? rows.map((row) => ({ label: row.label.trim(), minPercent: row.minPercent, maxPercent: row.maxPercent }))
        : null;
      if (!scale || !scale.length) return { scale: null, problems: [`${fileName} has no usable "scale" list.`] };
      const check = window.SCTCC.grading ? window.SCTCC.grading.validateScale(scale) : { errors: [] };
      if (check.errors.length) return { scale: null, problems: check.errors.map((message) => `${fileName}: ${message}`) };
      return { scale, problems: [] };
    } catch (error) {
      return { scale: null, problems: [`${fileName}: ${error instanceof ContentLoadError ? error.message : "could not be loaded."}`] };
    }
  }

  /*
   * Load the manifest and all fragments.
   * Never throws: problems are returned in `errors` so the page can show them
   * to instructors without exposing raw JavaScript errors to students.
   */
  async function loadContent(config) {
    const outcome = { manifest: null, sections: [], errors: [], academicCalendar: null, gradingScale: null };
    try {
      const { manifest, problems } = await loadManifest(config);
      outcome.manifest = manifest;
      problems.forEach((problem) => outcome.errors.push(`Manifest: ${problem}`));
    } catch (error) {
      outcome.errors.push(
        `Manifest: ${error instanceof ContentLoadError ? error.message : "The content list could not be loaded."}`
      );
      return outcome;
    }

    const baseUrl = resolveBaseUrl(config);
    const definitions = outcome.manifest.sections.filter((section) => section && section.id);
    outcome.sections = await Promise.all(definitions.map((definition) => loadSection(definition, baseUrl)));
    outcome.sections.forEach((section) => {
      if (section.error) outcome.errors.push(`${section.definition.title || section.definition.id} (${section.definition.file}): ${section.error}`);
    });

    if (outcome.manifest.academicCalendarFile) {
      const academic = await loadAcademicCalendar(outcome.manifest.academicCalendarFile, baseUrl);
      outcome.academicCalendar = academic.calendar;
      outcome.errors.push(...academic.problems);
    }
    if (outcome.manifest.gradingScaleFile) {
      const grades = await loadGradingScale(outcome.manifest.gradingScaleFile, baseUrl);
      outcome.gradingScale = grades.scale;
      outcome.errors.push(...grades.problems);
    }
    return outcome;
  }

  /*
   * Fill <span data-field="..."> tokens with instructor data.
   * `resolve(field, format)` returns a string; an empty string means no value.
   * With no value, data-default (if present) is used; otherwise the token is
   * marked as missing. Values are inserted with textContent, never as HTML.
   */
  function applyFieldTokens(root, resolve, describeMissing) {
    root.querySelectorAll("span[data-field]").forEach((span) => {
      const field = span.getAttribute("data-field");
      const value = resolve(field, span.getAttribute("data-format"));
      const fallback = span.getAttribute("data-default");
      if (value) {
        span.textContent = value;
        span.classList.remove("missing-value");
      } else if (fallback) {
        span.textContent = fallback;
        span.classList.remove("missing-value");
      } else {
        span.textContent = `[${describeMissing(field)} needed]`;
        span.classList.add("missing-value");
      }
    });
  }

  window.SCTCC.contentLoader = Object.freeze({
    loadContent,
    validateAcademicCalendar,
    sanitizeFragmentHtml,
    applyFieldTokens
  });
})();
