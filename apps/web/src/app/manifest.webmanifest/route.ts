export function GET(): Response {
  return Response.json({
    name: 'Market Intelligence OS',
    short_name: 'MIOS',
    description: 'Know what changed, understand why it matters, and be ready to discuss it.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8f9',
    theme_color: '#2f56b3',
    orientation: 'portrait-primary',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  });
}
