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
  if (precioVenta <= costoVariable || precioVenta === 0) {
    return null; 
  }

  const margenContribucion = precioVenta - costoVariable;
  const unidadesEquilibrio = costosFijos / margenContribucion;
  const ventasEquilibrio = unidadesEquilibrio * precioVenta;

  const datosGrafico = [];
  const paso = unidadesEquilibrio / 5; // Generamos 10 puntos en el gráfico
  const limiteMaximo = unidadesEquilibrio * 2; // Dibujar hasta el doble del equilibrio

  for (let q = 0; q <= limiteMaximo; q += paso) {
    datosGrafico.push({
      unidades: Math.round(q),
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