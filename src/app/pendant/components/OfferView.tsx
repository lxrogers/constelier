'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { bag, formatUSD } from '@/hooks/useBag';
import { trackFunnel } from '@/lib/analytics';
import type { PendantDesign } from '@/lib/commerce/design';
import {
  OFFER_PREVIEW_KEY, SAMPLE_OFFER_ID, offerImages,
  type MetalId, type OfferImage, type OfferPreview, type PendantOffer,
} from '@/lib/commerce/offer';
import { useNatalFigure } from '@/hooks/useNatalFigure';
import OfferGallery, { type GallerySlide } from './OfferGallery';
import NatalChartFigure from './NatalChartFigure';
import MakerNote from './MakerNote';
import MetalPicker from './MetalPicker';
import SizePicker from './SizePicker';
import OfferDetails from './OfferDetails';
import '../pendant.css';

// One customer's pendant page: photos, a note, metal and size, the price
// and Add to bag. Everything shown comes from the offer.
export default function OfferView({ offer: base }: { offer: PendantOffer }) {
  const { offer, ownDesign, ownThumbnail } = useSampleWithPreview(base);
  const [metalId, setMetalId] = useState<MetalId>(offer.metals[0].id);
  const [mm, setMm] = useState(offer.sizes[0].mm);
  const router = useRouter();
  const [bagState, setBagState] = useState<'idle' | 'adding' | 'error'>('idle');
  const [bagError, setBagError] = useState('');

  const metal = offer.metals.find((m) => m.id === metalId) ?? offer.metals[0];
  const price = offer.prices[metal.id][mm];
  const { images, standIn } = useMemo(() => offerImages(offer, metal.tone, mm), [offer, metal.tone, mm]);

  const figure = useNatalFigure(offer.birth, offer.aspects);

  // Photos, with the flat natal chart as the second slide.
  const slides = useMemo(() => {
    const out: GallerySlide[] = images.map((img) => ({
      key: img.src.slice(-60),
      node: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.src} alt={img.alt} width={img.width} height={img.height}
            className={`${img.width === img.height ? 'is-square' : ''}${standIn ? ' is-stand-in' : ''}`}
            decoding="async" draggable={false}
          />
          {standIn && <span className="pdp-stand-in">Stand-in render</span>}
        </>
      ),
    }));
    if (figure) {
      out.splice(Math.min(1, out.length), 0, {
        key: 'natal-chart',
        node: <NatalChartFigure figure={figure} caption={offer.subtitle} />,
      });
    }
    return out;
  }, [images, standIn, figure, offer.subtitle]);

  async function addToBag() {
    if (bagState === 'adding') return;
    setBagState('adding');
    try {
      // Loaded on demand: building a design pulls in the astronomy code.
      const { designForOffer } = await import('@/lib/commerce/offer-design');
      const design = designForOffer(offer, mm, ownDesign);
      if (!design) throw new Error('This pendant is not ready to order yet.');
      bag.add({
        design,
        title: 'Aspect Pendant',
        subtitle: `${offer.subtitle} · ${metal.short} · ${mm} mm`,
        thumbnail: ownThumbnail ?? images[0]?.src ?? null,
        unitAmount: price,
        offer: { offerId: offer.id, metal: metal.id, mm },
      });
      trackFunnel('added_to_bag', { price });
      // Straight on to the bag, where checkout starts.
      router.push('/bag');
    } catch (err) {
      setBagError((err as Error).message);
      setBagState('error');
    }
  }

  const bagButton = (
    <button type="button" className="pdp-checkout" onClick={addToBag} disabled={bagState === 'adding'}>
      {bagState === 'adding' ? 'Adding…' : 'Add to bag'}
    </button>
  );

  return (
    <main className="pdp">
      <div className="pdp-grid">
        <OfferGallery slides={slides} />

        <div className="pdp-info">
          <header className="pdp-head">
            <p className="pdp-eyebrow">Made for {offer.firstName || 'you'}</p>
            <h1 className="pdp-title">{offer.title}</h1>
            <p className="pdp-subtitle">{offer.subtitle}</p>
          </header>

          <MakerNote from={offer.note.from} paragraphs={offer.note.paragraphs} firstName={offer.firstName} />

          <MetalPicker
            metals={offer.metals}
            selected={metal.id}
            onSelect={setMetalId}
          />
          <SizePicker
            sizes={offer.sizes}
            selected={mm}
            onSelect={setMm}
          />

          <div className="pdp-buy">
            <div className="pdp-price-row">
              <span className="pdp-price">{formatUSD(price)}</span>
              <span className="pdp-price-what">{metal.name} · {mm} mm · chain included</span>
            </div>
            {bagButton}
            {bagState === 'error' && <p className="pdp-error" role="alert">{bagError}</p>}
            <p className="pdp-lead">{offer.leadTime}</p>
          </div>

          <OfferDetails offer={offer} />
        </div>
      </div>

      {/* Phones: the price and Add to bag stay in reach while scrolling. */}
      <div className="pdp-bar">
        <div className="pdp-bar-text">
          <span className="pdp-bar-price">{formatUSD(price)}</span>
          <span className="pdp-bar-what">{metal.short} · {mm} mm</span>
        </div>
        {bagButton}
      </div>
    </main>
  );
}

// Prototype: the sample offer takes the name and the pendant from the quote
// request just made in this tab, so the flow can be tried end to end.
function useSampleWithPreview(offer: PendantOffer): {
  offer: PendantOffer; ownDesign: PendantDesign | null; ownThumbnail: string | null;
} {
  const [preview, setPreview] = useState<OfferPreview | null>(null);
  useEffect(() => {
    if (offer.id !== SAMPLE_OFFER_ID) return;
    try {
      const raw = sessionStorage.getItem(OFFER_PREVIEW_KEY);
      if (raw) setPreview(JSON.parse(raw));
    } catch {
      // No stored preview: show the sample as written.
    }
  }, [offer.id]);

  const merged = useMemo(() => {
    if (!preview) return offer;
    const own: OfferImage[] = preview.thumbnail
      ? [{ src: preview.thumbnail, alt: 'Your pendant, as you designed it', width: 600, height: 600 }]
      : [];
    return {
      ...offer,
      firstName: preview.firstName || offer.firstName,
      subtitle: preview.subtitle || offer.subtitle,
      designQuery: preview.designQuery || offer.designQuery,
      birth: preview.birth ?? offer.birth,
      aspects: preview.aspects ?? offer.aspects,
      images: [...own, ...offer.images],
    };
  }, [offer, preview]);
  return { offer: merged, ownDesign: preview?.design ?? null, ownThumbnail: preview?.thumbnail ?? null };
}
