import type { Metadata } from 'next';
import LegalPage from '../components/LegalPage';
import Value from '../components/Value';
import { POLICY as P } from '../policy';

export const metadata: Metadata = { title: 'Shipping' };

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping"
      intro={<>Every pendant is cast to order and ships within <Value v={P.productionTime} /> of your order. Delivery time starts once it ships.</>}
    >
      <section>
        <h2>Where we ship</h2>
        <p>We currently ship to <Value v={P.shipsTo} /> only.</p>
      </section>

      <section>
        <h2>Options and cost</h2>
        <ul>
          <li><strong>Standard:</strong> <Value v={P.standardShipping} />.</li>
          <li><strong>Express:</strong> <Value v={P.expressShipping} />.</li>
        </ul>
        <p>
          We ship with <Value v={P.carrier} />. Sales tax on shipping is added at checkout where your state
          charges it.
        </p>
      </section>

      <section>
        <h2>How it's made, and how long it takes</h2>
        <p>
          After you order, we check your design, send it to <Value v={P.caster} />, then finish and polish it
          by hand. That takes up to <Value v={P.productionTime} />. If anything will make your piece
          late, we'll tell you as soon as we know and give you the option to cancel for a full refund.
        </p>
      </section>

      <section>
        <h2>Signature and packaging</h2>
        <p>
          Orders over <Value v={P.signatureThreshold} /> need a signature on delivery. Every order is fully
          insured until it's delivered and arrives in <Value v={P.packaging} />.
        </p>
      </section>

      <section>
        <h2>Damaged, lost or late packages</h2>
        <ul>
          <li>
            If your package arrives damaged, email us photos of the box and the piece within{' '}
            <Value v={P.damageReportDays} /> of delivery and we'll repair or replace it.
          </li>
          <li>If tracking stops moving for <Value v={P.trackingStallDays} />, tell us and we'll open a claim with the carrier.</li>
          <li>Marked delivered but not there: <Value v={P.lostPackageRule} />.</li>
        </ul>
      </section>

      <section>
        <h2>Addresses</h2>
        <p>
          Please check your address at checkout. If it's wrong, email <Value v={P.contactEmail} /> before your
          piece ships and we'll update it. Once it ships, we can only ask the carrier to redirect it.
        </p>
      </section>
    </LegalPage>
  );
}
