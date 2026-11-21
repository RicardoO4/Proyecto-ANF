'use client'

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ResumenDashboard } from '@/lib/dashboard'

const dinero = (valor: number) => valor.toLocaleString('es-SV', { style: 'currency', currency: 'USD' })
const compacto = (valor: number) => valor.toLocaleString('es-SV', { notation: 'compact', maximumFractionDigits: 1 })
const colores = { ingresos: '#479ffa', gastos: '#ffa16c', utilidad: '#4ebe96', perdida: '#e06c5a', patrimonio: '#9583ff' }
const estiloTooltip = { background: '#191919', border: '1px solid #444', borderRadius: 10, color: '#f5f5f5', fontSize: 12 }

type Props = { tipo: 'evolucion'; historico: ResumenDashboard[] } | { tipo: 'patrimonio'; resumen: ResumenDashboard }

export default function GraficasDashboard(props: Props) {
  if (props.tipo === 'patrimonio') {
    const filas = [
      { nombre: 'Activos', monto: props.resumen.activos, color: colores.ingresos },
      { nombre: 'Pasivos', monto: props.resumen.pasivos, color: colores.gastos },
      { nombre: 'Patrimonio', monto: props.resumen.patrimonio, color: colores.patrimonio },
    ]
    return <ResponsiveContainer width="100%" height={150} minWidth={0}>
      <BarChart data={filas} layout="vertical" accessibilityLayer margin={{ left: 0, right: 14, top: 8, bottom: 8 }}>
        <XAxis type="number" hide /><YAxis type="category" dataKey="nombre" width={85} axisLine={false} tickLine={false} tick={{ fill: '#868f97', fontSize: 12 }} />
        <Tooltip contentStyle={estiloTooltip} cursor={{ fill: '#ffffff06' }} formatter={valor => [dinero(Number(valor)), 'Saldo']} />
        <Bar dataKey="monto" maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>{filas.map(fila => <Cell key={fila.nombre} fill={fila.color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  }
  const filas = props.historico.map(fila => ({ ...fila, periodo: `${fila.anio}${fila.estado === 'PROVISIONAL' ? '*' : ''}` }))
  return <ResponsiveContainer width="100%" height={285} minWidth={0}>
    <BarChart data={filas} accessibilityLayer margin={{ left: 0, right: 6, top: 16, bottom: 0 }}>
      <CartesianGrid stroke="#ffffff0c" vertical={false} />
      <XAxis dataKey="periodo" tick={{ fill: '#868f97', fontSize: 12 }} tickLine={false} axisLine={false} />
      <YAxis tickFormatter={compacto} width={66} tick={{ fill: '#868f97', fontSize: 11 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={estiloTooltip} cursor={{ fill: '#ffffff06' }} formatter={valor => valor === null || valor === undefined ? 'Sin información' : dinero(Number(valor))} />
      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
      <Bar name="Ingresos netos" dataKey="ingresos" fill={colores.ingresos} maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      <Bar name="Costos y gastos" dataKey="costosGastos" fill={colores.gastos} maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      <Bar name="Resultado" dataKey="utilidad" fill={colores.utilidad} maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false}>
        {filas.map(fila => <Cell key={fila.anio} fill={(fila.utilidad ?? 0) < 0 ? colores.perdida : colores.utilidad} fillOpacity={fila.estado === 'PROVISIONAL' ? 0.5 : 1} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
}
