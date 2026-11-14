import ShopNav from '@/components/ShopNav';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-root theme-paper shop-shell">
      <ShopNav />
      {children}
    </div>
  );
}
