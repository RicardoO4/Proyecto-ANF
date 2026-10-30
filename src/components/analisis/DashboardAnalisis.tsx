'use client'

import DashboardCards from '@/components/shared/DashboardCards'

import { BarChartLine, ArrowRepeat, ClipboardData, GraphUp, BarChartSteps } from 'react-bootstrap-icons'

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
      label: 'Comparativa vs. Ratios Externos',
      icon: ClipboardData,
      to: '/analisis/externo',
      descripcion: 'Compara ratios contra los parámetros externos del sistema.',
    },
    {
      label: 'Evolución de Ratios',
      icon: GraphUp,
      to: '/analisis/evolucion-ratios',
      descripcion: 'Gráficos de la evolución de ratios en 3 años.',
    },
    {
      label: 'Evolución de Cuentas',
      icon: BarChartSteps,
      to: '/analisis/evolucion-cuentas',
      descripcion: 'Gráfico de la variación de una cuenta específica.',
    },
  ]

  return (
    <section>
      <DashboardCards title="Módulo de Análisis y Reportes" items={items} />
    </section>
  )
}

export default DashboardAnalisis
