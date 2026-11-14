'use client';

// Adds .in to its element once it scrolls into view, so sections can
// blur-and-rise in with native scrolling (never scroll-jacked).

import { useEffect, useRef } from 'react';

export default function InView({
  as: Tag = 'div', className, children, style,
}: {
  as?: keyof React.JSX.IntrinsicElements; className?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const T = Tag as React.ElementType;
  return <T ref={ref} className={`inview ${className || ''}`} style={style}>{children}</T>;
}
