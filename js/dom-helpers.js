/*
 * SCTCC Syllabus Builder — small DOM helpers shared by the renderer and the editor.
 * Everything is created with DOM methods; text is always inserted as text, never HTML.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  function appendChildren(node, children) {
    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined || child === false || child === "") return;
      node.appendChild(typeof child === "string" || typeof child === "number"
        ? document.createTextNode(String(child))
        : child);
    });
    return node;
  }

  /* el("p", { class: "note" }, "Text", el("strong", null, "bold")) */
  function el(tag, attributes, ...children) {
    const node = document.createElement(tag);
    Object.entries(attributes || {}).forEach(([name, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (name === "class") node.className = value;
      else node.setAttribute(name, value === true ? "" : String(value));
    });
    return appendChildren(node, children);
  }

  /* Announce a message to screen-reader users through the page's polite live region. */
  function announce(message) {
    const region = document.getElementById("live-status");
    if (!region) return;
    region.textContent = "";
    window.setTimeout(() => { region.textContent = message; }, 50);
  }

  window.SCTCC.dom = Object.freeze({ el, appendChildren, announce });
})();
