export type DocBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'note'; title: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'flow'; title?: string; steps: string[] }
  | { type: 'checklist'; items: string[] }
  | { type: 'tip'; title: string; text: string };

export type DocSection = {
  id: string;
  title: string;
  summary?: string;
  tags?: string[];
  blocks: DocBlock[];
  subsections?: DocSection[];
};

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  sections: DocSection[];
  related?: string[];
};

export type DocNavGroup = {
  title: string;
  pages: string[];
};

// Phase 6 style note: public docs should stay plain-language and user-facing.
// Keep internal field names, service names, DTOs, and database details in the TDD.
export const docsPages: DocPage[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Set up EduVerse, understand school workspaces, and learn how the dashboard is organized.',
    category: 'Basics',
    tags: ['setup', 'dashboard', 'organization', 'workspace'],
    related: ['roles-permissions', 'dashboard-insights', 'settings'],
    sections: [
      {
        id: 'school-workspace',
        title: 'School workspace',
        summary: 'EduVerse separates platform administration from organization workspaces.',
        tags: ['school workspace', 'organization'],
        blocks: [
          {
            type: 'paragraph',
            text: 'EduVerse separates each school or institute into its own workspace. Platform administrators manage the overall platform, while organization users work inside their own school workspace.',
          },
          {
            type: 'list',
            items: [
              'Platform admins manage schools, platform staff, and platform activity.',
              'School staff manage one organization workspace at a time.',
              'Role permissions decide which modules a user can view or change inside that workspace.',
            ],
          },
        ],
      },
      {
        id: 'dashboard',
        title: 'Dashboard orientation',
        tags: ['navigation', 'overview'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The dashboard uses role-aware navigation. Org admins see operational management modules, teachers see teaching workflows, and students see their own learning, submission, timetable, and transcript views.',
          },
          {
            type: 'list',
            items: [
              'Use the sidebar for primary modules such as Students, Teachers, Sections, Timetable, Finance, Mail, and Settings.',
              'Use page headers for local actions such as create, export, save, or filter.',
              'Deep pages use breadcrumbs and back actions so users can return to their previous context.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'roles-permissions',
    title: 'Roles and Permissions',
    description: 'Understand who can view, create, update, delete, and finalize data.',
    category: 'Basics',
    tags: ['roles', 'permissions', 'access'],
    related: ['settings', 'academic-cycles', 'platform-admin'],
    sections: [
      {
        id: 'role-summary',
        title: 'Role summary',
        tags: ['org-admin', 'teacher', 'student'],
        blocks: [
          {
            type: 'list',
            items: [
              'Super Admin: platform-wide authority for the deployment.',
              'Platform Admin: manages organizations and platform-level administration.',
              'Org Admin: full administrative control inside one organization, including academic settings and GPA policies.',
              'Org Manager: operational management access where enabled, without full control over academic settings.',
              'Teacher: manages assigned sections, materials, assessments, attendance, submissions, and grading.',
              'Student: views enrolled sections, materials, assessments, grades, timetable, finance entries, and transcripts.',
            ],
          },
        ],
      },
      {
        id: 'write-boundaries',
        title: 'Write boundaries',
        tags: ['read-only', 'locked', 'finalized'],
        blocks: [
          {
            type: 'paragraph',
            text: 'EduVerse separates what users can see from what they can change. Some actions are limited by role, school status, or academic rules such as finalized grades.',
          },
          {
            type: 'note',
            title: 'Finalized academic data',
            text: 'When finalized grades exist for an academic cycle, the GPA policy assigned to that cycle cannot be changed. This preserves historical transcript calculations.',
          },
        ],
      },
    ],
  },
  {
    slug: 'glossary',
    title: 'Glossary',
    description: 'Short definitions for common EduVerse academic, finance, and communication terms.',
    category: 'Basics',
    tags: ['glossary', 'definitions', 'terms'],
    related: ['quick-start', 'courses-sections', 'gpa-policies', 'finance'],
    sections: [
      {
        id: 'academic-terms',
        title: 'Academic terms',
        tags: ['academic cycle', 'course', 'section', 'cohort'],
        blocks: [
          {
            type: 'table',
            headers: ['Term', 'Meaning'],
            rows: [
              ['Academic Cycle', 'A time period such as a semester, term, or academic year.'],
              ['Course', 'A subject such as Mathematics, Biology, or English.'],
              ['Section', 'The actual class students attend for a course in a specific cycle.'],
              ['Cohort', 'A group of students that usually move through the same academic period together.'],
              ['Enrollment', 'The connection that places a student into a cohort or section.'],
              ['Material', 'A file, link, or learning resource shared with a class.'],
              ['Attendance Record', 'A saved status showing whether a student attended a class activity.'],
            ],
          },
        ],
      },
      {
        id: 'grading-terms',
        title: 'Grading and transcript terms',
        tags: ['gpa', 'cgpa', 'grade points', 'transcript'],
        blocks: [
          {
            type: 'table',
            headers: ['Term', 'Meaning'],
            rows: [
              ['Assessment', 'A graded task such as an assignment, quiz, project, exam, or class activity.'],
              ['Gradebook', 'The place where teachers and admins review and enter marks.'],
              ['Published Grade', 'A grade students can see but that may still change.'],
              ['Finalized Grade', 'A grade treated as ready for official transcript use.'],
              ['Transcript', 'An academic record showing courses, marks, credit hours, GPA, and related results.'],
              ['Credit Hours', 'The academic weight of a course. Higher credit hours can give a course more influence in weighted GPA.'],
              ['Letter Grade', 'The letter result matched from marks, such as A, B, or F.'],
              ['Grade Points', 'The number value assigned to a letter grade.'],
              ['Quality Points', 'Grade points multiplied by credit hours.'],
              ['GPA', 'The grade point average for a selected academic period.'],
              ['CGPA', 'The cumulative grade point average across multiple periods.'],
              ['GPA Policy', 'The school rulebook for turning marks into letter grades, grade points, GPA, and CGPA.'],
            ],
          },
        ],
      },
      {
        id: 'finance-communication-terms',
        title: 'Finance and communication terms',
        tags: ['finance', 'payment claim', 'announcement'],
        blocks: [
          {
            type: 'table',
            headers: ['Term', 'Meaning'],
            rows: [
              ['Financial Structure', 'A reusable plan for a charge or expense, such as monthly tuition.'],
              ['Financial Entry', 'A specific payable amount created from a structure or finance action.'],
              ['Transaction', 'A confirmed payment or finance record tied to an entry.'],
              ['Payment Claim', 'A request saying a payment was made and needs staff verification.'],
              ['Announcement', 'A broad notice sent to a selected audience.'],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'students',
    title: 'Students',
    description: 'Manage student profiles, enrollment, cohorts, academic history, and portal visibility.',
    category: 'People',
    tags: ['students', 'enrollment', 'cohort', 'portal'],
    related: ['courses-sections', 'academic-cycles', 'cohorts-promotions', 'gradebook', 'fees', 'transcripts'],
    sections: [
      {
        id: 'student-records',
        title: 'Student records',
        tags: ['profile', 'status'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Student records combine account information, academic placement, cohort membership, enrollments, attendance, grades, submissions, finance entries, and transcript history.',
          },
          {
            type: 'list',
            items: [
              'Active students can be enrolled in sections and included in cohorts.',
              'Deleted or archived students remain relevant to historical records and should not be confused with transcript deletion.',
              'Student portal views are scoped to the signed-in student unless the user has a permitted administrative or teaching role.',
            ],
          },
        ],
      },
      {
        id: 'student-academic-placement',
        title: 'Academic placement',
        tags: ['cohort', 'sections', 'placement'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Academic placement decides where a student appears in class lists, attendance sheets, grade workspaces, timetable views, finance records, and transcripts.',
          },
          {
            type: 'list',
            items: [
              'Cohort placement is useful when a whole group should move through the same academic cycle together.',
              'Individual section placement is useful when one student needs a class outside their cohort setup.',
              'Changing placement can affect what the student sees in their portal, so review the cohort and section list before saving.',
            ],
          },
        ],
      },
      {
        id: 'enrollment-history',
        title: 'Enrollment history',
        tags: ['enrollment', 'history'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Enrollment history allows transcripts and academic reports to show where a student studied during each academic cycle, even after promotions or section changes.',
          },
          {
            type: 'list',
            items: [
              'Use cohort placement for the normal class group.',
              'Use individual section placement for exceptions, transfers, or extra classes.',
              'Avoid removing historical context just to clean up a current view; old enrollment data may explain transcript and attendance history.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'teachers',
    title: 'Teachers',
    description: 'Assign teachers to sections, schedules, assessments, and grading workflows.',
    category: 'People',
    tags: ['teachers', 'sections', 'grading', 'notifications'],
    related: ['courses-sections', 'assessments-grading', 'timetable'],
    sections: [
      {
        id: 'teacher-assignments',
        title: 'Teacher assignments',
        tags: ['assigned teacher', 'section teacher'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Admins assign teachers to sections. Those assignments decide which classes a teacher can work with and which teachers can be chosen for class schedules.',
          },
          {
            type: 'list',
            items: [
              'A section can have more than one teacher.',
              'Each schedule has one selected teacher.',
              'Teachers only see the timetable slots assigned to them.',
            ],
          },
          {
            type: 'note',
            title: 'Before removing a teacher',
            text: 'Check whether the teacher is still responsible for schedules, assessments, or grading in that section. Removing the assignment can change what the teacher can access.',
          },
        ],
      },
      {
        id: 'teacher-notifications',
        title: 'Teacher notifications',
        tags: ['submission', 'missing', 'grading reminder'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Assessment notifications for teachers go to the teacher who created the assessment. Student notifications continue to follow the normal student flow.',
          },
        ],
      },
    ],
  },
  {
    slug: 'courses-sections',
    title: 'Courses and Sections',
    description: 'Understand course credit hours, section creation, safe colors, enrollments, teachers, and materials.',
    category: 'Academics',
    tags: ['courses', 'sections', 'credit hours', 'materials'],
    related: ['teachers', 'materials', 'gpa-policies', 'gradebook'],
    sections: [
      {
        id: 'core-academic-terms',
        title: 'Core academic terms',
        tags: ['course', 'section', 'cohort', 'enrollment'],
        blocks: [
          {
            type: 'table',
            headers: ['Term', 'Plain meaning'],
            rows: [
              ['Course', 'The subject, such as Mathematics or Biology.'],
              ['Section', 'The actual class students attend for a course in a specific academic period.'],
              ['Cohort', 'A group of students that usually move through the same academic period together.'],
              ['Enrollment', 'The connection that places a student into a section or cohort.'],
            ],
          },
        ],
      },
      {
        id: 'course-records',
        title: 'Course records',
        tags: ['course name', 'description'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A course is the subject record that sections are built from. Users normally create the course once, then create one or more sections for specific cycles, teachers, rooms, and students.',
          },
          {
            type: 'list',
            items: [
              'Use a clear course name because it appears in sections, grades, materials, schedules, and transcripts.',
              'Use the description for short internal context, not long policy text.',
              'Do not create duplicate courses for different class groups; create separate sections under the same course instead.',
            ],
          },
        ],
      },
      {
        id: 'course-credit-hours',
        title: 'Course credit hours',
        tags: ['credit hours', 'gpa', 'transcript'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Credit hours describe how much academic weight a course carries. They appear on transcripts and can affect GPA when the selected GPA policy uses credit-hour weighting.',
          },
          {
            type: 'list',
            items: [
              'The default credit value is 3, but admins can choose another positive number when the course needs a different weight.',
              'A higher credit value gives that course more influence in weighted GPA policies.',
              'Changing credit hours can affect future transcript calculations that use the current course value, so review the course before saving.',
            ],
          },
        ],
      },
      {
        id: 'section-records',
        title: 'Section records',
        tags: ['section', 'course', 'cycle'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A section is the actual class group students and teachers work inside. It connects a course to an academic cycle, teachers, students, schedules, attendance, materials, assessments, and grades.',
          },
          {
            type: 'list',
            items: [
              'Create a new section when the same course is taught to a different group, cycle, teacher, or schedule.',
              'Use the room field when the class has a regular location.',
              'Open the section detail page to manage schedules, materials, assessments, attendance, and enrollment.',
            ],
          },
        ],
      },
      {
        id: 'section-creation',
        title: 'Section creation',
        tags: ['create section', 'teachers', 'students'],
        blocks: [
          {
            type: 'paragraph',
            text: 'When creating a section, review the selected course, academic cycle, teachers, and students together. A wrong selection can put the class in the wrong cycle or make it visible to the wrong users.',
          },
          {
            type: 'list',
            items: [
              'Assign teachers who should manage the class work.',
              'Assign students directly when this section is an exception or independent class.',
              'Use cohorts when a whole student group should share the same sections.',
            ],
          },
          {
            type: 'table',
            headers: ['Use this', 'When it fits best'],
            rows: [
              ['Cohort enrollment', 'A whole group shares the same classes and usually moves together.'],
              ['Individual enrollment', 'One student needs an exception, transfer, extra class, or special placement.'],
              ['Both together', 'Most students follow the cohort, but a few students need individual exceptions.'],
            ],
          },
        ],
      },
      {
        id: 'section-colors',
        title: 'Section colors',
        tags: ['safe color', 'labels'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Section colors help users recognize classes quickly across schedules, timetables, lists, and cards. EduVerse uses a predefined safe palette so labels stay readable in light and dark themes.',
          },
          {
            type: 'note',
            title: 'Why custom colors are limited',
            text: 'Very bright or very dark custom colors can make text hard to read. Safe colors keep the interface usable for students, teachers, and admins.',
          },
        ],
      },
    ],
  },
  {
    slug: 'materials',
    title: 'Materials',
    description: 'Publish course materials with clear creator attribution.',
    category: 'Academics',
    tags: ['materials', 'files', 'creator'],
    related: ['courses-sections', 'teachers', 'students', 'files-attachments'],
    sections: [
      {
        id: 'material-attribution',
        title: 'Material attribution',
        tags: ['added by', 'creator'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Materials remember who added them. Teacher and student views can show a small note such as "Added by John Smith" when that information is available.',
          },
          {
            type: 'note',
            title: 'Historical records',
            text: 'Older materials may not show who added them. They should still open and display normally.',
          },
        ],
      },
    ],
  },
  {
    slug: 'assessments-grading',
    title: 'Assessments and Grading',
    description: 'Create assessments, collect submissions, grade safely, and understand finalization rules.',
    category: 'Academics',
    tags: ['assessments', 'grading', 'submissions', 'finalized grades'],
    related: ['gpa-policies', 'gradebook', 'transcripts', 'teachers', 'submissions'],
    sections: [
      {
        id: 'assessment-ownership',
        title: 'Assessment ownership',
        tags: ['created by', 'notifications'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Assessments remember who created them. Teacher and student views can show a small note such as "Created by John Smith" when that information is available.',
          },
          {
            type: 'list',
            items: [
              'Submission received notifications go to the assessment creator.',
              'Missing submission notifications go to the assessment creator.',
              'Overdue grading reminders go to the assessment creator.',
              'All-students-submitted notifications go to the assessment creator.',
            ],
          },
        ],
      },
      {
        id: 'assessment-setup',
        title: 'Assessment setup',
        tags: ['total marks', 'weightage', 'due date'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Assessment setup controls how work is collected and how marks contribute to the class result. Review total marks, weightage, due date, attachments, links, and submission settings before saving.',
          },
          {
            type: 'list',
            items: [
              'Total marks define the maximum score a student can receive.',
              'Weightage controls how much the assessment contributes to the course percentage.',
              'The due date helps students understand when work is expected and helps teachers track late or missing work.',
              'Submissions should be enabled when students need to upload a file, paste a link, or write a response.',
            ],
          },
          {
            type: 'checklist',
            items: [
              'The assessment is attached to the correct section',
              'Total marks match the actual assessment',
              'Weightage matches the course grading plan',
              'The due date is visible and realistic for students',
              'Submission settings match how students are expected to turn in work',
            ],
          },
        ],
      },
      {
        id: 'grade-input-rules',
        title: 'Grade input rules',
        tags: ['zero grade', 'minimum grade', 'rounding'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Grades allow an exact 0 for missing work, cheating, or administrative decisions. Non-zero grades must be at least 0.5 and are rounded to one decimal place to avoid tiny decimal values that render incorrectly in portals.',
          },
          {
            type: 'note',
            title: 'Do not fail silently',
            text: 'When a grade violates the minimum rule, forms should show a one-line validation error instead of quietly changing or dropping the value.',
          },
          {
            type: 'table',
            headers: ['Input', 'Allowed?', 'Why'],
            rows: [
              ['0', 'Yes', 'Used for missing work, cheating decisions, or no-credit outcomes.'],
              ['0.1 to 0.4', 'No', 'Tiny non-zero grades display poorly and are not useful for realistic grading.'],
              ['0.5 or higher', 'Yes', 'Accepted and rounded to one decimal place.'],
              ['More than total marks', 'No', 'A score cannot exceed the assessment maximum.'],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'gpa-policies',
    title: 'GPA Policies',
    description: 'Define organization GPA scales, grade boundaries, rounding, defaults, and transcript rules.',
    category: 'Academic Settings',
    tags: ['gpa', 'cgpa', 'grade rules', 'credit hours', 'academic settings'],
    related: ['academic-cycles', 'transcripts', 'courses-sections'],
    sections: [
      {
        id: 'policy-basics',
        title: 'Policy basics',
        tags: ['scale', 'rounding', 'method'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A GPA policy is the school rulebook for turning marks into letter grades, grade points, GPA, and CGPA. Org admins can create multiple policies, select one default policy, and preview calculations before saving.',
          },
          {
            type: 'list',
            items: [
              'Scale defines the maximum grade point value, such as 4.0 or 10.0.',
              'Method can be simple average or weighted by course credit hours.',
              'Rounding can be none, one decimal, or two decimals.',
              'Grade rules map mark ranges from 0 to 100 to letter grades and grade points.',
            ],
          },
          {
            type: 'note',
            title: 'Multiple policies',
            text: 'You can keep more than one policy when your institute changes grading rules over time. The default policy is the one used when a cycle does not have a specific policy selected.',
          },
          {
            type: 'table',
            headers: ['Setting', 'What it changes', 'When to review it'],
            rows: [
              ['Scale', 'The highest grade point a student can earn, such as 4.0 or 10.0.', 'Before a new term starts or when the institute changes grading rules.'],
              ['Method', 'Whether GPA averages all courses equally or gives higher-credit courses more weight.', 'Before transcripts are generated for a cycle.'],
              ['Rounding', 'How many decimals appear in GPA and CGPA results.', 'When official report formatting is decided.'],
              ['Grade rules', 'Which marks receive each letter and grade point.', 'Any time the grading boundary table changes.'],
            ],
          },
          {
            type: 'table',
            headers: ['Choose', 'Use when'],
            rows: [
              ['Simple average', 'Every course should contribute equally to GPA.'],
              ['Weighted by credit hours', 'Courses with more credit hours should influence GPA more.'],
              ['No rounding', 'The school wants the exact calculated value.'],
              ['One or two decimals', 'Reports should use a consistent official display format.'],
            ],
          },
        ],
      },
      {
        id: 'policy-preview',
        title: 'Preview calculator',
        tags: ['preview', 'calculator'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The preview calculator lets admins test sample marks and credit hours before saving a policy. Use it to confirm that letters, grade points, simple GPA, and weighted GPA behave as expected.',
          },
          {
            type: 'list',
            items: [
              'Try marks near each boundary, such as 84.9 and 85, to confirm the correct letter appears.',
              'Try different credit hours when the policy is weighted by credit hours.',
              'Fix validation errors before relying on preview results.',
            ],
          },
        ],
      },
      {
        id: 'grade-rule-validation',
        title: 'Grade rule validation',
        tags: ['overlap', 'missing range', 'max rules'],
        blocks: [
          {
            type: 'list',
            items: [
              'Rules must cover the full 0-100 mark range without gaps.',
              'Ranges cannot overlap.',
              'Grade points cannot go down as marks go up.',
              'Rule points must stay between 0 and the policy scale.',
              'A policy can have up to 20 grade rules.',
              'Custom formulas are not supported. Use clear mark ranges and grade points instead.',
            ],
          },
          {
            type: 'tip',
            title: 'Build from top to bottom',
            text: 'Keep the highest mark range at the top and work downward. This makes it easier to notice gaps, duplicated ranges, and grade points that move in the wrong direction.',
          },
        ],
      },
      {
        id: 'policy-locking',
        title: 'Policy locking on cycles',
        tags: ['locked', 'finalized grades', 'history'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Academic cycles store the GPA policy selected for that cycle. Once finalized grades are pushed by any teacher for that cycle, the selected policy cannot be changed.',
          },
          {
            type: 'note',
            title: 'Proceed with caution',
            text: 'Choose the cycle GPA policy carefully. After finalized grades exist, EduVerse locks the policy to preserve transcript history.',
          },
          {
            type: 'list',
            items: [
              'Set the correct policy before teachers begin finalizing grades in the cycle.',
              'After finalized grades exist, the cycle policy is locked so old transcript results do not silently change later.',
              'Policies already used by past cycles should be archived instead of deleted, so historical records remain explainable.',
            ],
          },
          {
            type: 'flow',
            title: 'Safe policy flow',
            steps: ['Create policy', 'Preview boundaries', 'Save policy', 'Assign to cycle', 'Teachers finalize grades', 'Policy locks for that cycle'],
          },
        ],
      },
      {
        id: 'gpa-common-mistakes',
        title: 'Common mistakes',
        tags: ['mistakes', 'rules', 'locking'],
        blocks: [
          {
            type: 'list',
            items: [
              'Changing the default policy and expecting old finalized cycles to change.',
              'Leaving gaps in grade ranges, which can make some marks impossible to grade correctly.',
              'Setting higher marks to lower grade points than lower marks.',
              'Choosing weighted GPA before checking that course credit hours are correct.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'academic-cycles',
    title: 'Academic Cycles',
    description: 'Manage terms, cohorts, active cycles, copy-forward behavior, and GPA policy selection.',
    category: 'Academic Settings',
    tags: ['academic cycle', 'cohort', 'promotion', 'copy-forward'],
    related: ['gpa-policies', 'students', 'cohorts-promotions', 'transcripts'],
    sections: [
      {
        id: 'cycle-purpose',
        title: 'Cycle purpose',
        tags: ['term', 'session'],
        blocks: [
          {
            type: 'paragraph',
            text: 'An academic cycle is a time period such as a semester, term, or academic year. It groups the classes, enrollments, grades, attendance, and transcripts that belong to that period.',
          },
          {
            type: 'list',
            items: [
              'Create a cycle before creating cohorts or sections that belong to that period.',
              'Use clear names such as Fall 2026 or Academic Year 2026 so reports and transcripts are easy to read.',
              'Cycles help preserve history when students move from one period to the next.',
            ],
          },
          {
            type: 'flow',
            title: 'Cycle lifecycle',
            steps: ['Create cycle', 'Choose GPA policy', 'Create cohorts and sections', 'Run classes', 'Finalize grades', 'Generate transcripts', 'Promote students'],
          },
        ],
      },
      {
        id: 'active-cycle',
        title: 'Active cycle',
        tags: ['active', 'current cycle'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The active cycle is the period your school is currently working in. Making a cycle active can affect default filters and where users expect new academic work to appear.',
          },
          {
            type: 'note',
            title: 'Before activating',
            text: 'Check the cycle name, dates, and GPA policy before marking it active. Activating one cycle usually means the previous active cycle is no longer treated as current.',
          },
          {
            type: 'checklist',
            items: [
              'Cycle name and dates are correct',
              'The intended GPA policy is selected',
              'Courses and sections have been reviewed for this period',
              'Staff know this cycle will become the default working period',
            ],
          },
        ],
      },
      {
        id: 'gpa-policy-selection',
        title: 'GPA policy selection',
        tags: ['policy', 'history'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Each cycle can use a selected GPA policy. When no specific policy is selected at creation time, the organization default policy is used.',
          },
          {
            type: 'list',
            items: [
              'Select the policy that should apply to grades finalized in this cycle.',
              'Use the default only when it matches the institute rules for this cycle.',
              'Changing the default policy later does not mean old cycles should silently follow the new policy.',
            ],
          },
          {
            type: 'note',
            title: 'Policy change lock',
            text: 'Once finalized grades are pushed in the cycle, the policy cannot be changed. This prevents old transcripts from being recalculated under a newer policy.',
          },
          {
            type: 'table',
            headers: ['Cycle state', 'Can policy change?', 'Recommended action'],
            rows: [
              ['No finalized grades yet', 'Yes', 'Review and change the selected policy before teachers finalize grades.'],
              ['Some grades finalized', 'No', 'Keep the policy as-is and correct future cycles with a new policy if needed.'],
              ['Past cycle', 'No, if grades were finalized', 'Archive old policies instead of deleting them when they explain historical transcripts.'],
            ],
          },
        ],
      },
      {
        id: 'copy-forward',
        title: 'Copy-forward',
        tags: ['copy schedules', 'copy assessments', 'copy materials'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Copy-forward helps admins carry selected academic setup from one cycle into another. It can copy sections and optionally include schedules, assessments, and materials depending on the operation.',
          },
          {
            type: 'table',
            headers: ['Use copy-forward when', 'Avoid it when'],
            rows: [
              ['The new cycle has a similar class structure.', 'Teachers, rooms, times, or assessments will be completely different.'],
              ['You want a faster starting point that staff will still review.', 'You need a clean reset with no old setup carried forward.'],
              ['Materials or schedules mostly repeat.', 'Old dates or instructions could confuse students.'],
            ],
          },
        ],
      },
      {
        id: 'cycle-common-mistakes',
        title: 'Common mistakes',
        tags: ['mistakes', 'setup'],
        blocks: [
          {
            type: 'list',
            items: [
              'Activating a cycle before reviewing its GPA policy.',
              'Creating sections in the wrong cycle and later wondering why students cannot see them.',
              'Using copy-forward without reviewing copied dates, rooms, teachers, and instructions.',
              'Changing setup after teachers have already started grading without telling staff.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'timetable',
    title: 'Timetable and Schedules',
    description: 'Create teacher-owned schedules and understand student and teacher timetable views.',
    category: 'Academics',
    tags: ['timetable', 'schedule', 'teacher', 'conflicts'],
    related: ['teachers', 'courses-sections', 'attendance'],
    sections: [
      {
        id: 'schedule-teacher',
        title: 'Schedule teacher',
        tags: ['teacher', 'assigned teacher'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Every schedule belongs to exactly one teacher. Admins must select a teacher assigned to the selected section when creating or editing a schedule.',
          },
          {
            type: 'list',
            items: [
              'Student timetables remain section-based and show schedules for enrolled sections.',
              'Teachers only see schedule slots assigned to them.',
              'The teacher name shown on a timetable slot is the teacher selected for that slot.',
            ],
          },
        ],
      },
      {
        id: 'weekday-repeat',
        title: 'Repeating weekday slots',
        tags: ['repeat', 'weekdays', 'bulk schedule'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Repeating a schedule Monday through Friday creates the same class time for each weekday. Use it only when the class truly meets at the same time and room every weekday.',
          },
          {
            type: 'list',
            items: [
              'Review the start time, end time, room, and selected teacher before saving the repeated slots.',
              'If one day has a different time or room, create that day separately instead of using the weekday repeat.',
              'Conflict checks still apply to repeated slots, so one busy day can prevent the schedule from saving.',
            ],
          },
          {
            type: 'table',
            headers: ['Use repeat when', 'Create separate slots when'],
            rows: [
              ['The class meets at the same time, room, and teacher on each selected weekday.', 'One day uses a different room, time, or teacher.'],
              ['The schedule pattern is stable for the cycle.', 'The class only meets once or has an irregular pattern.'],
            ],
          },
        ],
      },
      {
        id: 'conflicts',
        title: 'Conflict checks',
        tags: ['room conflict', 'teacher conflict'],
        blocks: [
          {
            type: 'paragraph',
            text: 'EduVerse checks for room, time, and teacher clashes before saving a schedule. If the selected teacher or room is already busy, the schedule should be corrected first.',
          },
          {
            type: 'list',
            items: [
              'A teacher should not be assigned to two class slots at the same time.',
              'A room should not be assigned to two class slots at the same time.',
              'End time must be later than start time.',
              'If a conflict appears, adjust the teacher, room, day, or time before trying again.',
            ],
          },
        ],
      },
      {
        id: 'timetable-common-mistakes',
        title: 'Common mistakes',
        tags: ['mistakes', 'conflicts'],
        blocks: [
          {
            type: 'list',
            items: [
              'Selecting a teacher who is not assigned to the section.',
              'Using weekday repeat when one day has a different room or time.',
              'Forgetting that teacher and room conflicts can block a whole repeated set.',
              'Expecting the time column to stay fixed while the timetable scrolls horizontally.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'attendance',
    title: 'Attendance',
    description: 'Record attendance against scheduled academic activity and review student attendance summaries.',
    category: 'Academics',
    tags: ['attendance', 'schedule', 'present', 'absent'],
    related: ['timetable', 'students', 'teachers'],
    sections: [
      {
        id: 'attendance-workflow',
        title: 'Attendance workflow',
        tags: ['sheet', 'records'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Attendance is recorded for class activity and becomes part of the student record. Teachers usually mark attendance for their assigned classes, while admins can review wider attendance coverage.',
          },
          {
            type: 'list',
            items: [
              'Use the attendance sheet to mark students as present, absent, late, or another available status.',
              'Review the selected date and class before saving attendance.',
              'Attendance summaries help identify students with repeated absence or weak attendance patterns.',
            ],
          },
          {
            type: 'note',
            title: 'Before saving',
            text: 'Check the section, date, and student list before saving. Attendance corrections are possible only where your role and school workflow allow them.',
          },
        ],
      },
      {
        id: 'attendance-history',
        title: 'Attendance history',
        tags: ['history', 'summary'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Attendance history helps staff and students understand attendance over time. It is useful for parent discussions, student support, and school reporting.',
          },
        ],
      },
    ],
  },
  {
    slug: 'gradebook',
    title: 'Gradebook',
    description: 'Review section grades, enter marks, use bulk grading, and understand grade visibility.',
    category: 'Academics',
    tags: ['grades', 'gradebook', 'marks', 'bulk grading'],
    related: ['assessments-grading', 'submissions', 'transcripts'],
    sections: [
      {
        id: 'grades-page',
        title: 'Grades page',
        tags: ['grades', 'sections'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The grades area helps teachers and admins find the right section and review assessment results. Students see their own grades from their portal.',
          },
          {
            type: 'list',
            items: [
              'Teachers should select the correct section before entering marks.',
              'Students only see grades that belong to their own enrollments.',
              'Transcript calculations use finalized grades where required by the transcript flow.',
            ],
          },
          {
            type: 'note',
            title: 'Finalizing grades',
            text: 'Finalized grades are treated as ready for official transcript use. Review the student, assessment, marks, and feedback before finalizing.',
          },
          {
            type: 'table',
            headers: ['State', 'Student visibility', 'Can still change?', 'Used on transcript?'],
            rows: [
              ['Draft', 'No', 'Yes', 'No'],
              ['Published', 'Yes', 'Yes', 'No'],
              ['Finalized', 'Yes', 'Usually no', 'Yes'],
            ],
          },
        ],
      },
      {
        id: 'bulk-grading',
        title: 'Bulk grading',
        tags: ['bulk grading', 'marks'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Bulk grading lets a teacher enter marks for many students from one place. It is faster for classroom work, but the same grade rules still apply.',
          },
          {
            type: 'note',
            title: 'Check before saving',
            text: 'Review student names and marks before saving bulk grades. A zero is allowed, but any non-zero mark must follow the minimum grade rule.',
          },
          {
            type: 'checklist',
            items: [
              'The selected section and assessment are correct',
              'Each mark belongs to the correct student row',
              'Zero grades are intentional',
              'Non-zero grades meet the minimum grade rule',
              'Feedback is suitable for students to see when grades are published',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'transcripts',
    title: 'Transcripts',
    description: 'Generate academic records with marks, percentages, letter grades, credit hours, GPA, and CGPA.',
    category: 'Academics',
    tags: ['transcript', 'gpa', 'cgpa', 'quality points', 'credit hours'],
    related: ['gpa-policies', 'academic-cycles', 'assessments-grading', 'gradebook'],
    sections: [
      {
        id: 'transcript-calculation',
        title: 'Transcript calculation',
        tags: ['finalized grades', 'percentage'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A transcript is the student academic record for a cycle or set of cycles. It uses finalized grades, assessment weights, course credit hours, and the GPA policy assigned to each academic cycle.',
          },
          {
            type: 'list',
            items: [
              'Raw percentage and final percentage are shown separately when both are available.',
              'Letter grade and grade points come from the cycle GPA policy.',
              'Quality points equal grade points multiplied by credit hours.',
              'Total credit hours should sum the displayed course credit hours for the transcript scope.',
              'CGPA is calculated cumulatively across returned transcript cycles.',
            ],
          },
          {
            type: 'note',
            title: 'Why finalized grades matter',
            text: 'Draft and Published grades can still change. Finalized grades are the ones treated as ready for official transcript calculation.',
          },
        ],
      },
      {
        id: 'transcript-columns',
        title: 'Transcript columns',
        tags: ['grade points', 'quality points'],
        blocks: [
          {
            type: 'table',
            headers: ['Column', 'Plain meaning'],
            rows: [
              ['Course Name', 'The course attached to the section.'],
              ['Credit Hours', 'The course weight used when GPA is weighted.'],
              ['Marks/Percentage', 'The student performance result for the course.'],
              ['Letter Grade', 'The letter matched from the cycle GPA policy.'],
              ['Grade Points', 'The number value for the matched letter grade.'],
              ['Quality Points', 'Grade points multiplied by credit hours.'],
            ],
          },
        ],
      },
      {
        id: 'transcript-common-mistakes',
        title: 'Common mistakes',
        tags: ['mistakes', 'finalized grades'],
        blocks: [
          {
            type: 'list',
            items: [
              'Expecting draft or published grades to appear on official transcripts.',
              'Changing the default GPA policy and expecting old finalized cycles to recalculate.',
              'Forgetting that total credit hours should add up across the displayed courses.',
              'Reading quality points as a separate grade instead of grade points multiplied by credit hours.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'finance',
    title: 'Finance',
    description: 'Manage fee structures, entries, payment claims, verification, and transaction history.',
    category: 'Operations',
    tags: ['finance', 'fee', 'structure', 'payment', 'transaction'],
    related: ['students', 'roles-permissions', 'fees'],
    sections: [
      {
        id: 'finance-structures',
        title: 'Finance structures',
        tags: ['amount', 'billing cycle'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Finance structures define reusable recurring or one-time templates, such as tuition, admission fees, salaries, vendor expenses, or other school-defined amounts.',
          },
          {
            type: 'tip',
            title: 'Plain meaning',
            text: 'A financial structure is the plan for a charge or expense. A financial entry is the actual amount due for a person or target after that plan is applied.',
          },
          {
            type: 'list',
            items: [
              'A structure is created once, then assigned to students, teachers, sections, cohorts, courses, or another income/expense entity.',
              'Student structures use student-facing income categories; teacher structures use teacher-facing expense categories.',
              'Generated entries track payment state separately from the structure definition.',
              'Timed entries generated by the finance scheduler create in-app notifications and web push notifications when push is enabled.',
              'Payment processing is recorded inside EduVerse, but external payment gateway integration is outside the current scope.',
            ],
          },
          {
            type: 'note',
            title: 'Before creating a structure',
            text: 'Check the target type, assignment scope, amount, category, billing cycle, due day, and start date. The structure is the plan; assignments decide who or what receives generated entries.',
          },
          {
            type: 'table',
            headers: ['Item', 'What it means', 'Common mistake'],
            rows: [
              ['Structure', 'The reusable billing or expense template.', 'Creating a separate structure for every student when one assigned structure is enough.'],
              ['Assignment', 'The student, teacher, group, course, or entity attached to the structure.', 'Forgetting that course assignment includes students through all matching sections.'],
              ['Entry', 'A specific payable item generated for an assignment.', 'Treating an entry as paid before proof has been reviewed.'],
              ['Transaction', 'A confirmed ledger action tied back to an entry and target.', 'Recording unclear references that are hard to audit later.'],
            ],
          },
          {
            type: 'table',
            headers: ['Use this', 'When it fits best'],
            rows: [
              ['Recurring structure', 'The same charge or expense repeats on a schedule.'],
              ['One-time structure', 'A single charge or expense should be generated from a saved plan.'],
              ['Manual verification', 'Payment happened outside EduVerse and staff need to confirm proof.'],
            ],
          },
        ],
      },
      {
        id: 'structure-amounts',
        title: 'Structure amounts',
        tags: ['amount', 'currency', 'billing'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The amount is the value used when entries are created from the structure. It should match the agreement for every selected assignment target.',
          },
          {
            type: 'list',
            items: [
              'Use a positive amount that matches the billing agreement.',
              'For one-time structures, the amount usually represents the full charge.',
              'For recurring structures, the amount usually represents the value for each billing period.',
              'Changing an existing structure does not automatically rewrite past entries or transactions.',
            ],
          },
        ],
      },
      {
        id: 'payments',
        title: 'Payments and verification',
        tags: ['pending', 'unverified', 'paid', 'partial'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Students and other assigned users can submit payment claims where enabled. Finance staff verify claims, reject invalid claims, and maintain transaction history for audit visibility.',
          },
          {
            type: 'list',
            items: [
              'A payment claim records who claimed payment, how much was claimed, how it was paid, when it was claimed, and any note or reference.',
              'Unverified payments still need staff review.',
              'Confirm a payment only after checking the receipt, transaction reference, cash record, or other school-approved proof.',
              'Confirmed payments update the paid amount and transaction history.',
              'Once the full amount is paid, confirmation controls are restricted and the entry displays as fully paid.',
            ],
          },
          {
            type: 'flow',
            title: 'Payment review flow',
            steps: ['Fee entry created', 'Student claims payment', 'Staff reviews proof', 'Payment confirmed or rejected', 'Balance updates'],
          },
          {
            type: 'table',
            headers: ['Status', 'Meaning', 'Who should act'],
            rows: [
              ['Due', 'Payment is still expected.', 'Student or finance staff.'],
              ['Awaiting Approval', 'A payment claim has been submitted but not verified.', 'Finance staff.'],
              ['Partially Paid', 'Some payment was confirmed but a balance remains.', 'Student or finance staff.'],
              ['Paid', 'The full amount has been confirmed.', 'No action unless correction is needed.'],
            ],
          },
        ],
      },
      {
        id: 'payment-claims',
        title: 'Payment claims',
        tags: ['claim paid', 'receipt', 'student payment'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A payment claim sends an entry to staff for review. It is useful when someone has paid outside EduVerse and needs the school to verify the payment.',
          },
          {
            type: 'list',
            items: [
              'Claimants should choose the correct entry and claimed amount before submitting.',
              'Receipt links, transaction references, and notes should be clear enough for staff to verify.',
              'A claimed payment remains Awaiting Approval until staff confirms it.',
            ],
          },
        ],
      },
      {
        id: 'payment-confirmation',
        title: 'Payment confirmation',
        tags: ['confirm payment', 'partial payment', 'paid'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Payment confirmation is the staff action that accepts a payment claim or records a verified payment. This changes the entry balance and may create a confirmed transaction record.',
          },
          {
            type: 'list',
            items: [
              'Review who claimed, what they claimed, how they paid, when they claimed it, and why or what reference they provided.',
              'Confirm only the amount that was actually verified.',
              'Use partial confirmation when only part of the balance was paid.',
              'Once an entry is fully paid, it appears as paid instead of due or awaiting approval.',
              'Keep receipt and reference details readable so later audits make sense.',
            ],
          },
        ],
      },
      {
        id: 'finance-common-mistakes',
        title: 'Common mistakes',
        tags: ['mistakes', 'payments', 'structures'],
        blocks: [
          {
            type: 'list',
            items: [
              'Creating too many duplicate structures instead of assigning one structure to the right targets.',
              'Confirming a payment claim before checking receipt or reference details.',
              'Assuming a claimed payment is already paid before staff approval.',
              'Editing a structure and expecting old entries or transactions to rewrite automatically.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'communication',
    title: 'Communication',
    description: 'Use chat, mail, announcements, notifications, and real-time updates.',
    category: 'Operations',
    tags: ['chat', 'mail', 'announcements', 'notifications', 'live updates'],
    related: ['chat', 'mail', 'announcements', 'notifications', 'roles-permissions'],
    sections: [
      {
        id: 'channels',
        title: 'Communication channels',
        tags: ['chat', 'mail', 'announcements'],
        blocks: [
          {
            type: 'list',
            items: [
              'Chat supports real-time conversations and attachments.',
              'Mail supports more formal threaded communication.',
              'Announcements broadcast organization or platform notices to selected audiences.',
              'Notifications surface workflow events such as submissions, grading reminders, mail, and announcements.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'chat',
    title: 'Chat',
    description: 'Use real-time chat for quick conversations, class groups, direct messages, and attachments.',
    category: 'Operations',
    tags: ['chat', 'direct messages', 'groups', 'attachments'],
    related: ['communication', 'mail', 'files-attachments'],
    sections: [
      {
        id: 'chat-purpose',
        title: 'When to use chat',
        tags: ['quick messages', 'groups'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Chat is best for quick conversations and active coordination. Users can use direct messages or group conversations depending on who needs to participate.',
          },
          {
            type: 'list',
            items: [
              'Use direct messages for one-to-one conversations.',
              'Use group chats when several people need the same discussion.',
              'Use mail instead when a message needs to feel more formal or easier to review later.',
            ],
          },
          {
            type: 'table',
            headers: ['Need', 'Use', 'Why'],
            rows: [
              ['Quick question or coordination', 'Chat', 'Fast and conversational.'],
              ['Official note or longer explanation', 'Mail', 'Easier to review later as a formal thread.'],
              ['Announcement to many users', 'Announcements', 'Designed for broad visibility.'],
              ['System event or reminder', 'Notifications', 'Automatically points users to the action that needs attention.'],
            ],
          },
        ],
      },
      {
        id: 'chat-attachments',
        title: 'Attachments and mentions',
        tags: ['files', 'mentions'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Chat can include attachments and message formatting where available. Keep shared files relevant to the class or school task.',
          },
          {
            type: 'checklist',
            items: [
              'The file belongs in this conversation',
              'The recipients are allowed to see it',
              'Private student details are only shared when needed',
              'The file name or message gives enough context',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'notifications',
    title: 'Notifications',
    description: 'Understand notification routing, teacher assessment notifications, and student notification behavior.',
    category: 'Operations',
    tags: ['notifications', 'submission', 'teacher workflow'],
    related: ['assessments-grading', 'communication'],
    sections: [
      {
        id: 'assessment-notifications',
        title: 'Assessment notifications',
        tags: ['creator', 'missing submissions', 'grading reminders'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Teacher notifications for assessment activity go to the teacher who created that assessment. This prevents every teacher in a shared class from receiving notices for work they do not manage.',
          },
        ],
      },
    ],
  },
  {
    slug: 'settings',
    title: 'Settings',
    description: 'Manage organization profile, branding, sessions, academic settings, and security options.',
    category: 'Operations',
    tags: ['settings', 'branding', 'academic settings', 'security'],
    related: ['gpa-policies', 'roles-permissions', 'account-security'],
    sections: [
      {
        id: 'organization-settings',
        title: 'Organization settings',
        tags: ['branding', 'logo', 'contact email'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Organization settings are the central place for school identity, contact details, branding, appearance, and account safety options. Each section affects a different part of the workspace.',
          },
          {
            type: 'list',
            items: [
              'Profile details help users recognize the school across dashboards and records.',
              'Branding controls the logo shown in the workspace and documents.',
              'Appearance controls the main accent color and theme preference.',
              'Contact and security options help with recovery, verification, and active sessions.',
            ],
          },
        ],
      },
      {
        id: 'organization-profile',
        title: 'Organization profile',
        tags: ['name', 'location', 'phone', 'contact email'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The organization profile stores the school name, location, phone number, and contact email used throughout the workspace. Keep these values official and easy to recognize.',
          },
          {
            type: 'list',
            items: [
              'The school name appears in dashboards, reports, and places where the workspace needs to identify itself.',
              'Location and phone help users and support teams understand which institute the workspace represents.',
              'The contact email should be monitored by the school because verification and recovery messages may depend on it.',
            ],
          },
        ],
      },
      {
        id: 'branding-logo',
        title: 'Logo and branding',
        tags: ['logo', 'branding', 'image'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The organization logo is used as the visual mark for the school workspace. Upload a clean square image that remains readable at small sizes.',
          },
          {
            type: 'list',
            items: [
              'Use an official logo or school mark, not a temporary classroom image.',
              'Square images work best because the logo is often shown inside a round or compact frame.',
              'Logo changes are saved with the rest of the organization settings when you submit the page.',
            ],
          },
        ],
      },
      {
        id: 'appearance-theme',
        title: 'Appearance and theme',
        tags: ['accent color', 'theme', 'contrast'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Appearance settings control the workspace accent color and preferred theme mode. They help the school feel recognizable without making the interface hard to read.',
          },
          {
            type: 'list',
            items: [
              'Choose an accent color with enough contrast for buttons, highlights, and focus states.',
              'EduVerse checks unsafe colors before saving so text and controls remain readable.',
              'Theme mode controls whether the workspace follows light, dark, or system preference where supported.',
            ],
          },
        ],
      },
      {
        id: 'contact-verification',
        title: 'Contact verification',
        tags: ['verified email', 'recovery', 'contact'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Contact verification confirms that the school can receive important account and recovery messages. If the contact email changes, the school may need to verify the new address again.',
          },
          {
            type: 'note',
            title: 'Why this matters',
            text: 'An unverified contact email can make account recovery and official communication harder. Keep the address current and monitored.',
          },
        ],
      },
      {
        id: 'security-sessions',
        title: 'Security and sessions',
        tags: ['sessions', 'password', 'devices'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Security tools help users review active sessions, remove access from old devices, and change passwords when needed.',
          },
          {
            type: 'list',
            items: [
              'Review sessions if a device is lost, shared, or no longer trusted.',
              'Change the password if there is any chance the account was exposed.',
              'Use the verified contact email for recovery-related workflows when available.',
            ],
          },
        ],
      },
      {
        id: 'academic-settings',
        title: 'Academic settings',
        tags: ['gpa policies', 'org admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Academic settings include GPA policies. GPA policy management is restricted to organization admins because it affects transcripts and academic history.',
          },
          {
            type: 'list',
            items: [
              'GPA policies define scale, rounding, calculation method, and grade boundaries.',
              'A cycle can lock its selected GPA policy after finalized grades exist.',
              'Only trusted academic administrators should change GPA policies because the result affects official records.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'dashboard-insights',
    title: 'Dashboard and Insights',
    description: 'Understand the role-based overview page, activity summaries, alerts, and progress indicators.',
    category: 'Basics',
    tags: ['dashboard', 'overview', 'insights', 'alerts'],
    related: ['getting-started', 'students', 'teachers'],
    sections: [
      {
        id: 'overview-page',
        title: 'Overview page',
        tags: ['overview', 'dashboard'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The overview page shows the information most relevant to the signed-in user. Admins see school-wide activity, teachers see teaching work, and students see their own academic progress.',
          },
          {
            type: 'list',
            items: [
              'Admins can review student, teacher, attendance, schedule, and activity signals.',
              'Teachers can see assigned sections, upcoming work, missed attendance sessions, and students who may need attention.',
              'Students can see enrolled courses, upcoming assessments, grades, timetable, attendance, and finance reminders where available.',
            ],
          },
        ],
      },
      {
        id: 'actionable-alerts',
        title: 'Actionable alerts',
        tags: ['alerts', 'warnings'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Dashboard alerts are meant to point users toward work that needs attention, such as missing schedules, attendance gaps, upcoming assessments, unread messages, or unverified payments.',
          },
        ],
      },
    ],
  },
  {
    slug: 'platform-admin',
    title: 'Platform Administration',
    description: 'Manage organizations, platform admins, audit logs, and platform-level review workflows.',
    category: 'Administration',
    tags: ['platform admin', 'organizations', 'audit logs', 'review'],
    related: ['roles-permissions', 'settings', 'communication'],
    sections: [
      {
        id: 'organizations',
        title: 'Organizations',
        tags: ['schools', 'approval', 'status'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Platform admins manage school and institute workspaces from the organizations area. They can review new registrations, update organization status, inspect organization details, and contact organization representatives.',
          },
          {
            type: 'list',
            items: [
              'Pending organizations may need review before they can operate normally.',
              'Suspended or rejected organizations may have limited access depending on platform policy.',
              'Organization actions should be handled carefully because they affect every user in that workspace.',
            ],
          },
        ],
      },
      {
        id: 'platform-admins',
        title: 'Platform admins',
        tags: ['staff', 'access'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Platform admin accounts are used for platform-level work. Only trusted staff should receive this access because it applies outside a single school workspace.',
          },
        ],
      },
      {
        id: 'audit-logs',
        title: 'Audit logs',
        tags: ['history', 'activity'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Audit logs help platform staff review important actions and security-related events. They are designed for accountability and troubleshooting, not day-to-day messaging.',
          },
        ],
      },
    ],
  },
  {
    slug: 'cohorts-promotions',
    title: 'Cohorts and Promotions',
    description: 'Group students, assign sections, move students between cycles, and copy academic setup forward.',
    category: 'Academic Settings',
    tags: ['cohorts', 'promotions', 'copy-forward', 'students'],
    related: ['academic-cycles', 'students', 'courses-sections'],
    sections: [
      {
        id: 'cohorts',
        title: 'Cohorts',
        tags: ['student groups', 'sections'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Cohorts group students for an academic period. They make it easier to enroll a group of students into the same sections without selecting every student one by one each time.',
          },
          {
            type: 'list',
            items: [
              'Adding students to a cohort can enroll them into the cohort sections.',
              'Assigning a section to a cohort can enroll eligible cohort students into that section.',
              'A student can be excluded from a cohort section when they should not attend that class.',
            ],
          },
        ],
      },
      {
        id: 'promotions',
        title: 'Promotions',
        tags: ['move students', 'new cycle'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Promotions move selected students from one academic cycle or cohort into another. This is useful at the end of a term, semester, grade level, or school year.',
          },
          {
            type: 'note',
            title: 'Review before promoting',
            text: 'Promotion changes student placement and enrollment history. Review the source cycle, target cycle, target cohort, and selected students before confirming.',
          },
        ],
      },
      {
        id: 'copy-forward',
        title: 'Copy-forward',
        tags: ['copy setup', 'next cycle'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Copy-forward carries selected setup from one academic cycle into another. It helps admins prepare a new cycle without rebuilding every section and related item from scratch.',
          },
          {
            type: 'list',
            items: [
              'Admins choose the source cycle and target cycle.',
              'Admins choose what to copy, such as schedules, assessments, or materials.',
              'Copied records should be reviewed after creation because dates, teachers, rooms, and instructions may need changes.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'submissions',
    title: 'Submissions',
    description: 'Submit assessment work, review submitted files or messages, and understand teacher follow-up.',
    category: 'Academics',
    tags: ['submissions', 'assignments', 'files', 'students'],
    related: ['assessments-grading', 'materials', 'notifications'],
    sections: [
      {
        id: 'student-submissions',
        title: 'Student submissions',
        tags: ['submit work', 'assessment'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Students submit work from their assessment view. A submission may include a message, file, or link depending on the assessment instructions.',
          },
          {
            type: 'list',
            items: [
              'Students should review the due date and instructions before submitting.',
              'Teachers can review submitted work from the assessment grading view.',
              'Submission status helps students and teachers see whether work has been turned in.',
            ],
          },
        ],
      },
      {
        id: 'late-or-missing-work',
        title: 'Late or missing work',
        tags: ['missing', 'late'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Missing or late work may affect grades depending on school policy. Teachers can record a zero when a student has no valid submission or when the school decides the work should receive no credit.',
          },
        ],
      },
    ],
  },
  {
    slug: 'mail',
    title: 'Mail',
    description: 'Use EduVerse mail for formal school communication and threaded messages.',
    category: 'Operations',
    tags: ['mail', 'messages', 'inbox', 'attachments'],
    related: ['communication', 'notifications', 'roles-permissions', 'files-attachments'],
    sections: [
      {
        id: 'mail-purpose',
        title: 'Mail purpose',
        tags: ['inbox', 'threads'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Mail is best for formal or longer communication. It keeps messages in a thread so users can review the conversation later.',
          },
          {
            type: 'list',
            items: [
              'Use chat for quick back-and-forth conversations.',
              'Use mail for official notes, longer explanations, or messages that need a clearer record.',
              'Unread mail contributes to notification and navigation badges.',
            ],
          },
        ],
      },
      {
        id: 'mail-attachments',
        title: 'Attachments',
        tags: ['files'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Mail can include attachments where supported. Users should only attach files that are relevant to the school workflow and safe to share with the recipients.',
          },
        ],
      },
    ],
  },
  {
    slug: 'files-attachments',
    title: 'Files and Attachments',
    description: 'Understand where files appear, how attachments are used, and what users should check before sharing.',
    category: 'Operations',
    tags: ['files', 'attachments', 'uploads', 'media'],
    related: ['materials', 'submissions', 'mail', 'chat'],
    sections: [
      {
        id: 'where-files-are-used',
        title: 'Where files are used',
        tags: ['uploads', 'attachments'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Files can appear in several places, including materials, submissions, chat, mail, profile photos, organization branding, and receipts.',
          },
          {
            type: 'list',
            items: [
              'Materials are usually shared with an entire class.',
              'Submissions are usually shared from a student to a teacher.',
              'Receipts and finance attachments should be clear enough for staff to verify.',
              'Profile and branding images should be appropriate for school use.',
            ],
          },
        ],
      },
      {
        id: 'safe-sharing',
        title: 'Safe sharing',
        tags: ['privacy', 'sharing'],
        blocks: [
          {
            type: 'note',
            title: 'Check before uploading',
            text: 'Only upload files that are safe and appropriate to share with the selected audience. Avoid sharing private student information unless it is needed for the task.',
          },
        ],
      },
    ],
  },
  {
    slug: 'announcements',
    title: 'Announcements',
    description: 'Broadcast important notices to selected audiences across the platform or organization.',
    category: 'Operations',
    tags: ['announcements', 'broadcast', 'priority', 'audience'],
    related: ['communication', 'notifications', 'platform-admin', 'support-contact'],
    sections: [
      {
        id: 'announcement-audience',
        title: 'Audience and visibility',
        tags: ['audience', 'roles'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Announcements are used for notices that need broad visibility. The sender chooses who should see the announcement based on the available audience options.',
          },
          {
            type: 'list',
            items: [
              'Platform announcements can be used for platform-wide messages.',
              'Organization announcements can target users inside one school workspace.',
              'Pinned or high-priority announcements should be used sparingly so important notices stay meaningful.',
            ],
          },
        ],
      },
      {
        id: 'announcement-actions',
        title: 'Links and actions',
        tags: ['link', 'action'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Announcements can point users to a related page or action when needed. Keep the announcement text short and use the link for the detailed task.',
          },
        ],
      },
    ],
  },
  {
    slug: 'fees',
    title: 'Student Fees',
    description: 'Review fee entries, payment status, and payment claims from the student-facing view.',
    category: 'Operations',
    tags: ['fees', 'student fees', 'payments', 'dues'],
    related: ['finance', 'students'],
    sections: [
      {
        id: 'fee-status',
        title: 'Fee status',
        tags: ['due', 'paid', 'unverified'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The fees view helps students review what is due, what has been paid, and what is waiting for school verification.',
          },
          {
            type: 'list',
            items: [
              'Due entries still need action from the student or school.',
              'Unverified entries have a payment claim that staff still need to review.',
              'Paid entries have been accepted by the school.',
            ],
          },
        ],
      },
      {
        id: 'payment-claims',
        title: 'Payment claims',
        tags: ['claim paid', 'receipt'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A payment claim tells the school that the student believes a fee has been paid. Staff still need to verify the claim before the entry becomes fully paid.',
          },
        ],
      },
    ],
  },
  {
    slug: 'account-security',
    title: 'Account and Security',
    description: 'Manage passwords, sessions, verification, account access, and common sign-in recovery flows.',
    category: 'Support',
    tags: ['account', 'password', 'sessions', 'security'],
    related: ['settings', 'roles-permissions', 'troubleshooting', 'support-contact'],
    sections: [
      {
        id: 'passwords',
        title: 'Passwords',
        tags: ['change password', 'reset password'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Users can change their password from account settings when signed in. If they cannot sign in, they can use the password reset flow where available.',
          },
          {
            type: 'list',
            items: [
              'Choose a password that is difficult to guess.',
              'Do not share passwords with other users.',
              'If a password may be exposed, change it immediately.',
            ],
          },
        ],
      },
      {
        id: 'sessions',
        title: 'Sessions and devices',
        tags: ['devices', 'logout'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Session management helps users review active sign-ins and remove access from devices they no longer use or recognize.',
          },
        ],
      },
      {
        id: 'contact-verification',
        title: 'Contact verification',
        tags: ['email', 'verification'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Schools should keep contact information accurate so important account, security, and support messages reach the right people.',
          },
        ],
      },
    ],
  },
  {
    slug: 'support-contact',
    title: 'Support and Contact',
    description: 'Know when to contact school staff, platform support, or use documentation first.',
    category: 'Support',
    tags: ['support', 'contact', 'help', 'tickets'],
    related: ['troubleshooting', 'account-security', 'settings'],
    sections: [
      {
        id: 'when-to-use-docs',
        title: 'Start with docs',
        tags: ['docs', 'help'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Use the docs when you need to understand how a feature behaves, what a rule means, or what happens after an action is saved.',
          },
        ],
      },
      {
        id: 'when-to-contact-support',
        title: 'Contact support',
        tags: ['ticket', 'issue'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Contact support when something appears broken, a user cannot access a required area, or a school needs help with a platform-level issue.',
          },
          {
            type: 'list',
            items: [
              'Include the page name and what you were trying to do.',
              'Include the exact error message if one appeared.',
              'Avoid sending passwords or sensitive private information in support messages.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Resolve common cache, permissions, real-time, form validation, and document issues.',
    category: 'Support',
    tags: ['troubleshooting', 'cache', 'permissions', 'live updates', 'validation'],
    related: ['getting-started', 'communication'],
    sections: [
      {
        id: 'dev-cache',
        title: 'Development cache issues',
        tags: ['reload', 'cache', 'update'],
        blocks: [
          {
            type: 'paragraph',
            text: 'If a page looks out of date after an update, refresh the browser. If it still looks stale, use a hard refresh so the browser downloads the newest files.',
          },
        ],
      },
      {
        id: 'validation-errors',
        title: 'Validation errors',
        tags: ['forms', 'gpa rules', 'grade input'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Most forms show short error messages near the problem. For GPA policies, EduVerse checks that mark ranges are complete, do not overlap, follow the right order, and stay within the selected scale.',
          },
        ],
      },
    ],
  },
  {
    slug: 'quick-start',
    title: 'Quick Start Guide',
    description: 'Get your school operational on EduVerse in the right order. Follow this checklist to avoid configuration mistakes.',
    category: 'Getting Started',
    tags: ['setup', 'onboarding', 'checklist', 'first time'],
    related: ['school-setup-workflow', 'getting-started', 'roles-permissions', 'settings'],
    sections: [
      {
        id: 'before-you-begin',
        title: 'Before you begin',
        tags: ['prerequisites', 'preparation'],
        blocks: [
          {
            type: 'paragraph',
            text: 'EduVerse requires configuration in a specific order because later features depend on earlier setup. Skipping steps or doing them out of order will cause missing options, empty dropdowns, or broken workflows.',
          },
          {
            type: 'tip',
            title: 'Plan your academic structure first',
            text: 'Before touching EduVerse, decide your academic cycle names, course list, class groups (cohorts), and grading policy. Having these ready makes setup much faster.',
          },
        ],
      },
      {
        id: 'setup-checklist',
        title: 'Setup checklist',
        summary: 'Complete these steps in order. Each step unlocks the next.',
        tags: ['checklist', 'order'],
        blocks: [
          {
            type: 'flow',
            title: 'Setup order',
            steps: ['Organization', 'GPA Policy', 'Academic Cycle', 'Courses', 'Cohorts', 'Sections', 'Teachers', 'Students', 'Timetable', 'Materials', 'Assessments', 'Go Live'],
          },
          {
            type: 'steps',
            items: [
              'Configure Organization: Set school name, logo, contact email, and appearance in Settings.',
              'Configure GPA Policy: Review the default 4.0 policy or create a custom policy that matches your grading rules.',
              'Create Academic Cycle: Create your first term or semester (e.g. "Fall 2026"). Select the GPA policy for this cycle.',
              'Create Courses: Add each subject with the correct credit hours. Course names appear on transcripts.',
              'Create Cohorts: Group students into classes (e.g. "Grade 10-A"). Cohorts make bulk enrollment easier.',
              'Create Sections: Create class sections under courses and link them to the academic cycle. Assign cohorts to auto-enroll students.',
              'Assign Teachers: Add teacher accounts and assign them to their sections.',
              'Import Students: Create student accounts and place them in the correct cohorts.',
              'Create Timetable: Add schedule slots for each section, selecting the assigned teacher, day, time, and room.',
              'Upload Materials: Teachers upload course materials to their assigned sections.',
              'Create Assessments: Teachers create assessments with due dates, total marks, and submission settings.',
              'Begin Operations: Students can now view timetables, access materials, submit work, and check grades.',
            ],
          },
        ],
      },
      {
        id: 'common-setup-mistakes',
        title: 'Common setup mistakes',
        tags: ['mistakes', 'errors'],
        blocks: [
          {
            type: 'list',
            items: [
              'Creating sections before courses: sections need a course to attach to.',
              'Creating schedules before assigning teachers: only assigned teachers can be selected for a schedule.',
              'Skipping GPA policy setup: the default policy works, but review it before teachers start grading.',
              'Creating duplicate courses instead of multiple sections: one course can have many sections.',
              'Forgetting to set credit hours: the default is 3, but some courses need different values for accurate GPA.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'admin-guide',
    title: 'Org Admin Guide',
    description: 'A plain-language guide for running the school workspace, reviewing setup, and protecting academic records.',
    category: 'Role Guides',
    tags: ['org admin', 'operations', 'setup', 'review'],
    related: ['quick-start', 'school-setup-workflow', 'settings', 'academic-cycles', 'finance'],
    sections: [
      {
        id: 'admin-responsibilities',
        title: 'What org admins own',
        tags: ['responsibilities', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Org admins manage the school workspace. They set up the academic structure, control sensitive settings, review finance activity, and make sure official records are ready before teachers and students rely on them.',
          },
          {
            type: 'table',
            headers: ['Area', 'Admin responsibility', 'Why it matters'],
            rows: [
              ['Settings', 'Keep school identity, contact email, logo, and appearance accurate.', 'Users trust records more when the workspace clearly belongs to the school.'],
              ['Academic setup', 'Create cycles, courses, cohorts, sections, and GPA policies in the right order.', 'Bad setup causes missing dropdowns, wrong enrollments, and transcript mistakes.'],
              ['People', 'Create teacher and student accounts and place them correctly.', 'Portal views depend on correct assignments and placement.'],
              ['Finance', 'Review structures, payment claims, and confirmed transactions.', 'Fee balances should only change after staff verification.'],
            ],
          },
        ],
      },
      {
        id: 'admin-daily-workflow',
        title: 'Daily workflow',
        tags: ['daily', 'dashboard'],
        blocks: [
          {
            type: 'checklist',
            items: [
              'Review dashboard alerts for missing schedules, attendance gaps, or unverified payments',
              'Check new student or teacher records for correct placement',
              'Confirm payment claims only after reviewing proof',
              'Watch for incomplete academic setup before a new cycle starts',
              'Use docs links from pages when a setting has consequences',
            ],
          },
        ],
      },
      {
        id: 'admin-sensitive-actions',
        title: 'Sensitive actions',
        tags: ['finalize', 'policy', 'delete', 'archive'],
        blocks: [
          {
            type: 'table',
            headers: ['Action', 'Why it is sensitive', 'Before confirming'],
            rows: [
              ['Changing a cycle GPA policy', 'It affects transcript results for that cycle until grades are finalized.', 'Confirm the policy matches school rules before teachers finalize grades.'],
              ['Finalizing grades', 'Finalized grades are treated as official for transcripts.', 'Review marks, weightage, student names, and feedback.'],
              ['Deleting or archiving records', 'Old records may explain historical transcripts, payments, or enrollments.', 'Archive when history still needs to remain understandable.'],
              ['Confirming payments', 'Balances and transaction history change after confirmation.', 'Check receipt, reference, amount, and student before accepting.'],
            ],
          },
          {
            type: 'note',
            title: 'Use caution with academic history',
            text: 'If an action explains a past transcript, enrollment, or payment, avoid removing it just to clean up a current screen. Historical clarity is usually more important.',
          },
        ],
      },
    ],
  },
  {
    slug: 'teacher-guide',
    title: 'Teacher Guide',
    description: 'A practical guide for assigned classes, materials, assessments, submissions, attendance, and grading.',
    category: 'Role Guides',
    tags: ['teacher', 'classes', 'grading', 'attendance'],
    related: ['teachers', 'timetable', 'materials', 'assessments-grading', 'gradebook'],
    sections: [
      {
        id: 'teacher-start',
        title: 'Where teachers start',
        tags: ['dashboard', 'assigned classes'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Teachers work from the classes and schedules assigned to them. If a class, timetable slot, or assessment is missing, the first thing to check is whether the teacher is assigned to that section or schedule.',
          },
          {
            type: 'flow',
            title: 'Typical teaching flow',
            steps: ['Review timetable', 'Open assigned section', 'Share materials', 'Create assessment', 'Review submissions', 'Enter grades', 'Publish or finalize'],
          },
        ],
      },
      {
        id: 'teacher-class-work',
        title: 'Class work',
        tags: ['materials', 'assessments', 'submissions'],
        blocks: [
          {
            type: 'table',
            headers: ['Task', 'Where it appears', 'What to check'],
            rows: [
              ['Share material', 'Teacher and student section views.', 'The file or link belongs to the correct section.'],
              ['Create assessment', 'Student assessment list and teacher grading view.', 'Due date, total marks, weightage, and submission settings are correct.'],
              ['Review submissions', 'Assessment grading workflow.', 'Student work is opened before marking late or missing.'],
              ['Enter grades', 'Gradebook or assessment grading view.', 'Zero grades are intentional and non-zero grades follow the minimum rule.'],
            ],
          },
        ],
      },
      {
        id: 'teacher-end-of-term',
        title: 'End-of-term responsibilities',
        tags: ['finalized grades', 'transcripts'],
        blocks: [
          {
            type: 'checklist',
            items: [
              'All assessments that count toward the course have grades',
              'Late or missing submissions have been handled according to school policy',
              'Assessment weights and total marks look correct',
              'Student-visible feedback is appropriate',
              'Grades are finalized only when they are ready for transcript use',
            ],
          },
          {
            type: 'note',
            title: 'Final means official',
            text: 'Finalized grades are used for transcripts. Teachers should treat finalization as the last review step, not as a draft save button.',
          },
        ],
      },
    ],
  },
  {
    slug: 'student-guide',
    title: 'Student Guide',
    description: 'A student-friendly guide for timetable, materials, submissions, grades, fees, and transcripts.',
    category: 'Role Guides',
    tags: ['student', 'portal', 'submissions', 'fees'],
    related: ['students', 'submissions', 'fees', 'transcripts', 'chat'],
    sections: [
      {
        id: 'student-portal',
        title: 'Student portal basics',
        tags: ['portal', 'dashboard'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The student portal shows the classes, timetable, materials, assessments, grades, fees, and transcripts connected to the signed-in student. If something is missing, the student may not be enrolled in the right cohort or section yet.',
          },
          {
            type: 'table',
            headers: ['Need', 'Where to look', 'What it means'],
            rows: [
              ['Class schedule', 'Timetable', 'Shows schedule slots for enrolled sections.'],
              ['Study files', 'Materials', 'Shows files or links teachers shared with the class.'],
              ['Assignments or exams', 'Assessments', 'Shows due dates, instructions, and submission options.'],
              ['Marks', 'Grades or transcript views', 'Shows published or finalized academic results depending on the page.'],
              ['Fee balance', 'Fees', 'Shows due, awaiting approval, partially paid, and paid entries.'],
            ],
          },
        ],
      },
      {
        id: 'student-submission-workflow',
        title: 'Submitting work',
        tags: ['submission', 'assessment'],
        blocks: [
          {
            type: 'steps',
            items: [
              'Open the assessment from the student portal.',
              'Read the instructions, due date, and allowed submission type.',
              'Attach the file, link, or response requested by the teacher.',
              'Review the submission before sending.',
              'Check the status after submitting so you know it was received.',
            ],
          },
          {
            type: 'tip',
            title: 'Keep proof of important work',
            text: 'For major assignments, keep a copy of the submitted file or link until the teacher has reviewed it.',
          },
        ],
      },
      {
        id: 'student-fees-transcripts',
        title: 'Fees and transcripts',
        tags: ['fees', 'transcripts', 'gpa'],
        blocks: [
          {
            type: 'list',
            items: [
              'A fee marked Awaiting Approval means the school still needs to verify the payment claim.',
              'A paid fee means staff accepted the payment record.',
              'Transcript GPA and letter grades come from the school policy for that academic cycle.',
              'If a grade or fee looks wrong, contact the school instead of creating duplicate claims or submissions.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'school-setup-workflow',
    title: 'Setting Up a New School',
    description: 'End-to-end guide for configuring a new school workspace from registration to first day of class.',
    category: 'Workflows',
    tags: ['setup', 'new school', 'workflow', 'configuration'],
    related: ['quick-start', 'settings', 'academic-cycles', 'courses-sections', 'cohorts-promotions'],
    sections: [
      {
        id: 'workflow-overview',
        title: 'Workflow overview',
        tags: ['overview'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Setting up a new school requires decisions in the right order. This guide walks through each stage, explains what decisions to make, and warns about common pitfalls.',
          },
          {
            type: 'flow',
            title: 'Full setup flow',
            steps: ['Register', 'Configure Org', 'GPA Policy', 'Cycle', 'Courses', 'Cohorts', 'Sections', 'Teachers', 'Students', 'Timetable', 'Content', 'Launch'],
          },
        ],
      },
      {
        id: 'stage-organization',
        title: 'Stage 1: Organization profile',
        tags: ['organization', 'branding'],
        blocks: [
          {
            type: 'paragraph',
            text: 'After registration is approved, the org admin should immediately configure the school profile. This information appears throughout the workspace.',
          },
          {
            type: 'checklist',
            items: [
              'Set the official school name',
              'Upload a square logo image',
              'Add location and phone number',
              'Set and verify the contact email',
              'Choose an accent color that matches the school brand',
            ],
          },
          {
            type: 'note',
            title: 'Contact email verification',
            text: 'Verify the contact email early. An unverified email can delay account recovery and important platform communications.',
          },
        ],
      },
      {
        id: 'stage-academics',
        title: 'Stage 2: Academic foundation',
        tags: ['gpa', 'cycle', 'courses'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The academic foundation consists of three things that must exist before classes can operate: a GPA policy, an academic cycle, and courses.',
          },
          {
            type: 'steps',
            items: [
              'Review or customize the GPA policy. The default 4.0 scale works for most schools. If your school uses a 5.0 or 10.0 scale, create a new policy.',
              'Create the first academic cycle. Name it clearly (e.g. "Semester 1 - 2026"). Select the GPA policy for this cycle.',
              'Create all courses with proper names and credit hours. These names appear on transcripts, so use official names.',
            ],
          },
          {
            type: 'tip',
            title: 'Credit hours matter for GPA',
            text: 'If your school uses weighted GPA (by credit hours), set each course credit value correctly now. Changing it later can affect future transcript calculations.',
          },
        ],
      },
      {
        id: 'stage-people',
        title: 'Stage 3: People and classes',
        tags: ['cohorts', 'sections', 'teachers', 'students'],
        blocks: [
          {
            type: 'paragraph',
            text: 'With courses and a cycle ready, create the class structure and add people.',
          },
          {
            type: 'steps',
            items: [
              'Create cohorts for each class group (e.g. "Grade 10-A", "Grade 10-B").',
              'Create sections under each course, linking them to the academic cycle.',
              'Assign cohorts to sections so students are auto-enrolled.',
              'Create teacher accounts and assign them to their sections.',
              'Create student accounts and place them in the correct cohorts.',
            ],
          },
          {
            type: 'table',
            headers: ['Cohort', 'Section'],
            rows: [
              ['A student group (e.g. Grade 10-A)', 'An actual class instance (e.g. Math - Grade 10-A)'],
              ['Groups students for bulk enrollment', 'Connects course, cycle, teachers, and students'],
              ['One cohort can link to many sections', 'One section belongs to one course and one cycle'],
            ],
          },
        ],
      },
      {
        id: 'stage-operations',
        title: 'Stage 4: Operations',
        tags: ['timetable', 'materials', 'assessments'],
        blocks: [
          {
            type: 'paragraph',
            text: 'With people and classes in place, set up operational workflows.',
          },
          {
            type: 'steps',
            items: [
              'Create timetable schedules for each section (select teacher, day, time, room).',
              'Teachers upload course materials to their sections.',
              'Teachers create assessments with due dates and submission settings.',
              'Verify the student portal shows correct timetables, materials, and assessments.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'end-of-term-workflow',
    title: 'End-of-Term Process',
    description: 'Step-by-step guide for finalizing grades, locking GPA policies, generating transcripts, and promoting students.',
    category: 'Workflows',
    tags: ['end of term', 'finalize', 'transcripts', 'promotion', 'workflow'],
    related: ['academic-cycles', 'transcripts', 'gradebook', 'cohorts-promotions', 'gpa-policies'],
    sections: [
      {
        id: 'end-of-term-overview',
        title: 'End-of-term overview',
        tags: ['overview', 'timeline'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The end of an academic term requires a specific sequence of actions. Doing these out of order can create transcript errors or lock data prematurely.',
          },
          {
            type: 'flow',
            title: 'End-of-term sequence',
            steps: ['Complete Grading', 'Review Grades', 'Finalize Grades', 'GPA Policy Locks', 'Generate Transcripts', 'Promote Students', 'Create New Cycle'],
          },
        ],
      },
      {
        id: 'finalize-grades',
        title: 'Step 1: Finalize grades',
        tags: ['grading', 'finalized'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Teachers must finalize all grades for the cycle. Only finalized grades appear on official transcripts.',
          },
          {
            type: 'table',
            headers: ['Grade State', 'Editable', 'Visible to Students', 'Transcript Eligible'],
            rows: [
              ['Draft', 'Yes', 'No', 'No'],
              ['Published', 'Yes', 'Yes', 'No'],
              ['Finalized', 'No', 'Yes', 'Yes'],
            ],
          },
          {
            type: 'note',
            title: 'Review before finalizing',
            text: 'Finalized grades cannot be edited. Double-check marks, feedback, and assessment weights before finalizing.',
          },
          {
            type: 'checklist',
            items: [
              'All assessments have been graded',
              'Grade values have been reviewed for accuracy',
              'Assessment weights add up correctly',
              'Teachers have finalized their grades',
            ],
          },
        ],
      },
      {
        id: 'gpa-lock',
        title: 'Step 2: GPA policy locks',
        tags: ['gpa', 'locked', 'policy'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Once the first grade is finalized in a cycle, the GPA policy for that cycle is permanently locked. This prevents transcript history from being recalculated under a different policy.',
          },
          {
            type: 'tip',
            title: 'This is intentional',
            text: 'Policy locking protects transcript integrity. If you need a different policy for next term, create a new policy and assign it to the new cycle.',
          },
        ],
      },
      {
        id: 'generate-transcripts',
        title: 'Step 3: Generate transcripts',
        tags: ['transcripts', 'gpa', 'cgpa'],
        blocks: [
          {
            type: 'paragraph',
            text: 'With finalized grades and a locked GPA policy, transcripts can be generated. The transcript uses the cycle policy snapshot so results remain stable.',
          },
          {
            type: 'list',
            items: [
              'Web transcripts are available immediately after grades are finalized.',
              'PDF transcripts can be downloaded for printing or sharing.',
              'CGPA is calculated cumulatively across all transcript cycles.',
            ],
          },
        ],
      },
      {
        id: 'promote-students',
        title: 'Step 4: Promote students',
        tags: ['promotion', 'new cycle'],
        blocks: [
          {
            type: 'paragraph',
            text: 'After transcripts are generated, promote students to the next cycle or cohort. Promotion moves student placement while preserving enrollment history.',
          },
          {
            type: 'steps',
            items: [
              'Create the new academic cycle if it does not exist yet.',
              'Create target cohorts in the new cycle.',
              'Use the promotion tool to select students and move them to the target cycle and cohort.',
              'Review promoted students to confirm correct placement.',
              'Use copy-forward to carry sections, schedules, or materials into the new cycle if needed.',
            ],
          },
        ],
      },
    ],
  },
];

export const docsNavGroups: DocNavGroup[] = [
  { title: 'Basics', pages: ['quick-start', 'getting-started', 'roles-permissions', 'glossary', 'dashboard-insights'] },
  { title: 'Role Guides', pages: ['admin-guide', 'teacher-guide', 'student-guide'] },
  { title: 'Workflows', pages: ['school-setup-workflow', 'end-of-term-workflow'] },
  { title: 'Administration', pages: ['platform-admin'] },
  { title: 'People', pages: ['students', 'teachers'] },
  {
    title: 'Academics',
    pages: [
      'academic-cycles',
      'cohorts-promotions',
      'courses-sections',
      'materials',
      'assessments-grading',
      'submissions',
      'gradebook',
      'gpa-policies',
      'timetable',
      'attendance',
      'transcripts',
    ],
  },
  {
    title: 'Operations',
    pages: ['finance', 'fees', 'communication', 'chat', 'mail', 'announcements', 'notifications', 'files-attachments', 'settings'],
  },
  { title: 'Support', pages: ['account-security', 'support-contact', 'troubleshooting'] },
];

export function getDocPage(slug: string) {
  return docsPages.find((page) => page.slug === slug);
}

export function getDocPagesForGroup(group: DocNavGroup) {
  return group.pages
    .map((slug) => getDocPage(slug))
    .filter((page): page is DocPage => Boolean(page));
}

export function flattenDocSections(page: DocPage) {
  const entries: Array<{ page: DocPage; section: DocSection; parentTitle?: string }> = [];

  const walk = (sections: DocSection[], parentTitle?: string) => {
    sections.forEach((section) => {
      entries.push({ page, section, parentTitle });
      if (section.subsections?.length) {
        walk(section.subsections, section.title);
      }
    });
  };

  walk(page.sections);
  return entries;
}

export function buildDocsSearchEntries() {
  return docsPages.flatMap((page) =>
    flattenDocSections(page).map(({ section, parentTitle }) => {
      const blockText = section.blocks.flatMap((block) => {
        if (block.type === 'paragraph') return [block.text];
        if (block.type === 'note') return [block.title, block.text];
        if (block.type === 'tip') return [block.title, block.text];
        if (block.type === 'table') return [...block.headers, ...block.rows.flat()];
        if (block.type === 'flow') return [block.title, ...block.steps].filter(Boolean);
        return block.items;
      });
      const snippet = section.summary ?? blockText.find((text) => text && text.length > 32) ?? page.description;

      return {
        href: `/docs/${page.slug}#${section.id}`,
        pageTitle: page.title,
        sectionTitle: section.title,
        parentTitle,
        category: page.category,
        tags: [...page.tags, ...(section.tags ?? [])],
        snippet,
        text: [
          page.title,
          page.description,
          page.category,
          ...page.tags,
          section.title,
          section.summary,
          ...(section.tags ?? []),
          ...blockText,
        ]
          .filter(Boolean)
          .join(' '),
      };
    }),
  );
}
