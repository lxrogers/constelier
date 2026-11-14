import { LEGAL_DRAFT, type PolicyValue } from '../policy';

// Renders a policy value. While the pages are drafts, undecided values show
// as [label] and suggested ones are highlighted so they're easy to find.
export default function Value({ v }: { v: PolicyValue }) {
  if (typeof v === 'string') return <>{v}</>;
  if (v.kind === 'fill') {
    return <mark className="legal-fill" title="Fill this in">[{v.text}]</mark>;
  }
  if (!LEGAL_DRAFT) return <>{v.text}</>;
  return <mark className="legal-confirm" title="Suggested: confirm or change">{v.text}</mark>;
}
