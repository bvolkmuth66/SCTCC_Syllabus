# SCTCC Syllabus Builder

An accessible HTML syllabus builder for St. Cloud Technical & Community College (SCTCC).

Instructors open the builder in a web browser, enter their course information, and use **Save as PDF** to create the syllabus they post in their D2L course shell. Students only ever see the PDF.

College-wide content (policies, support information, the footer) is **not** typed by instructors. Each piece lives in its own file in the `content/` folder, maintained by the office that owns it. Every syllabus picks up the current approved wording the next time an instructor makes a PDF.

> **Status: Phase 6 (trial).** Instructors can import last term's Word syllabus or start from scratch, build the grading table, grading scale, and course calendar, check the syllabus, save it to their own computer or OneDrive, and print it to PDF. College content changes are checked automatically on GitHub.

---

## Contents

- [How it works](#how-it-works)
- [Instructor workflow](#instructor-workflow)
- [Importing a previous syllabus](#importing-a-previous-syllabus)
- [Saving and opening your syllabus](#saving-and-opening-your-syllabus)
- [Grading editor](#grading-editor)
- [Course calendar generator](#course-calendar-generator)
- [Repository structure](#repository-structure)
- [Running the builder](#running-the-builder)
- [Beta test feedback](#beta-test-feedback)
- [Instructor FAQs](#instructor-faqs)
- [Editing college content (for content owners)](#editing-college-content-for-content-owners)
- [The content manifest](#the-content-manifest)
- [College academic calendar (for Records & Registration)](#college-academic-calendar-for-records--registration)
- [Checks before printing](#checks-before-printing)
- [Printing to PDF](#printing-to-pdf)
- [Automatic content check on GitHub](#automatic-content-check-on-github)
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

**Section numbers.** Major sections are numbered 1, 2, 3 … and their subsections 1.1, 1.2 … in the preview, the PDF, and the Contents list, so a section can be referred to by number. Numbers follow the sections that are turned on, so they never skip. Set `numberSections: false` in `js/syllabus-config.js` to turn numbering off.

**A finished syllabus is the instructor's intellectual property.** The builder never stores it: not in the browser, not in this repository, and not on any server. GitHub Pages only delivers the builder's own files; nothing an instructor types is sent back. Instructors save their syllabus as a file in a folder they choose (their computer or OneDrive) and post the PDF in D2L.

## Repository structure

```
SCTCC_Syllabus/
├── index.html                      The builder page
├── calendar.html                   The course calendar workspace (opened from the builder)
├── faq.html                        The searchable FAQs window (opened from the builder)
├── css/
│   ├── faq.css                     FAQs window styles
│   ├── syllabus.css                Screen styles (brand colors, layout)
│   └── print.css                   PDF / print styles (US Letter)
├── js/
│   ├── syllabus-config.js          Settings only (content location, logo, preview timing)
│   ├── dom-helpers.js              Small shared helpers for building page elements
│   ├── syllabus-data.js            Data model, import validation, date/time helpers
│   ├── grading.js                  Grading totals, weight check, scale check, point ranges
│   ├── calendar-builder.js         Calendar generation, regeneration, shifting topics, CSV
│   ├── syllabus-validation.js      Checks before printing (errors, warnings, notices)
│   ├── print-check.js              Guided Save as PDF dialog and the findings list
│   ├── syllabus-files.js           Save / Save as / Open with the computer's file dialogs
│   ├── content-loader.js           Loads, checks, and sanitizes college content
│   ├── syllabus-editor.js          The instructor editing panel
│   ├── docx-reader.js              Reads a Word (.docx) file in the browser (no uploads)
│   ├── pdf-reader.js               Reads a PDF in the browser with PDF.js (no uploads)
│   ├── syllabus-import.js          Finds the instructor's information in an old syllabus
│   ├── start-screen.js             "How would you like to start?" and the import review
│   ├── calendar-bridge.js          Builder side of the calendar workspace: snapshots and changes
│   ├── calendar-workspace.js       The calendar workspace: month and list views, details, reuse
│   ├── faq.js                      The FAQs window: reads content/faq.html, search, highlighting
│   ├── faq-link.js                 Opens the FAQs in their own window from any FAQs link
│   └── syllabus.js                 Builds the syllabus, unsaved-changes tracking, Save as PDF
├── content/
│   ├── content-manifest.json       List of college sections and where they go
│   ├── academic-calendar.json      College semester dates, finals, deadlines, no-class dates
│   ├── grading-scale.json          College default grading scale (Academic Affairs)
│   ├── faq.html                    The instructor FAQs (questions and answers)
│   └── *.html                      One file per college section (22 files; ai-policy.html is pending)
├── assets/
│   ├── sctcc-logo-interim.jpg      Interim logo from the Word syllabus template (until Marketing's file)
│   ├── sctcc-logo-placeholder.svg  The earlier placeholder (kept for reference)
│   └── favicon.svg                 Generic browser-tab icon (not the college logo)
├── vendor/
│   └── pdfjs/                      Mozilla PDF.js 6.2.108 (Apache-2.0), used only for PDF import
├── examples/
│   └── sample-course-data.js       Invented sample course ("Load sample course" button)
├── scripts/
│   ├── check-content.mjs           Checks the content files (run by GitHub on every change)
│   ├── check-accessibility.mjs     axe-core page check and sample PDF (run by GitHub)
│   └── check-pdf.py                Checks the sample PDF's tags, language, title, headings
├── docs/
│   └── accessibility-checklist.md  WCAG 2.2 A/AA criteria, how each is met and tested
├── ACCESSIBILITY.md                Standards, owner (by title), review schedule
├── .github/
│   ├── CODEOWNERS                  Who reviews changes to each file
│   └── workflows/                  Content check, accessibility check, yearly review reminder
├── .nojekyll                       Serve files as-is on GitHub Pages
└── README.md
```

**Differences from the original project plan** (all intentional):

| Plan | This repository | Why |
|---|---|---|
| `college-policies.html` | `academic-integrity.html` (+ optional `academic-integrity-examples.html`) | Each office edits only its own file; "College Policies & Procedures" is the page heading that groups several files. |
| 10 content files | 20 content files | Mission statement, change notice, academic calendar links, required technology, technical-skills link, first-week drop/FW paragraph, student email, and footer are also college text, so they are maintained the same way instead of being typed into code. |
| Config inside `syllabus-data.js` | Separate `js/syllabus-config.js` | Keeps settings apart from code. |
| Editor inside `syllabus.js` | Separate `js/syllabus-editor.js`, `js/syllabus-files.js`, `js/dom-helpers.js` | Smaller files with one job each. |
| `localStorage` autosave allowed | No browser storage at all | Finished syllabi are faculty intellectual property, and copies left in a browser could be seen by the next person on a shared computer. Syllabi are saved only to files the instructor controls. |
| `assets/sctcc-logo.svg` | `assets/sctcc-logo-interim.jpg` | Marketing's file has not been supplied yet; the logo from the Word syllabus template is used until then. |
| No outside libraries | Mozilla PDF.js in `vendor/pdfjs/` | Approved 2026-11-26 for PDF import. Kept in the repository (not loaded from another site), loaded only when a PDF is chosen, and run with eval and font loading turned off. |
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

When the builder opens, it asks **How would you like to start?**

| Choice | For | What happens |
|---|---|---|
| **Import a previous syllabus (Word or PDF)** | Instructors using the builder for the first time | Their old .docx syllabus is read in the browser. They review everything found, keep or skip each item, and start with most of the syllabus filled in. See below. |
| **Open a syllabus saved from this builder** | Everyone after their first term | Their saved .json file opens exactly as saved. They update the term and dates, generate the calendar, and print. |
| **Start from scratch** | New courses | A blank syllabus with hints in every section. |
| *See an example* | Anyone curious | Opens the sample course. |

**Start over…** in *Save and open your syllabus* (and **Import a previous syllabus…**) bring these choices back at any time. **Save syllabus** and **Open a saved syllabus** are also in the green toolbar.

Then:

1. Work through the groups in the **Edit syllabus** panel. They are in the same order as the syllabus, and each shows the number of the syllabus section(s) it fills in (for example **2.4 Materials and technology**), matching the numbers in the preview and the PDF. The numbers update when optional sections are turned on or off. The preview updates as you type. Anything still needed is marked in the preview, for example **[Withdrawal date needed]**.
   - **Course** and **Description and outcomes**: copy from the official SCTCC Course Outline. **Year** is a list of this year and the next two, worked out from the computer’s date, so it moves forward every January 1 (a year already in an opened syllabus stays in the list). **Last revised** has a **Use today’s date** button, and prints in the PDF footer after the version (for example "Version 1.1 · Revised 11/26/2026"). Outcomes appear under a **Student Learning Outcomes** heading as a bulleted list (the July 2026 template numbers them; changed 2026-11-26 at the project lead's request).
   - **Credits, modality, dates, and requisites**: choose the term, then **Fill in these dates**. Pre/Co-Requisites (from the Course Outline) are entered here and appear as part of **2.1 General Information**.
   - **First week attendance** (2.3): the college's first-week attendance note is always included; online courses can add a **Course log-in** requirement, shown after it.
   - **Course policies**: your attendance and late-work wording; accepted file formats; optional college statements; your own Class Environment text; and **Additional course sections** such as Exams or Lab Safety.
   - **Course policies** has a box for **your course's AI rules**, shown in **3.5 Artificial Intelligence (AI) Policy** after the college AI statement (being written; until it is added, the section shows only the instructor's rules and is left out if there are none).
   - **Course policies** also has an optional **Program Diversity Statement**, shown right after the **SCTCC Diversity Statement**. The two headings say which statement is the college's and which is the program's.
   - **Tools and vendors**: each outside tool's accessibility statement (**required**; if the vendor has none, check "This tool has no accessibility statement" and link its VPAT), privacy policy, and support link.
   - **Grading** and **Course calendar**: see the sections below.
   - Web addresses typed into any text box become working links in the syllabus.
2. **Save syllabus** (Ctrl+S / ⌘S) to a folder on your computer or your OneDrive folder.
3. **Check my syllabus**, then **Save as PDF** and upload the PDF to D2L.

The editor never changes college content. To use different college wording, the content owner updates the file in `content/`.

## Importing a previous syllabus

**Import a previous syllabus (Word or PDF)** reads last term's `.docx` or `.pdf` file **in the browser**. The file is never uploaded; like Save and Open, nothing leaves the computer.

**Two template layouts are recognized:**
- The current template, where each part of the syllabus has its own heading.
- The older **table-form** template, where the whole syllabus is one large table: single-cell rows such as "Course Information" or "Instructor Information" are section headings, and two-cell rows are "label | value" (Course Prefix & Number, Credits, Office Location, Grading Formula, and so on). Tables nested inside a cell, such as an Assignments and Points table, are read too. Rows labeled "(SAMPLE)" are offered but left unchecked.

Text still holding a template placeholder such as "COURSE NAME" or "XXX" is flagged in the review screen and again by **Check before printing**.

**What it looks for** (best results with syllabi built on one of the SCTCC templates):
- Course prefix, number, and title (from the title heading)
- Instructor name and credentials, email, telephone, office location, office hours, best way to contact, contact expectations, bio, educational philosophy, and photo (pictures in the file are shown so the instructor can pick theirs)
- Credits, modality, meeting days, class times, room, extra modality information, course log-in text
- Course description, outcomes, prerequisites, corequisites, MnTC goal
- Required and recommended materials, extra required technology, suggested technical skills
- AI policy (a heading such as "AI Policy" or "Artificial Intelligence") as the instructor's own AI rules
- Attendance and late policies, accepted D2L file formats, whether Turnitin / academic dishonesty examples / Class Environment were included, the instructor's own Class Environment wording
- **Instructor-written sections the template doesn't have** (for example Exams or Student Responsibilities), as Additional course sections
- Tools from the Technical Support list (for example a publisher's support desk)
- Grading introduction, categories (from a Word table or tab-separated lines, including "Labs (10 @ 20 points each)"), grading scale (including "F = below 60" or "59 and below"), where grades are posted, turnaround, other grading text, time commitment
- The calendar statement and, if the old syllabus had a calendar table, its topics, readings, and due items

**What it leaves out on purpose:**
- **All college policy text.** Sections such as Academic Integrity, Accommodations, Title IX, Navigating D2L, Pulse, Technical Support, Student Services, and Accessibility & Data Privacy always come from the repository. Paragraphs of college wording inside instructor sections (for example the first-week drop and administrative withdrawal text inside Attendance) are recognized by comparing them with the current college content and are dropped.
- **The term, year, and all dates.** The instructor chooses the new term and uses **Fill in these dates**. Old calendar dates are dropped; when the new calendar is generated, imported topics are placed in order into the class meetings.
- Mission statement, change notice, footer, and template instructions.
- A section that was under College Policies but is not a current college section is offered **unticked**, with a note to include it only if it is the instructor's own statement.
- The old **Statement of Diversity** is recognized as college text (the SCTCC Diversity Statement is always included). A section titled **Program Diversity Statement** is imported into that optional section; other wording found under an old diversity heading is offered unticked as a program statement.

**The review screen** lists every item found, grouped like the editor, with the text it found. Everything is ticked except items that need a decision. **Import selected** fills a new, unsaved syllabus and lists the next steps; **Cancel** (or Escape) changes nothing.

**PDF files** are read with Mozilla PDF.js (in `vendor/pdfjs/`, loaded only when a PDF is chosen). A PDF has no real headings, lists, or tables, only positioned text, so `js/pdf-reader.js` rebuilds them:
- headings from larger or bold text and from short lines that name a known section (all-capital lines such as "EXAMS" become "Exams");
- paragraphs by joining wrapped lines (a line that stops well short of the margin ends a paragraph);
- bullets from bullet characters;
- tables from text that lines up in columns, including the table-form template's label | value rows;
- running headers, footers, and page numbers are dropped.

Pictures are not taken from a PDF; the instructor uploads a photo in the editor. A **scanned** PDF (a picture of the pages) has no text to read, and the builder says so. A password-protected or damaged PDF gives a plain message. The review screen notes that the file came from a PDF so the instructor checks each item. Word files remain the better choice when available. Older `.doc` files need Word's Save As `.docx` first.

## Saving and opening your syllabus

**Your syllabus is your intellectual property.** The builder never keeps a copy. It does not use browser storage, cookies, GitHub, or any server. When you close the page, the only copies are the files you saved.

- **Save syllabus** — In Chrome or Edge, the first save opens your computer's Save dialog. Choose any folder, including your **OneDrive** folder (OneDrive appears in File Explorer or Finder when the OneDrive app is installed). The file is named after your course, for example `CPTR-1118-Spring-2027-Syllabus.json`. After that, **Save syllabus** or **Ctrl+S / ⌘S** updates the same file without asking again.
- **Save as…** — Always asks where to save. Use it to start next term's syllabus from this one.
- **Open a saved syllabus** — Opens a syllabus file you saved. The file is checked first: anything unexpected is skipped and listed, files from a newer version of the builder are refused, and you are told if college content has changed since the file was saved, so you know to review it and make a new PDF.
- **Other browsers** (Firefox, Safari) cannot save directly to a chosen folder. There, **Save syllabus** downloads the file to your Downloads folder; move it to your own folder or OneDrive. **Open a saved syllabus** uses the standard file chooser.
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
- **Points with set weights** — each category has a number of assignments, points each, **and a weight you set**, for example Labs 200 points = 40% even though Labs are half the points. The syllabus table shows Number, Points each, Total points, and Weight. Weights must total 100%, with the same rules as below. The grading scale shows percentages only, because points do not convert directly to the final grade.
- **Percentage weights only** — each category has a weight. The current total is shown as you type, for example "Total weight: 90% — 10% short of 100%." The builder **never changes your percentages**. If the total is not 100%, Save as PDF is stopped until you fix it or tick **Publish with weights that do not total 100%** (for example, for extra credit — explain it under "Additional grading information"). The number of assessments is optional; the column appears only if you fill it in.

**Assessment categories** — **Add a category**, then fill in its name and numbers. Each category has **Move up**, **Move down**, and **Remove** buttons. Fields that do not apply to the chosen method are hidden but kept, so switching methods loses nothing.

**Grading scale** — choose one:
- **Use the college grading scale** (the default): A 90–100, B 80–89, C 70–79, D 60–69, F 0–59, kept in `content/grading-scale.json` and owned by Academic Affairs. The editor shows it read-only, and the syllabus always shows the current version: when the college updates the file, every syllabus using it updates too.
- **Enter my own grading scale**: the editor rows appear, starting from the college scale. Each range includes both ends (A = 90–100%, B = 80–89%). Change labels and percentages, **Add a grade**, or remove one. **Use plus/minus sample** fills in A through F with plus and minus grades; those cutoffs are only a starting point to confirm for your program. **Start from the college scale** copies the college scale back in.

Switching to the college scale and back during editing restores your own scale. Syllabus files saved before this choice existed open with "my own" scale if theirs differed from the college default, so nothing changes for them. When importing an old syllabus, a scale identical to the college scale is set to the college scale; a different one is kept as the instructor's own. In the points method, the matching point range for each grade is calculated from the course total: minimum points = course total × minimum % (rounded up); maximum = one less than the next grade's minimum (the top grade's maximum is the course total).

The scale is checked as you type:

| Problem | Effect |
|---|---|
| Two grades overlap (for example B goes up to 90% and A starts at 90%) | Must fix before printing |
| A grade's minimum is above its maximum, a percentage is below 0%, or a minimum is above 100% | Must fix before printing |
| A grade has no label, or the same label is used twice | Must fix before printing |
| A gap between grades (for example B stops at 85% and A starts at 90%) | Warning |
| The top grade stops below 100%, or the bottom grade starts above 0% | Warning |
| A maximum above 100% | Warning (fine for extra credit) |

Problems are listed under the categories and the scale in the editor, and in the instructor preview under the grading tables (never in the PDF). **Save as PDF** is stopped while any "must fix" problem remains, and the list of problems appears at the top of the editor. The browser's own Print command cannot be stopped, so watch for those messages.

## Course calendar generator

Open **Course calendar** in the editor. At the top, **Choose a calendar tool**:

- **Open the calendar workspace** — a larger workspace in its own window, so it can sit on a second screen. If the browser blocks new windows, it opens full screen inside the builder instead (**Open it full screen here** does that on purpose).
- Or use the settings and rows below in the editor. Both change the same calendar, and each shows the other's changes as you type.

### The calendar workspace

- **Header:** the course, term, and dates, and whether the workspace is linked to the builder. **Back to the builder** closes it.
- **Settings** (left): layout (by class meeting or by week), meeting days (these are the course meeting days from *Credits, modality, dates, and requisites*; changing them in either place changes both), final exam week, showing no-class dates, the college's no-class dates and your own closures, and **Generate calendar**. The dates always come from the course dates. First-week schedules stay in the editor.
- **Month view** (middle): a real month calendar for the term. Class meetings show their meeting number, topic, and anything due; no-class dates, final exam week, and days outside the course are marked. Use the arrows to move between months. **List view** shows every row in a table.
- **Class details** (right): choose a class to edit its topic, preparation/reading, due item, and notes, mark it as no class, **Move topic earlier/later**, or **Shift topics later from here** (for a snow day). **Add an unscheduled topic** adds one without a date.
- **Unscheduled topics** are listed under the month, so nothing that lost its date is hidden.
- **Shift dates…** moves every calendar date by the same number of days, the way D2L offsets dates when a course is copied. It is also in the editor as **Shift dates for a new term…**, and opening a saved syllabus whose calendar is from an earlier term points to it.
  - Choose **By the difference between two dates** (for example the first day of class last year and the first day of class this year; the builder fills both in when it can) or **By a number of days** (negative moves dates earlier). It shows the result in days and weeks, for example "364 days (52 weeks)", and warns when classes would land on different weekdays.
  - Options: **Also move the course begin, end, drop, and withdrawal dates** (off when they were already updated with Fill in these dates) and **Replace the old no-class dates with the college’s dates** for the new term (on by default).
  - A preview lists every old and new date and flags classes that would land on a no-class date or outside the course, and rows with dates typed in their text (for example "due 9/14"), which are not changed.
  - Last term’s no-class rows are dropped unless a topic, reading, or due item was put on them. After shifting, **Generate calendar again** turns any class that now falls on a holiday into a no-class row and keeps its topic as an unscheduled topic.
  - **Class time and room for the new term** are shown in the same window, with last term's values for comparison ("From the saved syllabus: 10:00 a.m.–10:50 a.m., room 2-425"). They are stored once for the course, so a change here (for example to 3:00 p.m.) is saved to the syllabus right away and shows everywhere; the calendar itself holds only dates.
- **Reuse last term’s schedule…** opens a syllabus file saved from this builder (read on this computer, never uploaded) and lays its topics, readings, due items, and notes onto this term's class meetings:
  - **In meeting order** (1st class → 1st class), with **Keep final exam week topics in final exam week** on by default; or **By week and weekday** (week 3's 2nd class → week 3's 2nd class).
  - A preview shows each old date, topic, and new date, which meetings are left open, which topics become unscheduled (when this term has fewer classes), and which meetings already have topics that would be replaced. Nothing changes until you choose **Place**.
  - If this term's calendar has not been generated yet, the dialog offers to generate it first.

The workspace keeps no copy of the syllabus: every change goes to the builder, which applies it with the same functions as the editor, so Save, the preview, and the PDF always match. Leaving or closing the builder closes the workspace window. Opening `calendar.html` by itself only shows how to open it from the builder.

### Generator settings (in the editor)

1. **Statement about the course schedule** — optional text shown above the calendar (or by itself if you do not build one), for example where the live schedule is posted in D2L.
2. **Calendar layout**
   - **One row per class meeting** — for courses that meet 1, 2, 3, or 4 times a week. Columns: Week, Meeting, Date, Day, Topic, Preparation/Reading, Assignment Due, Notes.
   - **One row per week** — for asynchronous online courses. Columns: Week, Dates, Topic, Preparation/Reading, Assignment Due, Notes.
3. **Add the college’s no-class dates** copies the holidays and breaks for the syllabus's term from the college academic calendar (see below) into the no-class dates list, without duplicates. **The calendar always runs from the course begin date to the course end date, on the course meeting days,** entered under *Credits, modality, dates, and requisites*; the calendar settings show them, and there are no separate calendar dates or days to keep in step. Choosing the meeting days there is all the calendar needs (1 to 4 days a week; with 5 or more, choose one row per week). Older saved syllabi that had only calendar meeting days have them copied to the course. Class times come from the course meeting information. If you change the course dates, generate the calendar again.
4. **Meeting days** come from *Credits, modality, dates, and requisites* (the calendar shows them). The number of meetings per week is the number of days chosen, 1 to 4; with none or more than 4 the calendar explains what to change and is not generated until it is fixed.
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
- Until `status` is `"official"` and a term's `verified` is `true`, the builder labels that term's dates as sample or not yet confirmed.
- Entries with missing or badly formatted dates are skipped and listed in the builder's College content status, so one typo does not break the rest.

**Current state:** the file holds Fall 2026, Spring 2027, and Summer 2027, copied on 2026-11-25 from the published [2026/2027 Academic Calendar](https://sctcc.edu/student-stuff/academic/academic-calendar/20262027-academic-calendar) (`"status": "published"`). Records & Registration should confirm each term, set `"verified": true`, and change `status` to `"official"`. The published calendar does not list add/drop/withdrawal deadlines (they vary by course and are shown in eServices), so those fields are blank and instructors are pointed to eServices. Summer 2027 has no final exam week listed.

`status` can be `"sample"` (placeholder dates, labeled **Sample dates**), `"published"` (copied from the published calendar, labeled *not yet confirmed*), or `"official"` (confirmed).

**In the editor**, once the instructor picks the term and year:
- *Credits, modality, dates, and requisites* shows the college dates for that term, with **Fill in these dates** (begin, end, last day to drop, last day to withdraw; asks before replacing dates already entered).
- It warns if the course begins before the semester starts or ends before final exam week ("must include final exam week").
- *Course calendar* has **Add the college’s no-class dates**.

## Beta test feedback

During the beta test, **Report a problem or idea** in the toolbar opens the Microsoft Form for feedback (SCTCC sign-in) in a new tab. Its address is `feedbackFormUrl` in `js/syllabus-config.js`; set it to `""` after the beta test and the button disappears. The end-of-round survey is sent to testers by email, not linked from the builder.

## Instructor FAQs

Instructor directions live **in the builder**, not in this README: the hints beside each field, and the **FAQs**. This README is for the people who maintain the repository.

- **FAQs** in the green toolbar, **Search the FAQs** at the top of the editor, and **Calendar FAQs** in the calendar workspace open `faq.html` in its own window, so it can sit beside the builder. If the browser blocks the window, it opens in a new tab. Opening it never leaves the builder, so unsaved work is safe.
- **Search** matches every word typed, in the question, the answer, or the topic, ignoring accents and capitals. Matches are highlighted, and matching answers open when there are eight or fewer. Escape or **Clear** shows every question again. **Topics** jump to a group.
- **Links to one question:** `faq.html#save-onedrive` opens that question; `faq.html#topic-calendar` opens a topic; `faq.html?q=weights` starts a search. Each answer has **Link to this question**.
- **Editing the questions:** everything is in `content/faq.html`. Each topic is a `<section data-topic="...">` with one `<h2>`; each question is a `<div class="faq" id="...">` with one `<h3>` (the question) and the answer. Answers allow the same tags as college content and are sanitized the same way. Keep ids unique and don't change an id that other pages may link to. Update `LAST-REVIEWED` and `VERSION` in the header comment; both are shown at the bottom of the FAQs.
- Contacts named in the FAQs: builder questions, Brian Volkmuth; college policy wording, Magen Henry. When a builder feature changes, update the matching FAQ in the same pull request.

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

**A section whose college text is not written yet** is marked `"pending": true` in `content-manifest.json`. Its file is not loaded and it is not an error; the content check lists it as a warning. Today that is **3.5 Artificial Intelligence (AI) Policy** (`ai-policy.html`): until the college statement is added, the section shows only the instructor's own AI rules, and is left out when there are none. To add the statement, put it in `ai-policy.html` and remove `"pending": true` (the steps are in the file's comment). Instructors' rules then follow the college statement under the same heading (manifest `"instructorAddition": "aiPolicy"`).

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

## Checks before printing

**Save as PDF** checks the syllabus first. The same checks run whenever the instructor clicks **Check my syllabus** at the top of the editor. Results come in three levels, each with a **Go to field** button that opens the editor at the right place (even from Student preview):

| Level | Effect | Examples |
|---|---|---|
| **Problems to fix before printing** | Save as PDF is stopped | Anything the syllabus still shows as "[… needed]" (course prefix, number, title, term, year, instructor name and email, office and hours, credits, modality, meeting days/times/room, begin/end/drop/withdraw dates, description, outcomes, prerequisites, attendance and late policies, required materials, grading categories and scale, where grades are posted, turnaround, calendar or schedule statement, and any optional section that is turned on but empty); an incomplete email address; end date not after begin date; drop date before the course begins; withdraw date not after the drop date or after the course ends; template placeholders left in your text (XXX, YOUR NAME, COURSE NAME, GIVE WITHDRAWAL DATE, LIST ASSIGNMENT, DATE & TIME…); grading errors (weights not 100% without the override, overlapping grades, bad percentages, missing or duplicate grade labels); a tool with no accessibility statement link and "This tool has no accessibility statement" not checked; a required college section that failed to load |
| **Please review** | Printing allowed | Course starts before the semester or ends before final exam week; calendar rows outside the course dates; calendar with no topics; gaps in the grading scale; zero-point categories; weights published with the override; "Include my photo" on with no photo; a tool's web address that is not a full https:// address; an optional college section that failed to load |
| **For your information** | Printing allowed | College dates not yet confirmed by Records & Registration; tools with no privacy policy link; unscheduled calendar rows outside the course dates (allowed as exceptions); "here" link text in college content (for content owners); placeholder logo |

The browser's own Print command (Ctrl+P) cannot be stopped, but it still switches to the student view, and the problems stay listed in the editor.

## Printing to PDF

1. Click **Save as PDF** in the builder toolbar. If there are problems to fix, the dialog lists them with **Go to field** buttons. Otherwise it shows anything to review and these steps.
2. Click **Continue to Save as PDF**. The browser opens its own window, which it titles Print. The builder switches to the student view and sets the PDF's title, which is also the suggested file name, for example `CPTR 1118 Cisco II Syllabus, Spring 2027`. A readable title matters because screen readers announce it and PDF viewers show it (WCAG 2.4.2). Characters that file names cannot contain (such as `:` or `/`) are left out. The saved `.json` file and the calendar CSV keep hyphenated names such as `CPTR-1118-Spring-2027-Syllabus.json`.
3. Set **Destination** to **Save as PDF**. **Do not choose "Adobe PDF" or "Microsoft Print to PDF."** Those print drivers turn the text into shapes: the PDF has no tags (headings, lists, reading order), its text cannot be selected or searched, and screen readers read nonsense. A syllabus made that way fails the accessibility requirements.
4. Under **More settings**, turn **Headers and footers off**. The syllabus prints its own footer (college name, course, term, syllabus version, and page numbers). Leave **Background graphics** off to save ink.
5. Save to your own folder or OneDrive, and upload the PDF to D2L.

Print sizes: body text 11 pt, headings 11.5–20 pt, tables 10 pt, the calendar table 9.5 pt, and nothing (footer included) below 9 pt. Long web addresses in instructor text (over 60 characters, such as booking links) are shown as their site and first path part, for example `outlook.office.com/bookwithme/…`, and still link to the full address. Lines in instructor text that start with a bullet (•, -, *) or a number (1.) print as real lists.

Use **Google Chrome or Microsoft Edge**. They create tagged PDFs that screen readers can read, keep links clickable, and support the syllabus's own page footer. Other browsers still produce a usable PDF but may omit the page footer or tagging.

## Automatic content check on GitHub

`scripts/check-content.mjs` checks the `content/` folder, and `.github/workflows/check-content.yml` runs it on every pull request that changes content (and weekly for links). The results appear on the pull request:

- **Errors (the check fails):** a file listed in the manifest is missing; a bad file name or placement; `<script>`, `<style>`, images, forms, or other forbidden tags; `on…` event attributes; `javascript:` links or links that are not https://, mailto:, tel:, or #; template placeholders (XXX, TBD, GIVE DATE…); invalid field tokens; a LAST-REVIEWED that is not a date; academic calendar problems (not real dates, end before start, finals outside the semester, withdraw before drop, duplicate terms).
- **Warnings (listed, do not fail):** missing OWNER / LAST-REVIEWED / VERSION header lines; `http://` links; link text such as "here"; tags the builder drops; unclosed tags; content files not listed in the manifest; no-class dates outside the semester or without a label.
- **Links:** a separate job tries every web link and reports any that fail. It never blocks a change.

Run it yourself from the repository folder: `node scripts/check-content.mjs` (add `--check-links` to test links). Node 18 or later; nothing to install.

**Recommended GitHub settings** (Settings → Branches → Add branch ruleset, or Rules → Rulesets, for `main`):
- Require a pull request before merging, with **Require review from Code Owners** (uses `.github/CODEOWNERS`).
- Require status checks to pass: **Content structure and wording**.

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

**Logo.** Until Marketing's file arrives, the builder uses the logo image from the SCTCC Word syllabus template (`assets/sctcc-logo-interim.jpg`, 262 × 215 pixels, approved as an interim logo on 2026-11-26). It prints about 1.9 inches wide; at that size it is slightly soft. The status panel notes that it is interim. The brand guide allows the logo only from Marketing's files (sctcc.edu/media). To replace it:
1. Get the preferred 3-color logo with "A member of Minnesota State" from Marketing (SVG preferred; otherwise a high-resolution PNG).
2. Add it to `assets/` (for example `assets/sctcc-logo.svg`).
3. In `js/syllabus-config.js`, set `logo.src` to the file and `logo.isInterim` to `false`, then delete `assets/sctcc-logo-interim.jpg`.

**Font.** Arimo is an approved SCTCC font with no license required, and it has the same letter widths as Arial, so the layout does not change if it is missing. To include it, download Arimo from Google Fonts, convert or obtain `.woff2` files, place them in `assets/fonts/`, and remove the comment markers around the `@font-face` rules at the top of `css/syllabus.css`. The builder does not load fonts from Google's servers.

## Accessibility

**Standards, owner, and review schedule:** see [`ACCESSIBILITY.md`](ACCESSIBILITY.md). The legal minimum is WCAG 2.1 Level AA (ADA Title II); the design target is WCAG 2.2 Level AA, for both the builder and the PDF. Each WCAG criterion, how the builder meets it, and how it is tested are in [`docs/accessibility-checklist.md`](docs/accessibility-checklist.md).

**Automatic checks on GitHub** (`.github/workflows/check-accessibility.yml`), on every pull request that changes the page, styles, code, or content:
- `scripts/check-accessibility.mjs` runs axe-core on the start screen, the instructor view with the sample course, the check results, and the student view. Any problem fails the check.
- It then saves the student view as a tagged PDF, and `scripts/check-pdf.py` checks it (tags, language, title, headings, table headers, figure descriptions). The PDF and results are attached to the run as **accessibility-report**.
- A yearly issue (July 1) reminds the owner to review the standards and repeat the manual checks (`.github/workflows/accessibility-review-reminder.yml`).

Automated checks find only part of WCAG problems; the manual review in the checklist is still required.

Run locally (needs Node and Python): `npm install --no-save playwright axe-core && npx playwright install chromium && pip install pikepdf`, then `node scripts/check-accessibility.mjs && python3 scripts/check-pdf.py reports/sample-syllabus.pdf`.

**How the builder is built for accessibility:**

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
| `diversity-statement.html` | **Not in the July 2026 template.** Wording copied unchanged from the older table-form SCTCC template ("Statement of Diversity (REQUIRED)") at the request of the project lead (2026-11-26). Its list of protected groups is older than the current Nondiscrimination and Title IX text (it does not name gender identity, familial status, or sex including pregnancy). The Office of Community, Culture, and Institutional Climate should confirm or supply current wording. |
| `institutional-footer.html` | Now uses Brand Standards 2025 wording (approved 2026-11-25); replaces the outdated "Minnesota State Colleges and Universities System" line and the separate equal-opportunity line. |

## Instructor guidance from the template

This guidance from the template is for instructors and does not appear in the syllabus:

- Instructors must use information from the official **SCTCC Course Outline** (course description, outcomes, prerequisites, credits).
- The course must not begin before the official semester start date and must include final exam week.
- **Accessibility & data privacy:** if you use technology not listed under the Resources tab in D2L, add its accessibility statement. If none exists, link the vendor's VPAT; if neither exists, say so. Consider plagiarism tools, presentation software, web conferencing, polling, recording tools, media players, document sharing, social media, mobile apps, and publisher platforms. Link the data privacy policy for any tool that may collect student data, or state that none was found. Closed social media groups are encouraged; otherwise state a pseudonym policy. For group texting, use a setting that hides phone numbers and say so. *(Enter these under **Tools and vendors** in the editor. Social media and group-texting statements can go in the tool's "Alternative access method" or "Purpose" field, or in your Class Environment text.)*
- **Technical support:** include support links for any outside vendors used in the course (the **Technical support web address** field for each tool).

## Testing checklist

Phase 6 (tested on 2026-11-26 in headless Chrome):

- [x] Start screen opens on load with focus on its heading; three choices and the sample link; Escape gives a blank syllabus
- [x] Importing a real CSEC 2205 Word syllabus finds 40 items: course, instructor (name, email, phone, office, office hours with Bookings links, contact text, bio), credits, online modality and course notes, log-in text, description, 9 outcomes, prerequisite, materials, skills, attendance and late policies, accepted file format (.docx), Turnitin/integrity/Class Environment choices with the instructor's own wording, Student Responsibilities and Exams as additional sections, Cengage support as a tool, grading (1,830 + 90 = 1,920 points), A–F scale, grades text, time commitment, and calendar statement; the instructor photo is pre-selected and the logo is not
- [x] College text is left out: first-week/withdrawal/student-email paragraphs inside Attendance, all college sections, the old Statement of Diversity (offered unticked), footer
- [x] After import plus "Fill in these dates", Check my syllabus reports only the drop and withdrawal dates (which come from eServices)
- [x] A second layout (residential course with real Word tables, "(10 @ 20 points each)", "F = below 70", class times, MnTC goal, philosophy, recommended materials, a calendar table, and a custom Lab Safety section) imports correctly; its 4 calendar topics are placed in order into the generated Spring 2027 calendar
- [x] PDF and damaged files give clear messages; Cancel changes nothing; Start over → See an example; toolbar Save; Additional course sections add/rename/link; no console errors
- [x] Phases 2–5 tests still pass

Phase 5 (tested on 2026-11-25 in headless Chrome and Node):

- [x] Blank syllabus → Save as PDF opens a dialog listing what is missing; focus starts on Close; Escape closes and returns focus to Save as PDF
- [x] Go to field opens the right editor group and focuses the field (also from Student preview, and to "Add a grade" for scale problems)
- [x] Sample course → no problems; review notices listed; steps shown with the suggested file name; Continue to Save as PDF opens the browser's window in student view
- [x] Template placeholder ("XXX") and withdraw-before-drop reported in Check my syllabus, with working Go to field
- [x] Overlapping grades stop printing; weights below 100% stop printing until the override is ticked
- [x] Calendar rows outside the course dates reported for review
- [x] Each Go to field button is described by its message for screen readers; the same field is listed once even if marked in several places
- [x] Content check script: the real content passes (6 warnings: 3 http:// links, 3 "here" links); a broken copy fails with 7 errors (missing file, bad date, `<script>`, event attribute, `javascript:` link, placeholder, impossible calendar date) and the expected warnings
- [x] Phases 2–4 tests still pass

Phase 4 (tested on 2026-11-25; generator logic in Node, editor in headless Chrome):

- [x] College academic calendar: status panel lists Fall 2026, Spring 2027, Summer 2027 and that they are not yet confirmed; choosing Spring 2027 shows its dates, the "not yet confirmed" flag, and the eServices note for drop/withdraw; Fill in these dates fills begin/end; warnings for starting before the semester and ending before finals week; a term not in the file (Spring 2028) says so
- [x] Add the college’s no-class dates: adds Spring 2027's 8 dates, a second click adds none; generating then gives 36 Monday/Wednesday rows with 32 class meetings
- [x] Bad entries in academic-calendar.json are listed and skipped while good terms still work; a missing file is reported without breaking the builder

- [x] 1, 2, 3, and 4 meetings per week over a 17-week semester plus finals week: 18, 36, 54, and 72 rows, every row on a chosen weekday
- [x] Meetings-per-week and meeting-day mismatch → message as you change settings; Generate stopped with the message focused
- [x] Holidays: "No Class" rows with the reason and no meeting number (36 rows, 33 meetings with 3 closures); left out when that option is off
- [x] Finals week marked "(Finals)"; left out when "Include final exam week" is off
- [x] First-week special schedule (Wednesday only in week 1)
- [x] Generating again keeps topics by date; a topic on a new holiday is kept with a warning; content that no longer falls on a class day is kept as unscheduled rows; unscheduled rows kept
- [x] Weekly layout: 18 week rows with date ranges, closures listed in notes, first row starts on a mid-week start date
- [x] End date before start date and spans over 30 weeks are refused; older files with plain-text no-class dates are converted
- [x] Editor: typing updates the row label and preview; No class renumbers meetings; Shift topics later; Move topic later (focus follows); add/remove unscheduled row; Use the course meeting days
- [x] CSV export: file name follows the course; quotes and commas escaped; opens with a byte-order mark for Excel
- [x] PDF: calendar spanning two pages repeats its column headings
- [x] Phase 2 and Phase 3 checks still pass; no console errors

Phase 3:

- [x] New syllabus starts with the A–F scale and no categories ("Add at least one assessment category")
- [x] Add a category → focus moves to its name; row totals (10 × 20 = 200) and course total update as you type; legend shows the name
- [x] Scale point ranges follow the course total (300 points → A 270–300 … F 0–179)
- [x] Move down → order changes in editor and preview; focus stays on the moved category's button
- [x] Switching to weights shows weight fields and hides points fields (values kept)
- [x] Weights totaling 90% → "10% short of 100%"; entered values unchanged; Save as PDF stopped with the problem list focused
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

- `content/academic-calendar.json` was copied from the published calendar and awaits confirmation by Records & Registration; drop/withdraw deadlines come from eServices.
- The browser's own Print command (Ctrl+P) cannot be stopped by the checks; use the Save as PDF button.
- There is no autosave, by design. Save regularly (Ctrl+S); the status line shows when changes are unsaved.
- Firefox and Safari save by download rather than to a chosen folder.
- The logo is a placeholder.
- Arimo font files are not bundled yet (Arial is used).
- The page footer in the PDF requires Chrome or Edge version 131 or later.
- PDF import is best-effort: structure is guessed from layout, pictures are not imported, and scanned PDFs cannot be read.
- PDF.js needs a current browser (Chrome, Edge, Firefox, or Safari from the last two years).

## Possible next steps

- Test the import with colleagues' syllabi, including PDFs made by Word and by Acrobat.
- Official logo from Marketing and Arimo font files.
- Records & Registration confirms the academic calendar and takes ownership in CODEOWNERS; content offices fix the "here" links and other verification items.
- Move the repository to a college GitHub organization and turn on the ruleset above.
- Testing by people: keyboard only, NVDA/JAWS, 200% zoom, Acrobat accessibility check of a PDF, D2L upload, and a real Save to a OneDrive folder in Chrome and Edge.
- Optional: direct OneDrive saving (needs an SCTCC Microsoft app registration).

## Roadmap

| Phase | Scope |
|---|---|
| 1 (done) | Content files, manifest, loader, sanitizer, rendered preview, print styles, basic Save as PDF |
| 2 (done) | Instructor editing panel, Save / Save as / Open to the instructor's own files or OneDrive (no browser storage), vendor table, photo upload, instructor overrides (Class Environment, accepted file formats) |
| 3 (done) | Grading editor: points and percentage methods, category rows with move/remove, live totals, weight check with instructor override, scale editor with overlap/gap/range checks and point ranges, plus/minus sample, print stopped on grading errors |
| 4 (done) | Course calendar generator: 1–4 meetings per week or one row per week, no-class dates, finals week, first-week schedule, regeneration that keeps entered text, move/shift topics, unscheduled rows, CSV export; college academic calendar file for official dates and no-class dates |
| 5 (done) | Checks before printing (errors, warnings, notices with Go to field), guided Save as PDF dialog, Check my syllabus panel, GitHub Action that checks content files and links |
| **6 (this version)** | Start screen (import / open / scratch / example), Word and PDF syllabus import with review (current and older table-form templates), additional course sections, college Statement of Diversity plus optional Program Diversity Statement, required tool accessibility statements, toolbar Save and Open, linked web addresses |
