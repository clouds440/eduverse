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
exports.DocsNavigation = void 0;
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
var react_dom_1 = require("react-dom");
var utils_1 = require("@/lib/utils");
var docs_1 = require("../_data/docs");
var DocsSearch_1 = require("./DocsSearch");
function DocsNavigation() {
    var pathname = navigation_1.usePathname() || '/docs';
    var activeSlug = pathname.split('/').filter(Boolean)[1];
    var activePage = activeSlug ? docs_1.getDocPage(activeSlug) : undefined;
    var _a = react_1.useState(''), activeSectionId = _a[0], setActiveSectionId = _a[1];
    var _b = react_1.useState(false), isMobileSearchOpen = _b[0], setIsMobileSearchOpen = _b[1];
    var _c = react_1.useState(false), isMobileContentsOpen = _c[0], setIsMobileContentsOpen = _c[1];
    var _d = react_1.useState(true), isMobileHeaderVisible = _d[0], setIsMobileHeaderVisible = _d[1];
    var _e = react_1.useState(false), isMounted = _e[0], setIsMounted = _e[1];
    var lastScrollTopRef = react_1.useRef(0);
    var desktopNavRef = react_1.useRef(null);
    var mobileContentsRef = react_1.useRef(null);
    var activeSections = react_1.useMemo(function () { return (activePage ? docs_1.flattenDocSections(activePage) : []); }, [activePage]);
    react_1.useEffect(function () {
        if (!activeSections.length) {
            setActiveSectionId('');
            return;
        }
        var setFromHash = function () {
            var _a;
            var hashId = window.location.hash.replace('#', '');
            setActiveSectionId(hashId || ((_a = activeSections[0]) === null || _a === void 0 ? void 0 : _a.section.id) || '');
        };
        setFromHash();
        window.addEventListener('hashchange', setFromHash);
        var observers = [];
        var visibleSections = new Map();
        var observer = new IntersectionObserver(function (entries) {
            var _a;
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    visibleSections.set(entry.target.id, entry.intersectionRatio);
                }
                else {
                    visibleSections["delete"](entry.target.id);
                }
            });
            var nextActive = (_a = __spreadArrays(visibleSections.entries()).sort(function (a, b) { return b[1] - a[1]; })[0]) === null || _a === void 0 ? void 0 : _a[0];
            if (nextActive)
                setActiveSectionId(nextActive);
        }, { rootMargin: '-96px 0px -55% 0px', threshold: [0.1, 0.25, 0.5, 0.75] });
        activeSections.forEach(function (_a) {
            var section = _a.section;
            var element = document.getElementById(section.id);
            if (element)
                observer.observe(element);
        });
        observers.push(observer);
        return function () {
            window.removeEventListener('hashchange', setFromHash);
            observers.forEach(function (item) { return item.disconnect(); });
        };
    }, [activeSections]);
    react_1.useEffect(function () {
        setIsMobileContentsOpen(false);
        setIsMobileSearchOpen(false);
    }, [pathname]);
    react_1.useEffect(function () {
        setIsMounted(true);
    }, []);
    react_1.useEffect(function () {
        var scrollActiveLinkIntoView = function (container) {
            var activeLink = container === null || container === void 0 ? void 0 : container.querySelector('[data-docs-active="true"]');
            if (!container || !activeLink)
                return;
            var containerRect = container.getBoundingClientRect();
            var activeRect = activeLink.getBoundingClientRect();
            var isSectionLink = activeLink.dataset.docsActiveLevel === 'section';
            var topPadding = isSectionLink ? 56 : 16;
            container.scrollTo({
                top: container.scrollTop + activeRect.top - containerRect.top - topPadding,
                behavior: 'smooth'
            });
        };
        var frame = window.requestAnimationFrame(function () {
            scrollActiveLinkIntoView(desktopNavRef.current);
            if (isMobileContentsOpen)
                scrollActiveLinkIntoView(mobileContentsRef.current);
        });
        return function () { return window.cancelAnimationFrame(frame); };
    }, [activeSlug, activeSectionId, isMobileContentsOpen]);
    react_1.useEffect(function () {
        var appShell = document.querySelector('.app-shell-main');
        var getScrollTop = function () {
            if (appShell && appShell.scrollHeight > appShell.clientHeight) {
                return appShell.scrollTop;
            }
            return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        };
        var handleScroll = function () {
            if (isMobileContentsOpen || isMobileSearchOpen) {
                setIsMobileHeaderVisible(true);
                lastScrollTopRef.current = getScrollTop();
                return;
            }
            var nextScrollTop = getScrollTop();
            var delta = nextScrollTop - lastScrollTopRef.current;
            if (nextScrollTop < 12) {
                setIsMobileHeaderVisible(true);
            }
            else if (delta > 4) {
                setIsMobileHeaderVisible(false);
            }
            else if (delta < -1) {
                setIsMobileHeaderVisible(true);
            }
            lastScrollTopRef.current = nextScrollTop;
        };
        lastScrollTopRef.current = getScrollTop();
        appShell === null || appShell === void 0 ? void 0 : appShell.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });
        return function () {
            appShell === null || appShell === void 0 ? void 0 : appShell.removeEventListener('scroll', handleScroll);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isMobileContentsOpen, isMobileSearchOpen]);
    var mobileHeader = (React.createElement("div", { className: utils_1.cn('fixed left-0 right-0 top-(--app-nav-height) z-90 w-full border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-md transition-transform duration-200 lg:hidden', isMobileHeaderVisible ? 'translate-y-0' : '-translate-y-full') },
        React.createElement("div", { className: "flex min-h-10 items-center gap-2" }, isMobileSearchOpen ? (React.createElement(React.Fragment, null,
            React.createElement(DocsSearch_1.DocsSearch, { compact: true, autoFocus: true, resultsMode: "popover", className: "min-w-0 flex-1", onNavigate: function () {
                    setIsMobileSearchOpen(false);
                    setIsMobileContentsOpen(false);
                } }),
            React.createElement("button", { type: "button", onClick: function () { return setIsMobileSearchOpen(false); }, className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-primary", "aria-label": "Close docs search" },
                React.createElement(lucide_react_1.X, { className: "h-4 w-4", "aria-hidden": "true" })))) : (React.createElement(React.Fragment, null,
            React.createElement(link_1["default"], { href: "/docs", className: "flex min-w-0 flex-1 items-center gap-2 text-sm font-black text-foreground" },
                React.createElement(lucide_react_1.BookOpen, { className: "h-4 w-4 shrink-0 text-primary", "aria-hidden": "true" }),
                React.createElement("span", { className: "shrink-0" }, "Docs"),
                activePage && (React.createElement("span", { className: "min-w-0 truncate text-xs font-bold text-muted-foreground" },
                    "/ ",
                    activePage.title))),
            React.createElement("button", { type: "button", onClick: function () {
                    setIsMobileSearchOpen(true);
                    setIsMobileContentsOpen(false);
                }, className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-primary", "aria-label": "Search docs" },
                React.createElement(lucide_react_1.Search, { className: "h-4 w-4", "aria-hidden": "true" })),
            React.createElement("button", { type: "button", onClick: function () { return setIsMobileContentsOpen(function (value) { return !value; }); }, className: utils_1.cn('flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-black transition-colors', isMobileContentsOpen
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-primary'), "aria-expanded": isMobileContentsOpen, "aria-controls": "mobile-docs-contents" },
                "Contents",
                React.createElement(lucide_react_1.ChevronDown, { className: utils_1.cn('h-3.5 w-3.5 transition-transform', isMobileContentsOpen && 'rotate-180'), "aria-hidden": "true" }))))),
        isMobileContentsOpen && !isMobileSearchOpen && (React.createElement("div", { ref: mobileContentsRef, id: "mobile-docs-contents", className: "absolute left-3 right-3 top-[calc(100%+0.35rem)] z-30 max-h-[min(68vh,32rem)] overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-lg ring-1 ring-border/50" },
            activeSections.length > 0 && (React.createElement("section", { className: "mb-4 border-b border-border pb-3" },
                React.createElement("h2", { className: "mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground" }, "On this page"),
                React.createElement("ul", { className: "space-y-1" }, activeSections.map(function (_a) {
                    var section = _a.section, parentTitle = _a.parentTitle;
                    var isActive = section.id === activeSectionId;
                    return (React.createElement("li", { key: (parentTitle !== null && parentTitle !== void 0 ? parentTitle : 'root') + "-" + section.id },
                        React.createElement("a", { href: "#" + section.id, onClick: function () { return setIsMobileContentsOpen(false); }, "data-docs-active": isActive ? 'true' : undefined, "data-docs-active-level": isActive ? 'section' : undefined, className: utils_1.cn('block rounded-md px-2 py-2 text-sm font-bold transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary') },
                            parentTitle ? parentTitle + ": " : '',
                            section.title)));
                })))),
            React.createElement(DocsLinkGroups, { activeSlug: activeSlug, activeSectionId: activeSectionId, showActiveSections: false, onNavigate: function () { return setIsMobileContentsOpen(false); } })))));
    return (React.createElement(React.Fragment, null,
        React.createElement("aside", { className: "hidden w-84 shrink-0 border-r border-border bg-background/80 px-5 py-6 lg:block" },
            React.createElement("nav", { className: "sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col", "aria-label": "Documentation" },
                React.createElement(link_1["default"], { href: "/docs", className: "mb-4 flex items-center gap-2 text-base font-black text-foreground" },
                    React.createElement(lucide_react_1.BookOpen, { className: "h-5 w-5 text-primary", "aria-hidden": "true" }),
                    "EduVerse Docs"),
                React.createElement("div", { className: "mb-6" },
                    React.createElement(DocsSearch_1.DocsSearch, null)),
                React.createElement("div", { ref: desktopNavRef, className: "min-h-0 flex-1 overflow-y-auto pr-1" },
                    React.createElement(DocsLinkGroups, { activeSlug: activeSlug, activeSectionId: activeSectionId })))),
        React.createElement("div", { className: "h-14.25 shrink-0 lg:hidden", "aria-hidden": "true" }),
        isMounted ? react_dom_1.createPortal(mobileHeader, document.body) : null));
}
exports.DocsNavigation = DocsNavigation;
function DocsLinkGroups(_a) {
    var activeSlug = _a.activeSlug, activeSectionId = _a.activeSectionId, onNavigate = _a.onNavigate, _b = _a.showActiveSections, showActiveSections = _b === void 0 ? true : _b;
    return (React.createElement("div", { className: "space-y-6" }, docs_1.docsNavGroups.map(function (group) {
        var pages = docs_1.getDocPagesForGroup(group);
        return (React.createElement("section", { key: group.title },
            React.createElement("h2", { className: "mb-2 px-2 text-xs font-black uppercase tracking-wider text-muted-foreground" }, group.title),
            React.createElement("ul", { className: "space-y-1" }, pages.map(function (page) {
                var isActivePage = page.slug === activeSlug;
                var sections = isActivePage && showActiveSections ? docs_1.flattenDocSections(page) : [];
                return (React.createElement("li", { key: page.slug },
                    React.createElement(link_1["default"], { href: "/docs/" + page.slug, onClick: onNavigate, "data-docs-active": isActivePage && !activeSectionId ? 'true' : undefined, "data-docs-active-level": isActivePage && !activeSectionId ? 'page' : undefined, className: utils_1.cn('group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors', isActivePage
                            ? 'bg-primary/10 text-primary ring-1 ring-primary/15'
                            : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'), "aria-current": isActivePage && !activeSectionId ? 'page' : undefined },
                        React.createElement("span", null, page.title),
                        React.createElement(lucide_react_1.ChevronRight, { className: utils_1.cn('h-3.5 w-3.5 transition-opacity', isActivePage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'), "aria-hidden": "true" })),
                    sections.length > 0 && (React.createElement("ul", { className: "mt-1 space-y-0.5 border-l border-border/80 pl-3" }, sections.map(function (_a) {
                        var section = _a.section, parentTitle = _a.parentTitle;
                        var isActiveSection = section.id === activeSectionId;
                        return (React.createElement("li", { key: (parentTitle !== null && parentTitle !== void 0 ? parentTitle : 'root') + "-" + section.id },
                            React.createElement("a", { href: "#" + section.id, onClick: onNavigate, "data-docs-active": isActiveSection ? 'true' : undefined, "data-docs-active-level": isActiveSection ? 'section' : undefined, className: utils_1.cn('block rounded-md px-2 py-1.5 text-xs font-bold transition-colors', isActiveSection
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'), "aria-current": isActiveSection ? 'location' : undefined },
                                parentTitle ? parentTitle + ": " : '',
                                section.title)));
                    })))));
            }))));
    })));
}
