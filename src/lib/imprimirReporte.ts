const estilos = `
  @page { size: A4 landscape; margin: 14mm 12mm; }
  :root { color-scheme: light; }
  * { box-sizing: border-box; box-shadow: none !important; text-shadow: none !important; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body { font: 10pt/1.4 Arial, Helvetica, sans-serif; }
  div, section { overflow: visible !important; max-height: none !important; height: auto; }
  h1 { font-size: 20pt; margin: 0 0 6pt; }
  h2 { font-size: 14pt; margin: 18pt 0 8pt; break-after: avoid; }
  p { margin: 6pt 0 10pt; }
  dl { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt 16pt; margin: 14pt 0; }
  dt { font-size: 9pt; color: #444; }
  dd { margin: 2pt 0 0; font-weight: bold; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 14pt; font-size: 9pt; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  th, td { position: static; padding: 6pt; border-bottom: 1px solid #ddd; vertical-align: top; text-align: right; }
  th { color: #111; background: #eee; font-weight: bold; white-space: normal; }
  th:first-child, td:first-child { width: 38%; text-align: left; overflow-wrap: anywhere; }
  td:not(:first-child) { white-space: nowrap; font-variant-numeric: tabular-nums; }
  table[data-balance] th:first-child, table[data-balance] td:first-child { width: 52%; }
  tfoot th, tfoot td { font-weight: bold; border-top: 1px solid #555; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  button, input, select, textarea { display: none !important; }
`

export function imprimirReporte(contenido: HTMLElement, titulo: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const marco = document.createElement('iframe')
    marco.title = 'Vista de impresión del reporte'
    marco.setAttribute('aria-hidden', 'true')
    marco.style.cssText = 'position:fixed;left:-10000px;top:0;width:1120px;height:800px;border:0;'
    marco.onload = async () => {
      const ventana = marco.contentWindow
      const documento = marco.contentDocument
      if (!ventana || !documento) {
        marco.remove()
        reject(new Error('No se pudo preparar el reporte para imprimir.'))
        return
      }
      try {
        documento.title = titulo
        await documento.fonts.ready
        await new Promise<void>(ready => ventana.requestAnimationFrame(() => ventana.requestAnimationFrame(() => ready())))
        ventana.addEventListener('afterprint', () => marco.remove(), { once: true })
        ventana.focus()
        ventana.print()
        // Algunos navegadores no emiten afterprint al cancelar el diálogo.
        window.setTimeout(() => marco.remove(), 300_000)
        resolve()
      } catch {
        marco.remove()
        reject(new Error('No se pudo abrir la impresión del reporte.'))
      }
    }
    marco.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Estados proforma</title><style>${estilos}</style></head><body>${contenido.outerHTML}</body></html>`
    document.body.append(marco)
  })
}
