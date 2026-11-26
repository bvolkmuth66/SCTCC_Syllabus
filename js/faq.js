/*
 * SCTCC Syllabus Builder — FAQs window (faq.html)
 *
 * Reads content/faq.html (maintained by the content owner), sanitizes each answer with
 * the same allowlist as college content, and shows the questions as a searchable list.
 *   - Search matches every word typed, in the question, the answer, or the topic.
 *   - Matches are highlighted; matching answers open when there are only a few.
 *   - faq.html#question-id opens that question; faq.html?q=words starts a search.
 */
(function () {
  "use strict";

  const DEFAULT_FAQ_FILE = "faq.html";
  const SAFE_FILE = /^[a-z0-9][a-z0-9-]*\.html$/;
  const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
  const OPEN_MATCHES_UP_TO = 8;

  const state = { topics: [], items: [], query: "" };
  const $ = (id) => document.getElementById(id);

  /* Lowercase, drop accents, and treat curly quotes and dashes like plain ones. */
  function normalize(text) {
    return String(text || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[‘’]/g, "'").replace(/[“”]/g, "\"").replace(/[–—]/g, "-")
      .toLowerCase();
  }

  function words(query) {
    return normalize(query).split(/\s+/).map((word) => word.replace(/^["'(]+|["'),.?!:;]+$/g, "")).filter(Boolean);
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      node.setAttribute(key, value === true ? "" : value);
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined) return;
      node.append(child instanceof Node ? child : String(child));
    });
    return node;
  }

  /* ---------- Reading content/faq.html ---------- */

  function parseFaq(text) {
    const sanitize = window.SCTCC.contentLoader.sanitizeFragmentHtml;
    const parsed = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${text}</body></html>`, "text/html");
    const version = /VERSION:\s*([^\n]+)/.exec(text);
    const reviewed = /LAST-REVIEWED:\s*([^\n]+)/.exec(text);
    const usedIds = new Set();
    const topics = [];
    const items = [];

    parsed.body.querySelectorAll("section").forEach((section, topicIndex) => {
      const heading = section.querySelector("h2");
      const title = heading ? heading.textContent.trim() : `Topic ${topicIndex + 1}`;
      const rawTopicId = section.getAttribute("data-topic") || "";
      const topicId = `topic-${SAFE_ID.test(rawTopicId) ? rawTopicId : String(topicIndex + 1)}`;
      const topic = { id: topicId, title, items: [] };

      section.querySelectorAll("div.faq").forEach((block, itemIndex) => {
        const question = block.querySelector("h3");
        if (!question || !question.textContent.trim()) return;
        let id = (block.getAttribute("id") || "").trim();
        if (!SAFE_ID.test(id) || usedIds.has(id) || id.startsWith("topic-")) id = `${topicId}-q${itemIndex + 1}`;
        usedIds.add(id);
        question.remove();
        const answer = sanitize(block.innerHTML);
        const item = {
          id,
          topic,
          question: question.textContent.trim().replace(/\s+/g, " "),
          answer,
          searchText: normalize(`${title} ${question.textContent} ${answer.textContent}`),
          open: false,
          nodes: null
        };
        topic.items.push(item);
        items.push(item);
      });
      if (topic.items.length) topics.push(topic);
    });

    return {
      topics,
      items,
      version: version ? version[1].trim() : "",
      reviewed: reviewed ? reviewed[1].trim() : ""
    };
  }

  /* ---------- Highlighting ---------- */

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /*
   * Wrap the search words in <mark> inside the text nodes of a copy of `node`.
   * Matching is done on the normalized text, so "resume" finds "résumé".
   */
  function highlighted(node, terms) {
    const copy = node.cloneNode(true);
    if (!terms.length) return copy;
    const pattern = new RegExp(terms.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|"), "g");
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((textNode) => {
      const original = textNode.nodeValue;
      /* Normalize one character at a time so positions line up with the original. */
      const chars = Array.from(original);
      const flat = chars.map((char) => normalize(char) || " ");
      if (flat.some((part) => part.length !== 1)) return; /* rare characters: skip highlighting */
      const normalized = flat.join("");
      const ranges = [];
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(normalized))) {
        if (!match[0].length) { pattern.lastIndex += 1; continue; }
        ranges.push([match.index, match.index + match[0].length]);
      }
      if (!ranges.length) return;
      const fragment = document.createDocumentFragment();
      let position = 0;
      ranges.forEach(([start, end]) => {
        if (start > position) fragment.append(chars.slice(position, start).join(""));
        fragment.append(el("mark", null, chars.slice(start, end).join("")));
        position = end;
      });
      if (position < chars.length) fragment.append(chars.slice(position).join(""));
      textNode.replaceWith(fragment);
    });
    return copy;
  }

  /* ---------- Building the page ---------- */

  function setOpen(item, open) {
    item.open = open;
    item.nodes.button.setAttribute("aria-expanded", String(open));
    item.nodes.panel.hidden = !open;
  }

  function buildList() {
    const list = $("faq-list");
    list.replaceChildren();
    const topicList = $("faq-topic-list");
    topicList.replaceChildren();

    state.topics.forEach((topic) => {
      const headingId = `${topic.id}-heading`;
      const section = el("section", { class: "faq-topic", id: topic.id, "aria-labelledby": headingId });
      section.append(el("h2", { id: headingId }, topic.title));
      topic.items.forEach((item) => {
        const panelId = `${item.id}-answer`;
        const buttonId = `${item.id}-button`;
        const questionText = el("span", { class: "faq-question-text" }, item.question);
        const button = el("button", { type: "button", id: buttonId, class: "faq-question", "aria-expanded": "false", "aria-controls": panelId },
          el("span", { class: "faq-chevron", "aria-hidden": "true" }), questionText);
        const answerBody = el("div", { class: "faq-answer-body" });
        answerBody.append(item.answer.cloneNode(true));
        const panel = el("div", { id: panelId, class: "faq-answer", role: "region", "aria-labelledby": buttonId, hidden: true },
          answerBody,
          el("p", { class: "faq-permalink" }, el("a", { href: `#${item.id}` }, "Link to this question")));
        const wrapper = el("div", { class: "faq-item", id: item.id }, el("h3", null, button), panel);
        button.addEventListener("click", () => setOpen(item, !item.open));
        item.nodes = { wrapper, button, questionText, answerBody, panel };
        section.append(wrapper);
      });
      list.append(section);
      topic.nodes = {
        section,
        link: el("li", null, el("a", { href: `#${topic.id}` }, topic.title, " ", el("span", { class: "faq-topic-count" }, `(${topic.items.length})`)))
      };
      topicList.append(topic.nodes.link);
    });
  }

  /* ---------- Search ---------- */

  let announceTimer = 0;

  function applySearch(query, options) {
    state.query = query;
    const terms = words(query);
    let shown = 0;
    const matches = [];

    state.items.forEach((item) => {
      const isMatch = terms.every((term) => item.searchText.includes(term));
      item.nodes.wrapper.hidden = !isMatch;
      const questionText = highlighted(el("span", { class: "faq-question-text" }, item.question), terms);
      item.nodes.questionText.replaceWith(questionText);
      item.nodes.questionText = questionText;
      item.nodes.answerBody.replaceChildren(highlighted(item.answer, terms));
      if (isMatch) { shown += 1; matches.push(item); }
    });

    state.topics.forEach((topic) => {
      const count = topic.items.filter((item) => !item.nodes.wrapper.hidden).length;
      topic.nodes.section.hidden = count === 0;
      topic.nodes.link.hidden = count === 0;
      topic.nodes.link.querySelector(".faq-topic-count").textContent = `(${count})`;
    });

    if (terms.length) {
      const openMatches = matches.length <= OPEN_MATCHES_UP_TO;
      state.items.forEach((item) => setOpen(item, openMatches && !item.nodes.wrapper.hidden));
    } else if (!options || !options.keepOpen) {
      state.items.forEach((item) => setOpen(item, false));
    }

    const none = $("faq-none");
    none.hidden = shown > 0;
    none.textContent = shown ? "" : `No questions match “${query.trim()}”. Try fewer or different words, or choose Clear to see every question.`;

    const total = state.items.length;
    const message = !terms.length
      ? `Showing all ${total} questions.`
      : shown === 0 ? "No questions match."
        : `${shown} of ${total} questions match “${query.trim()}”.${shown > OPEN_MATCHES_UP_TO ? " Choose a question to read its answer." : ""}`;
    /* Wait until typing pauses before announcing, so screen readers are not flooded. */
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => { $("faq-count").textContent = message; }, options && options.immediate ? 0 : 600);
  }

  /* ---------- Deep links ---------- */

  function showFromHash() {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const item = state.items.find((candidate) => candidate.id === id);
    const topic = state.topics.find((candidate) => candidate.id === id);
    if ((item && item.nodes.wrapper.hidden) || (topic && topic.nodes.section.hidden)) {
      $("faq-query").value = "";
      applySearch("", { immediate: true });
    }
    if (item) {
      setOpen(item, true);
      item.nodes.wrapper.scrollIntoView({ block: "start" });
      item.nodes.button.focus({ preventScroll: true });
    } else if (topic) {
      topic.nodes.section.scrollIntoView({ block: "start" });
      const heading = topic.nodes.section.querySelector("h2");
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  /* ---------- Start-up ---------- */

  function bindControls() {
    const input = $("faq-query");
    let timer = 0;
    input.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => applySearch(input.value), 150);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && input.value) {
        event.preventDefault();
        input.value = "";
        applySearch("", { immediate: true });
      }
    });
    $("faq-clear").addEventListener("click", () => {
      input.value = "";
      applySearch("", { immediate: true });
      input.focus();
    });
    $("faq-expand").addEventListener("click", () => state.items.forEach((item) => { if (!item.nodes.wrapper.hidden) setOpen(item, true); }));
    $("faq-collapse").addEventListener("click", () => state.items.forEach((item) => setOpen(item, false)));
    window.addEventListener("hashchange", showFromHash);

    const fromBuilder = Boolean(window.opener && !window.opener.closed);
    $("faq-close").hidden = !fromBuilder;
    $("faq-builder-link").hidden = fromBuilder;
    $("faq-close").addEventListener("click", () => window.close());
  }

  async function start() {
    bindControls();
    const config = (window.SCTCC && window.SCTCC.config) || {};
    try {
      const base = new URL(config.contentBaseUrl || "./content/", window.location.href);
      /* The manifest names the FAQ file (faqFile); fall back to faq.html. */
      let fileName = DEFAULT_FAQ_FILE;
      try {
        const manifest = await (await fetch(new URL(config.manifestFile || "content-manifest.json", base), { cache: "no-cache" })).json();
        if (manifest && SAFE_FILE.test(manifest.faqFile || "")) fileName = manifest.faqFile;
      } catch (manifestError) { /* use the default name */ }
      const url = new URL(fileName, base);
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const faq = parseFaq(await response.text());
      if (!faq.items.length) throw new Error("no questions");
      state.topics = faq.topics;
      state.items = faq.items;
      buildList();
      $("faq-version").textContent = [faq.version && `FAQ version ${faq.version}`, faq.reviewed && `last reviewed ${faq.reviewed}`].filter(Boolean).join(", ");
      const initial = new URLSearchParams(window.location.search).get("q") || "";
      $("faq-query").value = initial;
      applySearch(initial, { immediate: true });
      showFromHash();
      document.body.classList.add("faq-ready");
    } catch (error) {
      $("faq-list").replaceChildren(el("p", { class: "faq-error", role: "alert" },
        "The FAQs could not be loaded. Check that you are online and that the builder was opened from its web address, then reload this window."));
      $("faq-count").textContent = "";
    }
  }

  start();
})();
