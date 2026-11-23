'use client'

// Muestra una interpretación generada por IA (Módulo E). La usan la página
// del Asistente IA y la ventana del botón "Resumen con IA".
import type { EstadoGeneral, InterpretacionIA, MetaIA } from '@/lib/iaComun'
import styles from '@/styles/analisis/AsistenteIA.module.css'

const ESTADO: Record<EstadoGeneral, { texto: string; clase: string }> = {
  saludable: { texto: 'Situación saludable', clase: styles.estadoSaludable },
  atencion: { texto: 'Requiere atención', clase: styles.estadoAtencion },
  riesgo: { texto: 'Situación de riesgo', clase: styles.estadoRiesgo },
}

const formatoFecha = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' })

interface Props {
  interpretacion: InterpretacionIA
  meta: MetaIA
  /** Datos que recibió la IA, para compararlos con la pantalla. */
  datosClave?: { etiqueta: string; valor: string }[]
  /** Contenido extra antes del pie (p. ej. una tabla de ratios). */
  children?: React.ReactNode
}

const Lista = ({ titulo, items, vacio, clase }: { titulo: string; items: string[]; vacio: string; clase: string }) => (
  <article className={`${styles.card} ${clase}`}>
    <h4>{titulo}</h4>
    {items.length > 0 ? (
      <ul>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    ) : (
      <p>{vacio}</p>
    )}
  </article>
)

const ResumenIAVista = ({ interpretacion: interp, meta, datosClave, children }: Props) => {
  const estado = ESTADO[interp.estadoGeneral]

  return (
    <div>
      <div className={styles.resumenCard}>
        <span className={`${styles.estado} ${estado.clase}`}>{estado.texto}</span>
        <p className={styles.resumenTexto}>{interp.resumen}</p>
      </div>

      {interp.explicacionPorArea.length > 0 && (
        <>
          <h3 className={styles.seccionTitulo}>Qué dice cada parte</h3>
          <div className={styles.grid}>
            {interp.explicacionPorArea.map((a) => (
              <article key={a.area} className={styles.card}>
                <h4>{a.area}</h4>
                <p>{a.explicacion}</p>
              </article>
            ))}
          </div>
        </>
      )}

      <h3 className={styles.seccionTitulo}>En resumen</h3>
      <div className={styles.grid}>
        <Lista
          titulo="Puntos fuertes"
          items={interp.puntosFuertes}
          vacio="No se identificaron puntos fuertes con estos datos."
          clase={styles.cardFuertes}
        />
        <Lista titulo="Alertas" items={interp.alertas} vacio="No se identificaron alertas." clase={styles.cardAlertas} />
        <Lista
          titulo="Recomendaciones"
          items={interp.recomendaciones}
          vacio="Sin recomendaciones."
          clase={styles.cardRecomendaciones}
        />
      </div>

      {interp.glosario.length > 0 && (
        <>
          <h3 className={styles.seccionTitulo}>Glosario</h3>
          <dl className={styles.glosario}>
            {interp.glosario.map((g) => (
              <div key={g.termino}>
                <dt>{g.termino}</dt>
                <dd>{g.definicion}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {datosClave && datosClave.length > 0 && (
        <details className={styles.datos}>
          <summary>Ver los datos que recibió la IA</summary>
          <dl className={styles.glosario} style={{ marginTop: 12 }}>
            {datosClave.map((d) => (
              <div key={d.etiqueta}>
                <dt>{d.etiqueta}</dt>
                <dd>{d.valor}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {children}

      <p className={styles.pie}>
        Generado por inteligencia artificial ({meta.modelo}) el {formatoFecha.format(new Date(meta.generadoEn))}
        {meta.desdeCache ? ', reutilizado de una consulta guardada (sin consumir Gemini en esta consulta)' : ''}. Tokens de la generación original:{' '}
        {meta.tokens.total.toLocaleString('es-SV')} ({meta.tokens.entrada} de envío y {meta.tokens.salida} de
        respuesta). Es orientativo y no reemplaza la asesoría de un profesional. No se envió el nombre de la empresa.
      </p>
    </div>
  )
}

export default ResumenIAVista
