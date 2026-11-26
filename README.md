# SCTCC Syllabus Builder

An accessible HTML syllabus builder for St. Cloud Technical & Community College (SCTCC).

Instructors open the builder in a web browser, enter their course information, and use **Print to PDF** to create the syllabus they post in their D2L course shell. Students only ever see the PDF.

College-wide content (policies, support information, the footer) is **not** typed by instructors. Each piece lives in its own file in the `content/` folder, maintained by the office that owns it. Every syllabus picks up the current approved wording the next time an instructor makes a PDF.

> **Status: Phase 4 preview (trial).** Instructors can fill in their syllabus, build the grading table, grading scale, and course calendar, save it as a file to their own computer or OneDrive, open it again later, and print it to PDF. Full pre-print validation comes in Phase 5 (see [Roadmap](#roadmap)).

---

## Contents

- [How it works](#how-it-works)
- [Instructor workflow](#instructor-workflow)
- [Saving and opening your syllabus](#saving-and-opening-your-syllabus)
- [Grading editor](#grading-editor)
- [Course calendar generator](#course-calendar-generator)
- [Repository structure](#repository-structure)
- [Running the builder](#running-the-builder)
- [Editing college content (for content owners)](#editing-college-content-for-content-owners)
- [The content manifest](#the-content-manifest)
- [College academic calendar (for Records & Registration)](#college-academic-calendar-for-records--registration)
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

1. `index.html` opens with a blank syllabus. The instructor starts fresh or opens a syllabus file they saved earlier.
2. `js/content-loader.js` reads `content/content-manifest.json`, then loads each college content file listed there.
3. Each content file is **sanitized** before it reaches the page. Only simple formatting tags survive (paragraphs, lists, links, bold, italics). Scripts, styles, images, and forms are removed and never run.
4. `js/syllabus.js` assembles the syllabus in the order of the SCTCC Syllabus Template (July 2026) and inserts each college section where its manifest entry says it belongs.
5. **Instructor view** shows the editor beside a live preview, plus notes and content-owner labels. **Student preview** and the PDF show only the finished syllabus.

**A finished syllabus is the instructor's intellectual property.** The builder never stores it: not in the browser, not in this repository, and not on any server. GitHub Pages only delivers the builder's own files; nothing an instructor types is sent back. Instructors save their syllabus as a file in a folder they choose (their computer or OneDrive) and post the PDF in D2L.

## Repository structure

```
SCTCC_Syllabus/
├── index.html                      The builder page
├── css/
│   ├── syllabus.css                Screen styles (brand colors, layout)
│   └── print.css                   PDF / print styles (US Letter)
├── js/
│   ├── syllabus-config.js          Settings only (content location, logo, preview timing)
│   ├── dom-helpers.js              Small shared helpers for building page elements
│   ├── syllabus-data.js            Data model, import validation, date/time helpers
│   ├── grading.js                  Grading totals, weight check, scale check, point ranges
│   ├── calendar-builder.js         Calendar generation, regeneration, shifting topics, CSV
│   ├── syllabus-files.js           Save / Save as / Open with the computer's file dialogs
│   ├── content-loader.js           Loads, checks, and sanitizes college content
│   ├── syllabus-editor.js          The instructor editing panel
│   └── syllabus.js                 Builds the syllabus, unsaved-changes tracking, Print to PDF
├── content/
│   ├── content-manifest.json       List of college sections and where they go
│   ├── academic-calendar.json      College semester dates, finals, deadlines, no-class dates
│   └── *.html                      One file per college section (19 files)
├── assets/
│   ├── sctcc-logo-placeholder.svg  Placeholder until Marketing supplies the logo
│   └── favicon.svg                 Generic browser-tab icon (not the college logo)
├── examples/
│   └── sample-course-data.js       Invented sample course ("Load sample course" button)
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
| Editor inside `syllabus.js` | Separate `js/syllabus-editor.js`, `js/syllabus-files.js`, `js/dom-helpers.js` | Smaller files with one job each. |
| `localStorage` autosave allowed | No browser storage at all | Finished syllabi are faculty intellectual property, and copies left in a browser could be seen by the next person on a shared computer. Syllabi are saved only to files the instructor controls. |
| `assets/sctcc-logo.svg` | `assets/sctcc-logo-placeholder.svg` | The official logo has not been supplied yet. |
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

## Instructor workflow

1. Open the builder (GitHub Pages address, or a local server; see [Running the builder](#running-the-builder)). To keep working on an earlier syllabus, click **Open…** and choose your file. To reuse last term's syllabus, open it, update the term and dates, and use **Save as…** with the new name.
2. Work through the groups in the **Edit syllabus** panel. The preview updates as you type. Anything still needed is marked in the preview, for example **[Withdrawal date needed]**.
   - **Course** and **Description, outcomes, and requisites**: copy from the official SCTCC Course Outline.
   - **Credits, modality, and dates**: use the college's official dates.
   - **Course policies**: your attendance and late-work wording; accepted file formats (blank = "Microsoft Word or PDF"); optional college statements; your own Class Environment text (blank = college sample).
   - **Tools and vendors**: each outside tool's accessibility statement or VPAT, privacy policy, and support link. Tools with neither an accessibility statement nor a VPAT are listed automatically in the template's required sentence.
   - Checkboxes such as **Include my photo** or **Include a Time Commitment section** turn optional sections on and off. Turning one off keeps what you wrote.
3. Click **Save** (or press Ctrl+S / ⌘S) and choose a folder on your computer or your OneDrive folder.
4. Click **Student preview** to see exactly what students will get.
5. Click **Print to PDF**, choose **Save as PDF**, turn off **Headers and footers**, and save. Upload the PDF to D2L.

The editor never changes college content. To use different college wording, the content owner updates the file in `content/`.

## Saving and opening your syllabus

**Your syllabus is your intellectual property.** The builder never keeps a copy. It does not use browser storage, cookies, GitHub, or any server. When you close the page, the only copies are the files you saved.

- **Save** — In Chrome or Edge, the first Save opens your computer's Save dialog. Choose any folder, including your **OneDrive** folder (OneDrive appears in File Explorer or Finder when the OneDrive app is installed). The file is named after your course, for example `CPTR-1118-Spring-2027-Syllabus.json`. After that, **Save** or **Ctrl+S / ⌘S** updates the same file without asking again.
- **Save as…** — Always asks where to save. Use it to start next term's syllabus from this one.
- **Open…** — Opens a syllabus file you saved. The file is checked first: anything unexpected is skipped and listed, files from a newer version of the builder are refused, and you are told if college content has changed since the file was saved, so you know to review it and make a new PDF.
- **Other browsers** (Firefox, Safari) cannot save directly to a chosen folder. There, **Save** downloads the file to your Downloads folder; move it to your own folder or OneDrive. **Open…** uses the standard file chooser.
- **Unsaved changes** — The status line at the top of the editor shows whether your latest changes are saved. The builder asks before **New syllabus**, **Open…**, or **Load sample course** would discard unsaved work, and the browser warns you if you try to close the page.
- **Clear this syllabus** empties the fields on screen. Your saved file is not changed unless you save afterward.
- **Instructor photo** — Uploaded photos (PNG, JPEG, or WebP up to 300 KB) are stored inside your syllabus file.
- **Earlier preview builds** kept an automatic copy in the browser. When this version opens, it erases any such copies.
- **Saving directly to OneDrive in the cloud** (without the OneDrive folder on your computer) would require Microsoft sign-in registered by SCTCC IT. It is not part of this trial.

The file format is `{ "format": "sctcc-syllabus-data", "schemaVersion", "exportedAt", "contentVersion", "syllabus": { … } }`. The `syllabus` object matches `createEmptySyllabusData()` in `js/syllabus-data.js`.

## Grading editor

Open **Grading** in the editor.

**How the final grade is calculated**
- **Points** — each category has a number of assignments and points per assignment. Category total = number × points each; the course total is the sum of the categories. The syllabus table shows each category's total and its share of the course total.
- **Percentage weights** — each category has a weight. The current total is shown as you type, for example "Total weight: 90% — 10% short of 100%." The builder **never changes your percentages**. If the total is not 100%, Print to PDF is stopped until you fix it or tick **Publish with weights that do not total 100%** (for example, for extra credit — explain it under "Additional grading information"). The number of assessments is optional; the column appears only if you fill it in.

**Assessment categories** — **Add a category**, then fill in its name and numbers. Each category has **Move up**, **Move down**, and **Remove** buttons. Fields that do not apply to the chosen method are hidden but kept, so switching methods loses nothing.

**Grading scale** — Starts with A–F (90/80/70/60). Each range includes both ends (A = 90–100%, B = 80–89%). Change labels and percentages, **Add a grade**, or remove one. **Use plus/minus sample** fills in A through F with plus and minus grades; those cutoffs are only a starting point to confirm for your program. **Reset to A–F** restores the default. In the points method, the matching point range for each grade is calculated from the course total: minimum points = course total × minimum % (rounded up); maximum = one less than the next grade's minimum (the top grade's maximum is the course total).

The scale is checked as you type:

| Problem | Effect |
|---|---|
| Two grades overlap (for example B goes up to 90% and A starts at 90%) | Must fix before printing |
| A grade's minimum is above its maximum, a percentage is below 0%, or a minimum is above 100% | Must fix before printing |
| A grade has no label, or the same label is used twice | Must fix before printing |
| A gap between grades (for example B stops at 85% and A starts at 90%) | Warning |
| The top grade stops below 100%, or the bottom grade starts above 0% | Warning |
| A maximum above 100% | Warning (fine for extra credit) |

Problems are listed under the categories and the scale in the editor, and in the instructor preview under the grading tables (never in the PDF). **Print to PDF** is stopped while any "must fix" problem remains, and the list of problems appears at the top of the editor. The browser's own Print command cannot be stopped, so watch for those messages.

## Course calendar generator

Open **Course calendar** in the editor.

1. **Statement about the course schedule** — optional text shown above the calendar (or by itself if you do not build one), for example where the live schedule is posted in D2L.
2. **Calendar layout**
   - **One row per class meeting** — for courses that meet 1, 2, 3, or 4 times a week. Columns: Week, Meeting, Date, Day, Topic, Preparation/Reading, Assignment Due, Notes.
   - **One row per week** — for asynchronous online courses. Columns: Week, Dates, Topic, Preparation/Reading, Assignment Due, Notes.
3. **Add the college’s no-class dates** copies the holidays and breaks for the syllabus's term from the college academic calendar (see below) into the no-class dates list, without duplicates. **Use course dates and meeting days** copies the begin/end dates and meeting days from *Credits, modality, and dates* (and picks the weekly layout for online courses). Calendar dates left blank also fall back to the course dates. Class times come from the course meeting information.
4. **Meetings per week** and **Meeting days** — choose exactly as many days as meetings (2 meetings → 2 days). A mismatch is shown immediately and the calendar is not generated until it is fixed.
5. Options: **The first week has a different schedule** (choose first-week days), **Include final exam week** (the last week is marked "Finals"; turn off to leave it out), and **Show no-class dates in the calendar** (holidays appear as "No Class" rows instead of being left out).
6. **No-class dates** — add each holiday or closure with a reason. In the weekly layout they are listed in that week's notes.
7. **Generate calendar** creates one row for every scheduled meeting (or week) between the dates. Weeks run Monday–Sunday; week 1 is the week the course starts. No table cells are merged.

**Editing rows.** Each row opens to show Topic, Preparation/Reading, Assignment due, Notes, and **No class**. Marking a row No class renumbers the meetings. Buttons on each row:
- **Move topic earlier / later** — swaps the row's topic, reading, due item, and notes with the neighboring row; dates stay put.
- **Shift topics later from here** — for an unplanned closure: this row is emptied and every later topic moves to the next class row (skipping No class rows). If the last row had a topic, it moves to a new unscheduled row at the end.
- **Remove row** — asks first if the row has content.

**Add an unscheduled row** adds a row at the end with an optional date (for example a make-up session or a topic still to be scheduled).

**Generating again keeps your work.** Topics, readings, due items, and notes stay with their dates. If a date became a no-class date, its content is kept and you are told so. If you change meeting days and some content no longer falls on a class day, it is kept as unscheduled rows at the end so nothing is lost. Unscheduled rows are always kept.

**Export calendar (.csv)** saves the calendar as a spreadsheet file (opens in Excel or Google Sheets) to a folder you choose, named like `CPTR-1118-Spring-2027-Calendar.csv`.

In the PDF, the calendar table's column headings repeat at the top of each page, and rows are not split across pages.

## College academic calendar (for Records & Registration)

`content/academic-calendar.json` holds the official dates every syllabus needs, so instructors do not have to look them up or type them:

```json
{
  "status": "official",
  "lastReviewed": "2026-12-01",
  "terms": [
    {
      "term": "Spring",
      "year": "2027",
      "verified": true,
      "startDate": "2027-01-11",
      "endDate": "2027-05-14",
      "finalsStart": "2027-05-10",
      "finalsEnd": "2027-05-14",
      "lastDayToDrop": "2027-01-15",
      "lastDayToWithdraw": "2027-04-02",
      "noClassDates": [
        { "date": "2027-01-18", "label": "Martin Luther King Jr. Day" }
      ]
    }
  ]
}
```

- Dates are written `yyyy-mm-dd`. `term` is `Fall`, `Spring`, or `Summer`, matching the editor's term list.
- `lastDayToDrop` and `lastDayToWithdraw` are for full-semester courses. Instructors of shorter courses are told to use the dates shown in eServices.
- Add next year's terms before instructors start building those syllabi; older terms can stay.
- Until `status` is `"official"` and a term's `verified` is `true`, the builder labels that term's dates **Sample dates** wherever they appear.
- Entries with missing or badly formatted dates are skipped and listed in the builder's College content status, so one typo does not break the rest.

**Current state:** the file contains **sample dates** for Fall 2026 and Spring 2027 so the feature can be tried. They are *not* the official SCTCC calendar and must be replaced from the published academic calendar (sctcc.edu/academic-calendar) before instructors rely on them.

**In the editor**, once the instructor picks the term and year:
- *Credits, modality, and dates* shows the college dates for that term, with **Fill in these dates** (begin, end, last day to drop, last day to withdraw; asks before replacing dates already entered).
- It warns if the course begins before the semester starts or ends before final exam week ("must include final exam week").
- *Course calendar* has **Add the college’s no-class dates**.

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

The builder replaces it with the instructor's value (here, the last day to withdraw). A token can also have a default that is used when the instructor leaves the field blank:

```html
<span data-field="policies.acceptedFileFormats" data-default="Microsoft Word or PDF">Microsoft Word or PDF</span>
```

Do not delete these.

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
| `overrideField` | Optional. A data field (for example `policies.classEnvironment`) whose text, if the instructor fills it in, replaces this section's college text. Use only for sample text instructors may rewrite. |
| `appendInstructorBlock` | Optional. An instructor-written block shown right after this section. Currently `vendors` (the course tools list). |

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
- **Accessibility & data privacy:** if you use technology not listed under the Resources tab in D2L, add its accessibility statement. If none exists, link the vendor's VPAT; if neither exists, say so. Consider plagiarism tools, presentation software, web conferencing, polling, recording tools, media players, document sharing, social media, mobile apps, and publisher platforms. Link the data privacy policy for any tool that may collect student data, or state that none was found. Closed social media groups are encouraged; otherwise state a pseudonym policy. For group texting, use a setting that hides phone numbers and say so. *(Enter these under **Tools and vendors** in the editor. Social media and group-texting statements can go in the tool's "Alternative access method" or "Purpose" field, or in your Class Environment text.)*
- **Technical support:** include support links for any outside vendors used in the course (the **Technical support web address** field for each tool).

## Testing checklist

Phase 4 (tested on 2026-11-25; generator logic in Node, editor in headless Chrome):

- [x] College academic calendar: status panel shows available terms and the sample label; choosing Spring 2027 shows its dates with the "Sample dates" flag; Fill in these dates fills begin/end/drop/withdraw and the withdrawal date in the policy text; warnings for starting before the semester and ending before finals week; a term not in the file says so
- [x] Add the college’s no-class dates: adds 6 dates, a second click adds none; generating then gives 36 rows with 33 class meetings
- [x] Bad entries in academic-calendar.json are listed and skipped while good terms still work; a missing file is reported without breaking the builder

- [x] 1, 2, 3, and 4 meetings per week over a 17-week semester plus finals week: 18, 36, 54, and 72 rows, every row on a chosen weekday
- [x] Meetings-per-week and meeting-day mismatch → message as you change settings; Generate stopped with the message focused
- [x] Holidays: "No Class" rows with the reason and no meeting number (36 rows, 33 meetings with 3 closures); left out when that option is off
- [x] Finals week marked "(Finals)"; left out when "Include final exam week" is off
- [x] First-week special schedule (Wednesday only in week 1)
- [x] Generating again keeps topics by date; a topic on a new holiday is kept with a warning; content that no longer falls on a class day is kept as unscheduled rows; unscheduled rows kept
- [x] Weekly layout: 18 week rows with date ranges, closures listed in notes, first row starts on a mid-week start date
- [x] End date before start date and spans over 30 weeks are refused; older files with plain-text no-class dates are converted
- [x] Editor: typing updates the row label and preview; No class renumbers meetings; Shift topics later; Move topic later (focus follows); add/remove unscheduled row; Use course dates and meeting days
- [x] CSV export: file name follows the course; quotes and commas escaped; opens with a byte-order mark for Excel
- [x] PDF: calendar spanning two pages repeats its column headings
- [x] Phase 2 and Phase 3 checks still pass; no console errors

Phase 3:

- [x] New syllabus starts with the A–F scale and no categories ("Add at least one assessment category")
- [x] Add a category → focus moves to its name; row totals (10 × 20 = 200) and course total update as you type; legend shows the name
- [x] Scale point ranges follow the course total (300 points → A 270–300 … F 0–179)
- [x] Move down → order changes in editor and preview; focus stays on the moved category's button
- [x] Switching to weights shows weight fields and hides points fields (values kept)
- [x] Weights totaling 90% → "10% short of 100%"; entered values unchanged; Print to PDF stopped with the problem list focused
- [x] Override checkbox turns the error into a reminder and lets printing continue; exactly 100% shows no message
- [x] Overlap → must-fix error; gap → warning; plus/minus sample → 12 grades with no errors; removing F → "lowest grade starts at 60%" warning
- [x] Remove category/grade → focus returns to the Add button
- [x] Sample course loads its 5 categories (600 points) into the editor; no console errors
- [x] Phase 2 save/open checks still pass

Phase 2:

- [x] Nothing is written to browser storage at any point; copies left by earlier preview builds are erased on open (other sites' data untouched)
- [x] Save opens the Save dialog with the course-based file name; Ctrl+S then updates the same file without asking again; Save as asks every time
- [x] Open reads a saved file and shows "all changes saved"; status line switches to "unsaved changes" when you type
- [x] New syllabus / Open / Load sample ask before discarding unsaved work; Cancel keeps the work
- [x] Leaving the page with unsaved changes triggers the browser's warning (handler verified directly)
- [x] Firefox/Safari fallback: Save downloads the file; Open uses the file chooser
- [x] Typing in the editor updates the preview (title, dates, college-content tokens)
- [x] Class Environment override replaces the college sample; accepted file formats override and blank default
- [x] Add a tool → focus moves to its name field; legend updates; tool without accessibility statement/VPAT listed in the required sentence; remove → focus returns to "Add a tool"
- [x] Photo upload shows in the preview
- [x] Malformed JSON and newer-version files are refused with a clear message; an older file with wrong types opens with a list of skipped items; text numbers are converted
- [x] Browser Print command (not only the button) switches to student view and suggested file name, then restores the editor
- [x] 320 px wide: no horizontal page scrolling; no console errors throughout

Phase 1:

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
- [x] PDF: table headers repeating across pages (verified in Phase 4 with a two-page calendar)

Still to test by a person: keyboard-only use, a screen reader (NVDA or JAWS), 200% zoom, and the PDF in Adobe Acrobat's accessibility checker and D2L.

## Known limitations

- `content/academic-calendar.json` contains sample dates until Records & Registration enters the official calendar.
- Only grading problems stop Print to PDF so far; Phase 5 adds the full pre-print check (required fields, dates, placeholders).
- There is no autosave, by design. Save regularly (Ctrl+S); the status line shows when changes are unsaved.
- Firefox and Safari save by download rather than to a chosen folder.
- The logo is a placeholder.
- Arimo font files are not bundled yet (Arial is used).
- The page footer in the PDF requires Chrome or Edge version 131 or later.
- No pre-print validation yet; an incomplete syllabus can still be printed (missing values are clearly marked).

## Roadmap

| Phase | Scope |
|---|---|
| 1 (done) | Content files, manifest, loader, sanitizer, rendered preview, print styles, basic Print to PDF |
| 2 (done) | Instructor editing panel, Save / Save as / Open to the instructor's own files or OneDrive (no browser storage), vendor table, photo upload, instructor overrides (Class Environment, accepted file formats) |
| 3 (done) | Grading editor: points and percentage methods, category rows with move/remove, live totals, weight check with instructor override, scale editor with overlap/gap/range checks and point ranges, plus/minus sample, print stopped on grading errors |
| **4 (this version)** | Course calendar generator: 1–4 meetings per week or one row per week, no-class dates, finals week, first-week schedule, regeneration that keeps entered text, move/shift topics, unscheduled rows, CSV export; college academic calendar file for official dates and no-class dates |
| 5 | Validation before printing, guided Print to PDF, GitHub Action to check content files (HTML, links, link text, placeholders) |
