'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import SubMenu from '@/components/shared/SubMenu'
import styles from '@/styles/proyeccion/Proyecciones.module.css'

const proyeccionesSubMenuLinks = [
  { label: 'Proyección de Ventas Mensuales', to: '/proyecciones' },
  { label: 'Ver Historial de Ventas', to: '/proyecciones/historial' },
  { label: 'Pronóstico de Ventas Anuales', to: '/proyecciones/pronostico' },
  { label: 'Estados Proforma', to: '/proyecciones/proforma' },
  { label: 'Presupuestos', to: '/proyecciones/presupuesto' },
  { label: 'Presupuesto de Capital', to: '/proyecciones/capital' },
]

export default function NavegacionProyecciones() {
  const pathname = usePathname()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={styles.navigation} data-projection-navigation>
      <SubMenu links={proyeccionesSubMenuLinks} ariaLabel="Navegación de proyecciones" scroll={false} />
    </div>
  )
}