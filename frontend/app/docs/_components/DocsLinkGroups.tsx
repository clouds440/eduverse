import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { docsNavGroups, flattenDocSections, getDocPagesForGroup } from '../_data/docs';

type DocsLinkGroupsProps = {
  activeSlug?: string;
  activeSectionId?: string;
  showActiveSections?: boolean;
};

export function DocsLinkGroups({
  activeSlug,
  activeSectionId = '',
  showActiveSections = true,
}: DocsLinkGroupsProps) {
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
                      data-docs-active={isActivePage && !activeSectionId ? 'true' : undefined}
                      data-docs-active-level={isActivePage && !activeSectionId ? 'page' : undefined}
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
                                data-docs-active={isActiveSection ? 'true' : undefined}
                                data-docs-active-level={isActiveSection ? 'section' : undefined}
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
