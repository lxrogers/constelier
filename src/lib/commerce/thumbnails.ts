import 'server-only';

// The bag's 320 px JPEG snapshot of the pendant, sent as a data URL.
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_BYTES = 300_000;

export function parseThumbnail(input: unknown): { bytes: Buffer; type: string; ext: string } | null {
  if (typeof input !== 'string' || input.length > MAX_BYTES * 1.4) return null;
  const m = DATA_URL.exec(input);
  if (!m) return null;
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
  return { bytes, type: `image/${m[1]}`, ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// Stores a design thumbnail in Vercel Blob and returns its URL. The random
// suffix keeps the URL unguessable from the design id.
export async function storeThumbnail(designId: string, thumb: { bytes: Buffer; type: string; ext: string }) {
  const { put } = await import('@vercel/blob');
  const blob = await put(`designs/${designId}.${thumb.ext}`, thumb.bytes, {
    access: 'public',
    contentType: thumb.type,
    addRandomSuffix: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return blob.url;
}
