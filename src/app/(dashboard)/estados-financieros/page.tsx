import { redirect } from 'next/navigation'

// <Route path="/estados-financieros" element={<Navigate to="/estados-financieros/cargar" replace />} />
export default function EstadosFinancierosPage() {
  redirect('/estados-financieros/cargar')
}
