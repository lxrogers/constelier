import { LAST_UPDATED } from '../policy';

// Shared frame for one policy page: title, date, then the sections.
export default function LegalPage({ title, intro, children }: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="legal-article">
      <header className="legal-header">
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated {LAST_UPDATED}</p>
        {intro && <p className="legal-intro">{intro}</p>}
      </header>
      {children}
    </article>
  );
}
