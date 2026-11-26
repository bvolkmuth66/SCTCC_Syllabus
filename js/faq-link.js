/*
 * SCTCC Syllabus Builder — open the FAQs in their own window.
 * Any link with data-faq-link opens faq.html in a separate window that can sit beside
 * the builder. If the browser blocks the window, the link's own target opens a new tab.
 * Opening the FAQs never navigates the builder, so unsaved work is never at risk.
 */
(function () {
  "use strict";

  function openFaq(event) {
    const link = event.target.closest("a[data-faq-link]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const width = Math.min(820, Math.max(480, Math.round(window.screen.availWidth * 0.45)));
    const height = Math.max(520, Math.round(window.screen.availHeight * 0.85));
    const faqWindow = window.open(link.href, "sctccFaq", `popup,width=${width},height=${height}`);
    if (faqWindow) {
      event.preventDefault();
      faqWindow.focus();
    }
  }

  document.addEventListener("click", openFaq);
})();
