'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { flattenDocSections, getDocPage } from '../_data/docs';
import { DocsLinkGroups } from './DocsLinkGroups';
import { DocsSearch } from './DocsSearch';

type DocsMobileNavigationProps = {
  activeSlug?: string;
};

export function DocsMobileNavigation({ activeSlug }: DocsMobileNavigationProps) {
  const pathname = usePathname() || '/docs';
  const activePage = activeSlug ? getDocPage(activeSlug) : undefined;
  const [activeSectionId, setActiveSectionId] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileContentsOpen, setIsMobileContentsOpen] = useState(false);
  const [isMobileHeaderVisible, setIsMobileHeaderVisible] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const lastScrollTopRef = useRef(0);
  const mobileContentsRef = useRef<HTMLDivElement>(null);

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

    return () => {
      window.removeEventListener('hashchange', setFromHash);
      observer.disconnect();
    };
  }, [activeSections]);

  useEffect(() => {
    setIsMobileContentsOpen(false);
    setIsMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMobileContentsOpen) return;

    const activeLink = mobileContentsRef.current?.querySelector<HTMLElement>('[data-docs-active="true"]');
    if (!mobileContentsRef.current || !activeLink) return;

    const frame = window.requestAnimationFrame(() => {
      if (!mobileContentsRef.current) return;
      const containerRect = mobileContentsRef.current.getBoundingClientRect();
      const activeRect = activeLink.getBoundingClientRect();
      mobileContentsRef.current.scrollTo({
        top: mobileContentsRef.current.scrollTop + activeRect.top - containerRect.top - 56,
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSectionId, isMobileContentsOpen]);

  useEffect(() => {
    const appShell = document.querySelector<HTMLElement>('.app-shell-main');

    const getScrollTop = () => {
      if (appShell && appShell.scrollHeight > appShell.clientHeight) {
        return appShell.scrollTop;
      }

      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const handleScroll = () => {
      if (isMobileContentsOpen || isMobileSearchOpen) {
        setIsMobileHeaderVisible(true);
        lastScrollTopRef.current = getScrollTop();
        return;
      }

      const nextScrollTop = getScrollTop();
      const delta = nextScrollTop - lastScrollTopRef.current;

      if (nextScrollTop < 12) {
        setIsMobileHeaderVisible(true);
      } else if (delta > 4) {
        setIsMobileHeaderVisible(false);
      } else if (delta < -1) {
        setIsMobileHeaderVisible(true);
      }

      lastScrollTopRef.current = nextScrollTop;
    };

    lastScrollTopRef.current = getScrollTop();
    appShell?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      appShell?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMobileContentsOpen, isMobileSearchOpen]);

  const mobileHeader = (
    <div
      className={cn(
        'fixed left-0 right-0 top-(--dashboard-nav-offset) z-90 w-full border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-md transition-[transform,top] duration-200 lg:hidden',
        isMobileHeaderVisible ? 'translate-y-0' : '-translate-y-full',
      )}
    >
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
          ref={mobileContentsRef}
          id="mobile-docs-contents"
          className="absolute left-3 right-3 top-[calc(100%+0.35rem)] z-30 max-h-[min(68vh,32rem)] overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-lg ring-1 ring-border/50"
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
                        data-docs-active={isActive ? 'true' : undefined}
                        data-docs-active-level={isActive ? 'section' : undefined}
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

          <div
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) {
                setIsMobileContentsOpen(false);
              }
            }}
          >
            <DocsLinkGroups
              activeSlug={activeSlug}
              activeSectionId={activeSectionId}
              showActiveSections={false}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="h-14.25 shrink-0 lg:hidden" aria-hidden="true" />
      {isMounted ? createPortal(mobileHeader, document.body) : null}
    </>
  );
}
