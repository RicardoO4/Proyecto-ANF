'use client'

import styles from '@/styles/Sidebar.module.css'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { List, BoxArrowRight } from 'react-bootstrap-icons'
import { useAuth } from '@/context/AuthContext'
import { mainLinks } from '@/config/menuConfig'
import { contabilidadLinks } from '@/config/contabilidadMenu'
import { puedeVerPagina } from '@/lib/accesos'

const SideBar = ({ sidebarOpen, toggleSidebar }: { sidebarOpen: boolean; toggleSidebar: () => void }) => {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const navigate = useRouter()

  if (!user) return null // o un loader

  // Filtrar las opciones visibles según los accesos del usuario
  const contable=pathname.startsWith('/contabilidad')||user.rol==='CONTADOR'
  const visibleLinks = contable
    ? contabilidadLinks.filter(link=>puedeVerPagina(link.to,user))
    : mainLinks.filter(link=>(user.rol==='ADMIN'||user.accesos.includes(link.idOp))&&puedeVerPagina(link.to,user))

  const handleLogout = () => {
    logout()
    navigate.push('/')
  }

  return (
    <aside
      className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarCollapsed}`}
      aria-label={contable?'Menú de contabilidad':'Menú de análisis financiero'}
    >
      <header className={styles.sidebarHeader}>
        <Link href={contable?'/contabilidad':'/dashboard'} className={styles.sidebarLogoLink}>
          <span className={styles.sidebarLogo}>{contable?'Contabilidad':'Finanzas'}</span>
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
            const isActive = to==='/contabilidad'?pathname===to:pathname===to||pathname.startsWith(to+'/')
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
        {contable&&user.rol!=='CONTADOR'&&<Link href="/dashboard" className={styles.bottomBtn} title="Ir al análisis financiero"><span className={styles.menuLabel}>← Análisis financiero</span></Link>}
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
