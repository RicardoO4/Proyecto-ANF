/** Evita truncar productos o demanda por el límite de filas de la API. */
export async function leerPaginasInventario<T>(consultar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consultar(desde, desde + 999)
    if (error) throw error
    filas.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return filas
  }
}
