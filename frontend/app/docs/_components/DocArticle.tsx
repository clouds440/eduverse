import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, ListChecks, Square } from 'lucide-react';
import type { DocBlock, DocPage, DocSection } from '../_data/docs';
import { docsPages, flattenDocSections, getDocPage } from '../_data/docs';

type DocArticleProps = {
  page: DocPage;
};

type AppLinkTerm = {
  phrase: string;
  href: string;
};

const appLinkTerms: AppLinkTerm[] = [
  { phrase: 'Import monthly attendance CSV', href: '/attendance' },
  { phrase: 'Import attendance CSV', href: '/attendance' },
  { phrase: 'Import students CSV', href: '/students' },
  { phrase: 'Import teachers CSV', href: '/teachers' },
  { phrase: 'Import courses CSV', href: '/courses' },
  { phrase: 'Import sections CSV', href: '/sections' },
  { phrase: 'Import guardians CSV', href: '/guardians' },
  { phrase: 'Import departments CSV', href: '/departments' },
  { phrase: 'Import buildings CSV', href: '/buildings-and-rooms' },
  { phrase: 'Import rooms CSV', href: '/buildings-and-rooms' },
  { phrase: 'Grade Finalization', href: '/grade-finalization' },
  { phrase: 'grade finalization review', href: '/grade-finalization' },
  { phrase: 'Academic Cycles', href: '/academic-cycles' },
  { phrase: 'Academic Cycle', href: '/academic-cycles' },
  { phrase: 'Academic Calendar', href: '/holidays' },
  { phrase: 'academic calendar items', href: '/holidays' },
  { phrase: 'Buildings and Rooms', href: '/buildings-and-rooms' },
  { phrase: 'Building and Room', href: '/buildings-and-rooms' },
  { phrase: 'GPA Policies', href: '/settings/gpa-policies' },
  { phrase: 'GPA Policy', href: '/settings/gpa-policies' },
  { phrase: 'organization default policy', href: '/settings/gpa-policies' },
  { phrase: 'Evaluation windows', href: '/evaluations' },
  { phrase: 'Evaluation window', href: '/evaluations' },
  { phrase: 'Evaluations and Feedback', href: '/evaluations' },
  { phrase: 'Teacher feedback', href: '/evaluations' },
  { phrase: 'Course feedback', href: '/evaluations' },
  { phrase: 'Feedback page', href: '/evaluations' },
  { phrase: 'Payment claims', href: '/finance' },
  { phrase: 'Payment claim', href: '/finance' },
  { phrase: 'Finance structures', href: '/finance/structures' },
  { phrase: 'Finance structure', href: '/finance/structures' },
  { phrase: 'Finance entries', href: '/finance/entries' },
  { phrase: 'Finance entry', href: '/finance/entries' },
  { phrase: 'confirmed transactions', href: '/finance/transactions' },
  { phrase: 'Course Materials', href: '/courses' },
  { phrase: 'Gradebook', href: '/grades' },
  { phrase: 'Timetable and Schedules', href: '/timetable' },
  { phrase: 'class schedule', href: '/timetable' },
  { phrase: 'monthly attendance import', href: '/attendance' },
  { phrase: 'attendance import', href: '/attendance' },
  { phrase: 'assessment setup', href: '/sections' },
  { phrase: 'student edit form', href: '/students' },
  { phrase: 'student portal', href: '/students' },
  { phrase: 'guardian portal', href: '/guardian' },
  { phrase: 'guardian account', href: '/guardians' },
  { phrase: 'linked-student records', href: '/guardian' },
  { phrase: 'Finance Managers', href: '/finance-managers' },
  { phrase: 'Finance Manager', href: '/finance-managers' },
  { phrase: 'Sub Admins', href: '/sub-admins' },
  { phrase: 'Sub Admin', href: '/sub-admins' },
  { phrase: 'department setup', href: '/departments' },
  { phrase: 'building setup', href: '/buildings-and-rooms' },
  { phrase: 'room setup', href: '/buildings-and-rooms' },
  { phrase: 'school setup workflow', href: '/docs/school-setup-workflow' },
  { phrase: 'Profile Settings', href: '/settings' },
].sort((a, b) => b.phrase.length - a.phrase.length);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const appLinkPattern = new RegExp(`\\b(${appLinkTerms.map((term) => escapeRegExp(term.phrase)).join('|')})\\b`, 'gi');
const appLinkByPhrase = new Map(appLinkTerms.map((term) => [term.phrase.toLowerCase(), term.href]));

function LinkedText({ text, linkedPhrases }: { text: string; linkedPhrases: Set<string> }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(appLinkPattern)) {
    const phrase = match[0];
    const index = match.index ?? 0;
    const phraseKey = phrase.toLowerCase();
    const href = appLinkByPhrase.get(phraseKey);
    if (!href) continue;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    if (linkedPhrases.has(phraseKey)) {
      parts.push(phrase);
    } else {
      linkedPhrases.add(phraseKey);
      parts.push(
        <Link
          key={`${phrase}-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-primary underline-offset-4 transition-colors hover:text-primary-hover hover:underline"
        >
          {phrase}
        </Link>,
      );
    }

    lastIndex = index + phrase.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts.length ? parts : text}</>;
}

export function DocArticle({ page }: DocArticleProps) {
  const linkedPhrases = new Set<string>();
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
          <LinkedText text={page.description} linkedPhrases={linkedPhrases} />
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
          <DocSectionView key={section.id} section={section} linkedPhrases={linkedPhrases} />
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

function DocSectionView({ section, linkedPhrases, depth = 2 }: { section: DocSection; linkedPhrases: Set<string>; depth?: 2 | 3 | 4 }) {
  const HeadingTag: 'h2' | 'h3' | 'h4' = depth === 2 ? 'h2' : depth === 3 ? 'h3' : 'h4';

  return (
    <section id={section.id} className="scroll-mt-24 rounded-lg transition-colors target:bg-primary/5 target:ring-1 target:ring-primary/20">
      <div className="px-1 py-1">
        <HeadingTag className={depth === 2 ? 'text-2xl font-black text-foreground' : 'text-xl font-black text-foreground'}>
          {section.title}
        </HeadingTag>
        {section.summary && (
          <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground"><LinkedText text={section.summary} linkedPhrases={linkedPhrases} /></p>
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
            <DocBlockView key={index} block={block} linkedPhrases={linkedPhrases} />
          ))}
        </div>
        {section.subsections?.length ? (
          <div className="mt-6 space-y-7 border-l border-border pl-4">
            {section.subsections.map((subsection) => (
              <DocSectionView key={subsection.id} section={subsection} linkedPhrases={linkedPhrases} depth={depth === 2 ? 3 : 4} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DocBlockView({ block, linkedPhrases }: { block: DocBlock; linkedPhrases: Set<string> }) {
  if (block.type === 'paragraph') {
    return <p className="text-sm font-medium leading-7 text-muted-foreground"><LinkedText text={block.text} linkedPhrases={linkedPhrases} /></p>;
  }

  if (block.type === 'note') {
    return (
      <div className="rounded-lg border border-warning/25 bg-warning/10 p-4">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          {block.title}
        </h3>
        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground"><LinkedText text={block.text} linkedPhrases={linkedPhrases} /></p>
      </div>
    );
  }

  if (block.type === 'tip') {
    return (
      <div className="rounded-lg border border-success/25 bg-success/10 p-4">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <Lightbulb className="h-4 w-4 text-success" aria-hidden="true" />
          {block.title}
        </h3>
        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground"><LinkedText text={block.text} linkedPhrases={linkedPhrases} /></p>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {block.headers.map((header) => (
                <th key={header} className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-foreground">
                  <LinkedText text={header} linkedPhrases={linkedPhrases} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition-colors hover:bg-muted/30">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2.5 font-medium text-muted-foreground">
                    <LinkedText text={cell} linkedPhrases={linkedPhrases} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'flow') {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        {block.title && (
          <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">{block.title}</h4>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {block.steps.map((step, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <LinkedText text={step} linkedPhrases={linkedPhrases} />
              </span>
              {index < block.steps.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'checklist') {
    return (
      <ul className="space-y-2">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-sm font-medium leading-6 text-muted-foreground">
            <Square className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
            <span><LinkedText text={item} linkedPhrases={linkedPhrases} /></span>
          </li>
        ))}
      </ul>
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
          <span><LinkedText text={item} linkedPhrases={linkedPhrases} /></span>
        </li>
      ))}
    </ListTag>
  );
}

export function getDocBySlugOrFirst(slug?: string) {
  return slug ? getDocPage(slug) : docsPages[0];
}
