import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/admin',
    name: 'LEELA JEWELLERS ADMIN',
    short_name: 'LEELA ADMIN',
    description: 'LEELA JEWELLERS owner dashboard and shop management app.',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f3ea',
    theme_color: '#c9a227',
    icons: [
      {
        src: '/admin-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/admin-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
