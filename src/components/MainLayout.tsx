'use client'

import { useState, useEffect, type ReactNode } from 'react'
import SideBar from '@/components/SideBar'
import styles from '@/styles/MainLayout.module.css'

const MainLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768)
    }
    window.addEventListener('resize', handleResize)
    handleResize() // Llama una vez al inicio
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className={styles.layoutRoot}>
      <SideBar sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      <main className={styles.mainContent} aria-label="Contenido principal">
        <div className={styles.viewWrapper}>{children}</div>
      </main>
    </div>
  )
}

export default MainLayout
