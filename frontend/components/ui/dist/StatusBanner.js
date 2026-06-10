'use client';
"use strict";
exports.__esModule = true;
exports.StatusBanner = void 0;
var react_1 = require("react");
var link_1 = require("next/link");
var lucide_react_1 = require("lucide-react");
var utils_1 = require("@/lib/utils");
var variantClasses = {
    info: {
        shell: 'border-info/30 bg-info/10 text-info',
        icon: 'bg-info/10 text-info',
        title: 'text-info',
        action: 'bg-info text-white hover:bg-info/90'
    },
    success: {
        shell: 'border-success/30 bg-success/10 text-success',
        icon: 'bg-success/10 text-success',
        title: 'text-success',
        action: 'bg-success text-white hover:bg-success/90'
    },
    warning: {
        shell: 'border-warning/35 bg-warning/10 text-warning',
        icon: 'bg-warning/10 text-warning',
        title: 'text-warning',
        action: 'bg-warning text-white hover:bg-warning/90'
    },
    danger: {
        shell: 'border-danger/30 bg-danger/10 text-danger',
        icon: 'bg-danger/10 text-danger',
        title: 'text-danger',
        action: 'bg-danger text-white hover:bg-danger/90'
    },
    neutral: {
        shell: 'border-border/70 bg-card text-foreground',
        icon: 'bg-muted text-muted-foreground',
        title: 'text-foreground',
        action: 'bg-foreground text-background hover:bg-foreground/85'
    }
};
var DEFAULT_ICONS = {
    info: lucide_react_1.Info,
    success: lucide_react_1.CheckCircle2,
    warning: lucide_react_1.AlertTriangle,
    danger: lucide_react_1.XCircle,
    neutral: lucide_react_1.Info
};
function StatusBanner(_a) {
    var title = _a.title, description = _a.description, _b = _a.variant, variant = _b === void 0 ? 'info' : _b, icon = _a.icon, action = _a.action, _c = _a.dismissible, dismissible = _c === void 0 ? false : _c, children = _a.children, className = _a.className;
    var tone = variantClasses[variant];
    var Icon = icon || DEFAULT_ICONS[variant];
    var _d = react_1["default"].useState(true), visible = _d[0], setVisible = _d[1];
    if (!visible)
        return null;
    return (react_1["default"].createElement("section", { className: utils_1.cn('relative rounded-lg border p-3 shadow-sm sm:p-4', tone.shell, className) },
        react_1["default"].createElement("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" },
            dismissible && (react_1["default"].createElement("div", { className: "absolute top-4 right-2" },
                react_1["default"].createElement("button", { type: "button", onClick: function () { return setVisible(false); }, className: "flex h-8 w-8 shrink-0 items-center justify-center cursor-pointer rounded-md text-current hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", "aria-label": "Dismiss" },
                    react_1["default"].createElement(lucide_react_1.X, { className: "h-5 w-5", "aria-hidden": "true" })))),
            react_1["default"].createElement("div", { className: "flex min-w-0 items-start gap-3" },
                react_1["default"].createElement("div", { className: utils_1.cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/10', tone.icon) },
                    react_1["default"].createElement(Icon, { className: "h-5 w-5", "aria-hidden": "true" })),
                react_1["default"].createElement("div", { className: "min-w-0" },
                    react_1["default"].createElement("h2", { className: utils_1.cn('text-sm font-black leading-5', tone.title) }, title),
                    description && (react_1["default"].createElement("div", { className: "mt-1 text-sm font-medium leading-5 text-current/80" }, description)))),
            action && (react_1["default"].createElement(link_1["default"], { href: action.href, className: utils_1.cn('inline-flex min-h-10 shrink-0 items-center justify-center rounded-md px-3 py-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30', tone.action) }, action.label))),
        children && react_1["default"].createElement("div", { className: "mt-3 text-current" }, children)));
}
exports.StatusBanner = StatusBanner;
