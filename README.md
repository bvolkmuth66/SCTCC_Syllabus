# SCTCC Syllabus Builder

An accessible HTML syllabus builder for St. Cloud Technical & Community College (SCTCC).

Instructors open the builder in a web browser, enter their course information, and use **Print to PDF** to create the syllabus they post in their D2L course shell. Students only ever see the PDF.

College-wide content (policies, support information, the footer) is **not** typed by instructors. Each piece lives in its own file in the `content/` folder, maintained by the office that owns it. Every syllabus picks up the current approved wording the next time an instructor makes a PDF.

> **Status: Phase 1 preview (trial).** This version loads the college content and shows a sample course. Editing forms, autosave, JSON import/export, the grading editor, the calendar generator, and pre-print validation come in later phases (see [Roadmap](#roadmap)).

---

## Contents

- [How it works](#how-it-works)
- [Repository structure](#repository-structure)
- [Running the builder](#running-the-builder)
- [Editing college content (for content owners)](#editing-college-content-for-content-owners)
- [The content manifest](#the-content-manifest)
- [Printing to PDF](#printing-to-pdf)
- [Branding: logo, colors, and font](#branding-logo-colors-and-font)
- [Accessibility](#accessibility)
- [Items needing administrative verification](#items-needing-administrative-verification)
- [Instructor guidance from the template](#instructor-guidance-from-the-template)
- [Testing checklist](#testing-checklist)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## How it works

1. `index.html` loads the instructor's course data. In Phase 1 this is the sample course in `examples/sample-course-data.js`.
2. `js/content-loader.js` reads `content/content-manifest.json`, then loads each college content file listed there.
3. Each content file is **sanitized** before it reaches the page. Only simple formatting tags survive (paragraphs, lists, links, bold, italics). Scripts, styles, images, and forms are removed and never run.
4. `js/syllabus.js` assembles the syllabus in the order of the SCTCC Syllabus Template (July 2026) and inserts each college section where its manifest entry says it belongs.
5. **Instructor view** shows builder controls, notes, and content-owner labels. **Student preview** and the PDF show only the finished syllabus.

Instructor data is never sent anywhere or committed to this repository.

## Repository structure

```
SCTCC_Syllabus/
├── index.html                      The builder page
├── css/
│   ├── syllabus.css                Screen styles (brand colors, layout)
│   └── print.css                   PDF / print styles (US Letter)
├── js/
│   ├── syllabus-config.js          Settings only (content location, logo, mode)
│   ├── syllabus-data.js            Course data model and shared date/time helpers
│   ├── content-loader.js           Loads, checks, and sanitizes college content
│   └── syllabus.js                 Builds the syllabus, modes, Print to PDF
├── content/
│   ├── content-manifest.json       List of college sections and where they go
│   └── *.html                      One file per college section (19 files)
├── assets/
│   ├── sctcc-logo-placeholder.svg  Placeholder until Marketing supplies the logo
│   └── favicon.svg                 Generic browser-tab icon (not the college logo)
├── examples/
│   └── sample-course-data.js       Invented sample course for previewing
├── .github/CODEOWNERS              Who reviews changes to each file
├── .nojekyll                       Serve files as-is on GitHub Pages
└── README.md
```

**Differences from the original project plan** (all intentional):

| Plan | This repository | Why |
|---|---|---|
| `college-policies.html` | `academic-integrity.html` (+ optional `academic-integrity-examples.html`) | Each office edits only its own file; "College Policies & Procedures" is the page heading that groups several files. |
| 10 content files | 19 content files | Mission statement, change notice, academic calendar links, required technology, technical-skills link, first-week drop/FW paragraph, student email, and footer are also college text, so they are maintained the same way instead of being typed into code. |
| Config inside `syllabus-data.js` | Separate `js/syllabus-config.js` | Keeps settings apart from code. |
| `assets/sctcc-logo.svg` | `assets/sctcc-logo-placeholder.svg` | The official logo has not been supplied yet. |
| `js/calendar-builder.js` | Not yet created | Added in Phase 4. |
| `LICENSE` | Not yet added | The policy text belongs to SCTCC; choose a license with the college before adding one. |

## Running the builder

Browsers block a page opened directly from your disk (`file://...`) from loading other files, so the college content will not appear that way. Use one of these instead:

**GitHub Pages (how instructors will use it)**
1. In the repository, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. After a minute the site is available at `https://bvolkmuth66.github.io/SCTCC_Syllabus/`.
4. GitHub Pages requires a **public** repository on a free GitHub account.

**On your own computer**
- Visual Studio Code: install the **Live Server** extension, open the folder, and click **Go Live**; or
- In a terminal, from the repository folder: `python3 -m http.server 8000`, then open `http://localhost:8000`.

**Moving the repository to a college GitHub organization later**: use **Settings → General → Transfer ownership**. All paths in the builder are relative, so no code changes are needed. Only the GitHub Pages address changes (for example to `https://sctcc.github.io/SCTCC_Syllabus/`); update any links you have shared.

## Editing college content (for content owners)

Each college section is one small file in `content/`. You only ever need to open your own file.

**To change your section on GitHub:**
1. Open the `content` folder and click your file (for example `accommodations.html`).
2. Click the **pencil icon** (Edit this file).
3. Change the words. Keep the tags around them:
   - `<p>` … `</p>` is a paragraph.
   - `<ul>` with `<li>` … `</li>` items is a bulleted list; `<ol>` is a numbered list.
   - `<a href="https://...">link text</a>` is a link. Make the link text describe where it goes (not "here").
   - `<strong>` … `</strong>` is bold; `<em>` … `</em>` is italic.
   - Write `&amp;` for an ampersand (&).
4. Update the comment block at the top: **LAST-REVIEWED** (today's date, `yyyy-mm-dd`) and **VERSION** if your office versions its text.
5. Click **Commit changes…**, choose **Create a new branch and start a pull request**, and describe the change.
6. The file's owner listed in `.github/CODEOWNERS` reviews and approves it. Once merged, every new syllabus PDF uses the new wording.

**Things that are removed automatically** (so they cannot break the syllabus): `<script>`, `<style>`, images, forms, embedded frames, and any formatting attributes. Unknown tags are removed but their text is kept.

**Field tokens.** A few files contain a placeholder like this:

```html
<span data-field="course.withdrawalDate" data-format="date"></span>
```

The builder replaces it with the instructor's value (here, the last day to withdraw). Do not delete these.

**Do not change policy wording without authorization.** The text in these files was copied exactly from the SCTCC Syllabus Template (July 2026), except the footer, which uses the wording from the SCTCC Brand Standards (2025).

## The content manifest

`content/content-manifest.json` lists every college section. Each entry looks like this:

```json
{
  "id": "accommodations",
  "title": "Accommodations",
  "file": "accommodations.html",
  "placement": "college-policies",
  "showTitle": true,
  "required": true,
  "defaultEnabled": true,
  "owner": "Accessibility Services (to be confirmed)"
}
```

| Field | Meaning |
|---|---|
| `id` | Unique name. Do not change once in use. |
| `title` | Heading shown in the syllabus (when `showTitle` is true). |
| `file` | File in `content/`. Lowercase letters, numbers, and hyphens, ending in `.html`. |
| `placement` | Where it appears: `header`, `general-information`, `required-technology`, `technical-skills`, `college-policies`, `attendance`, `course-policies`, or `footer`. Sections appear in the order listed. |
| `showTitle` | `true` gives the section its own heading. |
| `required` | `true` means instructors cannot turn it off. |
| `defaultEnabled` | For optional sections, whether it starts on. |
| `optionalKey` | For optional sections, the instructor setting that turns it on or off. |
| `owner` | The responsible office, shown to instructors. |
| `instructorNote` | Guidance shown only in instructor view (never in the PDF). |

Change `contentVersion` and `lastUpdated` at the top when a set of changes is approved. The version appears in the instructor's builder status panel.

**To add a new college section:** create the `.html` file in `content/`, add an entry to the manifest, and add a line for it in `.github/CODEOWNERS`.

## Printing to PDF

1. Click **Print to PDF** in the builder toolbar. The builder switches to the student view and suggests a file name such as `ITEC-0000-Spring-2027-Syllabus`.
2. In the print dialog, set **Destination** to **Save as PDF** (or **Microsoft Print to PDF**).
3. Under **More settings**, turn **Headers and footers off**. The syllabus prints its own footer (college name, course, term, syllabus version, and page numbers).
4. Leave **Background graphics** off to save ink. Nothing important depends on it.
5. Save and upload the PDF to your D2L course.

Use **Google Chrome or Microsoft Edge**. They create tagged PDFs that screen readers can read, keep links clickable, and support the syllabus's own page footer. Other browsers still produce a usable PDF but may omit the page footer or tagging.

## Branding: logo, colors, and font

Source: *SCTCC Brand Standards 2025* (Marketing & Communications). Printed hex values are used as published.

| Role | Color | Contrast on white | Use |
|---|---|---|---|
| `--sctcc-primary` | PMS 3305 `#004d43` | 9.8 : 1 | Headings, links, table rules |
| `--sctcc-green` | PMS 576 `#789b4a` | 3.2 : 1 | Decorative rules only, never text |
| `--sctcc-orange` | PMS 153 `#c16c29` | 3.9 : 1 | Decorative rules only, never text |
| `--sctcc-text` | Black `#000000` | 21 : 1 | Body text |
| `--sctcc-border` | Warm Grey 1 `#d8d1ca` | — | Table and content borders |

Note for Marketing: the brand guide's printed hex values do not match its listed RGB values for PMS 576, PMS 153, and PMS 144.

**Logo.** The brand guide allows the logo only from Marketing's files (sctcc.edu/media). To install it:
1. Get the preferred 3-color logo with "A member of Minnesota State" from Marketing (SVG preferred; otherwise a high-resolution PNG).
2. Add it to `assets/` (for example `assets/sctcc-logo.svg`).
3. In `js/syllabus-config.js`, set `logo.src` to the file and `logo.isPlaceholder` to `false`.

**Font.** Arimo is an approved SCTCC font with no license required, and it has the same letter widths as Arial, so the layout does not change if it is missing. To include it, download Arimo from Google Fonts, convert or obtain `.woff2` files, place them in `assets/fonts/`, and remove the comment markers around the `@font-face` rules at the top of `css/syllabus.css`. The builder does not load fonts from Google's servers.

## Accessibility

Target: WCAG 2.2 Level AA, for both the builder and the PDF.

- One `h1`, then `h2` for major sections, `h3` and `h4` beneath; headings are never skipped.
- Contents list (`nav`), `main` landmark, skip link, and "Back to top" links after each major section (screen only).
- Instructor contact details use `address`; tables have captions and `scope` on header cells.
- Missing information is marked with text in brackets (for example "[Withdrawal date needed]") and a dashed border, not color alone.
- Visible focus outline on every control; respects reduced-motion settings; no horizontal scrolling at 320 px wide except inside scrollable table regions.
- Brand colors that fail text contrast are used only for decoration.

## Items needing administrative verification

These come from the July 2026 template. The text has **not** been changed; each file also notes its item in its header comment.

| File | Item |
|---|---|
| `accommodations.html` | Two numbers for Accessibility Services: 320-308-5064 and 320-308-5757. Also "320- 308-5064" contains a stray space. |
| `student-email.html` | Student Computer Lab number reads **302**.308.6445; Technical Support lists 320.308.6445. |
| `technical-support.html` | "Computer Help Desk" link opens an email (onlinehelp@sctcc.edu), not a web page. Two links read "here." Some links use `http://`. |
| `academic-integrity.html` | Grievance link uses an old `sctcc.edu/sites/default/files/...` address and may be broken; "procedure 3.24.1" may need to be "S3.24.1"; link text "here." |
| `turnitin.html` | Cites a Canvas Community forum thread as its source rather than an SCTCC policy; that link may be dead. |
| `navigating-d2l.html` | The Announcements item describes the Content tool. "Microsoft Word or PDF" is an instructor choice, not a college rule. |
| `academic-calendar-links.html` | eServices link includes Google Analytics tracking parameters. |
| `pulse-app.html` | Apple link uses the older `itunes.apple.com` format; confirm both store links. |
| `technical-skills-resources.html` | `support.office.com` training link may redirect; confirm current URL. |
| Template | Header says "Revised: July 2026," footer says "Template Updated February 2026." |
| `enrollment-requirements.html` | The template gives this text twice with different wording (General Information and Attendance). The General Information wording is used once, under Attendance. Confirm which is official. |
| `institutional-footer.html` | Now uses Brand Standards 2025 wording (approved 2026-11-25); replaces the outdated "Minnesota State Colleges and Universities System" line and the separate equal-opportunity line. |

## Instructor guidance from the template

This guidance from the template is for instructors and does not appear in the syllabus:

- Instructors must use information from the official **SCTCC Course Outline** (course description, outcomes, prerequisites, credits).
- The course must not begin before the official semester start date and must include final exam week.
- **Accessibility & data privacy:** if you use technology not listed under the Resources tab in D2L, add its accessibility statement. If none exists, link the vendor's VPAT; if neither exists, say so. Consider plagiarism tools, presentation software, web conferencing, polling, recording tools, media players, document sharing, social media, mobile apps, and publisher platforms. Link the data privacy policy for any tool that may collect student data, or state that none was found. Closed social media groups are encouraged; otherwise state a pseudonym policy. For group texting, use a setting that hides phone numbers and say so. *(A vendor table editor is planned for Phase 2.)*
- **Technical support:** include support links for any outside vendors used in the course.

## Testing checklist

Phase 1 (tested in headless Chrome on 2026-11-25):

- [x] All 19 content files load from the manifest with no console errors
- [x] Heading order: one `h1`, no skipped levels
- [x] Instructor view vs. student preview toggle; notes and owner labels hidden in student view
- [x] Optional sections (Turnitin, Class Environment, etc.) appear and disappear with no empty headings
- [x] Missing content file → error listed for instructors; neutral "temporarily unavailable" text for students
- [x] Invalid manifest JSON → clear message for instructors
- [x] Script, event-handler, `javascript:` link, image, and iframe in a content file are removed and never run
- [x] Field token fills in the withdrawal date
- [x] 320 px wide: no horizontal page scrolling
- [x] PDF: US Letter, page footer with course, version, and page numbers on every page, headings kept with their content
- [ ] PDF: table headers repeating across pages (styled to repeat; not yet tested with a calendar long enough to span pages)

Still to test by a person: keyboard-only use, a screen reader (NVDA or JAWS), 200% zoom, and the PDF in Adobe Acrobat's accessibility checker and D2L.

## Known limitations

- Phase 1 shows sample data only; instructors cannot edit yet.
- The logo is a placeholder.
- Arimo font files are not bundled yet (Arial is used).
- The page footer in the PDF requires Chrome or Edge version 131 or later.
- No pre-print validation yet; an incomplete syllabus can still be printed (missing values are clearly marked).

## Roadmap

| Phase | Scope |
|---|---|
| **1 (this version)** | Content files, manifest, loader, sanitizer, rendered preview, print styles, basic Print to PDF |
| 2 | Instructor editing forms, autosave in the browser, JSON export/import, reset, vendor table, instructor overrides (Class Environment, accepted file formats) |
| 3 | Grading editor: points and percentage methods, scale editor with overlap/gap checks |
| 4 | Course calendar generator (1–4 meetings per week, plus a weekly mode for online courses), holidays, regeneration that keeps entered text |
| 5 | Validation before printing, guided Print to PDF, GitHub Action to check content files (HTML, links, link text, placeholders) |
