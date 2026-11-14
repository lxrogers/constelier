import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

// Moving between steps changes the model's box at once (on a phone it goes
// from full width to the top third). Call `capture()` just before the
// change: when `key` changes, the container is drawn back where the model
// was and eases to where it now is. The canvases resize only once, at the
// start, rather than on every frame of the move.
//
// `container` holds `target`; only the container is transformed, so the
// target's own transform (the chart engine's zoom) is left alone.
export function useGlide(
  container: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
  key: unknown,
  ms = 700,
) {
  const before = useRef<{ x: number; y: number; w: number } | null>(null);

  // Where the target's layout box is, ignoring any transform on it.
  const measure = useCallback(() => {
    const c = container.current, t = target.current;
    if (!c || !t || !t.offsetWidth) return null;
    const r = c.getBoundingClientRect();
    const left = t.offsetParent === c ? t.offsetLeft : t.offsetLeft - c.offsetLeft;
    const top = t.offsetParent === c ? t.offsetTop : t.offsetTop - c.offsetTop;
    return { x: r.left + left + t.offsetWidth / 2, y: r.top + top + t.offsetHeight / 2, w: t.offsetWidth, cx: left + t.offsetWidth / 2, cy: top + t.offsetHeight / 2 };
  }, [container, target]);

  const capture = useCallback(() => {
    const c = container.current;
    if (c) { c.style.transition = ''; c.style.transform = ''; }
    const m = measure();
    before.current = m && { x: m.x, y: m.y, w: m.w };
  }, [container, measure]);

  useLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    const c = container.current;
    const to = measure();
    if (!from || !c || !to) return;
    const dx = from.x - to.x, dy = from.y - to.y, k = from.w / to.w;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(k - 1) < 0.01) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    c.style.transformOrigin = `${to.cx}px ${to.cy}px`;
    c.style.transition = 'none';
    c.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
    void c.offsetWidth; // start from there
    c.style.transition = `transform ${ms}ms cubic-bezier(.22,.7,.2,1)`;
    c.style.transform = '';
    // Tidy up afterwards (by timer too: a hidden tab never ends transitions).
    const tidy = () => {
      c.style.transition = '';
      c.style.transformOrigin = '';
      c.removeEventListener('transitionend', done);
    };
    const done = (e: TransitionEvent) => { if (e.target === c) tidy(); };
    c.addEventListener('transitionend', done);
    const timer = window.setTimeout(tidy, ms + 100);
    return () => { window.clearTimeout(timer); c.removeEventListener('transitionend', done); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return capture;
}
