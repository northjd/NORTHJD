import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Market Intelligence OS',
  description:
    'Know what changed, understand why it matters, and be ready to discuss it. Evidence-grounded market intelligence, learning and conversation for consultants.',
  applicationName: 'Market Intelligence OS',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'MIOS', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1017' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
          Applies the stored theme before first paint so there is no flash. Kept inside
          <body> because the App Router manages the document head itself.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mios-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
