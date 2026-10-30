// Excel parsing for uploads — faithful port of the Apache POI logic.
//
// Estado financiero template layout (sheet 'metadata'):
//   B3 -> empresaId (numeric), B4 -> anio (numeric), B5 -> tipoReporte (string)
// (POI read rows 2/3/4 zero-based = Excel rows 3/4/5.)
// Sheet 'lineas': row 1 = header; col A = cuenta code (string or numeric),
// col B = saldo (numeric).
//
// Ventas template layout (sheet 'metadata'): B2 -> empresaId (numeric)
// (POI read row 1 zero-based = Excel row 2). Sheet 'ventas': row 1 = header;
// col A = fecha (date), col B = monto, col C = observación.
import * as XLSX from 'xlsx'
import { BadRequestException } from '@/lib/errors'

export interface UploadedEstadoFinanciero {
  empresaId: number
  anio: number
  tipoReporte: string
  lineas: { codigoCuenta: string; saldo: number }[]
}

export interface UploadedVentas {
  empresaId: number
  ventas: { fechaVenta: Date; montoVenta: number; observacion: string | null }[]
}

function getWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  try {
    return XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  } catch (err) {
    throw new BadRequestException(
      'El archivo debe ser un Excel válido (.xlsx).',
    )
  }
}

function requireSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet {
  const sheet = wb.Sheets[name]
  if (!sheet) {
    throw new BadRequestException(`La hoja '${name}' es obligatoria.`)
  }
  return sheet
}

function cell(wbSheet: XLSX.WorkSheet, address: string): XLSX.CellObject | undefined {
  return wbSheet[address] as XLSX.CellObject | undefined
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/** Parses the estado financiero workbook exactly like EstadoFinancieroService. */
export function parseEstadoFinanciero(buffer: ArrayBuffer): UploadedEstadoFinanciero {
  let wb: XLSX.WorkBook
  try {
    wb = getWorkbook(buffer)
  } catch (err) {
    throw err
  }

  const metadata = requireSheet(wb, 'metadata')

  const empresaIdRaw = asNumber(cell(metadata, 'B3')?.v)
  if (empresaIdRaw === null) {
    throw new BadRequestException(
      "El 'empresaId' no se encontró o tiene un formato incorrecto en la celda B3 de la hoja 'metadata'.",
    )
  }
  const anioRaw = asNumber(cell(metadata, 'B4')?.v)
  if (anioRaw === null) {
    throw new BadRequestException(
      "El 'anio' no se encontró o tiene un formato incorrecto en la celda B4 de la hoja 'metadata'.",
    )
  }
  const tipoRaw = cell(metadata, 'B5')?.v
  const tipoReporte =
    typeof tipoRaw === 'string' && tipoRaw.trim() !== ''
      ? tipoRaw.trim()
      : typeof tipoRaw === 'number'
        ? String(tipoRaw)
        : null
  if (!tipoReporte) {
    throw new BadRequestException(
      "El 'tipoReporte' no se encontró o tiene un formato incorrecto en la celda B5 de la hoja 'metadata'.",
    )
  }

  const lineasSheet = requireSheet(wb, 'lineas')
  const rows: { codigoCuenta: string; saldo: number }[] = []
  const range = XLSX.utils.decode_range(lineasSheet['!ref'] ?? 'A1')
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    // skip the header row (r == range.s.r)
    const codeCell = lineasSheet[XLSX.utils.encode_cell({ r, c: 0 })]
    const saldoCell = lineasSheet[XLSX.utils.encode_cell({ r, c: 1 })]

    // col A: string used as-is; numeric converted via trunc; anything else skipped
    let codigo: string | null = null
    if (typeof codeCell?.v === 'string') {
      codigo = (codeCell.v as string).trim()
    } else if (typeof codeCell?.v === 'number' && Number.isFinite(codeCell.v)) {
      codigo = String(Math.trunc(codeCell.v as number))
    }
    if (!codigo) continue

    const saldo =
      typeof saldoCell?.v === 'number' && Number.isFinite(saldoCell.v)
        ? (saldoCell.v as number)
        : null
    if (saldo === null) continue // col B must be numeric

    rows.push({ codigoCuenta: codigo, saldo })
  }

  if (rows.length === 0) {
    throw new BadRequestException("La hoja 'lineas' no contiene datos válidos.")
  }

  return { empresaId: Math.trunc(empresaIdRaw), anio: Math.trunc(anioRaw), tipoReporte, lineas: rows }
}

/** Parses the ventas workbook exactly like ProyeccionService. */
export function parseVentas(buffer: ArrayBuffer): UploadedVentas {
  const wb = getWorkbook(buffer)
  const metadata = requireSheet(wb, 'metadata')

  const empresaIdRaw = asNumber(cell(metadata, 'B2')?.v)
  if (empresaIdRaw === null) {
    throw new BadRequestException(
      "El 'empresaId' no se encontró o tiene un formato incorrecto en la celda B2 de la hoja 'metadata'.",
    )
  }

  const ventasSheet = requireSheet(wb, 'ventas')
  const ventas: UploadedVentas['ventas'] = []
  const range = XLSX.utils.decode_range(ventasSheet['!ref'] ?? 'A1')
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const fechaCell = ventasSheet[XLSX.utils.encode_cell({ r, c: 0 })]
    const montoCell = ventasSheet[XLSX.utils.encode_cell({ r, c: 1 })]
    const obsCell = ventasSheet[XLSX.utils.encode_cell({ r, c: 2 })]

    // col A must be a date
    let fecha: Date | null = null
    if (fechaCell?.v instanceof Date) {
      fecha = fechaCell.v
    } else if (typeof fechaCell?.v === 'string' && fechaCell.v.trim() !== '') {
      const parsed = new Date(fechaCell.v)
      if (!Number.isNaN(parsed.getTime())) fecha = parsed
    }
    if (!fecha) continue

    const monto =
      typeof montoCell?.v === 'number' && Number.isFinite(montoCell.v)
        ? (montoCell.v as number)
        : null
    if (monto === null) continue // non-numeric rows are skipped silently

    const observacion =
      typeof obsCell?.v === 'string' && (obsCell.v as string).trim() !== ''
        ? (obsCell.v as string).trim()
        : null

    ventas.push({ fechaVenta: fecha, montoVenta: monto, observacion })
  }

  if (ventas.length === 0) {
    throw new BadRequestException(
      "La hoja 'ventas' no contiene datos válidos o está vacía.",
    )
  }

  return { empresaId: Math.trunc(empresaIdRaw), ventas }
}

/**
 * Uploads the raw file for record-keeping into the excel-uploads bucket.
 * Best-effort: a storage failure never blocks the import itself.
 */
export async function archiveUpload(
  file: File,
  folder: string,
): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${folder}/${Date.now()}-${safeName}`
    const buffer = await file.arrayBuffer()
    const { error } = await supabaseAdmin.storage
      .from('excel-uploads')
      .upload(path, new Uint8Array(buffer), {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      })
    if (error) {
      console.error('[storage] archiveUpload failed:', error.message)
      return null
    }
    return path
  } catch (err) {
    console.error('[storage] archiveUpload failed:', err)
    return null
  }
}
