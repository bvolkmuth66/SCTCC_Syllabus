# Accessibility Checklist — WCAG 2.2 Level A and AA

Companion to [`ACCESSIBILITY.md`](../ACCESSIBILITY.md). One row per success criterion: whether it applies to the **builder** (instructor page) and/or the **output** (student preview and PDF), how the builder meets it, and how it is tested.

**Test column:** **Auto** = covered (at least partly) by the automated page or PDF check on GitHub · **Manual** = a person must test it · **N/A** = does not apply (reason given).

**Result column:** fill in during each review — Pass, Fail (with issue link), or Not tested. "Not tested" is the honest starting value.

WCAG 2.2 removed 4.1.1 Parsing; it is listed at the end because WCAG 2.1 (the legal minimum) still includes it.

## Perceivable

| SC | Level | Applies to | How the builder meets it | Test | Result (2026-11-26) |
|---|---|---|---|---|---|
| 1.1.1 Non-text Content | A | Both | Instructor photo has a description field (default "Photo of [name]"); logo has alt text; decorative images are empty-alt; icons are text buttons | Auto + Manual | Not tested |
| 1.2.1 Audio-only and Video-only | A | — | N/A: the builder has no audio or video | N/A | — |
| 1.2.2 Captions (Prerecorded) | A | — | N/A: no media | N/A | — |
| 1.2.3 Audio Description or Media Alternative | A | — | N/A: no media | N/A | — |
| 1.2.4 Captions (Live) | AA | — | N/A: no media | N/A | — |
| 1.2.5 Audio Description (Prerecorded) | AA | — | N/A: no media | N/A | — |
| 1.3.1 Info and Relationships | A | Both | Real headings (one h1, numbered h2/h3), lists, `address`, tables with captions and `th scope`; form fields with labels, fieldsets with legends; PDF is tagged | Auto + Manual (PDF tags in Acrobat/PAC) | Not tested |
| 1.3.2 Meaningful Sequence | A | Both | Source order matches visual order; PDF reading order follows the page | Manual | Not tested |
| 1.3.3 Sensory Characteristics | A | Both | Instructions do not rely on shape, color, or position alone | Manual | Not tested |
| 1.3.4 Orientation | AA | Both | No orientation lock | Manual | Not tested |
| 1.3.5 Identify Input Purpose | AA | Builder | `autocomplete` on instructor email and telephone | Auto + Manual | Not tested |
| 1.4.1 Use of Color | A | Both | Missing information marked with bracketed text and dashed border; check results use words and headings, not color alone | Manual | Not tested |
| 1.4.2 Audio Control | A | — | N/A: no audio | N/A | — |
| 1.4.3 Contrast (Minimum) | AA | Both | Brand primary #004d43 on white 9.8:1; failing brand colors used only decoratively | Auto | Not tested |
| 1.4.4 Resize Text | AA | Both | Relative units; usable at 200% | Manual | Not tested |
| 1.4.5 Images of Text | AA | Both | No images of text (the logo is exempt) | Manual | Not tested |
| 1.4.10 Reflow | AA | Both | No horizontal scrolling at 320 CSS px except inside scrollable table regions | Manual | Not tested |
| 1.4.11 Non-text Contrast | AA | Builder | Field borders, focus outline, and buttons meet 3:1 | Auto (partly) + Manual | Not tested |
| 1.4.12 Text Spacing | AA | Both | No fixed-height text containers | Manual | Not tested |
| 1.4.13 Content on Hover or Focus | AA | Builder | No hover-only pop-ups; native tooltips only | Manual | Not tested |

## Operable

| SC | Level | Applies to | How the builder meets it | Test | Result (2026-11-26) |
|---|---|---|---|---|---|
| 2.1.1 Keyboard | A | Builder | Native buttons, links, `details`, and `dialog`; all actions are buttons | Manual | Not tested |
| 2.1.2 No Keyboard Trap | A | Builder | Native `dialog` with Escape; focus returns to the opener | Manual | Not tested |
| 2.1.4 Character Key Shortcuts | A | Builder | Only Ctrl/Cmd+S (uses a modifier key) | Manual | Not tested |
| 2.2.1 Timing Adjustable | A | Builder | No time limits | N/A | — |
| 2.2.2 Pause, Stop, Hide | A | Builder | No moving or auto-updating content; respects reduced motion | Manual | Not tested |
| 2.3.1 Three Flashes or Below | A | Both | Nothing flashes | N/A | — |
| 2.4.1 Bypass Blocks | A | Builder | Skip links to the syllabus and to the editor; landmarks | Auto + Manual | Not tested |
| 2.4.2 Page Titled | A | Both | Page `title`; PDF title from the document title | Auto (page, PDF) | Not tested |
| 2.4.3 Focus Order | A | Builder | Source order; focus moves to dialogs, new rows, and results and returns afterward | Manual | Not tested |
| 2.4.4 Link Purpose (In Context) | A | Both | Link text names its destination; some college content links read "here" (owners to fix; flagged by the content check) | Auto (content check) + Manual | **Known issue** |
| 2.4.5 Multiple Ways | AA | Output | Single document with a Contents list and numbered sections | Manual | Not tested |
| 2.4.6 Headings and Labels | AA | Both | Descriptive, numbered headings; every field has a visible label | Auto + Manual | Not tested |
| 2.4.7 Focus Visible | AA | Builder | `:focus-visible` outline on every control | Manual | Not tested |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Builder | Scroll padding keeps a focused item out from under the sticky toolbar | Manual | Not tested |
| 2.5.1 Pointer Gestures | A | Builder | No multipoint or path gestures | Manual | Not tested |
| 2.5.2 Pointer Cancellation | A | Builder | Native click activation (on release) | Manual | Not tested |
| 2.5.3 Label in Name | A | Builder | Accessible names start with the visible text (fixed 2026-11-26 after automated runs: move buttons "Move up: Labs"; calendar workspace class buttons now read their visible text, then the date) | Auto (partly) + Manual | Fixed after automated runs |
| 2.5.4 Motion Actuation | A | Builder | No motion input | N/A | — |
| 2.5.7 Dragging Movements | AA | Builder | No dragging; rows move with Move earlier/later buttons | Manual | Not tested |
| 2.5.8 Target Size (Minimum) | AA | Builder | Buttons and checkboxes at least 24×24 CSS px or spaced | Auto (partly) + Manual | Not tested |

## Understandable

| SC | Level | Applies to | How the builder meets it | Test | Result (2026-11-26) |
|---|---|---|---|---|---|
| 3.1.1 Language of Page | A | Both | `lang="en"`; PDF language set from the page | Auto (page, PDF) | Not tested |
| 3.1.2 Language of Parts | AA | Output | Instructor text in another language is not marked (no field for it) | Manual | Not tested |
| 3.2.1 On Focus | A | Builder | Focus never triggers a change of context | Manual | Not tested |
| 3.2.2 On Input | A | Builder | Typing updates the preview only; no navigation or submission on input | Manual | Not tested |
| 3.2.3 Consistent Navigation | AA | Builder | One page; toolbar is constant | N/A (single page) | — |
| 3.2.4 Consistent Identification | AA | Builder | Same names for the same actions (Save syllabus, Open a saved syllabus, Save as PDF — the same names in the toolbar and the editor) | Manual | Not tested |
| 3.2.6 Consistent Help | A | Builder | Help text in the same place in each group (notes and hints under labels) | Manual | Not tested |
| 3.3.1 Error Identification | A | Builder | Check before printing names each problem in text, with Go to field | Manual | Not tested |
| 3.3.2 Labels or Instructions | A | Builder | Visible labels and hints; required items explained | Auto (partly) + Manual | Not tested |
| 3.3.3 Error Suggestion | AA | Builder | Findings say how to fix (for example "Choose exactly as many days as meetings") | Manual | Not tested |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Builder | Confirmation before discarding work or replacing dates; nothing is submitted anywhere | Manual | Not tested |
| 3.3.7 Redundant Entry | A | Builder | Calendar uses the course dates; college dates fill in with one button | Manual | Not tested |
| 3.3.8 Accessible Authentication (Minimum) | AA | — | N/A: no sign-in | N/A | — |

## Robust

| SC | Level | Applies to | How the builder meets it | Test | Result (2026-11-26) |
|---|---|---|---|---|---|
| 4.1.2 Name, Role, Value | A | Builder | Native controls; `aria-pressed` on the preview toggle; `details`/`dialog` | Auto + Manual | Not tested |
| 4.1.3 Status Messages | AA | Builder | `aria-live="polite"` region announces saves, imports, generation, and check results | Manual (screen reader) | Not tested |
| 4.1.1 Parsing (WCAG 2.1 only) | A | Both | Valid HTML5 generated by the DOM | Auto | Not tested |

## PDF-specific checks (PDF/UA goal)

| Item | How | Test | Result (2026-11-26) |
|---|---|---|---|
| Tagged PDF with structure tree | Chrome/Edge "Save as PDF" | Auto (`check-pdf.py`) | Pass (automated, 2026-11-26) |
| Document language and title | From the page `lang` and `title` | Auto | Pass (automated, 2026-11-26) |
| Title shown in the window (DisplayDocTitle) | Set by Chrome | Auto | Pass (automated, 2026-11-26) |
| Title is readable, not a file name | "ITEC 0000 Sample Course Syllabus, Spring 2027" (changed 2026-11-26; also the suggested file name) | Auto (warning if it looks like a file name) | Pass (automated, 2026-11-26) |
| Headings tagged H1–H4 in order | From page headings | Auto | Pass (automated, 2026-11-26) |
| Tables with header cells; repeated headers | `th` + print CSS | Auto + Manual | Not tested |
| Links readable and tagged | From page links | Auto + Manual | Not tested |
| Reading order and artifacts (footer marked as artifact) | Chrome output | Manual (PAC / Acrobat) | Not tested |
| Made with "Save as PDF" (not the Adobe PDF or Microsoft Print to PDF printers, which produce untagged PDFs with unreadable text) | Print dialog step 1 warns against them | Manual | **Known risk** — a faculty test PDF made with Adobe PDF (2026-11-26) was untagged and its text could not be selected |
| Body text at least 11 pt; nothing below 9 pt | print.css (raised 2026-11-26 from 10.5 pt) | Manual | Pass (2026-11-26) |
| Uploads and opens correctly in D2L | — | Manual | Not tested |

## Manual review procedure (yearly, about 1–2 hours)

1. **Keyboard only:** start screen → import → edit each group → Check before printing → Save as PDF, using Tab, Shift+Tab, Enter, Space, Escape. Focus is always visible and never hidden under the toolbar.
2. **Screen reader:** NVDA or JAWS with Chrome/Edge; VoiceOver with Safari. Headings list, landmarks, form labels, dialogs, and live announcements.
3. **Zoom and reflow:** 200% browser zoom; window 320 px wide.
4. **PDF:** make the PDF from the sample course and one real syllabus; run Acrobat Pro's Accessibility Check and PAC (PDF Accessibility Checker); read it with a screen reader; upload to a D2L test shell.
5. Record results in the tables above and in the review log; open an issue for each failure.

## Review log

| Date | Reviewer (title) | Standards version | Summary |
|---|---|---|---|
| 2026-11-26 | Builder maintainer | WCAG 2.2 AA target / 2.1 AA minimum | Checklist created; automated checks added. PDF check on the sample: tagged, language, title, headings H1–H4, table headers pass; title read like a file name (fixed the same day: readable title, also used as the file name). axe page check first runs on GitHub. Manual testing not yet done. |
