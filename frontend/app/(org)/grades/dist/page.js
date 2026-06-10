'use client';
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var react_1 = require("react");
var link_1 = require("next/link");
var swr_1 = require("swr");
var lucide_react_1 = require("lucide-react");
var types_1 = require("@/types");
var AuthContext_1 = require("@/context/AuthContext");
var GlobalContext_1 = require("@/context/GlobalContext");
var api_1 = require("@/lib/api");
var Badge_1 = require("@/components/ui/Badge");
var Button_1 = require("@/components/ui/Button");
var CustomSelect_1 = require("@/components/ui/CustomSelect");
var DataTable_1 = require("@/components/ui/DataTable");
var EmptyState_1 = require("@/components/ui/EmptyState");
var ErrorState_1 = require("@/components/ui/ErrorState");
var Input_1 = require("@/components/ui/Input");
var Modal_1 = require("@/components/ui/Modal");
var PageShell_1 = require("@/components/ui/PageShell");
var Skeleton_1 = require("@/components/ui/Skeleton");
var StatusBanner_1 = require("@/components/ui/StatusBanner");
var DocsLink_1 = require("@/components/ui/DocsLink");
var utils_1 = require("@/lib/utils");
var Brand_1 = require("@/components/ui/Brand");
var SectionLabel_1 = require("@/components/sections/SectionLabel");
var GradingForm_1 = require("@/components/forms/GradingForm");
function SectionCardSkeleton() {
    return (React.createElement("div", { className: "rounded-lg border border-border/70 bg-card p-4 shadow-sm" },
        React.createElement("div", { className: "flex items-start justify-between gap-4" },
            React.createElement("div", { className: "flex min-w-0 flex-1 items-center gap-3" },
                React.createElement(Skeleton_1.Skeleton, { className: "h-10 w-10 rounded-md" }),
                React.createElement("div", { className: "min-w-0 flex-1 space-y-2" },
                    React.createElement(Skeleton_1.Skeleton, { className: "h-5 w-2/3 rounded-md" }),
                    React.createElement(Skeleton_1.Skeleton, { className: "h-3 w-1/2 rounded-md" }))),
            React.createElement(Skeleton_1.Skeleton, { className: "h-8 w-8 rounded-md" })),
        React.createElement("div", { className: "mt-4 grid gap-2 sm:grid-cols-2" },
            React.createElement(Skeleton_1.Skeleton, { className: "h-16 rounded-md" }),
            React.createElement(Skeleton_1.Skeleton, { className: "h-16 rounded-md" }))));
}
function SectionGradeCard(_a) {
    var _b, _c, _d;
    var section = _a.section;
    var sectionColor = utils_1.getSectionColor(section);
    var sectionPanelStyle = utils_1.getSectionSurfaceStyle(section, '0C', '38');
    var sectionBadgeStyle = utils_1.getSectionTintStyle(section);
    return (React.createElement(link_1["default"], { href: "/sections/" + section.id, className: "group block overflow-hidden rounded-lg border shadow-sm transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background", style: utils_1.getSectionSurfaceStyle(section, '10', '55') },
        React.createElement("div", { className: "flex min-w-0 items-start justify-between gap-3 border-b p-4", style: { borderColor: sectionColor + "38", backgroundColor: sectionColor + "08" } },
            React.createElement("div", { className: "flex min-w-0 items-start gap-3" },
                React.createElement("div", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border", style: sectionBadgeStyle },
                    React.createElement(lucide_react_1.GraduationCap, { className: "h-5 w-5", "aria-hidden": "true" })),
                React.createElement("div", { className: "min-w-0" },
                    React.createElement(SectionLabel_1.CourseSectionLabel, { section: section, as: "h2", className: "truncate text-base font-black md:text-lg" }),
                    React.createElement("div", { className: "mt-1 flex flex-wrap gap-1.5" },
                        React.createElement(Badge_1.Badge, { variant: "neutral", size: "sm", style: sectionBadgeStyle }, ((_b = section.course) === null || _b === void 0 ? void 0 : _b.name) || 'Generic Course'),
                        ((_c = section.cohort) === null || _c === void 0 ? void 0 : _c.name) && React.createElement(Badge_1.Badge, { variant: "neutral", size: "sm", style: sectionBadgeStyle }, section.cohort.name),
                        ((_d = section.academicCycle) === null || _d === void 0 ? void 0 : _d.name) && React.createElement(Badge_1.Badge, { variant: "neutral", size: "sm", style: sectionBadgeStyle }, section.academicCycle.name)))),
            React.createElement("div", { className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-transform group-hover:translate-x-0.5", style: sectionBadgeStyle },
                React.createElement(lucide_react_1.ChevronRight, { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5", "aria-hidden": "true" }))),
        React.createElement("div", { className: "grid gap-2 p-3 sm:grid-cols-2 sm:p-4" },
            React.createElement("div", { className: "rounded-md border p-3", style: sectionPanelStyle },
                React.createElement("div", { className: "flex items-center gap-2 text-xs font-black uppercase tracking-wide", style: { color: sectionColor } },
                    React.createElement(lucide_react_1.Layers, { className: "h-4 w-4", "aria-hidden": "true" }),
                    "Grade Workspace"),
                React.createElement("p", { className: "mt-2 text-sm font-semibold", style: { color: sectionColor } }, "Open assessments and grade records")),
            React.createElement("div", { className: "rounded-md border p-3", style: sectionPanelStyle },
                React.createElement("div", { className: "flex items-center gap-2 text-xs font-black uppercase tracking-wide", style: { color: sectionColor } },
                    React.createElement(lucide_react_1.Users, { className: "h-4 w-4", "aria-hidden": "true" }),
                    "Section Context"),
                React.createElement("p", { className: "mt-2 truncate text-sm font-semibold", style: { color: sectionColor } }, section.cohort ? section.cohort.name + " cohort" : 'No cohort assigned')))));
}
var UNFINALIZED_STATUS_OPTIONS = [
    { value: 'ALL', label: 'Draft and Published' },
    { value: types_1.GradeStatus.DRAFT, label: 'Draft only' },
    { value: types_1.GradeStatus.PUBLISHED, label: 'Published only' },
];
function getGradeStatusVariant(status) {
    if (status === types_1.GradeStatus.DRAFT)
        return 'warning';
    if (status === types_1.GradeStatus.PUBLISHED)
        return 'info';
    if (status === types_1.GradeStatus.FINALIZED)
        return 'success';
    return 'neutral';
}
function buildUnfinalizedGradeRows(assessments, gradeLists) {
    return assessments.flatMap(function (assessment, index) {
        var grades = gradeLists[index] || [];
        return grades
            .filter(function (grade) { return grade.status !== types_1.GradeStatus.FINALIZED && grade.student; })
            .map(function (grade) {
            var _a, _b, _c, _d;
            return ({
                id: assessment.id + ":" + grade.studentId,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                assessmentType: assessment.type,
                totalMarks: assessment.totalMarks,
                weightage: assessment.weightage,
                sectionId: assessment.sectionId,
                sectionName: ((_a = assessment.section) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Section',
                sectionColor: (_b = assessment.section) === null || _b === void 0 ? void 0 : _b.color,
                courseName: ((_d = (_c = assessment.section) === null || _c === void 0 ? void 0 : _c.course) === null || _d === void 0 ? void 0 : _d.name) || 'Generic Course',
                grade: grade,
                student: grade.student
            });
        });
    });
}
function UnfinalizedGradesPanel(_a) {
    var _this = this;
    var token = _a.token, canReview = _a.canReview;
    var dispatch = GlobalContext_1.useGlobal().dispatch;
    var _b = react_1.useState(''), searchTerm = _b[0], setSearchTerm = _b[1];
    var _c = react_1.useState('ALL'), statusFilter = _c[0], setStatusFilter = _c[1];
    var _d = react_1.useState(''), sectionFilter = _d[0], setSectionFilter = _d[1];
    var _e = react_1.useState(null), editingRow = _e[0], setEditingRow = _e[1];
    var reviewKey = token && canReview ? ['unfinalized-grade-review', token] : null;
    var _f = swr_1["default"](reviewKey, function () { return __awaiter(_this, void 0, void 0, function () {
        var assessments, gradeLists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, api_1.api.org.getAssessments(token)];
                case 1:
                    assessments = _a.sent();
                    return [4 /*yield*/, Promise.all(assessments.map(function (assessment) { return api_1.api.org.getGrades(assessment.id, token); }))];
                case 2:
                    gradeLists = _a.sent();
                    return [2 /*return*/, buildUnfinalizedGradeRows(assessments, gradeLists)];
            }
        });
    }); }), _g = _f.data, reviewRows = _g === void 0 ? [] : _g, isLoading = _f.isLoading, error = _f.error, mutate = _f.mutate;
    var sectionOptions = react_1.useMemo(function () {
        var byId = new Map();
        reviewRows.forEach(function (row) {
            byId.set(row.sectionId, row.courseName + " - " + row.sectionName);
        });
        return __spreadArrays([
            { value: '', label: 'All sections' }
        ], Array.from(byId.entries()).map(function (_a) {
            var value = _a[0], label = _a[1];
            return ({ value: value, label: label });
        }));
    }, [reviewRows]);
    var filteredRows = react_1.useMemo(function () {
        var term = searchTerm.trim().toLowerCase();
        return reviewRows.filter(function (row) {
            var _a;
            var matchesStatus = statusFilter === 'ALL' || row.grade.status === statusFilter;
            var matchesSection = !sectionFilter || row.sectionId === sectionFilter;
            var matchesSearch = !term || [
                (_a = row.student.user) === null || _a === void 0 ? void 0 : _a.name,
                row.student.registrationNumber,
                row.student.rollNumber,
                row.assessmentTitle,
                row.assessmentType,
                row.courseName,
                row.sectionName,
            ].some(function (value) { return String(value || '').toLowerCase().includes(term); });
            return matchesStatus && matchesSection && matchesSearch;
        });
    }, [reviewRows, searchTerm, sectionFilter, statusFilter]);
    var finalizeGrade = react_1.useCallback(function (row) { return __awaiter(_this, void 0, void 0, function () {
        var loadingId, error_1, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token)
                        return [2 /*return*/];
                    loadingId = "finalize-grade-" + row.id;
                    dispatch({ type: 'UI_START_PROCESSING', payload: loadingId });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.api.org.updateGrade(row.assessmentId, row.student.id, {
                            marksObtained: row.grade.marksObtained,
                            feedback: row.grade.feedback,
                            status: types_1.GradeStatus.FINALIZED
                        }, token)];
                case 2:
                    _a.sent();
                    dispatch({ type: 'TOAST_ADD', payload: { message: "Finalized " + row.student.user.name + "'s grade.", type: 'success' } });
                    mutate();
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    message = error_1 instanceof Error ? error_1.message : 'Failed to finalize grade';
                    dispatch({ type: 'TOAST_ADD', payload: { message: message, type: 'error' } });
                    return [3 /*break*/, 5];
                case 4:
                    dispatch({ type: 'UI_STOP_PROCESSING', payload: loadingId });
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [dispatch, mutate, token]);
    if (!canReview) {
        return (React.createElement(EmptyState_1.EmptyState, { icon: lucide_react_1.GraduationCap, title: "Review workspace unavailable", description: "Only academic staff can review unfinalized grades.", className: "min-h-72" }));
    }
    return (React.createElement(PageShell_1.ResourcePanel, { className: "overflow-y-auto" },
        React.createElement("div", { className: "shrink-0 space-y-3 border-b border-border/60 bg-card/80 p-3 sm:p-4" },
            React.createElement(StatusBanner_1.StatusBanner, { variant: "warning", icon: lucide_react_1.AlertTriangle, title: "Unfinalized grades stay out of transcripts", description: React.createElement(React.Fragment, null,
                    "Review Draft and Published grades before transcripts use them. ",
                    React.createElement(DocsLink_1.DocsLink, { href: "/docs/gradebook#grades-page" }, "Read gradebook rules")), dismissible: true }),
            React.createElement("div", { className: "grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-center" },
                React.createElement(Input_1.Input, { placeholder: "Search student, assessment, course, or section...", value: searchTerm, onChange: function (event) { return setSearchTerm(event.target.value); }, icon: lucide_react_1.Search, className: "h-11 border-border/60 bg-background/70" }),
                React.createElement(CustomSelect_1.CustomSelect, { value: statusFilter, onChange: setStatusFilter, options: UNFINALIZED_STATUS_OPTIONS }),
                React.createElement(CustomSelect_1.CustomSelect, { value: sectionFilter, onChange: setSectionFilter, options: sectionOptions, searchable: true }),
                React.createElement(Button_1.Button, { type: "button", variant: "secondary", icon: lucide_react_1.RefreshCw, onClick: function () { return mutate(); }, className: "w-full lg:w-auto" }, "Refresh"))),
        React.createElement("div", { className: "min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" }, error ? (React.createElement(ErrorState_1.ErrorState, { error: error, onRetry: function () { return mutate(); } })) : (React.createElement(DataTable_1.DataTable, { data: filteredRows, columns: [
                {
                    header: 'Student',
                    accessor: function (row) { return (React.createElement("div", { className: "flex min-w-0 items-center gap-3" },
                        React.createElement(Brand_1.BrandIcon, { variant: "user", size: "sm", user: row.student.user, className: "h-8 w-8 shrink-0" }),
                        React.createElement("div", { className: "min-w-0" },
                            React.createElement("p", { className: "truncate font-bold text-foreground" }, row.student.user.name),
                            React.createElement("p", { className: "truncate text-xs text-muted-foreground" }, row.student.registrationNumber || row.student.rollNumber || 'No registration')))); },
                    width: 250
                },
                {
                    header: 'Course Section',
                    accessor: function (row) { return (React.createElement("div", { className: "min-w-0" },
                        React.createElement("p", { className: "truncate font-bold text-foreground" }, row.courseName),
                        React.createElement("p", { className: "truncate text-xs text-muted-foreground" }, row.sectionName))); },
                    width: 220
                },
                {
                    header: 'Assessment',
                    accessor: function (row) { return (React.createElement("div", { className: "min-w-0" },
                        React.createElement("p", { className: "truncate font-bold text-foreground" }, row.assessmentTitle),
                        React.createElement("p", { className: "truncate text-xs text-muted-foreground" }, row.assessmentType))); },
                    width: 240
                },
                {
                    header: 'Status',
                    accessor: function (row) { return (React.createElement(Badge_1.Badge, { variant: getGradeStatusVariant(row.grade.status), size: "sm" }, row.grade.status === types_1.GradeStatus.DRAFT ? 'Draft' : 'Published')); },
                    badge: true,
                    width: 120
                },
                {
                    header: 'Marks',
                    accessor: function (row) { return (React.createElement("span", { className: "font-black text-primary" },
                        row.grade.marksObtained,
                        React.createElement("span", { className: "text-xs text-muted-foreground" },
                            " / ",
                            row.totalMarks))); },
                    width: 120
                },
                {
                    header: 'Weight',
                    accessor: function (row) { return row.weightage + "%"; },
                    width: 100
                },
                {
                    header: 'Actions',
                    accessor: function (row) { return (React.createElement("div", { className: "flex gap-2" },
                        React.createElement(Button_1.Button, { type: "button", size: "sm", variant: "secondary", icon: lucide_react_1.Edit3, onClick: function (event) {
                                event.stopPropagation();
                                setEditingRow(row);
                            } }, "Edit"),
                        React.createElement(Button_1.Button, { type: "button", size: "sm", icon: lucide_react_1.CheckCircle2, loadingId: "finalize-grade-" + row.id, onClick: function (event) {
                                event.stopPropagation();
                                finalizeGrade(row);
                            } }, "Finalize"))); },
                    width: 220
                },
            ], keyExtractor: function (row) { return row.id; }, currentPage: 1, totalPages: 1, totalResults: filteredRows.length, pageSize: Math.max(filteredRows.length, 10), onPageChange: function () { }, showSerialNumber: true, isLoading: isLoading, emptyTitle: "No unfinalized grades", emptyDescription: reviewRows.length === 0 ? 'All entered grades are finalized, or no grades have been entered yet.' : 'No grades match the current filters.' }))),
        React.createElement(Modal_1.Modal, { isOpen: !!editingRow, onClose: function () { return setEditingRow(null); }, title: "Review Grade", subtitle: editingRow ? editingRow.student.user.name + " - " + editingRow.assessmentTitle : '', maxWidth: "max-w-xl" }, editingRow && (React.createElement(GradingForm_1["default"], { assessmentId: editingRow.assessmentId, student: editingRow.student, totalMarks: editingRow.totalMarks, initialData: editingRow.grade, onSuccess: function () {
                mutate();
                setEditingRow(null);
            }, onCancel: function () { return setEditingRow(null); } })))));
}
function GradesPage() {
    var _a = AuthContext_1.useAuth(), token = _a.token, user = _a.user;
    var _b = react_1.useState(''), searchTerm = _b[0], setSearchTerm = _b[1];
    var _c = react_1.useState('sections'), view = _c[0], setView = _c[1];
    var canReviewUnfinalized = (user === null || user === void 0 ? void 0 : user.role) === types_1.Role.ORG_ADMIN || (user === null || user === void 0 ? void 0 : user.role) === types_1.Role.ORG_MANAGER || (user === null || user === void 0 ? void 0 : user.role) === types_1.Role.TEACHER;
    var sectionsKey = token && user
        ? ['sections-for-grades', { my: user.role === types_1.Role.TEACHER }]
        : null;
    var _d = swr_1["default"](sectionsKey), sectionsData = _d.data, isLoading = _d.isLoading;
    var sections = react_1.useMemo(function () { return (sectionsData === null || sectionsData === void 0 ? void 0 : sectionsData.data) || []; }, [sectionsData === null || sectionsData === void 0 ? void 0 : sectionsData.data]);
    var filteredSections = react_1.useMemo(function () {
        var term = searchTerm.toLowerCase();
        if (!term)
            return sections;
        return sections.filter(function (section) {
            var _a;
            return (section.name.toLowerCase().includes(term) ||
                (((_a = section.course) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase().includes(term));
        });
    }, [searchTerm, sections]);
    return (React.createElement(PageShell_1.PageShell, null,
        React.createElement(PageShell_1.PageHeader, { title: "Grades", description: React.createElement(React.Fragment, null,
                "Choose a section or review grades before final transcript approval. ",
                React.createElement(DocsLink_1.DocsLink, { href: "/docs/gradebook#grades-page" }, "Read grade docs")), icon: lucide_react_1.GraduationCap, breadcrumbs: [
                { label: 'Organization' },
                { label: 'Academics' },
                { label: 'Grades' },
            ], meta: React.createElement(Badge_1.Badge, { variant: "neutral", size: "sm" },
                sections.length,
                " sections") }),
        React.createElement("div", { className: "inline-flex w-full rounded-lg border border-border/70 bg-card p-1 shadow-sm sm:w-auto" },
            React.createElement("button", { type: "button", onClick: function () { return setView('sections'); }, className: "min-h-10 flex-1 rounded-md px-4 text-sm font-black transition-colors sm:flex-none " + (view === 'sections' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground') }, "Sections"),
            canReviewUnfinalized && (React.createElement("button", { type: "button", onClick: function () { return setView('unfinalized'); }, className: "min-h-10 flex-1 rounded-md px-4 text-sm font-black transition-colors sm:flex-none " + (view === 'unfinalized' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground') }, "Unfinalized"))),
        view === 'unfinalized' ? (React.createElement(UnfinalizedGradesPanel, { token: token, canReview: Boolean(canReviewUnfinalized) })) : isLoading ? (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "flex flex-col gap-3 rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:p-4" },
                React.createElement(Skeleton_1.Skeleton, { className: "h-10 w-full max-w-md rounded-md" }),
                React.createElement("div", { className: "hidden items-center gap-2 sm:flex" },
                    React.createElement(Skeleton_1.Skeleton, { className: "h-4 w-4 rounded-full" }),
                    React.createElement(Skeleton_1.Skeleton, { className: "h-3 w-24 rounded-md" }))),
            React.createElement("div", { className: "grid grid-cols-1 gap-3 xl:grid-cols-2" }, __spreadArrays(Array(6)).map(function (_, index) { return (React.createElement(SectionCardSkeleton, { key: index })); })))) : (React.createElement(PageShell_1.ResourcePanel, { className: "overflow-y-auto" },
            React.createElement("div", { className: "shrink-0 border-b border-border/60 bg-card/80 p-3 sm:p-4" },
                React.createElement("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" },
                    React.createElement("div", { className: "w-full max-w-md" },
                        React.createElement(Input_1.Input, { placeholder: "Search sections or courses...", value: searchTerm, onChange: function (event) { return setSearchTerm(event.target.value); }, icon: lucide_react_1.Search, className: "h-11 border-border/60 bg-background/70" })),
                    React.createElement("div", { className: "hidden items-center gap-2 text-xs font-black text-muted-foreground sm:flex" },
                        React.createElement(lucide_react_1.GraduationCap, { className: "h-4 w-4" }),
                        React.createElement("span", null,
                            "Total Sections: ",
                            sections.length)))),
            React.createElement("div", { className: "min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" }, filteredSections.length === 0 ? (React.createElement(EmptyState_1.EmptyState, { icon: lucide_react_1.BookOpen, title: "No sections found", description: searchTerm ? 'Try a different section or course search.' : 'Sections will appear here when they are available for grading.', className: "min-h-72" })) : (React.createElement("div", { className: "grid grid-cols-1 gap-3 xl:grid-cols-2" }, filteredSections.map(function (section) { return (React.createElement(SectionGradeCard, { key: section.id, section: section })); }))))))));
}
exports["default"] = GradesPage;
