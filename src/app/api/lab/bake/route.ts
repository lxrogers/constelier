import { promises as fs } from 'fs';
import path from 'path';

// Receives the frames the homepage's hero bakes out of the chart engine
// (/?bake=1) and writes them under tools/blender/film, for the
// Blender film to use as the paper's drawing. Also receives the pictures of
// the hero's neighbouring pendants (/?grid=1), which go to
// public/hero/grid for the page to load, and its outlines' frames (/?outlines=1),
// which go to public/hero/outlines. Dev machines only.

const DIR = path.join(process.cwd(), 'tools/blender/film');
const GRID_DIR = path.join(process.cwd(), 'public/hero');
const canWrite = process.env.NODE_ENV !== 'production';

export const dynamic = 'force-dynamic';

// ?name=chart/f0012.png (a PNG), ?name=chart.json (the timing marks) ?name=grid/03.webp (a neighbour's picture) or ?name=outlines/02.bin (a sky's outline frames).
export async function POST(request: Request) {
  if (!canWrite) return Response.json({ error: 'Baking only works in local dev.' }, { status: 403 });
  const name = new URL(request.url).searchParams.get('name') || '';
  if (!/^(chart\/f\d{4}\.png|chart\.json|grid\/\d\d\.webp|outlines\/(\d\d\.bin|settings\.json))$/.test(name)) return Response.json({ error: 'Unexpected file name.' }, { status: 400 });
  const file = path.join(/^(grid|outlines)\//.test(name) ? GRID_DIR : DIR, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(await request.arrayBuffer()));
  return Response.json({ ok: true });
}
