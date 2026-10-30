'use client'

import DashboardCards from '@/components/shared/DashboardCards'
import { useAuth } from '@/context/AuthContext'
import {
  Building,
  PeopleFill,
  Diagram3,
  FileEarmarkText,
  JournalCheck,
  GraphUpArrow,
} from 'react-bootstrap-icons'

const DashboardGeneral = () => {
  const { user } = useAuth()
  const accesos = user?.accesos || []

  const items = [
    { id: 1, label: 'Gestionar Empresas', icon: Building, to: '/empresas' },
    { id: 2, label: 'Gestionar Ratios', icon: Diagram3, to: '/ratios' },
    { id: 3, label: 'Gestionar Usuarios', icon: PeopleFill, to: '/usuarios' },
    { id: 4, label: 'Catálogo de Cuentas', icon: JournalCheck, to: '/catalogo-cuentas' },
    { id: 5, label: 'Proyecciones', icon: GraphUpArrow, to: '/proyecciones' },
    { id: 6, label: 'Estados Financieros', icon: FileEarmarkText, to: '/estados-financieros' },
  ]

  // Filtramos los items según los accesos del usuario
  const filteredItems = items.filter((item) => accesos.includes(item.id))

  return (
    <section>
      <DashboardCards title="Módulos del Sistema" items={filteredItems} />
    </section>
  )
}

export default DashboardGeneral
