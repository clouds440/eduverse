import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

const publicRoutes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
}> = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/pricing', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/docs', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.6 },
    { path: '/careers', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
    const siteUrl = getSiteUrl();
    const lastModified = new Date();

    return publicRoutes.map((route) => ({
        url: `${siteUrl}${route.path}`,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
    }));
}
