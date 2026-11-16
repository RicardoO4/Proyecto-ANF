'use client'

import DashboardCards from '@/components/shared/DashboardCards'
import { 
  BarChartLine, 
  ArrowRepeat, 
  GraphUp, 
  Calculator,
  Diagram3
} from 'react-bootstrap-icons'

const DashboardAnalisis = () => {
  const items = [
    {
      label: 'Análisis Comparativo Interno',
      icon: BarChartLine,
      to: '/analisis/comparativo',
      descripcion: 'Análisis Vertical y Horizontal comparando dos años.',
    },
    {
      label: 'Gestión de Ratios (Benchmark)',
      icon: ArrowRepeat,
      to: '/ratios',
      descripcion: 'Compara ratios contra el promedio interno del sector.',
    },
    {
      label: 'Evolución de Ratios',
      icon: GraphUp,
      to: '/analisis/evolucion-ratios',
      descripcion: 'Gráficos de la evolución de ratios en 3 años.',
    },
    // --- Módulos Integrante D ---
    {
      label: 'Punto de Equilibrio',
      icon: Calculator,
      to: '/analisis/equilibrio',
      descripcion: 'Cálculo y gráfico de unidades e ingresos requeridos para no generar pérdidas.',
    },
    {
      label: 'Sistema DuPont',
      icon: Diagram3,
      to: '/analisis/dupont',
      descripcion: 'Análisis interactivo de rentabilidad y desglose de los componentes del ROE.',
    },
  ]

  return (
    <section>
      <DashboardCards title="Módulo de Análisis y Reportes" items={items} />
    </section>
  )
}

export default DashboardAnalisis