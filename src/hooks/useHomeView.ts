'use client';

// One page, two layouts. The homepage hero and the configurator share the
// same live chart (one canvas, one engine), so going from one to the other is
// a layout change, not a navigation: the address changes with pushState and
// the chart glides from its place in the hero to its place on the stage.
//
// The layouts themselves are plain CSS keyed off `data-view` on the root.
// This hook decides which one is showing (from the path) and animates the
// switch: the chart ([data-glide]) with a FLIP, the parts that leave by fading out where
// they stood. Parts that arrive animate in with CSS.

import { useCallback, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export type HomeView = 'home' | 'cfg';

const MOVE_MS = 1100;
const MOVE_EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';
const LEAVE_MS = 420;

// Where a leaving part drifts as it fades (data-leave on the element).
const DRIFT: Record<string, string> = {
  left: 'translateX(-32px)',
  right: 'translateX(40px)',
  up: 'translateY(-12px)',
};

const inViewport = (r: DOMRect) => r.bottom > 0 && r.top < window.innerHeight && r.width > 0;

export function useHomeView(enabled: boolean, designPath = '/chart') {
  const pathname = usePathname();
  // The path this was mounted on is "home" (/ and /atelier both serve it).
  const homePath = useRef(pathname);
  const view: HomeView = enabled && pathname === homePath.current ? 'home' : 'cfg';
  const rootRef = useRef<HTMLDivElement>(null);
  const shown = useRef(view);

  useLayoutEffect(() => {
    const from = shown.current;
    const root = rootRef.current;
    if (from === view || !root) return;
    shown.current = view;

    const frame = root.querySelector<HTMLElement>('[data-glide]');
    if (!frame || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (view === 'cfg') window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    // React has already switched data-view. Put the old layout back for a
    // moment (nothing paints in between) to see where everything was.
    root.dataset.view = from;
    const first = frame.getBoundingClientRect();
    const leaving = Array.from(root.querySelectorAll<HTMLElement>('[data-leave]'))
      .map((el) => ({ el, rect: el.getBoundingClientRect(), display: getComputedStyle(el).display }))
      .filter((g) => g.display !== 'none' && inViewport(g.rect));
    root.dataset.view = view;
    if (view === 'cfg') window.scrollTo({ top: 0, behavior: 'instant' });
    const last = frame.getBoundingClientRect();

    if (inViewport(first)) {
      const dx = first.left + first.width / 2 - (last.left + last.width / 2);
      const dy = first.top + first.height / 2 - (last.top + last.height / 2);
      frame.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${first.width / last.width})` },
          { transform: 'translate(0, 0) scale(1)' },
        ],
        { duration: MOVE_MS, easing: MOVE_EASE },
      );
    } else {
      // Started further down the page: nothing to glide from, so fade in.
      root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' });
    }

    for (const { el, rect, display } of leaving) {
      // Hold it where it stood while it fades; the new layout hides it.
      const hold: Partial<CSSStyleDeclaration> = {
        display, position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', pointerEvents: 'none',
      };
      Object.assign(el.style, hold);
      const release = () => { for (const k of Object.keys(hold)) el.style[k as 'display'] = ''; };
      const anim = el.animate(
        [
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
          { opacity: 0, transform: DRIFT[el.dataset.leave || ''] || 'none', filter: 'blur(6px)' },
        ],
        { duration: LEAVE_MS, easing: 'ease-in' },
      );
      anim.onfinish = release;
      anim.oncancel = release;
    }
  }, [view]);

  // Next keeps usePathname in step with pushState, so these re-render us.
  const goDesign = useCallback(() => window.history.pushState(null, '', designPath), [designPath]);
  const goHome = useCallback(() => window.history.pushState(null, '', homePath.current), []);
  const isHome = useCallback(() => enabled && window.location.pathname === homePath.current, [enabled]);

  return { view, rootRef, goDesign, goHome, isHome };
}
