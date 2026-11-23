export interface DatosEquilibrio {
  unidadesEquilibrio: number;
  ventasEquilibrio: number;
  datosGrafico: {
    unidades: number;
    ventasTotales: number;
    costosTotales: number;
    costosFijos: number;
  }[];
}

export function calcularPuntoEquilibrio(
  costosFijos: number,
  precioVenta: number,
  costoVariable: number
): DatosEquilibrio | null {
  if (
    ![costosFijos, precioVenta, costoVariable].every(Number.isFinite) ||
    costosFijos < 0 ||
    costoVariable < 0 ||
    precioVenta <= costoVariable ||
    precioVenta <= 0
  ) {
    return null;
  }

  const margenContribucion = precioVenta - costoVariable;
  const unidadesEquilibrioExactas = costosFijos / margenContribucion;
  const ventasEquilibrioExactas = unidadesEquilibrioExactas * precioVenta;

  const limiteMaximo = Math.max(1, unidadesEquilibrioExactas * 2);

  // Generar puntos de muestreo base (0%, 20%, 40%, 60%, 80%, 100%, 120%, 140%, 160%, 180%, 200%)
  const puntosUnidadesSet = new Set<number>();
  
  for (let i = 0; i <= 10; i++) {
    const q = Number((i * (limiteMaximo / 10)).toFixed(2));
    puntosUnidadesSet.add(q);
  }

  // Asegurar que el punto de equilibrio exacto esté incluido en la curva
  const qEqRedondeado = Number(unidadesEquilibrioExactas.toFixed(2));
  puntosUnidadesSet.add(qEqRedondeado);

  // Ordenar los puntos de unidades de menor a mayor
  const puntosOrdenados = Array.from(puntosUnidadesSet).sort((a, b) => a - b);

  // Construir la estructura de datos del gráfico manteniendo coherencia estricta en cada fila
  const datosGrafico = puntosOrdenados.map((q) => {
    const ventas = q * precioVenta;
    const costosTot = costosFijos + q * costoVariable;

    return {
      unidades: q,
      ventasTotales: Number(ventas.toFixed(2)),
      costosTotales: Number(costosTot.toFixed(2)),
      costosFijos: Number(costosFijos.toFixed(2)),
    };
  });

  return {
    unidadesEquilibrio: qEqRedondeado,
    ventasEquilibrio: Number(ventasEquilibrioExactas.toFixed(2)),
    datosGrafico,
  };
}