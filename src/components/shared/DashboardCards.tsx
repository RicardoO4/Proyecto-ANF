'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import styles from '@/styles/DashboardCards.module.css'

interface CardItem {
  id?: number
  label: string
  // eslint-disable-next-line no-unused-vars
  icon: ComponentType<{ size?: number; className?: string }>
  to: string
  descripcion?: string
}

interface DashboardCardsProps {
  title: string
  // eslint-disable-next-line no-unused-vars
  items: CardItem[]
}

const DashboardCards = ({ title, items }: DashboardCardsProps) => (
  <section className={styles.cardsSection}>
    <header>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>Selecciona un módulo para comenzar.</p>
    </header>
    <div className="row justify-content-center">
      {/* Aquí extraemos la 'descripcion' del item en el map */}
      {items.map(({ label, icon: Icon, to, descripcion }, i) => (
        <article key={i} className="col-12 col-md-6 col-lg-4 mb-4 d-flex justify-content-center">
          <Link href={to} className={styles.dashboardCard}>
            <div className={styles.cardIconWrapper}>
              {Icon && <Icon size={24} className={styles.cardIcon} />}
            </div>

            <div className={styles.cardLabel}>{label}</div>

            {descripcion && <p className={styles.cardDescription}>{descripcion}</p>}
          </Link>
        </article>
      ))}
    </div>
  </section>
)

export default DashboardCards
