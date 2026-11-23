/** Unidades compartidas por la interfaz y el asistente; sin dependencias del servidor. */
export type UnidadRatio = 'veces' | 'porcentaje' | 'dias'

export const INFO_CATEGORIA: Record<string, { unidad: UnidadRatio; menorEsMejor: boolean }> = {
  'Razón de circulante o liquidez corriente': { unidad: 'veces', menorEsMejor: false },
  'Razón de efectivo': { unidad: 'veces', menorEsMejor: false },
  'Razón de capital de trabajo': { unidad: 'porcentaje', menorEsMejor: false },
  'Prueba ácida': { unidad: 'veces', menorEsMejor: false },
  'Grado de endeudamiento': { unidad: 'porcentaje', menorEsMejor: true },
  'Grado de propiedad': { unidad: 'porcentaje', menorEsMejor: false },
  'Razón de endeudamiento patrimonial': { unidad: 'veces', menorEsMejor: true },
  'Razón de cobertura de intereses': { unidad: 'veces', menorEsMejor: false },
  'Razón de rotación de cuentas por cobrar': { unidad: 'veces', menorEsMejor: false },
  'Período medio de cobranza': { unidad: 'dias', menorEsMejor: true },
  'Índice de rotación de activos totales': { unidad: 'veces', menorEsMejor: false },
  'Índice de rotación de activos fijos': { unidad: 'veces', menorEsMejor: false },
  'Índice de margen bruto': { unidad: 'porcentaje', menorEsMejor: false },
  'Índice de margen operativo': { unidad: 'porcentaje', menorEsMejor: false },
  'Índice de margen neto': { unidad: 'porcentaje', menorEsMejor: false },
  'Rendimiento sobre activos (ROA)': { unidad: 'porcentaje', menorEsMejor: false },
  'Rendimiento sobre capital contable (ROE)': { unidad: 'porcentaje', menorEsMejor: false },
  'Análisis DuPont': { unidad: 'porcentaje', menorEsMejor: false },
  'Razón de rotación de inventarios': { unidad: 'veces', menorEsMejor: false },
  'Edad promedio del inventario': { unidad: 'dias', menorEsMejor: true },
  'Período medio de pago': { unidad: 'dias', menorEsMejor: false },
  'Ciclo operativo': { unidad: 'dias', menorEsMejor: true },
  'Ciclo de conversión de efectivo': { unidad: 'dias', menorEsMejor: true },
}
