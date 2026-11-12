import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { LEGAL_PAGES } from '@/components/LegalLinks';
import { LEGAL_DRAFT } from './legal/policy';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/chart`, changeFrequency: 'weekly', priority: 1 },
  ];
  // Policy drafts are noindex; list them once they're final.
  if (!LEGAL_DRAFT) {
    for (const p of LEGAL_PAGES) pages.push({ url: `${SITE_URL}${p.href}`, changeFrequency: 'yearly', priority: 0.3 });
  }
  return pages;
}
