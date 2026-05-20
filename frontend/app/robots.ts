import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/admin',
                '/admin/',
                '/academic-cycles',
                '/academic-cycles/',
                '/attendance',
                '/attendance/',
                '/change-password',
                '/chat',
                '/cohorts',
                '/cohorts/',
                '/course-materials',
                '/course-materials/',
                '/courses',
                '/courses/',
                '/finance',
                '/finance/',
                '/forgot-password',
                '/grades',
                '/login',
                '/mail',
                '/offline',
                '/overview',
                '/promotions',
                '/register',
                '/reset-password',
                '/schedules',
                '/sections',
                '/sections/',
                '/settings',
                '/students',
                '/students/',
                '/teachers',
                '/teachers/',
                '/timetable',
                '/transcripts',
                '/api',
                '/api/',
            ],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
