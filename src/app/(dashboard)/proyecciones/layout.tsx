import type { ReactNode } from 'react'
import NavegacionProyecciones from '@/components/proyeccion/NavegacionProyecciones'
import styles from '@/styles/proyeccion/Proyecciones.module.css'

export default function Layout({ children }: { children: ReactNode }) {
  return <div className={styles.workspace}><NavegacionProyecciones />{children}</div>
}
