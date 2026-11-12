import type { Metadata } from 'next';
import LegalPage from '../components/LegalPage';
import Value from '../components/Value';
import { POLICY as P } from '../policy';

export const metadata: Metadata = { title: 'Accessibility' };

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="Accessibility"
      intro="We want everyone to be able to design and buy a pendant on Constelier, and we're working toward the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA."
    >
      <section>
        <h2>Where we are</h2>
        <ul>
          <li><Value v={P.accessibilityToday} />.</li>
          <li>Checkout runs on Stripe, which publishes its own accessibility commitments.</li>
          <li>The 3D pendant and the chart wheel are visual. <Value v={P.accessibilityPlan} /></li>
        </ul>
      </section>

      <section>
        <h2>If something gets in your way</h2>
        <p>
          Email <Value v={P.contactEmail} /> and tell us what happened. We'll help you place your order another
          way, and we'll fix the problem.
        </p>
      </section>
    </LegalPage>
  );
}
