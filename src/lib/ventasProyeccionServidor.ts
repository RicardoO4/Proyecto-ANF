import { supabaseAdmin } from './supabase/admin'
import { obtenerPeriodosFinancieros } from './periodosFinancierosServidor'
import { origenVenta } from './origenVentas'
import { seleccionarVentasCompletas } from './ventasAnuales'
import type { VentaRow } from '@/types'

export async function obtenerVentasProyeccion(empresaId: number, periodicidad: 'anual' | 'mensual') {
  const ventas: VentaRow[] = []
  for (let inicio = 0; ; inicio += 1000) {
    const {data,error} = await supabaseAdmin.from('venta').select('*').eq('empresa_id',empresaId).order('fecha_venta').order('id_venta').range(inicio,inicio+999)
    if (error) throw error
    ventas.push(...(data ?? []) as VentaRow[])
    if ((data?.length ?? 0) < 1000) break
  }
  if (periodicidad === 'mensual') {
    return {ventas: ventas.filter(v => origenVenta(v) === 'MENSUAL_REAL'), excluidos: []}
  }
  return seleccionarVentasCompletas(ventas,await obtenerPeriodosFinancieros(empresaId))
}
