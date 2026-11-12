import { promises as fs } from 'fs';
import path from 'path';
import { normalizeParams, PENDANT_DEFAULTS, PARAMS, type PendantParams } from '@/config/pendant-params';

// Reads and writes src/config/pendant-defaults.json, the defaults both /chart
// and /lab start from. Writing only works on a dev machine: deployed builds
// have a read-only filesystem, and new defaults ship by committing the file.

const FILE = path.join(process.cwd(), 'src/config/pendant-defaults.json');
const canWrite = process.env.NODE_ENV !== 'production';

export const dynamic = 'force-dynamic';

async function readDefaults(): Promise<PendantParams> {
  try {
    return normalizeParams(JSON.parse(await fs.readFile(FILE, 'utf8')));
  } catch {
    return PENDANT_DEFAULTS;
  }
}

export async function GET() {
  return Response.json({ defaults: await readDefaults(), canWrite });
}

// Body: { values: Partial<PendantParams> } — only the given keys change.
export async function POST(request: Request) {
  if (!canWrite) {
    return Response.json({ error: 'Saving defaults only works in local dev (npm run dev). Commit pendant-defaults.json to ship them.' }, { status: 403 });
  }
  let body: { values?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.values || typeof body.values !== 'object') {
    return Response.json({ error: 'values object is required' }, { status: 400 });
  }
  const current = await readDefaults();
  const next = normalizeParams(body.values, current);
  // Keep the file in schema order so diffs stay readable.
  const ordered = Object.fromEntries(PARAMS.map((p) => [p.key, next[p.key]]));
  await fs.writeFile(FILE, JSON.stringify(ordered, null, 2) + '\n');
  return Response.json({ defaults: next, canWrite });
}
