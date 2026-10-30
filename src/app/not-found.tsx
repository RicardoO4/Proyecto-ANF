// <Route path="*" element={<h1>404 - Página no encontrada</h1>} />
// Covers the dead links of the original app too (/empresas/nuevo, /usuarios/nuevo,
// /analisis/externo, /analisis/evolucion-cuentas).
export default function NotFound() {
  return <h1>404 - Página no encontrada</h1>
}
