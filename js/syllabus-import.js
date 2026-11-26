/*
 * SCTCC Syllabus Builder — turns a previous Word syllabus into proposed fields
 *
 * Input: the outline from docx-reader.js and the college content loaded from the
 * repository. Output: a list of proposed values for the instructor to review.
 * Nothing is applied until the instructor accepts it.
 *
 * Rules:
 *   - Only the instructor's own information is proposed.
 *   - College policy text is never imported; it always comes from the repository.
 *     Paragraphs that match college content (or well-known college wording) are
 *     dropped even when they appear inside an instructor section such as Attendance.
 *   - Dates and the term/year are not imported (an old syllabus has last term's dates).
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  /* ---------- Text helpers ---------- */

  /* Markers from older templates, for example "(SAMPLE)" or "(REQUIRED)". */
  const TEMPLATE_MARKER = /\((?:SAMPLE|REQUIRED|OPTIONAL|AS APPLICABLE)\)\s*/g;

  function clean(text) {
    return String(text || "").replace(TEMPLATE_MARKER, "").replace(/\t+/g, " ").replace(/[ \u00a0]{2,}/g, " ").replace(/\s+\n/g, "\n").trim();
  }

  function normalizeHeading(text) {
    return clean(text).toLowerCase()
      .replace(/&/g, "and")
      .replace(/[“”"’']/g, "")
      .replace(/[:.]+$/, "")
      .replace(/\s*\(.*?\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function words(text) {
    return String(text || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").match(/[a-z0-9]+/g) || [];
  }

  /* Share of the paragraph's words that also appear in `wordSet`. */
  function containment(text, wordSet) {
    const list = words(text);
    if (!list.length) return 0;
    return list.filter((word) => wordSet.has(word)).length / list.length;
  }

  /* Turn paragraph blocks into text: paragraphs separated by blank lines, list items as "• " lines. */
  function blocksToText(blocks) {
    const out = [];
    let listRun = [];
    const flush = () => {
      if (listRun.length) out.push(listRun.join("\n"));
      listRun = [];
    };
    blocks.forEach((block) => {
      if (block.type === "table") {
        flush();
        const lines = block.rows.map((row) => row.map(clean).filter(Boolean).join(" — ")).filter(Boolean);
        if (lines.length) out.push(lines.join("\n"));
        return;
      }
      const text = clean(block.text);
      if (!text) {
        flush();
        return;
      }
      if (block.list) listRun.push(`• ${text}`);
      else if (/^\d+[.)]\s/.test(text)) listRun.push(text); /* typed numbering, for example "1. Attendance…" */
      else if (!listRun.length && out.length && !/[.!?:;”")\]]$/.test(out[out.length - 1]) && /^[a-z(]/.test(text)) {
        out[out.length - 1] = `${out[out.length - 1]} ${text}`; /* a sentence broken across lines */
      } else {
        flush();
        out.push(text);
      }
    });
    flush();
    return out.join("\n\n");
  }

  function firstSentenceAfter(text, pattern) {
    const match = pattern.exec(text);
    return match ? match[1].trim() : "";
  }

  const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };

  function toNumber(value) {
    if (value === undefined || value === null) return NaN;
    const key = String(value).trim().toLowerCase();
    if (WORD_NUMBERS[key]) return WORD_NUMBERS[key];
    const number = Number(key.replace(/,/g, ""));
    return Number.isFinite(number) ? number : NaN;
  }

  /* ---------- Section map ---------- */

  const SECTION_ALIASES = {
    "instructor information": "instructor",
    "instructor": "instructor",
    "instructor bio": "bio",
    "bio": "bio",
    "about your instructor": "bio",
    "about the instructor": "bio",
    "educational philosophy": "philosophy",
    "teaching philosophy": "philosophy",
    "course information": "courseContainer",
    "general information": "general",
    "course log-in": "login",
    "course login": "login",
    "course log in": "login",
    "materials": "materialsContainer",
    "required": "required",
    "required materials": "required",
    "required textbook": "required",
    "required textbooks": "required",
    "recommended": "recommended",
    "recommended materials": "recommended",
    "required technology": "requiredTech",
    "suggested technical skills": "techSkills",
    "technical skills": "techSkills",
    "pre/co-requisites": "prereqs",
    "pre/co requisites": "prereqs",
    "prerequisites": "prereqs",
    "pre-requisites": "prereqs",
    "prerequisite": "prereqs",
    "prerequisites and corequisites": "prereqs",
    "course description and outcomes": "description",
    "course description": "description",
    "course outcomes": "description",
    "outcomes": "description",
    "learning outcomes": "description",
    "mn transfer curriculum goal area": "mntc",
    "mntc goal area": "mntc",
    "minnesota transfer curriculum": "mntc",
    "college policies and procedures": "collegeContainer",
    "college policies": "collegeContainer",
    "academic integrity": "college:academic-integrity",
    "turnitin": "college:turnitin",
    "accommodations": "college:accommodations",
    "accomodations": "college:accommodations",
    "nondiscrimination and title ix": "college:nondiscrimination-title-ix",
    "title ix": "college:nondiscrimination-title-ix",
    "pulse app for d2l": "college:pulse-app",
    "pulse app": "college:pulse-app",
    "student services and academic support": "college:student-services",
    "accessibility and data privacy policies": "college:accessibility-data-privacy",
    "accessibility and data privacy polices": "college:accessibility-data-privacy",
    "navigating d2l": "navigatingD2l",
    "technical support": "techSupport",
    "class environment": "classEnvironment",
    "course policies and procedures": "coursePoliciesContainer",
    "course policies": "coursePoliciesContainer",
    "attendance": "attendance",
    "attendance policy": "attendance",
    "late policy": "late",
    "late work": "late",
    "late work policy": "late",
    "grading": "gradingContainer",
    "assignments and points": "assignments",
    "assessments": "assignments",
    "grading scale": "scale",
    "grades": "grades",
    "time commitment": "time",
    "course calendar": "calendar",
    "course schedule": "calendar",
    "calendar": "calendar",

    /* Older table-form template (label | value rows) */
    "course prefix and number": "field:courseId",
    "course number": "field:courseId",
    "course title": "field:title",
    "credits": "field:credits",
    "credit hours": "field:credits",
    "course start date": "field:dates",
    "course end date": "field:dates",
    "course drop and withdrawal dates": "field:dates",
    "drop and withdrawal dates": "field:dates",
    "meeting times": "field:meeting",
    "meeting times and location": "field:meeting",
    "class meeting times": "field:meeting",
    "required text": "required",
    "required texts": "required",
    "d2l site and support": "techSupport",
    "name": "field:name",
    "instructor name": "field:name",
    "office location": "field:office",
    "office": "field:office",
    "office hours": "field:hours",
    "phone number": "field:phone",
    "phone": "field:phone",
    "telephone": "field:phone",
    "email": "field:email",
    "e-mail": "field:email",
    "email address": "field:email",
    "website": "field:website",
    "instructor availability": "field:availability",
    "availability": "field:availability",
    "goal area": "mntc",
    "late assignments": "late",
    "online environment": "classEnvironment",
    "classroom environment": "classEnvironment",
    "grading formula": "scale",
    "statement of diversity": "oldCollege",
    "diversity statement": "oldCollege"
  };

  /* When a heading is not an exact match, recognize it by its key words. */
  const HEADING_KEYWORDS = [
    [/navigating d2l/, "navigatingD2l"],
    [/course calendar|timeline|course schedule/, "calendar"],
    [/^late\b/, "late"],
    [/attendance/, "attendance"],
    [/grading (formula|scale)/, "scale"],
    [/time commitment/, "time"],
    [/class(room)? environment|online environment/, "classEnvironment"],
    [/accommodation/, "college:accommodations"],
    [/academic (integrity|honesty)/, "college:academic-integrity"],
    [/title ix|nondiscrimination/, "college:nondiscrimination-title-ix"],
    [/technical support|tech support/, "techSupport"],
    [/learning outcomes|course outcomes/, "description"],
    [/instructor information/, "instructor"],
    [/course information/, "courseContainer"]
  ];

  function headingKey(title) {
    const normalized = normalizeHeading(title);
    if (SECTION_ALIASES[normalized]) return SECTION_ALIASES[normalized];
    const match = HEADING_KEYWORDS.find(([pattern]) => pattern.test(normalized));
    return match ? match[1] : "";
  }

  const COLLEGE_TITLES = {
    "academic-integrity": "Academic Integrity",
    "turnitin": "Turnitin",
    "accommodations": "Accommodations",
    "nondiscrimination-title-ix": "Nondiscrimination and Title IX",
    "pulse-app": "Pulse App for D2L",
    "student-services": "Student Services & Academic Support",
    "accessibility-data-privacy": "Accessibility & Data Privacy Policies"
  };

  /* Wording that belongs to college content even when it sits in an instructor section. */
  const COLLEGE_PHRASES = [
    /administratively withdrawn/i,
    /federal financial aid/i,
    /YOURStarID|StarID password/i,
    /Student Computer Lab/i,
    /school email address will be automatically entered/i,
    /dropped (from the course )?for non-?attendance/i,
    /do(es)? not attend .*first week/i,
    /“?FW”? grade to a “?W”? grade/i,
    /Office 365 subscription allows/i,
    /Microsoft Training .* free at your convenience/i,
    /SCTCC Academic Calendar .* eServices/i,
    /Resources Tab in D2L/i
  ];

  const FOOTER_PATTERNS = [
    /member of (the )?Minnesota State/i,
    /Equal Opportunity (educator|Educator)/i,
    /TTY users may call/i,
    /1540 Northway Drive/i,
    /^Template Updated/i,
    /^Revised:/i,
    /Higher Learning Commission/i,
    /adapted from a design by/i
  ];

  const COURSE_HEADING = /^([A-Z]{2,5})\s*-?\s*(\d{3,4}[A-Z]?)(?:-\d{1,3})?\s*[:–—-]?\s*(.*)$/;

  function isHeading(block) {
    if (block.type !== "p" || !block.level) return false;
    const text = clean(block.text);
    if (!text || text.length > 90) return false;
    if (/^\d+[.)]\s/.test(text)) return false; /* a numbered item styled as a heading */
    if (/\t/.test(block.text)) return false; /* tab-separated table line styled as a heading */
    return true;
  }

  /* Uppercase labels used instead of headings, for example "OFFICE & OFFICE HOURS". */
  function instructorLabel(block) {
    if (block.type !== "p") return "";
    const text = clean(block.text);
    if (!text || text.length > 45 || !/[A-Z]/.test(text) || text !== text.toUpperCase() || /\d{3}/.test(text)) return "";
    if (/OFFICE/.test(text)) return "office";
    if (/CONTACT|EMAIL|PHONE/.test(text)) return "contact";
    if (/PHILOSOPHY/.test(text)) return "philosophy";
    if (/BIO|ABOUT/.test(text)) return "bio";
    return "";
  }

  /* ---------- Table-form syllabi ---------- */

  /*
   * Some older syllabi put everything in one large table: single-cell rows are
   * section headings and two-cell rows are "label | value". Turn such a table
   * into headings and paragraphs so it reads like any other syllabus.
   */
  function isLayoutTable(table) {
    if (!table.cells || table.rows.length < 6) return false;
    let shaped = 0;
    let known = 0;
    table.rows.forEach((row) => {
      if (row.length === 1 || (row.length === 2 && clean(row[0]).length <= 80)) shaped += 1;
      const label = clean(row[0]).replace(/\n+/g, " ");
      if (label && headingKey(label)) known += 1;
    });
    return shaped / table.rows.length >= 0.7 && known >= 3;
  }

  function expandLayoutTables(blocks) {
    const out = [];
    blocks.forEach((block) => {
      if (block.type !== "table" || !isLayoutTable(block)) {
        out.push(block);
        return;
      }
      block.cells.forEach((cells, index) => {
        const texts = block.rows[index].map(clean);
        if (cells.length === 1 || (texts.length >= 2 && texts.slice(1).every((text) => !text) && texts[0] && headingKey(texts[0].replace(/\n+/g, " ")) && !/^field:/.test(headingKey(texts[0].replace(/\n+/g, " "))))) {
          if (texts[0]) out.push({ type: "p", text: texts[0].replace(/\n+/g, " "), level: 1, list: false, images: [] });
          return;
        }
        const label = block.rows[index][0].replace(/\s*\n+\s*/g, " ").trim();
        if (clean(label)) out.push({ type: "p", text: label, level: 2, list: false, images: [], fromLabel: true });
        cells.slice(1).forEach((cellBlocks) => out.push(...cellBlocks));
      });
    });
    return out;
  }

  /* ---------- Splitting the document into sections ---------- */

  function splitSections(blocks) {
    const sections = [];
    let current = { key: "preamble", title: "", level: 0, blocks: [] };
    let container = "";
    let seenSection = false;
    blocks.forEach((block) => {
      if (isHeading(block)) {
        const title = clean(block.text);
        let key = headingKey(title);
        if (!key && block.level === 1 && COURSE_HEADING.test(title) && !sections.some((s) => s.key === "courseTitle")) key = "courseTitle";
        if (!key && !seenSection && block.level === 1) key = "docTitle"; /* a title without a course number */
        if (!key && current.key === "calendar") return; /* column labels inside the calendar area */
        if (key && key.endsWith("Container")) container = key;
        if (!key) key = container === "collegeContainer" ? "collegeUnknown" : "additional";
        if (key !== "docTitle") seenSection = true;
        sections.push(current);
        current = { key, title, rawTitle: String(block.text || ""), level: block.level, blocks: [], images: block.images || [] };
        return;
      }
      current.blocks.push(block);
    });
    sections.push(current);
    return sections.filter((section) => section.key !== "preamble" || section.blocks.some((b) => b.type === "table" || clean(b.text)));
  }

  /* ---------- Main ---------- */

  function analyze(docx, options) {
    const opts = options || {};
    const collegeSets = (opts.collegeTexts || []).map((item) => ({ id: item.id, title: item.title, set: new Set(words(item.text)), text: item.text }));
    const items = [];
    const skipped = [];
    const notes = [];
    let order = 0;

    const OLD_PLACEHOLDERS = /\b(XXX+|COURSE NAME|YOUR NAME|GIVE (?:WITHDRAWAL )?DATE|GIVE TIME|LIST ASSIGNMENT|DATE & TIME)\b/;

    function propose(group, label, preview, apply, extra) {
      const item = Object.assign({ id: `item-${++order}`, group, label, preview, apply, checked: true, note: "" }, extra || {});
      const placeholder = OLD_PLACEHOLDERS.exec(String(preview || ""));
      if (placeholder) {
        item.note = `${item.note ? `${item.note} ` : ""}It still contains the template placeholder “${placeholder[1]}”; edit it after importing.`.trim();
      }
      items.push(item);
    }

    function isCollegeText(text) {
      const value = clean(text);
      if (!value) return true;
      if (COLLEGE_PHRASES.some((pattern) => pattern.test(value))) return true;
      if (words(value).length < 6) return false;
      return collegeSets.some((college) => containment(value, college.set) >= 0.8);
    }

    function isFooter(text) {
      return FOOTER_PATTERNS.some((pattern) => pattern.test(clean(text)));
    }

    function ownBlocks(blocks) {
      return blocks.filter((block) => (block.type === "table" && block.rows.length)
        || (block.type === "p" && clean(block.text) && !isCollegeText(block.text) && !isFooter(block.text)));
    }

    const sections = splitSections(expandLayoutTables(docx.blocks));
    const byKey = (key) => sections.filter((section) => section.key === key);
    const collegeFound = new Set();

    /* ----- Course title ----- */
    const titleSection = byKey("courseTitle")[0];
    if (titleSection) {
      const match = COURSE_HEADING.exec(clean(titleSection.title));
      const title = match[3].replace(/\s*(course\s+)?syllabus\s*$/i, "").trim();
      propose("Course", "Course prefix", match[1], (d) => { d.course.prefix = match[1]; });
      propose("Course", "Course number", match[2], (d) => { d.course.number = match[2]; });
      if (title) propose("Course", "Course title", title, (d) => { d.course.title = title; });
    }
    const fieldText = (key) => clean(byKey(key).flatMap((section) => section.blocks)
      .map((block) => (block.type === "table" ? block.rows.map((row) => row.join(" ")).join("\n") : block.text || "")).join("\n"));
    if (!titleSection) {
      const id = /^([A-Z]{2,5})\s*-?\s*(\d{3,4}[A-Z]?)/.exec(fieldText("field:courseId"));
      if (id) {
        propose("Course", "Course prefix", id[1], (d) => { d.course.prefix = id[1]; });
        propose("Course", "Course number", id[2], (d) => { d.course.number = id[2]; });
      }
      const docTitle = byKey("docTitle")[0];
      const title = fieldText("field:title") || (docTitle ? clean(docTitle.title).replace(/\s*(course\s+)?syllabus\s*$/i, "") : "");
      if (title) propose("Course", "Course title", title, (d) => { d.course.title = title; });
    }
    notes.push("The term, year, and all dates were not imported, because an old syllabus has last term’s dates. Choose the new term, then use “Fill in these dates.”");

    /* ----- Instructor ----- */
    const instructorBlocks = [];
    byKey("instructor").forEach((section) => instructorBlocks.push(...section.blocks));
    const bioBlocks = [];
    const philosophyBlocks = [];
    byKey("bio").forEach((section) => bioBlocks.push(...section.blocks));
    byKey("philosophy").forEach((section) => philosophyBlocks.push(...section.blocks));

    const office = [];
    const contact = [];
    let label = "contact";
    instructorBlocks.forEach((block) => {
      const found = instructorLabel(block);
      if (found) {
        label = found;
        return;
      }
      if (block.type !== "p" || !clean(block.text)) return;
      if (label === "office") office.push(block);
      else if (label === "bio") bioBlocks.push(block);
      else if (label === "philosophy") philosophyBlocks.push(block);
      else contact.push(block);
    });

    /* Label | value rows from table-form syllabi */
    [["field:name", "Name"], ["field:office", "Office"], ["field:hours", "Office hours"], ["field:phone", "Phone"], ["field:email", "Email"]]
      .forEach(([key, labelText]) => {
        const value = fieldText(key);
        if (!value) return;
        if (key === "field:hours") byKey(key).forEach((section) => office.push(...section.blocks));
        else contact.push({ type: "p", text: `${labelText}: ${value}`, level: 0, list: false });
      });
    contact.push(...byKey("field:availability").flatMap((section) => section.blocks));

    const allInstructorText = [...office, ...contact].map((b) => clean(b.text)).join("\n");
    const officeField = /(?:^|\n)Office:\s*([^\n]{1,60})(?:\n|$)/.exec(allInstructorText);
    let name = "";
    let credentials = "";
    const nameLine = /(?:^|\n)(?:Instructor(?: Name)?|Name)\s*:\s*([^\n]+)/i.exec(allInstructorText);
    if (nameLine) name = nameLine[1].trim();
    if (!name) {
      const booking = /Book time with ([A-Z][\w'-]+),\s*([A-Z][\w'-]+)/.exec(allInstructorText);
      if (booking) name = `${booking[2]} ${booking[1]}`;
    }
    let nameNote = "";
    if (!name && docx.properties && docx.properties.lastModifiedBy) {
      name = docx.properties.lastModifiedBy;
      nameNote = "Taken from the Word file’s “last modified by” name. Check that it is yours.";
    }
    if (name.includes(",")) {
      [name, credentials] = [name.split(",")[0].trim(), name.split(",").slice(1).join(",").trim()];
    }
    if (name) propose("Instructor", "Name", name, (d) => { d.instructor.name = name; }, { note: nameNote });
    if (credentials) propose("Instructor", "Credentials", credentials, (d) => { d.instructor.credentials = credentials; });

    const withoutLinks = allInstructorText.replace(/https?:\/\/\S+/g, " ");
    const labelled = /(?:^|\n)\s*(?:Email(?: address)?|E-mail)\s*:?\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i.exec(withoutLinks);
    const email = labelled ? labelled[1] : (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(withoutLinks) || [""])[0];
    if (email) propose("Instructor", "Email", email, (d) => { d.instructor.email = email; });
    const phone = firstSentenceAfter(allInstructorText, /(?:Telephone|Phone|Office phone|Cell)\s*(?:number)?\s*:?\s*(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i);
    if (phone) propose("Instructor", "Telephone", phone, (d) => { d.instructor.phone = phone; });

    let officeLocation = "";
    const hoursBlocks = [];
    office.forEach((block) => {
      const text = clean(block.text);
      const location = /^(?:Location|Office(?: location)?|Room)\s*:?\s*(.+)$/i.exec(text);
      if (location && !officeLocation && text.length < 80) officeLocation = location[1].trim();
      else hoursBlocks.push(block);
    });
    if (!officeLocation && officeField) officeLocation = officeField[1].trim();
    if (!officeLocation) {
      const room = /(?:Office|Location|Room)\s*:?\s*(\d-\d{3}\w?)/i.exec(allInstructorText);
      if (room) officeLocation = room[1];
    }
    if (officeLocation) propose("Instructor", "Office location", officeLocation, (d) => { d.instructor.office = officeLocation; });
    const hours = blocksToText(hoursBlocks);
    if (hours) propose("Instructor", "Office hours", hours, (d) => { d.instructor.officeHours = hours; });

    /* "Office hours:" and "Office:" lines can appear without a section label. */
    const labelledHours = [];
    contact.forEach((block) => {
      const text = clean(block.text);
      const hoursLine = /^Office hours?\s*:\s*(.+)$/i.exec(text);
      if (hoursLine) labelledHours.push(hoursLine[1]);
    });
    if (labelledHours.length && !hours) {
      const value = labelledHours.join("\n");
      propose("Instructor", "Office hours", value, (d) => { d.instructor.officeHours = value; });
    }
    const contactRest = contact.filter((block) => {
      const text = clean(block.text);
      return !/^(?:Email(?: address)?|E-mail|Telephone|Phone|Office phone|Cell)\s*:/i.test(text)
        && !/^(?:Instructor(?: Name)?|Name)\s*:/i.test(text)
        && !/^Office hours?\s*:/i.test(text)
        && !/^(?:Office(?: location)?|Location|Room)\s*:?\s*\S+.{0,60}$/i.test(text);
    });
    const contactText = blocksToText(contactRest);
    const preferred = /The best way to contact me is (?:by|via|through)\s+([^.]+)\./i.exec(contactText);
    if (preferred) {
      const method = preferred[1].trim();
      propose("Instructor", "Best way to contact me", method, (d) => { d.instructor.preferredContactMethod = method; });
    }
    const response = clean(contactText.replace(/The best way to contact me is (?:by|via|through)\s+[^.]+\.\s*/i, ""));
    if (response) {
      propose("Instructor", "Contact expectations and response time", response, (d) => { d.instructor.responseTime = response; },
        { note: "Shown after “The best way to contact me is …”." });
    }

    const bio = blocksToText(bioBlocks);
    if (bio) propose("Instructor", "Instructor bio (turns the section on)", bio, (d) => {
      d.instructor.biography = bio;
      d.optionalSections.instructorBiography = true;
    });
    const philosophy = blocksToText(philosophyBlocks);
    if (philosophy) propose("Instructor", "Educational philosophy (turns the section on)", philosophy, (d) => {
      d.instructor.philosophy = philosophy;
      d.optionalSections.educationalPhilosophy = true;
    });

    /* Photo candidates: images in the document; suggest the one near Instructor Information. */
    const instructorImageIds = new Set();
    sections.forEach((section) => {
      if (section.key === "instructor") (section.images || []).forEach((id) => instructorImageIds.add(id));
      if (section.key === "instructor") section.blocks.forEach((b) => (b.images || []).forEach((id) => instructorImageIds.add(id)));
    });
    const photoCandidates = Object.entries(docx.images || {})
      .filter(([, image]) => /^image\/(png|jpeg|webp)$/.test(image.mime))
      .map(([id, image]) => ({ id, name: image.name, size: image.size, mime: image.mime, dataUrl: image.dataUrl, suggested: instructorImageIds.has(id) }));

    /* ----- Credits and meeting times from label | value rows ----- */
    const creditsField = fieldText("field:credits");
    if (creditsField) {
      const total = toNumber((/(\d+(?:\.\d+)?|one|two|three|four|five|six)\b/i.exec(creditsField) || [])[1]);
      const part = (patterns) => {
        for (const pattern of patterns) {
          const match = pattern.exec(creditsField);
          if (match) return toNumber(match[1]);
        }
        return 0;
      };
      const values = {
        total,
        lecture: part([/(\d+(?:\.\d+)?)\s*lec/i, /lec\w*\s*[–—:-]?\s*(\d+(?:\.\d+)?)/i]),
        laboratory: part([/(\d+(?:\.\d+)?)\s*lab/i, /lab\w*\s*[–—:-]?\s*(\d+(?:\.\d+)?)/i]),
        soe: part([/(\d+(?:\.\d+)?)\s*soe/i, /soe\s*[–—:-]?\s*(\d+(?:\.\d+)?)/i])
      };
      if (Number.isFinite(total) && total > 0) {
        propose("Credits, modality, and dates", "Credits", `${total} credits: Lecture – ${values.lecture}, Laboratory – ${values.laboratory}, SOE – ${values.soe}`,
          (d) => { Object.assign(d.course.credits, values); }, { note: `From “${creditsField}”. Check the lecture, lab, and SOE split.` });
      }
    }
    const meetingField = fieldText("field:meeting");
    if (meetingField) {
      if (/asynchronous|online|no face-to-face|d2l only/i.test(meetingField)) {
        propose("Credits, modality, and dates", "Modality", "Exclusively online", (d) => { d.course.modality = "online"; },
          { note: `From “${meetingField}”. Choose hybrid instead if the course has some class meetings.` });
      }
      propose("Credits, modality, and dates", "Additional modality information", meetingField, (d) => { d.course.modalityNote = meetingField; });
    }

    /* ----- General information ----- */
    const generalBlocks = byKey("general").flatMap((section) => section.blocks).filter((b) => b.type === "p" && clean(b.text));
    const modalityNote = [];
    let modalityFound = false;
    generalBlocks.forEach((block) => {
      const text = clean(block.text);
      const credits = /^(\S+)\s+credits?\s*:?\s*Lecture\s*[–—-]\s*([\d.]+)\s*,\s*Lab(?:oratory)?\s*[–—-]\s*([\d.]+)\s*,\s*SOE\s*[–—-]\s*([\d.]+)/i.exec(text);
      if (credits) {
        const total = toNumber(credits[1]);
        const values = { total, lecture: toNumber(credits[2]), laboratory: toNumber(credits[3]), soe: toNumber(credits[4]) };
        if (Object.values(values).every(Number.isFinite)) {
          propose("Credits, modality, and dates", "Credits", `${total} credits: Lecture – ${values.lecture}, Laboratory – ${values.laboratory}, SOE – ${values.soe}`,
            (d) => { Object.assign(d.course.credits, values); });
        }
        return;
      }
      if (COURSE_HEADING.test(text) && text.length < 90) return;
      if (/Begin date|End date|Last day to (drop|withdraw)/i.test(text)) return;
      if (isCollegeText(text) || isFooter(text)) return;
      if (!modalityFound && (/^This is (an? )?(exclusively online|fully online|online|hybrid|residential|face-to-face)/i.test(text) || /which meets .* (in )?room/i.test(text))) {
        modalityFound = true;
        const modality = /online/i.test(text) && !/hybrid/i.test(text) ? "online" : (/hybrid/i.test(text) ? "hybrid" : "residential");
        const labels = { online: "Exclusively online", hybrid: "Hybrid", residential: "Residential (face-to-face)" };
        propose("Credits, modality, and dates", "Modality", labels[modality], (d) => { d.course.modality = modality; });
        if (modality !== "online") {
          const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].filter((day) => new RegExp(`${day}s?\\b`, "i").test(text));
          if (days.length) propose("Credits, modality, and dates", "Meeting days", days.join(", "), (d) => {
            d.course.meetingPattern.days = days;
            d.course.meetingPattern.meetingsPerWeek = days.length;
          });
          const time = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i.exec(text);
          if (time) {
            const to24 = (hour, minute, suffix) => {
              let h = Number(hour) % 12;
              if (/p/i.test(suffix)) h += 12;
              return `${String(h).padStart(2, "0")}:${minute || "00"}`;
            };
            const endSuffix = time[6];
            let startSuffix = time[3] || endSuffix;
            if (!time[3] && /p/i.test(endSuffix) && Number(time[1]) > Number(time[4]) && Number(time[1]) !== 12) startSuffix = "am";
            const start = to24(time[1], time[2], startSuffix);
            const end = to24(time[4], time[5], endSuffix);
            propose("Credits, modality, and dates", "Class times", `${start} to ${end}`, (d) => {
              d.course.meetingPattern.startTime = start;
              d.course.meetingPattern.endTime = end;
            });
          }
          const room = /room\s+(?:number\s+)?([0-9]-?\d{3}\w?)/i.exec(text);
          if (room) propose("Credits, modality, and dates", "Room number", room[1], (d) => { d.course.location = room[1]; });
        }
        return;
      }
      modalityNote.push(block);
    });
    const modalityText = blocksToText(modalityNote);
    if (modalityText) propose("Credits, modality, and dates", "Additional modality information", modalityText, (d) => { d.course.modalityNote = modalityText; });

    const loginText = blocksToText(ownBlocks(byKey("login").flatMap((s) => s.blocks)));
    if (loginText) propose("Credits, modality, and dates", "Course log-in requirement (turns the section on)", loginText, (d) => {
      d.course.courseLogin = loginText;
      d.optionalSections.courseLogin = true;
    }, { note: "Update the date and time for the new term." });

    /* ----- Description, outcomes, requisites ----- */
    const descriptionBlocks = byKey("description").flatMap((s) => s.blocks).filter((b) => b.type === "p" && clean(b.text));
    const outcomes = descriptionBlocks.filter((b) => b.list || /^\d+[.)]\s/.test(clean(b.text))).map((b) => clean(b.text).replace(/^\d+[.)]\s*/, ""));
    const descriptionText = blocksToText(descriptionBlocks.filter((b) => !b.list && !/^\d+[.)]\s/.test(clean(b.text))
      && !/(upon (successful )?completion|students will be able to|course outcomes?:?$)/i.test(clean(b.text))));
    if (descriptionText) propose("Description, outcomes, and requisites", "Course description", descriptionText, (d) => { d.course.description = descriptionText; },
      { note: "Confirm it still matches the SCTCC Course Outline." });
    if (outcomes.length) propose("Description, outcomes, and requisites", `Course outcomes (${outcomes.length})`, outcomes.map((o, i) => `${i + 1}. ${o}`).join("\n"),
      (d) => { d.course.outcomes = outcomes.slice(); }, { note: "Confirm they still match the SCTCC Course Outline." });

    const prereqBlocks = byKey("prereqs").flatMap((s) => s.blocks).filter((b) => b.type === "p" && clean(b.text));
    const prereqItems = [];
    let prereqIntro = "";
    let coreqs = "";
    prereqBlocks.forEach((block) => {
      const text = clean(block.text);
      if (/co-?requisite/i.test(text) && !/pre\/co|pre-?requisite/i.test(text)) coreqs = text.replace(/^co-?requisites?\s*:?\s*/i, "");
      else if (block.list || /^\d+[.)]\s/.test(text)) prereqItems.push(text.replace(/^\d+[.)]\s*/, ""));
      else if (!prereqIntro && /:\s*$/.test(text)) prereqIntro = text;
      else if (!/course outlines? (are|is) found/i.test(text)) prereqItems.push(text);
    });
    if (prereqItems.length === 1 && !prereqIntro && !coreqs) {
      const pair = /^([^/]{1,60})\/([^/]{1,60})$/.exec(prereqItems[0]);
      if (pair) {
        prereqItems[0] = pair[1].trim();
        coreqs = pair[2].trim();
      }
    }
    if (prereqIntro) propose("Description, outcomes, and requisites", "Prerequisite introduction", prereqIntro, (d) => { d.course.prerequisites.intro = prereqIntro; });
    if (prereqItems.length) propose("Description, outcomes, and requisites", "Prerequisites", prereqItems.join("\n"), (d) => { d.course.prerequisites.items = prereqItems.slice(); });
    if (coreqs) propose("Description, outcomes, and requisites", "Corequisites", coreqs, (d) => { d.course.corequisites = coreqs; });

    const mntcText = clean(byKey("mntc").flatMap((s) => s.blocks).map((b) => b.text || "").join(" "));
    const goal = /Goal\s+(?:Area\s+)?(\d{1,2}|[IVX]+)/i.exec(mntcText);
    if (goal && !/does not|doesn’t|n\/a/i.test(mntcText)) {
      propose("Description, outcomes, and requisites", "MnTC goal area (turns the section on)", goal[1], (d) => {
        d.course.mnTransferGoal = goal[1];
        d.optionalSections.mnTransferGoal = true;
      });
    }

    /* ----- Materials ----- */
    const listItems = (key) => byKey(key).flatMap((s) => s.blocks)
      .filter((b) => b.type === "p" && clean(b.text) && !isCollegeText(b.text))
      .map((b) => clean(b.text).replace(/^(\d+[.)]|[•·-])\s*/, ""))
      .filter((text) => !/^\(.*\)$/.test(text));
    const required = listItems("required");
    if (required.length) propose("Materials and technology", "Required materials", required.join("\n"), (d) => { d.materials.required = required.slice(); });
    const recommended = listItems("recommended");
    if (recommended.length) propose("Materials and technology", "Recommended materials", recommended.join("\n"), (d) => {
      d.materials.recommended = recommended.slice();
      d.optionalSections.recommendedMaterials = true;
    });
    const standardTech = /^(active sctcc email( account)?|internet access|microsoft (office|word)|free download)/i;
    const tech = listItems("requiredTech").filter((text) => !standardTech.test(text));
    if (tech.length) propose("Materials and technology", "Additional required technology", tech.join("\n"), (d) => { d.materials.requiredTechnologyAdditions = tech.slice(); });
    const skills = listItems("techSkills");
    if (skills.length) propose("Materials and technology", "Suggested technical skills", skills.join("\n"), (d) => { d.materials.technicalSkills = skills.slice(); });

    /* ----- Course policies ----- */
    const attendance = blocksToText(ownBlocks(byKey("attendance").flatMap((s) => s.blocks)));
    if (attendance) propose("Course policies", "Attendance", attendance, (d) => { d.policies.attendance = attendance; },
      { note: "The college’s first-week drop, administrative withdrawal, and student email text were left out; the builder adds the current college wording." });
    const late = blocksToText(ownBlocks(byKey("late").flatMap((s) => s.blocks)));
    if (late) propose("Course policies", "Late policy", late, (d) => { d.policies.lateWork = late; });

    const d2lText = clean(byKey("navigatingD2l").flatMap((s) => s.blocks).map((b) => b.text || "").join(" "));
    if (d2lText) collegeFound.add("Navigating D2L");
    const formats = /submissions?\b[^.]*?\bmust be (?:in|submitted in|submitted as)\s+(.+?)(?:\s+format)?\.(?:\s|$)/i.exec(d2lText);
    if (formats && !/^Microsoft Word or PDF$/i.test(formats[1].trim())) {
      const value = formats[1].trim();
      propose("Course policies", "Accepted file formats for D2L Assignments", value, (d) => { d.policies.acceptedFileFormats = value; });
    }

    if (byKey("college:academic-integrity").length) {
      const integrity = byKey("college:academic-integrity").flatMap((s) => s.blocks).map((b) => b.text || "").join(" ");
      if (/could involve/i.test(integrity)) {
        propose("Course policies", "Include examples of academic dishonesty", "Yes (the college list, ending with a zero for a first instance and an F for a second)",
          (d) => { d.optionalSections.academicIntegrityExamples = true; });
      }
    }
    if (byKey("college:turnitin").length) {
      propose("Course policies", "Include the Turnitin statement", "Yes (current college wording)", (d) => { d.optionalSections.turnitin = true; });
    }

    const environment = byKey("classEnvironment").flatMap((s) => s.blocks).filter((b) => b.type === "p" && clean(b.text));
    if (environment.length) {
      const text = blocksToText(environment);
      const sample = collegeSets.find((college) => college.id === "class-environment");
      const sameAsSample = sample && containment(text, sample.set) >= 0.97 && containment(sample.text, new Set(words(text))) >= 0.97;
      propose("Course policies", "Include a Class Environment section", "Yes", (d) => { d.optionalSections.classEnvironment = true; });
      if (!sameAsSample) {
        propose("Course policies", "Your Class Environment text", text, (d) => { d.policies.classEnvironment = text; },
          { note: "Your wording differs from the college sample. Keep it to use your version, or untick to use the college sample." });
      }
    }

    /* ----- Instructor-written sections without a place in the template ----- */
    sections.filter((section) => ["additional", "collegeUnknown", "oldCollege"].includes(section.key)).forEach((section) => {
      const text = blocksToText(ownBlocks(section.blocks));
      if (!text || !section.title) return;
      const fromCollegeArea = section.key !== "additional";
      const sampleLabel = /\(SAMPLE\)/i.test(section.rawTitle || "");
      propose("Additional course sections", section.title, text, (d) => {
        d.policies.additionalSections.push({ title: section.title, text });
      }, {
        checked: !fromCollegeArea && !sampleLabel,
        note: fromCollegeArea
          ? "This looks like older college wording and is not one of the current college sections. Include it only if it is your own statement."
          : (sampleLabel
            ? "This was labeled SAMPLE in the old template. Include it only if you use it."
            : "Shown as its own section under Course Policies & Procedures.")
      });
    });

    /* ----- Tools from Technical Support ----- */
    byKey("techSupport").flatMap((s) => s.blocks).forEach((block) => {
      const text = clean(block.text);
      if (!text || isCollegeText(text)) return;
      const url = /(https?:\/\/[^\s)]+)/.exec(text);
      if (!url) return;
      const collegeLine = /Computer Help Desk|Minnesota State IT|access D2L here|D2L training for students/i.test(text);
      if (collegeLine) return;
      const toolName = clean(text.slice(0, url.index).replace(/[(:–-]\s*$/, "").replace(/\b(support desk|support|help center|help)\b/ig, "")) || "Course tool";
      const supportUrl = url[1].replace(/[.,]$/, "");
      propose("Tools and vendors", `${toolName}: technical support link`, supportUrl, (d) => {
        d.vendors.push(Object.assign(window.SCTCC.createEmptyVendor(), { name: toolName, supportUrl }));
      }, { note: "Added as a tool. Add its accessibility statement and privacy policy under Tools and vendors." });
    });
    if (byKey("techSupport").length) collegeFound.add("Technical Support");

    /* ----- Grading ----- */
    const assignmentBlocks = byKey("assignments").flatMap((s) => s.blocks);
    const rowsFromLines = [];
    const introBlocks = [];
    assignmentBlocks.forEach((block) => {
      if (block.type === "table") {
        block.rows.forEach((row) => rowsFromLines.push(row.map(clean)));
      } else if (block.type === "p" && /\t/.test(block.text) && /\d/.test(block.text)) {
        rowsFromLines.push(block.text.split(/\t+/).map(clean).filter(Boolean));
      } else if (block.type === "p" && clean(block.text)) {
        if (!/^assessment\s*(points|percent)?/i.test(clean(block.text))) introBlocks.push(block);
      }
    });
    byKey("gradingContainer").forEach((section) => section.blocks.forEach((block) => {
      if (block.type === "table") block.rows.forEach((row) => rowsFromLines.push(row.map(clean)));
    }));
    const categories = [];
    let statedTotal = NaN;
    let weighted = false;
    rowsFromLines.forEach((cells) => {
      if (cells.length < 2) return;
      const nameCell = cells[0];
      if (/^(assessment|category|item)s?\b/i.test(nameCell) && !/\d/.test(cells.slice(1).join(""))) return;
      const valueText = cells.slice(1).join(" ");
      const points = /(\d[\d,]*(?:\.\d+)?)(?!\s*%)/.exec(valueText);
      const percent = /(\d+(?:\.\d+)?)\s*%/.exec(valueText);
      if (/^total/i.test(nameCell)) {
        if (points) statedTotal = toNumber(points[1]);
        return;
      }
      const atPattern = /\((\d+)\s*@\s*(\d+(?:\.\d+)?)\s*(?:points?|pts?)?(?:\s*each)?\)/i.exec(nameCell);
      const name = clean(nameCell.replace(/\(\s*\d+\s*@[^)]*\)/g, ""));
      if (!name) return;
      if (atPattern) {
        categories.push({ name, count: Number(atPattern[1]), pointsEach: Number(atPattern[2]), weight: percent ? Number(percent[1]) : 0, notes: "" });
      } else if (points) {
        categories.push({ name, count: 1, pointsEach: toNumber(points[1]), weight: percent ? Number(percent[1]) : 0, notes: "" });
      } else if (percent) {
        weighted = true;
        categories.push({ name, count: 0, pointsEach: 0, weight: Number(percent[1]), notes: "" });
      }
    });
    const intro = blocksToText(introBlocks.filter((b) => !isCollegeText(b.text)));
    if (intro) propose("Grading", "Assignments & points introduction", intro, (d) => { d.grading.intro = intro; });
    if (categories.length) {
      const method = weighted ? "weighted" : "points";
      const sum = categories.reduce((total, c) => total + c.count * c.pointsEach, 0);
      const preview = categories.map((c) => (method === "weighted"
        ? `${c.name}: ${c.weight}%`
        : (c.count > 1 ? `${c.name}: ${c.count} × ${c.pointsEach} = ${c.count * c.pointsEach} points` : `${c.name}: ${c.pointsEach} points`))).join("\n");
      let note = method === "points" && categories.every((c) => c.count === 1)
        ? "Each category was imported as one item worth its total points. Change the number of assignments and points each if you want them listed separately."
        : "";
      if (method === "points" && Number.isFinite(statedTotal) && statedTotal !== sum) {
        note += ` Your old syllabus said the total was ${statedTotal}, but the categories add up to ${sum}.`;
      }
      propose("Grading", `Grading categories (${categories.length}, ${method === "weighted" ? "percentage weights" : `${sum} points`})`, preview, (d) => {
        d.grading.calculationMethod = method;
        d.grading.categories = categories.map((c) => Object.assign({}, c));
      }, { note: note.trim() });
    } else if (assignmentBlocks.length) {
      notes.push("The grading table could not be read. Add your categories under Grading.");
    }

    const scaleText = byKey("scale").flatMap((s) => s.blocks).map((b) => (b.type === "table" ? b.rows.map((r) => r.join(" ")).join(" ") : b.text || "")).join(" ");
    const scale = [];
    const scalePattern = /\b([A-F][+-]?)\s*[=:]\s*(\d{1,3}(?:\.\d+)?)\s*%?\s*(?:-|–|—|to)\s*(\d{1,3}(?:\.\d+)?)\s*%?/g;
    let scaleMatch;
    while ((scaleMatch = scalePattern.exec(scaleText))) {
      scale.push({ label: scaleMatch[1], minPercent: Number(scaleMatch[2]), maxPercent: Number(scaleMatch[3]) });
    }
    const lowest = /\b([A-F][+-]?)\s*[=:]\s*(?:below\s+(\d{1,3})|(\d{1,3})\s*%?\s*(?:and|or)\s*(?:below|less|lower))/i.exec(scaleText);
    if (lowest && !scale.some((row) => row.label === lowest[1])) {
      const max = lowest[2] ? Number(lowest[2]) - 1 : Number(lowest[3]);
      scale.push({ label: lowest[1], minPercent: 0, maxPercent: max });
    }
    if (scale.length >= 2) {
      propose("Grading", "Grading scale", scale.map((r) => `${r.label}: ${r.minPercent}–${r.maxPercent}%`).join("\n"), (d) => {
        d.grading.scale = scale.map((r) => Object.assign({}, r));
      });
    }

    const gradeBlocks = ownBlocks(byKey("grades").flatMap((s) => s.blocks));
    const posted = [];
    const turnaround = [];
    const additional = [];
    gradeBlocks.forEach((block) => {
      const text = clean(block.text);
      if (/returned within|turnaround|graded (assignments|work) (returned|back)|expect to (have|receive) (your )?grade/i.test(text)) turnaround.push(block);
      else if (/D2L|Brightspace|grade ?book/i.test(text) && /grade/i.test(text) && !posted.length) posted.push(block);
      else additional.push(block);
    });
    [["Where grades are posted", posted, "postedWhere"], ["Grading turnaround", turnaround, "turnaround"], ["Additional grading information", additional, "additional"]]
      .forEach(([title, list, key]) => {
        const text = blocksToText(list);
        if (text) propose("Grading", title, text, (d) => { d.grading.gradesNarrative[key] = text; });
      });

    const timeText = blocksToText(ownBlocks(byKey("time").flatMap((s) => s.blocks)));
    if (timeText) propose("Grading", "Time commitment (turns the section on)", timeText, (d) => {
      d.grading.timeCommitment = timeText;
      d.optionalSections.timeCommitment = true;
    }, { note: "Check the hours if the credits changed." });

    /* ----- Calendar ----- */
    const calendarBlocks = [];
    for (const block of byKey("calendar").flatMap((s) => s.blocks)) {
      if (block.type === "p" && isFooter(block.text)) break;
      calendarBlocks.push(block);
    }
    const statement = blocksToText(calendarBlocks.filter((b) => b.type === "p" && clean(b.text) && !isCollegeText(b.text)
      && (words(b.text).length >= 4 || /[.!?]$/.test(clean(b.text)))));
    if (statement) propose("Course calendar", "Statement about the course schedule", statement, (d) => { d.calendar.locationStatement = statement; });

    const topics = [];
    calendarBlocks.filter((b) => b.type === "table").forEach((table) => {
      const header = (table.rows[0] || []).map((cell) => cell.toLowerCase());
      const find = (pattern) => header.findIndex((cell) => pattern.test(cell));
      const columns = {
        week: find(/week/),
        topic: find(/topic|content|module|subject|lesson/),
        preparation: find(/read|prep/),
        due: find(/due|assignment|assessment/),
        notes: find(/note/)
      };
      if (columns.topic < 0) return;
      table.rows.slice(1).forEach((row) => {
        const cell = (index) => (index >= 0 ? clean(row[index] || "") : "");
        const entry = { topic: cell(columns.topic), preparation: cell(columns.preparation), due: cell(columns.due), notes: cell(columns.notes) };
        if (!entry.topic && !entry.preparation && !entry.due) return;
        if (/^no class/i.test(entry.topic)) return; /* closures come from the college calendar now */
        topics.push(entry);
      });
    });
    if (topics.length) {
      propose("Course calendar", `Calendar topics (${topics.length})`, topics.slice(0, 8).map((t, i) => `${i + 1}. ${t.topic}${t.due ? ` — due: ${t.due}` : ""}`).join("\n") + (topics.length > 8 ? `\n… and ${topics.length - 8} more` : ""), (d) => {
        topics.forEach((topic) => d.calendar.entries.push(Object.assign(window.SCTCC.calendar.blankRow({ manual: true, pending: true }), topic)));
      }, { note: "Old dates are dropped. When you generate the new calendar, these topics are placed in order into the class meetings." });
    }

    /* ----- What was left out ----- */
    sections.forEach((section) => {
      if (section.key.startsWith("college:")) collegeFound.add(COLLEGE_TITLES[section.key.slice(8)] || section.title);
    });
    if (collegeFound.size) {
      skipped.push(`College sections (${Array.from(collegeFound).join(", ")}): the builder always uses the current college wording from the repository.`);
    }
    skipped.push("Mission statement, change notice, and footer: added automatically from the repository.");

    return {
      fileName: docx.fileName,
      items,
      photoCandidates,
      skipped,
      notes,
      foundSections: sections.length
    };
  }

  window.SCTCC.syllabusImport = Object.freeze({ analyze, splitSections, blocksToText, normalizeHeading });
})();
