import { LogoMark } from '@/components/Logo';

// A band of phrases that drifts sideways forever. Decorative: the same
// words appear elsewhere on the page, so it is hidden from screen readers.
export default function Ticker({ items }: { items: string[] }) {
  const run = (
    <div className="stu-ticker-run">
      {[...items, ...items].map((t, i) => (
        <span key={i}><LogoMark size={18} />{t}</span>
      ))}
    </div>
  );
  return (
    <div className="stu-ticker" aria-hidden="true">
      {run}
      {run}
    </div>
  );
}
