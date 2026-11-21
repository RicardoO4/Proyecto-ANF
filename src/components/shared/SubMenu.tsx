'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import styles from '@/styles/shared/SubMenu.module.css'

/**
 * Componente de Sub-navegación reutilizable.
 * @param links - Un array de objetos de enlace.
 */
const SubMenu = ({ links = [], ariaLabel = 'Navegación de la sección', scroll }: { links?: { to: string; label: string }[]; ariaLabel?: string; scroll?: boolean }) => {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav && active) nav.scrollTo({ left: Math.max(0, active.offsetLeft - nav.clientWidth / 2 + active.offsetWidth / 2) })
  }, [pathname])

  return (
    <nav ref={navRef} className={styles.subnav} aria-label={ariaLabel}>
      <div className={styles.subnavContainer}>
        {links.map((link) => (
          <Link
            key={link.to}
            href={link.to}
            scroll={scroll}
            aria-current={pathname === link.to ? 'page' : undefined}
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
