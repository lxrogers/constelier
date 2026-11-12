import type { Metadata } from 'next';
import LegalPage from '../components/LegalPage';
import Value from '../components/Value';
import { POLICY as P } from '../policy';

export const metadata: Metadata = { title: 'Warranty and repairs' };

export default function WarrantyPage() {
  return (
    <LegalPage
      title="Warranty and repairs"
      intro={<>Every pendant is covered against defects in casting and workmanship for <Value v={P.warrantyLength} /> from delivery.</>}
    >
      <section>
        <h2>What's covered</h2>
        <ul>
          <li>Casting flaws such as pits, porosity or cracks in the metal</li>
          <li>A bail or jump ring that comes loose or breaks in normal wear</li>
          <li>Finishing that wears through unusually fast</li>
          <li>A piece that doesn't match the design shown when you ordered</li>
        </ul>
        <p>We'll repair the piece, or recast it from your saved design if a repair won't do. You pay nothing, shipping included.</p>
      </section>

      <section>
        <h2>What isn't</h2>
        <ul>
          <li>Everyday scratches, dents and the soft patina gold gains with wear</li>
          <li>Damage from accidents, snagging, chemicals or heat</li>
          <li>Loss or theft</li>
          <li>Pieces altered or repaired by someone else</li>
          <li>Chains, unless we supplied them (<Value v={P.chainIncluded} />)</li>
        </ul>
      </section>

      <section>
        <h2>Making a claim</h2>
        <p>
          Email <Value v={P.contactEmail} /> with your order number and a few clear photos, ideally within{' '}
          <Value v={P.claimPhotosWithin} /> of noticing the problem. We'll reply with next steps and a prepaid
          insured label if we need the piece back.
        </p>
      </section>

      <section>
        <h2>After the warranty</h2>
        <p><Value v={P.postWarrantyRepairs} />.</p>
      </section>

      <section>
        <h2>Caring for gold</h2>
        <p>
          Take your pendant off to swim, shower or exercise, store it on its own so it doesn't scratch against
          other pieces, and polish it with a soft cloth. Avoid jewelry dips and ultrasonic cleaners.
        </p>
      </section>
    </LegalPage>
  );
}
