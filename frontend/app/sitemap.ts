import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';
import { publicSeoRoutes } from '@/lib/seo';
import { docsPages } from './docs/_data/docs';

export default function sitemap(): MetadataRoute.Sitemap {
    const siteUrl = getSiteUrl();
    const lastModified = new Date();

    const docRoutes = docsPages.map((page) => ({
        path: `/docs/${page.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.55,
    }));

    return [...publicSeoRoutes, ...docRoutes].map((route) => ({
        url: `${siteUrl}${route.path}`,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
    }));
}
