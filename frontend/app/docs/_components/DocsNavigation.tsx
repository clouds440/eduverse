'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { docsNavGroups, flattenDocSections, getDocPage, getDocPagesForGroup } from '../_data/docs';
import { DocsSearch } from './DocsSearch';

export function DocsNavigation() {
  const pathname = usePathname() || '/docs';
  const activeSlug = pathname.split('/').filter(Boolean)[1];
  const activePage = activeSlug ? getDocPage(activeSlug) : undefined;
  const [activeSectionId, setActiveSectionId] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileContentsOpen, setIsMobileContentsOpen] = useState(false);

  const activeSections = useMemo(() => (activePage ? flattenDocSections(activePage) : []), [activePage]);

  useEffect(() => {
    if (!activeSections.length) {
      setActiveSectionId('');
      return;
    }

    const setFromHash = () => {
      const hashId = window.location.hash.replace('#', '');
      setActiveSectionId(hashId || activeSections[0]?.section.id || '');
    };

    setFromHash();
    window.addEventListener('hashchange', setFromHash);

    const observers: IntersectionObserver[] = [];
    const visibleSections = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        const nextActive = [...visibleSections.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (nextActive) setActiveSectionId(nextActive);
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: [0.1, 0.25, 0.5, 0.75] },
    );

    activeSections.forEach(({ section }) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    observers.push(observer);

    return () => {
      window.removeEventListener('hashchange', setFromHash);
      observers.forEach((item) => item.disconnect());
    };
  }, [activeSections]);

  useEffect(() => {
    setIsMobileContentsOpen(false);
    setIsMobileSearchOpen(false);
  }, [pathname]);

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-border bg-background/80 px-5 py-6 lg:block">
        <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1" aria-label="Documentation">
          <Link href="/docs" className="mb-4 flex items-center gap-2 text-base font-black text-foreground">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            EduVerse Docs
          </Link>

          <div className="mb-6">
            <DocsSearch />
          </div>

          <DocsLinkGroups activeSlug={activeSlug} activeSectionId={activeSectionId} />
        </nav>
      </aside>

      <div className="sticky top-0 z-50 w-full border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-md lg:hidden">
        <div className="flex min-h-10 items-center gap-2">
          {isMobileSearchOpen ? (
            <>
              <DocsSearch
                compact
                autoFocus
                resultsMode="popover"
                className="min-w-0 flex-1"
                onNavigate={() => {
                  setIsMobileSearchOpen(false);
                  setIsMobileContentsOpen(false);
                }}
              />
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-primary"
                aria-label="Close docs search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link href="/docs" className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black text-foreground">
                <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="shrink-0">Docs</span>
                {activePage && (
                  <span className="min-w-0 truncate text-xs font-bold text-muted-foreground">
                    / {activePage.title}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(true);
                  setIsMobileContentsOpen(false);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-primary"
                aria-label="Search docs"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIsMobileContentsOpen((value) => !value)}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-black transition-colors',
                  isMobileContentsOpen
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-primary',
                )}
                aria-expanded={isMobileContentsOpen}
                aria-controls="mobile-docs-contents"
              >
                Contents
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isMobileContentsOpen && 'rotate-180')} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {isMobileContentsOpen && !isMobileSearchOpen && (
          <div
            id="mobile-docs-contents"
            className="absolute left-3 right-3 top-[calc(100%+0.25rem)] max-h-[min(68vh,32rem)] overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-lg ring-1 ring-border/50"
          >
            {activeSections.length > 0 && (
              <section className="mb-4 border-b border-border pb-3">
                <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                  On this page
                </h2>
                <ul className="space-y-1">
                  {activeSections.map(({ section, parentTitle }) => {
                    const isActive = section.id === activeSectionId;
                    return (
                      <li key={`${parentTitle ?? 'root'}-${section.id}`}>
                        <a
                          href={`#${section.id}`}
                          onClick={() => setIsMobileContentsOpen(false)}
                          className={cn(
                            'block rounded-md px-2 py-2 text-sm font-bold transition-colors',
                            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/5 hover:text-primary',
                          )}
                        >
                          {parentTitle ? `${parentTitle}: ` : ''}
                          {section.title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <DocsLinkGroups
              activeSlug={activeSlug}
              activeSectionId={activeSectionId}
              showActiveSections={false}
              onNavigate={() => setIsMobileContentsOpen(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}

function DocsLinkGroups({
  activeSlug,
  activeSectionId,
  onNavigate,
  showActiveSections = true,
}: {
  activeSlug?: string;
  activeSectionId: string;
  onNavigate?: () => void;
  showActiveSections?: boolean;
}) {
  return (
    <div className="space-y-6">
      {docsNavGroups.map((group) => {
        const pages = getDocPagesForGroup(group);
        return (
          <section key={group.title}>
            <h2 className="mb-2 px-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h2>
            <ul className="space-y-1">
              {pages.map((page) => {
                const isActivePage = page.slug === activeSlug;
                const sections = isActivePage && showActiveSections ? flattenDocSections(page) : [];

                return (
                  <li key={page.slug}>
                    <Link
                      href={`/docs/${page.slug}`}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors',
                        isActivePage
                          ? 'bg-primary/10 text-primary ring-1 ring-primary/15'
                          : 'text-muted-foreground hover:bg-primary/5 hover:text-primary',
                      )}
                      aria-current={isActivePage && !activeSectionId ? 'page' : undefined}
                    >
                      <span>{page.title}</span>
                      <ChevronRight
                        className={cn('h-3.5 w-3.5 transition-opacity', isActivePage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
                        aria-hidden="true"
                      />
                    </Link>

                    {sections.length > 0 && (
                      <ul className="mt-1 space-y-0.5 border-l border-border/80 pl-3">
                        {sections.map(({ section, parentTitle }) => {
                          const isActiveSection = section.id === activeSectionId;
                          return (
                            <li key={`${parentTitle ?? 'root'}-${section.id}`}>
                              <a
                                href={`#${section.id}`}
                                onClick={onNavigate}
                                className={cn(
                                  'block rounded-md px-2 py-1.5 text-xs font-bold transition-colors',
                                  isActiveSection
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-primary/5 hover:text-primary',
                                )}
                                aria-current={isActiveSection ? 'location' : undefined}
                              >
                                {parentTitle ? `${parentTitle}: ` : ''}
                                {section.title}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
