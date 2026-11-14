// Canonical address for sitemaps and metadata. NEXT_PUBLIC_SITE_URL overrides it.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.constelier.com').replace(/\/$/, '');
