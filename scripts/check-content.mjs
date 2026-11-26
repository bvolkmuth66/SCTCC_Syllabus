#!/usr/bin/env node
/*
 * SCTCC Syllabus Builder — college content check
 *
 * Runs on every pull request that changes the content/ folder (see
 * .github/workflows/check-content.yml), and can be run locally:
 *
 *   node scripts/check-content.mjs                # structure and wording checks
 *   node scripts/check-content.mjs --check-links  # also test that web links respond
 *
 * Errors fail the check. Warnings are shown but do not fail it.
 * No packages are needed (Node 18 or later).
 */
import { readFile, readdir, access } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const CHECK_LINKS = process.argv.includes("--check-links");
const IN_ACTIONS = process.env.GITHUB_ACTIONS === "true";

const ALLOWED_TAGS = new Set(["p", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "br", "h4", "h5", "span", "blockquote", "abbr", "code"]);
const FORBIDDEN_TAGS = new Set(["script", "style", "iframe", "frame", "object", "embed", "form", "input", "button", "textarea", "select", "template", "link", "meta", "noscript", "svg", "math", "img", "picture", "video", "audio", "canvas", "base"]);
const VOID_TAGS = new Set(["br"]);
const VAGUE_LINK_TEXT = /^(here|click here|link|this link|more|read more)$/i;
const PLACEHOLDERS = [/\bXXX+\b/, /\bYOUR (COURSE )?NAME\b/, /\bGIVE (WITHDRAWAL )?DATE\b/, /\bGIVE TIME\b/, /\bLIST ASSIGNMENT\b/, /\bDATE & TIME\b/, /\bTBD\b/];
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const findings = [];
const links = new Map(); /* url -> [file, line] */

function report(level, file, line, message) {
  findings.push({ level, file: relative(ROOT, file), line, message });
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function isRealDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/* ---------- One content fragment ---------- */

function checkFragment(file, text) {
  /* Curator header comment */
  const header = /^\s*<!--([\s\S]*?)-->/.exec(text);
  if (!header) {
    report("warning", file, 1, "The file should start with the comment block that names the OWNER, LAST-REVIEWED date, and VERSION.");
  } else {
    const fields = Object.fromEntries(header[1].split(/\r?\n/)
      .map((line) => /^\s*([A-Z][A-Z-]*)\s*:\s*(.+?)\s*$/.exec(line))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]));
    if (!fields.OWNER) report("warning", file, 1, "The header comment has no OWNER line.");
    if (!fields["LAST-REVIEWED"]) report("warning", file, 1, "The header comment has no LAST-REVIEWED line.");
    else if (!isRealDate(fields["LAST-REVIEWED"])) report("error", file, 1, `LAST-REVIEWED "${fields["LAST-REVIEWED"]}" should be a date like 2026-07-01.`);
    if (!fields.VERSION) report("warning", file, 1, "The header comment has no VERSION line.");
  }

  /* Everything after comments is checked as markup */
  const body = text.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, " "));

  const stack = [];
  const tagPattern = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let match;
  while ((match = tagPattern.exec(body))) {
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    const attributes = match[3] || "";
    const line = lineOf(body, match.index);

    if (FORBIDDEN_TAGS.has(tag)) {
      if (!closing) report("error", file, line, `<${tag}> is not allowed in college content. It would be removed, so remove it or ask the builder's maintainer.`);
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      if (!closing) report("warning", file, line, `<${tag}> is not one of the allowed tags; the builder keeps its text but drops the tag.`);
      continue;
    }
    if (!closing) {
      if (/\son[a-z]+\s*=/i.test(attributes)) report("error", file, line, `<${tag}> has an "on…" event attribute. Scripts are not allowed.`);
      if (/\sstyle\s*=/i.test(attributes)) report("warning", file, line, `<${tag}> has a style attribute; the builder removes it.`);
      if (tag === "a") {
        const href = /\shref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attributes);
        const url = href ? (href[2] ?? href[3] ?? "").trim() : "";
        if (!url) report("error", file, line, "A link has no href (web address).");
        else if (/^javascript:/i.test(url)) report("error", file, line, "javascript: links are not allowed.");
        else if (/^http:\/\//i.test(url)) report("warning", file, line, `Link uses http:// instead of https:// — ${url}`);
        else if (!/^(https:\/\/|mailto:|tel:|#)/i.test(url)) report("error", file, line, `Link address must start with https://, mailto:, tel:, or # — ${url}`);
        if (/^https?:\/\//i.test(url) && !links.has(url)) links.set(url, [file, line]);
        const close = body.indexOf("</a>", match.index);
        const linkText = close > 0 ? body.slice(match.index + match[0].length, close).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
        if (VAGUE_LINK_TEXT.test(linkText)) report("warning", file, line, `Link text "${linkText}" does not say where the link goes. Use text that says where the link goes.`);
      }
      if (tag === "span") {
        const field = /\sdata-field\s*=\s*"([^"]*)"/i.exec(attributes);
        if (field && !FIELD_NAME.test(field[1])) report("error", file, line, `data-field "${field[1]}" is not a valid field name.`);
      }
      if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(attributes)) stack.push({ tag, line });
    } else {
      const index = stack.map((item) => item.tag).lastIndexOf(tag);
      if (index === -1) report("warning", file, line, `</${tag}> has no matching <${tag}>.`);
      else stack.splice(index);
    }
  }
  stack.forEach((item) => {
    if (item.tag !== "li" && item.tag !== "p") report("warning", file, item.line, `<${item.tag}> is never closed.`);
  });

  /* Text checks */
  const textOnly = body.replace(/<[^>]+>/g, " ");
  PLACEHOLDERS.forEach((pattern) => {
    const hit = pattern.exec(textOnly);
    if (hit) report("error", file, lineOf(textOnly, hit.index), `Template placeholder "${hit[0]}" must be replaced with real information.`);
  });
  if (!textOnly.trim()) report("error", file, 1, "The file has no text.");
}

/* ---------- Academic calendar ---------- */

function checkAcademicCalendar(file, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    report("error", file, 1, `Not valid JSON: ${error.message}`);
    return;
  }
  if (!["sample", "published", "official"].includes(data.status)) {
    report("warning", file, 1, `"status" should be "sample", "published", or "official".`);
  }
  if (data.lastReviewed && !isRealDate(data.lastReviewed)) report("error", file, 1, `"lastReviewed" should be a date like 2026-11-25.`);
  if (!Array.isArray(data.terms)) {
    report("error", file, 1, `There is no "terms" list.`);
    return;
  }
  const seen = new Set();
  data.terms.forEach((term, index) => {
    const name = term && term.term && term.year ? `${term.term} ${term.year}` : `term #${index + 1}`;
    const line = lineOf(text, Math.max(0, text.indexOf(`"year": "${term && term.year}"`)));
    if (!["Fall", "Spring", "Summer"].includes(term.term)) report("error", file, line, `${name}: "term" must be Fall, Spring, or Summer.`);
    if (!/^\d{4}$/.test(String(term.year || ""))) report("error", file, line, `${name}: "year" must be four digits.`);
    if (seen.has(name)) report("error", file, line, `${name} is listed more than once.`);
    seen.add(name);
    ["startDate", "endDate", "finalsStart", "finalsEnd", "lastDayToDrop", "lastDayToWithdraw"].forEach((field) => {
      const value = term[field];
      if (value && !isRealDate(value)) report("error", file, line, `${name}: "${field}" (${value}) is not a real date like 2027-01-11.`);
    });
    if (!term.startDate || !term.endDate) report("error", file, line, `${name}: needs "startDate" and "endDate".`);
    if (isRealDate(term.startDate) && isRealDate(term.endDate)) {
      if (term.endDate <= term.startDate) report("error", file, line, `${name}: endDate is not after startDate.`);
      if (term.finalsStart && (term.finalsStart < term.startDate || term.finalsEnd > term.endDate)) {
        report("error", file, line, `${name}: final exam week is outside the semester dates.`);
      }
      if (term.lastDayToWithdraw && term.lastDayToDrop && term.lastDayToWithdraw <= term.lastDayToDrop) {
        report("error", file, line, `${name}: lastDayToWithdraw must be after lastDayToDrop.`);
      }
      (term.noClassDates || []).forEach((item) => {
        if (!isRealDate(item.date)) report("error", file, line, `${name}: no-class date "${item.date}" is not a real date.`);
        else if (item.date < term.startDate || item.date > term.endDate) report("warning", file, line, `${name}: no-class date ${item.date} is outside the semester dates.`);
        if (!String(item.label || "").trim()) report("warning", file, line, `${name}: no-class date ${item.date} has no label.`);
      });
    }
    if (data.status === "official" && term.verified !== true) report("warning", file, line, `${name}: status is "official" but this term is not marked "verified": true.`);
  });
}

/* ---------- Manifest ---------- */

async function checkManifest() {
  const file = join(CONTENT, "content-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    report("error", file, 1, `content-manifest.json is missing or not valid JSON: ${error.message}`);
    return null;
  }
  if (!Array.isArray(manifest.sections)) {
    report("error", file, 1, `The manifest has no "sections" list.`);
    return null;
  }
  const placements = new Set(Object.keys(manifest.placements || {}));
  const ids = new Set();
  const files = new Set();
  for (const section of manifest.sections) {
    const label = section.id || "(no id)";
    if (!section.id) report("error", file, 1, "A section has no id.");
    if (ids.has(section.id)) report("error", file, 1, `Section "${label}" is listed twice.`);
    ids.add(section.id);
    if (!/^[a-z0-9][a-z0-9-]*\.html$/.test(section.file || "")) {
      report("error", file, 1, `Section "${label}": file name must be lowercase letters, numbers, and hyphens ending in .html.`);
      continue;
    }
    files.add(section.file);
    if (!(await exists(join(CONTENT, section.file)))) report("error", file, 1, `Section "${label}": content/${section.file} does not exist.`);
    if (placements.size && !placements.has(section.placement)) report("error", file, 1, `Section "${label}": unknown placement "${section.placement}".`);
    if (!section.title) report("warning", file, 1, `Section "${label}" has no title.`);
    if (!section.required && !section.optionalKey) report("warning", file, 1, `Optional section "${label}" has no optionalKey, so instructors cannot turn it on.`);
  }
  if (manifest.academicCalendarFile && !(await exists(join(CONTENT, manifest.academicCalendarFile)))) {
    report("error", file, 1, `academicCalendarFile content/${manifest.academicCalendarFile} does not exist.`);
  }
  const onDisk = (await readdir(CONTENT)).filter((name) => name.endsWith(".html"));
  onDisk.filter((name) => !files.has(name)).forEach((name) => {
    report("warning", join(CONTENT, name), 1, "This file is not listed in content-manifest.json, so the builder never shows it.");
  });
  return manifest;
}

/* ---------- Optional link check ---------- */

async function checkLinks() {
  for (const [url, [file, line]] of links) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      if (response.status === 405 || response.status === 403) {
        response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      }
      clearTimeout(timer);
      if (response.status >= 400) report("warning", file, line, `Link answered ${response.status}: ${url}`);
    } catch (error) {
      report("warning", file, line, `Link could not be reached (${error.name === "AbortError" ? "timed out" : error.message}): ${url}`);
    }
  }
}

/* ---------- Run ---------- */

const manifest = await checkManifest();
if (manifest) {
  for (const section of manifest.sections) {
    const path = join(CONTENT, section.file || "");
    if (section.file && await exists(path)) checkFragment(path, await readFile(path, "utf8"));
  }
  if (manifest.academicCalendarFile) {
    const path = join(CONTENT, manifest.academicCalendarFile);
    if (await exists(path)) checkAcademicCalendar(path, await readFile(path, "utf8"));
  }
}
if (CHECK_LINKS) await checkLinks();

const errors = findings.filter((item) => item.level === "error");
const warnings = findings.filter((item) => item.level === "warning");

for (const item of findings) {
  if (IN_ACTIONS) {
    console.log(`::${item.level} file=${item.file},line=${item.line}::${item.message.replace(/\r?\n/g, " ")}`);
  } else {
    console.log(`${item.level.toUpperCase().padEnd(7)} ${item.file}:${item.line}  ${item.message}`);
  }
}
const summary = `${errors.length} error(s), ${warnings.length} warning(s)${CHECK_LINKS ? `, ${links.size} link(s) tested` : ""}.`;
console.log(`\nCollege content check: ${summary}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  const rows = findings.map((item) => `| ${item.level} | ${item.file}:${item.line} | ${item.message.replace(/\|/g, "\\|")} |`).join("\n");
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## College content check${CHECK_LINKS ? " (links)" : ""}\n\n${summary}\n\n${findings.length ? `| Level | Where | Message |\n|---|---|---|\n${rows}\n` : "No problems found.\n"}\n`);
}

process.exit(errors.length ? 1 : 0);
