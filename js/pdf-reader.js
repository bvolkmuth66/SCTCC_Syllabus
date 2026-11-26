/*
 * pdf-reader.js — reads a PDF syllabus in the browser, using Mozilla PDF.js
 * (vendor/pdfjs, Apache-2.0). Nothing is uploaded: the file is read from the
 * instructor's computer and the text stays in this page.
 *
 * A PDF has no headings, paragraphs, lists, or tables — only positioned text.
 * This reader rebuilds them from font size, boldness, spacing, and columns, and
 * returns the same shape as docx-reader.js so the importer can treat both alike:
 *   { fileName, source: "pdf", blocks, images: [], properties: {}, pageCount }
 *
 * PDF.js is loaded only when a PDF is chosen. It runs with font loading and
 * eval turned off; only text is extracted, so pages are never drawn.
 */
(function () {
  "use strict";

  const SCTCC = (window.SCTCC = window.SCTCC || {});

  class PdfError extends Error {}

  const LIBRARY = "vendor/pdfjs/pdf.min.mjs";
  const WORKER = "vendor/pdfjs/pdf.worker.min.mjs";
  const BULLET = /^([•●▪◦○■□➢➤✓✔•▪●-]|o)$/;
  const BULLET_START = /^([•●▪◦○■□➢➤✓✔•▪●]|o(?=\s))\s*/;
  const BOLD_FONT = /bold|black|heavy|semibold|demi/i;

  let libraryPromise = null;

  function loadLibrary() {
    if (!libraryPromise) {
      const base = document.baseURI;
      libraryPromise = import(new URL(LIBRARY, base).href).then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = new URL(WORKER, base).href;
        return lib;
      }).catch((error) => {
        libraryPromise = null;
        throw error;
      });
    }
    return libraryPromise;
  }

  /* ---------- Text items to lines ---------- */

  function itemsToLines(items, pageIndex, fontNames) {
    const usable = items
      .filter((item) => typeof item.str === "string" && item.str.length && item.transform)
      .map((item) => {
        const size = Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
        return {
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          endX: item.transform[4] + (item.width || 0),
          size,
          bold: BOLD_FONT.test(fontNames[item.fontName] || "")
        };
      })
      .sort((a, b) => (Math.abs(b.y - a.y) > 0.5 ? b.y - a.y : a.x - b.x));

    const lines = [];
    usable.forEach((item) => {
      const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, candidate.size * 0.35));
      if (line) {
        line.items.push(item);
        line.size = Math.max(line.size, item.text.trim() ? item.size : 0);
      } else {
        lines.push({ page: pageIndex, y: item.y, size: item.text.trim() ? item.size : 0, items: [item] });
      }
    });

    return lines
      .map((line) => {
        line.items.sort((a, b) => a.x - b.x);
        const segments = [];
        const columnGap = Math.max(line.size * 0.95, 7);
        let breakNext = false;
        line.items.forEach((item) => {
          const last = segments[segments.length - 1];
          if (!item.text.trim()) {
            /* Spaces and tabs: a wide one is a column gap; it never extends the text. */
            if (item.endX - item.x > columnGap) breakNext = true;
            else if (last && !/\s$/.test(last.text)) last.text += " ";
            return;
          }
          const gap = last ? item.x - last.endX : 0;
          if (!last || breakNext || gap > columnGap) {
            breakNext = false;
            segments.push({ x: item.x, endX: item.endX, text: item.text, bold: item.bold, chars: 0, boldChars: 0, parts: [item] });
          } else {
            last.parts.push(item);
            const needsSpace = gap > line.size * 0.12 && !/\s$/.test(last.text) && !/^\s/.test(item.text);
            last.text += (needsSpace ? " " : "") + item.text;
            last.endX = Math.max(last.endX, item.endX);
          }
          const target = segments[segments.length - 1];
          if (target) {
            const count = item.text.replace(/\s/g, "").length;
            target.chars += count;
            if (item.bold) target.boldChars += count;
          }
        });
        segments.forEach((segment) => {
          segment.text = segment.text.replace(/\s+/g, " ").trim();
          segment.bold = segment.chars > 0 && segment.boldChars / segment.chars >= 0.8;
        });
        /* A bullet glyph set apart from its text belongs to the text. */
        if (segments.length >= 2 && BULLET.test(segments[0].text)) {
          segments[1].text = `• ${segments[1].text}`;
          segments[1].x = segments[0].x;
          segments.shift();
        }
        line.segments = segments.filter((segment) => segment.text);
        line.text = line.segments.map((segment) => segment.text).join("\t");
        line.x = line.segments.length ? line.segments[0].x : 0;
        line.endX = line.segments.length ? line.segments[line.segments.length - 1].endX : 0;
        line.bold = line.segments.length > 0 && line.segments.every((segment) => segment.bold);
        return line;
      })
      .filter((line) => line.segments.length);
  }

  /* Running headers and footers repeat on most pages. */
  function dropRepeatedLines(pages) {
    if (pages.length < 3) return pages;
    const key = (line) => line.text.replace(/\d+/g, "#");
    const counts = new Map();
    pages.forEach((lines) => {
      new Set(lines.map(key)).forEach((text) => counts.set(text, (counts.get(text) || 0) + 1));
    });
    const limit = Math.max(2, Math.ceil(pages.length / 2));
    return pages.map((lines) => lines.filter((line) => {
      const repeated = (counts.get(key(line)) || 0) >= limit;
      const pageNumber = /^(page\s*)?#(\s*(of|\/)\s*#)?$/i.test(key(line));
      return !repeated && !pageNumber;
    }));
  }

  /* ---------- Size statistics ---------- */

  function bodySize(lines) {
    const weights = new Map();
    lines.forEach((line) => {
      const size = Math.round(line.size * 2) / 2;
      weights.set(size, (weights.get(size) || 0) + line.text.length);
    });
    let best = 11;
    let bestWeight = -1;
    weights.forEach((weight, size) => {
      if (weight > bestWeight) {
        best = size;
        bestWeight = weight;
      }
    });
    return best;
  }

  function headingLevel(line, body) {
    const text = line.text.replace(/\t/g, " ");
    if (line.segments.length > 1 || text.length > 90) return 0;
    const words = text.split(/\s+/).length;
    if (line.size >= body * 1.3 && words <= 14) return 1;
    if (line.size >= body * 1.1 && words <= 14 && !/[.,;]$/.test(text)) return 2;
    if (line.bold && words <= 10 && !/[.,;]$/.test(text) && !BULLET_START.test(text)) return 2;
    return 0;
  }

  /* ---------- Lines to paragraphs ---------- */

  function lineGap(previous, line) {
    if (!previous || previous.page !== line.page) return Infinity;
    return previous.y - line.y;
  }

  /*
   * Joins wrapped lines into paragraphs. `lines` share one column.
   * Returns docx-style paragraph blocks.
   */
  function paragraphs(lines, body, options) {
    const blocks = [];
    const spacing = body * 1.25;
    let current = null;
    let previous = null;
    let rightEdge = 0;
    lines.forEach((line) => { rightEdge = Math.max(rightEdge, line.endX); });

    lines.forEach((line) => {
      const text = line.text.replace(/\t/g, "\t");
      const level = options && options.noHeadings ? 0 : headingLevel(line, body);
      const bullet = BULLET_START.exec(text);
      const numbered = /^\d+[.)]\s/.test(text);
      const gap = lineGap(previous, line);
      /* Wrapped lines reach the right margin; a line that stops well short ends its paragraph. */
      const endedShort = previous && (previous.endX < rightEdge * 0.72
        || (previous.endX < rightEdge * 0.85 && /[.!?:]$/.test(previous.text)));
      const startsNew = !current || level || current.level || bullet || numbered || line.segments.length > 1
        || (current.tabbed) || gap > spacing * 1.45 || endedShort
        || Math.abs(line.x - current.x) > body * 1.5 && !current.list;

      if (startsNew) {
        current = {
          type: "p",
          text: bullet ? text.slice(bullet[0].length) : text,
          level,
          list: Boolean(bullet),
          styleName: level ? `PDF heading ${level}` : "",
          images: [],
          x: line.x,
          tabbed: line.segments.length > 1
        };
        blocks.push(current);
      } else {
        const joiner = /-$/.test(current.text) && /^[a-z]/.test(text) ? "" : " ";
        current.text = (joiner ? current.text : current.text.slice(0, -1)) + joiner + text;
      }
      previous = line;
    });
    return blocks.map((block) => ({
      type: "p", text: block.text, level: block.level, list: block.list, styleName: block.styleName, images: []
    }));
  }

  /* ---------- Tables ---------- */

  function near(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
  }

  function columnIndex(columns, x, tolerance) {
    for (let index = columns.length - 1; index >= 0; index -= 1) {
      if (x >= columns[index] - tolerance) return index;
    }
    return 0;
  }

  /* Does this line fit a table with these column starts? */
  function fitsColumns(line, columns, tolerance) {
    return line.segments.every((segment) => {
      const column = columnIndex(columns, segment.x, tolerance);
      const next = columns[column + 1];
      /* The first column's text starts at its edge; later cells may be indented (bullets, centering). */
      const startsInColumn = column > 0 ? segment.x >= columns[column] - tolerance : near(segment.x, columns[0], tolerance);
      const staysInColumn = next === undefined || segment.endX <= next + tolerance;
      return startsInColumn && staysInColumn;
    });
  }

  /*
   * When a label nearly touches its value there is no gap to see. Inside a table
   * whose columns are known, split the line where a piece of text starts at a column.
   */
  function splitAtColumns(line, columns, tolerance) {
    const segments = [];
    line.segments.forEach((segment) => {
      let current = null;
      (segment.parts || []).forEach((item) => {
        const atColumn = columns.some((start) => near(item.x, start, tolerance / 2));
        if (!current || (atColumn && item.x > current.x + tolerance)) {
          current = { x: item.x, endX: item.endX, text: item.text, bold: segment.bold, parts: [item] };
          segments.push(current);
        } else {
          const needsSpace = item.x - current.endX > line.size * 0.12 && !/\s$/.test(current.text) && !/^\s/.test(item.text);
          current.text += (needsSpace ? " " : "") + item.text;
          current.endX = Math.max(current.endX, item.endX);
          current.parts.push(item);
        }
      });
      if (!segment.parts) segments.push(segment);
    });
    segments.forEach((segment) => { segment.text = segment.text.replace(/\s+/g, " ").trim(); });
    const kept = segments.filter((segment) => segment.text);
    if (kept.length === line.segments.length) return line;
    return Object.assign({}, line, {
      segments: kept,
      text: kept.map((segment) => segment.text).join("\t"),
      endX: kept[kept.length - 1].endX
    });
  }

  /*
   * Finds runs of lines laid out in columns (table rows) and turns each run into
   * a docx-style table block: { type: "table", rows: [[text]], cells: [[blocks]] }.
   */
  function buildBlocks(lines, body) {
    const tolerance = Math.max(6, body * 0.7);
    const blocks = [];
    let pending = [];
    const flushText = () => {
      if (pending.length) blocks.push(...paragraphs(pending, body));
      pending = [];
    };

    let index = 0;
    while (index < lines.length) {
      const start = lines[index];
      if (start.segments.length < 2) {
        pending.push(start);
        index += 1;
        continue;
      }
      const columns = start.segments.map((segment) => segment.x);
      const members = [];
      let multiLines = 0;
      let rightOnly = 0;
      let cursor = index;
      while (cursor < lines.length) {
        let line = lines[cursor];
        if (members.length && !fitsColumns(line, columns, tolerance)) {
          line = splitAtColumns(line, columns, tolerance);
        }
        const previous = members[members.length - 1];
        if (previous && previous.page === line.page && previous.y - line.y > body * 4) break;
        const following = lines[cursor + 1];
        const spanningHeading = members.length && line.segments.length === 1 && headingLevel(line, body) > 0
          && near(line.x, columns[0], tolerance)
          && following && fitsColumns(following, columns, tolerance); /* a header row inside a layout table */
        if (!spanningHeading && !fitsColumns(line, columns, tolerance)) {
          /* Extra segments to the right are a table nested in the last column. */
          const lastStart = columns[columns.length - 1];
          const nested = line.segments.every((segment) => segment.x >= lastStart - tolerance);
          if (!(nested && members.length)) break;
        }
        if (line.segments.length >= 2) multiLines += 1;
        else if (members.length && columnIndex(columns, line.x, tolerance) > 0) rightOnly += 1;
        members.push(line);
        cursor += 1;
      }
      /* Several label | value rows, or one row whose right cell runs over several lines. */
      const isTable = (multiLines >= 3 && members.length >= 4)
        || (multiLines >= 1 && rightOnly >= 1 && columns[1] - columns[0] > body * 4);
      if (!isTable) {
        pending.push(start);
        index += 1;
        continue;
      }
      flushText();
      blocks.push(tableFromLines(members, columns, body, tolerance));
      index = cursor;
    }
    flushText();
    return blocks;
  }

  function tableFromLines(lines, columns, body, tolerance) {
    const rows = [];
    let row = null;
    let previous = null;
    const spacing = body * 1.25;
    lines.forEach((line) => {
      const first = line.segments[0];
      const hasLabel = columnIndex(columns, first.x, tolerance) === 0 && near(first.x, columns[0], tolerance);
      const gap = lineGap(previous, line);
      const previousHadLabel = previous && previous.segments.some((segment) => near(segment.x, columns[0], tolerance));
      const markerOnly = /^\((SAMPLE|OPTIONAL|REQUIRED|AS APPLICABLE)\)$/i.test(first.text); /* wrapped "(SAMPLE)" label */
      const newRow = !row || (hasLabel && !markerOnly && (!previousHadLabel || gap > spacing * 1.3));
      if (newRow) {
        row = columns.map(() => []);
        rows.push(row);
      }
      line.segments.forEach((segment) => {
        const column = columnIndex(columns, segment.x, tolerance);
        row[column].push({ line, segment });
      });
      previous = line;
    });

    const cells = rows.map((cellsInRow) => cellsInRow.map((parts) => cellBlocks(parts, body)));
    const texts = cells.map((cellsInRow) => cellsInRow.map((blocks) => blocks.map(blockText).join("\n")));
    return { type: "table", rows: texts, cells };
  }

  function blockText(block) {
    if (block.type === "table") return block.rows.map((row) => row.join(" ")).join("\n");
    return block.text;
  }

  /* One cell's text: plain lines become paragraphs; lines with several parts become a nested table. */
  function cellBlocks(parts, body) {
    const byLine = [];
    parts.forEach(({ line, segment }) => {
      const last = byLine[byLine.length - 1];
      if (last && last.line === line) last.segments.push(segment);
      else byLine.push({ line, segments: [segment] });
    });
    const blocks = [];
    let plain = [];
    let nested = [];
    const flushPlain = () => {
      if (!plain.length) return;
      blocks.push(...paragraphs(plain, body, { noHeadings: true }));
      plain = [];
    };
    const flushNested = () => {
      if (!nested.length) return;
      const width = Math.max(...nested.map((segments) => segments.length));
      const rows = nested.map((segments) => {
        const texts = segments.map((segment) => segment.text);
        while (texts.length < width) texts.push("");
        return texts;
      });
      blocks.push({ type: "table", rows, cells: rows.map((r) => r.map((text) => (text ? [{ type: "p", text, level: 0, list: false, images: [] }] : []))) });
      nested = [];
    };
    byLine.forEach(({ line, segments }) => {
      if (segments.length > 1) {
        flushPlain();
        nested.push(segments);
      } else {
        flushNested();
        plain.push(Object.assign({}, line, {
          segments,
          text: segments[0].text,
          x: segments[0].x,
          endX: segments[0].endX,
          bold: segments[0].bold
        }));
      }
    });
    flushPlain();
    flushNested();
    return blocks;
  }

  /* ---------- Whole document ---------- */

  function pagesToBlocks(pageLines) {
    const pages = dropRepeatedLines(pageLines);
    const lines = pages.flat();
    const body = bodySize(lines);
    return { blocks: buildBlocks(lines, body), characters: lines.reduce((sum, line) => sum + line.text.length, 0) };
  }

  async function readPdf(file, options) {
    const lib = (options && options.lib) || await loadLibrary().catch(() => {
      throw new PdfError("The PDF reader could not be loaded. Check your connection and try again, or import the Word file instead.");
    });
    const data = new Uint8Array(await file.arrayBuffer());
    let doc;
    let task;
    try {
      task = lib.getDocument({
        data,
        isEvalSupported: false,
        disableFontFace: true,
        enableXfa: false,
        useSystemFonts: false,
        stopAtErrors: false
      });
      doc = await task.promise;
    } catch (error) {
      if (error && error.name === "PasswordException") {
        throw new PdfError("This PDF is password-protected. Remove the password, or import the Word file instead.");
      }
      throw new PdfError("That file could not be read as a PDF.");
    }

    try {
      const pageLines = [];
      for (let number = 1; number <= doc.numPages; number += 1) {
        const page = await doc.getPage(number);
        const content = await page.getTextContent();
        const fontNames = {};
        try {
          await page.getOperatorList();
          new Set(content.items.map((item) => item.fontName)).forEach((name) => {
            try {
              const font = page.commonObjs.get(name);
              fontNames[name] = (font && (font.name || font.loadedName)) || "";
            } catch (missing) {
              fontNames[name] = "";
            }
          });
        } catch (noFonts) {
          /* Boldness is a hint only; carry on without it. */
        }
        pageLines.push(itemsToLines(content.items, number, fontNames));
        page.cleanup();
      }

      const { blocks, characters } = pagesToBlocks(pageLines);
      if (characters < 200 * Math.min(doc.numPages, 2) / 2) {
        throw new PdfError("This PDF has almost no text that can be read. It may be a scanned picture of the pages. Import the Word file instead, or start from scratch.");
      }
      let properties = {};
      try {
        const meta = await doc.getMetadata();
        properties = { title: (meta.info && meta.info.Title) || "", author: (meta.info && meta.info.Author) || "" };
      } catch (noMeta) {
        properties = {};
      }
      return { fileName: file.name, source: "pdf", blocks, images: [], properties, pageCount: doc.numPages };
    } finally {
      task.destroy();
    }
  }

  SCTCC.pdf = { readPdf, PdfError, pagesToBlocks, itemsToLines };
})();
