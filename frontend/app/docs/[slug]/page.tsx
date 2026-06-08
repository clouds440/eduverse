import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocArticle } from '../_components/DocArticle';
import { docsPages, getDocPage } from '../_data/docs';

type DocsSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return docsPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: DocsSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) {
    return {
      title: 'Documentation',
    };
  }

  return {
    title: `${page.title} Documentation`,
    description: page.description,
  };
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) {
    notFound();
  }

  return <DocArticle page={page} />;
}
