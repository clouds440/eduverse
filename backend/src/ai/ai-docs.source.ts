export type AIDocBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'note'; title: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

export interface AIDocSection {
  id: string;
  title: string;
  summary?: string;
  tags?: string[];
  blocks: AIDocBlock[];
}

export interface AIDocPage {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  sections: AIDocSection[];
}

export interface AIDocsSearchEntry {
  href: string;
  pageTitle: string;
  sectionTitle: string;
  category: string;
  tags: string[];
  titleText: string;
  tagText: string;
  categoryText: string;
  bodyText: string;
  fallbackSnippet: string;
}

export const aiDocsPages: AIDocPage[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Set up EduVerse and understand workspace navigation.',
    category: 'Basics',
    tags: ['setup', 'dashboard', 'workspace', 'navigation'],
    sections: [
      {
        id: 'school-workspace',
        title: 'School workspace',
        summary: 'EduVerse separates platform administration from organization workspaces.',
        tags: ['organization', 'workspace'],
        blocks: [
          { type: 'paragraph', text: 'Each school or institute works inside its own organization workspace. Platform administrators manage the platform, while organization users work inside their school workspace.' },
          { type: 'list', items: ['Role permissions decide what each user can view or change.', 'Sidebar navigation is role-aware.', 'Backend guards still enforce final access.'] },
        ],
      },
      {
        id: 'dashboard',
        title: 'Dashboard orientation',
        summary: 'Use dashboards, sidebars, headers, and breadcrumbs to move through daily work.',
        tags: ['dashboard', 'navigation'],
        blocks: [
          { type: 'paragraph', text: 'The dashboard is organized around the signed-in role. Org admins see operational modules, teachers see teaching workflows, and students see learning, timetable, submissions, and transcript views.' },
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
    sections: [
      {
        id: 'role-summary',
        title: 'Role summary',
        summary: 'Each role has a specific operating boundary inside the organization.',
        tags: ['org-admin', 'sub-admin', 'manager', 'teacher', 'student', 'guardian'],
        blocks: [
          {
            type: 'table',
            headers: ['Role', 'Main job', 'Boundary'],
            rows: [
              ['Org Admin', 'Owns the organization workspace.', 'Can manage school setup, users, settings, academics, and finance.'],
              ['Teacher', 'Runs assigned classes.', 'Works with assigned sections, materials, assessments, attendance, and grades.'],
              ['Student', 'Uses the student portal.', 'Views own classes, submissions, grades, attendance, timetable, fees, and transcripts.'],
              ['Guardian', 'Views linked student records.', 'Read-only access to linked-student academic and finance summaries.'],
            ],
          },
        ],
      },
      {
        id: 'write-boundaries',
        title: 'Write boundaries',
        summary: 'Some actions are limited by role, organization status, account status, or finalized academic data.',
        tags: ['read-only', 'guards', 'finalized'],
        blocks: [
          { type: 'paragraph', text: 'EduVerse separates what users can see from what they can change. Frontend navigation hides unavailable pages, while backend guards enforce the final authority.' },
        ],
      },
    ],
  },
  {
    slug: 'settings',
    title: 'Settings',
    description: 'Manage organization identity, contact details, branding, finance defaults, security, and AI Copilot settings.',
    category: 'Administration',
    tags: ['settings', 'branding', 'security', 'ai copilot'],
    sections: [
      {
        id: 'organization-profile',
        title: 'Organization profile',
        summary: 'Keep the organization name, location, contact email, phone, and logo accurate.',
        tags: ['profile', 'contact', 'branding'],
        blocks: [
          { type: 'paragraph', text: 'Organization settings identify the school across dashboards, records, communication, exports, and public-facing references.' },
        ],
      },
      {
        id: 'ai-copilot-settings',
        title: 'AI Copilot settings',
        summary: 'Org admins can manage the AI Copilot plan, role access, and monthly AI Credits.',
        tags: ['ai', 'copilot', 'subscription', 'credits'],
        blocks: [
          { type: 'note', title: 'Student usage warning', text: 'Allowing students or guardians to use Copilot can increase monthly AI Credit usage and subscription costs.' },
          { type: 'paragraph', text: 'Organization AI Credits are used before personal credits. If organization credits run out, users need an active personal AI subscription to continue.' },
        ],
      },
    ],
  },
  {
    slug: 'courses-sections',
    title: 'Courses and Sections',
    description: 'Create courses, sections, enrollments, and class structures.',
    category: 'Academics',
    tags: ['courses', 'sections', 'enrollment', 'classes'],
    sections: [
      {
        id: 'course-section-model',
        title: 'Course and section model',
        summary: 'Courses are subject records; sections are the actual classes students attend.',
        tags: ['courses', 'sections'],
        blocks: [
          { type: 'paragraph', text: 'A course is the subject record, while a section is a scheduled class for that course in a specific academic cycle with teachers, rooms, and students.' },
        ],
      },
    ],
  },
  {
    slug: 'timetable',
    title: 'Timetable and Schedules',
    description: 'Manage class schedules, daily timetable views, and schedule conflicts.',
    category: 'Academics',
    tags: ['timetable', 'schedules', 'classes', 'calendar'],
    sections: [
      {
        id: 'schedule-usage',
        title: 'Schedule usage',
        summary: 'Schedules drive student, teacher, and manager planning workflows.',
        tags: ['schedule', 'planner', 'classes'],
        blocks: [
          { type: 'paragraph', text: 'Students use schedules to understand what to study today and which classes are coming next. Teachers use schedules for teaching preparation, pending class summaries, and weekly workload planning.' },
        ],
      },
    ],
  },
  {
    slug: 'attendance',
    title: 'Attendance',
    description: 'Track attendance records and attendance risk.',
    category: 'Academics',
    tags: ['attendance', 'risk', 'absence'],
    sections: [
      {
        id: 'attendance-risk',
        title: 'Attendance risk',
        summary: 'Attendance summaries help students, teachers, and managers spot risk early.',
        tags: ['attendance', 'risk'],
        blocks: [
          { type: 'paragraph', text: 'Attendance views help users see present, absent, late, and excused records. Copilot should explain attendance risk using only records the user can normally access.' },
        ],
      },
    ],
  },
  {
    slug: 'grades',
    title: 'Grades and Gradebook',
    description: 'Understand assessments, submissions, grading, and finalization.',
    category: 'Academics',
    tags: ['grades', 'assessments', 'submissions', 'gradebook'],
    sections: [
      {
        id: 'grading-workflow',
        title: 'Grading workflow',
        summary: 'Teachers grade assigned sections, while students see their own published grades.',
        tags: ['grading', 'assessments'],
        blocks: [
          { type: 'paragraph', text: 'Teachers can create assessments and grade submissions for assigned sections. Students and guardians only see grades that belong to them or linked students and are allowed by the workflow.' },
        ],
      },
    ],
  },
  {
    slug: 'finance',
    title: 'Finance',
    description: 'Manage finance structures, entries, payment claims, transactions, and payroll.',
    category: 'Finance',
    tags: ['finance', 'fees', 'payments', 'payroll'],
    sections: [
      {
        id: 'finance-boundaries',
        title: 'Finance boundaries',
        summary: 'Finance managers handle finance workflows; other roles see only their allowed finance context.',
        tags: ['finance manager', 'fees', 'payments'],
        blocks: [
          { type: 'paragraph', text: 'Finance Managers manage finance structures, entries, claims, transactions, and finance communication. Students and guardians can view their own or linked-student fee status where allowed.' },
        ],
      },
    ],
  },
  {
    slug: 'evaluations',
    title: 'Evaluations and Feedback',
    description: 'Collect and summarize teacher and course feedback.',
    category: 'Quality',
    tags: ['evaluations', 'feedback', 'teacher feedback', 'course feedback'],
    sections: [
      {
        id: 'evaluation-privacy',
        title: 'Evaluation privacy',
        summary: 'Evaluation summaries should avoid reviewer identity and raw confidential responses.',
        tags: ['privacy', 'feedback'],
        blocks: [
          { type: 'paragraph', text: 'Evaluation summaries can include averages, counts, strengths, concerns, and trends, but must not expose reviewer identities or raw confidential reviews.' },
        ],
      },
    ],
  },
  {
    slug: 'csv-imports',
    title: 'CSV Imports',
    description: 'Import students, teachers, courses, sections, attendance, guardians, departments, buildings, and rooms.',
    category: 'Setup',
    tags: ['csv', 'imports', 'bulk setup'],
    sections: [
      {
        id: 'import-safety',
        title: 'Import safety',
        summary: 'CSV imports validate rows before committing records.',
        tags: ['csv', 'validation'],
        blocks: [
          { type: 'steps', items: ['Download or prepare a supported CSV template.', 'Preview validation results.', 'Fix invalid rows.', 'Confirm import only after validation looks correct.'] },
        ],
      },
    ],
  },
];

function getBlockText(block: AIDocBlock): string[] {
  if (block.type === 'paragraph') return [block.text];
  if (block.type === 'note') return [block.title, block.text];
  if (block.type === 'table') return [...block.headers, ...block.rows.flat()];
  return block.items;
}

export function buildAIDocsSearchEntries(): AIDocsSearchEntry[] {
  return aiDocsPages.flatMap((page) =>
    page.sections.map((section) => {
      const blockText = section.blocks.flatMap(getBlockText);
      const sectionTags = section.tags ?? [];
      const fallbackSnippet = section.summary ?? blockText.find((text) => text.length > 32) ?? page.description;

      return {
        href: `/docs/${page.slug}#${section.id}`,
        pageTitle: page.title,
        sectionTitle: section.title,
        category: page.category,
        tags: [...page.tags, ...sectionTags],
        titleText: section.title,
        tagText: sectionTags.join(' '),
        categoryText: page.category,
        bodyText: [section.title, section.summary, ...blockText].filter(Boolean).join(' '),
        fallbackSnippet,
      };
    }),
  );
}
