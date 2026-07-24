import {
  ArrowRightCircle,
  Bell,
  Book,
  BookOpen,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LibraryBig,
  MapPinned,
  MessageSquare,
  Network,
  Settings,
  Sparkles,
  ListChecks,
  Trophy,
  Users,
  Wallet,
  UserCog2,
} from "lucide-react";
import { Role } from "@/types";
import type { SidebarLink } from "@/components/ui/DashboardLayout";
import { getRoleDashboardPath } from "@/lib/roles";
import {
  USER_ROUTES,
  financeManagerProfilePath,
  studentPortalPath,
  subAdminProfilePath,
  teacherFeedbackPath,
  teacherProfilePath,
} from "@/lib/routes";

interface OrgSidebarUser {
  id?: string;
  role?: Role | null;
}

interface BuildOrgSidebarLinksOptions {
  user: OrgSidebarUser | null;
  isApproved: boolean;
  unreadChats?: number;
}

export interface SidebarContext {
  role: Role | null;
  userId?: string;
  isApproved: boolean;
  unreadChats?: number;
}

export interface GetSidebarLinksForRoleOptions {
  userId?: string;
  isApproved?: boolean;
  unreadChats?: number;
}

type SidebarAudience = readonly Role[] | "all";
type SidebarLabel = string | ((ctx: SidebarContext) => string);
type SidebarHref = string | null | ((ctx: SidebarContext) => string | null);

interface SidebarItemConfig {
  id: string;
  label: SidebarLabel;
  href: SidebarHref;
  icon: SidebarLink["icon"];
  roles: SidebarAudience;
  excludedRoles?: readonly Role[];
  showWhenUnapproved?: boolean;
  hiddenWhen?: (ctx: SidebarContext) => boolean;
  badge?: (ctx: SidebarContext) => SidebarLink["badge"] | undefined;
}

const ADMIN_ROLES = [Role.ORG_ADMIN, Role.SUB_ADMIN] as const;
const TEACHER_PORTAL_ROLES = [Role.TEACHER, Role.ORG_MANAGER] as const;

function overviewHrefFor(user: OrgSidebarUser | null) {
  const href = getRoleDashboardPath(user);
  return href === "/" ? "/overview" : href;
}

function overviewHrefForContext(ctx: SidebarContext) {
  return overviewHrefFor({ id: ctx.userId, role: ctx.role });
}

function requiresUserId(ctx: SidebarContext) {
  return !ctx.userId;
}

const COMMON_ITEMS: SidebarItemConfig[] = [
  {
    id: "DASHBOARD",
    label: "Overview",
    href: overviewHrefForContext,
    icon: LayoutDashboard,
    roles: "all",
    excludedRoles: [Role.GUARDIAN, Role.FINANCE_MANAGER],
  },
  {
    id: "CHAT",
    label: "Messages",
    href: "/chat",
    icon: MessageSquare,
    roles: "all",
    badge: (ctx) =>
      ctx.unreadChats && ctx.unreadChats > 0 ? `${ctx.unreadChats}` : undefined,
  },
  {
    id: "AI_COPILOT",
    label: "EduVerse Copilot",
    href: "/ai",
    icon: Sparkles,
    roles: "all",
  },
  {
    id: "CAMPUS_NAVIGATION",
    label: "Campus Map",
    href: "/campus-navigation",
    icon: MapPinned,
    roles: "all",
  },
];

const ADMIN_ITEMS: SidebarItemConfig[] = [
  {
    id: "DEPARTMENTS",
    label: "Departments",
    href: "/departments",
    icon: BookOpen,
    roles: ADMIN_ROLES,
  },
  {
    id: "BUILDINGS_AND_ROOMS",
    label: "Buildings & Rooms",
    href: "/buildings-and-rooms",
    icon: Building2,
    roles: ADMIN_ROLES,
  },
  {
    id: "COURSES",
    label: "Courses",
    href: "/courses",
    icon: LibraryBig,
    roles: ADMIN_ROLES,
  },
  {
    id: "ACADEMIC_CYCLES",
    label: "Academic Cycles",
    href: "/academic-cycles",
    icon: Calendar,
    roles: ADMIN_ROLES,
  },
  {
    id: "COHORTS",
    label: "Cohorts",
    href: "/cohorts",
    icon: Network,
    roles: ADMIN_ROLES,
  },
  {
    id: "SECTIONS",
    label: "Sections",
    href: "/sections",
    icon: Layers,
    roles: ADMIN_ROLES,
  },
  {
    id: "USERS",
    label: "Users",
    href: USER_ROUTES.root,
    icon: UserCog2,
    roles: ADMIN_ROLES,
  },
  {
    id: "ATTENDANCE",
    label: "Attendance",
    href: "/attendance",
    icon: CheckCircle,
    roles: ADMIN_ROLES,
  },
  {
    id: "SCHEDULES",
    label: "Schedules",
    href: "/schedules",
    icon: CalendarDays,
    roles: ADMIN_ROLES,
  },
  {
    id: "TIMETABLE",
    label: "Timetable",
    href: "/timetable",
    icon: Clock,
    roles: ADMIN_ROLES,
  },
  {
    id: "HOLIDAYS",
    label: "Academic Calendar",
    href: "/academic-calender",
    icon: Calendar,
    roles: ADMIN_ROLES,
  },
  {
    id: "TRANSCRIPTS",
    label: "Transcripts",
    href: "/transcripts",
    icon: FileText,
    roles: ADMIN_ROLES,
  },
  {
    id: "REASSIGNMENT",
    label: "Reassignment",
    href: "/reassignment",
    icon: ArrowRightCircle,
    roles: ADMIN_ROLES,
  },
  {
    id: "GRADE_FINALIZATION",
    label: "Grade Finalization",
    href: "/grade-finalization",
    icon: Trophy,
    roles: ADMIN_ROLES,
  },
  {
    id: "EVALUATIONS",
    label: "Evaluations",
    href: "/evaluations",
    icon: ClipboardList,
    roles: ADMIN_ROLES,
  },
  {
    id: "PREFERENCE_WINDOWS",
    label: "Section/Course Polls",
    href: "/preference-windows",
    icon: ListChecks,
    roles: ADMIN_ROLES,
  },
  {
    id: "FINANCE",
    label: (ctx) => (ctx.role === Role.SUB_ADMIN ? "Finance Audit" : "Finance"),
    href: "/finance",
    icon: Wallet,
    roles: ADMIN_ROLES,
  },
  {
    id: "MY_FINANCE",
    label: "My Finance",
    href: "/teacher-finance",
    icon: Wallet,
    roles: [Role.SUB_ADMIN],
  },
  {
    id: "SETTINGS",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: [Role.ORG_ADMIN],
    showWhenUnapproved: true,
  },
  {
    id: "PROFILE",
    label: "Profile Settings",
    href: (ctx) => (ctx.userId ? subAdminProfilePath(ctx.userId) : null),
    icon: Settings,
    roles: [Role.SUB_ADMIN],
    hiddenWhen: requiresUserId,
  },
];

const TEACHER_ITEMS: SidebarItemConfig[] = [
  {
    id: "COURSES",
    label: "My Courses",
    href: "/courses",
    icon: LibraryBig,
    roles: [Role.TEACHER],
  },
  {
    id: "SECTIONS",
    label: "My Sections",
    href: "/sections",
    icon: Layers,
    roles: [Role.TEACHER],
  },
  {
    id: "STUDENTS",
    label: "My Students",
    href: USER_ROUTES.students,
    icon: GraduationCap,
    roles: [Role.TEACHER],
  },
  {
    id: "ATTENDANCE",
    label: "Attendance",
    href: "/attendance",
    icon: CheckCircle,
    roles: [Role.TEACHER],
  },
  {
    id: "FEEDBACK",
    label: "Feedback",
    href: (ctx) => (ctx.userId ? teacherFeedbackPath(ctx.userId) : null),
    icon: ClipboardList,
    roles: [Role.TEACHER],
    hiddenWhen: requiresUserId,
  },
  {
    id: "TEACHER_FINANCE",
    label: "My Finance",
    href: "/teacher-finance",
    icon: Wallet,
    roles: [Role.TEACHER],
  },
];

const MANAGER_ITEMS: SidebarItemConfig[] = [
  {
    id: "SECTIONS",
    label: "My Sections",
    href: "/sections",
    icon: Layers,
    roles: [Role.ORG_MANAGER],
  },
  {
    id: "STUDENTS",
    label: "My Students",
    href: USER_ROUTES.students,
    icon: GraduationCap,
    roles: [Role.ORG_MANAGER],
  },
  {
    id: "ATTENDANCE",
    label: "Attendance",
    href: "/attendance",
    icon: CheckCircle,
    roles: [Role.ORG_MANAGER],
  },
  {
    id: "TRANSCRIPTS",
    label: "Transcripts",
    href: "/transcripts",
    icon: FileText,
    roles: [Role.ORG_MANAGER],
  },
  {
    id: "GRADE_FINALIZATION",
    label: "Grade Finalization",
    href: "/grade-finalization",
    icon: Trophy,
    roles: [Role.ORG_MANAGER],
  },
  {
    id: "EVALUATIONS",
    label: "Evaluations",
    href: "/evaluations",
    icon: ClipboardList,
    roles: [Role.ORG_MANAGER],
  },
  {
    id: "PREFERENCE_WINDOWS",
    label: "Section/Course Polls",
    href: "/preference-windows",
    icon: ListChecks,
    roles: [Role.ORG_MANAGER],
  },
];

const TEACHER_AND_MANAGER_ITEMS: SidebarItemConfig[] = [
  {
    id: "TIMETABLE",
    label: "Timetable",
    href: "/timetable",
    icon: Clock,
    roles: TEACHER_PORTAL_ROLES,
  },
  {
    id: "GRADES",
    label: "Grades",
    href: "/grades",
    icon: Trophy,
    roles: TEACHER_PORTAL_ROLES,
  },
  {
    id: "PROFILE",
    label: "Profile Settings",
    href: (ctx) => (ctx.userId ? teacherProfilePath(ctx.userId) : null),
    icon: Settings,
    roles: TEACHER_PORTAL_ROLES,
    hiddenWhen: requiresUserId,
  },
];

const FINANCE_MANAGER_ITEMS: SidebarItemConfig[] = [
  {
    id: "FINANCE",
    label: "Finance",
    href: "/finance",
    icon: Wallet,
    roles: [Role.FINANCE_MANAGER],
  },
  {
    id: "MY_FINANCE",
    label: "My Finance",
    href: "/teacher-finance",
    icon: Wallet,
    roles: [Role.FINANCE_MANAGER],
  },
  {
    id: "PROFILE",
    label: "Profile Settings",
    href: (ctx) => (ctx.userId ? financeManagerProfilePath(ctx.userId) : null),
    icon: Settings,
    roles: [Role.FINANCE_MANAGER],
    hiddenWhen: requiresUserId,
  },
];

const STUDENT_ITEMS: SidebarItemConfig[] = [
  {
    id: "COURSES",
    label: "My Courses",
    href: (ctx) =>
      ctx.userId ? studentPortalPath(ctx.userId, "courses") : null,
    icon: Book,
    roles: [Role.STUDENT],
    hiddenWhen: requiresUserId,
  },
  {
    id: "ASSESSMENTS",
    label: "Assessments",
    href: (ctx) =>
      ctx.userId ? studentPortalPath(ctx.userId, "assessments") : null,
    icon: BookOpen,
    roles: [Role.STUDENT],
    hiddenWhen: requiresUserId,
  },
  {
    id: "GRADES",
    label: "Grades",
    href: (ctx) =>
      ctx.userId ? studentPortalPath(ctx.userId, "grades") : null,
    icon: Trophy,
    roles: [Role.STUDENT],
    hiddenWhen: requiresUserId,
  },
  {
    id: "ATTENDANCE",
    label: "Attendance",
    href: (ctx) =>
      ctx.userId ? studentPortalPath(ctx.userId, "attendance") : null,
    icon: CheckCircle,
    roles: [Role.STUDENT],
    hiddenWhen: requiresUserId,
  },
  {
    id: "EVALUATIONS",
    label: "Evaluations",
    href: (ctx) =>
      ctx.userId ? studentPortalPath(ctx.userId, "evaluations") : null,
    icon: ClipboardList,
    roles: [Role.STUDENT],
    hiddenWhen: requiresUserId,
  },
  {
    id: "PREFERENCES",
    label: "Preferences",
    href: (ctx) =>
      ctx.userId ? studentPortalPath(ctx.userId, "preferences") : null,
    icon: ListChecks,
    roles: [Role.STUDENT],
    hiddenWhen: requiresUserId,
  },
  {
    id: "TIMETABLE",
    label: "Timetable",
    href: "/timetable",
    icon: Clock,
    roles: [Role.STUDENT],
  },
  {
    id: "TRANSCRIPT",
    label: "Transcript",
    href: "/transcripts",
    icon: FileText,
    roles: [Role.STUDENT],
  },
  {
    id: "FEES",
    label: "Fees & Payments",
    href: "/fees",
    icon: Wallet,
    roles: [Role.STUDENT],
  },
  {
    id: "PROFILE",
    label: "Profile Settings",
    href: (ctx) =>
      ctx.userId ? studentPortalPath(ctx.userId, "profile") : null,
    icon: Settings,
    roles: [Role.STUDENT],
    hiddenWhen: requiresUserId,
  },
];

const GUARDIAN_ITEMS: SidebarItemConfig[] = [
  {
    id: "GUARDIAN_OVERVIEW",
    label: "Overview",
    href: "/guardian",
    icon: LayoutDashboard,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_STUDENTS",
    label: "Linked Students",
    href: "/guardian?view=students",
    icon: Users,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_ATTENDANCE",
    label: "Attendance",
    href: "/guardian?view=attendance",
    icon: CheckCircle,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_GRADES",
    label: "Grades",
    href: "/guardian?view=grades",
    icon: Trophy,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_TIMETABLE",
    label: "Timetable",
    href: "/guardian?view=timetable",
    icon: Clock,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_TRANSCRIPT",
    label: "Transcript",
    href: "/guardian?view=transcript",
    icon: FileText,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_FEES",
    label: "Fees & Payments",
    href: "/guardian?view=fees",
    icon: Wallet,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_ANNOUNCEMENTS",
    label: "Announcements",
    href: "/guardian?view=announcements",
    icon: Bell,
    roles: [Role.GUARDIAN],
  },
  {
    id: "GUARDIAN_PROFILE",
    label: "Profile Settings",
    href: "/guardian?view=profile",
    icon: Settings,
    roles: [Role.GUARDIAN],
  },
];

const SIDEBAR_ITEMS: SidebarItemConfig[] = [
  ...COMMON_ITEMS,
  ...ADMIN_ITEMS,
  ...TEACHER_ITEMS,
  ...MANAGER_ITEMS,
  ...TEACHER_AND_MANAGER_ITEMS,
  ...FINANCE_MANAGER_ITEMS,
  ...STUDENT_ITEMS,
  ...GUARDIAN_ITEMS,
];

function resolveLabel(value: SidebarLabel, ctx: SidebarContext) {
  return typeof value === "function" ? value(ctx) : value;
}

function resolveHref(value: SidebarHref, ctx: SidebarContext) {
  return typeof value === "function" ? value(ctx) : value;
}

function roleCanSee(item: SidebarItemConfig, role: Role | null) {
  const isIncluded =
    item.roles === "all" || (role !== null && item.roles.includes(role));
  const isExcluded = role !== null && item.excludedRoles?.includes(role);
  return isIncluded && !isExcluded;
}

function isSidebarItemVisible(item: SidebarItemConfig, ctx: SidebarContext) {
  if (!roleCanSee(item, ctx.role)) return false;
  if (!ctx.isApproved && !item.showWhenUnapproved) return false;
  if (item.hiddenWhen?.(ctx)) return false;
  return true;
}

function resolveSidebarItem(
  item: SidebarItemConfig,
  ctx: SidebarContext,
): SidebarLink | null {
  const href = resolveHref(item.href, ctx);
  if (!href) return null;

  return {
    id: item.id,
    label: resolveLabel(item.label, ctx),
    href,
    icon: item.icon,
    badge: item.badge?.(ctx),
  };
}

function normalizeSidebarContext(
  roleOrContext: Role | null | SidebarContext,
  options: GetSidebarLinksForRoleOptions = {},
): SidebarContext {
  if (roleOrContext !== null && typeof roleOrContext === "object") {
    return roleOrContext;
  }

  return {
    role: roleOrContext,
    userId: options.userId,
    isApproved: options.isApproved ?? true,
    unreadChats: options.unreadChats,
  };
}

export function getSidebarLinksForRole(
  role: Role | null,
  options?: GetSidebarLinksForRoleOptions,
): SidebarLink[];
export function getSidebarLinksForRole(ctx: SidebarContext): SidebarLink[];
export function getSidebarLinksForRole(
  roleOrContext: Role | null | SidebarContext,
  options?: GetSidebarLinksForRoleOptions,
): SidebarLink[] {
  const ctx = normalizeSidebarContext(roleOrContext, options);

  return SIDEBAR_ITEMS.filter((item) => isSidebarItemVisible(item, ctx))
    .map((item) => resolveSidebarItem(item, ctx))
    .filter((item): item is SidebarLink => item !== null);
}

export function buildOrgSidebarLinks({
  user,
  isApproved,
  unreadChats,
}: BuildOrgSidebarLinksOptions): SidebarLink[] {
  return getSidebarLinksForRole(user?.role ?? null, {
    userId: user?.id,
    isApproved,
    unreadChats,
  });
}

export function getOrgOverviewHref(user: OrgSidebarUser | null) {
  if (user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN)
    return "/overview";
  return overviewHrefFor(user);
}

export const getSidebarItemsForRole = buildOrgSidebarLinks;
