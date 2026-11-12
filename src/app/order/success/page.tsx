import type { Metadata } from 'next';
import Link from 'next/link';
import { fulfillCheckout } from '@/lib/commerce/fulfillment';
import { formatUSD } from '@/lib/commerce/format';
import { formatOrderNumber } from '@/lib/commerce/orders';
import ClearBag from './ClearBag';
import '../../bag/bag.css';

export const metadata: Metadata = { title: 'Order confirmed · Constelier' };
export const dynamic = 'force-dynamic';

export default async function OrderSuccessPage({ searchParams }: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  if (!session_id || !session_id.startsWith('cs_')) return <Missing />;

  let result;
  try {
    result = await fulfillCheckout(session_id, { source: 'success_page', onRecordError: 'log' });
  } catch (err) {
    console.error('Order lookup failed:', err);
    return <Missing />;
  }
  const { session, fulfilled, order } = result;
  const orderNumber = order && order.status !== 'skipped' ? formatOrderNumber(order.number) : null;
  const shipping = session.collected_information?.shipping_details;
  const addr = shipping?.address;
  const items = session.line_items?.data ?? [];

  return (
    <main className="shop-page">
      <ClearBag />
      <div className="shop-card">
        <h1 className="shop-title">{fulfilled ? 'Thank you, your order is in' : 'Your order is processing'}</h1>
        {orderNumber && <p className="order-label">Order {orderNumber}</p>}
        <p className="order-lead">
          {fulfilled
            ? `We’ve emailed a receipt to ${session.customer_details?.email ?? 'you'}. Your pendant will be cast to order and ships within 3 weeks.`
            : 'Your payment is still being confirmed. We’ll email you as soon as it clears.'}
        </p>

        <div className="bag-summary">
          {items.map((li) => (
            <div key={li.id} className="bag-row">
              <span>{li.description}{(li.quantity ?? 1) > 1 ? ` × ${li.quantity}` : ''}</span>
              <span>{formatUSD(li.amount_subtotal)}</span>
            </div>
          ))}
          <div className="bag-row bag-row-muted">
            <span>Shipping</span>
            {/* Before tax: the Tax row already includes any tax on shipping. */}
            <span>{session.shipping_cost?.amount_subtotal ? formatUSD(session.shipping_cost.amount_subtotal) : 'Free'}</span>
          </div>
          <div className="bag-row bag-row-muted">
            <span>Tax</span>
            <span>{formatUSD(session.total_details?.amount_tax ?? 0)}</span>
          </div>
          {(session.total_details?.amount_discount ?? 0) > 0 && (
            <div className="bag-row bag-row-muted">
              <span>Discount</span>
              <span>−{formatUSD(session.total_details!.amount_discount)}</span>
            </div>
          )}
          <div className="bag-row bag-row-total">
            <span>Total</span>
            <span>{formatUSD(session.amount_total ?? 0)}</span>
          </div>
        </div>

        {addr && (
          <div>
            <p className="order-label">Shipping to</p>
            <p className="order-address">
              {[shipping?.name, addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.postal_code}`]
                .filter(Boolean).join('\n')}
            </p>
          </div>
        )}

        <Link href="/chart" className="shop-btn">Back to Constelier</Link>
      </div>
    </main>
  );
}

function Missing() {
  return (
    <main className="shop-page">
      <div className="shop-card">
        <h1 className="shop-title">Order not found</h1>
        <p className="order-lead">We couldn’t find that order. If you were charged, your receipt email has the details.</p>
        <Link href="/chart" className="shop-btn">Back to Constelier</Link>
      </div>
    </main>
  );
}
