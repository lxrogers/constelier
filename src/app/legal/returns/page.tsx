import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../components/LegalPage';
import Value from '../components/Value';
import { POLICY as P, FINAL_SALE_SHORT } from '../policy';

export const metadata: Metadata = { title: 'Returns and final sale' };

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns and final sale" intro={FINAL_SALE_SHORT}>
      <section>
        <h2>Why we can't take returns</h2>
        <p>
          Your pendant is drawn from the aspects in your own natal chart and cast in metal only after you
          order it. No one else's chart makes the same piece, so we can't resell it, and we don't accept
          returns or exchanges for a change of mind.
        </p>
      </section>

      <section>
        <h2>Changing your mind right after ordering</h2>
        <p>
          You can cancel for a full refund within <Value v={P.cancelWindow} /> of placing your order, as long
          as we haven't sent your design to be cast. Email <Value v={P.contactEmail} /> with your order number.
          After that, the order can't be cancelled.
        </p>
      </section>

      <section>
        <h2>If something is wrong with your piece</h2>
        <p>
          Final sale doesn't mean you're on your own. If your pendant arrives damaged, has a casting or
          finishing defect, or doesn't match the design you approved, we'll repair or remake it at no cost.
          See <Link href="/legal/warranty">Warranty and repairs</Link> for what's covered and{' '}
          <Link href="/legal/shipping">Shipping</Link> for damage in transit.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Nothing here limits any right you have under the law where you live, including refunds for items
          that are faulty or not as described.
        </p>
      </section>
    </LegalPage>
  );
}
