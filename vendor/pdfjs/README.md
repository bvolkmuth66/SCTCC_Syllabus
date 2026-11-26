# Mozilla PDF.js (third-party)

- **Version:** 6.2.108 (`pdfjs-dist` package, modern build)
- **Files:** `pdf.min.mjs`, `pdf.worker.min.mjs` — unmodified
- **License:** Apache License 2.0 (see `LICENSE` in this folder). Copyright Mozilla Foundation.
- **Source:** https://github.com/mozilla/pdf.js
- **Used by:** `js/pdf-reader.js`, only when an instructor imports a PDF syllabus. The file is read in the browser; nothing is uploaded.
- **Hardening:** opened with `isEvalSupported: false`, `disableFontFace: true`, and `enableXfa: false`; only text is extracted, pages are never drawn.

SHA-256:
```
e0be3863c23c8af2305b16548febd58e7f8874a460253317d7771cddbc1c0f6d  pdf.min.mjs
0613f41490dd6aaceed7a93fbbd38c85e6d6aa60474b6588c6e7709cfbe18cb3  pdf.worker.min.mjs
```

**Updating:** replace both files with the same version's `build/pdf.min.mjs` and `build/pdf.worker.min.mjs` from the `pdfjs-dist` npm package, update the version and hashes above, and test a PDF import. Check Mozilla's security advisories when updating.
