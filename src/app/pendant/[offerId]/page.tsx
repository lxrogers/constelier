import { notFound } from 'next/navigation';
import { loadOffer } from '@/lib/commerce/offers-store';
import { getDb } from '@/lib/db/client';
import OfferView from '../components/OfferView';

export default async function PendantOfferPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const db = await getDb()?.catch(() => null);
  const offer = await loadOffer(db ?? null, offerId);
  if (!offer) notFound();
  return <OfferView offer={offer} />;
}
