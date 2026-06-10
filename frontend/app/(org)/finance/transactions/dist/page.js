'use client';
"use strict";
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
var lucide_react_1 = require("lucide-react");
var api_1 = require("@/lib/api");
var AuthContext_1 = require("@/context/AuthContext");
var types_1 = require("@/types");
var DataTable_1 = require("@/components/ui/DataTable");
var ErrorState_1 = require("@/components/ui/ErrorState");
var PageShell_1 = require("@/components/ui/PageShell");
var StatusBanner_1 = require("@/components/ui/StatusBanner");
var FinancialAmount_1 = require("@/components/finance/FinancialAmount");
var Badge_1 = require("@/components/ui/Badge");
var usePersistentPageSize_1 = require("@/hooks/usePersistentPageSize");
var useUrlQueryState_1 = require("@/hooks/useUrlQueryState");
var CustomSelect_1 = require("@/components/ui/CustomSelect");
var Input_1 = require("@/components/ui/Input");
var BillingCycleBadge_1 = require("@/components/finance/BillingCycleBadge");
var FinanceFilterToolbar_1 = require("../../_components/FinanceFilterToolbar");
function labelize(value) {
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, function (char) { return char.toUpperCase(); });
}
function getTransactionTarget(transaction) {
    var _a, _b, _c, _d, _e, _f, _g;
    var entry = transaction.relatedEntry;
    if ((_a = entry === null || entry === void 0 ? void 0 : entry.student) === null || _a === void 0 ? void 0 : _a.user)
        return entry.student.user.name || entry.student.user.email;
    if ((_b = entry === null || entry === void 0 ? void 0 : entry.teacher) === null || _b === void 0 ? void 0 : _b.user)
        return entry.teacher.user.name || entry.teacher.user.email;
    if ((_d = (_c = entry === null || entry === void 0 ? void 0 : entry.assignment) === null || _c === void 0 ? void 0 : _c.student) === null || _d === void 0 ? void 0 : _d.user)
        return entry.assignment.student.user.name || entry.assignment.student.user.email;
    if ((_f = (_e = entry === null || entry === void 0 ? void 0 : entry.assignment) === null || _e === void 0 ? void 0 : _e.teacher) === null || _f === void 0 ? void 0 : _f.user)
        return entry.assignment.teacher.user.name || entry.assignment.teacher.user.email;
    if ((_g = entry === null || entry === void 0 ? void 0 : entry.assignment) === null || _g === void 0 ? void 0 : _g.entityName)
        return entry.assignment.entityName;
    return 'Ledger entity';
}
function TransactionsPage() {
    var token = AuthContext_1.useAuth().token;
    var _a = useUrlQueryState_1.useUrlQueryState(), getNumberParam = _a.getNumberParam, getStringParam = _a.getStringParam, updateQueryParams = _a.updateQueryParams;
    var page = getNumberParam('page', 1);
    var sortBy = getStringParam('sortBy', 'createdAt');
    var sortOrder = getStringParam('sortOrder', 'desc');
    var targetType = getStringParam('targetType', '');
    var category = getStringParam('category', '');
    var billingCycle = getStringParam('billingCycle', '');
    var type = getStringParam('type', '');
    var paymentMethod = getStringParam('paymentMethod', '');
    var search = getStringParam('search', '');
    var dateFrom = getStringParam('dateFrom', '');
    var dateTo = getStringParam('dateTo', '');
    var _b = usePersistentPageSize_1.usePersistentPageSize('edu-finance-transactions-limit', 10), pageSize = _b[0], setPageSize = _b[1];
    var _c = swr_1["default"](token ? ['finance/transactions', token, targetType, category, billingCycle, type, paymentMethod, search, dateFrom, dateTo] : null, function (_a) {
        var t = _a[1];
        return api_1.api.finance.getTransactions(t, {
            targetType: targetType || undefined,
            category: category || undefined,
            billingCycle: billingCycle || undefined,
            type: type || undefined,
            paymentMethod: paymentMethod || undefined,
            search: search || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined
        });
    }), transactions = _c.data, error = _c.error, isLoading = _c.isLoading, mutate = _c.mutate;
    var handlePageSizeChange = function (newSize) {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };
    var columns = react_1.useMemo(function () { return [
        {
            header: 'Date',
            sortable: true,
            sortKey: 'createdAt',
            accessor: function (transaction) { return (react_1["default"].createElement("div", { className: "font-semibold text-foreground/85" }, new Date(transaction.createdAt).toLocaleString())); }
        },
        {
            header: 'Description',
            accessor: function (transaction) { return (react_1["default"].createElement("div", { className: "flex min-w-0 items-center gap-3" },
                react_1["default"].createElement("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary" },
                    react_1["default"].createElement(lucide_react_1.FileText, { className: "h-5 w-5", "aria-hidden": "true" })),
                react_1["default"].createElement("div", { className: "min-w-0" },
                    react_1["default"].createElement("p", { className: "truncate text-sm font-black text-foreground" }, transaction.description || 'System generated'),
                    react_1["default"].createElement("p", { className: "mt-0.5 text-xs font-semibold text-muted-foreground" }, getTransactionTarget(transaction))))); }
        },
        {
            header: 'Target',
            accessor: function (transaction) {
                var _a;
                return (react_1["default"].createElement("div", { className: "min-w-0" },
                    react_1["default"].createElement("p", { className: "truncate text-sm font-bold text-foreground" }, getTransactionTarget(transaction)),
                    react_1["default"].createElement("p", { className: "mt-0.5 text-xs font-semibold text-muted-foreground" }, ((_a = transaction.relatedEntry) === null || _a === void 0 ? void 0 : _a.title) || 'Ledger entry')));
            }
        },
        {
            header: 'Category',
            sortable: true,
            sortKey: 'category',
            badge: true,
            accessor: function (transaction) { return react_1["default"].createElement(Badge_1.Badge, { variant: "neutral", size: "sm" }, transaction.category); }
        },
        {
            header: 'Cycle',
            badge: true,
            accessor: function (transaction) {
                var _a, _b;
                return ((_b = (_a = transaction.relatedEntry) === null || _a === void 0 ? void 0 : _a.structure) === null || _b === void 0 ? void 0 : _b.billingCycle) ? react_1["default"].createElement(BillingCycleBadge_1.BillingCycleBadge, { cycle: transaction.relatedEntry.structure.billingCycle })
                    : react_1["default"].createElement(Badge_1.Badge, { variant: "neutral", size: "sm" }, "Manual");
            }
        },
        {
            header: 'Type',
            sortable: true,
            sortKey: 'type',
            badge: true,
            accessor: function (transaction) { return (react_1["default"].createElement(Badge_1.Badge, { variant: transaction.type === types_1.TransactionType.INCOME ? 'success' : 'error', size: "sm", dot: true }, transaction.type === types_1.TransactionType.INCOME ? 'Income' : 'Expense')); }
        },
        {
            header: 'Amount',
            sortable: true,
            sortKey: 'amount',
            accessor: function (transaction) { return (react_1["default"].createElement(FinancialAmount_1.FinancialAmount, { amount: transaction.amount, currency: transaction.currency, className: transaction.type === types_1.TransactionType.INCOME ? 'text-success' : 'text-danger' })); }
        },
        {
            header: 'Method',
            accessor: function (transaction) { return (react_1["default"].createElement("span", { className: "text-xs font-semibold text-muted-foreground" },
                transaction.paymentMethod || 'System',
                transaction.createdBy ? " \u2022 " + (transaction.createdBy.name || transaction.createdBy.email) : '')); }
        },
    ]; }, []);
    var sortedData = react_1.useMemo(function () {
        if (!transactions)
            return [];
        var result = __spreadArrays(transactions);
        result.sort(function (a, b) {
            var valA = a[sortBy];
            var valB = b[sortBy];
            if (valA === undefined || valB === undefined || valA === null || valB === null)
                return 0;
            if (valA < valB)
                return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB)
                return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [sortBy, sortOrder, transactions]);
    var paginatedData = react_1.useMemo(function () {
        var start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [page, pageSize, sortedData]);
    var activeFilters = __spreadArrays((targetType ? [{ key: 'targetType', label: 'Target', value: labelize(targetType), onRemove: function () { return updateQueryParams({ targetType: undefined, page: 1 }); } }] : []), (category ? [{ key: 'category', label: 'Category', value: labelize(category), onRemove: function () { return updateQueryParams({ category: undefined, page: 1 }); } }] : []), (billingCycle ? [{ key: 'billingCycle', label: 'Cycle', value: labelize(billingCycle), onRemove: function () { return updateQueryParams({ billingCycle: undefined, page: 1 }); } }] : []), (type ? [{ key: 'type', label: 'Type', value: labelize(type), onRemove: function () { return updateQueryParams({ type: undefined, page: 1 }); } }] : []), (paymentMethod ? [{ key: 'paymentMethod', label: 'Method', value: paymentMethod, onRemove: function () { return updateQueryParams({ paymentMethod: undefined, page: 1 }); } }] : []), (search ? [{ key: 'search', label: 'Search', value: search, onRemove: function () { return updateQueryParams({ search: undefined, page: 1 }); } }] : []), (dateFrom ? [{ key: 'dateFrom', label: 'From', value: dateFrom, onRemove: function () { return updateQueryParams({ dateFrom: undefined, page: 1 }); } }] : []), (dateTo ? [{ key: 'dateTo', label: 'To', value: dateTo, onRemove: function () { return updateQueryParams({ dateTo: undefined, page: 1 }); } }] : []));
    var renderFilters = function (mode) { return (react_1["default"].createElement(FinanceFilterToolbar_1.FinanceFilterGrid, { mode: mode },
        react_1["default"].createElement(Input_1.Input, { icon: lucide_react_1.Search, value: search, onChange: function (event) { return updateQueryParams({ search: event.target.value || undefined, page: 1 }); }, placeholder: "Search transaction" }),
        react_1["default"].createElement(CustomSelect_1.CustomSelect, { value: type, onChange: function (value) { return updateQueryParams({ type: value || undefined, page: 1 }); }, options: __spreadArrays([{ value: '', label: 'All types' }], Object.values(types_1.TransactionType).map(function (value) { return ({ value: value, label: labelize(value) }); })) }),
        react_1["default"].createElement(CustomSelect_1.CustomSelect, { value: targetType, onChange: function (value) { return updateQueryParams({ targetType: value || undefined, page: 1 }); }, options: __spreadArrays([{ value: '', label: 'All targets' }], Object.values(types_1.FinanceTargetType).map(function (value) { return ({ value: value, label: labelize(value) }); })) }),
        react_1["default"].createElement(CustomSelect_1.CustomSelect, { value: category, onChange: function (value) { return updateQueryParams({ category: value || undefined, page: 1 }); }, options: __spreadArrays([{ value: '', label: 'All categories' }], Object.values(types_1.FinanceCategory).map(function (value) { return ({ value: value, label: labelize(value) }); })) }),
        react_1["default"].createElement(CustomSelect_1.CustomSelect, { value: billingCycle, onChange: function (value) { return updateQueryParams({ billingCycle: value || undefined, page: 1 }); }, options: __spreadArrays([{ value: '', label: 'All cycles' }], Object.values(types_1.BillingCycle).map(function (value) { return ({ value: value, label: labelize(value) }); })) }),
        react_1["default"].createElement(Input_1.Input, { value: paymentMethod, onChange: function (event) { return updateQueryParams({ paymentMethod: event.target.value || undefined, page: 1 }); }, placeholder: "Payment method" }),
        react_1["default"].createElement("div", { className: "space-y-1" },
            react_1["default"].createElement("span", { className: "block text-xs font-black uppercase text-muted-foreground" }, "Start date"),
            react_1["default"].createElement(Input_1.Input, { type: "date", value: dateFrom, onChange: function (event) { return updateQueryParams({ dateFrom: event.target.value || undefined, page: 1 }); } })),
        react_1["default"].createElement("div", { className: "space-y-1" },
            react_1["default"].createElement("span", { className: "block text-xs font-black uppercase text-muted-foreground" }, "End date"),
            react_1["default"].createElement(Input_1.Input, { type: "date", value: dateTo, onChange: function (event) { return updateQueryParams({ dateTo: event.target.value || undefined, page: 1 }); } })))); };
    if (error) {
        return (react_1["default"].createElement(ErrorState_1.ErrorState, { error: error, onRetry: function () { return mutate(); }, title: "Transactions could not load", description: "The append-only ledger is unavailable right now." }));
    }
    return (react_1["default"].createElement("div", { className: "flex min-h-0 flex-1 flex-col gap-3" },
        react_1["default"].createElement(StatusBanner_1.StatusBanner, { title: "Append-only audit trail", description: "Confirmed records in this table cannot be edited or deleted.", variant: "info", icon: lucide_react_1.LockKeyhole, dismissible: true }),
        react_1["default"].createElement(PageShell_1.ResourcePanel, null,
            react_1["default"].createElement(FinanceFilterToolbar_1.FinanceFilterToolbar, { drawerLabel: "Transaction filters", renderFilters: renderFilters, activeFilters: activeFilters }),
            react_1["default"].createElement("div", { className: "relative min-h-0 flex-1 overflow-x-hidden" },
                react_1["default"].createElement(DataTable_1.DataTable, { data: paginatedData, columns: columns, keyExtractor: function (transaction) { return transaction.id; }, isLoading: isLoading, showSerialNumber: true, currentPage: page, totalPages: Math.ceil(((transactions === null || transactions === void 0 ? void 0 : transactions.length) || 0) / pageSize) || 1, totalResults: (transactions === null || transactions === void 0 ? void 0 : transactions.length) || 0, pageSize: pageSize, onPageChange: function (nextPage) { return updateQueryParams({ page: nextPage }); }, onPageSizeChange: handlePageSizeChange, sortConfig: { key: sortBy, direction: sortOrder }, onSort: function (key, direction) { return updateQueryParams({ sortBy: key, sortOrder: direction }); }, maxHeight: "100%", emptyTitle: "No transactions recorded", emptyDescription: "Confirmed payments and expenses will appear in this immutable ledger.", mobileDetailLimit: 3 })))));
}
exports["default"] = TransactionsPage;
