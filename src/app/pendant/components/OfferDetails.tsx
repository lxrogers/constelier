import Link from 'next/link';
import type { PendantOffer } from '@/lib/commerce/offer';

// The fixed facts under the buy button. Placeholder copy: check each line
// against what is actually offered before launch.
export default function OfferDetails({ offer }: { offer: PendantOffer }) {
  return (
    <div className="pdp-details">
      <details open>
        <summary>What you get</summary>
        <ul>
          <li>Your pendant, cast in the metal and size you choose</li>
          <li>{offer.chain}</li>
          <li>A card with your chart and what each line means</li>
        </ul>
      </details>
      <details>
        <summary>How it is made</summary>
        <p>
          The lines in your pendant are the aspects in your birth chart. Each piece is cast to order from that
          design and finished by hand, so no two are the same.
        </p>
      </details>
      <details>
        <summary>Metals and care</summary>
        <p>
          Solid sterling silver, 10k or 14k yellow gold, never plated. Silver deepens with wear and brightens
          again with a polishing cloth; gold needs only warm water and a soft brush.
        </p>
      </details>
      <details>
        <summary>Shipping and returns</summary>
        <p>{offer.leadTime} Because each pendant is made for one chart, it cannot be returned, but anything that arrives wrong is remade.</p>
      </details>
      {offer.designQuery && (
        <p className="pdp-reopen">
          <Link href={`/chart?${offer.designQuery}`}>See your chart and reading again</Link>
        </p>
      )}
    </div>
  );
}
