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

export type DocsSearchEntry = {
  href: string;
  pageTitle: string;
  sectionTitle: string;
  parentTitle?: string;
  category: string;
  tags: string[];
  pageTags: string[];
  sectionTags: string[];
  titleText: string;
  tagText: string;
  categoryText: string;
  bodyText: string;
  fallbackSnippet: string;
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
        tags: ['org-admin', 'sub-admin', 'manager', 'finance manager', 'teacher', 'student', 'guardian'],
        blocks: [
          {
            type: 'table',
            headers: ['Role', 'Main job', 'Can manage', 'Cannot access'],
            rows: [
              ['Org Admin', 'Owns the organization workspace.', 'All organization users, academic setup, settings, finance, grade finalization, and records.', 'Platform administration outside the organization.'],
              ['Sub Admin', 'Runs delegated operational administration.', 'Users, academic setup, schedules, cycles, cohorts, promotions, grade review, and operational records.', 'Main admin account management and platform administration.'],
              ['Manager', 'Monitors academic work for assigned sections.', 'Assigned students, assigned sections, attendance, assessments, grades, and finalization review where allowed.', 'Finance management, settings, broad user administration, and unrestricted student data.'],
              ['Finance Manager', 'Handles fee and payment operations.', 'Finance structures, entries, payment claims, transactions, and finance communication.', 'Academic setup, teaching workflows, settings, and grade management.'],
              ['Teacher', 'Runs assigned classes.', 'Assigned sections, materials, assessments, submissions, attendance, and grading.', 'Finance management, school settings, and unassigned student records.'],
              ['Student', 'Uses the student portal.', 'Own submissions, fee claims, personal timetable, materials, grades, attendance, and transcripts.', 'Other students, staff tools, settings, and management pages.'],
              ['Guardian', 'Views linked student records.', 'Read-only linked-student overview, attendance, grades, timetable, and fee status.', 'Unlinked students, staff tools, academic setup, and group chat creation.'],
            ],
          },
        ],
      },
      {
        id: 'feature-matrix',
        title: 'Feature matrix',
        tags: ['matrix', 'features'],
        blocks: [
          {
            type: 'table',
            headers: ['Feature', 'Admin', 'SubAdmin', 'Manager', 'FinanceManager', 'Teacher', 'Student', 'Guardian'],
            rows: [
              ['Students', 'Create, edit, delete, view all', 'Create, edit, delete, view all', 'View assigned', 'Finance-related view', 'View assigned', 'View self', 'View linked'],
              ['Teachers and Managers', 'Create, edit, delete', 'Create, edit, delete', 'View assigned context', 'No', 'View peers where allowed', 'No', 'No'],
              ['Sub Admins', 'Create, edit, delete', 'No', 'No', 'No', 'No', 'No', 'No'],
              ['Finance Managers', 'Create, edit, delete', 'Create, edit, delete', 'No', 'No', 'No', 'No', 'No'],
              ['Guardians', 'Create, edit, link to student', 'Create, edit, link to student', 'No', 'Finance communication only', 'No', 'No', 'Own account only'],
              ['Courses and Sections', 'Manage', 'Manage', 'View assigned', 'No', 'View assigned', 'View enrolled', 'View linked-student context'],
              ['Academic Cycles and Cohorts', 'Manage', 'Manage', 'Read academic context', 'No', 'Read academic context', 'Read own context', 'Read linked-student context'],
              ['Timetable and Attendance', 'Manage schedules, view all, review attendance', 'Manage schedules, view all, review attendance', 'Assigned schedule ownership for marking', 'No', 'Assigned schedule ownership for marking', 'View self', 'View linked'],
              ['Assessments and Grades', 'Review and finalize', 'Review and finalize', 'Assigned academic scope and finalization review', 'No', 'Assigned creation, grading, publish/finalize flow', 'View own visible grades', 'View linked visible grades'],
              ['Finance', 'Manage', 'Read/audit where allowed', 'No', 'Manage', 'Self/assigned finance view where allowed', 'View and claim own payments', 'View linked-student fees'],
              ['Settings and GPA Policies', 'Manage', 'Manage GPA/academic settings where allowed', 'No', 'No', 'No', 'No', 'No'],
              ['Chat and Mail', 'Org-level communication', 'Org-level communication', 'Academic-scope communication', 'Finance mail and limited direct chat', 'Assigned academic communication', 'Assigned-teacher chat and own mail limits', 'Admin/finance/support communication'],
            ],
          },
          {
            type: 'note',
            title: 'Scope matters',
            text: 'Manager and Teacher access is not school-wide by default. Their student, transcript, attendance, and group-chat access follows assigned academic sections where the workflow depends on student data.',
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
            type: 'table',
            headers: ['Rule', 'What happens'],
            rows: [
              ['Account status and organization status', 'Backend access checks can limit read or write actions when an organization is inactive, suspended, rejected, or still pending.'],
              ['Frontend navigation', 'The sidebar hides pages that do not belong to the signed-in role, but backend guards still decide the final authority.'],
              ['Assigned-section filtering', 'Teachers and Managers only see or change academic records connected to their assigned sections where the workflow is scoped.'],
              ['Linked-student filtering', 'Guardians see only students linked to their guardian account.'],
              ['Finance separation', 'Finance Managers handle finance workflows; Managers do not receive finance management access.'],
            ],
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
              ['Transaction', 'A confirmed money record tied to an entry, such as a confirmed fee payment or salary payment.'],
              ['Audit Log', 'A history record that explains what changed, who changed it, when it changed, and what finance item it affected.'],
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
    related: ['courses-sections', 'academic-cycles', 'cohorts-promotions', 'gradebook', 'fees', 'transcripts', 'csv-imports'],
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
                'Student profile editing does not change placement. Use the dedicated enrollment management page from the student record to change cohort or section enrollment.',
                'Changing placement can affect what the student sees in their portal, so review the cohort and section list before confirming enrollment changes.',
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
    related: ['courses-sections', 'assessments-grading', 'timetable', 'csv-imports'],
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
              'Attendance marking is allowed only for schedules owned by that teacher.',
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
    related: ['teachers', 'materials', 'gpa-policies', 'gradebook', 'evaluations-feedback', 'csv-imports'],
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
              'Choose a default room when the class usually meets in the same place. The schedule room still decides the actual timetable location.',
                'Open the section detail page to manage schedules, materials, assessments, and attendance. Use enrollment management screens for student placement changes.',
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
    related: ['gpa-policies', 'students', 'cohorts-promotions', 'transcripts', 'academic-calendar'],
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
          {
            type: 'table',
            headers: ['Role', 'Academic cycle access'],
            rows: [
              ['Admin/Sub Admin', 'Can create, update, activate, delete where safe, and choose cycle GPA policy.'],
              ['Manager/Teacher/Student', 'Can read cycle context used by assigned or enrolled academic work.'],
              ['Guardian', 'Can see cycle context through linked-student records.'],
              ['Finance Manager', 'No academic cycle management access.'],
            ],
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
    slug: 'academic-calendar',
    title: 'Academic Calendar',
    description: 'Create holidays, events, closures, and exam breaks that appear over timetable and attendance planning.',
    category: 'Academics',
    tags: ['academic calendar', 'holidays', 'events', 'closures', 'timetable'],
    related: ['academic-cycles', 'timetable', 'attendance', 'announcements'],
    sections: [
      {
        id: 'calendar-purpose',
        title: 'Calendar purpose',
        tags: ['holidays', 'events', 'planning'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The academic calendar records school-wide or department-specific dates that affect normal teaching activity. Use it for holidays, exam breaks, events, closures, and other timetable overlays.',
          },
          {
            type: 'list',
            items: [
              'Create calendar items before staff build or review timetable plans for that period.',
              'Use clear titles because they appear in calendar and timetable context.',
              'Deactivate old items instead of deleting them when they explain historical timetable decisions.',
            ],
          },
        ],
      },
      {
        id: 'calendar-item-setup',
        title: 'Calendar item setup',
        tags: ['create item', 'date range', 'time'],
        blocks: [
          {
            type: 'steps',
            items: [
              'Open the academic calendar area and choose New Item.',
              'Choose the item type: holiday, exam break, event, or closure.',
              'Select the match mode that fits the date pattern.',
              'Enter the start date and end date. For single-day items, the end date follows the start date.',
              'Choose full day or enter start and end times for partial-day events.',
              'Save the item, then review timetable and attendance screens that fall inside the date range.',
            ],
          },
          {
            type: 'table',
            headers: ['Match mode', 'Use it when'],
            rows: [
              ['Single day', 'The item happens on one date only.'],
              ['Date range', 'The item covers a continuous start-to-end range.'],
              ['Selected weekdays in range', 'The item repeats only on chosen weekdays during the range.'],
              ['Every day in range', 'Every date in the range should be treated as covered.'],
            ],
          },
        ],
      },
      {
        id: 'calendar-scope',
        title: 'Department scope',
        tags: ['department', 'scope'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Calendar items can apply to all departments or only selected departments. Department scope helps a school record events such as a science lab closure without affecting unrelated classes.',
          },
          {
            type: 'list',
            items: [
              'Use all departments for school-wide holidays, full campus closures, and major events.',
              'Use selected departments for department trips, lab closures, exam windows, or program-specific events.',
              'Check department assignment on courses, students, and rooms when a calendar item seems missing from a filtered view.',
            ],
          },
        ],
      },
      {
        id: 'calendar-announcements',
        title: 'Announcements',
        tags: ['announcement', 'communication'],
        blocks: [
          {
            type: 'paragraph',
            text: 'When a calendar item needs communication, create an announcement from the calendar form. This keeps the schedule record and the user-facing notice aligned.',
          },
          {
            type: 'note',
            title: 'Review before announcing',
            text: 'Confirm the date range, department scope, and priority before sending an announcement. Calendar edits do not always mean every recipient has read the updated notice.',
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
            text: 'Every schedule belongs to exactly one teacher. Sections can still have multiple assigned teachers, but each schedule slot must choose one teacher from that section teacher pool.',
          },
          {
            type: 'list',
            items: [
              'Section create and edit pages manage the teacher pool for a section.',
              'If a section has one teacher, schedule forms default to that teacher. If a section has multiple teachers, the schedule must explicitly choose one.',
              'Student timetables remain section-based and show schedules for enrolled sections.',
              'Teachers only see schedule slots assigned to them.',
              'The teacher name shown on a timetable slot is the teacher selected for that slot.',
              'Removing a teacher from a section requires moving or deleting any schedules owned by that teacher.',
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
            text: 'Repeating a schedule Monday through Friday creates the same class time for each weekday. Use it only when the class truly meets at the same time, room, and teacher every weekday.',
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
            text: 'EduVerse checks for section, room, student, and selected-teacher clashes before saving a schedule. Conflict messages identify the conflicting teacher, student, or room and show where that resource is already occupied.',
          },
          {
            type: 'list',
            items: [
              'A teacher should not be assigned to two class slots at the same time.',
              'A structured room should not be assigned to two class slots at the same time. Rooms with the same name in different buildings are treated separately.',
              'A student should not be enrolled in two overlapping class slots.',
              'End time must be later than start time.',
              'If a conflict appears, use the named conflicting schedule to decide whether to change the new slot or update the existing one.',
            ],
          },
        ],
      },
      {
        id: 'date-and-admin-view',
        title: 'Date and admin view',
        tags: ['date', 'admin', 'daily timetable'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The timetable shows the general weekly view when no date is selected. Selecting a specific date narrows the timetable to that date/day. Admin users do not see a synthetic organization-wide timetable on first visit because it would not represent a usable whole-school schedule.',
          },
          {
            type: 'list',
            items: [
              'Leave the date blank for the full weekly timetable.',
              'Use the previous and next buttons beside the date picker to move one day at a time after choosing a date.',
              'Admins should select a teacher, room, or student before reviewing a timetable.',
              'Compact slots still show clickable room and teacher links.',
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
    related: ['timetable', 'students', 'teachers', 'academic-calendar', 'csv-imports'],
    sections: [
      {
        id: 'attendance-workflow',
        title: 'Attendance workflow',
        tags: ['sheet', 'records'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Attendance is recorded for class activity and becomes part of the student record. Only the teacher who owns the selected schedule slot can mark attendance for that slot; admins can review wider attendance coverage but cannot mark it.',
          },
          {
            type: 'list',
            items: [
              'Use the attendance sheet to mark students as present, absent, late, or another available status.',
              'Review the selected date and class before saving attendance.',
              'If a section has multiple teachers, choose the schedule slot owned by the teacher who is marking attendance.',
              'Organization admins and sub-admins see attendance in overview mode only.',
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
    related: ['assessments-grading', 'submissions', 'evaluations-feedback', 'transcripts'],
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
      {
        id: 'grade-finalization-flow',
        title: 'Grade finalization flow',
        tags: ['finalization', 'transcripts', 'manager review'],
        blocks: [
          {
            type: 'flow',
            title: 'Grade finalization flow',
            steps: ['Teacher enters or publishes grades', 'Manager, Admin, or Sub Admin reviews readiness', 'Grades are finalized', 'Transcript uses finalized grades and the cycle GPA snapshot'],
          },
          {
            type: 'table',
            headers: ['Role', 'Finalization responsibility'],
            rows: [
              ['Teacher', 'Creates assessments, grades submissions, publishes grades, and finalizes assigned work where allowed by the workflow.'],
              ['Manager', 'Reviews assigned academic scope and can finalize where allowed.'],
              ['Admin', 'Can review and finalize organization academic records.'],
              ['Sub Admin', 'Can review and finalize operational academic records.'],
              ['Student and Guardian', 'Can view visible/finalized results but cannot finalize grades.'],
              ['Finance Manager', 'No grade-finalization access.'],
            ],
          },
          {
            type: 'note',
            title: 'Transcript consequence',
            text: 'Only finalized grades are treated as official transcript data. Draft and Published grades remain outside official transcript calculation.',
          },
        ],
      },
    ],
  },
    {
      slug: 'evaluations-feedback',
    title: 'Evaluations and Feedback',
    description: 'Collect concise course and teacher feedback from eligible enrolled students.',
    category: 'Academics',
    tags: ['evaluations', 'feedback', 'ratings', 'teacher feedback', 'course feedback'],
    related: ['student-guide', 'teacher-guide', 'manager-guide', 'admin-guide', 'courses-sections', 'gradebook'],
    sections: [
      {
        id: 'eligibility',
        title: 'Eligibility rules',
        tags: ['eligibility', 'finalized grades', 'evaluation window'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Evaluations open only for real academic history. A student can evaluate a section after the student is enrolled, at least one grade in that section is finalized, and an active evaluation window covers the academic cycle, course, or section.',
          },
          {
            type: 'table',
            headers: ['Requirement', 'What it protects'],
            rows: [
              ['Enrolled student', 'Prevents feedback from students who did not take the class.'],
              ['Assigned teacher for teacher feedback', 'Prevents rating unrelated teachers.'],
              ['Finalized grade in the section', 'Collects feedback after meaningful course experience.'],
              ['Active evaluation window', 'Keeps feedback inside the review period chosen by Admin or Sub Admin.'],
            ],
          },
        ],
      },
      {
        id: 'student-workflow',
        title: 'Student workflow',
        tags: ['student', 'submission'],
        blocks: [
          {
            type: 'steps',
            items: [
              'Open the Evaluations tab from the student portal.',
              'Review pending teacher and course evaluation cards.',
              'Select a 1-5 star rating.',
              'Add concise optional feedback if it helps explain the rating.',
              'Submit before the evaluation window closes.',
            ],
          },
          {
            type: 'note',
            title: 'Keep feedback useful',
            text: 'Feedback should describe what helped learning and what could improve. Inappropriate language is blocked before feedback is saved.',
          },
        ],
      },
      {
        id: 'visibility',
        title: 'Visibility rules',
        tags: ['visibility', 'privacy', 'moderation'],
        blocks: [
          {
            type: 'table',
            headers: ['Feedback type', 'Who can see it', 'Important boundary'],
            rows: [
              ['Teacher feedback', 'The evaluated teacher, Admin, Sub Admin, and scoped Manager views.', 'Teacher feedback text is not shown to unrelated teachers or students.'],
              ['Course feedback', 'Admin, Sub Admin, scoped Manager, and anonymized summary views where available.', 'Course feedback is anonymized outside management contexts.'],
              ['Hidden feedback', 'Management users can review moderation status.', 'Hidden text is excluded from public or anonymized feedback lists.'],
            ],
          },
        ],
      },
      {
        id: 'management',
        title: 'Admin and manager review',
        tags: ['admin', 'manager', 'windows', 'moderation'],
        blocks: [
          {
            type: 'list',
            items: [
              'Admin and Sub Admin users create evaluation windows by academic cycle, optionally narrowing to a course or section.',
              'Managers review feedback only inside their assigned and scoped academic sections.',
              'Evaluation lists can be filtered by cycle, course, section, teacher, rating, feedback presence, and visibility.',
              'Moderation hides or shows written feedback without changing the submitted rating.',
            ],
          },
        ],
      },
      ],
    },
    {
      slug: 'preference-windows',
      title: 'Preference Windows',
      description: 'Let students rank course or section options while final enrollment stays controlled by staff.',
      category: 'Academics',
      tags: ['preferences', 'section choice', 'course choice', 'voting', 'ranked choice', 'announcements'],
      related: ['students', 'courses-sections', 'cohorts-promotions', 'announcements', 'student-guide'],
      sections: [
        {
          id: 'purpose',
          title: 'What preference windows do',
          tags: ['purpose', 'ranked choice'],
          blocks: [
            {
              type: 'paragraph',
              text: 'Preference windows collect ranked student choices between existing course or section options. They are advisory: staff still control final cohort and section enrollment.',
            },
            {
              type: 'list',
              items: [
                'Use section choice when students choose between equivalent sections of an existing course or offering.',
                'Use course choice when students choose between existing course options for the next placement step.',
                'Options must already exist as courses or sections with schedules before a window is opened.',
                'Preference windows do not create courses, sections, teachers, rooms, or schedules.',
              ],
            },
          ],
        },
        {
          id: 'opening-window',
          title: 'Opening a window',
          tags: ['admin', 'sub admin', 'manager', 'announcement'],
          blocks: [
            {
              type: 'steps',
              items: [
                'Open Preference Windows from the Academics navigation.',
                'Create a draft and choose Section choice or Course choice.',
                'Select existing section or course options.',
                'Choose the audience by course, cohort, or section. If a course audience is selected, its sections are already included.',
                'Set start time and deadline.',
                'Activate the window to publish it and create high-priority announcements for the selected audience.',
              ],
            },
            {
              type: 'note',
              title: 'Announcements are the call to action',
              text: 'Activated preference windows create announcements with a link to the student choice page. Use urgent priority only when the window needs immediate attention.',
            },
          ],
        },
        {
          id: 'student-voting',
          title: 'Student voting experience',
          tags: ['student', 'portal', 'ranking'],
          blocks: [
            {
              type: 'paragraph',
              text: 'Students see open preference windows in the Preferences tab of the student portal and from the announcement deep link. They rank every available option before the deadline.',
            },
            {
              type: 'steps',
              items: [
                'Open the announcement or the Preferences tab.',
                'Review option cards with course, section, teacher, schedule, room, and capacity context where available.',
                'Move options up or down until the order matches the student preference.',
                'Submit before the deadline. If the window is still open, the student can update the ranking.',
                'After the deadline, submitted rankings remain visible for review but cannot be changed.',
              ],
            },
          ],
        },
        {
          id: 'results-and-enrollment',
          title: 'Results and enrollment',
          tags: ['results', 'enrollment', 'admin'],
          blocks: [
            {
              type: 'list',
              items: [
                'Results show audience size, submitted count, pending count, first-choice votes, rank distribution, and student-by-student rankings.',
                'For section-choice windows, Admin and Sub Admin users can enroll a student into one of the polled sections directly from results.',
                'The quick enroll action uses the dedicated enrollment workflow and stops if the student is already enrolled in that section.',
                'Capacity and schedule issues are warnings only; they do not block staff from enrolling a student.',
                'There is no automatic allocation in this version.',
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
    slug: 'ai-copilot',
    title: 'AI Copilot',
    description: 'Use EduVerse AI Copilot as a role-aware academic and operations assistant.',
    category: 'Operations',
    tags: ['ai', 'copilot', 'credits', 'subscription', 'study assistant'],
    related: ['payments-billing', 'settings', 'roles-permissions', 'timetable', 'dashboard-insights'],
    sections: [
      {
        id: 'what-copilot-does',
        title: 'What Copilot does',
        tags: ['overview', 'role aware', 'permissions'],
        blocks: [
          {
            type: 'paragraph',
            text: 'EduVerse AI Copilot is a premium assistant that helps users understand their work, plan next steps, and find useful information inside EduVerse. It is role-aware, schedule-aware, and permission-aware.',
          },
          {
            type: 'list',
            items: [
              'Copilot uses the signed-in user role, organization context, current permissions, schedule, academic records, docs, and recent conversation context where allowed.',
              'Copilot is read-only. It can explain, summarize, plan, and guide, but it does not directly create, edit, delete, approve, or finalize records.',
              'Copilot never grants extra access. A personal AI subscription only unlocks Copilot for that user; it does not unlock data the user could not normally view.',
              'Copilot keeps enough recent conversation context to answer natural follow-up questions without requiring the user to repeat everything.',
            ],
          },
        ],
      },
      {
        id: 'role-capabilities',
        title: 'Role capabilities',
        tags: ['student', 'teacher', 'manager', 'org admin', 'guardian'],
        blocks: [
          {
            type: 'table',
            headers: ['Role', 'Copilot focus', 'Useful questions'],
            rows: [
              ['Student', 'Study coach, schedule-aware planner, deadline assistant, attendance advisor, course guidance, evaluation explanations, and personalized study plans.', 'What should I study today? What classes do I have tomorrow? Why is my attendance at risk? Explain my weakest course.'],
              ['Teacher', 'Teaching workload assistant for next classes, weekly schedule, pending grading, attendance reminders, preparation ideas, and students who may need attention.', 'What do I teach next? Summarize my week. What grading is pending? Which students need attention?'],
              ['Manager', 'Academic operations assistant for department summaries, workload analysis, staffing concerns, attendance trends, evaluation trends, and schedule bottlenecks.', 'Summarize today\'s academic activity. Show workload issues. Which departments need attention? Identify scheduling bottlenecks.'],
              ['Org Admin', 'Organization health assistant for operations, AI usage, AI Credits, estimated cost, subscription management, and role access configuration.', 'How much AI usage do we have left? Which roles are using Copilot most? Show organization health. Should we enable Copilot for students?'],
              ['Finance Manager', 'Finance-focused assistant for fee status, payment claim review context, finance summaries, and permitted finance workflow guidance.', 'Which payment claims need review? Summarize unpaid balances. What finance activity changed recently?'],
              ['Guardian', 'Linked-student assistant for attendance, grades, timetable, fee status, and school guidance where the guardian already has access.', 'How is my linked student doing? Are there attendance concerns? What fees need attention?'],
            ],
          },
          {
            type: 'note',
            title: 'Same permissions, better guidance',
            text: 'Copilot answers are limited by the same access rules as the rest of EduVerse. For example, a teacher can receive help for assigned sections, while a guardian can only receive linked-student context.',
          },
        ],
      },
      {
        id: 'schedule-aware-help',
        title: 'Schedule-aware help',
        tags: ['timetable', 'schedule', 'planning'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Schedules are a primary Copilot data source. Copilot can use timetable context to make study plans, teacher briefings, and management summaries more practical.',
          },
          {
            type: 'table',
            headers: ['Role', 'Schedule examples'],
            rows: [
              ['Student', 'Plan study time around today\'s classes, tomorrow\'s classes, upcoming deadlines, and attendance risk.'],
              ['Teacher', 'Prepare for the next class, review today\'s classes, summarize next week, and spot pending attendance or grading work.'],
              ['Manager', 'Review overloaded teachers, schedule density, room/time bottlenecks, and departments that may need attention.'],
              ['Org Admin', 'Review organization-level schedule health and operational bottlenecks where the admin has access.'],
            ],
          },
        ],
      },
      {
        id: 'availability-and-credits',
        title: 'Availability and credits',
        tags: ['subscription', 'credits', 'quota'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Copilot is available only when the user has an active organization-funded or personal AI subscription source with remaining AI Credits.',
          },
          {
            type: 'list',
            items: [
              'Organization subscriptions are managed by Org Admins and can enable Copilot for selected roles.',
              'Org Admins can set monthly AI Credit caps per role, such as students, teachers, managers, finance managers, sub admins, guardians, and org admins.',
              'Organization AI Credits are used before personal AI Credits when both are available.',
              'If organization credits run out, org-funded Copilot stops for everyone unless a user also has an active personal subscription.',
              'Personal subscriptions unlock Copilot only for the purchasing user and use that user\'s personal monthly AI Credits.',
            ],
          },
          {
            type: 'note',
            title: 'Student access warning',
            text: 'Enabling Copilot for students can increase usage quickly because student accounts are usually the largest group in an organization. Review role caps and usage trends before enabling broad student access.',
          },
        ],
      },
      {
        id: 'usage-and-history',
        title: 'Usage and history',
        tags: ['dashboard', 'history', 'cost'],
        blocks: [
          {
            type: 'list',
            items: [
              'Org Admins can review organization usage, credits, trends, active users, feature usage, and estimated cost.',
              'Individual users can review their own personal usage and remaining credits where a personal or enabled organization subscription applies.',
              'Copilot chats can be reopened from history. Each chat keeps a simple editable title based on the first message.',
              'Only a recent chunk of conversation history is sent back to Copilot for follow-up context.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'payments-billing',
    title: 'Payments and Billing',
    description: 'Understand school payment verification and AI subscription billing flows.',
    category: 'Operations',
    tags: ['payments', 'billing', 'subscription', 'checkout', 'finance'],
    related: ['finance', 'fees', 'ai-copilot', 'settings'],
    sections: [
      {
        id: 'two-payment-flows',
        title: 'Two payment flows',
        tags: ['school fees', 'ai subscription'],
        blocks: [
          {
            type: 'paragraph',
            text: 'EduVerse separates school finance payments from EduVerse AI subscription billing. They look related because both involve payment status, but they are handled by different workflows.',
          },
          {
            type: 'table',
            headers: ['Flow', 'Used for', 'How it works'],
            rows: [
              ['School finance payments', 'Student fees, staff payroll, and organization finance records.', 'Users submit payment claims or staff record verified payments. Finance staff review proof, confirm or reject claims, and maintain transactions and audit logs.'],
              ['AI subscription billing', 'Premium EduVerse AI Copilot packages for an organization or individual user.', 'The user opens the AI subscription page, chooses a package, completes the hosted checkout, and EduVerse updates access after the subscription is confirmed.'],
            ],
          },
        ],
      },
      {
        id: 'school-payment-process',
        title: 'School payment process',
        tags: ['payment claim', 'verification', 'finance'],
        blocks: [
          {
            type: 'flow',
            title: 'Manual verification flow',
            steps: ['Finance entry is created', 'Student or assigned user submits a payment claim', 'Finance staff review receipt, reference, amount, and payer', 'Payment is confirmed or rejected', 'Balance, transaction history, and audit logs update'],
          },
          {
            type: 'list',
            items: [
              'A payment claim is not paid until an allowed staff member verifies it.',
              'A user cannot confirm their own claim.',
              'Partial confirmation is used when only part of the balance was verified.',
              'Transactions show confirmed money records; audit logs show the action history behind finance changes.',
            ],
          },
        ],
      },
      {
        id: 'ai-subscription-process',
        title: 'AI subscription process',
        tags: ['ai', 'subscription', 'checkout', 'billing portal'],
        blocks: [
          {
            type: 'flow',
            title: 'AI subscription flow',
            steps: ['Open AI Usage', 'Choose View or change subscription', 'Select an organization or personal package', 'Complete secure checkout', 'Return to EduVerse', 'Copilot unlocks after subscription confirmation and role access checks'],
          },
          {
            type: 'table',
            headers: ['Subscription type', 'Who manages it', 'Who receives access'],
            rows: [
              ['Organization AI subscription', 'Org Admin only.', 'Selected roles in the organization, according to Org Admin role access settings and monthly credit caps.'],
              ['Personal AI subscription', 'The individual user.', 'Only the purchasing user. It does not change organization permissions or reveal extra records.'],
            ],
          },
          {
            type: 'note',
            title: 'Hosted checkout',
            text: 'AI subscription checkout and subscription management use a secure hosted billing flow. EduVerse uses the checkout result to update Copilot access, credits, and billing-period status.',
          },
        ],
      },
      {
        id: 'billing-management',
        title: 'Billing management',
        tags: ['portal', 'cancel', 'renewal', 'credits'],
        blocks: [
          {
            type: 'list',
            items: [
              'Org Admins manage organization AI packages from the AI subscription page.',
              'Users manage personal AI packages from the AI subscription page.',
              'After a subscription exists, the billing portal can be used to view or change the package where available.',
              'Monthly AI Credits reset with the active subscription billing period.',
              'If checkout or billing confirmation is delayed, Copilot access may update after the billing provider sends the subscription event.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'finance',
    title: 'Finance',
    description: 'Manage fee structures, staff payroll, entries, payment claims, confirmed transactions, and finance audit history.',
    category: 'Operations',
    tags: ['finance', 'fee', 'structure', 'payment', 'transaction'],
    related: ['students', 'roles-permissions', 'fees'],
    sections: [
      {
        id: 'finance-access',
        title: 'Who can use finance',
        tags: ['roles', 'finance manager', 'permissions'],
        blocks: [
          {
            type: 'table',
            headers: ['Role', 'Finance access'],
            rows: [
              ['Admin', 'Can manage finance structures, entries, claims, payment confirmation, staff payroll, transactions, and audit logs.'],
              ['Sub Admin', 'Can review finance where allowed and can also have their own payroll records.'],
              ['Finance Manager', 'Can manage finance structures, entries, claims, payment confirmation, staff payroll, transactions, and audit logs. Finance Managers can also have their own payroll records.'],
              ['Manager', 'No finance management access. Managers focus on academic oversight.'],
              ['Teacher', 'Can view their own salary records where exposed by the portal.'],
              ['Student', 'Can view own fees and submit payment claims.'],
              ['Guardian', 'Can view linked-student fee status from the guardian portal.'],
            ],
          },
          {
            type: 'flow',
            title: 'Finance manager flow',
            steps: ['Open Finance', 'Review structures or entries', 'Check payment claims', 'Verify proof', 'Confirm or reject payment', 'Review transactions', 'Use audit logs when you need to see the full change history'],
          },
        ],
      },
      {
        id: 'finance-tabs',
        title: 'Finance tabs',
        tags: ['overview', 'structures', 'entries', 'transactions', 'audit logs', 'payroll'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Finance workspace is split into tabs so each kind of finance work has a clear place. Use the tab that matches the question you are trying to answer.',
          },
          {
            type: 'table',
            headers: ['Tab', 'Use it for', 'Plain meaning'],
            rows: [
              ['Overview', 'A quick summary of income, expenses, unpaid balances, and recent finance activity.', 'Use this when you want the big picture.'],
              ['Structures', 'Creating and editing reusable plans for fees, salaries, staff payments, and other income or expenses.', 'Use this when you want to define what should be charged or paid.'],
              ['Entries', 'Viewing the actual amounts due for students, teachers, sub admins, finance managers, or other targets.', 'Use this when you want to know who owes money or who needs to be paid.'],
              ['Transactions', 'Viewing confirmed money records after a payment has been accepted or recorded.', 'Use this when you want the money record.'],
              ['Payroll', 'Reviewing salary and payment records for teachers, sub admins, and finance managers.', 'Use this when you want staff payment status by role.'],
              ['Audit Logs', 'Reviewing the full history of finance changes, including who did what and what record was affected.', 'Use this when you want the story behind a change.'],
            ],
          },
          {
            type: 'note',
            title: 'Transactions are not audit logs',
            text: 'A transaction says money was confirmed. An audit log says what happened in the system. For example, confirming a payment creates a transaction, but the audit log also records who confirmed it, when it happened, what entry or claim was affected, and the before/after details where available.',
          },
        ],
      },
      {
        id: 'finance-structures',
        title: 'Finance structures',
        tags: ['amount', 'billing cycle'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Finance structures define reusable recurring or one-time plans, such as tuition, admission fees, teacher salary, sub admin salary, finance manager salary, vendor expenses, or other school-defined amounts.',
          },
          {
            type: 'tip',
            title: 'Plain meaning',
            text: 'A financial structure is the plan for a charge or expense. A financial entry is the actual amount due for a person or target after that plan is applied.',
          },
          {
            type: 'list',
            items: [
              'A structure is created once, then assigned to students, teachers, sub admins, finance managers, sections, cohorts, courses, or another income/expense entity.',
              'Student structures are income for the school. Teacher, sub admin, finance manager, and other expense structures are expenses for the school.',
              'Amounts support cents, so values such as 1250.50 can be saved and shown correctly.',
              'Generated entries track payment state separately from the structure definition.',
              'Timed entries generated by the finance scheduler create in-app notifications and web push notifications when push is enabled.',
              'School finance payment verification is recorded inside EduVerse. AI subscription checkout is handled separately from school fee and payroll workflows.',
            ],
          },
          {
            type: 'note',
            title: 'Before creating a structure',
            text: 'Check the target type, assignment scope, amount, category, billing cycle, due day, and start date. The structure is the plan; assignments decide who or what receives generated entries.',
          },
          {
            type: 'note',
            title: 'Editing a structure',
            text: 'When editing a structure, you can choose whether current outstanding assigned entries should be updated. Only entries that still need action are eligible. Paid and cancelled entries are left alone.',
          },
          {
            type: 'table',
            headers: ['Item', 'What it means', 'Common mistake'],
            rows: [
              ['Structure', 'The reusable billing or expense template.', 'Creating a separate structure for every student when one assigned structure is enough.'],
              ['Assignment', 'The student, staff member, group, course, or entity attached to the structure.', 'Forgetting that course assignment includes students through all matching sections.'],
              ['Entry', 'A specific payable item generated for an assignment.', 'Treating an entry as paid before proof has been reviewed.'],
              ['Transaction', 'A confirmed ledger action tied back to an entry and target.', 'Recording unclear references that are hard to audit later.'],
              ['Audit Log', 'A history record for a finance change.', 'Looking only at transactions when you need to know who changed something.'],
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
              'Use decimal points when cents matter, such as 99.50 or 1250.75.',
              'For one-time structures, the amount usually represents the full charge.',
              'For recurring structures, the amount usually represents the value for each billing period.',
              'Changing an existing structure does not automatically rewrite old entries or transactions.',
              'If you choose to update current outstanding entries, paid and cancelled entries are still kept as they were.',
            ],
          },
        ],
      },
      {
        id: 'staff-payroll',
        title: 'Staff payroll',
        tags: ['payroll', 'teachers', 'sub admins', 'finance managers', 'salary'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Payroll is the staff payment side of finance. Teachers, Sub Admins, and Finance Managers can all receive assigned payment structures and generated payment entries.',
          },
          {
            type: 'table',
            headers: ['Staff group', 'Where to review it', 'What it shows'],
            rows: [
              ['Teachers', 'Payroll tab, Teachers view', 'Assigned salary structures, generated salary entries, paid amounts, unpaid balances, and overdue salary entries.'],
              ['Sub Admins', 'Payroll tab, Sub Admins view', 'Assigned payment structures, generated payment entries, paid amounts, unpaid balances, and profile links.'],
              ['Finance Managers', 'Payroll tab, Finance Managers view', 'Assigned payment structures, generated payment entries, paid amounts, unpaid balances, and profile links.'],
            ],
          },
          {
            type: 'list',
            items: [
              'Use teacher payment structures for teachers.',
              'Use sub admin payment structures for Sub Admin staff accounts.',
              'Use finance manager payment structures for Finance Manager staff accounts.',
              'Staff members can use My Finance to view their own assigned payroll records when their role has that view.',
              'Payroll entries are expenses for the school, not student fee income.',
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
              'A user cannot confirm their own claim. Another allowed staff member must review it.',
              'A claim can only be confirmed or rejected while it is still waiting for review.',
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
              ['Cancelled', 'The unpaid entry has been voided and should not be collected or paid.', 'Finance staff, only when cancellation is correct.'],
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
              'If a confirmed transaction needs correction later, use a reversal or refund record. Do not treat transaction editing as the normal correction method.',
              'Keep receipt and reference details readable so later audits make sense.',
            ],
          },
        ],
      },
      {
        id: 'transactions',
        title: 'Transactions',
        tags: ['transactions', 'confirmed payments', 'money records'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Transactions are confirmed money records. They are created after a payment or staff payout is accepted, confirmed, or reversed.',
          },
          {
            type: 'list',
            items: [
              'Use Transactions to answer money questions such as what was paid, how much was confirmed, which entry it belongs to, and which payment method or reference was used.',
              'Transactions should stay clear and stable. Corrections should happen through reversal or refund records instead of quietly changing the original money record.',
              'Transactions are useful for finance reporting, payment history, and checking confirmed income or expenses.',
            ],
          },
          {
            type: 'note',
            title: 'What transactions do not show',
            text: 'Transactions do not show every small system change. They do not replace audit logs. If you need to know who edited a structure, who rejected a claim, who cancelled an entry, or what changed before and after, use Audit Logs.',
          },
        ],
      },
      {
        id: 'finance-audit-logs',
        title: 'Audit logs',
        tags: ['audit logs', 'history', 'security', 'changes'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Audit logs show the history of finance actions. They are designed for review, accountability, and troubleshooting.',
          },
          {
            type: 'table',
            headers: ['Audit log shows', 'Why it matters'],
            rows: [
              ['Who acted', 'You can see the user or system action responsible for the change.'],
              ['What happened', 'You can see the action, such as structure update, entry generation, claim review, payment confirmation, cancellation, or reversal.'],
              ['What record was affected', 'You can open the related structure, entry, claim, or transaction when a link is available.'],
              ['When it happened', 'You can trace the timing of a finance event.'],
              ['Request details', 'IP and device details help with security review.'],
              ['Before and after details', 'Where available, the detail view explains what changed.'],
            ],
          },
          {
            type: 'table',
            headers: ['Use Transactions when...', 'Use Audit Logs when...'],
            rows: [
              ['You need the confirmed money record.', 'You need the full history of what changed.'],
              ['You are checking payment amount, method, reference, or date.', 'You are checking who created, edited, approved, rejected, cancelled, or reversed something.'],
              ['You are reviewing collected fees or staff payouts.', 'You are investigating a mistake, dispute, suspicious action, or missing context.'],
            ],
          },
          {
            type: 'note',
            title: 'Simple example',
            text: 'If a student payment is confirmed, Transactions show the confirmed payment. Audit Logs show the confirmation action, the person who did it, the affected entry or claim, time, request details, and related links.',
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
              'Editing a structure and expecting paid entries or transactions to rewrite automatically.',
              'Using Transactions to investigate system changes when Audit Logs are the right place.',
              'Assigning staff payroll under Other Expense instead of using Teacher, Sub Admin, or Finance Manager targets.',
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
      {
        id: 'communication-rules',
        title: 'Chat and mail rules',
        tags: ['chat rules', 'mail rules', 'roles'],
        blocks: [
          {
            type: 'table',
            headers: ['Role', 'Chat', 'Mail'],
            rows: [
              ['Admin/Sub Admin', 'Can start organization-level direct and group conversations according to admin rules.', 'Can contact organization users and platform support where available.'],
              ['Manager', 'Can message teachers and students in assigned academic scope and create academic groups for assigned sections.', 'Can contact Admin/Sub Admin and teachers; bulk mail is limited.'],
              ['Teacher', 'Can message Admin/Sub Admin/Manager and assigned students; can create section chats for assigned classes.', 'Can contact managers, Sub Admins, and teachers where available.'],
              ['Finance Manager', 'Limited direct chat with Admin/Sub Admin; no academic group creation.', 'Can send finance-related mail to students, guardians, Admins, and Sub Admins.'],
              ['Student', 'Can direct-message assigned teachers where available; cannot create groups.', 'Student mail submission is limited by the current school rules.'],
              ['Guardian', 'Can direct-message Admin/Sub Admin/Finance Manager where available; cannot create groups.', 'Can contact administration, finance, or platform support where available.'],
            ],
          },
          {
            type: 'note',
            title: 'Backend enforced',
            text: 'Hidden buttons are not the only protection. Chat and mail recipients are checked by the backend before conversations or mail threads are created.',
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
          {
            type: 'table',
            headers: ['Role', 'Cohort access'],
            rows: [
              ['Admin/Sub Admin', 'Can create, update, assign sections, add students, and manage cohort placement.'],
              ['Manager/Teacher', 'Can read academic cohort context and include/exclude students only in assigned section workflows where allowed.'],
              ['Student/Guardian', 'Can see cohort context only as part of their own or linked-student records.'],
              ['Finance Manager', 'No cohort management access.'],
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
    related: ['quick-start', 'school-setup-workflow', 'settings', 'academic-cycles', 'evaluations-feedback', 'finance'],
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
              ['Evaluation windows', 'Open and manage teacher/course feedback periods.', 'Feedback should be collected only after enough academic activity has happened.'],
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
              ['Opening evaluation windows', 'Students can submit evaluations only while a matching window is active.', 'Confirm grades have been finalized and the window scope is correct.'],
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
    slug: 'sub-admin-guide',
    title: 'Sub Admin Guide',
    description: 'A guide for delegated organization administration without main-admin ownership.',
    category: 'Role Guides',
    tags: ['sub admin', 'operations', 'users', 'academic setup'],
    related: ['roles-permissions', 'admin-guide', 'school-setup-workflow', 'academic-cycles', 'evaluations-feedback'],
    sections: [
      {
        id: 'sub-admin-role',
        title: 'What sub admins do',
        tags: ['responsibilities', 'operations'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Sub admins help run the organization workspace. They handle day-to-day user and academic operations while the main org admin remains the owner of the highest-risk organization controls.',
          },
          {
            type: 'table',
            headers: ['Area', 'Sub Admin can do', 'Boundary'],
            rows: [
              ['People', 'Create and update teachers, managers, students, guardians, and finance managers.', 'Sub admins do not create or manage main admin accounts.'],
              ['Academic setup', 'Manage cycles, cohorts, sections, schedules, promotions, and operational academic records.', 'Changes should follow the school academic plan.'],
              ['Grades', 'Review grade-finalization status and finalize where allowed.', 'Finalized grades become official transcript data.'],
              ['Evaluations', 'Create windows and review teacher/course feedback where delegated.', 'Feedback review follows department scope where applicable.'],
              ['Finance', 'View/audit finance where available.', 'Finance operations belong to Admin and Finance Manager roles.'],
            ],
          },
        ],
      },
      {
        id: 'sub-admin-flow',
        title: 'Daily flow',
        tags: ['flow', 'daily work'],
        blocks: [
          {
            type: 'flow',
            title: 'Operational flow',
            steps: ['Review dashboard', 'Create or update users', 'Check academic setup', 'Review schedules and cohorts', 'Monitor grade finalization', 'Escalate owner-level decisions to Admin'],
          },
          {
            type: 'note',
            title: 'Who can do this?',
            text: 'Use Sub Admin for trusted staff who should run operations but should not be the organization owner.',
          },
        ],
      },
    ],
  },
  {
    slug: 'manager-guide',
    title: 'Manager Guide',
    description: 'A guide for academic managers who monitor assigned sections, attendance, assessments, and grades.',
    category: 'Role Guides',
    tags: ['manager', 'academic monitoring', 'assigned sections', 'grade finalization'],
    related: ['roles-permissions', 'gradebook', 'evaluations-feedback', 'attendance', 'transcripts'],
    sections: [
      {
        id: 'manager-scope',
        title: 'Academic scope',
        tags: ['assigned sections', 'students'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Managers are academic oversight users. They work with students, teachers, attendance, assessments, and grades through the sections assigned to them.',
          },
          {
            type: 'table',
            headers: ['Can work with', 'Scope'],
            rows: [
              ['Students', 'Students in assigned sections.'],
              ['Teachers', 'Teachers connected to the same assigned sections.'],
              ['Attendance', 'Assigned academic sections.'],
              ['Assessments and grades', 'Assigned academic sections and finalization review where allowed.'],
              ['Evaluations', 'Teacher and course feedback for assigned academic sections.'],
              ['Transcripts', 'Students in assigned sections.'],
            ],
          },
          {
            type: 'note',
            title: 'Not a finance role',
            text: 'Managers do not manage finance structures, entries, payment claims, or organization settings. Those belong to Admin/Sub Admin/Finance Manager according to the workflow.',
          },
        ],
      },
      {
        id: 'manager-finalization-flow',
        title: 'Grade review flow',
        tags: ['finalization', 'review'],
        blocks: [
          {
            type: 'flow',
            title: 'Academic review flow',
            steps: ['Open assigned section or grade finalization dashboard', 'Review assessment status', 'Check missing or draft grades', 'Finalize only after review', 'Review evaluations after windows open', 'Transcript uses finalized results'],
          },
        ],
      },
    ],
  },
  {
    slug: 'finance-manager-guide',
    title: 'Finance Manager Guide',
    description: 'A guide for managing finance structures, entries, claims, transactions, and finance communication.',
    category: 'Role Guides',
    tags: ['finance manager', 'payments', 'claims', 'transactions'],
    related: ['finance', 'fees', 'roles-permissions', 'mail'],
    sections: [
      {
        id: 'finance-manager-work',
        title: 'Finance work',
        tags: ['entries', 'claims', 'transactions'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Finance managers focus on payment and ledger workflows. They are managed as organization users by the main admin portal, but their daily workspace is the finance area.',
          },
          {
            type: 'flow',
            title: 'Finance role flow',
            steps: ['Create or review finance structure', 'Generate or review entries', 'Receive payment claim', 'Verify proof', 'Confirm or reject payment', 'Review transactions', 'Check audit logs when you need the full change history'],
          },
          {
            type: 'table',
            headers: ['Task', 'Finance Manager role'],
            rows: [
              ['Structures and entries', 'Create and manage finance records where allowed.'],
              ['Payment claims', 'Review, confirm, or reject submitted claims.'],
              ['Transactions', 'Review confirmed money records and keep references clear.'],
              ['Audit logs', 'Review who changed finance records, what changed, and which entry, claim, structure, or transaction was affected.'],
              ['Payroll', 'Review staff payment records for teachers, Sub Admins, and Finance Managers where allowed.'],
              ['Communication', 'Use mail for finance-related contact with students, guardians, Admins, and Sub Admins.'],
            ],
          },
        ],
      },
      {
        id: 'finance-manager-boundaries',
        title: 'Boundaries',
        tags: ['access', 'limits'],
        blocks: [
          {
            type: 'note',
            title: 'Who can do this?',
            text: 'Finance Managers handle finance operations. They do not receive academic setup, teaching, grade, settings, or unrestricted group-chat power.',
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
    related: ['teachers', 'timetable', 'materials', 'assessments-grading', 'gradebook', 'evaluations-feedback'],
    sections: [
      {
        id: 'teacher-start',
        title: 'Where teachers start',
        tags: ['dashboard', 'assigned classes'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Teachers work from the classes and schedules assigned to them. If a class, timetable slot, attendance sheet, or assessment is missing, the first thing to check is whether the teacher is assigned to that section and whether the schedule slot is owned by that teacher.',
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
              ['Review feedback', 'Feedback page.', 'Teacher feedback appears only for the evaluated teacher and authorized management views.'],
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
    related: ['students', 'submissions', 'evaluations-feedback', 'fees', 'transcripts', 'chat'],
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
              ['Evaluations', 'Evaluations tab', 'Shows teacher and course feedback tasks after finalized grades and active windows unlock them.'],
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
    slug: 'guardian-guide',
    title: 'Guardian Guide',
    description: 'A simple guide for guardians viewing linked student records and fee status.',
    category: 'Role Guides',
    tags: ['guardian', 'linked students', 'parents', 'fees'],
    related: ['roles-permissions', 'student-guide', 'fees', 'communication'],
    sections: [
      {
        id: 'guardian-flow',
        title: 'Linked-student flow',
        tags: ['student switcher', 'linked students'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Guardian accounts are linked to one student at a time from the student record. When a guardian signs in, the portal shows the students linked to that guardian and lets them choose which student to view.',
          },
          {
            type: 'flow',
            title: 'Guardian flow',
            steps: ['Admin or Sub Admin creates guardian', 'Optional profile photo is cropped and uploaded', 'Guardian is linked from a student record', 'Guardian signs in', 'Guardian selects a linked student', 'Portal shows that student attendance, grades, timetable, and fees'],
          },
          {
            type: 'table',
            headers: ['Can view', 'Scope'],
            rows: [
              ['Student overview', 'Linked students only.'],
              ['Attendance', 'Linked-student attendance summaries.'],
              ['Grades and academic status', 'Linked-student visible grades and academic records.'],
              ['Fees', 'Linked-student finance entries and balances.'],
              ['Communication', 'Admin, Sub Admin, Finance Manager, or platform support where available.'],
            ],
          },
        ],
      },
      {
        id: 'guardian-boundaries',
        title: 'Privacy boundaries',
        tags: ['privacy', 'access'],
        blocks: [
          {
            type: 'note',
            title: 'Linked students only',
            text: 'A guardian cannot view another student by guessing a URL or ID. The backend checks that the selected student is linked to the signed-in guardian.',
          },
          {
            type: 'list',
            items: [
              'Edit a guardian account from Users > Guardians.',
              'Use the student edit form to link or unlink a guardian.',
              'Guardian profile photos use the same cropped profile-picture upload flow as staff and students.',
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
        id: 'user-registration-flow',
        title: 'User registration flow',
        tags: ['users', 'registration', 'guardians', 'finance managers'],
        blocks: [
          {
            type: 'flow',
            title: 'Recommended user flow',
            steps: ['Admin creates Sub Admins and Finance Managers as needed', 'Admin or Sub Admin creates teachers and managers', 'Admin or Sub Admin creates students', 'Admin or Sub Admin creates guardians', 'Guardian is linked to the student record', 'Users sign in and follow their role dashboard'],
          },
          {
            type: 'table',
            headers: ['User type', 'Managed from'],
            rows: [
              ['Sub Admin', 'Sub Admins page, by Admin.'],
              ['Finance Manager', 'Finance Managers page, by Admin or Sub Admin where allowed.'],
              ['Manager', 'Teachers area using the Manager role option.'],
              ['Teacher', 'Teachers area.'],
              ['Student', 'Students area.'],
              ['Guardian', 'Guardians area and student guardian link.'],
            ],
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
  {
    slug: 'campus-navigation',
    title: 'Campus Navigation',
    description: 'Use building and room details to create a searchable, image-supported campus directory.',
    category: 'Setup',
    tags: ['campus map', 'navigation', 'buildings', 'rooms', 'landmarks', 'directions'],
    related: ['departments-buildings-rooms', 'identification-codes', 'csv-imports', 'timetable'],
    sections: [
      {
        id: 'what-campus-navigation-is',
        title: 'What Campus Navigation Is',
        tags: ['campus map', 'directory', 'institute map'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Campus Navigation is a searchable institute map built from the existing Buildings and Rooms setup. It is not a drag-and-drop visual map. It groups buildings, floors, rooms, departments, images, landmarks, and directions so users can find a location quickly.',
          },
          {
            type: 'list',
            items: [
              'Buildings appear as main sections with their building image, code, departments, landmark, and directions.',
              'Floors are shown inside each building so users can narrow the location before choosing a room.',
              'Rooms appear with their room image, code, type, capacity, departments through the building, landmark, and directions note.',
              'Search can match room names, room codes, building names, building codes, floors, departments, landmarks, and directions notes.',
            ],
          },
          {
            type: 'note',
            title: 'Why it is directory-based',
            text: 'Most schools need reliable directions more than a complex editable graphic. A clear hierarchy with real photos is easier to maintain and more useful on phones.',
          },
        ],
      },
      {
        id: 'why-details-matter',
        title: 'Why Building and Room Details Matter',
        tags: ['images', 'landmarks', 'directions', 'floor', 'room code'],
        blocks: [
          {
            type: 'table',
            headers: ['Detail', 'Why it is useful', 'Where users see it'],
            rows: [
              ['Building image', 'Helps users recognize the building before they arrive.', 'Campus Navigation building section and building setup.'],
              ['Room image', 'Helps users recognize the correct door, lab, hall, office, or room interior. A hallway photo facing the room door is usually best.', 'Campus Navigation room cards, room detail dialog, and room setup.'],
              ['Building code', 'Gives a short stable identifier for search and CSV imports.', 'Building lists, room imports, Campus Navigation, and setup references.'],
              ['Room code', 'Lets users find a room without using database IDs.', 'Room lists, section schedules, CSV imports, Campus Navigation, and site search.'],
              ['Floor', 'Places the room inside the building hierarchy.', 'Campus Navigation floor groups, room setup, imports, and filters.'],
              ['Landmark', 'Gives a memorable nearby clue such as “near reception” or “beside library stairs.”', 'Campus Navigation and searchable location text.'],
              ['Directions note', 'Gives short human directions that a floor number alone cannot explain.', 'Campus Navigation building and room details.'],
              ['Room type', 'Helps users filter for labs, offices, halls, washrooms, meeting rooms, and other space types.', 'Room filters, Campus Navigation filters, imports, and setup forms.'],
              ['Sort order', 'Controls the order of buildings and rooms when natural alphabetical order is not enough.', 'Campus Navigation and setup views.'],
            ],
          },
          {
            type: 'tip',
            title: 'Use real photos',
            text: 'A simple building exterior photo and a room doorway photo often help more than a drawn map. For rooms, stand in the hall and capture the door clearly. If possible, include a visible room sign, arrow, or marker pointing to the correct door.',
          },
        ],
      },
      {
        id: 'setup-flow',
        title: 'Setup Flow',
        tags: ['setup', 'photos', 'rooms'],
        blocks: [
          {
            type: 'steps',
            items: [
              'Create departments first if buildings should be linked to academic or administrative areas.',
              'Create buildings with a clear name, code, optional image, landmark, and directions note.',
              'Create rooms under each building with a required floor, code, type, optional image, capacity, landmark, and directions note.',
              'For each room picture, prefer a hallway view that clearly shows the room door. Include the room sign or a marker pointing to the door when possible.',
              'Use room codes when importing sections or selecting default rooms.',
              'Open Campus Map from the sidebar and search by building, department, floor, room type, code, or landmark to confirm the directory is useful.',
            ],
          },
          {
            type: 'note',
            title: 'Floor is required',
            text: 'Every room needs a floor because Campus Navigation groups rooms by building and floor. If the school does not use floor numbers, use a consistent label such as Ground, Main, Basement, or Outdoor.',
          },
        ],
      },
      {
        id: 'room-detail-links',
        title: 'Room Detail Links',
        tags: ['timetable', 'room link', 'dialog'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Each room in Campus Navigation can open a room detail dialog with a larger room picture, room details, building details, departments, and scheduled section context. The selected room is kept in the URL so staff can send someone directly to the room view.',
          },
          {
            type: 'list',
            items: [
              'A room detail link uses the Campus Map page with a roomId in the URL.',
              'Timetable room actions open the same URL-backed room detail view.',
              'The room detail dialog shows the room picture large, but it does not repeat the building picture so the focus stays on finding the specific door or space.',
            ],
          },
        ],
      },
      {
        id: 'csv-and-codes',
        title: 'CSV and Codes',
        tags: ['csv', 'buildingCode', 'room code'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Campus Navigation depends on human-readable codes. Room CSV imports use buildingCode to connect each room to a building, and users should never need database IDs for navigation setup.',
          },
          {
            type: 'table',
            headers: ['Import', 'Important columns', 'Notes'],
            rows: [
              ['Buildings CSV', 'name, code, address, description, landmark, directionsNote, sortOrder, departmentCodes', 'Use building codes that staff can recognize and reuse.'],
              ['Rooms CSV', 'buildingCode, name, code, floor, type, capacity, landmark, directionsNote, sortOrder', 'buildingCode must match an existing building in the same school workspace.'],
            ],
          },
        ],
      },
      {
        id: 'future-visual-map',
        title: 'Future Visual Map',
        tags: ['future', 'visual map', 'coordinates'],
        blocks: [
          {
            type: 'paragraph',
            text: 'EduVerse keeps optional layout fields for future visual campus rendering, but Campus Navigation works fully without coordinates. Schools can get value today from structured hierarchy, photos, landmarks, and directions.',
          },
          {
            type: 'list',
            items: [
              'Do not wait for a visual editor before adding building and room details.',
              'Use images and directions for practical day-to-day navigation.',
              'Reserved map fields can support a future visual map without changing the building and room records again.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'identification-codes',
    title: 'Identification Codes',
    description: 'Use stable, human-readable codes for CSV imports and linked setup records.',
    category: 'Setup',
    tags: ['codes', 'csv', 'imports', 'setup', 'departments', 'rooms', 'sections'],
    related: ['csv-imports', 'departments-buildings-rooms', 'academic-cycles', 'cohorts-promotions', 'courses-sections'],
    sections: [
      {
        id: 'what-codes-are',
        title: 'What codes are',
        tags: ['human-readable', 'identifiers'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Identification codes are short, readable labels that users can type into CSV files instead of database IDs. EduVerse stores internal IDs in the background, but CSV templates use codes so schools can prepare imports without copying UUIDs.',
          },
          {
            type: 'list',
            items: [
              'Codes are required for departments, buildings, rooms, academic cycles, cohorts, courses, and sections.',
              'Codes are unique inside one school workspace. Another organization can reuse the same code.',
              'Codes are normalized before saving and lookup, so sci, Sci, and SCI are treated as SCI.',
              'Students, teachers, guardians, and other users do not need codes because they are referenced by email, roll number, registration number, or employee number where applicable.',
            ],
          },
        ],
      },
      {
        id: 'code-format',
        title: 'Code format',
        tags: ['format', 'examples'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Use uppercase letters, numbers, hyphens, or underscores. Keep codes short enough to read in tables and stable enough to reuse in future imports.',
          },
          {
            type: 'table',
            headers: ['Record', 'Good examples', 'Why it works'],
            rows: [
              ['Department', 'SCI, CS, FINANCE', 'Short department abbreviations are easy to reuse in student, teacher, course, and building imports.'],
              ['Building', 'MAIN, SCI-BLOCK, NORTH', 'Building codes identify where rooms belong.'],
              ['Room', 'ROOM-101, LAB-2, AUDITORIUM', 'Room codes identify schedulable spaces without exposing room IDs.'],
              ['Academic cycle', '2026-SPRING, AY-2026, TERM-1-2026', 'Cycle codes identify the academic period used by section imports.'],
              ['Cohort', 'GRADE-9, CS-2026, BATCH-A', 'Cohort codes identify student groups used by section imports and cohort management.'],
              ['Course', 'MATH-101, PHY-101, ENG-9', 'Course codes identify the parent course for section imports.'],
              ['Section', 'GRADE-9-A, PHY-101-MORN, CS-2026-A', 'Section codes identify the actual class section.'],
            ],
          },
          {
            type: 'tip',
            title: 'Naming advice',
            text: 'Avoid changing codes after CSV templates have been shared. If a code changes, future imports must use the new code.',
          },
        ],
      },
      {
        id: 'where-codes-are-used',
        title: 'Where codes are used',
        tags: ['csv columns', 'relationships'],
        blocks: [
          {
            type: 'table',
            headers: ['CSV column', 'Resolves to', 'Used in'],
            rows: [
              ['primaryDepartmentCode', 'Department', 'Student imports'],
              ['departmentCodes', 'Departments', 'Student, teacher, and building imports'],
              ['departmentCode', 'Department', 'Course imports'],
              ['buildingCode', 'Building', 'Room imports'],
              ['courseCode', 'Course', 'Section imports'],
              ['academicCycleCode', 'Academic cycle', 'Section imports'],
              ['cohortCode', 'Cohort', 'Section imports'],
              ['defaultRoomCode', 'Room', 'Section imports'],
            ],
          },
          {
            type: 'note',
            title: 'Internal IDs stay internal',
            text: 'The backend resolves each code to the matching internal ID during import. Users should not need UUIDs in CSV files.',
          },
        ],
      },
      {
        id: 'creating-codes',
        title: 'Creating codes',
        tags: ['setup', 'create'],
        blocks: [
          {
            type: 'steps',
            items: [
              'Create departments first, then use department codes when creating courses, buildings, students, or teachers.',
              'Create buildings before rooms, then use buildingCode in the room CSV template.',
              'Create academic cycles and cohorts manually before importing sections.',
              'Create courses before sections, then use courseCode in the section CSV template.',
              'Review list pages after creation. Codes are shown beside record names so users can copy the correct values into CSV files.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'csv-imports',
    title: 'CSV Imports',
    description: 'Import people, academic setup, rooms, and monthly attendance with templates, validation, and error reports.',
    category: 'Workflows',
    tags: ['csv', 'imports', 'templates', 'bulk upload'],
    related: ['identification-codes', 'students', 'teachers', 'courses-sections', 'departments-buildings-rooms', 'campus-navigation', 'attendance'],
    sections: [
      {
        id: 'import-flow',
        title: 'Import flow',
        tags: ['template', 'validate', 'confirm'],
        blocks: [
          {
            type: 'steps',
            items: [
              'Open the module that supports CSV import and choose the Import CSV action on that page.',
              'Download the template from the import modal. Keep the header row exactly as provided.',
              'Fill one record per row. Leave optional fields blank when they do not apply.',
              'Validate the CSV before importing. Validation checks headers, required fields, duplicates, formats, and linked records.',
              'Review valid and invalid row counts. Download the error CSV when rows need correction.',
              'Import valid rows, then refresh or review the module list.',
            ],
          },
          {
            type: 'note',
            title: 'Strict headers',
            text: 'CSV headers must match the template exactly. Renaming, reordering into unknown columns, or adding unsupported columns can make validation fail.',
          },
        ],
      },
      {
        id: 'supported-modules',
        title: 'Supported modules',
        tags: ['students', 'teachers', 'guardians', 'courses', 'sections', 'departments', 'buildings', 'rooms'],
        blocks: [
          {
            type: 'table',
            headers: ['Module', 'Who can import', 'Required columns', 'Relationship or optional columns'],
            rows: [
              ['Import students CSV', 'Org Admin or Sub Admin', 'name, email, password, registrationNumber, rollNumber, major, gender', 'phone, fatherName, age, address, admissionDate, graduationDate, emergencyContact, bloodGroup, status, primaryDepartmentCode, departmentCodes'],
              ['Import teachers CSV', 'Org Admin or Sub Admin', 'name, email, password, phone, education, designation, subject', 'department, joiningDate, emergencyContact, bloodGroup, address, status, departmentCodes'],
              ['Import guardians CSV', 'Org Admin or Sub Admin', 'name, email, password', 'phone, status, address'],
              ['Import courses CSV', 'Org Admin or Sub Admin', 'name, code', 'description, creditHours, departmentCode'],
              ['Import sections CSV', 'Org Admin or Sub Admin', 'name, code, courseCode, academicCycleCode', 'room, defaultRoomCode, cohortCode, color'],
              ['Import departments CSV', 'Org Admin only', 'name, code', 'description, color, isActive'],
              ['Import buildings CSV', 'Org Admin or Sub Admin', 'name, code', 'address, description, landmark, directionsNote, sortOrder, map fields, isActive, departmentCodes'],
              ['Import rooms CSV', 'Org Admin or Sub Admin', 'buildingCode, name, code, floor', 'type, capacity, description, landmark, directionsNote, sortOrder, map fields, isActive'],
            ],
          },
        ],
      },
      {
        id: 'relationship-fields',
        title: 'Relationship fields',
        tags: ['ids', 'linked records'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Code columns connect the imported row to records that already exist in the school workspace. Use the human-readable codes shown on list and detail pages instead of database IDs.',
          },
          {
            type: 'list',
            items: [
              'departmentCodes accepts multiple department codes separated by semicolons.',
              'primaryDepartmentCode, departmentCode, buildingCode, courseCode, academicCycleCode, defaultRoomCode, and cohortCode must belong to the same organization.',
              'Create departments, buildings, courses, academic cycles, cohorts, and rooms before importing records that reference them.',
              'Use buildingCode for room imports. Do not paste database IDs into navigation or CSV fields.',
              'Read the Identification Codes page for examples such as SCI, MAIN, ROOM-101, 2026-SPRING, GRADE-9, MATH-101, and GRADE-9-A.',
            ],
          },
        ],
      },
      {
        id: 'monthly-attendance-import',
        title: 'Monthly attendance import',
        tags: ['attendance', 'monthly', 'P A L E'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Import monthly attendance CSV from a section attendance page. The template contains name, rollNumber, and one column for each day in the selected month.',
          },
          {
            type: 'table',
            headers: ['Column/value', 'Meaning'],
            rows: [
              ['name and rollNumber', 'Must match a student enrolled in the selected section.'],
              ['P', 'Present'],
              ['A', 'Absent'],
              ['L', 'Late'],
              ['E', 'Excused'],
              ['Blank cell', 'Skipped; no attendance mark is created for that student on that date.'],
            ],
          },
          {
            type: 'list',
            items: [
              'Choose the year and month before downloading the attendance template.',
              'Choose whether marks should target the first official scheduled session or all official scheduled sessions owned by the importing teacher.',
              'Managers and teachers can import attendance only for schedule slots they own through schedule teacher assignment.',
              'Org Admins and Sub Admins can review attendance but cannot import attendance marks.',
            ],
          },
        ],
      },
      {
        id: 'cleanup-after-errors',
        title: 'Fixing errors',
        tags: ['errors', 'duplicates'],
        blocks: [
          {
            type: 'list',
            items: [
              'Use the error CSV to find the original row number and field message.',
              'Fix duplicate emails, registration numbers, roll numbers, department codes, building codes, or room names before validating again.',
              'Check date formats when admissionDate, graduationDate, or joiningDate fails validation.',
              'Use valid status values from the downloaded template examples.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'departments-buildings-rooms',
    title: 'Departments, Buildings, and Rooms',
    description: 'Set up department grouping, campus buildings, schedulable rooms, and department-scoped users.',
    category: 'Setup',
    tags: ['departments', 'buildings', 'rooms', 'setup', 'schedule rooms', 'scope'],
    related: ['campus-navigation', 'roles-permissions', 'courses-sections', 'timetable', 'school-setup-workflow', 'csv-imports'],
    sections: [
      {
        id: 'what-each-record-means',
        title: 'What Each Record Means',
        tags: ['departments', 'buildings', 'rooms'],
        blocks: [
          {
            type: 'table',
            headers: ['Record', 'Use it for', 'Do not use it for'],
            rows: [
              ['Department', 'Academic grouping, filtering, reporting, and scoped access for selected users.', 'Replacing courses, sections, cohorts, or enrollments.'],
              ['Building', 'Physical or logical campus locations such as Main Block or Science Block.', 'Primary permission rules.'],
              ['Room', 'The actual schedulable space used by section schedules and timetable conflict checks.', 'Broad academic grouping.'],
            ],
          },
          {
            type: 'note',
            title: 'Keep the jobs separate',
            text: 'A department describes academic or administrative scope. A building describes where rooms live. A room is the space selected for a schedule.',
          },
        ],
      },
      {
        id: 'department-setup',
        title: 'Department Setup',
        tags: ['department', 'scope', 'filters'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Departments are organization-defined groups such as Computer Science, English, Commerce, or Science. They make course, section, teacher, and student lists easier to filter and can limit what selected Sub Admins or Managers can manage.',
          },
          {
            type: 'list',
            items: [
              'Assign one department to a course when the course has a clear owner.',
              'Assign one or more departments to teachers when they work across academic groups.',
              'Assign a primary department and optional extra departments to students.',
              'Use All Departments for unrestricted Managers or Sub Admins, and Selected Departments when their work should stay inside a specific scope.',
            ],
          },
        ],
      },
      {
        id: 'buildings-and-room-setup',
        title: 'Buildings and Rooms',
        tags: ['buildings', 'rooms', 'capacity', 'campus navigation', 'images'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Buildings contain rooms. A room name only needs to be unique inside its building, so Main Block 101 and Science Block 101 can both exist. The same records also power Campus Navigation, so clear images, floors, landmarks, and directions make the campus directory more useful.',
          },
          {
            type: 'list',
            items: [
              'Create buildings before creating rooms.',
              'Optionally link buildings to departments to make filtering and suggestions easier.',
              'Upload a recognizable building image and room image when possible. These appear in the Campus Map directory.',
              'Set room floor, type, and capacity when known. Floor is required because rooms are grouped by building and floor.',
              'Use landmarks and directions notes for practical wayfinding, such as “near reception” or “use the east stairs.”',
              'Deactivate rooms that should no longer appear in new schedule selectors.',
            ],
          },
          {
            type: 'note',
            title: 'Why details are worth the time',
            text: 'Building and room details are reused in schedules, timetable context, CSV imports, room search, and Campus Navigation. Good setup lets users find a room by code, photo, floor, department, landmark, or directions note instead of asking for a database ID or guessing from a room name.',
          },
        ],
      },
      {
        id: 'schedule-room-behavior',
        title: 'Schedule Room Behavior',
        tags: ['schedules', 'default room', 'conflicts'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A section default room is only a suggestion. The room selected on a schedule is the actual room shown on timetables and used for room conflict checks.',
          },
          {
            type: 'list',
            items: [
              'When a section has a default room, new schedule slots preselect it.',
              'A schedule can use a different room from the section default.',
              'Room conflicts compare the selected structured room, day, and overlapping time.',
              'Older records without a structured room may still show their saved legacy room text until updated.',
            ],
          },
        ],
      },
      {
        id: 'department-scoped-users',
        title: 'Department-Scoped Users',
        tags: ['sub admin', 'manager', 'scope'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Sub Admins and Managers can be allowed to work across all departments or limited to selected departments. Org Admins remain organization-wide.',
          },
          {
            type: 'table',
            headers: ['Role', 'Department scope behavior'],
            rows: [
              ['Org Admin', 'Can manage organization records across departments.'],
              ['Sub Admin', 'Can be scoped to all departments or selected departments for operational academic records.'],
              ['Manager', 'Can be scoped to all departments or selected departments for academic management.'],
              ['Teacher', 'Still follows assigned-section access for teaching work.'],
              ['Student and Guardian', 'Still follow self and linked-student access.'],
              ['Finance Manager', 'Finance access stays separate from department scope in this version.'],
            ],
          },
        ],
      },
    ],
  },
];

export const docsNavGroups: DocNavGroup[] = [
  { title: 'Basics', pages: ['quick-start', 'getting-started', 'roles-permissions', 'glossary', 'dashboard-insights'] },
  { title: 'Role Guides', pages: ['admin-guide', 'sub-admin-guide', 'manager-guide', 'finance-manager-guide', 'teacher-guide', 'student-guide', 'guardian-guide'] },
  { title: 'Workflows', pages: ['school-setup-workflow', 'end-of-term-workflow', 'csv-imports'] },
  { title: 'Setup', pages: ['identification-codes', 'departments-buildings-rooms', 'campus-navigation'] },
  { title: 'Administration', pages: ['platform-admin'] },
  { title: 'People', pages: ['students', 'teachers'] },
  {
    title: 'Academics',
    pages: [
      'academic-cycles',
      'academic-calendar',
      'cohorts-promotions',
      'courses-sections',
      'materials',
      'assessments-grading',
      'submissions',
      'gradebook',
      'evaluations-feedback',
      'preference-windows',
      'gpa-policies',
      'timetable',
      'attendance',
      'transcripts',
    ],
  },
  {
    title: 'Operations',
    pages: ['ai-copilot', 'payments-billing', 'finance', 'fees', 'communication', 'chat', 'mail', 'announcements', 'notifications', 'files-attachments', 'settings'],
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

function getBlockSearchText(block: DocBlock): string[] {
  if (block.type === 'paragraph') return [block.text];
  if (block.type === 'note') return [block.title, block.text];
  if (block.type === 'tip') return [block.title, block.text];
  if (block.type === 'table') return [...block.headers, ...block.rows.flat()];
  if (block.type === 'flow') return [block.title, ...block.steps].filter(Boolean) as string[];
  return block.items;
}

export function buildDocsSearchEntries(): DocsSearchEntry[] {
  return docsPages.flatMap((page) =>
    flattenDocSections(page).map(({ section, parentTitle }) => {
      const blockText = section.blocks.flatMap(getBlockSearchText);
      const sectionTags = section.tags ?? [];
      const fallbackSnippet = section.summary ?? blockText.find((text) => text && text.length > 32) ?? page.description;

      return {
        href: `/docs/${page.slug}#${section.id}`,
        pageTitle: page.title,
        sectionTitle: section.title,
        parentTitle,
        category: page.category,
        tags: [...page.tags, ...sectionTags],
        pageTags: page.tags,
        sectionTags,
        titleText: [section.title, parentTitle].filter(Boolean).join(' '),
        tagText: sectionTags.join(' '),
        categoryText: page.category,
        bodyText: [
          section.title,
          section.summary,
          ...blockText,
        ]
          .filter(Boolean)
          .join(' '),
        fallbackSnippet,
      };
    }),
  );
}
