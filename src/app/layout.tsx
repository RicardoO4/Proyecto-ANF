import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
// Bootstrap base + Fey global layer (loaded in this order on purpose)
import 'bootstrap/dist/css/bootstrap.min.css'
import '@/index.css'
import '@/styles/custom-swal.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'Análisis Financiero',
  description: 'Sistema de análisis financiero — estados financieros, ratios y proyecciones',
}

export const viewport: Viewport = {
  themeColor: '#0b0b0b',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" data-bs-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
