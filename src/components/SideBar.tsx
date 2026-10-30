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
          <span className={styles.sidebarLogo}>FINANZAS</span>
        </Link>
        <button
          className={`btn btn-link btn-sm text-white ${styles.sidebarToggleBtn}`}
          onClick={toggleSidebar}
          aria-label="Mostrar/ocultar menú lateral"
        >
          <List size={28} />
        </button>
      </header>

      <nav className={styles.sidebarNav}>
        <ul className="nav nav-pills flex-column mb-auto">
          {visibleLinks.map(({ to, label, icon: Icon }, i) => (
            <li key={i} className="nav-item">
              <Link
                href={to}
                className={`nav-link ${styles.menuLink} ${pathname.startsWith(to) ? styles.active : 'text-white'}`}
                title={label}
              >
                <Icon className={styles.menuIcon} size={20} />
                <span className={styles.menuLabel}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto w-100 p-2">
        <button
          className={`btn btn-outline-light w-100 d-flex align-items-center justify-content-center mt-2 ${styles.bottomBtn}`}
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
