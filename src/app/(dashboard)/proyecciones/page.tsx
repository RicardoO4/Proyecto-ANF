'use client'

import { redirect } from 'next/navigation'

// <Route path="/proyecciones" element={<Navigate to="/proyecciones/cargar" replace />} />
export default function ProyeccionesPage() {
  redirect('/proyecciones/cargar')
}
