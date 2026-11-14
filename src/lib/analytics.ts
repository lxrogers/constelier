import { track } from '@vercel/analytics';

// Configurator funnel, in order. Shows up under Events in Vercel Web
// Analytics. Never put birth details, names or emails in event properties.
export type FunnelEvent =
  | 'birth_details_entered'
  | 'chart_shown'
  | 'outline_changed'
  | 'quote_shown'
  | 'added_to_bag'
  | 'checkout_started'
  | 'waitlist_joined';

type Props = Record<string, string | number | boolean | null>;

export function trackFunnel(event: FunnelEvent, props?: Props) {
  try {
    track(event, props);
  } catch {
    // Analytics must never break the page.
  }
}

// The chart page keeps the birth date, time and place in its URL. Analytics,
// speed and error reports get the path only.
export function stripQuery(url: string) {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}
