import { parseDesign } from '@/lib/commerce/design';
import { quoteDesign } from '@/lib/commerce/pricing';

// Price for one design, shown before it goes in the bag. Checkout prices
// again on its own, so this number is never trusted.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const design = parseDesign(body?.design);
  if (!design) return Response.json({ error: 'invalid design' }, { status: 400 });
  try {
    const q = quoteDesign(design);
    return Response.json({ unitAmount: q.unitAmount, grams: Number(q.grams.toFixed(2)), metal: q.metal });
  } catch (err) {
    console.error('Quote failed:', err);
    return Response.json({ error: 'could not price this design' }, { status: 500 });
  }
}
