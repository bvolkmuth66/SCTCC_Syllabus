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

  /* "instructor" shows builder controls; "student" shows the finished syllabus. */
  mode: "instructor",

  /* Required sections can never be turned off through the normal interface. */
  allowRequiredSectionOverride: false,

  /*
   * Phase 1 preview: show the sample course from examples/sample-course-data.js.
   * Phase 2 replaces this with the instructor editor, autosave, and JSON import.
   */
  loadSampleData: true,

  /*
   * College logo. Replace the placeholder with the official file supplied by
   * SCTCC Marketing & Communications (sctcc.edu/media), then set isPlaceholder to false.
   * The preferred version is the 3-color logo with "A member of Minnesota State".
   */
  logo: {
    src: "assets/sctcc-logo-placeholder.svg",
    alt: "Placeholder for the official SCTCC logo",
    isPlaceholder: true,
    officialAlt: "St. Cloud Technical & Community College, a member of Minnesota State"
  },

  /* Print the full web address after each link in the PDF. Off keeps the PDF compact. */
  printLinkUrls: false,

  institutionName: "St. Cloud Technical & Community College",
  institutionShortName: "SCTCC"
});
