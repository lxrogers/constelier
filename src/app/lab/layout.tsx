import ShopNav from '@/components/ShopNav';

// The lab keeps the light "paper" look it was built with; the root layout
// is dark and no longer draws a header.
export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-root theme-paper shop-shell">
      <ShopNav />
      {children}
    </div>
  );
}
