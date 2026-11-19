import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda, Instrument_Serif } from 'next/font/google';
import SiteAnalytics from '@/components/SiteAnalytics';
import '@/styles/globals.css';

// Wordmark face: Bodoni Moda (variable, with optical size). globals.css sets
// the weight, optical size and tracking for .wordmark and the chart nav logo.
const wordmarkFont = Bodoni_Moda({ subsets: ['latin'], axes: ['opsz'], variable: '--f-wordmark', display: 'swap' });
// Headline face (--serif in globals.css). It has one weight.
const serifFont = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--f-serif', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.constelier.com'),
  title: 'CONSTELIER',
  description: 'Generate a custom gold pendant from the planetary aspects in your natal chart.',
  openGraph: {
    title: 'CONSTELIER',
    description: 'Generate a custom gold pendant from the planetary aspects in your natal chart.',
    url: 'https://www.constelier.com',
    siteName: 'CONSTELIER',
    images: [
      {
        url: '/favicons/favicon-512x512.png',
        width: 512,
        height: 512,
        alt: 'CONSTELIER',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CONSTELIER',
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
    <html lang="en" className={`${wordmarkFont.variable} ${serifFont.variable}`}>
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
