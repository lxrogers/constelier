// Price ranges shown on the configurator's last step, before a quote is
// requested. Placeholders: set real numbers before launch.

export interface QuoteRange {
  id: 'silver' | 'gold10' | 'gold14';
  name: string;
  lowCents: number;
  highCents: number;
}

export const QUOTE_RANGES: QuoteRange[] = [
  { id: 'silver', name: 'Sterling silver', lowCents: 16000, highCents: 24000 },
  { id: 'gold10', name: '10k gold', lowCents: 45000, highCents: 70000 },
  { id: 'gold14', name: '14k gold', lowCents: 60000, highCents: 95000 },
];
