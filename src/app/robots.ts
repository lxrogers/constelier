import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Preview deployments ask not to be indexed; production lists the sitemap.
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/bag', '/order/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
