import { notFound } from 'next/navigation';
import { dbForEnv, isAdminEnv } from '@/lib/admin/env';
import { loadOffer } from '@/lib/commerce/offers-store';
import OfferView from '@/app/pendant/components/OfferView';

// The pendant page as the customer will see it, drafts included. Buying is
// switched off here.
export default async function OfferPreviewPage({ params }: { params: Promise<{ env: string; id: string }> }) {
  const { env, id } = await params;
  if (!isAdminEnv(env)) notFound();
  const db = dbForEnv(env);
  const offer = db ? await loadOffer(await db, id, { allowDraft: true }) : null;
  if (!offer || offer.id === 'sample') notFound();
  return (
    <div className="theme-root theme-paper shop-shell pdp-shell admin-preview">
      <p className="admin-preview-bar">Preview. This is what the customer sees.</p>
      <OfferView offer={offer} preview />
    </div>
  );
}
