"use strict";
exports.__esModule = true;
exports.getOrgOverviewHref = exports.buildOrgSidebarLinks = void 0;
var lucide_react_1 = require("lucide-react");
var types_1 = require("@/types");
function overviewHrefFor(user) {
    if (!user)
        return '/overview';
    if (user.role === types_1.Role.TEACHER || user.role === types_1.Role.ORG_MANAGER)
        return "/teachers/" + user.id;
    if (user.role === types_1.Role.FINANCE_MANAGER)
        return '/finance';
    if (user.role === types_1.Role.STUDENT)
        return "/students/" + user.id;
    return '/overview';
}
function buildOrgSidebarLinks(_a) {
    var user = _a.user, isApproved = _a.isApproved, unreadChats = _a.unreadChats;
    var links = [];
    if (!isApproved) {
        if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.ORG_ADMIN) {
            links.push({ id: 'SETTINGS', label: 'Settings', href: '/settings', icon: lucide_react_1.Settings });
        }
        return links;
    }
    links.push({ id: 'DASHBOARD', label: 'Overview', href: overviewHrefFor(user), icon: lucide_react_1.LayoutDashboard });
    links.push({
        id: 'CHAT',
        label: 'Messages',
        href: '/chat',
        icon: lucide_react_1.MessageSquare,
        badge: unreadChats && unreadChats > 0 ? "" + unreadChats : undefined
    });
    if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.ORG_ADMIN || (user === null || user === void 0 ? void 0 : user.role) === types_1.Role.SUB_ADMIN) {
        links.push({ id: 'COURSES', label: 'Courses', href: '/courses', icon: lucide_react_1.LibraryBig });
        links.push({ id: 'ACADEMIC_CYCLES', label: 'Academic Cycles', href: '/academic-cycles', icon: lucide_react_1.Calendar });
        links.push({ id: 'COHORTS', label: 'Cohorts', href: '/cohorts', icon: lucide_react_1.Network });
        links.push({ id: 'SECTIONS', label: 'Sections', href: '/sections', icon: lucide_react_1.Layers });
        links.push({ id: 'TEACHERS', label: 'Teachers', href: '/teachers', icon: lucide_react_1.Users });
        links.push({ id: 'STUDENTS', label: 'Students', href: '/students', icon: lucide_react_1.GraduationCap });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: lucide_react_1.CheckCircle });
        links.push({ id: 'SCHEDULES', label: 'Schedules', href: '/schedules', icon: lucide_react_1.CalendarDays });
        links.push({ id: 'TRANSCRIPTS', label: 'Transcripts', href: '/transcripts', icon: lucide_react_1.FileText });
        links.push({ id: 'PROMOTIONS', label: 'Promotions', href: '/promotions', icon: lucide_react_1.ArrowRightCircle });
        links.push({ id: 'GRADE_FINALIZATION', label: 'Grade Finalization', href: '/grade-finalization', icon: lucide_react_1.Trophy });
        links.push({ id: 'FINANCE', label: user.role === types_1.Role.SUB_ADMIN ? 'Finance Audit' : 'Finance', href: '/finance', icon: lucide_react_1.Wallet });
        links.push({ id: 'FINANCE_MANAGERS', label: 'Finance Managers', href: '/finance-managers', icon: lucide_react_1.WalletCards });
        if (user.role === types_1.Role.ORG_ADMIN) {
            links.push({ id: 'SUB_ADMINS', label: 'Sub Admins', href: '/sub-admins', icon: lucide_react_1.ShieldCheck });
            links.push({ id: 'GPA_POLICIES', label: 'GPA Policies', href: '/settings/gpa-policies', icon: lucide_react_1.ScrollText });
            links.push({ id: 'SETTINGS', label: 'Settings', href: '/settings', icon: lucide_react_1.Settings });
        }
    }
    if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.TEACHER) {
        links.push({ id: 'COURSES', label: 'My Courses', href: '/courses', icon: lucide_react_1.LibraryBig });
        links.push({ id: 'SECTIONS', label: 'My Sections', href: '/sections', icon: lucide_react_1.Layers });
        links.push({ id: 'STUDENTS', label: 'My Students', href: '/students', icon: lucide_react_1.GraduationCap });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: lucide_react_1.CheckCircle });
    }
    if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.ORG_MANAGER) {
        links.push({ id: 'SECTIONS', label: 'My Sections', href: '/sections', icon: lucide_react_1.Layers });
        links.push({ id: 'STUDENTS', label: 'My Students', href: '/students', icon: lucide_react_1.GraduationCap });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: lucide_react_1.CheckCircle });
        links.push({ id: 'TRANSCRIPTS', label: 'Transcripts', href: '/transcripts', icon: lucide_react_1.FileText });
        links.push({ id: 'GRADE_FINALIZATION', label: 'Grade Finalization', href: '/grade-finalization', icon: lucide_react_1.Trophy });
    }
    if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.TEACHER || (user === null || user === void 0 ? void 0 : user.role) === types_1.Role.ORG_MANAGER) {
        links.push({ id: 'TIMETABLE', label: 'Timetable', href: '/timetable', icon: lucide_react_1.Clock });
        links.push({ id: 'GRADES', label: 'Grades', href: '/grades', icon: lucide_react_1.Trophy });
        links.push({ id: 'PROFILE', label: 'Profile Settings', href: "/teachers/" + user.id + "/profile", icon: lucide_react_1.Settings });
    }
    if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.FINANCE_MANAGER) {
        links.push({ id: 'FINANCE', label: 'Finance', href: '/finance', icon: lucide_react_1.Wallet });
    }
    if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.STUDENT) {
        links.push({ id: 'COURSES', label: 'My Courses', href: "/students/" + user.id + "?tab=courses", icon: lucide_react_1.Book });
        links.push({ id: 'ASSESSMENTS', label: 'Assessments', href: "/students/" + user.id + "?tab=assessments", icon: lucide_react_1.BookOpen });
        links.push({ id: 'GRADES', label: 'Grades', href: "/students/" + user.id + "?tab=grades", icon: lucide_react_1.Trophy });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: "/students/" + user.id + "?tab=attendance", icon: lucide_react_1.CheckCircle });
        links.push({ id: 'TIMETABLE', label: 'Timetable', href: '/timetable', icon: lucide_react_1.Clock });
        links.push({ id: 'TRANSCRIPT', label: 'Transcript', href: '/transcripts', icon: lucide_react_1.FileText });
        links.push({ id: 'FEES', label: 'Fees & Payments', href: '/fees', icon: lucide_react_1.Wallet });
        links.push({ id: 'PROFILE', label: 'Profile Settings', href: "/students/" + user.id + "?tab=profile", icon: lucide_react_1.Settings });
    }
    return links;
}
exports.buildOrgSidebarLinks = buildOrgSidebarLinks;
function getOrgOverviewHref(user) {
    if ((user === null || user === void 0 ? void 0 : user.role) === types_1.Role.ORG_ADMIN || (user === null || user === void 0 ? void 0 : user.role) === types_1.Role.SUB_ADMIN)
        return '/overview';
    return overviewHrefFor(user);
}
exports.getOrgOverviewHref = getOrgOverviewHref;
