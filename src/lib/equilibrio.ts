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
  if (![costosFijos, precioVenta, costoVariable].every(Number.isFinite) || costosFijos < 0 || costoVariable < 0 || precioVenta <= costoVariable || precioVenta <= 0) {
    return null; 
  }

  const margenContribucion = precioVenta - costoVariable;
  const unidadesEquilibrio = costosFijos / margenContribucion;
  const ventasEquilibrio = unidadesEquilibrio * precioVenta;

  const datosGrafico = [];
  const limiteMaximo = Math.max(1, unidadesEquilibrio * 2);
  for (let i = 0; i <= 10; i++) {
    const q = Number((i * limiteMaximo / 10).toFixed(2));
    datosGrafico.push({
      unidades: q,
      ventasTotales: Number((q * precioVenta).toFixed(2)),
      costosTotales: Number((costosFijos + q * costoVariable).toFixed(2)),
      costosFijos: costosFijos,
    });
  }

  return {
    unidadesEquilibrio: Number(unidadesEquilibrio.toFixed(2)),
    ventasEquilibrio: Number(ventasEquilibrio.toFixed(2)),
    datosGrafico,
  };
}
