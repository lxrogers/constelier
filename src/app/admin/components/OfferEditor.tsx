'use client';

import { useActionState, useState } from 'react';
import type { OfferContent } from '@/lib/commerce/offer';
import { removeOfferImage, saveOffer, type FormState } from '../actions';
import PhotoUploader from './PhotoUploader';

const SIZE_ROWS = 4;
const dollars = (cents: number | undefined) => (cents ? String(cents / 100) : '');

// Writes one customer's pendant page: the note, the sizes, a price for each
// metal at each size, and the photos.
export default function OfferEditor({ env, requestId, offerId, content, published, link, previewHref, photosReady }: {
  env: string;
  requestId: string;
  offerId: string;
  content: OfferContent;
  published: boolean;
  link: string;
  previewHref: string;
  photosReady: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveOffer.bind(null, env, requestId, offerId), {});
  const [copied, setCopied] = useState(false);
  const rows = Array.from({ length: SIZE_ROWS }, (_, i) => content.sizes[i] ?? null);

  return (
    <div className="admin-offer">
      <p className="admin-offer-state">
        <span className={`admin-status is-${published ? 'paid' : 'new'}`}>{published ? 'Published' : 'Draft'}</span>
        <a href={previewHref} target="_blank" rel="noreferrer">Preview</a>
        {published && (
          <button
            type="button" className="admin-link"
            onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => {})}
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        )}
      </p>

      <form action={action} className="admin-form">
        <div className="admin-pair">
          <label>First name<input name="firstName" defaultValue={content.firstName} maxLength={60} /></label>
          <label>Title<input name="title" defaultValue={content.title} maxLength={120} /></label>
        </div>
        <label>Line under the title<input name="subtitle" defaultValue={content.subtitle} maxLength={160} /></label>
        <label>
          Your note <span className="admin-hint">A blank line starts a new paragraph. {'{name}'} becomes their first name.</span>
          <textarea name="note" rows={5} defaultValue={content.note.paragraphs.join('\n\n')} />
        </label>
        <label className="admin-narrow">Signed<input name="noteFrom" defaultValue={content.note.from} maxLength={60} /></label>

        <table className="admin-prices">
          <thead>
            <tr>
              <th scope="col">Size (mm)</th>
              <th scope="col">Line under the size</th>
              {content.metals.map((m) => <th key={m.id} scope="col">{m.short} ($)</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((size, i) => (
              <tr key={i}>
                <td><input name={`size_mm_${i}`} type="number" min={8} max={50} step={0.5} defaultValue={size?.mm ?? ''} placeholder="mm" aria-label={`Size ${i + 1} in millimetres`} /></td>
                <td><input name={`size_blurb_${i}`} defaultValue={size?.blurb ?? ''} maxLength={120} placeholder="Line under the size" aria-label={`Line under size ${i + 1}`} /></td>
                {content.metals.map((m) => (
                  <td key={m.id}>
                    <input
                      name={`price_${m.id}_${i}`} inputMode="decimal" placeholder={`${m.short} $`}
                      defaultValue={size ? dollars(content.prices[m.id]?.[size.mm]) : ''}
                      aria-label={`${m.short} price for size ${i + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <label>Chain<input name="chain" defaultValue={content.chain} maxLength={300} /></label>
        <label>Lead time<input name="leadTime" defaultValue={content.leadTime} maxLength={300} /></label>

        {state.error && <p className="admin-error" role="alert">{state.error}</p>}
        <div className="admin-form-foot">
          <button type="submit" name="intent" value="save" className="admin-btn is-quiet" disabled={pending}>Save</button>
          {published
            ? <button type="submit" name="intent" value="unpublish" className="admin-link" disabled={pending}>Take down</button>
            : <button type="submit" name="intent" value="publish" className="admin-btn" disabled={pending}>Save and publish</button>}
          {state.ok && !pending && <span className="admin-ok">{state.ok}</span>}
        </div>
      </form>

      <div className="admin-photos">
        <h3>Photos</h3>
        {content.images.length === 0 && (
          <p className="admin-sub">None yet. Until there are, the page shows the snapshot from their design.</p>
        )}
        <ul>
          {content.images.map((img) => (
            <li key={img.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt} />
              <span>{[img.tone, img.mm ? `${img.mm} mm` : null].filter(Boolean).join(' · ') || 'Any metal and size'}</span>
              <form action={removeOfferImage.bind(null, env, requestId, offerId, img.src)}>
                <button type="submit" className="admin-link">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        {photosReady
          ? <PhotoUploader env={env} requestId={requestId} offerId={offerId} sizes={content.sizes.map((s) => s.mm)} />
          : <p className="admin-sub">Photos need the Blob store, which is not connected here.</p>}
      </div>
    </div>
  );
}
