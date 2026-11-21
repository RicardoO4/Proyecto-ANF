import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, parametroDTO } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

type ParametroInput = {
  empresaId?: number
  costoPedido?: number
  tasaMantenimiento?: number
  leadTimeDias?: number
  diasAnio?: number
  corteA?: number
  corteB?: number
}

function validar(body: ParametroInput) {
  const empresaId = leerEmpresaId(body.empresaId)
  const costoPedido = Number(body.costoPedido)
  const tasaMantenimiento = Number(body.tasaMantenimiento)
  const leadTimeDias = Number(body.leadTimeDias)
  const diasAnio = Number(body.diasAnio ?? 365)
  const corteA = Number(body.corteA ?? 0.8)
  const corteB = Number(body.corteB ?? 0.95)

  if (!Number.isFinite(costoPedido) || costoPedido < 0) {
    throw new ValidationException('costoPedido: Debe ser mayor o igual a cero')
  }
  if (!Number.isFinite(tasaMantenimiento) || tasaMantenimiento < 0) {
    throw new ValidationException('tasaMantenimiento: Debe ser mayor o igual a cero')
  }
  if (!Number.isInteger(leadTimeDias) || leadTimeDias < 0) {
    throw new ValidationException('leadTimeDias: Debe ser un entero mayor o igual a cero')
  }
  if (!Number.isInteger(diasAnio) || diasAnio <= 0) {
    throw new ValidationException('diasAnio: Debe ser un entero positivo')
  }
  if (!(corteA > 0 && corteA < corteB && corteB <= 1)) {
    throw new ValidationException('corteA/corteB: Debe cumplir 0 < corteA < corteB <= 1')
  }

  return {
    empresa_id: empresaId,
    costo_pedido: costoPedido,
    tasa_mantenimiento: tasaMantenimiento,
    lead_time_dias: leadTimeDias,
    dias_anio: diasAnio,
    corte_a: corteA,
    corte_b: corteB,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data, error } = await supabaseAdmin
      .from('parametro_inventario')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json(data ? parametroDTO(data) : null)
  })
}

export async function PUT(req: Request) {
  return handle(req, async () => {
    const valores = validar((await req.json()) as ParametroInput)
    const { data, error } = await supabaseAdmin
      .from('parametro_inventario')
      .upsert(valores, { onConflict: 'empresa_id' })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(parametroDTO(data))
  })
}
