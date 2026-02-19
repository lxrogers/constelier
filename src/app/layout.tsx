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
          <span className="logo">
            <svg className="logo-icon" width="30" height="30" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
              <polygon points="50,2 57,40 50,50 43,40" fill="currentColor"/>
              <polygon points="98,50 60,57 50,50 60,43" fill="currentColor"/>
              <polygon points="50,98 43,60 50,50 57,60" fill="currentColor"/>
              <polygon points="2,50 40,43 50,50 40,57" fill="currentColor"/>
              <polygon points="55,38 76,24 62,45 50,50" fill="currentColor"/>
              <polygon points="62,55 76,76 55,62 50,50" fill="currentColor"/>
              <polygon points="45,62 24,76 38,55 50,50" fill="currentColor"/>
              <polygon points="38,45 24,24 45,38 50,50" fill="currentColor"/>
            </svg>
            Constelier
          </span>
        </nav>
        {children}
      </body>
    </html>
  );
}
