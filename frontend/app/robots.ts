import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';
import { privateSeoPaths } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();
    const disallow = privateSeoPaths.flatMap((path) => [path, `${path}/`]);

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow,
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
