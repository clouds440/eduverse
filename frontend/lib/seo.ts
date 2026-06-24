import type { Metadata, MetadataRoute } from 'next';

import { getSiteUrl } from './site';

export const SITE_NAME = 'EduVerse';

export const SITE_DESCRIPTION =
  'EduVerse is a secure school management system for institutes that need admissions, students, teachers, attendance, grades, timetables, finance, communication, and transcripts in one workspace.';

export const SEO_KEYWORDS = [
  'school management system',
  'school ERP',
  'student information system',
  'education management software',
  'attendance management software',
  'gradebook software',
  'school finance management',
  'timetable management',
  'academic transcript software',
  'school communication platform',
  'EduVerse',
];

export type PublicSeoRoute = {
  path: string;
  title: string;
  description: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

export const publicSeoRoutes: PublicSeoRoute[] = [
  {
    path: '/',
    title: 'EduVerse | School Management System',
    description: SITE_DESCRIPTION,
    changeFrequency: 'weekly',
    priority: 1,
  },
  {
    path: '/about',
    title: 'About EduVerse',
    description: 'Learn how EduVerse helps schools and institutes simplify academic, finance, communication, and administrative work.',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/pricing',
    title: 'EduVerse Pricing',
    description: 'Compare EduVerse plans for small academies, growing schools, universities, and multi-campus education groups.',
    changeFrequency: 'weekly',
    priority: 0.8,
  },
  {
    path: '/contact',
    title: 'Contact EduVerse',
    description: 'Contact the EduVerse team for school management software demos, support, onboarding, and sales questions.',
    changeFrequency: 'monthly',
    priority: 0.65,
  },
  {
    path: '/docs',
    title: 'EduVerse Documentation',
    description: 'Read EduVerse documentation for setup, roles, academics, GPA policies, transcripts, finance, communication, and operations.',
    changeFrequency: 'weekly',
    priority: 0.75,
  },
  {
    path: '/blog',
    title: 'EduVerse Blog',
    description: 'Read EduVerse articles about school operations, education technology, student records, communication, and academic management.',
    changeFrequency: 'weekly',
    priority: 0.6,
  },
  {
    path: '/careers',
    title: 'EduVerse Careers',
    description: 'Explore career opportunities at EduVerse and help build modern software for schools and institutes.',
    changeFrequency: 'monthly',
    priority: 0.4,
  },
  {
    path: '/privacy',
    title: 'EduVerse Privacy Policy',
    description: 'Review how EduVerse protects school, staff, student, guardian, academic, finance, and communication data.',
    changeFrequency: 'yearly',
    priority: 0.3,
  },
  {
    path: '/terms',
    title: 'EduVerse Terms of Service',
    description: 'Read the EduVerse terms of service for schools, institutes, platform users, accounts, subscriptions, and acceptable use.',
    changeFrequency: 'yearly',
    priority: 0.3,
  },
];

export const privateSeoPaths = [
  '/admin',
  '/academic-calender',
  '/academic-cycles',
  '/attendance',
  '/buildings-and-rooms',
  '/campus-navigation',
  '/change-password',
  '/chat',
  '/cohorts',
  '/course-materials',
  '/courses',
  '/departments',
  '/evaluations',
  '/fees',
  '/finance',
  '/finance-managers',
  '/forgot-password',
  '/grade-finalization',
  '/grades',
  '/guardian',
  '/guardians',
  '/login',
  '/mail',
  '/offline',
  '/overview',
  '/promotions',
  '/register',
  '/reset-password',
  '/schedules',
  '/sections',
  '/settings',
  '/students',
  '/sub-admins',
  '/teacher-finance',
  '/teachers',
  '/test-login',
  '/timetable',
  '/transcripts',
  '/users',
  '/api',
];

export function getPublicSeoRoute(path: string) {
  return publicSeoRoutes.find((route) => route.path === path);
}

export function createPublicMetadata(path: string): Metadata {
  const route = getPublicSeoRoute(path);
  const title = route?.title ?? SITE_NAME;
  const description = route?.description ?? SITE_DESCRIPTION;

  return {
    title,
    description,
    keywords: SEO_KEYWORDS,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: 'website',
      url: path,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: '/assets/eduverse-logo.png',
          width: 1324,
          height: 480,
          alt: `${SITE_NAME} school management platform`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/assets/eduverse-logo.png'],
    },
  };
}

export function getWebsiteJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}/assets/eduverse-icon-192.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
        publisher: {
          '@id': `${siteUrl}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/docs?search={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/#software`,
        name: SITE_NAME,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web',
        url: siteUrl,
        description: SITE_DESCRIPTION,
        offers: {
          '@type': 'Offer',
          url: `${siteUrl}/pricing`,
          category: 'Subscription',
        },
      },
    ],
  };
}
