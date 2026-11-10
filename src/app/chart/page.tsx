import NatalChart, { type ChartTheme } from './NatalChart';

const THEMES: ChartTheme[] = ['night', 'paper', 'mono'];
const STEPS = ['birth', 'reading', 'shape', 'reserve'] as const;

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const theme = THEMES.includes(sp.theme as ChartTheme) ? (sp.theme as ChartTheme) : 'paper';
  const step = STEPS.includes(sp.step as (typeof STEPS)[number]) ? (sp.step as (typeof STEPS)[number]) : 'birth';
  const home = typeof sp.from === 'string' && /^[a-z]+$/.test(sp.from) ? `/${sp.from}` : '/';
  return <NatalChart theme={theme} initialStep={step} homeHref={home} />;
}
