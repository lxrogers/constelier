'use client';

// "Design yours": on the homepage the configurator is the same page in a
// different layout, so this changes the address without navigating
// (NatalChart follows the path). Opening in a new tab still goes to /chart.

const DESIGN_PATH = '/chart';

export default function DesignLink({ className, style, children }: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={DESIGN_PATH}
      className={className}
      style={style}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.history.pushState(null, '', DESIGN_PATH);
      }}
    >
      {children}
    </a>
  );
}
