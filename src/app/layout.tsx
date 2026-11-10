import type { Metadata, Viewport } from 'next';
import SiteAnalytics from '@/components/SiteAnalytics';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.constelier.com'),
  title: 'Constelier',
  description: 'Generate a custom gold pendant from the planetary aspects in your natal chart.',
  openGraph: {
    title: 'Constelier',
    description: 'Generate a custom gold pendant from the planetary aspects in your natal chart.',
    url: 'https://www.constelier.com',
    siteName: 'Constelier',
    images: [
      {
        url: '/favicons/favicon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Constelier',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Constelier',
    description: 'Generate a custom gold pendant from the planetary aspects in your natal chart.',
    images: ['/favicons/favicon-512x512.png'],
  },
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07080d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
