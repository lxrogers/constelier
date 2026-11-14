import { useEffect } from 'react';

// Phones: how much of the page the on-screen keyboard covers, as CSS
// variables on <html>, so a bottom sheet can sit right above it.
//   --kb-inset   distance from the visible bottom to the page's bottom
//   --vv-height  height of what is still visible
// and the class `keyboard-open` while it is up.
//
// iPhone Safari doesn't resize the page for the keyboard; it slides the
// visible area over it, and not always far enough to show a field near
// the bottom. The visual viewport says where the visible area really is.
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Bottom of the page in the visible area's coordinates, minus where
      // the visible area ends.
      const pageBottom = window.innerHeight - window.scrollY;
      const inset = Math.max(0, Math.round(pageBottom - (vv.offsetTop + vv.height)));
      const open = inset > 80 && document.activeElement instanceof HTMLInputElement;
      root.style.setProperty('--kb-inset', open ? `${inset}px` : '0px');
      root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
      root.classList.toggle('keyboard-open', open);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('scroll', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--kb-inset');
      root.style.removeProperty('--vv-height');
    };
  }, []);
}
