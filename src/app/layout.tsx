import type { ReactNode } from 'react'
// Bootstrap base + global palette (same imports as the original main.jsx)
import 'bootstrap/dist/css/bootstrap.min.css'
import '@/index.css'
import '@/styles/custom-swal.css'
import Providers from './providers'

export const metadata = {
  title: 'Análisis Financiero',
  description: 'Sistema de análisis financiero — estados financieros, ratios y proyecciones',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
