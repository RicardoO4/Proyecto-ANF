// asistenteService — Asistente Financiero IA (/api/v1/analisis/asistente-ia)
import { apiClient } from './api'
import type { AsistenteRespuesta } from '@/lib/asistenteFinanciero'

export const asistenteService = {
  /** Años con ratios calculados para la empresa (más reciente primero). */
  async getAnios(empresaId: number): Promise<number[]> {
    const resp = await apiClient.get<{ anios: number[] }>('/analisis/asistente-ia', {
      params: { empresaId },
    })
    return resp.data.anios
  },

  /** Lectura en lenguaje sencillo de los ratios de un año. */
  async interpretar(empresaId: number, anio: number, forzar = false): Promise<AsistenteRespuesta> {
    const resp = await apiClient.post<AsistenteRespuesta>(
      '/analisis/asistente-ia',
      { empresaId, anio, forzar },
      // Gemini puede tardar; se espera hasta 60 s antes de rendirse.
      { timeout: 60_000 },
    )
    return resp.data
  },
}
