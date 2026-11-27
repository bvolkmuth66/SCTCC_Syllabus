#!/usr/bin/env node
/*
 * Automated accessibility check for the SCTCC Syllabus Builder.
 *
 * Runs on GitHub (see .github/workflows/check-accessibility.yml). It:
 *   1. serves this repository on a local port,
 *   2. opens the builder in Chromium with the sample course,
 *   3. runs axe-core against the WCAG rules listed in AXE_TAGS on the start screen,
 *      the instructor view (every editor group open), the check results, the
 *      calendar workspace, the FAQs window, and the student view,
 *   4. saves the student view as a tagged PDF (reports/sample-syllabus.pdf) for
 *      scripts/check-pdf.py and for people to review.
 *
 * Exit code 1 if axe reports any violation. Results: reports/axe-results.json.
 *
 * Needs (installed by the workflow, not part of the builder):
 *   npm install --no-save playwright axe-core && npx playwright install --with-deps chromium
 * Optional environment: CHROME_PATH (use an installed Chrome), AXE_PATH (axe.min.js file).
 *
 * Automated checks find only part of WCAG problems; see docs/accessibility-checklist.md
 * for the manual review.
 */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS = path.join(ROOT, "reports");

/* Update these when the target standard changes (see ACCESSIBILITY.md). */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg"
};

function serve() {
  const server = http.createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function runAxe(page, axeSource, label, options) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async ({ tags, include }) => {
    const context = include ? { include: [[include]] } : document;
    const outcome = await window.axe.run(context, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return outcome.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      tags: violation.tags.filter((tag) => /^wcag\d/.test(tag)),
      nodes: violation.nodes.map((node) => ({ target: node.target.join(" "), summary: node.failureSummary }))
    }));
  }, { tags: AXE_TAGS, include: options && options.include });
  return { view: label, violations: result };
}

async function main() {
  const { chromium } = require("playwright");
  const axePath = process.env.AXE_PATH || require.resolve("axe-core/axe.min.js");
  const axeSource = fs.readFileSync(axePath, "utf8");
  fs.mkdirSync(REPORTS, { recursive: true });

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const results = [];
  const pageErrors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector("body.content-ready", { timeout: 30000 });

    /* 1. Start screen (open on load). */
    results.push(await runAxe(page, axeSource, "Start screen", { include: "#start-dialog" }));

    /* 2. Instructor view with the sample course and every editor group open. */
    page.context().on("page", (popup) => popup.on("dialog", (dialog) => dialog.accept()));
    await page.click("[data-start=sample]");
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelectorAll("details.editor-group").forEach((group) => { group.open = true; }));
    await page.waitForTimeout(300);
    results.push(await runAxe(page, axeSource, "Instructor view (sample course, all editor groups open)"));

    /* 3. Check results. */
    await page.click("#run-check");
    await page.waitForTimeout(400);
    results.push(await runAxe(page, axeSource, "Check before printing results", { include: "#editor-check" }));

    /* 4. The calendar workspace window, and its Reuse dialog. */
    const [workspace] = await Promise.all([
      page.context().waitForEvent("page"),
      page.click("#calendar-open-window")
    ]);
    workspace.on("pageerror", (error) => pageErrors.push(`calendar workspace: ${error}`));
    await workspace.waitForLoadState("load");
    await workspace.waitForSelector(".ws-month", { timeout: 15000 });
    await workspace.click(".ws-month .ws-entry");
    await workspace.waitForTimeout(300);
    results.push(await runAxe(workspace, axeSource, "Calendar workspace (month view, a class selected)"));
    await workspace.click("#view-list");
    await workspace.waitForTimeout(200);
    results.push(await runAxe(workspace, axeSource, "Calendar workspace (list view)", { include: "#calendar-main" }));
    await workspace.click("#ws-reuse");
    await workspace.waitForTimeout(200);
    results.push(await runAxe(workspace, axeSource, "Calendar workspace (Reuse dialog)", { include: "#reuse-dialog" }));
    await workspace.keyboard.press("Escape");
    await workspace.click("#ws-shift");
    await workspace.waitForTimeout(200);
    results.push(await runAxe(workspace, axeSource, "Calendar workspace (Shift dates dialog)", { include: "#shift-dialog" }));
    await workspace.close();

    /* 5. The FAQs window: all questions, then a search with answers open. */
    const [faq] = await Promise.all([
      page.context().waitForEvent("page"),
      page.click("#toolbar-faq")
    ]);
    faq.on("pageerror", (error) => pageErrors.push(`FAQs: ${error}`));
    await faq.waitForSelector("body.faq-ready", { timeout: 15000 });
    results.push(await runAxe(faq, axeSource, "FAQs window (all questions)"));
    await faq.fill("#faq-query", "save onedrive");
    await faq.waitForTimeout(900);
    results.push(await runAxe(faq, axeSource, "FAQs window (search with answers open)"));
    await faq.close();

    /* 6. The College Content Editor, with a section open and a change made. */
    const editor = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    editor.on("pageerror", (error) => pageErrors.push(`Content editor: ${error}`));
    await editor.goto(new URL("content-editor.html", base).href);
    await editor.waitForFunction(() => document.querySelectorAll("#ce-section option").length > 5, null, { timeout: 15000 });
    await editor.selectOption("#ce-section", "navigating-d2l");
    await editor.waitForSelector("#ce-step2:not([hidden])");
    await editor.evaluate(() => { const t = document.getElementById("ce-text"); t.value += "\nA new sentence with **bold** words."; t.dispatchEvent(new Event("input")); });
    await editor.waitForTimeout(900);
    results.push(await runAxe(editor, axeSource, "College Content Editor (section open, change made)"));
    await editor.close();

    /* 7. Student view, then the PDF made from it. */
    await page.click("#toggle-mode");
    await page.waitForTimeout(500);
    results.push(await runAxe(page, axeSource, "Student view (sample course)"));

    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: path.join(REPORTS, "sample-syllabus.pdf"),
      format: "Letter",
      tagged: true,
      outline: true,
      printBackground: false
    });
  } finally {
    await browser.close();
    server.close();
  }

  fs.writeFileSync(path.join(REPORTS, "axe-results.json"), JSON.stringify({ tags: AXE_TAGS, results, pageErrors }, null, 2));

  let total = 0;
  console.log(`Accessibility check (axe-core; rules tagged ${AXE_TAGS.join(", ")})\n`);
  results.forEach(({ view, violations }) => {
    total += violations.length;
    console.log(`${violations.length ? "✗" : "✓"} ${view}: ${violations.length} problem(s)`);
    violations.forEach((violation) => {
      console.log(`    [${violation.impact}] ${violation.help} (${violation.id}; ${violation.tags.join(", ")})`);
      violation.nodes.slice(0, 5).forEach((node) => console.log(`        at ${node.target}`));
      if (violation.nodes.length > 5) console.log(`        …and ${violation.nodes.length - 5} more`);
      console.log(`        ${violation.helpUrl}`);
    });
  });
  if (pageErrors.length) {
    console.log(`\n✗ JavaScript errors on the page:\n  ${pageErrors.join("\n  ")}`);
  }
  console.log(`\nSample PDF saved to reports/sample-syllabus.pdf. Full results: reports/axe-results.json`);
  console.log("Automated checks find only part of WCAG problems; see docs/accessibility-checklist.md.");
  process.exitCode = total || pageErrors.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
