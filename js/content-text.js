/*
 * SCTCC Syllabus Builder — plain text <-> college content HTML
 *
 * The College Content Editor shows a college section as plain text, so content owners never
 * see HTML. These rules turn a fragment's HTML into that text and back again:
 *
 *   Each line is its own paragraph (blank lines are ignored).
 *   - Bullet item              (a line starting with "- ")
 *       - Sub-bullet           (four spaces, then "- ")
 *   1. Numbered item           (a line starting with a number and ". ")
 *   **bold**   *italic*   ***bold italic***
 *   [link text](https://www.sctcc.edu/page)
 *   {Withdrawal date}          an instructor fill-in, kept exactly as it was
 *
 * Only the tags college content uses are produced: p, ul, ol, li, strong, em, a, and the
 * fill-in span. Everything is escaped, so typed < and & stay text.
 */
(function () {
  "use strict";

  /* Friendly names for the instructor fill-ins (data-field). Unknown fields use their key. */
  const FIELD_LABELS = {
    "course.withdrawalDate": "Withdrawal date",
    "policies.acceptedFileFormats": "Accepted file formats",
    "course.dropDate": "Drop date",
    "course.startDate": "Course start date",
    "course.endDate": "Course end date"
  };

  const INDENT = "    ";

  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, "&quot;");
  }

  /* ---------------- HTML -> plain text ---------------- */

  /*
   * Reads a fragment (the whole file text) and returns:
   *   header  — the leading comment block, kept as it is
   *   text    — the plain text to edit
   *   fields  — each fill-in: { label, html } so it can be put back exactly
   *   classes — paragraph classes by position (only the mission statement has one)
   */
  function fromHtml(fileText) {
    const headerMatch = /^\s*<!--[\s\S]*?-->\s*/.exec(fileText);
    const header = headerMatch ? headerMatch[0].trim() : "";
    const bodyHtml = headerMatch ? fileText.slice(headerMatch[0].length) : fileText;
    const doc = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, "text/html");
    const fields = [];
    const classes = [];
    const lines = [];
    let paragraphIndex = 0;

    function fieldToken(span) {
      const key = span.getAttribute("data-field") || "";
      const label = FIELD_LABELS[key] || key;
      if (!fields.some((field) => field.label === label)) fields.push({ label, key, html: span.outerHTML });
      return `{${label}}`;
    }

    /* Inline content to text with **, *, [](), {} markers. */
    function inline(node) {
      let out = "";
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.nodeValue.replace(/\s+/g, " ");
          return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const tag = child.tagName.toLowerCase();
        if (tag === "span" && child.hasAttribute("data-field")) out += fieldToken(child);
        else if (tag === "strong" || tag === "b") {
          const only = child.children.length === 1 && child.firstElementChild.tagName.toLowerCase() === "em" && child.textContent.trim() === child.firstElementChild.textContent.trim();
          out += only ? `***${inline(child.firstElementChild).trim()}***` : `**${inline(child).trim()}**`;
        } else if (tag === "em" || tag === "i") out += `*${inline(child).trim()}*`;
        else if (tag === "a") out += `[${inline(child).trim()}](${child.getAttribute("href") || ""})`;
        else if (tag === "br") out += " ";
        else out += inline(child);
      });
      return out;
    }

    function list(element, depth) {
      const ordered = element.tagName.toLowerCase() === "ol";
      let number = 1;
      Array.from(element.children).forEach((item) => {
        if (item.tagName.toLowerCase() !== "li") return;
        const clone = item.cloneNode(true);
        const sublists = Array.from(clone.children).filter((child) => /^(ul|ol)$/i.test(child.tagName));
        sublists.forEach((sub) => sub.remove());
        const marker = ordered ? `${number}. ` : "- ";
        number += 1;
        lines.push(`${INDENT.repeat(depth)}${marker}${inline(clone).trim()}`);
        Array.from(item.children).filter((child) => /^(ul|ol)$/i.test(child.tagName)).forEach((sub) => list(sub, depth + 1));
      });
    }

    Array.from(doc.body.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue.trim()) { lines.push(""); lines.push(node.nodeValue.trim()); }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (lines.length) lines.push("");
      if (tag === "ul" || tag === "ol") list(node, 0);
      else {
        classes[paragraphIndex] = node.getAttribute("class") || "";
        paragraphIndex += 1;
        lines.push(inline(node).trim());
      }
    });

    return { header, text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), fields, classes };
  }

  /* ---------------- plain text -> HTML ---------------- */

  /* Inline markers to HTML. Returns { html, problems }. */
  function inlineToHtml(text, fields, problems, lineNumber) {
    let out = "";
    let rest = text;
    const pattern = /(\{([^{}]+)\})|(\[([^\]]+)\]\(([^()\s]*)\))|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/;
    while (rest.length) {
      const match = pattern.exec(rest);
      if (!match) { out += escapeHtml(rest); break; }
      out += escapeHtml(rest.slice(0, match.index));
      if (match[1]) {
        const field = fields.find((candidate) => candidate.label.toLowerCase() === match[2].trim().toLowerCase());
        if (field) out += field.html;
        else {
          problems.push({ level: "error", line: lineNumber, message: `“{${match[2]}}” is not one of this section’s fill-ins. Fill-ins can’t be added here; remove the curly brackets, or ask the reviewer.` });
          out += escapeHtml(match[0]);
        }
      } else if (match[3]) {
        out += `<a href="${escapeAttr(match[5])}">${inlineToHtml(match[4], fields, problems, lineNumber)}</a>`;
      } else if (match[6]) {
        out += `<strong><em>${inlineToHtml(match[7], fields, problems, lineNumber)}</em></strong>`;
      } else if (match[8]) {
        out += `<strong>${inlineToHtml(match[9], fields, problems, lineNumber)}</strong>`;
      } else if (match[10]) {
        out += `<em>${inlineToHtml(match[11], fields, problems, lineNumber)}</em>`;
      }
      rest = rest.slice(match.index + match[0].length);
    }
    return out;
  }

  /*
   * Plain text -> the body HTML of a fragment, formatted like the existing files.
   * `source` is what fromHtml returned for the current version (for fill-ins and classes).
   */
  function toHtml(text, source) {
    const fields = (source && source.fields) || [];
    const classes = (source && source.classes) || [];
    const problems = [];
    const blocks = [];
    let paragraphIndex = 0;
    let listStack = [];

    function closeLists(toDepth) {
      while (listStack.length > toDepth) {
        const done = listStack.pop();
        const html = renderList(done);
        if (listStack.length) {
          const parent = listStack[listStack.length - 1];
          parent.items[parent.items.length - 1].children.push(html);
        } else blocks.push(html);
      }
    }

    function renderList(entry) {
      const pad = "  ".repeat(entry.depth * 2);
      const items = entry.items.map((item) => item.children.length
        ? `${pad}  <li>${item.html}\n${item.children.map((child) => child.replace(/^/gm, "    ")).join("\n")}\n${pad}  </li>`
        : `${pad}  <li>${item.html}</li>`);
      return `${pad}<${entry.tag}>\n${items.join("\n")}\n${pad}</${entry.tag}>`;
    }

    String(text).replace(/\r\n?/g, "\n").split("\n").forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.replace(/\t/g, INDENT).replace(/\s+$/, "");
      if (!line.trim()) { closeLists(0); return; }
      const itemMatch = /^( *)(- |\* |• |(\d+)[.)] )(.*)$/.exec(line);
      if (itemMatch) {
        /* Two or more leading spaces make a sub-item, one level under the item above it. */
        const indent = itemMatch[1].length;
        const depth = Math.min(indent >= 2 ? Math.max(1, Math.round(indent / INDENT.length)) : 0, listStack.length);
        const tag = itemMatch[3] ? "ol" : "ul";
        closeLists(depth + 1);
        if (listStack.length === depth + 1 && listStack[depth].tag !== tag) closeLists(depth);
        if (listStack.length < depth + 1) listStack.push({ tag, depth, items: [] });
        listStack[depth].items.push({ html: inlineToHtml(itemMatch[4].trim(), fields, problems, lineNumber), children: [] });
        return;
      }
      closeLists(0);
      const cls = classes[paragraphIndex];
      paragraphIndex += 1;
      blocks.push(`<p${cls ? ` class="${escapeAttr(cls)}"` : ""}>${inlineToHtml(line.trim(), fields, problems, lineNumber)}</p>`);
    });
    closeLists(0);
    return { html: blocks.join("\n"), problems };
  }

  /* The whole file: the header comment (reviewed date updated) and the new body. */
  function toFile(text, source, options) {
    const converted = toHtml(text, source);
    let header = (source && source.header) || "";
    const today = (options && options.date) || "";
    if (header && today) {
      header = /LAST-REVIEWED:\s*[^\n]*/.test(header)
        ? header.replace(/LAST-REVIEWED:\s*[^\n]*/, `LAST-REVIEWED: ${today}`)
        : header.replace(/-->$/, `  LAST-REVIEWED: ${today}\n-->`);
    }
    if (header && options && options.editedBy) {
      const note = `EDITED: ${today} by ${options.editedBy} with the College Content Editor`;
      header = /\n\s*EDITED:[^\n]*/.test(header)
        ? header.replace(/(\n\s*)EDITED:[^\n]*/, `$1${note}`)
        : header.replace(/(\n\s*LAST-REVIEWED:[^\n]*)/, `$1\n  ${note}`);
    }
    return { file: `${header ? `${header}\n` : ""}${converted.html}\n`, problems: converted.problems };
  }

  /* ---------------- checks a content owner sees while typing ---------------- */

  const PLACEHOLDERS = /\b(XXX+|TBD|TBA|YOUR NAME|GIVE (WITHDRAWAL )?DATE|COURSE NAME|DATE HERE|INSERT [A-Z ]+)\b/;

  function check(text, source) {
    const problems = toHtml(text, source).problems.slice();
    const fields = (source && source.fields) || [];
    if (!String(text).trim()) problems.push({ level: "error", message: "The section is empty. Type the text, or choose Start over to bring back the current version." });

    String(text).split("\n").forEach((line, index) => {
      const lineNumber = index + 1;
      const links = Array.from(line.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g));
      links.forEach((link) => {
        const words = link[1].trim();
        const address = link[2].trim();
        if (!words) problems.push({ level: "error", line: lineNumber, message: "A link has no words to click. Put the words between [ and ]." });
        if (!/^(https?:\/\/|mailto:|tel:)/i.test(address)) problems.push({ level: "error", line: lineNumber, message: `The link “${words}” needs a full web address starting with https:// (or mailto: for an email address).` });
        else if (/^http:\/\//i.test(address)) problems.push({ level: "warning", line: lineNumber, message: `The link “${words}” starts with http://. Use https:// if the page has it.` });
        if (/^(here|click here|this link|link|more|read more|this)$/i.test(words)) problems.push({ level: "warning", line: lineNumber, message: `Link words “${words}” don’t say where the link goes. Screen-reader users hear links on their own, so use words like “Complaint and grievance policy”.` });
      });
      const withoutLinks = line.replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1");
      if (/\[[^\]]*\]\s+\(/.test(line)) problems.push({ level: "error", line: lineNumber, message: "A link has a space between ] and (. Remove it so the link works." });
      else if (/\[[^\]]*$|^[^[]*\]\(/.test(withoutLinks) || /\]\([^)]*$/.test(line)) problems.push({ level: "error", line: lineNumber, message: "A link is not finished. Links are written [words](https://address)." });
      /* Take out every finished ***, ** and * pair; any * left over is not closed. */
      const leftover = withoutLinks.replace(/\\\*/g, "").replace(/^\s*\* /, "")
        .replace(/\*\*\*[^*]+\*\*\*/g, "").replace(/\*\*[^*]+\*\*/g, "").replace(/\*[^*]+\*/g, "");
      if (leftover.includes("*")) problems.push({ level: "error", line: lineNumber, message: "Bold or italic is not closed: each ** or * needs a matching one after the words." });
      const bare = withoutLinks.match(/\b(https?:\/\/[^\s)]+|www\.[^\s)]+)/);
      if (bare) problems.push({ level: "warning", line: lineNumber, message: `The web address ${bare[1]} is shown as plain text. Make it a link with words, using the Link button.` });
      const placeholder = PLACEHOLDERS.exec(line);
      if (placeholder) problems.push({ level: "warning", line: lineNumber, message: `“${placeholder[1]}” looks like a placeholder left from a template.` });
    });

    fields.forEach((field) => {
      if (!String(text).toLowerCase().includes(`{${field.label.toLowerCase()}}`)) {
        problems.push({ level: "error", message: `The fill-in {${field.label}} is missing. Instructors’ ${field.label.toLowerCase()} goes there; put {${field.label}} back where it belongs, or choose Start over.` });
      }
    });
    return problems;
  }

  window.SCTCC = window.SCTCC || {};
  window.SCTCC.contentText = { fromHtml, toHtml, toFile, check, FIELD_LABELS };
})();
