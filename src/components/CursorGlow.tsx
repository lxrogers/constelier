'use client';

// A crisp gold dot with a soft halo that trails the pointer. Desktop only
// (fine pointers); the native cursor stays, so nothing is hidden or hijacked.

import { useEffect, useRef } from 'react';

export default function CursorGlow() {
  const dot = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let x = -100, y = -100, hx = -100, hy = -100, raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (hx < -50) { hx = x; hy = y; document.documentElement.classList.add('has-cursor-glow'); }
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const over = (e.target as Element)?.closest?.('a, button, input, label');
      document.documentElement.classList.toggle('cursor-hot', !!over);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      hx += (x - hx) * 0.14; hy += (y - hy) * 0.14;
      if (halo.current) halo.current.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
      raf = Math.abs(x - hx) + Math.abs(y - hy) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('has-cursor-glow', 'cursor-hot');
    };
  }, []);
  return (
    <>
      <div ref={halo} className="cursor-halo" aria-hidden="true" />
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
