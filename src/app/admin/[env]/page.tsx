import Link from 'next/link';
import { dbForEnv, isAdminEnv } from '@/lib/admin/env';
import { quoteStatus, type QuoteStatus } from '@/lib/db/schema';
import { describeDesign } from '@/lib/commerce/design';
import { formatPhone } from '@/lib/quotes/contact';
import { countByStatus, listQuoteRequests, QUOTE_STATUSES } from '@/lib/quotes/requests';
import { shortDate } from '../components/format';

// Every quote request, newest first.
export default async function RequestsPage({ params, searchParams }: {
  params: Promise<{ env: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { env } = await params;
  const { status } = await searchParams;
  if (!isAdminEnv(env)) return null;
  const db = dbForEnv(env);
  if (!db) {
    return <main className="admin-main"><h1>Quote requests</h1><p className="admin-empty">No database is connected for this environment.</p></main>;
  }
  const handle = await db;
  const filter = (quoteStatus.enumValues as string[]).includes(status ?? '') ? status as QuoteStatus : undefined;
  const [rows, counts] = await Promise.all([listQuoteRequests(handle, filter), countByStatus(handle)]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <main className="admin-main">
      <h1>Quote requests</h1>
      <nav className="admin-filters" aria-label="Filter by status">
        <Link href={`/admin/${env}`} className={!filter ? 'on' : ''}>All <span>{total}</span></Link>
        {QUOTE_STATUSES.map((s) => (
          <Link key={s.id} href={`/admin/${env}?status=${s.id}`} className={filter === s.id ? 'on' : ''}>
            {s.label} <span>{counts[s.id] ?? 0}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="admin-empty">{filter ? 'Nothing with this status.' : 'No quote requests yet.'}</p>
      ) : (
        <ul className="admin-requests">
          {rows.map(({ request, customer, spec, thumbnailUrl, lastMessage }) => (
            <li key={request.id}>
              <Link href={`/admin/${env}/requests/${request.id}`} className="admin-request">
                <span className="admin-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbnailUrl && <img src={thumbnailUrl} alt="" loading="lazy" />}
                </span>
                <span className="admin-request-who">
                  <strong>{customer.name || 'No name'}</strong>
                  <span>{customer.email ?? (customer.phone ? formatPhone(customer.phone) : '')}</span>
                </span>
                <span className="admin-request-what">
                  <span>{spec ? describeDesign(spec).subtitle : 'No design'}</span>
                  <span className="admin-request-last">
                    {lastMessage ? `${lastMessage.direction === 'in' ? 'They wrote' : 'You wrote'}: ${lastMessage.body.slice(0, 80)}` : 'No messages yet'}
                  </span>
                </span>
                <span className={`admin-status is-${request.status}`}>
                  {QUOTE_STATUSES.find((s) => s.id === request.status)?.label}
                </span>
                <time className="admin-request-when" dateTime={request.createdAt.toISOString()}>{shortDate(request.createdAt)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
