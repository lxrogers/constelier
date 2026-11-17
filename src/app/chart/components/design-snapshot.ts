import type { PendantDesign } from '@/lib/commerce/design';

export interface DesignSnapshot { design: PendantDesign; thumbnail: string | null }

// Asks the chart engine (which owns the canvas) for the current design.
// Null while the pendant is still being built, or when no aspect is on.
export function requestSnapshot(canvas: HTMLCanvasElement | null): DesignSnapshot | null {
  let result: DesignSnapshot | null = null;
  canvas?.dispatchEvent(new CustomEvent('design-snapshot', { detail: { respond: (s: DesignSnapshot | null) => { result = s; } } }));
  return result;
}
