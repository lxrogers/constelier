'use client';

import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { stripQuery, trackFunnel } from '@/lib/analytics';

// Cookie-free page views and Core Web Vitals from Vercel, with query strings
// removed so no birth details leave the page.
export default function SiteAnalytics() {
  useOutlineChanges();
  return (
    <>
      <Analytics beforeSend={(e) => ({ ...e, url: stripQuery(e.url) })} />
      <SpeedInsights beforeSend={(e) => ({ ...e, url: stripQuery(e.url) })} />
    </>
  );
}

// The outline switch talks to the chart through a window event; count style
// changes only, not every liquidity step while dragging.
function useOutlineChanges() {
  useEffect(() => {
    let last: string | null = null;
    const onOutline = (e: Event) => {
      const style = (e as CustomEvent).detail?.style;
      if (typeof style !== 'string' || style === last) return;
      trackFunnel('outline_changed', { style });
      last = style;
    };
    window.addEventListener('pendant-outline', onOutline);
    return () => window.removeEventListener('pendant-outline', onOutline);
  }, []);
}
