import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Constelier',
  icons: {
    icon: [
      { url: '/favicons/favicon.ico', type: 'image/x-icon' },
      { url: '/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicons/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicons/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/favicons/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav">
          <span className="logo">Constelier</span>
        </nav>
        {children}
      </body>
    </html>
  );
}
