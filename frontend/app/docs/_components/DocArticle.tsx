import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks } from 'lucide-react';
import type { DocBlock, DocPage, DocSection } from '../_data/docs';
import { docsPages, flattenDocSections, getDocPage } from '../_data/docs';

type DocArticleProps = {
  page: DocPage;
};

export function DocArticle({ page }: DocArticleProps) {
  const sectionLinks = flattenDocSections(page);
  const relatedPages = (page.related ?? [])
    .map((slug) => getDocPage(slug))
    .filter((doc): doc is DocPage => Boolean(doc));

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-border pb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">{page.category}</p>
        <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">{page.title}</h1>
        <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground">
          {page.description}
        </p>
        <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
          {page.tags.map((tag) => (
            <span key={tag} className="rounded-md border border-border bg-muted/45 px-2.5 py-1 text-xs font-bold text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      </header>

      <nav aria-label={`${page.title} sections`} className="mb-8 hidden rounded-lg border border-border bg-card p-4 lg:block">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-foreground">
          <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
          On this page
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {sectionLinks.map(({ section, parentTitle }) => (
            <a
              key={`${parentTitle ?? 'root'}-${section.id}`}
              href={`#${section.id}`}
              className="rounded-md px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
            >
              {parentTitle ? `${parentTitle}: ` : ''}
              {section.title}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-10">
        {page.sections.map((section) => (
          <DocSectionView key={section.id} section={section} />
        ))}
      </div>

      {relatedPages.length > 0 && (
        <footer className="mt-12 border-t border-border pt-8">
          <h2 className="mb-4 text-lg font-black text-foreground">Related docs</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatedPages.map((doc) => (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-foreground group-hover:text-primary">{doc.title}</h3>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">{doc.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        </footer>
      )}
    </article>
  );
}

function DocSectionView({ section, depth = 2 }: { section: DocSection; depth?: 2 | 3 | 4 }) {
  const HeadingTag: 'h2' | 'h3' | 'h4' = depth === 2 ? 'h2' : depth === 3 ? 'h3' : 'h4';

  return (
    <section id={section.id} className="scroll-mt-24 rounded-lg transition-colors target:bg-primary/5 target:ring-1 target:ring-primary/20">
      <div className="px-1 py-1">
        <HeadingTag className={depth === 2 ? 'text-2xl font-black text-foreground' : 'text-xl font-black text-foreground'}>
          {section.title}
        </HeadingTag>
        {section.summary && (
          <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">{section.summary}</p>
        )}
        {section.tags?.length ? (
          <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
            {section.tags.map((tag) => (
              <span key={tag} className="text-xs font-bold text-primary/80">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          {section.blocks.map((block, index) => (
            <DocBlockView key={index} block={block} />
          ))}
        </div>
        {section.subsections?.length ? (
          <div className="mt-6 space-y-7 border-l border-border pl-4">
            {section.subsections.map((subsection) => (
              <DocSectionView key={subsection.id} section={subsection} depth={depth === 2 ? 3 : 4} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DocBlockView({ block }: { block: DocBlock }) {
  if (block.type === 'paragraph') {
    return <p className="text-sm font-medium leading-7 text-muted-foreground">{block.text}</p>;
  }

  if (block.type === 'note') {
    return (
      <div className="rounded-lg border border-warning/25 bg-warning/10 p-4">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          {block.title}
        </h3>
        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">{block.text}</p>
      </div>
    );
  }

  const isSteps = block.type === 'steps';
  const ListTag = isSteps ? 'ol' : 'ul';

  return (
    <ListTag className={isSteps ? 'space-y-2' : 'space-y-2'}>
      {block.items.map((item, index) => (
        <li key={item} className="flex gap-3 text-sm font-medium leading-6 text-muted-foreground">
          {isSteps ? (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
              {index + 1}
            </span>
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ListTag>
  );
}

export function getDocBySlugOrFirst(slug?: string) {
  return slug ? getDocPage(slug) : docsPages[0];
}
