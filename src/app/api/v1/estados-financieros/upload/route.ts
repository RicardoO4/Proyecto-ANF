// POST /api/v1/estados-financieros/upload — multipart file upload.
// Stores the original file in Supabase Storage (bucket excel-uploads).
//
// Three workbook layouts are accepted:
//  - Trial balance: metadata (tipo BALANCE_COMPROBACION) + 'lineas'. It is
//    converted to BALANCE_GENERAL + ESTADO_RESULTADOS and saved like the
//    unified one.
//  - Unified (Módulo A, A1): sheets metadata + balance + resultados. Saves
//    BALANCE_GENERAL, ESTADO_RESULTADOS and the year's venta in a single
//    transaction (RPC cargar_estados_financieros, migration 005).
//  - Single statement (original): metadata + 'lineas' of one tipoReporte.
// Form field `reemplazar=true` overwrites an already loaded year.
import { NextResponse } from 'next/server'
import type * as XLSX from 'xlsx'
import {
  BadRequestException,
  BusinessRuleException,
  NotFoundException,
  ValidationException,
  handle,
} from '@/lib/errors'
import {
  archiveUpload,
  esBalanzaComprobacion,
  esCargaUnificada,
  parseBalanzaComprobacion,
  parseCargaUnificada,
  parseEstadoFinanciero,
  readWorkbook,
  resumirCarga,
  type UploadedCargaUnificada,
} from '@/lib/excel'
import { clasificarCuenta, esTipoReporte, TIPO_REPORTE } from '@/lib/accountCodes'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recalcularRatios } from '@/lib/ratios'

export async function POST(req: Request) {
  return handle(req, async () => {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      throw new BadRequestException('El archivo de Excel es obligatorio.')
    }
    const reemplazar = formData.get('reemplazar') === 'true'

    const wb = readWorkbook(await file.arrayBuffer())
    if (esBalanzaComprobacion(wb)) {
      return cargaUnificada(parseBalanzaComprobacion(wb), 'BALANZA_COMPROBACION', file, reemplazar)
    }
    return esCargaUnificada(wb)
      ? cargaUnificada(parseCargaUnificada(wb), 'UNIFICADO', file, reemplazar)
      : cargaEstadoIndividual(wb, file, reemplazar)
  })
}

/** Resolves cue_cuenta_id → cuenta_id; reports every unknown code at once. */
async function resolverCuentas(codigos: string[]): Promise<Map<string, number>> {
  const unicos = [...new Set(codigos)]
  const { data, error } = await supabaseAdmin
    .from('cuenta')
    .select('cuenta_id, cue_cuenta_id')
    .in('cue_cuenta_id', unicos.length ? unicos : ['__none__'])
  if (error) throw error
  const byCodigo = new Map(
    (data ?? []).map((c) => [c.cue_cuenta_id as string, c.cuenta_id as number]),
  )
  const faltantes = unicos.filter((c) => !byCodigo.has(c))
  if (faltantes.length > 0) {
    throw new ValidationException(
      `${faltantes.length} código(s) no existen en el catálogo de cuentas.`,
      faltantes.slice(0, 50).map(
        (c) =>
          `No se encontró la cuenta ${c}.` +
          (/^\d+\.\d$/.test(c)
            ? ' Si la celda es numérica, Excel pudo quitar un cero final: formatee la columna de códigos como texto.'
            : ''),
      ),
    )
  }
  return byCodigo
}

/** AU1 (Módulo C): silent recalculation; anio + 1 also uses this year as its previous one. */
async function recalcularSilencioso(empresaId: number, anio: number): Promise<void> {
  await Promise.all(
    [anio, anio + 1].map((year) =>
      recalcularRatios(empresaId, year).catch((err) => {
        console.error(`[AU1] no se pudieron recalcular los ratios de ${year}:`, err)
      }),
    ),
  )
}

async function cargaUnificada(
  parsed: UploadedCargaUnificada,
  formato: 'UNIFICADO' | 'BALANZA_COMPROBACION',
  file: File,
  reemplazar: boolean,
) {
  const empresa = await getEmpresaPrincipal()
  if (parsed.empresaId !== null && parsed.empresaId !== empresa.empresaId) {
    throw new BadRequestException(
      `El archivo indica la empresa ${parsed.empresaId}, pero el sistema trabaja con ${empresa.nombreEmpresa} (id ${empresa.empresaId}).`,
    )
  }

  const byCodigo = await resolverCuentas(
    [...parsed.balance, ...parsed.resultados].map((l) => l.codigoCuenta),
  )
  await archiveUpload(file, 'estados-financieros')

  const resumen = resumirCarga(parsed.balance, parsed.resultados)
  const avisos = [...parsed.avisos]
  const venta = resumen.ventasNetas > 0 ? Math.round(resumen.ventasNetas * 100) / 100 : null
  if (venta === null) {
    avisos.push('Las ventas netas (5101.01 − 5101.02) son cero: no se registró la venta del año.')
  }

  const toRows = (lineas: typeof parsed.balance) =>
    lineas.map((l) => ({ cuentaId: byCodigo.get(l.codigoCuenta)!, saldo: l.saldo }))
  const { data, error } = await supabaseAdmin.rpc('cargar_estados_financieros', {
    p_empresa_id: empresa.empresaId,
    p_anio: parsed.anio,
    p_balance: toRows(parsed.balance),
    p_resultados: toRows(parsed.resultados),
    p_venta: venta,
    p_reemplazar: reemplazar,
  })
  if (error) {
    if (error.code === 'ANF01') {
      throw new BusinessRuleException(
        `Ya existen estados financieros de ${parsed.anio} para ${empresa.nombreEmpresa}. Confirme si desea reemplazarlos.`,
      )
    }
    if (error.code === 'PGRST202') {
      throw new BusinessRuleException(
        'Falta aplicar la migración 005_carga_unificada.sql en Supabase.',
      )
    }
    throw error
  }

  await recalcularSilencioso(empresa.empresaId, parsed.anio)

  const resultado = data as { idBalance: number; idResultados: number; reemplazado: boolean }
  return NextResponse.json(
    {
      formato,
      empresaId: empresa.empresaId,
      nombreEmpresa: empresa.nombreEmpresa,
      anio: parsed.anio,
      reemplazado: resultado.reemplazado,
      idBalance: resultado.idBalance,
      idResultados: resultado.idResultados,
      lineasBalance: parsed.balance.length,
      lineasResultados: parsed.resultados.length,
      ...resumen,
      ventaRegistrada: venta,
      avisos,
    },
    { status: 201 },
  )
}

async function cargaEstadoIndividual(wb: XLSX.WorkBook, file: File, reemplazar: boolean) {
  const parsed = parseEstadoFinanciero(wb)

  // A2: only the two report types the analysis engine reads
  if (!esTipoReporte(parsed.tipoReporte)) {
    throw new BadRequestException(
      `El tipo de reporte '${parsed.tipoReporte}' no es válido. Use ${TIPO_REPORTE.BALANCE} o ${TIPO_REPORTE.RESULTADOS}.`,
    )
  }
  const fueraDeTipo = parsed.lineas.filter(
    (l) => clasificarCuenta(l.codigoCuenta) !== parsed.tipoReporte,
  )
  if (fueraDeTipo.length > 0) {
    throw new ValidationException(
      `${fueraDeTipo.length} cuenta(s) no pertenecen al ${parsed.tipoReporte}.`,
      fueraDeTipo.slice(0, 50).map((l) => `La cuenta ${l.codigoCuenta} no pertenece a este estado.`),
    )
  }

  const { data: empresa } = await supabaseAdmin
    .from('empresa')
    .select('empresa_id')
    .eq('empresa_id', parsed.empresaId)
    .maybeSingle()
  if (!empresa) throw new NotFoundException('Empresa no encontrada')

  const byCodigo = await resolverCuentas(parsed.lineas.map((l) => l.codigoCuenta))

  // A3: one statement per empresa + año + tipo
  const { data: existente, error: dupError } = await supabaseAdmin
    .from('estado_financiero')
    .select('id_estado_financiero')
    .eq('empresa_id', parsed.empresaId)
    .eq('anio', parsed.anio)
    .eq('tipo_reporte', parsed.tipoReporte)
    .maybeSingle()
  if (dupError) throw dupError
  if (existente && !reemplazar) {
    throw new BusinessRuleException(
      `Ya existe un ${parsed.tipoReporte} de ${parsed.anio} para esta empresa. Confirme si desea reemplazarlo.`,
    )
  }

  await archiveUpload(file, 'estados-financieros')

  if (existente) {
    const { error } = await supabaseAdmin
      .from('estado_financiero')
      .delete()
      .eq('id_estado_financiero', (existente as { id_estado_financiero: number }).id_estado_financiero)
    if (error) throw error
  }

  const { data: ef, error } = await supabaseAdmin
    .from('estado_financiero')
    .insert({
      anio: parsed.anio,
      tipo_reporte: parsed.tipoReporte,
      empresa_id: parsed.empresaId,
    })
    .select('id_estado_financiero')
    .single()
  if (error) throw error
  const idEstado = (ef as { id_estado_financiero: number }).id_estado_financiero

  const rows = parsed.lineas.map((l) => ({
    id_estado_financiero: idEstado,
    cuenta_id: byCodigo.get(l.codigoCuenta)!,
    saldo: Number(l.saldo.toFixed(2)),
  }))
  const { error: leError } = await supabaseAdmin
    .from('linea_estado_financiero')
    .insert(rows as unknown as Record<string, unknown>[])
  if (leError) {
    // no transaction here: drop the header so the year is not left empty
    await supabaseAdmin.from('estado_financiero').delete().eq('id_estado_financiero', idEstado)
    throw leError
  }

  await recalcularSilencioso(parsed.empresaId, parsed.anio)

  return NextResponse.json(
    {
      formato: 'INDIVIDUAL',
      empresaId: parsed.empresaId,
      anio: parsed.anio,
      tipoReporte: parsed.tipoReporte,
      reemplazado: Boolean(existente),
      lineas: rows.length,
      avisos: [],
    },
    { status: 201 },
  )
}
