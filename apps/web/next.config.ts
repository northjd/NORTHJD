import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Opt-in, because `next start` refuses to serve a standalone build and silently
  // breaks local development if this is always on. The Dockerfile sets the flag; Vercel
  // needs neither, since it builds its own bundle.
  output: process.env.STATIC_EXPORT
    ? 'export'
    : process.env.BUILD_STANDALONE
      ? 'standalone'
      : undefined,
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
