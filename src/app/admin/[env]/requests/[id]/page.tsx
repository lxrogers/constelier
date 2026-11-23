import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { dbForEnv, isAdminEnv, siteOrigin } from '@/lib/admin/env';
import { describeDesign, designQuery } from '@/lib/commerce/design';
import { formatUSD } from '@/lib/commerce/format';
import { formatOrderNumber } from '@/lib/commerce/orders';
import { blobConfigured } from '@/lib/commerce/thumbnails';
import { formatPhone } from '@/lib/quotes/contact';
import { getQuoteRequest, QUOTE_STATUSES } from '@/lib/quotes/requests';
import { channelReady } from '@/lib/messaging/messages';
import { startOffer, updateStatus } from '../../../actions';
import { dateTime } from '../../../components/format';
import StatusSelect from '../../../components/StatusSelect';
import NotesForm from '../../../components/NotesForm';
import OfferEditor from '../../../components/OfferEditor';
import MessageThread from '../../../components/MessageThread';
import Composer from '../../../components/Composer';

// One quote request: who asked, what they designed, the offer written for
// them, and the whole conversation.
export default async function RequestPage({ params }: { params: Promise<{ env: string; id: string }> }) {
  const { env, id } = await params;
  if (!isAdminEnv(env)) notFound();
  const db = dbForEnv(env);
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getQuoteRequest(await db, id);
  if (!data) notFound();
  const { request, customer, design, offer, thread, orders } = data;

  const h = await headers();
  const here = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const site = siteOrigin(env, new Request(here));
  const offerLink = offer ? `${site}/pendant/${offer.id}` : null;
  const lastEmailSubject = [...thread].reverse().find((m) => m.channel === 'email' && m.subject)?.subject ?? '';

  return (
    <main className="admin-main">
      <p className="admin-back"><Link href={`/admin/${env}`}>&larr; All requests</Link></p>
      <header className="admin-request-head">
        <div>
          <h1>{customer.name || 'No name'}</h1>
          <p className="admin-sub">
            Asked {dateTime(request.createdAt)} · prefers {request.channel === 'sms' ? 'text' : 'email'}
          </p>
        </div>
        <StatusSelect action={updateStatus.bind(null, env, request.id)} value={request.status} options={QUOTE_STATUSES} />
      </header>

      <div className="admin-cols">
        <div className="admin-col">
          <section className="admin-section">
            <h2>Customer</h2>
            <dl className="admin-facts">
              <div><dt>Email</dt><dd>{customer.email ?? 'None'}</dd></div>
              <div><dt>Phone</dt><dd>{customer.phone ? formatPhone(customer.phone) : 'None'}</dd></div>
              {customer.phone && <div><dt>Texts</dt><dd>{customer.smsOptIn ? 'Agreed to texts' : 'Has not agreed to texts'}</dd></div>}
            </dl>
          </section>

          <section className="admin-section">
            <h2>Design</h2>
            {design ? (
              <div className="admin-design">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {design.thumbnailUrl && <img src={design.thumbnailUrl} alt="The pendant as they designed it" />}
                <div>
                  <p>{describeDesign(design.spec).subtitle}</p>
                  <p className="admin-sub">
                    {design.spec.birth.hour}:{design.spec.birth.minute.padStart(2, '0')} · {design.spec.birth.location}
                  </p>
                  <p className="admin-sub">{design.spec.aspects.join(', ')} · {design.spec.outlineStyle} outline</p>
                  <p><a href={`${site}/chart?${designQuery(design.spec)}`} target="_blank" rel="noreferrer">Open in the configurator</a></p>
                </div>
              </div>
            ) : <p className="admin-sub">No design came with this request.</p>}
          </section>

          <section className="admin-section">
            <h2>Notes</h2>
            <NotesForm env={env} requestId={request.id} notes={request.notes ?? ''} />
          </section>

          <section className="admin-section">
            <h2>Pendant page</h2>
            {offer && offerLink ? (
              <OfferEditor
                env={env}
                requestId={request.id}
                offerId={offer.id}
                content={offer.content}
                published={offer.status === 'published'}
                link={offerLink}
                previewHref={`/admin/${env}/offers/${offer.id}`}
                photosReady={blobConfigured()}
              />
            ) : (
              <form action={startOffer.bind(null, env, request.id)}>
                <p className="admin-sub">Nothing written yet. Starting one fills in their name and design.</p>
                <button type="submit" className="admin-btn">Start pendant page</button>
              </form>
            )}
          </section>

          {orders.length > 0 && (
            <section className="admin-section">
              <h2>Orders</h2>
              <ul className="admin-orders">
                {orders.map((o) => (
                  <li key={o.id}>
                    <span>{formatOrderNumber(o.number)}</span>
                    <span>{formatUSD(o.total)}</span>
                    <span>{o.status.replaceAll('_', ' ')}</span>
                    <span>{dateTime(o.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="admin-col">
          <section className="admin-section admin-messages">
            <h2>Messages</h2>
            <MessageThread messages={thread} />
            <Composer
              env={env}
              requestId={request.id}
              channels={[
                ...(customer.email ? [{ id: 'email' as const, label: 'Email', ready: channelReady('email') }] : []),
                ...(customer.phone ? [{ id: 'sms' as const, label: 'Text', ready: channelReady('sms') }] : []),
              ]}
              preferred={request.channel}
              subject={lastEmailSubject}
              offerLink={offer?.status === 'published' ? offerLink : null}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
