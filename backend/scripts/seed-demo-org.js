#!/usr/bin/env node

const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const {
  PrismaClient,
  Role,
  UserStatus,
  TeacherStatus,
  StudentStatus,
  DepartmentScopeType,
  RoomType,
  AssessmentType,
  GradeStatus,
  AttendanceStatus,
  BillingCycle,
  EntrySource,
  EntryStatus,
  FinanceAssignmentSource,
  FinanceCategory,
  FinanceTargetType,
  PaymentClaimStatus,
  TransactionType,
  GpaCalculationMethod,
  GpaRounding,
} = require('@prisma/client');

const DEFAULT_ORG_ID = '3a2886b5-3b95-4cb1-b55e-6b95ec190dd6';
const SEED_TAG = 'demo-prod-seed-v1';

loadLocalEnv();

const prisma = new PrismaClient();

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    if (!arg.startsWith('--')) return [arg, true];
    const [key, value] = arg.slice(2).split('=');
    return [key, value === undefined ? true : value];
  }),
);

const orgId = args.orgId || process.env.DEMO_SEED_ORG_ID || DEFAULT_ORG_ID;
const apply = args.apply === true || args.apply === 'true';
const password = process.env.DEMO_SEED_PASSWORD || 'Demo@12345';
const rounds = Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

const departments = [
  {
    key: 'cs',
    name: 'Demo Computer Science',
    code: 'DEMO-CS',
    color: '#2563EB',
    description: 'Programming, computing, and applied software courses.',
  },
  {
    key: 'science',
    name: 'Demo Natural Sciences',
    code: 'DEMO-SCI',
    color: '#059669',
    description: 'Biology, chemistry, physics, and environmental science.',
  },
  {
    key: 'business',
    name: 'Demo Business Studies',
    code: 'DEMO-BUS',
    color: '#B45309',
    description: 'Accounting, entrepreneurship, and economics.',
  },
  {
    key: 'arts',
    name: 'Demo Humanities',
    code: 'DEMO-HUM',
    color: '#7C3AED',
    description: 'Language, history, literature, and civic studies.',
  },
];

const buildings = [
  {
    key: 'north',
    name: 'Demo North Academic Block',
    code: 'DEMO-NORTH',
    address: 'North Campus, Academic Lane',
    description: 'Primary classrooms and faculty offices.',
    departments: ['cs', 'business', 'arts'],
    rooms: [
      { key: 'n101', name: 'Demo N-101', floor: '1', type: RoomType.CLASSROOM, capacity: 32 },
      { key: 'n102', name: 'Demo N-102', floor: '1', type: RoomType.CLASSROOM, capacity: 30 },
      { key: 'n201', name: 'Demo N-201 Computer Lab', floor: '2', type: RoomType.LAB, capacity: 28 },
      { key: 'n301', name: 'Demo N-301 Seminar Hall', floor: '3', type: RoomType.HALL, capacity: 80 },
    ],
  },
  {
    key: 'science',
    name: 'Demo Science & Innovation Wing',
    code: 'DEMO-SW',
    address: 'East Campus, Laboratory Road',
    description: 'Science laboratories and project rooms.',
    departments: ['science', 'cs'],
    rooms: [
      { key: 's101', name: 'Demo S-101 Biology Lab', floor: '1', type: RoomType.LAB, capacity: 24 },
      { key: 's102', name: 'Demo S-102 Physics Lab', floor: '1', type: RoomType.LAB, capacity: 24 },
      { key: 's201', name: 'Demo S-201 Classroom', floor: '2', type: RoomType.CLASSROOM, capacity: 34 },
      { key: 's301', name: 'Demo S-301 Auditorium', floor: '3', type: RoomType.AUDITORIUM, capacity: 120 },
    ],
  },
];

const courses = [
  { key: 'algorithms', department: 'cs', name: 'Demo Applied Algorithms', creditHours: 3, description: 'Data structures, complexity, and practical problem solving.' },
  { key: 'web', department: 'cs', name: 'Demo Web Systems', creditHours: 3, description: 'Modern web application design and delivery.' },
  { key: 'biology', department: 'science', name: 'Demo Biology Lab Methods', creditHours: 4, description: 'Experimental design, lab safety, and reporting.' },
  { key: 'physics', department: 'science', name: 'Demo Physics in Practice', creditHours: 4, description: 'Mechanics, energy, and applied measurement.' },
  { key: 'accounting', department: 'business', name: 'Demo Accounting Fundamentals', creditHours: 3, description: 'Ledgers, statements, and internal controls.' },
  { key: 'writing', department: 'arts', name: 'Demo Academic Writing', creditHours: 2, description: 'Research, drafting, revision, and presentation.' },
];

const people = {
  admins: [
    { email: 'demo.org.admin@example.test', name: 'Ayesha Rahman', phone: '+92 300 555 0101', role: Role.ORG_ADMIN },
  ],
  subAdmins: [
    { email: 'demo.subadmin.academics@example.test', name: 'Hassan Qureshi', phone: '+92 300 555 0102', departments: ['cs', 'science'] },
    { email: 'demo.subadmin.studentlife@example.test', name: 'Mariam Sheikh', phone: '+92 300 555 0103', departments: ['business', 'arts'] },
  ],
  financeManagers: [
    { email: 'demo.finance.manager.01@example.test', name: 'Omar Siddiqui', phone: '+92 300 555 0104' },
    { email: 'demo.finance.manager.02@example.test', name: 'Nadia Iqbal', phone: '+92 300 555 0105' },
  ],
  managers: [
    { email: 'demo.manager.academics@example.test', name: 'Dr. Sara Malik', phone: '+92 300 555 0106', subject: 'Academic Operations', designation: 'Academic Manager', education: 'M.Ed. Educational Leadership', departments: ['cs', 'science'] },
    { email: 'demo.manager.programs@example.test', name: 'Bilal Ahmed', phone: '+92 300 555 0107', subject: 'Program Coordination', designation: 'Programs Manager', education: 'MBA Education Management', departments: ['business', 'arts'] },
  ],
  teachers: [
    { key: 'asad', email: 'demo.teacher.asad.khan@example.test', name: 'Asad Khan', phone: '+92 300 555 0111', subject: 'Algorithms', designation: 'Senior Lecturer', education: 'MS Computer Science', department: 'cs' },
    { key: 'fatima', email: 'demo.teacher.fatima.noor@example.test', name: 'Fatima Noor', phone: '+92 300 555 0112', subject: 'Web Engineering', designation: 'Lecturer', education: 'BS Software Engineering', department: 'cs' },
    { key: 'zubair', email: 'demo.teacher.zubair.ali@example.test', name: 'Zubair Ali', phone: '+92 300 555 0113', subject: 'Biology', designation: 'Lab Instructor', education: 'MS Biology', department: 'science' },
    { key: 'sana', email: 'demo.teacher.sana.javed@example.test', name: 'Sana Javed', phone: '+92 300 555 0114', subject: 'Physics', designation: 'Lecturer', education: 'MPhil Physics', department: 'science' },
    { key: 'hamza', email: 'demo.teacher.hamza.farooq@example.test', name: 'Hamza Farooq', phone: '+92 300 555 0115', subject: 'Accounting', designation: 'Lecturer', education: 'ACCA', department: 'business' },
    { key: 'laiba', email: 'demo.teacher.laiba.saeed@example.test', name: 'Laiba Saeed', phone: '+92 300 555 0116', subject: 'Academic Writing', designation: 'Lecturer', education: 'MA English', department: 'arts' },
    { key: 'daniyal', email: 'demo.teacher.daniyal.mir@example.test', name: 'Daniyal Mir', phone: '+92 300 555 0117', subject: 'Project Studio', designation: 'Instructor', education: 'MS Information Systems', department: 'cs' },
    { key: 'mehwish', email: 'demo.teacher.mehwish.raza@example.test', name: 'Mehwish Raza', phone: '+92 300 555 0118', subject: 'Student Research', designation: 'Instructor', education: 'MPhil Education', department: 'arts' },
  ],
};

const guardianNames = [
  ['demo.guardian.01@example.test', 'Khalid Hussain'],
  ['demo.guardian.02@example.test', 'Samina Tariq'],
  ['demo.guardian.03@example.test', 'Rashid Mehmood'],
  ['demo.guardian.04@example.test', 'Amina Yusuf'],
  ['demo.guardian.05@example.test', 'Farhan Akram'],
  ['demo.guardian.06@example.test', 'Sadia Imran'],
  ['demo.guardian.07@example.test', 'Jawad Raza'],
  ['demo.guardian.08@example.test', 'Noreen Shah'],
  ['demo.guardian.09@example.test', 'Tahir Abbas'],
  ['demo.guardian.10@example.test', 'Uzma Farid'],
  ['demo.guardian.11@example.test', 'Imran Baig'],
  ['demo.guardian.12@example.test', 'Rabia Nadeem'],
];

const studentNames = [
  ['Ali Raza', 'Raza Ahmed', 'Male'],
  ['Zoya Khan', 'Imran Khan', 'Female'],
  ['Usman Tariq', 'Tariq Mahmood', 'Male'],
  ['Hina Saleem', 'Saleem Akhtar', 'Female'],
  ['Dua Fatima', 'Kamran Siddiqui', 'Female'],
  ['Rayyan Ali', 'Ali Hassan', 'Male'],
  ['Musa Ahmed', 'Ahmed Nawaz', 'Male'],
  ['Areeba Noor', 'Noor Din', 'Female'],
  ['Ahmed Bilal', 'Bilal Farooq', 'Male'],
  ['Maryam Iqbal', 'Iqbal Hussain', 'Female'],
  ['Saad Qureshi', 'Qureshi Javed', 'Male'],
  ['Eman Rauf', 'Rauf Siddiqui', 'Female'],
  ['Taha Malik', 'Malik Aslam', 'Male'],
  ['Noor Fatima', 'Faisal Fatima', 'Female'],
  ['Ibrahim Shah', 'Shah Wali', 'Male'],
  ['Maham Javed', 'Javed Iqbal', 'Female'],
  ['Haris Nadeem', 'Nadeem Akram', 'Male'],
  ['Ayesha Mir', 'Mir Hamid', 'Female'],
  ['Yusuf Rehman', 'Rehman Ali', 'Male'],
  ['Anaya Sheikh', 'Sheikh Omar', 'Female'],
  ['Danish Aslam', 'Aslam Pervez', 'Male'],
  ['Saira Amin', 'Amin Gul', 'Female'],
  ['Arham Zafar', 'Zafar Ilyas', 'Male'],
  ['Kinza Rafiq', 'Rafiq Ahmed', 'Female'],
];

const cohorts = [
  { key: 'grade8', name: 'Demo Grade 8 - 2026', departments: ['science', 'arts'] },
  { key: 'grade9', name: 'Demo Grade 9 - 2026', departments: ['cs', 'science'] },
  { key: 'grade10', name: 'Demo Grade 10 - 2026', departments: ['cs', 'business'] },
];

const sectionSeeds = [
  { key: 'alg-a', course: 'algorithms', cohort: 'grade10', name: 'Demo Algorithms - Grade 10 A', color: '#2563EB', room: 'n201', teachers: ['asad', 'daniyal'], schedule: [[1, '09:00', '10:15'], [3, '09:00', '10:15']] },
  { key: 'web-a', course: 'web', cohort: 'grade10', name: 'Demo Web Systems - Grade 10 A', color: '#0EA5E9', room: 'n201', teachers: ['fatima', 'daniyal'], schedule: [[2, '10:30', '11:45'], [4, '10:30', '11:45']] },
  { key: 'bio-a', course: 'biology', cohort: 'grade9', name: 'Demo Biology - Grade 9 A', color: '#059669', room: 's101', teachers: ['zubair'], schedule: [[1, '11:00', '12:15'], [3, '11:00', '12:15']] },
  { key: 'phy-a', course: 'physics', cohort: 'grade9', name: 'Demo Physics - Grade 9 A', color: '#16A34A', room: 's102', teachers: ['sana'], schedule: [[2, '09:00', '10:15'], [4, '09:00', '10:15']] },
  { key: 'acct-a', course: 'accounting', cohort: 'grade8', name: 'Demo Accounting - Grade 8 A', color: '#B45309', room: 'n102', teachers: ['hamza'], schedule: [[1, '12:30', '13:30'], [3, '12:30', '13:30']] },
  { key: 'write-a', course: 'writing', cohort: 'grade8', name: 'Demo Writing - Grade 8 A', color: '#7C3AED', room: 'n101', teachers: ['laiba', 'mehwish'], schedule: [[2, '12:30', '13:30'], [4, '12:30', '13:30']] },
];

function date(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function plusDays(base, days) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function main() {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw new Error(`Organization ${orgId} was not found. Refusing to seed.`);
  }

  printPlan(org);
  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write this dataset.');
    return;
  }

  console.log(`\nSeeding ${org.name} (${org.id})...`);
  const seededOrg = await prisma.organization.update({ where: { id: org.id }, data: { currency: 'PKR' } });
  const passwordHash = await bcrypt.hash(password, Number.isFinite(rounds) ? rounds : 10);

  const ctx = {
    org: seededOrg,
    departments: new Map(),
    buildings: new Map(),
    rooms: new Map(),
    courses: new Map(),
    cohorts: new Map(),
    sections: new Map(),
    schedules: new Map(),
    users: new Map(),
    teachers: new Map(),
    guardians: [],
    students: [],
  };

  await seedDepartments(ctx);
  await seedBuildingsAndRooms(ctx);
  await seedGpaAndAcademicCycle(ctx);
  await seedCourses(ctx);
  await seedStaff(ctx, passwordHash);
  await seedCohortsAndSections(ctx);
  await seedGuardiansAndStudents(ctx, passwordHash);
  await seedAcademicActivity(ctx);
  await seedFinance(ctx);
  await seedAnnouncementsAndChats(ctx);

  console.log('\nDemo seed complete.');
  console.log(`Login password for seeded accounts: ${password}`);
  console.log('Seeded email examples: demo.org.admin@example.test, demo.teacher.asad.khan@example.test, demo.student.001@example.test');
}

function printPlan(org) {
  console.log(`Demo data target: ${org.name} (${org.id})`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log('Will create/update deterministic demo records:');
  console.log(`- ${departments.length} departments, ${buildings.length} buildings, ${buildings.reduce((sum, b) => sum + b.rooms.length, 0)} rooms`);
  console.log(`- 1 GPA policy, 1 academic cycle, ${cohorts.length} cohorts, ${courses.length} courses, ${sectionSeeds.length} sections`);
  console.log(`- 1 org admin, ${people.subAdmins.length} sub admins, ${people.managers.length} managers, ${people.teachers.length} teachers, ${people.financeManagers.length} finance managers`);
  console.log(`- ${guardianNames.length} guardians, ${studentNames.length} students`);
  console.log('- schedules, attendance sessions, course materials, assessments, submissions, grades, financial structures, entries, claims, and transactions');
}

async function seedDepartments(ctx) {
  for (const seed of departments) {
    const department = await prisma.department.upsert({
      where: { organizationId_name: { organizationId: orgId, name: seed.name } },
      update: {
        code: seed.code,
        description: seed.description,
        color: seed.color,
        isActive: true,
      },
      create: {
        organizationId: orgId,
        name: seed.name,
        code: seed.code,
        description: seed.description,
        color: seed.color,
      },
    });
    ctx.departments.set(seed.key, department);
  }
  console.log(`Seeded ${ctx.departments.size} departments.`);
}

async function seedBuildingsAndRooms(ctx) {
  for (const seed of buildings) {
    const building = await prisma.building.upsert({
      where: { organizationId_name: { organizationId: orgId, name: seed.name } },
      update: {
        code: seed.code,
        address: seed.address,
        description: seed.description,
        isActive: true,
      },
      create: {
        organizationId: orgId,
        name: seed.name,
        code: seed.code,
        address: seed.address,
        description: seed.description,
      },
    });
    ctx.buildings.set(seed.key, building);

    for (const departmentKey of seed.departments) {
      const department = ctx.departments.get(departmentKey);
      await prisma.buildingDepartment.upsert({
        where: { buildingId_departmentId: { buildingId: building.id, departmentId: department.id } },
        update: { organizationId: orgId },
        create: { organizationId: orgId, buildingId: building.id, departmentId: department.id },
      });
    }

    for (const roomSeed of seed.rooms) {
      const room = await prisma.room.upsert({
        where: {
          organizationId_buildingId_name: {
            organizationId: orgId,
            buildingId: building.id,
            name: roomSeed.name,
          },
        },
        update: {
          floor: roomSeed.floor,
          type: roomSeed.type,
          capacity: roomSeed.capacity,
          description: `${seed.name} teaching space.`,
          isActive: true,
        },
        create: {
          organizationId: orgId,
          buildingId: building.id,
          name: roomSeed.name,
          floor: roomSeed.floor,
          type: roomSeed.type,
          capacity: roomSeed.capacity,
          description: `${seed.name} teaching space.`,
        },
      });
      ctx.rooms.set(roomSeed.key, room);
    }
  }
  console.log(`Seeded ${ctx.buildings.size} buildings and ${ctx.rooms.size} rooms.`);
}

async function seedGpaAndAcademicCycle(ctx) {
  ctx.gpaPolicy = await findFirstOrCreate(
    prisma.gpaPolicy,
    { organizationId: orgId, name: 'Demo 4.0 Weighted GPA' },
    {
      organizationId: orgId,
      name: 'Demo 4.0 Weighted GPA',
      scale: 4,
      method: GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS,
      rounding: GpaRounding.TWO_DECIMALS,
      isDefault: false,
      gradeRules: [
        { min: 90, grade: 'A', points: 4.0 },
        { min: 80, grade: 'B', points: 3.0 },
        { min: 70, grade: 'C', points: 2.0 },
        { min: 60, grade: 'D', points: 1.0 },
        { min: 0, grade: 'F', points: 0.0 },
      ],
    },
    {
      scale: 4,
      method: GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS,
      rounding: GpaRounding.TWO_DECIMALS,
      isArchived: false,
    },
  );

  ctx.academicCycle = await findFirstOrCreate(
    prisma.academicCycle,
    { organizationId: orgId, name: 'Demo Academic Year 2026-2027' },
    {
      organizationId: orgId,
      name: 'Demo Academic Year 2026-2027',
      startDate: date('2026-08-01'),
      endDate: date('2027-06-30'),
      isActive: true,
      gpaPolicyId: ctx.gpaPolicy.id,
      gpaPolicySnapshot: {
        seedTag: SEED_TAG,
        policyName: ctx.gpaPolicy.name,
      },
    },
    {
      startDate: date('2026-08-01'),
      endDate: date('2027-06-30'),
      isActive: true,
      gpaPolicyId: ctx.gpaPolicy.id,
    },
  );

  console.log('Seeded GPA policy and academic cycle.');
}

async function seedCourses(ctx) {
  for (const seed of courses) {
    const department = ctx.departments.get(seed.department);
    const course = await findFirstOrCreate(
      prisma.course,
      { organizationId: orgId, name: seed.name },
      {
        organizationId: orgId,
        name: seed.name,
        description: seed.description,
        creditHours: seed.creditHours,
        departmentId: department.id,
        updatedBy: SEED_TAG,
      },
      {
        description: seed.description,
        creditHours: seed.creditHours,
        departmentId: department.id,
        updatedBy: SEED_TAG,
      },
    );
    ctx.courses.set(seed.key, course);
  }
  console.log(`Seeded ${ctx.courses.size} courses.`);
}

async function seedStaff(ctx, passwordHash) {
  for (const seed of people.admins) {
    const user = await upsertUser(seed, passwordHash);
    ctx.users.set(seed.email, user);
  }

  for (const seed of people.subAdmins) {
    const user = await upsertUser({ ...seed, role: Role.SUB_ADMIN, departmentScopeType: DepartmentScopeType.SELECTED }, passwordHash);
    ctx.users.set(seed.email, user);
    await replaceSubAdminDepartments(user.id, seed.departments.map((key) => ctx.departments.get(key).id));
  }

  for (const seed of people.financeManagers) {
    const user = await upsertUser({ ...seed, role: Role.FINANCE_MANAGER }, passwordHash);
    ctx.users.set(seed.email, user);
  }

  for (const seed of people.managers) {
    const user = await upsertUser({ ...seed, role: Role.ORG_MANAGER }, passwordHash);
    const teacher = await upsertTeacherProfile(user, {
      subject: seed.subject,
      designation: seed.designation,
      education: seed.education,
      department: 'Academic Management',
      departmentScopeType: DepartmentScopeType.SELECTED,
      status: TeacherStatus.ACTIVE,
    });
    ctx.teachers.set(seed.email, teacher);
    await replaceTeacherDepartments(teacher.id, seed.departments.map((key) => ctx.departments.get(key).id), true);
  }

  for (const seed of people.teachers) {
    const user = await upsertUser({ ...seed, role: Role.TEACHER }, passwordHash);
    const department = ctx.departments.get(seed.department);
    const teacher = await upsertTeacherProfile(user, {
      subject: seed.subject,
      designation: seed.designation,
      education: seed.education,
      department: department.name.replace('Demo ', ''),
      departmentScopeType: DepartmentScopeType.ALL,
      status: TeacherStatus.ACTIVE,
    });
    ctx.teachers.set(seed.key, teacher);
    await replaceTeacherDepartments(teacher.id, [department.id], false);
  }

  console.log(`Seeded ${people.admins.length + people.subAdmins.length + people.financeManagers.length + people.managers.length + people.teachers.length} staff accounts.`);
}

async function seedCohortsAndSections(ctx) {
  for (const seed of cohorts) {
    const cohort = await findFirstOrCreate(
      prisma.cohort,
      { organizationId: orgId, name: seed.name, academicCycleId: ctx.academicCycle.id },
      {
        organizationId: orgId,
        name: seed.name,
        academicCycleId: ctx.academicCycle.id,
      },
      { academicCycleId: ctx.academicCycle.id },
    );
    ctx.cohorts.set(seed.key, cohort);
  }

  for (const seed of sectionSeeds) {
    const course = ctx.courses.get(seed.course);
    const cohort = ctx.cohorts.get(seed.cohort);
    const room = ctx.rooms.get(seed.room);
    const section = await findFirstOrCreate(
      prisma.section,
      {
        name: seed.name,
        courseId: course.id,
        academicCycleId: ctx.academicCycle.id,
        cohortId: cohort.id,
      },
      {
        name: seed.name,
        color: seed.color,
        room: room.name,
        defaultRoomId: room.id,
        courseId: course.id,
        academicCycleId: ctx.academicCycle.id,
        cohortId: cohort.id,
        teachers: { connect: seed.teachers.map((key) => ({ id: ctx.teachers.get(key).id })) },
      },
      {
        color: seed.color,
        room: room.name,
        defaultRoomId: room.id,
        teachers: { set: seed.teachers.map((key) => ({ id: ctx.teachers.get(key).id })) },
      },
    );
    ctx.sections.set(seed.key, section);

    for (const [day, startTime, endTime] of seed.schedule) {
      const schedule = await findFirstOrCreate(
        prisma.sectionSchedule,
        { sectionId: section.id, academicCycleId: ctx.academicCycle.id, day, startTime },
        {
          sectionId: section.id,
          academicCycleId: ctx.academicCycle.id,
          day,
          startTime,
          endTime,
          room: room.name,
          roomId: room.id,
        },
        { endTime, room: room.name, roomId: room.id },
      );
      ctx.schedules.set(`${seed.key}:${day}:${startTime}`, schedule);
    }
  }

  console.log(`Seeded ${ctx.cohorts.size} cohorts, ${ctx.sections.size} sections, and ${ctx.schedules.size} schedules.`);
}

async function seedGuardiansAndStudents(ctx, passwordHash) {
  for (let i = 0; i < guardianNames.length; i += 1) {
    const [email, name] = guardianNames[i];
    const phone = `+92 300 555 ${String(120 + i).padStart(4, '0')}`;
    const user = await upsertUser({ email, name, phone, role: Role.GUARDIAN }, passwordHash);
    const guardian = await prisma.guardianProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId: orgId,
        phone,
        address: `Demo House ${i + 11}, Model Town`,
      },
      create: {
        userId: user.id,
        organizationId: orgId,
        phone,
        address: `Demo House ${i + 11}, Model Town`,
      },
    });
    ctx.guardians.push(guardian);
  }

  for (let i = 0; i < studentNames.length; i += 1) {
    const [name, fatherName, gender] = studentNames[i];
    const serial = String(i + 1).padStart(3, '0');
    const email = `demo.student.${serial}@example.test`;
    const cohortKey = i < 8 ? 'grade8' : i < 16 ? 'grade9' : 'grade10';
    const cohort = ctx.cohorts.get(cohortKey);
    const sectionKeys = sectionSeeds.filter((section) => section.cohort === cohortKey).map((section) => section.key);
    const primaryDepartment = i % 4 === 0 ? 'cs' : i % 4 === 1 ? 'science' : i % 4 === 2 ? 'business' : 'arts';
    const user = await upsertUser({
      email,
      name,
      phone: `+92 300 555 ${String(200 + i).padStart(4, '0')}`,
      role: Role.STUDENT,
    }, passwordHash);
    const student = await upsertStudentProfile(user, {
      registrationNumber: `DEMO-2026-${serial}`,
      rollNumber: `D26-${serial}`,
      fatherName,
      age: cohortKey === 'grade8' ? 13 : cohortKey === 'grade9' ? 14 : 15,
      address: `Demo Street ${i + 1}, Lahore`,
      major: cohortKey === 'grade10' ? 'Computer Science' : cohortKey === 'grade9' ? 'Natural Sciences' : 'General Studies',
      department: ctx.departments.get(primaryDepartment).name.replace('Demo ', ''),
      primaryDepartmentId: ctx.departments.get(primaryDepartment).id,
      admissionDate: date('2026-08-05'),
      emergencyContact: `+92 300 555 ${String(300 + i).padStart(4, '0')}`,
      bloodGroup: ['A+', 'B+', 'O+', 'AB+'][i % 4],
      gender,
      status: StudentStatus.ACTIVE,
      cohortId: cohort.id,
    });

    await replaceStudentDepartments(student.id, [ctx.departments.get(primaryDepartment).id]);
    await ensureCohortMembership(student.id, cohort.id, ctx.academicCycle.id);
    for (const sectionKey of sectionKeys) {
      await ensureEnrollment(student.id, ctx.sections.get(sectionKey).id, ctx.academicCycle.id);
    }

    const guardian = ctx.guardians[i % ctx.guardians.length];
    await prisma.guardianStudent.upsert({
      where: { studentId: student.id },
      update: {
        guardianId: guardian.id,
        organizationId: orgId,
        relationshipLabel: i % 2 === 0 ? 'Father' : 'Mother',
      },
      create: {
        guardianId: guardian.id,
        studentId: student.id,
        organizationId: orgId,
        relationshipLabel: i % 2 === 0 ? 'Father' : 'Mother',
      },
    });

    ctx.students.push(student);
  }

  console.log(`Seeded ${ctx.guardians.length} guardians and ${ctx.students.length} students.`);
}

async function seedAcademicActivity(ctx) {
  const assessmentPlans = [
    { suffix: 'Diagnostic Quiz', type: AssessmentType.QUIZ, totalMarks: 20, weightage: 10, dueOffset: 14 },
    { suffix: 'Applied Assignment', type: AssessmentType.ASSIGNMENT, totalMarks: 50, weightage: 20, dueOffset: 35 },
    { suffix: 'Midterm Assessment', type: AssessmentType.MIDTERM, totalMarks: 100, weightage: 30, dueOffset: 70 },
    { suffix: 'Final Project', type: AssessmentType.PROJECT, totalMarks: 100, weightage: 40, dueOffset: 118 },
  ];

  const base = date('2026-08-01');
  for (const seed of sectionSeeds) {
    const section = ctx.sections.get(seed.key);
    const course = ctx.courses.get(seed.course);
    await findFirstOrCreate(
      prisma.courseMaterial,
      { sectionId: section.id, academicCycleId: ctx.academicCycle.id, title: `${course.name} Starter Pack` },
      {
        sectionId: section.id,
        academicCycleId: ctx.academicCycle.id,
        title: `${course.name} Starter Pack`,
        description: 'Syllabus, weekly outline, and first reading list for the demo class.',
        links: [
          'https://example.test/demo/syllabus.pdf',
          'https://example.test/demo/week-01-reading.pdf',
        ],
        createdBy: SEED_TAG,
      },
      {
        description: 'Syllabus, weekly outline, and first reading list for the demo class.',
        links: [
          'https://example.test/demo/syllabus.pdf',
          'https://example.test/demo/week-01-reading.pdf',
        ],
      },
    );

    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId: section.id },
      include: { student: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const plan of assessmentPlans) {
      const assessment = await findFirstOrCreate(
        prisma.assessment,
        { sectionId: section.id, courseId: course.id, title: `${course.name} ${plan.suffix}` },
        {
          sectionId: section.id,
          courseId: course.id,
          organizationId: orgId,
          academicCycleId: ctx.academicCycle.id,
          title: `${course.name} ${plan.suffix}`,
          type: plan.type,
          totalMarks: plan.totalMarks,
          weightage: plan.weightage,
          dueDate: plusDays(base, plan.dueOffset),
          allowSubmissions: plan.type !== AssessmentType.MIDTERM,
        },
        {
          totalMarks: plan.totalMarks,
          weightage: plan.weightage,
          dueDate: plusDays(base, plan.dueOffset),
          allowSubmissions: plan.type !== AssessmentType.MIDTERM,
        },
      );

      for (let i = 0; i < enrollments.length; i += 1) {
        const student = enrollments[i].student;
        const marksObtained = Math.min(plan.totalMarks, Math.max(0, Math.round(plan.totalMarks * (0.62 + ((i + plan.dueOffset) % 9) / 30))));
        await prisma.grade.upsert({
          where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
          update: {
            marksObtained,
            feedback: marksObtained / plan.totalMarks > 0.82 ? 'Strong work with clear reasoning.' : 'Good progress; review the feedback notes before the next task.',
            status: plan.type === AssessmentType.PROJECT ? GradeStatus.PUBLISHED : GradeStatus.FINALIZED,
            academicCycleId: ctx.academicCycle.id,
            updatedBy: SEED_TAG,
            finalizedAt: plan.type === AssessmentType.PROJECT ? null : plusDays(base, plan.dueOffset + 5),
          },
          create: {
            assessmentId: assessment.id,
            studentId: student.id,
            marksObtained,
            feedback: marksObtained / plan.totalMarks > 0.82 ? 'Strong work with clear reasoning.' : 'Good progress; review the feedback notes before the next task.',
            status: plan.type === AssessmentType.PROJECT ? GradeStatus.PUBLISHED : GradeStatus.FINALIZED,
            academicCycleId: ctx.academicCycle.id,
            updatedBy: SEED_TAG,
            finalizedAt: plan.type === AssessmentType.PROJECT ? null : plusDays(base, plan.dueOffset + 5),
          },
        });

        if (assessment.allowSubmissions) {
          await findFirstOrCreate(
            prisma.submission,
            { assessmentId: assessment.id, studentId: student.id, academicCycleId: ctx.academicCycle.id },
            {
              assessmentId: assessment.id,
              studentId: student.id,
              academicCycleId: ctx.academicCycle.id,
              message: `Submitted demo work for ${plan.suffix.toLowerCase()}.`,
              fileUrl: 'https://example.test/demo/student-submission.pdf',
              submittedAt: plusDays(base, plan.dueOffset - 1),
            },
            {
              message: `Submitted demo work for ${plan.suffix.toLowerCase()}.`,
              fileUrl: 'https://example.test/demo/student-submission.pdf',
            },
          );
        }
      }
    }
  }

  await seedAttendance(ctx);
  console.log('Seeded course materials, assessments, submissions, grades, and attendance.');
}

async function seedAttendance(ctx) {
  const sessionDates = [date('2026-08-10'), date('2026-08-17'), date('2026-08-24')];
  for (const schedule of ctx.schedules.values()) {
    const section = await prisma.section.findUnique({ where: { id: schedule.sectionId } });
    const enrollments = await prisma.enrollment.findMany({ where: { sectionId: section.id }, orderBy: { createdAt: 'asc' } });
    for (const baseDate of sessionDates) {
      const offset = (schedule.day - baseDate.getUTCDay() + 7) % 7;
      const attendanceDate = plusDays(baseDate, offset);
      const session = await prisma.attendanceSession.upsert({
        where: { scheduleId_date: { scheduleId: schedule.id, date: attendanceDate } },
        update: {
          sectionId: section.id,
          academicCycleId: ctx.academicCycle.id,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        create: {
          sectionId: section.id,
          scheduleId: schedule.id,
          academicCycleId: ctx.academicCycle.id,
          date: attendanceDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
      });

      for (let i = 0; i < enrollments.length; i += 1) {
        const status = i % 11 === 0 ? AttendanceStatus.ABSENT : i % 7 === 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
        await prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: enrollments[i].studentId } },
          update: { status },
          create: { sessionId: session.id, studentId: enrollments[i].studentId, status },
        });
      }
    }
  }
}

async function seedFinance(ctx) {
  const financeUser = await prisma.user.findUnique({ where: { email: people.financeManagers[0].email } });
  const studentTuition = await findFirstOrCreate(
    prisma.financialStructure,
    { organizationId: orgId, title: 'Demo Monthly Tuition 2026', targetType: FinanceTargetType.STUDENT },
    {
      organizationId: orgId,
      title: 'Demo Monthly Tuition 2026',
      description: 'Monthly tuition package for demo student finance workflows.',
      targetType: FinanceTargetType.STUDENT,
      category: FinanceCategory.TUITION,
      amount: 18000,
      currency: 'PKR',
      billingCycle: BillingCycle.MONTHLY,
      dueDay: 10,
      startDate: date('2026-08-01'),
      endDate: date('2027-06-30'),
      metadata: { seedTag: SEED_TAG },
    },
    { amount: 18000, currency: 'PKR', dueDay: 10, isActive: true },
  );

  const teacherSalary = await findFirstOrCreate(
    prisma.financialStructure,
    { organizationId: orgId, title: 'Demo Teacher Monthly Salary 2026', targetType: FinanceTargetType.TEACHER },
    {
      organizationId: orgId,
      title: 'Demo Teacher Monthly Salary 2026',
      description: 'Salary structure for demo teacher expense workflows.',
      targetType: FinanceTargetType.TEACHER,
      category: FinanceCategory.SALARY,
      amount: 95000,
      currency: 'PKR',
      billingCycle: BillingCycle.MONTHLY,
      dueDay: 25,
      startDate: date('2026-08-01'),
      endDate: date('2027-06-30'),
      metadata: { seedTag: SEED_TAG },
    },
    { amount: 95000, currency: 'PKR', dueDay: 25, isActive: true },
  );

  for (let i = 0; i < ctx.students.length; i += 1) {
    const student = ctx.students[i];
    const assignment = await prisma.financialStructureAssignment.upsert({
      where: { structureId_studentId: { structureId: studentTuition.id, studentId: student.id } },
      update: { isActive: true, sourceType: FinanceAssignmentSource.COHORT, sourceId: student.cohortId },
      create: {
        organizationId: orgId,
        structureId: studentTuition.id,
        targetType: FinanceTargetType.STUDENT,
        studentId: student.id,
        sourceType: FinanceAssignmentSource.COHORT,
        sourceId: student.cohortId,
        metadata: { seedTag: SEED_TAG },
      },
    });
    await seedFinancialEntry({
      structure: studentTuition,
      assignment,
      studentId: student.id,
      title: 'Demo August Tuition',
      periodStart: date('2026-08-01'),
      periodEnd: date('2026-08-31'),
      dueDate: date('2026-08-10'),
      status: i % 5 === 0 ? EntryStatus.PARTIAL : EntryStatus.PAID,
      paidAmount: i % 5 === 0 ? 9000 : 18000,
      actorId: financeUser.id,
      reference: `DEMO-TUITION-AUG-${String(i + 1).padStart(3, '0')}`,
    });
    await seedFinancialEntry({
      structure: studentTuition,
      assignment,
      studentId: student.id,
      title: 'Demo September Tuition',
      periodStart: date('2026-09-01'),
      periodEnd: date('2026-09-30'),
      dueDate: date('2026-09-10'),
      status: i % 6 === 0 ? EntryStatus.UNVERIFIED : EntryStatus.PENDING,
      paidAmount: i % 6 === 0 ? 18000 : 0,
      actorId: financeUser.id,
      reference: `DEMO-TUITION-SEP-${String(i + 1).padStart(3, '0')}`,
    });
  }

  const teacherList = [...ctx.teachers.values()].slice(0, 6);
  for (let i = 0; i < teacherList.length; i += 1) {
    const teacher = teacherList[i];
    const assignment = await prisma.financialStructureAssignment.upsert({
      where: { structureId_teacherId: { structureId: teacherSalary.id, teacherId: teacher.id } },
      update: { isActive: true, sourceType: FinanceAssignmentSource.MANUAL },
      create: {
        organizationId: orgId,
        structureId: teacherSalary.id,
        targetType: FinanceTargetType.TEACHER,
        teacherId: teacher.id,
        sourceType: FinanceAssignmentSource.MANUAL,
        metadata: { seedTag: SEED_TAG },
      },
    });
    await seedFinancialEntry({
      structure: teacherSalary,
      assignment,
      teacherId: teacher.id,
      title: 'Demo August Salary',
      periodStart: date('2026-08-01'),
      periodEnd: date('2026-08-31'),
      dueDate: date('2026-08-25'),
      status: EntryStatus.PAID,
      paidAmount: 95000,
      actorId: financeUser.id,
      reference: `DEMO-SALARY-AUG-${String(i + 1).padStart(3, '0')}`,
      transactionType: TransactionType.EXPENSE,
    });
  }

  console.log('Seeded financial structures, assignments, entries, claims, and transactions.');
}

async function seedFinancialEntry(input) {
  const entry = await prisma.financialEntry.upsert({
    where: {
      assignmentId_periodStart_periodEnd: {
        assignmentId: input.assignment.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    },
    update: {
      title: input.title,
      dueDate: input.dueDate,
      amount: input.structure.amount,
      paidAmount: input.paidAmount,
      status: input.status,
      confirmedByAdmin: input.status === EntryStatus.PAID || input.status === EntryStatus.PARTIAL,
      confirmedAt: input.status === EntryStatus.PAID || input.status === EntryStatus.PARTIAL ? plusDays(input.dueDate, 1) : null,
      confirmedById: input.status === EntryStatus.PAID || input.status === EntryStatus.PARTIAL ? input.actorId : null,
    },
    create: {
      organizationId: orgId,
      structureId: input.structure.id,
      assignmentId: input.assignment.id,
      title: input.title,
      studentId: input.studentId,
      teacherId: input.teacherId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      dueDate: input.dueDate,
      amount: input.structure.amount,
      paidAmount: input.paidAmount,
      status: input.status,
      source: EntrySource.SYSTEM,
      paymentMethod: input.paidAmount > 0 ? 'Bank Transfer' : null,
      confirmedByAdmin: input.status === EntryStatus.PAID || input.status === EntryStatus.PARTIAL,
      confirmedAt: input.status === EntryStatus.PAID || input.status === EntryStatus.PARTIAL ? plusDays(input.dueDate, 1) : null,
      confirmedById: input.status === EntryStatus.PAID || input.status === EntryStatus.PARTIAL ? input.actorId : null,
      metadata: { seedTag: SEED_TAG },
    },
  });

  if (input.paidAmount > 0) {
    await findFirstOrCreate(
      prisma.paymentClaim,
      { entryId: entry.id, referenceNumber: input.reference },
      {
        organizationId: orgId,
        entryId: entry.id,
        claimedAmount: input.paidAmount,
        paymentMethod: 'Bank Transfer',
        referenceNumber: input.reference,
        note: 'Demo payment claim generated by seed.',
        status: input.status === EntryStatus.UNVERIFIED ? PaymentClaimStatus.PENDING : PaymentClaimStatus.CONFIRMED,
        claimedById: input.actorId,
        claimedAt: plusDays(input.dueDate, 1),
        reviewedById: input.status === EntryStatus.UNVERIFIED ? null : input.actorId,
        reviewedAt: input.status === EntryStatus.UNVERIFIED ? null : plusDays(input.dueDate, 2),
        confirmedAmount: input.status === EntryStatus.UNVERIFIED ? null : input.paidAmount,
        metadata: { seedTag: SEED_TAG },
      },
      {
        claimedAmount: input.paidAmount,
        status: input.status === EntryStatus.UNVERIFIED ? PaymentClaimStatus.PENDING : PaymentClaimStatus.CONFIRMED,
      },
    );

    await findFirstOrCreate(
      prisma.transaction,
      { organizationId: orgId, referenceNumber: input.reference },
      {
        organizationId: orgId,
        type: input.transactionType || TransactionType.INCOME,
        category: input.structure.category,
        amount: input.paidAmount,
        currency: input.structure.currency,
        description: `${input.title} payment`,
        relatedEntryId: entry.id,
        paymentMethod: 'Bank Transfer',
        referenceNumber: input.reference,
        createdById: input.actorId,
        createdAt: plusDays(input.dueDate, 2),
      },
      {
        amount: input.paidAmount,
        relatedEntryId: entry.id,
        createdById: input.actorId,
      },
    );
  }
}

async function seedAnnouncementsAndChats(ctx) {
  const admin = await prisma.user.findUnique({ where: { email: people.admins[0].email } });
  await findFirstOrCreate(
    prisma.announcement,
    { organizationId: orgId, title: 'Demo Term Kickoff Briefing', creatorId: admin.id },
    {
      title: 'Demo Term Kickoff Briefing',
      body: 'Welcome to the demo academic cycle. Schedules, assessments, attendance, and finance records are ready for testing.',
      targetType: 'ORG',
      targetId: orgId,
      priority: 'NORMAL',
      creatorId: admin.id,
      organizationId: orgId,
      actionUrl: '/dashboard',
    },
    {
      body: 'Welcome to the demo academic cycle. Schedules, assessments, attendance, and finance records are ready for testing.',
      actionUrl: '/dashboard',
    },
  );

  const chat = await findFirstOrCreate(
    prisma.chat,
    { organizationId: orgId, name: 'Demo Academic Coordination' },
    {
      type: 'GROUP',
      name: 'Demo Academic Coordination',
      organizationId: orgId,
      creatorId: admin.id,
      readOnly: false,
    },
    { readOnly: false },
  );

  const participantUsers = [
    admin,
    await prisma.user.findUnique({ where: { email: people.managers[0].email } }),
    await prisma.user.findUnique({ where: { email: people.teachers[0].email } }),
    await prisma.user.findUnique({ where: { email: people.financeManagers[0].email } }),
  ].filter(Boolean);

  for (const user of participantUsers) {
    const participant = await prisma.chatParticipant.upsert({
      where: { chatId_userId: { chatId: chat.id, userId: user.id } },
      update: { role: user.id === admin.id ? 'ADMIN' : 'MEMBER', isActive: true },
      create: {
        chatId: chat.id,
        userId: user.id,
        role: user.id === admin.id ? 'ADMIN' : 'MEMBER',
        isActive: true,
      },
    });
    await findFirstOrCreate(
      prisma.chatMembershipHistory,
      { chatParticipantId: participant.id, deactivatedAt: null },
      { chatParticipantId: participant.id },
      {},
    );
  }

  await findFirstOrCreate(
    prisma.chatMessage,
    { chatId: chat.id, senderId: admin.id, content: 'Demo coordination room is ready for academic and finance workflow testing.' },
    {
      chatId: chat.id,
      senderId: admin.id,
      organizationId: orgId,
      content: 'Demo coordination room is ready for academic and finance workflow testing.',
      type: 'TEXT',
    },
    {},
  );
}

async function upsertUser(seed, passwordHash) {
  const existing = await prisma.user.findUnique({ where: { email: seed.email } });
  if (existing && existing.organizationId !== orgId) {
    throw new Error(`Email ${seed.email} already belongs to another organization (${existing.organizationId}).`);
  }
  const data = {
    email: seed.email,
    name: seed.name,
    phone: seed.phone,
    role: seed.role,
    organizationId: orgId,
    status: UserStatus.ACTIVE,
    departmentScopeType: seed.departmentScopeType || DepartmentScopeType.ALL,
    isFirstLogin: false,
  };
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { ...data, password: passwordHash },
    });
  }
  return prisma.user.create({
    data: { ...data, password: passwordHash },
  });
}

async function upsertTeacherProfile(user, data) {
  return prisma.teacher.upsert({
    where: { userId: user.id },
    update: {
      organizationId: orgId,
      subject: data.subject,
      designation: data.designation,
      education: data.education,
      department: data.department,
      departmentScopeType: data.departmentScopeType,
      status: data.status,
      joiningDate: date('2026-07-15'),
      address: 'Demo Faculty Housing, Lahore',
      emergencyContact: '+92 300 555 0199',
      bloodGroup: 'O+',
    },
    create: {
      userId: user.id,
      organizationId: orgId,
      subject: data.subject,
      designation: data.designation,
      education: data.education,
      department: data.department,
      departmentScopeType: data.departmentScopeType,
      status: data.status,
      joiningDate: date('2026-07-15'),
      address: 'Demo Faculty Housing, Lahore',
      emergencyContact: '+92 300 555 0199',
      bloodGroup: 'O+',
    },
  });
}

async function upsertStudentProfile(user, data) {
  const existingRegistration = await prisma.student.findFirst({
    where: { organizationId: orgId, registrationNumber: data.registrationNumber },
  });
  if (existingRegistration && existingRegistration.userId !== user.id) {
    throw new Error(`Registration number ${data.registrationNumber} is already used by another student.`);
  }
  const existingRoll = await prisma.student.findFirst({
    where: { organizationId: orgId, rollNumber: data.rollNumber },
  });
  if (existingRoll && existingRoll.userId !== user.id) {
    throw new Error(`Roll number ${data.rollNumber} is already used by another student.`);
  }

  return prisma.student.upsert({
    where: { userId: user.id },
    update: data,
    create: {
      userId: user.id,
      organizationId: orgId,
      ...data,
    },
  });
}

async function replaceSubAdminDepartments(userId, departmentIds) {
  await prisma.subAdminDepartment.deleteMany({ where: { userId } });
  if (departmentIds.length === 0) return;
  await prisma.subAdminDepartment.createMany({
    data: departmentIds.map((departmentId) => ({ organizationId: orgId, userId, departmentId })),
    skipDuplicates: true,
  });
}

async function replaceTeacherDepartments(teacherId, departmentIds, asManager) {
  const model = asManager ? prisma.managerDepartment : prisma.teacherDepartment;
  await model.deleteMany({ where: { teacherId } });
  if (departmentIds.length === 0) return;
  await model.createMany({
    data: departmentIds.map((departmentId) => ({ organizationId: orgId, teacherId, departmentId })),
    skipDuplicates: true,
  });
}

async function replaceStudentDepartments(studentId, departmentIds) {
  await prisma.studentDepartment.deleteMany({ where: { studentId } });
  if (departmentIds.length === 0) return;
  await prisma.studentDepartment.createMany({
    data: departmentIds.map((departmentId) => ({ organizationId: orgId, studentId, departmentId })),
    skipDuplicates: true,
  });
}

async function ensureEnrollment(studentId, sectionId, academicCycleId) {
  await prisma.enrollment.upsert({
    where: { studentId_sectionId: { studentId, sectionId } },
    update: { academicCycleId, source: 'COHORT', isExcludedFromCohort: false },
    create: { studentId, sectionId, academicCycleId, source: 'COHORT' },
  });
  await findFirstOrCreate(
    prisma.enrollmentHistory,
    { studentId, sectionId, academicCycleId, removedAt: null },
    { studentId, sectionId, academicCycleId, source: 'COHORT' },
    { removedAt: null },
  );
}

async function ensureCohortMembership(studentId, cohortId, academicCycleId) {
  await findFirstOrCreate(
    prisma.cohortMembershipHistory,
    { studentId, cohortId, academicCycleId, leftAt: null },
    { studentId, cohortId, academicCycleId },
    { leftAt: null },
  );
}

async function findFirstOrCreate(model, where, create, update) {
  const existing = await model.findFirst({ where });
  if (existing) {
    return model.update({ where: { id: existing.id }, data: update });
  }
  return model.create({ data: create });
}

main()
  .catch((error) => {
    console.error('\nDemo seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
