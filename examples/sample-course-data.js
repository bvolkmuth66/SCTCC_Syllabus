/*
 * SAMPLE COURSE DATA — for previewing the template only.
 * Every value here is invented for demonstration. It is not an SCTCC course,
 * instructor, or schedule. Real syllabi must use the official SCTCC Course Outline.
 */
window.SCTCC_SAMPLE_DATA = {
  schemaVersion: "1.1",
  meta: {
    syllabusVersion: "1.0",
    lastRevised: "2027-01-04"
  },
  course: {
    prefix: "ITEC",
    number: "0000",
    title: "Sample Course (Template Preview)",
    term: "Spring",
    year: "2027",
    credits: { total: 3, lecture: 2, laboratory: 1, soe: 0 },
    modality: "hybrid",
    modalityNote: "The lecture component of this course is online with pre-recorded lectures.",
    location: "1-000",
    startDate: "2027-01-11",
    endDate: "2027-05-14",
    dropDate: "2027-01-15",
    withdrawalDate: "2027-04-02",
    meetingPattern: { meetingsPerWeek: 2, days: ["Monday", "Wednesday"], startTime: "09:00", endTime: "10:50" },
    courseLogin: "",
    prerequisites: {
      intro: "This course requires any of these 2 prerequisite categories:",
      items: [
        "Sample prerequisite course with a grade of C or better",
        "Instructor permission"
      ]
    },
    corequisites: "",
    description: "This sample description stands in for the course description copied from eServices and the SCTCC Course Outline.",
    outcomes: [
      "Sample outcome one, copied from the SCTCC Course Outline",
      "Sample outcome two, copied from the SCTCC Course Outline",
      "Sample outcome three, copied from the SCTCC Course Outline"
    ],
    mnTransferGoal: ""
  },
  instructor: {
    name: "Sample Instructor",
    credentials: "M.S.",
    email: "instructor@example.edu",
    phone: "320-000-0000",
    office: "Room 1-000 (residential) and virtual by appointment",
    officeHours: "Mondays and Wednesdays, 11:00 a.m.–12:00 p.m.\nOther times by appointment",
    preferredContactMethod: "email",
    responseTime: "You can expect a response to email questions within 24 hours Mondays–Thursdays.",
    biography: "This sample biography shows where an instructor can introduce themselves.",
    philosophy: "This sample statement shows where an instructor can describe their educational philosophy.",
    photoUrl: "",
    photoAlt: ""
  },
  materials: {
    required: [
      "Sample textbook title, edition, publisher (ISBN 000-0-00-000000-0)",
      "Sample lab software license (provided through D2L)"
    ],
    recommended: [
      "Sample study guide (optional)"
    ],
    requiredTechnologyAdditions: [
      "Webcam and microphone for virtual office hours"
    ],
    technicalSkills: [
      "Basic computer and file-management skills",
      "Comfort navigating websites and D2L Brightspace"
    ]
  },
  policies: {
    attendance: "Please see me or send me an email with any attendance-related issues throughout the semester.",
    lateWork: "Late work is not accepted. Extra time for illness or similar circumstances must be requested before the due date."
  },
  grading: {
    calculationMethod: "points",
    intro: "This sample course has 15 weeks of instruction. Assessments for the course include weekly labs, quizzes, a midterm exam, a final exam, and a final project.",
    categories: [
      { name: "Labs", count: 10, pointsEach: 20, weight: 0, notes: "" },
      { name: "Quizzes", count: 5, pointsEach: 20, weight: 0, notes: "" },
      { name: "Midterm Exam", count: 1, pointsEach: 100, weight: 0, notes: "" },
      { name: "Final Exam", count: 1, pointsEach: 100, weight: 0, notes: "Taken during final exam week" },
      { name: "Final Project", count: 1, pointsEach: 100, weight: 0, notes: "Requirements and rubric are posted in D2L" }
    ],
    scale: [
      { label: "A", minPercent: 90, maxPercent: 100 },
      { label: "B", minPercent: 80, maxPercent: 89 },
      { label: "C", minPercent: 70, maxPercent: 79 },
      { label: "D", minPercent: 60, maxPercent: 69 },
      { label: "F", minPercent: 0, maxPercent: 59 }
    ],
    gradesNarrative: {
      postedWhere: "You can check your grade through D2L Brightspace Grades at any point during the semester. If you have any questions, please contact me immediately.",
      turnaround: "You can expect to have graded assignments returned within 5 days of the due date of the assignment.",
      contact: "",
      additional: "Your grade will reflect how well you have mastered the material, not how hard you have worked."
    },
    timeCommitment: "You should expect to spend two hours outside of class for each hour of lecture and one hour outside of class for each hour of lab. For this course, that means a total expectation of 6 hours per week outside of the classroom. If you do not feel you can fulfill this expectation, you should consider whether this class best fits this term for you."
  },
  calendar: {
    locationStatement: "The first three weeks are shown below. The complete, current schedule is posted in D2L under Content > Course Schedule.",
    startDate: "2027-01-11",
    endDate: "2027-05-14",
    meetingsPerWeek: 2,
    meetingDays: ["Monday", "Wednesday"],
    excludedDates: ["2027-01-18"],
    entries: [
      { week: 1, meeting: 1, date: "2027-01-11", topic: "Course introduction", preparation: "Read the syllabus", due: "", notes: "", noClass: false },
      { week: 1, meeting: 2, date: "2027-01-13", topic: "Sample topic 1", preparation: "Chapter 1", due: "Introduction discussion", notes: "", noClass: false },
      { week: 2, meeting: 3, date: "2027-01-18", topic: "", preparation: "", due: "", notes: "Martin Luther King Jr. Day (sample closure)", noClass: true },
      { week: 2, meeting: 4, date: "2027-01-20", topic: "Sample topic 2", preparation: "Chapter 2", due: "Lab 1", notes: "", noClass: false },
      { week: 3, meeting: 5, date: "2027-01-25", topic: "Sample topic 3", preparation: "Chapter 3", due: "Quiz 1", notes: "", noClass: false },
      { week: 3, meeting: 6, date: "2027-01-27", topic: "Sample topic 3, continued", preparation: "", due: "Lab 2", notes: "", noClass: false }
    ]
  },
  vendors: [],
  optionalSections: {
    instructorPhoto: false,
    instructorBiography: true,
    educationalPhilosophy: false,
    courseLogin: false,
    mnTransferGoal: false,
    turnitin: false,
    classEnvironment: false,
    academicIntegrityExamples: false,
    timeCommitment: true,
    recommendedMaterials: true
  }
};
