'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '@/styles/shared/SubMenu.module.css'

/**
 * Componente de Sub-navegación reutilizable.
 * @param links - Un array de objetos de enlace.
 */
const SubMenu = ({ links = [] }: { links?: { to: string; label: string }[] }) => {
  const pathname = usePathname()

  return (
    <nav className={styles.subnav}>
      <div className={styles.subnavContainer}>
        {links.map((link) => (
          <Link
            key={link.to}
            href={link.to}
            // La clase 'active' se aplica cuando la ruta coincide
            className={
              pathname === link.to ? `${styles.subnavBtn} ${styles.active}` : styles.subnavBtn
            }
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export default SubMenu
