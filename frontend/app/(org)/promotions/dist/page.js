'use client';
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var swr_1 = require("swr");
var types_1 = require("@/types");
var api_1 = require("@/lib/api");
var AuthContext_1 = require("@/context/AuthContext");
var GlobalContext_1 = require("@/context/GlobalContext");
var Badge_1 = require("@/components/ui/Badge");
var Button_1 = require("@/components/ui/Button");
var ConfirmDialog_1 = require("@/components/ui/ConfirmDialog");
var CustomSelect_1 = require("@/components/ui/CustomSelect");
var DocsLink_1 = require("@/components/ui/DocsLink");
var ErrorState_1 = require("@/components/ui/ErrorState");
var Loading_1 = require("@/components/ui/Loading");
var PageShell_1 = require("@/components/ui/PageShell");
var StatusBanner_1 = require("@/components/ui/StatusBanner");
var Toggle_1 = require("@/components/ui/Toggle");
var lucide_react_1 = require("lucide-react");
function PromotionsPage() {
    var _a = AuthContext_1.useAuth(), token = _a.token, user = _a.user;
    var dispatch = GlobalContext_1.useGlobal().dispatch;
    var _b = react_1.useState('copy-forward'), activeTab = _b[0], setActiveTab = _b[1];
    var cyclesKey = token ? ['academicCycles', { limit: 100 }] : null;
    var _c = swr_1["default"](cyclesKey), cyclesData = _c.data, isLoading = _c.isLoading, error = _c.error, mutate = _c.mutate;
    var cohortsKey = token ? ['cohorts', { limit: 500 }] : null;
    var cohortsData = swr_1["default"](cohortsKey).data;
    if (!token)
        return React.createElement(Loading_1.Loading, { className: "h-full", text: "Authenticating..." });
    if (isLoading && !cyclesData)
        return React.createElement(Loading_1.Loading, { className: "h-full", text: "Loading academic transitions..." });
    if (error)
        return React.createElement(ErrorState_1.ErrorState, { error: error, onRetry: function () { return mutate(); } });
    if ((user === null || user === void 0 ? void 0 : user.role) !== types_1.Role.ORG_ADMIN && (user === null || user === void 0 ? void 0 : user.role) !== types_1.Role.ORG_MANAGER) {
        return (React.createElement("div", { className: "flex h-full items-center justify-center" },
            React.createElement(StatusBanner_1.StatusBanner, { title: "Access restricted", description: "Only organization admins and managers can run academic transitions.", variant: "warning" })));
    }
    var cycles = (cyclesData === null || cyclesData === void 0 ? void 0 : cyclesData.data) || [];
    var cohorts = (cohortsData === null || cohortsData === void 0 ? void 0 : cohortsData.data) || [];
    return (React.createElement(PageShell_1.PageShell, null,
        React.createElement(PageShell_1.PageHeader, { title: "Academic Transitions", description: React.createElement(React.Fragment, null,
                "Copy setup or promote cohorts after review. ",
                React.createElement(DocsLink_1.DocsLink, { href: "/docs/cohorts-promotions#promotions" }, "Read transition docs")), icon: lucide_react_1.ArrowRight, meta: React.createElement(Badge_1.Badge, { variant: "neutral", size: "sm" },
                cycles.length,
                " cycles"), breadcrumbs: [
                { label: 'Organization' },
                { label: 'Academics' },
                { label: 'Promotions' },
            ] }),
        React.createElement(PageShell_1.ResourcePanel, null,
            React.createElement("div", { className: "shrink-0 border-b border-border/60 rounded-t-lg bg-card/80" },
                React.createElement("div", { className: "flex gap-1 overflow-x-auto rounded-t-lg border border-border/70 bg-muted/45 p-1 scrollbar-none" },
                    React.createElement("button", { type: "button", className: "flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-black transition-colors " + (activeTab === 'copy-forward' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'), onClick: function () { return setActiveTab('copy-forward'); }, "aria-pressed": activeTab === 'copy-forward' },
                        React.createElement(lucide_react_1.Copy, { className: "h-4 w-4" }),
                        "Copy Forward"),
                    React.createElement("button", { type: "button", className: "flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-black transition-colors " + (activeTab === 'promote' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'), onClick: function () { return setActiveTab('promote'); }, "aria-pressed": activeTab === 'promote' },
                        React.createElement(lucide_react_1.Users, { className: "h-4 w-4" }),
                        "Cohort Promotion"))),
            React.createElement("div", { className: "min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar" }, activeTab === 'copy-forward' ? (React.createElement(CopyForwardView, { cycles: cycles, token: token, dispatch: dispatch })) : (React.createElement(PromotionView, { cycles: cycles, cohorts: cohorts, token: token, dispatch: dispatch }))))));
}
exports["default"] = PromotionsPage;
function StepBlock(_a) {
    var step = _a.step, title = _a.title, description = _a.description, children = _a.children;
    return (React.createElement("section", { className: "rounded-lg border border-border/70 bg-card p-4 shadow-sm" },
        React.createElement("div", { className: "mb-4 flex items-start gap-3" },
            React.createElement("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-black text-primary-foreground" }, step),
            React.createElement("div", { className: "min-w-0" },
                React.createElement("h2", { className: "text-base font-black text-foreground" }, title),
                React.createElement("p", { className: "mt-1 text-sm font-medium text-muted-foreground" }, description))),
        children));
}
function getApiErrorMessage(err, fallback) {
    var _a, _b;
    var apiError = err;
    var rawMessage = ((_b = (_a = apiError === null || apiError === void 0 ? void 0 : apiError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || (apiError === null || apiError === void 0 ? void 0 : apiError.message) || fallback;
    return Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
}
function formatCount(count, singular, plural) {
    if (plural === void 0) { plural = singular + "s"; }
    return count + " " + (count === 1 ? singular : plural);
}
function CopyForwardView(_a) {
    var _this = this;
    var cycles = _a.cycles, token = _a.token, dispatch = _a.dispatch;
    var _b = react_1.useState(''), fromCycleId = _b[0], setFromCycleId = _b[1];
    var _c = react_1.useState(''), toCycleId = _c[0], setToCycleId = _c[1];
    var _d = react_1.useState({ copySchedules: true, copyAssessments: false, copyMaterials: false }), options = _d[0], setOptions = _d[1];
    var _e = react_1.useState(false), isExecuting = _e[0], setIsExecuting = _e[1];
    var _f = react_1.useState(false), isPreviewLoading = _f[0], setIsPreviewLoading = _f[1];
    var _g = react_1.useState(null), copyPreview = _g[0], setCopyPreview = _g[1];
    var _h = react_1.useState(false), isConfirmOpen = _h[0], setIsConfirmOpen = _h[1];
    var fromCycle = cycles.find(function (cycle) { return cycle.id === fromCycleId; });
    var toCycle = cycles.find(function (cycle) { return cycle.id === toCycleId; });
    var copyForwardPayload = react_1.useMemo(function () { return ({
        fromCycleId: fromCycleId,
        toCycleId: toCycleId,
        copySchedules: options.copySchedules,
        copyAssessments: options.copyAssessments,
        copyMaterials: options.copyMaterials
    }); }, [fromCycleId, options.copyAssessments, options.copyMaterials, options.copySchedules, toCycleId]);
    var previewItems = copyPreview ? __spreadArrays([
        formatCount(copyPreview.sections, 'section')
    ], (options.copySchedules ? [formatCount(copyPreview.schedules, 'schedule')] : []), (options.copyAssessments ? [formatCount(copyPreview.assessments, 'assessment')] : []), (options.copyMaterials ? [formatCount(copyPreview.materials, 'material')] : [])) : [];
    var previewTotal = copyPreview
        ? copyPreview.sections
            + (options.copySchedules ? copyPreview.schedules : 0)
            + (options.copyAssessments ? copyPreview.assessments : 0)
            + (options.copyMaterials ? copyPreview.materials : 0)
        : 0;
    var openCopyForwardConfirm = function () { return __awaiter(_this, void 0, void 0, function () {
        var preview, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!fromCycleId || !toCycleId) {
                        dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select both source and target cycles.', type: 'error' } });
                        return [2 /*return*/];
                    }
                    if (fromCycleId === toCycleId) {
                        dispatch({ type: 'TOAST_ADD', payload: { message: 'Source and target cycles must be different.', type: 'error' } });
                        return [2 /*return*/];
                    }
                    setIsPreviewLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.api.copyForward.preview(copyForwardPayload, token)];
                case 2:
                    preview = _a.sent();
                    setCopyPreview(preview);
                    setIsConfirmOpen(true);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(err_1, 'Could not prepare copy preview'), type: 'error' } });
                    return [3 /*break*/, 5];
                case 4:
                    setIsPreviewLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var executeCopyForward = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsExecuting(true);
                    dispatch({ type: 'UI_START_PROCESSING', payload: 'copy-forward' });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.api.copyForward.execute(copyForwardPayload, token)];
                case 2:
                    res = _a.sent();
                    dispatch({
                        type: 'TOAST_ADD',
                        payload: {
                            message: "Copy forward successful. Copied " + formatCount(res.sectionsCopied, 'section') + ", " + formatCount(res.schedulesCopied, 'schedule') + ", " + formatCount(res.assessmentsCopied, 'assessment') + ", and " + formatCount(res.materialsCopied, 'material') + ".",
                            type: 'success'
                        }
                    });
                    setFromCycleId('');
                    setToCycleId('');
                    setCopyPreview(null);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _a.sent();
                    dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(err_2, 'Error processing request'), type: 'error' } });
                    return [3 /*break*/, 5];
                case 4:
                    setIsExecuting(false);
                    dispatch({ type: 'UI_STOP_PROCESSING', payload: 'copy-forward' });
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (React.createElement("div", { className: "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" },
        React.createElement("div", { className: "relative space-y-4" },
            React.createElement(StatusBanner_1.StatusBanner, { title: "Review before copying", description: React.createElement(React.Fragment, null,
                    "Copy-forward creates new records in the target cycle. ",
                    React.createElement(DocsLink_1.DocsLink, { href: "/docs/cohorts-promotions#copy-forward" }, "Read copy-forward docs")), variant: "warning", dismissible: true, icon: lucide_react_1.GitBranch }),
            React.createElement(StepBlock, { step: 1, title: "Choose source and target cycles", description: "Copy from the completed or current cycle into the new cycle." },
                React.createElement("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2" },
                    React.createElement("div", { className: "space-y-2" },
                        React.createElement("label", { className: "text-sm font-semibold" }, "Source Cycle"),
                        React.createElement(CustomSelect_1.CustomSelect, { options: cycles.map(function (cycle) { return ({ value: cycle.id, label: cycle.name }); }), value: fromCycleId, onChange: setFromCycleId, placeholder: "Select Source Cycle" })),
                    React.createElement("div", { className: "space-y-2" },
                        React.createElement("label", { className: "text-sm font-semibold" }, "Target Cycle"),
                        React.createElement(CustomSelect_1.CustomSelect, { options: cycles.map(function (cycle) { return ({ value: cycle.id, label: cycle.name }); }), value: toCycleId, onChange: setToCycleId, placeholder: "Select Target Cycle" })))),
            React.createElement(StepBlock, { step: 2, title: "Select what travels forward", description: "Sections are always copied; optional records can follow if useful." },
                React.createElement("div", { className: "grid gap-3" },
                    React.createElement("div", { className: "flex items-center justify-between rounded-md border border-border/70 bg-background/55 p-3" },
                        React.createElement("span", { className: "text-sm font-bold" }, "Sections"),
                        React.createElement(Badge_1.Badge, { variant: "success", size: "sm", icon: lucide_react_1.CheckCircle2 }, "Always copied")),
                    React.createElement(ToggleRow, { label: "Timetables and schedules", checked: options.copySchedules, onChange: function (value) { return setOptions(__assign(__assign({}, options), { copySchedules: value })); } }),
                    React.createElement(ToggleRow, { label: "Course materials and links", checked: options.copyMaterials, onChange: function (value) { return setOptions(__assign(__assign({}, options), { copyMaterials: value })); } }),
                    React.createElement(ToggleRow, { label: "Assessments", checked: options.copyAssessments, onChange: function (value) { return setOptions(__assign(__assign({}, options), { copyAssessments: value })); } }))),
            React.createElement("div", { className: "flex justify-end" },
                React.createElement(Button_1.Button, { onClick: openCopyForwardConfirm, disabled: isExecuting || isPreviewLoading, isLoading: isPreviewLoading, icon: lucide_react_1.Copy }, "Review Copy Forward"))),
        React.createElement(SummaryPanel, { title: "Copy Summary", items: [
                ['Source', (fromCycle === null || fromCycle === void 0 ? void 0 : fromCycle.name) || 'Not selected'],
                ['Target', (toCycle === null || toCycle === void 0 ? void 0 : toCycle.name) || 'Not selected'],
                ['Schedules', options.copySchedules ? 'Included' : 'Skipped'],
                ['Materials', options.copyMaterials ? 'Included' : 'Skipped'],
                ['Assessments', options.copyAssessments ? 'Included' : 'Skipped'],
            ] }),
        React.createElement(ConfirmDialog_1.ConfirmDialog, { isOpen: isConfirmOpen, onClose: function () { return setIsConfirmOpen(false); }, onConfirm: executeCopyForward, title: "Confirm copy forward", description: "Copy selected setup from " + ((fromCycle === null || fromCycle === void 0 ? void 0 : fromCycle.name) || 'the source cycle') + " into " + ((toCycle === null || toCycle === void 0 ? void 0 : toCycle.name) || 'the target cycle') + ". This creates new records and cannot be reversed automatically.", confirmText: "Confirm Copy", loadingId: "copy-forward" },
            React.createElement("div", { className: "rounded-md border border-border/70 bg-background/70 p-3" },
                React.createElement("p", { className: "text-xs font-black uppercase tracking-wide text-muted-foreground" }, "Selected for copy"),
                React.createElement("p", { className: "mt-2 text-sm font-bold leading-6 text-foreground" }, previewItems.length > 0 ? "" + previewItems.slice(0, -1).join(', ') + (previewItems.length > 1 ? ', and ' : '') + previewItems.at(-1) + " " + (previewTotal === 1 ? 'is' : 'are') + " selected for copy forward." : 'No preview is available.')))));
}
function PromotionView(_a) {
    var _this = this;
    var _b, _c, _d, _e;
    var cycles = _a.cycles, cohorts = _a.cohorts, token = _a.token, dispatch = _a.dispatch;
    var _f = react_1.useState(''), originCohortId = _f[0], setOriginCohortId = _f[1];
    var _g = react_1.useState(''), targetCycleId = _g[0], setTargetCycleId = _g[1];
    var _h = react_1.useState(''), targetCohortId = _h[0], setTargetCohortId = _h[1];
    var _j = react_1.useState(false), isExecuting = _j[0], setIsExecuting = _j[1];
    var originCohort = cohorts.find(function (cohort) { return cohort.id === originCohortId; });
    var _k = swr_1["default"](originCohortId ? ['cohort', originCohortId] : null), originCohortDetail = _k.data, isOriginCohortLoading = _k.isLoading, originCohortError = _k.error;
    var targetCycle = cycles.find(function (cycle) { return cycle.id === targetCycleId; });
    var targetCohorts = react_1.useMemo(function () { return (cohorts.filter(function (cohort) { return cohort.academicCycleId === targetCycleId; })); }, [cohorts, targetCycleId]);
    var targetCohort = cohorts.find(function (cohort) { return cohort.id === targetCohortId; });
    var originStudents = (originCohortDetail === null || originCohortDetail === void 0 ? void 0 : originCohortDetail.students) || [];
    var listedStudentCount = (_e = (_c = (_b = originCohort === null || originCohort === void 0 ? void 0 : originCohort._count) === null || _b === void 0 ? void 0 : _b.students) !== null && _c !== void 0 ? _c : (_d = originCohort === null || originCohort === void 0 ? void 0 : originCohort.students) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0;
    var studentCount = originCohortDetail ? originStudents.length : listedStudentCount;
    var studentCountLabel = originCohortId && isOriginCohortLoading ? listedStudentCount + " listed, loading roster..." : "" + studentCount;
    var handlePromote = function () { return __awaiter(_this, void 0, void 0, function () {
        var studentIds, res, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!originCohortId || !targetCycleId || !targetCohortId) {
                        dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select origin cohort, target cycle, and target cohort.', type: 'error' } });
                        return [2 /*return*/];
                    }
                    if (originCohortError) {
                        dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(originCohortError, 'Could not load the cohort roster.'), type: 'error' } });
                        return [2 /*return*/];
                    }
                    if (!originCohortDetail || isOriginCohortLoading) {
                        dispatch({ type: 'TOAST_ADD', payload: { message: 'Still loading the cohort roster. Please try again in a moment.', type: 'error' } });
                        return [2 /*return*/];
                    }
                    if (originStudents.length === 0) {
                        dispatch({ type: 'TOAST_ADD', payload: { message: 'Origin cohort has no students to promote.', type: 'error' } });
                        return [2 /*return*/];
                    }
                    setIsExecuting(true);
                    dispatch({ type: 'UI_START_PROCESSING', payload: 'promote' });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    studentIds = originStudents.map(function (student) { return student.id; });
                    return [4 /*yield*/, api_1.api.promotions.promoteStudents({
                            studentIds: studentIds,
                            fromCycleId: originCohortDetail.academicCycleId,
                            toCycleId: targetCycleId,
                            toCohortId: targetCohortId
                        }, token)];
                case 2:
                    res = _a.sent();
                    dispatch({ type: 'TOAST_ADD', payload: { message: res.message, type: 'success' } });
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _a.sent();
                    dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(err_3, 'Error processing request'), type: 'error' } });
                    return [3 /*break*/, 5];
                case 4:
                    setIsExecuting(false);
                    dispatch({ type: 'UI_STOP_PROCESSING', payload: 'promote' });
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (React.createElement("div", { className: "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" },
        React.createElement("div", { className: "relative space-y-4" },
            React.createElement(StatusBanner_1.StatusBanner, { title: "Review before promoting", description: React.createElement(React.Fragment, null,
                    "Promotion changes student placement. ",
                    React.createElement(DocsLink_1.DocsLink, { href: "/docs/cohorts-promotions#promotions" }, "Read promotion docs")), variant: "warning", dismissible: true, icon: lucide_react_1.Users }),
            React.createElement(StepBlock, { step: 1, title: "Select the origin cohort", description: "This is the cohort whose students will be promoted." },
                React.createElement("div", { className: "space-y-3" },
                    React.createElement(CustomSelect_1.CustomSelect, { options: cohorts.map(function (cohort) { var _a; return ({ value: cohort.id, label: cohort.name + " (" + (((_a = cohort.academicCycle) === null || _a === void 0 ? void 0 : _a.name) || 'No Cycle') + ")" }); }), value: originCohortId, onChange: setOriginCohortId, placeholder: "Select Cohort to Promote" }),
                    originCohortId && (React.createElement("div", { className: "flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background/55 p-3" },
                        React.createElement(Badge_1.Badge, { variant: originCohortError ? 'error' : 'neutral', size: "sm", className: "whitespace-normal text-left leading-tight" }, originCohortError ? 'Roster unavailable' : studentCountLabel),
                        React.createElement("span", { className: "text-xs font-semibold text-muted-foreground" }, isOriginCohortLoading ? 'Fetching student IDs for promotion.' : 'Students in selected origin cohort.'))))),
            React.createElement(StepBlock, { step: 2, title: "Choose the destination", description: "Pick the target cycle first, then the cohort inside that cycle." },
                React.createElement("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2" },
                    React.createElement("div", { className: "space-y-2" },
                        React.createElement("label", { className: "text-sm font-semibold" }, "Target Cycle"),
                        React.createElement(CustomSelect_1.CustomSelect, { options: cycles.map(function (cycle) { return ({ value: cycle.id, label: cycle.name }); }), value: targetCycleId, onChange: function (value) {
                                setTargetCycleId(value);
                                setTargetCohortId('');
                            }, placeholder: "Select Target Cycle" })),
                    React.createElement("div", { className: "space-y-2" },
                        React.createElement("label", { className: "text-sm font-semibold" }, "Target Cohort"),
                        React.createElement(CustomSelect_1.CustomSelect, { options: targetCohorts.map(function (cohort) { return ({ value: cohort.id, label: cohort.name }); }), value: targetCohortId, onChange: setTargetCohortId, placeholder: targetCycleId ? 'Select Target Cohort' : 'Select cycle first', disabled: !targetCycleId })))),
            React.createElement("div", { className: "flex justify-end" },
                React.createElement(Button_1.Button, { onClick: handlePromote, disabled: isExecuting || isOriginCohortLoading, isLoading: isExecuting, icon: lucide_react_1.Users }, "Promote Cohort"))),
        React.createElement(SummaryPanel, { title: "Promotion Summary", items: [
                ['Origin', (originCohort === null || originCohort === void 0 ? void 0 : originCohort.name) || 'Not selected'],
                ['Students', studentCountLabel],
                ['Target cycle', (targetCycle === null || targetCycle === void 0 ? void 0 : targetCycle.name) || 'Not selected'],
                ['Target cohort', (targetCohort === null || targetCohort === void 0 ? void 0 : targetCohort.name) || 'Not selected'],
            ] })));
}
function ToggleRow(_a) {
    var label = _a.label, checked = _a.checked, onChange = _a.onChange;
    return (React.createElement("div", { className: "flex items-center justify-between rounded-md border border-border/70 bg-background/55 p-3" },
        React.createElement("span", { className: "text-sm font-bold" }, label),
        React.createElement(Toggle_1.Toggle, { checked: checked, onCheckedChange: onChange })));
}
function SummaryPanel(_a) {
    var title = _a.title, items = _a.items;
    return (React.createElement("aside", { className: "h-fit rounded-lg border border-border/70 bg-card p-4 shadow-sm" },
        React.createElement("h2", { className: "text-sm font-black uppercase tracking-wide text-muted-foreground" }, title),
        React.createElement("div", { className: "mt-4 space-y-3" }, items.map(function (_a) {
            var label = _a[0], value = _a[1];
            return (React.createElement("div", { key: label, className: "rounded-md border border-border/60 bg-background/55 p-3" },
                React.createElement("p", { className: "text-[10px] font-black uppercase tracking-wide text-muted-foreground" }, label),
                React.createElement("p", { className: "mt-1 text-sm font-bold text-foreground" }, value)));
        }))));
}
