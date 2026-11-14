import { useEffect } from 'react';

// Phones: where the part of the page you can still see is while the
// on-screen keyboard is up, as CSS variables on <html>, so a bottom sheet
// can be pinned right above the keyboard:
//   --vv-top     top of the visible area, in fixed-position coordinates
//   --vv-height  its height
// and the class `keyboard-open` while a field is focused and the keyboard
// covers part of the screen.
//
// Phone browsers don't resize the page for the keyboard; they slide the
// visible area over it, each by their own rules (Chrome and Safari differ).
// Pinning to the visual viewport, rather than reacting to the page's
// scroll, works the same in both and can't fight the browser's own scroll.
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    // The visible height with no field focused (so no keyboard). Comparing
    // against it still works in a browser that also shrinks the page itself
    // for the keyboard, where innerHeight would shrink along with it.
    let fullHeight = vv.height;
    const update = () => {
      frame = 0;
      const typing = document.activeElement instanceof HTMLInputElement;
      if (!typing) fullHeight = vv.height;
      const covered = Math.max(window.innerHeight, fullHeight) - vv.height;
      const open = covered > 80 && typing;
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
      root.classList.toggle('keyboard-open', open);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // The first time the keyboard opens, some browsers (Chrome on iPhone)
    // report it late or only as a window resize, so look again a few times
    // while it slides up.
    let timers: number[] = [];
    const onFocusIn = () => {
      schedule();
      timers.forEach(clearTimeout);
      timers = [100, 250, 450, 700, 1000].map(ms => window.setTimeout(schedule, ms));
    };
    window.addEventListener('resize', schedule);
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('scroll', schedule);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('resize', schedule);
      timers.forEach(clearTimeout);
      document.removeEventListener('focusout', schedule);
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--vv-top');
      root.style.removeProperty('--vv-height');
    };
  }, []);
}
