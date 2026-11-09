// POST /api/v1/estados-financieros/upload — multipart file upload.
// Stores the original file in Supabase Storage (bucket excel-uploads) and
// parses it with the same rules as the original POI parser.
import { NextResponse } from 'next/server'
import { BadRequestException, handle, NotFoundException } from '@/lib/errors'
import { archiveUpload, parseEstadoFinanciero } from '@/lib/excel'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recalcularRatios } from '@/lib/ratios'

export async function POST(req: Request) {
  return handle(req, async () => {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      throw new BadRequestException('El archivo de Excel es obligatorio.')
    }

    const buffer = await file.arrayBuffer()
    const parsed = parseEstadoFinanciero(buffer)

    // archive the raw workbook (best-effort, never blocks the import)
    await archiveUpload(file, 'estados-financieros')

    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', parsed.empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    // resolve cuenta by cue_cuenta_id
    const codigos = parsed.lineas.map((l) => l.codigoCuenta)
    const { data: cuentas } = await supabaseAdmin
      .from('cuenta')
      .select('cuenta_id, cue_cuenta_id')
      .in('cue_cuenta_id', codigos.length ? codigos : ['__none__'])
    if (!cuentas || cuentas.length === 0) {
      throw new NotFoundException(
        `No se encontró una cuenta con el código: ${parsed.lineas[0].codigoCuenta}`,
      )
    }
    const byCodigo = new Map(cuentas.map((c) => [c.cue_cuenta_id as string, c.cuenta_id as number]))
    for (const linea of parsed.lineas) {
      if (!byCodigo.has(linea.codigoCuenta)) {
        throw new NotFoundException(
          `No se encontró una cuenta con el código: ${linea.codigoCuenta}`,
        )
      }
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

    const rows = parsed.lineas.map((l) => ({
      id_estado_financiero: (ef as { id_estado_financiero: number }).id_estado_financiero,
      cuenta_id: byCodigo.get(l.codigoCuenta)!,
      saldo: Number(l.saldo.toFixed(2)),
    }))
    const { error: leError } = await supabaseAdmin
      .from('linea_estado_financiero')
      .insert(rows as unknown as Record<string, unknown>[])
    if (leError) throw leError

    // AU1 — recálculo silencioso de los ratios ya registrados para esta
    // empresa y año. La carga no debe fallar porque un ratio no tenga datos
    // suficientes (p. ej. rentabilidad sin Estado de Resultados cargado).
    try {
      await recalcularRatios(parsed.empresaId, parsed.anio)
    } catch (err) {
      // Silencioso para el cliente: la carga ya se completó y el ratio queda
      // pendiente para el próximo recálculo. El log evita que el fallo
      // desaparezca sin rastro.
      console.error('[AU1] no se pudieron recalcular los ratios:', err)
    }

    return new NextResponse(null, { status: 201 })
  })
}
