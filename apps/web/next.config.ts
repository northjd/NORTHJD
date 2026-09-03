import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // A self-contained server bundle, so the image does not need node_modules and the app
  // runs on any Node host — a container, a VM, or a platform that expects `node
  // server.js`. Vercel ignores this and uses its own build, which is fine: the point is
  // that nothing here is tied to one provider.
  output: 'standalone',
  // Next 16 writes its own CLAUDE.md/AGENTS.md into the app directory. This project
  // documents its conventions in the repository root CLAUDE.md instead.
  agentRules: false,
  // Workspace packages ship TypeScript source and are compiled by Next rather than
  // pre-built. One build step, no stale dist directories.
  transpilePackages: [
    '@mios/domain',
    '@mios/database',
    '@mios/connectors',
    '@mios/intelligence',
    '@mios/ai',
    '@mios/search',
    '@mios/ranking',
    '@mios/learning',
    '@mios/evaluation',
    '@mios/ui',
    '@mios/config',
  ],
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
  experimental: {
    optimizePackageImports: ['@mios/ui'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next injects inline bootstrap scripts; 'unsafe-inline' is required for
              // them in dev and for the streaming runtime in production.
              "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default config;
