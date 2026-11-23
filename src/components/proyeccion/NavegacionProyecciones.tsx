'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import SubMenu from '@/components/shared/SubMenu'
import { proyeccionesSubMenuLinks } from '@/config/menuConfig'
import styles from '@/styles/proyeccion/Proyecciones.module.css'

export default function NavegacionProyecciones() {
  const pathname = usePathname()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return <div className={styles.navigation} data-projection-navigation>
    <SubMenu links={proyeccionesSubMenuLinks} ariaLabel="Navegación de proyecciones" scroll={false} />
  </div>
}
