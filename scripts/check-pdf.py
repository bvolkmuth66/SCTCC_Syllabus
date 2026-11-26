#!/usr/bin/env python3
"""
Basic accessibility check of a syllabus PDF (goal: PDF/UA-1).

Usage:  python3 scripts/check-pdf.py reports/sample-syllabus.pdf
Needs:  pip install pikepdf

Errors (exit code 1): the PDF is not tagged, has no structure tree, no document
language, no title, no tagged headings, a table without header cells, or a figure
without a text description.
Warnings: title not shown in the viewer window or reading like a file name, no
PDF/UA claim (Chrome does not add one), no bookmarks, skipped heading levels, links
without descriptions.

This is not a full PDF/UA validation. For that, use PAC (PDF Accessibility Checker)
or Acrobat Pro's Accessibility Check during the manual review
(docs/accessibility-checklist.md).
"""
import sys

import pikepdf


def name(value):
    return str(value).lstrip("/") if value is not None else ""


def walk(element, role_map, found, depth=0):
    """Collect structure element types, resolving custom roles."""
    if depth > 200 or not isinstance(element, pikepdf.Dictionary):
        return
    kind = name(element.get("/S"))
    if kind:
        kind = name(role_map.get("/" + kind, "/" + kind))
        found.append((kind, element))
    kids = element.get("/K")
    if kids is None:
        return
    if isinstance(kids, pikepdf.Array):
        for kid in kids:
            walk(kid, role_map, found, depth + 1)
    else:
        walk(kids, role_map, found, depth + 1)


def check(path):
    errors, warnings, notes = [], [], []
    pdf = pikepdf.open(path)
    root = pdf.Root

    mark_info = root.get("/MarkInfo")
    if not (mark_info and bool(mark_info.get("/Marked", False))):
        errors.append("The PDF is not marked as tagged (MarkInfo /Marked is not true).")

    tree = root.get("/StructTreeRoot")
    if tree is None:
        errors.append("The PDF has no structure tree (tags). Make the PDF with Chrome or Edge using the builder's Print to PDF button.")

    language = str(root.get("/Lang", "")).strip()
    if not language:
        errors.append("No document language is set (/Lang).")
    else:
        notes.append(f"Language: {language}")

    title = str(pdf.docinfo.get("/Title", "") or "").strip() if pdf.docinfo is not None else ""
    meta = pdf.open_metadata(set_pikepdf_as_editor=False, update_docinfo=False)
    if not title:
        title = str(meta.get("dc:title", "") or "").strip()
    if "pdfuaid" not in str(meta):
        warnings.append("The PDF does not claim PDF/UA conformance (no pdfuaid:part). Chrome does not add this; verify with PAC or Acrobat.")
    if not title:
        errors.append("The PDF has no title.")
    else:
        notes.append(f"Title: {title}")
        if " " not in title and "-" in title:
            warnings.append(f"The PDF title “{title}” reads like a file name. Screen readers and PDF viewers show the title, so a readable title (for example “ITEC 0000 Course Name Syllabus, Spring 2027”) is better.")

    preferences = root.get("/ViewerPreferences")
    if not (preferences and bool(preferences.get("/DisplayDocTitle", False))):
        warnings.append("The PDF viewer will show the file name instead of the title (DisplayDocTitle not set).")

    if root.get("/Outlines") is None:
        warnings.append("The PDF has no bookmarks.")

    if tree is not None:
        role_map = tree.get("/RoleMap", pikepdf.Dictionary())
        found = []
        walk(tree, role_map, found)
        kinds = [kind for kind, _ in found]
        headings = [kind for kind in kinds if kind == "H" or (kind.startswith("H") and kind[1:].isdigit())]
        if not headings:
            errors.append("No headings are tagged in the PDF.")
        else:
            levels = [int(kind[1:]) for kind in headings if kind[1:].isdigit()]
            notes.append(f"Headings tagged: {len(headings)} ({', '.join(sorted(set(headings)))})")
            previous = 0
            for level in levels:
                if previous and level > previous + 1:
                    warnings.append(f"A heading level is skipped (H{previous} followed by H{level}).")
                    break
                previous = level
            if levels and levels[0] != 1:
                warnings.append(f"The first tagged heading is H{levels[0]}, not H1.")

        tables = [element for kind, element in found if kind == "Table"]
        for index, table in enumerate(tables, start=1):
            inner = []
            walk(table, role_map, inner)
            if not any(kind == "TH" for kind, _ in inner):
                errors.append(f"Table {index} has no header cells (TH).")
        notes.append(f"Tables tagged: {len(tables)}")

        figures = [element for kind, element in found if kind == "Figure"]
        missing_alt = [element for element in figures if not str(element.get("/Alt", "")).strip()
                       and not str(element.get("/ActualText", "")).strip()]
        if missing_alt:
            errors.append(f"{len(missing_alt)} of {len(figures)} figure(s) have no text description (Alt).")
        notes.append(f"Figures tagged: {len(figures)}")

        notes.append(f"Lists tagged: {kinds.count('L')}")

    links = 0
    links_without_text = 0
    for page in pdf.pages:
        for annotation in page.get("/Annots", []) or []:
            if name(annotation.get("/Subtype")) == "Link":
                links += 1
                if not str(annotation.get("/Contents", "")).strip():
                    links_without_text += 1
    notes.append(f"Link annotations: {links}")
    if links_without_text:
        warnings.append(f"{links_without_text} of {links} link(s) have no description (/Contents). PDF/UA expects one; screen readers usually read the tagged link text instead.")

    notes.append(f"Pages: {len(pdf.pages)}")
    return errors, warnings, notes


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    errors, warnings, notes = check(sys.argv[1])
    print(f"PDF accessibility check: {sys.argv[1]}\n")
    for line in notes:
        print(f"  · {line}")
    print()
    for line in errors:
        print(f"ERROR    {line}")
    for line in warnings:
        print(f"WARNING  {line}")
    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s). Not a full PDF/UA validation; see docs/accessibility-checklist.md.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
