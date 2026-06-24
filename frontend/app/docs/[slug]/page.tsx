import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocArticle } from '../_components/DocArticle';
import { DocsShell } from '../_components/DocsShell';
import { docsPages, getDocPage } from '../_data/docs';
import { SEO_KEYWORDS, SITE_NAME } from '@/lib/seo';
import { getSiteUrl } from '@/lib/site';

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
    keywords: [...SEO_KEYWORDS, ...page.tags],
    alternates: {
      canonical: `/docs/${page.slug}`,
    },
    openGraph: {
      type: 'article',
      url: `/docs/${page.slug}`,
      siteName: SITE_NAME,
      title: `${page.title} Documentation`,
      description: page.description,
      images: [
        {
          url: '/assets/eduverse-logo.png',
          width: 1324,
          height: 480,
          alt: `${SITE_NAME} documentation`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${page.title} Documentation`,
      description: page.description,
      images: ['/assets/eduverse-logo.png'],
    },
  };
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const docUrl = `${siteUrl}/docs/${page.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${page.title} Documentation`,
    description: page.description,
    url: docUrl,
    mainEntityOfPage: docUrl,
    about: page.tags,
    articleSection: page.category,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/assets/eduverse-icon-192.png`,
      },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Documentation',
          item: `${siteUrl}/docs`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: page.title,
          item: docUrl,
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DocsShell activeSlug={slug}>
        <DocArticle page={page} />
      </DocsShell>
    </>
  );
}
