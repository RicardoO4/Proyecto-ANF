'use client'

import styles from '@/styles/Sidebar.module.css'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { List, BoxArrowRight } from 'react-bootstrap-icons'
import { useAuth } from '@/context/AuthContext'
import { mainLinks } from '@/config/menuConfig'

const SideBar = ({ sidebarOpen, toggleSidebar }: { sidebarOpen: boolean; toggleSidebar: () => void }) => {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const navigate = useRouter()

  if (!user) return null // o un loader

  // Filtrar las opciones visibles según los accesos del usuario
  const visibleLinks = mainLinks.filter((link) => user.accesos.includes(link.idOp))

  const handleLogout = () => {
    logout()
    navigate.push('/')
  }

  return (
    <aside
      className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarCollapsed}`}
      aria-label="Menú lateral principal"
    >
      <header className={styles.sidebarHeader}>
        <Link href="/dashboard" className={styles.sidebarLogoLink}>
          <span className={styles.sidebarLogo}>Finanzas</span>
        </Link>
        <button
          type="button"
          className={styles.sidebarToggleBtn}
          onClick={toggleSidebar}
          aria-label="Mostrar/ocultar menú lateral"
          aria-expanded={sidebarOpen}
        >
          <List size={22} />
        </button>
      </header>

      <nav className={styles.sidebarNav}>
        <ul className={styles.navList}>
          {visibleLinks.map(({ to, label, icon: Icon }, i) => {
            const isActive = pathname.startsWith(to)
            return (
              <li key={i} className={styles.navItem}>
                <Link
                  href={to}
                  className={`${styles.menuLink} ${isActive ? styles.active : ''}`}
                  title={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={styles.menuIcon} size={20} />
                  <span className={styles.menuLabel}>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <button
          type="button"
          className={styles.bottomBtn}
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <BoxArrowRight className={styles.menuIcon} size={20} />
          <span className={styles.menuLabel}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export default SideBar
