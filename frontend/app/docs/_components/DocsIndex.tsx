import Link from 'next/link';
import { ArrowRight, BookOpen, GraduationCap, Search } from 'lucide-react';
import { PLATFORM_NAME } from '@/lib/constants';
import { docsNavGroups, getDocPagesForGroup } from '../_data/docs';

export function DocsIndex() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-lg border border-border bg-card p-6 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Documentation
        </div>
        <h1 className="max-w-3xl text-3xl font-black leading-tight text-foreground sm:text-4xl">
          Learn how {PLATFORM_NAME} works, module by module.
        </h1>
        <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground">
          These docs explain workflows, rules, permissions, and consequences in plain operational language.
          Use the docs search to jump directly to the module or section you need.
        </p>
      </section>

      <div className="space-y-8">
        {docsNavGroups.map((group) => {
          const pages = getDocPagesForGroup(group);
          return (
            <section key={group.title}>
              <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">{group.title}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {pages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/docs/${page.slug}`}
                    className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/35 hover:bg-primary/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-black text-foreground group-hover:text-primary">{page.title}</h3>
                        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">{page.description}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {page.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
