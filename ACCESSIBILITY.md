# Accessibility Statement — SCTCC Syllabus Builder

| | |
|---|---|
| **Owner (title)** | *To be supplied* — the SCTCC position responsible for digital accessibility review of this builder |
| **Technical maintainer** | Repository maintainer (see `.github/CODEOWNERS`) |
| **Last reviewed** | 2026-11-26 |
| **Next review due** | 2027-07-01 (a GitHub issue opens automatically each July 1) |
| **Status** | Designed to the target below; **not yet verified by manual testing** — see the checklist |

This file records **which standards the builder and its PDFs are held to and why**. It does not copy the standards themselves: those belong to W3C, the U.S. Department of Justice, and Minnesota State, and they change. When a source changes, update the table below, then the checklist, then the checks.

## What is covered

1. **The builder** — the web page instructors use (editor, start screen, dialogs, preview).
2. **The output** — the syllabus PDF students receive in D2L, and the student preview it is printed from.

Instructor-entered content (photo descriptions, link wording, pasted text) is part of the output. The builder guides and checks what it can; the instructor remains responsible for their own content.

## Standards

| Standard | Version / level | Role for this project | Source |
|---|---|---|---|
| Web Content Accessibility Guidelines (WCAG) | **2.1 Level AA** | **Legal minimum.** DOJ's ADA Title II rule (2024) adopts WCAG 2.1 AA for public entities' web content. Compliance date for large public entities extended to **April 26, 2027** (Interim Final Rule, April 20, 2026). | https://www.w3.org/TR/WCAG21/ · https://www.ada.gov/resources/2024-03-08-web-rule/ |
| Web Content Accessibility Guidelines (WCAG) | **2.2 Level AA** | **Design target** (project instructions). Meeting 2.2 AA also meets 2.1 AA. | https://www.w3.org/TR/WCAG22/ |
| Minnesota State Board Policy 1B.4, Procedure 1B.4.2, Operating Instruction 1B.4.2.1 | current | System policy on access and accommodation, accessible learning and work environments, and **scheduled digital accessibility review**. This builder's yearly review should follow SCTCC's process under 1B.4.2.1. | https://www.minnstate.edu/board/policy/1b04.html · https://www.minnstate.edu/board/procedure/1b04p2.html · https://www.minnstate.edu/board/procedure/1b04p2g1.html |
| State of Minnesota Digital Accessibility Standard | WCAG 2.1 AA (effective July 1, 2024) | State standard; same technical level. | https://mn.gov/mnit/government/policies/accessibility/ |
| PDF/UA (ISO 14289-1) | PDF/UA-1 | **Goal for the PDF.** Chrome and Edge produce tagged PDFs; full PDF/UA conformance is not yet verified. | ISO 14289-1 (published by ISO; overview from the PDF Association, pdfa.org) |

*Items marked "to be supplied" or "to be confirmed" should be checked by the owner. Nothing here is legal advice.*

## How conformance is checked

| Check | When | What it catches | Where |
|---|---|---|---|
| **Automated page check** (axe-core) | Every pull request that changes the page, styles, code, or content; every push to `main`; on demand | Missing labels and names, contrast, heading and list structure, language, ARIA misuse, duplicate IDs — on the start screen, the instructor view, and the student view of the sample course | `scripts/check-accessibility.mjs`, `.github/workflows/check-accessibility.yml` |
| **Automated PDF check** | Same runs | The sample syllabus PDF is tagged, has a language and title, real headings, table header cells, link and figure descriptions | `scripts/check-pdf.py` |
| **College content check** | Every content change | Unsafe tags, "here" link text, `http://` links, placeholders | `scripts/check-content.mjs` |
| **Manual review by a person** | Yearly (July), and before any major release | Keyboard-only use, screen reader (NVDA or JAWS, plus VoiceOver), 200% zoom and 320 px reflow, PDF in Acrobat's Accessibility Check and PAC, PDF in D2L | `docs/accessibility-checklist.md` |

Automated tools find only part of WCAG problems. The manual review is required, not optional.

## Known gaps (as of 2026-11-26)

- Manual testing (screen reader, keyboard-only, zoom, Acrobat/PAC on a real PDF) has not been done yet.
- Chrome-made PDFs do not claim PDF/UA, and their link annotations have no separate descriptions; the PDF check reports these as warnings.
- College content files contain some "here" links and `http://` links (listed in the README); their owners need to fix the wording.
- The PDF footer depends on Chrome or Edge 131+.

## Updating this file

1. Owner reviews the sources above each July (an issue opens automatically) or when notified of a change.
2. If a standard or level changes: update the **Standards** table, add or change rows in `docs/accessibility-checklist.md`, and update the axe tags in `scripts/check-accessibility.mjs` (`AXE_TAGS`).
3. Record the review date above and in the checklist's review log.
4. Changes go through a pull request reviewed by the owner (see `.github/CODEOWNERS`).

## Reporting a problem

Students needing the syllabus in another format contact Accessibility Services (see the syllabus's Accommodations section). Problems with the builder itself: open an issue in this repository or contact the owner above.
