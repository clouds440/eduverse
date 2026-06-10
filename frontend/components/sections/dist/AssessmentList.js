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
var navigation_1 = require("next/navigation");
var lucide_react_1 = require("lucide-react");
var api_1 = require("@/lib/api");
var types_1 = require("@/types");
var AuthContext_1 = require("@/context/AuthContext");
var GlobalContext_1 = require("@/context/GlobalContext");
var Badge_1 = require("@/components/ui/Badge");
var Button_1 = require("@/components/ui/Button");
var Modal_1 = require("@/components/ui/Modal");
var ConfirmDialog_1 = require("@/components/ui/ConfirmDialog");
var StatusBanner_1 = require("@/components/ui/StatusBanner");
var DocsLink_1 = require("@/components/ui/DocsLink");
var AssessmentForm_1 = require("@/components/forms/AssessmentForm");
var utils_1 = require("@/lib/utils");
var SubmissionForm_1 = require("@/components/forms/SubmissionForm");
var utils_2 = require("@/lib/utils");
function assessmentVariant(type) {
    if (type === types_1.AssessmentType.FINAL)
        return 'primary';
    if (type === types_1.AssessmentType.MIDTERM)
        return 'warning';
    return 'info';
}
function isReleasedGrade(assessment) {
    var _a;
    var grade = (_a = assessment.grades) === null || _a === void 0 ? void 0 : _a[0];
    return Boolean(grade && (grade.status === types_1.GradeStatus.PUBLISHED || grade.status === types_1.GradeStatus.FINALIZED));
}
exports["default"] = react_1.memo(function AssessmentList(_a) {
    var _this = this;
    var _b, _c;
    var section = _a.section, role = _a.role;
    var _d = AuthContext_1.useAuth(), token = _d.token, user = _d.user;
    var dispatch = GlobalContext_1.useGlobal().dispatch;
    var router = navigation_1.useRouter();
    var _e = react_1.useState([]), assessments = _e[0], setAssessments = _e[1];
    var _f = react_1.useState(true), isLoading = _f[0], setIsLoading = _f[1];
    var _g = react_1.useState(false), isCreateModalOpen = _g[0], setIsCreateModalOpen = _g[1];
    var _h = react_1.useState(null), editingAssessment = _h[0], setEditingAssessment = _h[1];
    var _j = react_1.useState(null), deletingAssessment = _j[0], setDeletingAssessment = _j[1];
    var _k = react_1.useState(null), submittingAssessment = _k[0], setSubmittingAssessment = _k[1];
    var isAssigned = (_b = section.teachers) === null || _b === void 0 ? void 0 : _b.some(function (teacher) { var _a; return ((_a = teacher.user) === null || _a === void 0 ? void 0 : _a.id) === (user === null || user === void 0 ? void 0 : user.id); });
    var canCreate = (role === types_1.Role.TEACHER || role === types_1.Role.ORG_MANAGER) && isAssigned;
    var canView = role === types_1.Role.ORG_ADMIN || role === types_1.Role.ORG_MANAGER || role === types_1.Role.TEACHER;
    var fetchAssessments = react_1.useCallback(function () { return __awaiter(_this, void 0, void 0, function () {
        var data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token)
                        return [2 /*return*/];
                    setIsLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.api.org.getAssessments(token, { sectionId: section.id })];
                case 2:
                    data = _a.sent();
                    setAssessments(data);
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    console.error('Failed to fetch assessments:', error_1);
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to load assessments', type: 'error' } });
                    return [3 /*break*/, 5];
                case 4:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [token, section.id, dispatch]);
    react_1.useEffect(function () {
        fetchAssessments();
    }, [fetchAssessments]);
    var handleDelete = function () { return __awaiter(_this, void 0, void 0, function () {
        var target, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token || !deletingAssessment)
                        return [2 /*return*/];
                    target = deletingAssessment;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    dispatch({ type: 'UI_START_PROCESSING', payload: "assessment-delete-" + target.id });
                    return [4 /*yield*/, api_1.api.org.deleteAssessment(target.id, token)];
                case 2:
                    _a.sent();
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Assessment deleted successfully', type: 'success' } });
                    setAssessments(function (current) { return current.filter(function (assessment) { return assessment.id !== target.id; }); });
                    setDeletingAssessment(null);
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to delete assessment', type: 'error' } });
                    setDeletingAssessment(null);
                    console.error('Failed to delete assessment:', error_2);
                    return [3 /*break*/, 5];
                case 4:
                    dispatch({ type: 'UI_STOP_PROCESSING', payload: "assessment-delete-" + target.id });
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var openAssessment = function (assessment) {
        router.push("/sections/" + section.id + "/assessments/" + assessment.id);
    };
    var handleAssessmentKeyDown = function (event, assessment) {
        if (event.key !== 'Enter' && event.key !== ' ')
            return;
        event.preventDefault();
        openAssessment(assessment);
    };
    if (isLoading) {
        return (React.createElement("div", { className: "grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" }, __spreadArrays(Array(3)).map(function (_, index) { return (React.createElement("div", { key: index, className: "h-40 min-w-0 animate-pulse rounded-lg border border-border/70 bg-muted/35" })); })));
    }
    return (React.createElement("div", { className: "min-w-0 max-w-full space-y-4 overflow-hidden" },
        React.createElement("div", { className: "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" },
            React.createElement("div", { className: "min-w-0" },
                React.createElement("p", { className: "text-sm font-black text-foreground" },
                    assessments.length,
                    " assessments"),
                React.createElement("p", { className: "wrap-break-word text-xs font-semibold text-muted-foreground" }, "Sorted by the section workflow, opened in the grading detail page.")),
            canCreate && (React.createElement(Button_1.Button, { onClick: function () { return setIsCreateModalOpen(true); }, icon: lucide_react_1.Plus, className: "w-full sm:w-auto" }, "Add Assessment"))),
        canView && (React.createElement(StatusBanner_1.StatusBanner, { variant: "warning", title: "Transcript reminder", description: React.createElement(React.Fragment, null,
                "Only Finalized grades appear in transcripts. ",
                React.createElement(DocsLink_1.DocsLink, { href: "/docs/assessments-grading#grade-input-rules" }, "Read grading rules")), dismissible: true })),
        assessments.length === 0 ? (React.createElement("div", { className: "min-w-0 rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center sm:px-6" },
            React.createElement(lucide_react_1.FileText, { className: "mx-auto h-9 w-9 text-muted-foreground/45" }),
            React.createElement("p", { className: "mt-3 text-sm font-black text-foreground" }, "No assessments yet"),
            React.createElement("p", { className: "mt-1 text-xs font-semibold text-muted-foreground" }, "Create an assessment when this section is ready for grading."))) : (React.createElement("div", { className: "grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3" }, assessments.map(function (assessment) {
            var dueLabel = assessment.dueDate ? utils_2.formatDate(assessment.dueDate) : 'No due date';
            var dueDatePassed = Boolean(assessment.dueDate && new Date(assessment.dueDate) < new Date());
            var submissionsClosed = isReleasedGrade(assessment);
            return (React.createElement("article", { key: assessment.id, role: "button", tabIndex: 0, onClick: function () { return openAssessment(assessment); }, onKeyDown: function (event) { return handleAssessmentKeyDown(event, assessment); }, className: "group min-w-0 max-w-full cursor-pointer overflow-hidden rounded-lg border border-border/70 bg-card p-3 shadow-sm transition-colors hover:border-primary/35 hover:bg-background/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:p-4" },
                React.createElement("div", { className: "flex min-w-0 items-start justify-between gap-3" },
                    React.createElement(Badge_1.Badge, { variant: assessmentVariant(assessment.type), size: "sm" }, assessment.type),
                    canCreate && (React.createElement("div", { className: "flex shrink-0 flex-wrap items-center justify-end gap-1", onClick: function (event) { return event.stopPropagation(); } },
                        React.createElement("button", { type: "button", onClick: function () { return setEditingAssessment(assessment); }, className: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", "aria-label": "Edit " + assessment.title },
                            React.createElement(lucide_react_1.Edit, { className: "h-4 w-4" })),
                        React.createElement("button", { type: "button", onClick: function () { return setDeletingAssessment(assessment); }, className: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-danger/25 text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30", "aria-label": "Delete " + assessment.title },
                            React.createElement(lucide_react_1.Trash2, { className: "h-4 w-4" }))))),
                React.createElement("div", { className: "mt-4 min-w-0" },
                    React.createElement("h3", { className: "line-clamp-2 wrap-break-word text-base font-black leading-tight text-foreground group-hover:text-primary" }, assessment.title),
                    React.createElement("div", { className: "mt-3 grid min-w-0 grid-cols-1 gap-2 min-[520px]:grid-cols-3" },
                        React.createElement("div", { className: "min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-2" },
                            React.createElement("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted-foreground" }, "Marks"),
                            React.createElement("p", { className: "mt-1 text-sm font-black text-foreground" }, assessment.totalMarks)),
                        React.createElement("div", { className: "min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-2" },
                            React.createElement("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted-foreground" }, "Weight"),
                            React.createElement("p", { className: "mt-1 text-sm font-black text-foreground" },
                                assessment.weightage,
                                "%")),
                        React.createElement("div", { className: "min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-2" },
                            React.createElement("p", { className: "text-[10px] font-black uppercase tracking-widest text-muted-foreground" }, "Due"),
                            React.createElement("p", { className: "mt-1 truncate text-sm font-black text-foreground" }, dueLabel)))),
                React.createElement("div", { className: "mt-4 flex min-w-0 flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between" },
                    React.createElement("span", { className: "inline-flex min-w-0 flex-wrap items-center gap-2 text-xs font-black text-muted-foreground" },
                        React.createElement(lucide_react_1.Trophy, { className: "h-4 w-4 text-primary" }),
                        canView ? 'Open grading' : 'Open details',
                        React.createElement(lucide_react_1.ArrowRight, { className: "h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" })),
                    role === types_1.Role.STUDENT && (submissionsClosed ? (React.createElement(Badge_1.Badge, { variant: "success", size: "sm" }, "Graded")) :
                        assessment.allowSubmissions ? (React.createElement(Button_1.Button, { type: "button", variant: "primary", size: "sm", icon: lucide_react_1.Send, disabled: dueDatePassed, onClick: function (event) {
                                event.stopPropagation();
                                setSubmittingAssessment(assessment);
                            } }, "Submit")) : (React.createElement(Button_1.Button, { type: "button", variant: "secondary", size: "sm", icon: lucide_react_1.CheckCircle, loadingId: "assessment-submit-" + assessment.id, disabled: dueDatePassed, onClick: function (event) { return __awaiter(_this, void 0, void 0, function () {
                                var error_3;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            event.stopPropagation();
                                            _a.label = 1;
                                        case 1:
                                            _a.trys.push([1, 3, 4, 5]);
                                            dispatch({ type: 'UI_START_PROCESSING', payload: "assessment-submit-" + assessment.id });
                                            return [4 /*yield*/, api_1.api.org.createSubmission(assessment.id, { assessmentId: assessment.id }, token)];
                                        case 2:
                                            _a.sent();
                                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Marked as done', type: 'success' } });
                                            return [3 /*break*/, 5];
                                        case 3:
                                            error_3 = _a.sent();
                                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to mark as done', type: 'error' } });
                                            console.error('Failed to mark as done:', error_3);
                                            return [3 /*break*/, 5];
                                        case 4:
                                            dispatch({ type: 'UI_STOP_PROCESSING', payload: "assessment-submit-" + assessment.id });
                                            return [7 /*endfinally*/];
                                        case 5: return [2 /*return*/];
                                    }
                                });
                            }); } }, "Done"))))));
        }))),
        React.createElement(Modal_1.Modal, { isOpen: isCreateModalOpen, onClose: function () { return setIsCreateModalOpen(false); }, title: "New Assessment", subtitle: utils_1.formatCourseSectionLabel({ courseName: (_c = section.course) === null || _c === void 0 ? void 0 : _c.name, sectionName: section.name }), maxWidth: "max-w-3xl" },
            React.createElement(AssessmentForm_1["default"], { sectionId: section.id, courseId: section.courseId, onSuccess: function (assessment) {
                    setAssessments(function (current) { return __spreadArrays(current, [assessment]); });
                    setIsCreateModalOpen(false);
                }, onCancel: function () { return setIsCreateModalOpen(false); } })),
        React.createElement(Modal_1.Modal, { isOpen: !!editingAssessment, onClose: function () { return setEditingAssessment(null); }, title: "Edit Assessment", subtitle: editingAssessment ? "Updating: " + editingAssessment.title : '', maxWidth: "max-w-2xl" }, editingAssessment && (React.createElement(AssessmentForm_1["default"], { sectionId: section.id, courseId: section.courseId, assessmentId: editingAssessment.id, initialData: editingAssessment, onSuccess: function (assessment) {
                setAssessments(function (current) { return current.map(function (item) { return item.id === assessment.id ? assessment : item; }); });
                setEditingAssessment(null);
            }, onCancel: function () { return setEditingAssessment(null); } }))),
        React.createElement(Modal_1.Modal, { isOpen: !!submittingAssessment, onClose: function () { return setSubmittingAssessment(null); }, title: "Submit Work", subtitle: submittingAssessment ? submittingAssessment.title : '', maxWidth: "max-w-2xl" }, submittingAssessment && (React.createElement(SubmissionForm_1["default"], { assessmentId: submittingAssessment.id, onSuccess: function () { return setSubmittingAssessment(null); }, onCancel: function () { return setSubmittingAssessment(null); } }))),
        React.createElement(ConfirmDialog_1.ConfirmDialog, { isOpen: !!deletingAssessment, onClose: function () { return setDeletingAssessment(null); }, onConfirm: handleDelete, title: "Delete Assessment", description: "Are you sure you want to delete \"" + (deletingAssessment === null || deletingAssessment === void 0 ? void 0 : deletingAssessment.title) + "\"? This will also remove all associated grades and submissions.", confirmText: "Delete Assessment", isDestructive: true, loadingId: deletingAssessment ? "assessment-delete-" + deletingAssessment.id : undefined })));
});
