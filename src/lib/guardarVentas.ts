import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, BusinessRuleException } from '@/lib/errors'
import { validarVentasMensuales } from '@/lib/ventasMensuales'

export async function guardarVentasMensuales(empresaId: number, entrada: unknown, id: number | null = null) {
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new BadRequestException('Empresa inválida.')
  const ventas = validarVentasMensuales(entrada)
  const { error } = await supabaseAdmin.rpc('guardar_ventas_mensuales', { p_empresa_id: empresaId, p_ventas: ventas, p_id: id })
  if (error?.code === 'PGRST202') throw new BusinessRuleException('Falta ejecutar 011_ventas_mensuales.sql en Supabase. No se guardaron ventas.')
  if (error?.code === 'ANF02') throw new BadRequestException(error.message)
  if (error) throw error
}
