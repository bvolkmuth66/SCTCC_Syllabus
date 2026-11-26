/*
 * SCTCC Syllabus Builder — reads a Word (.docx) file in the browser
 *
 * The file never leaves the computer: it is unzipped and read here, with no
 * server and no outside libraries. Produces a simple outline of the document:
 *   blocks: [{ type: "p", text, level, list, styleName, images: [] } | { type: "table", rows: [[cellText]] }]
 *   images: { relId: { name, mime, size, dataUrl() } }
 *   properties: { creator, lastModifiedBy, title }
 * Text boxes (for example the mission statement in the template) are skipped.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  class DocxError extends Error {}

  /* ---------- Minimal ZIP reader ---------- */

  function readZipDirectory(buffer) {
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new DocxError("This is not a Word (.docx) file.");
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const entries = new Map();
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new DocxError("The Word file appears to be damaged.");
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
      entries.set(name, { method, compressedSize, localOffset });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  async function readZipEntry(buffer, entries, name) {
    const entry = entries.get(name);
    if (!entry) return null;
    const view = new DataView(buffer);
    const start = entry.localOffset;
    if (view.getUint32(start, true) !== 0x04034b50) throw new DocxError("The Word file appears to be damaged.");
    const dataStart = start + 30 + view.getUint16(start + 26, true) + view.getUint16(start + 28, true);
    const bytes = new Uint8Array(buffer, dataStart, entry.compressedSize);
    if (entry.method === 0) return bytes.slice();
    if (entry.method !== 8) throw new DocxError("The Word file uses a format this builder cannot read.");
    if (typeof DecompressionStream !== "function") {
      throw new DocxError("This browser cannot read Word files. Please use a current version of Chrome or Edge.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readXml(buffer, entries, name) {
    const bytes = await readZipEntry(buffer, entries, name);
    if (!bytes) return null;
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new DocxError("Part of the Word file could not be read.");
    return doc;
  }

  /* ---------- Word document parts ---------- */

  function readRelationships(doc) {
    const map = new Map();
    if (!doc) return map;
    Array.from(doc.getElementsByTagName("Relationship")).forEach((rel) => {
      map.set(rel.getAttribute("Id"), { target: rel.getAttribute("Target") || "", external: rel.getAttribute("TargetMode") === "External" });
    });
    return map;
  }

  function readStyles(doc) {
    const map = new Map();
    if (!doc) return map;
    Array.from(doc.getElementsByTagNameNS(W, "style")).forEach((style) => {
      const id = style.getAttributeNS(W, "styleId");
      const nameEl = style.getElementsByTagNameNS(W, "name")[0];
      const outline = style.getElementsByTagNameNS(W, "outlineLvl")[0];
      map.set(id, {
        name: nameEl ? nameEl.getAttributeNS(W, "val") : id,
        outline: outline ? Number(outline.getAttributeNS(W, "val")) : null
      });
    });
    return map;
  }

  const SKIP_ELEMENTS = new Set(["txbxContent", "Fallback", "del", "instrText", "delText", "footnoteReference", "endnoteReference", "commentReference"]);

  /* Collect a paragraph's visible text, with hyperlink addresses and images. */
  function paragraphContent(paragraph, relationships) {
    const parts = [];
    const images = [];

    function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType !== 1) return;
        const local = child.localName;
        if (SKIP_ELEMENTS.has(local)) return;
        if (local === "t") {
          parts.push(child.textContent);
        } else if (local === "tab" && child.namespaceURI === W && child.parentNode.localName === "r") {
          parts.push("\t");
        } else if ((local === "br" || local === "cr") && child.namespaceURI === W) {
          parts.push("\n");
        } else if (local === "noBreakHyphen") {
          parts.push("-");
        } else if (local === "blip") {
          const id = child.getAttributeNS(R, "embed");
          if (id) images.push(id);
        } else if (local === "hyperlink" && child.namespaceURI === W) {
          const before = parts.length;
          walk(child);
          const id = child.getAttributeNS(R, "id");
          const rel = id && relationships.get(id);
          const linkText = parts.slice(before).join("");
          if (rel && rel.external && /^(https?:|mailto:)/i.test(rel.target)) {
            const address = rel.target.replace(/^mailto:/i, "");
            if (!linkText.includes(address) && !linkText.includes(rel.target)) parts.push(` (${rel.target.replace(/^mailto:/i, "")})`);
          }
        } else {
          walk(child);
        }
      });
    }
    walk(paragraph);
    return { text: parts.join("").replace(/ /g, " "), images };
  }

  function paragraphInfo(paragraph, styles) {
    const pPr = Array.from(paragraph.childNodes).find((node) => node.localName === "pPr");
    let styleId = "";
    let list = false;
    let outline = null;
    if (pPr) {
      const styleEl = pPr.getElementsByTagNameNS(W, "pStyle")[0];
      styleId = styleEl ? styleEl.getAttributeNS(W, "val") : "";
      list = pPr.getElementsByTagNameNS(W, "numPr").length > 0;
      const outlineEl = pPr.getElementsByTagNameNS(W, "outlineLvl")[0];
      if (outlineEl) outline = Number(outlineEl.getAttributeNS(W, "val"));
    }
    const style = styles.get(styleId) || { name: styleId, outline: null };
    const styleName = style.name || "";
    let level = 0;
    const heading = /^heading\s*(\d)$/i.exec(styleName) || /^Heading(\d)$/.exec(styleId);
    if (heading) level = Number(heading[1]);
    else if (/^title$/i.test(styleName)) level = 1;
    else if (outline !== null && outline < 6) level = outline + 1;
    else if (style.outline !== null && style.outline < 6) level = style.outline + 1;
    if (/list/i.test(styleName)) list = true;
    return { styleName, level, list };
  }

  function tableRows(table, relationships) {
    return Array.from(table.childNodes)
      .filter((node) => node.localName === "tr")
      .map((row) => Array.from(row.childNodes)
        .filter((node) => node.localName === "tc")
        .map((cell) => Array.from(cell.getElementsByTagNameNS(W, "p"))
          .map((p) => paragraphContent(p, relationships).text.trim())
          .filter(Boolean)
          .join("\n")));
  }

  function collectBlocks(container, styles, relationships, blocks) {
    Array.from(container.childNodes).forEach((node) => {
      if (node.nodeType !== 1) return;
      if (node.localName === "p") {
        const info = paragraphInfo(node, styles);
        const content = paragraphContent(node, relationships);
        blocks.push({ type: "p", text: content.text, level: info.level, list: info.list, styleName: info.styleName, images: content.images });
      } else if (node.localName === "tbl") {
        blocks.push({ type: "table", rows: tableRows(node, relationships) });
      } else if (node.localName === "sdt" || node.localName === "sdtContent" || node.localName === "customXml") {
        collectBlocks(node, styles, relationships, blocks);
      }
    });
  }

  function bytesToDataUrl(bytes, mime) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }

  const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

  /* Read a .docx File object. Resolves the outline described at the top of this file. */
  async function readDocx(file) {
    if (!file) throw new DocxError("No file was chosen.");
    if (file.size > MAX_FILE_BYTES) throw new DocxError("That file is too large (over 25 MB).");
    if (/\.doc$/i.test(file.name)) throw new DocxError("This is an older Word (.doc) file. Open it in Word, choose File > Save As > Word Document (.docx), and import that copy.");
    const buffer = await file.arrayBuffer();
    const entries = readZipDirectory(buffer);
    const documentXml = await readXml(buffer, entries, "word/document.xml");
    if (!documentXml) throw new DocxError("This is not a Word (.docx) file.");

    const relationships = readRelationships(await readXml(buffer, entries, "word/_rels/document.xml.rels"));
    const styles = readStyles(await readXml(buffer, entries, "word/styles.xml"));
    const body = documentXml.getElementsByTagNameNS(W, "body")[0];
    const blocks = [];
    collectBlocks(body, styles, relationships, blocks);

    const images = {};
    for (const [id, rel] of relationships) {
      const extension = (rel.target.split(".").pop() || "").toLowerCase();
      if (rel.external || !IMAGE_TYPES[extension]) continue;
      const path = rel.target.startsWith("/") ? rel.target.slice(1) : `word/${rel.target}`;
      const bytes = await readZipEntry(buffer, entries, path);
      if (!bytes) continue;
      images[id] = { name: rel.target.split("/").pop(), mime: IMAGE_TYPES[extension], size: bytes.length, dataUrl: () => bytesToDataUrl(bytes, IMAGE_TYPES[extension]) };
    }

    const properties = {};
    const core = await readXml(buffer, entries, "docProps/core.xml");
    if (core) {
      ["creator", "lastModifiedBy", "title"].forEach((name) => {
        const element = Array.from(core.getElementsByTagName("*")).find((node) => node.localName === name);
        if (element && element.textContent.trim()) properties[name] = element.textContent.trim();
      });
    }
    return { fileName: file.name, blocks, images, properties };
  }

  window.SCTCC.docx = Object.freeze({ readDocx, DocxError });
})();
