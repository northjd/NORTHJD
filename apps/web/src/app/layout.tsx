import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  /*
   * Feed autodiscovery. A browser or reader handed the site URL finds the feed itself;
   * without this, subscribing means knowing the path exists.
   */
  alternates: { types: { 'application/atom+xml': `${process.env.BASE_PATH ?? ''}/feed.xml` } },
  title: { default: 'NORTH', template: '%s · NORTH' },
  description:
    'Know what changed. Understand what matters. Be ready for what’s next. Evidence-grounded market intelligence, learning and conversation.',
  applicationName: 'NORTH',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'NORTH', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
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
