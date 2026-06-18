import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { DocsLinkGroups } from './DocsLinkGroups';
import { DocsMobileNavigation } from './DocsMobileNavigation';
import { DocsSearch } from './DocsSearch';

type DocsNavigationProps = {
  activeSlug?: string;
};

export function DocsNavigation({ activeSlug }: DocsNavigationProps) {
  return (
    <>
      <aside className="hidden w-84 shrink-0 border-r border-border bg-background/80 px-5 py-6 lg:block">
        <nav className="sticky top-[calc(var(--dashboard-nav-offset)+1rem)] flex max-h-[calc(100vh-6rem)] flex-col transition-[top] duration-200" aria-label="Documentation">
          <Link href="/docs" className="mb-4 flex items-center gap-2 text-base font-black text-foreground">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            EduVerse Docs
          </Link>

          <div className="mb-6">
            <DocsSearch />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <DocsLinkGroups activeSlug={activeSlug} />
          </div>
        </nav>
      </aside>

      <DocsMobileNavigation activeSlug={activeSlug} />
    </>
  );
}
