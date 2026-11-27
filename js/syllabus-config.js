/*
 * SCTCC Syllabus Builder — configuration
 * Settings only. No application logic belongs in this file.
 */
window.SCTCC = window.SCTCC || {};

window.SCTCC.config = Object.freeze({
  /*
   * Where the institutional content lives. The default is relative to index.html,
   * which works on GitHub Pages and on a local server. To load content from a
   * different GitHub Pages site, use its full URL, for example:
   *   "https://bvolkmuth66.github.io/SCTCC_Syllabus/content/"
   */
  contentBaseUrl: "./content/",
  manifestFile: "content-manifest.json",

  /* "instructor" shows the editor; "student" shows the finished syllabus. */
  mode: "instructor",

  /* Required sections can never be turned off through the normal interface. */
  allowRequiredSectionOverride: false,

  /*
   * Syllabi are never stored by the builder. Instructors save files to their own
   * computer or OneDrive. Earlier preview builds used browser storage under this
   * prefix; any such copies are erased when the builder opens.
   */
  legacyStoragePrefixes: ["sctcc-syllabus:"],
  previewDelayMs: 250,

  /* Number section headings (1, 1.1, 1.2, 2 …) in the preview, the PDF, and the contents list. */
  numberSections: true,

  /* Largest instructor photo file accepted for upload, in bytes (300 KB). */
  maxPhotoBytes: 300 * 1024,

  /*
   * College logo. Replace the placeholder with the official file supplied by
   * SCTCC Marketing & Communications (sctcc.edu/media), then set isPlaceholder to false.
   * The preferred version is the 3-color logo with "A member of Minnesota State".
   */
  logo: {
    /*
     * INTERIM (2026-11-26): the logo image from the SCTCC Word syllabus template
     * (262 x 215 pixels). Replace it with Marketing's file (SVG preferred), then set
     * isInterim to false. The placeholder file is kept in assets/ for reference.
     */
    src: "assets/sctcc-logo-interim.jpg",
    alt: "Placeholder for the official SCTCC logo",
    isPlaceholder: false,
    isInterim: true,
    officialAlt: "St. Cloud Technical & Community College, a member of Minnesota State"
  },

  /*
   * Beta test feedback form (Microsoft Forms, SCTCC sign-in). Shown as "Report a problem
   * or idea" in the toolbar. Set to "" after the beta test to remove the button.
   */
  feedbackFormUrl: "https://forms.cloud.microsoft/r/NgnJYyNESx",

  /* Print the full web address after each link in the PDF. Off keeps the PDF compact. */
  printLinkUrls: false,

  institutionName: "St. Cloud Technical & Community College",
  institutionShortName: "SCTCC"
});
