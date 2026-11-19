// Faces to try on the homepage with the dev-only font bar (components/FontBar).
// The first of each list is the site's own face. The rest load from Google
// Fonts when picked; `google` is the family part of a css2 URL.

export type FontOption = { name: string; stack: string; google?: string };

export const HEADLINE_FONTS: FontOption[] = [
  { name: 'Instrument Serif (current)', stack: "var(--f-serif), 'Times New Roman', serif" },
  { name: 'Fraunces', stack: "'Fraunces', serif", google: 'Fraunces:opsz,wght@9..144,300..500' },
  { name: 'Bodoni Moda', stack: "'Bodoni Moda', serif", google: 'Bodoni+Moda:opsz,wght@6..96,400..500' },
  { name: 'DM Serif Display', stack: "'DM Serif Display', serif", google: 'DM+Serif+Display' },
  { name: 'Cormorant Garamond', stack: "'Cormorant Garamond', serif", google: 'Cormorant+Garamond:wght@300..500' },
];

export const BODY_FONTS: FontOption[] = [
  { name: 'Graphik (current)', stack: "'Graphik Web', system-ui, -apple-system, sans-serif" },
  { name: 'Manrope', stack: "'Manrope', sans-serif", google: 'Manrope:wght@300..500' },
  { name: 'Jost', stack: "'Jost', sans-serif", google: 'Jost:wght@300..500' },
  { name: 'Outfit', stack: "'Outfit', sans-serif", google: 'Outfit:wght@300..500' },
  { name: 'DM Sans', stack: "'DM Sans', sans-serif", google: 'DM+Sans:opsz,wght@9..40,300..500' },
  { name: 'Plus Jakarta Sans', stack: "'Plus Jakarta Sans', sans-serif", google: 'Plus+Jakarta+Sans:wght@300..500' },
];
