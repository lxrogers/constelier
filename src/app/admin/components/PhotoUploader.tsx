'use client';

import { useActionState, useState } from 'react';
import { addOfferImage, type FormState } from '../actions';

// Adds one render to a pendant page. The picture's size is read here, in the
// browser, so the page can lay it out before it loads.
export default function PhotoUploader({ env, requestId, offerId, sizes }: {
  env: string; requestId: string; offerId: string; sizes: number[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addOfferImage.bind(null, env, requestId, offerId), {});
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [problem, setProblem] = useState('');

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setDims(null);
    setProblem('');
    if (!file) return;
    if (file.size > 4_000_000) return setProblem('That image is over 4 MB. Export it smaller.');
    try {
      const bitmap = await createImageBitmap(file);
      setDims({ width: bitmap.width, height: bitmap.height });
      bitmap.close();
    } catch {
      setProblem('Could not read that image.');
    }
  }

  return (
    <form action={action} className="admin-form admin-uploader">
      <input type="file" name="file" accept="image/webp,image/jpeg,image/png" required onChange={onPick} aria-label="Photo" />
      <input type="hidden" name="width" value={dims?.width ?? ''} />
      <input type="hidden" name="height" value={dims?.height ?? ''} />
      <div className="admin-pair">
        <label>Metal
          <select name="tone" defaultValue="">
            <option value="">Any</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
          </select>
        </label>
        <label>Size
          <select name="mm" defaultValue="">
            <option value="">Any</option>
            {sizes.map((mm) => <option key={mm} value={mm}>{mm} mm</option>)}
          </select>
        </label>
      </div>
      <label>Description<input name="alt" placeholder="The pendant on its chain" maxLength={160} /></label>
      {(problem || state.error) && <p className="admin-error" role="alert">{problem || state.error}</p>}
      <div className="admin-form-foot">
        <button type="submit" className="admin-btn is-quiet" disabled={pending || !dims}>{pending ? 'Adding…' : 'Add photo'}</button>
        {state.ok && !pending && <span className="admin-ok">{state.ok}</span>}
      </div>
    </form>
  );
}
