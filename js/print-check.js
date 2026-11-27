/*
 * SCTCC Syllabus Builder — guided Save as PDF and the findings list
 *
 * Shows the results of SCTCC.validation.validate() in two places:
 *   - the Save as PDF dialog (a native <dialog>, so focus stays inside it and
 *     Escape closes it), and
 *   - the "Check before saving as PDF" group in the editor.
 * Each finding with a field has a "Go to" button that opens the editor at that field.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  const { el, announce } = window.SCTCC.dom;

  let goToField = () => {};
  let printCallback = null;
  let returnFocusTo = null;

  function setGoTo(handler) {
    goToField = handler;
  }

  let findingCounter = 0;

  /* Each "Go to field" button is described by its message, so screen readers can tell them apart. */
  function findingItem(item) {
    findingCounter += 1;
    const messageId = `finding-${findingCounter}`;
    return el("li", null,
      el("span", { id: messageId }, item.message),
      item.path
        ? [" ", el("button", { type: "button", class: "btn btn-small", "data-go-path": item.path, "aria-describedby": messageId }, "Go to field")]
        : null);
  }

  /* Build the three lists into `container`. */
  function renderFindings(container, result, headingLevel) {
    container.textContent = "";
    const level = headingLevel || 3;
    const block = (items, kind, title) => (items.length
      ? el("div", { class: `notice notice-${kind} findings` },
        el(`h${level}`, { class: "findings-title" }, title),
        el("ul", null, items.map((item) => findingItem(item))))
      : null);
    const errors = result.errors.length;
    container.append(...[
      block(result.errors, "error", errors === 1 ? "1 problem to fix before saving as PDF" : `${errors} problems to fix before saving as PDF`),
      block(result.warnings, "warning", "Please review"),
      block(result.notices, "info", "For your information")
    ].filter(Boolean));
    if (!errors && !result.warnings.length) {
      container.prepend(el("p", { class: "notice notice-info findings-ok" }, el("strong", null, "Ready to print."), " No problems were found."));
    }
  }

  function dialogElement() {
    return document.getElementById("print-dialog");
  }

  function close() {
    const dialog = dialogElement();
    if (dialog.open) dialog.close();
  }

  /* Open the guided Save as PDF dialog. */
  function open(result, options) {
    const dialog = dialogElement();
    const body = dialog.querySelector("#print-dialog-body");
    const actions = dialog.querySelector("#print-dialog-actions");
    printCallback = options.onPrint;
    returnFocusTo = document.activeElement;
    body.textContent = "";
    actions.textContent = "";

    if (result.errors.length) {
      body.appendChild(el("p", null, "Your syllabus is not ready to print yet. Fix the problems below, then choose Save as PDF again."));
      const findings = el("div");
      renderFindings(findings, result, 3);
      body.appendChild(findings);
      actions.appendChild(el("button", { type: "button", class: "btn btn-primary", "data-dialog": "close", autofocus: true }, "Close"));
    } else {
      if (result.warnings.length || result.notices.length) {
        const findings = el("div");
        renderFindings(findings, result, 3);
        body.appendChild(findings);
      }
      body.appendChild(el("h3", { class: "findings-title" }, "How to save your PDF"));
      body.appendChild(el("ol", { class: "print-steps" },
        el("li", null, "Choose ", el("strong", null, "Continue to Save as PDF"), ". Your browser opens its own window, which it titles Print. There, set ", el("strong", null, "Destination"), " (or Printer) to ", el("strong", null, "Save as PDF"), ". ",
          el("strong", null, "Do not choose Adobe PDF or Microsoft Print to PDF:"), " they make a PDF whose text cannot be selected or read by screen readers."),
        el("li", null, "Open ", el("strong", null, "More settings"), " and turn ", el("strong", null, "off Headers and footers"), ". The syllabus prints its own footer and page numbers. Leave Background graphics off."),
        el("li", null, "Choose ", el("strong", null, "Save"), ", then pick your own folder or your OneDrive folder. The suggested name is ", el("strong", null, `${options.fileName}.pdf`), "."),
        el("li", null, "Upload the PDF to your D2L course.")));
      body.appendChild(el("p", { class: "editor-note" }, "Use Chrome or Edge for a PDF that screen readers can read and with working links."));
      actions.appendChild(el("button", { type: "button", class: "btn btn-primary", "data-dialog": "print", autofocus: true }, "Continue to Save as PDF"));
      actions.appendChild(el("button", { type: "button", class: "btn", "data-dialog": "close" }, "Cancel"));
    }

    dialog.showModal();
    const first = dialog.querySelector("[autofocus]");
    if (first) first.focus();
    announce(result.errors.length
      ? `Not ready to print: ${result.errors.length} problem${result.errors.length === 1 ? "" : "s"} to fix.`
      : "Ready to print.");
  }

  function bind() {
    const dialog = dialogElement();
    dialog.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go-path]");
      if (go) {
        returnFocusTo = null;
        close();
        goToField(go.getAttribute("data-go-path"));
        return;
      }
      const action = event.target.closest("[data-dialog]");
      if (!action) return;
      const choice = action.getAttribute("data-dialog");
      if (choice === "print") {
        returnFocusTo = null;
        close();
        const callback = printCallback;
        window.setTimeout(() => { if (callback) callback(); }, 50); /* let the dialog close first */
      } else {
        close();
      }
    });
    dialog.addEventListener("close", () => {
      if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus();
      returnFocusTo = null;
    });
  }

  document.addEventListener("DOMContentLoaded", bind);

  window.SCTCC.printCheck = Object.freeze({ open, close, renderFindings, setGoTo });
})();
