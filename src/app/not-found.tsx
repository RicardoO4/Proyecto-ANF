import Link from 'next/link'
import styles from '@/styles/NotFound.module.css'

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>
          Página no <span className={styles.highlight}>encontrada</span>.
        </h1>
        <p className={styles.text}>
          La ruta que buscas no existe o fue movida. Vuelve al panel para continuar.
        </p>
        <Link href="/dashboard" className={styles.link}>
          Volver al panel
        </Link>
      </div>
    </main>
  )
}
