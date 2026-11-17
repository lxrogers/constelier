import { notFound } from 'next/navigation';
import { getOffer } from '@/lib/commerce/offer';
import OfferView from '../components/OfferView';

export default async function PendantOfferPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const offer = getOffer(offerId);
  if (!offer) notFound();
  return <OfferView offer={offer} />;
}
