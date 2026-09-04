// Static: the manifest never varies by request, and a static export requires this.
export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json({
    name: 'NORTH',
    short_name: 'NORTH',
    description: 'Know what changed, understand why it matters, and be ready to discuss it.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8f9',
    theme_color: '#2f56b3',
    orientation: 'portrait-primary',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  });
}
