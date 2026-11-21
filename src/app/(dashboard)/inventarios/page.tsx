'use client'
import { useEffect, useState } from 'react'
import { apiClient, getErrorMessage } from '@/services/api'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import type { ProductoInventario, analizarInventarios } from '@/lib/inventarios'
import view from '@/styles/shared/View.module.css'
import buttons from '@/styles/shared/Button.module.css'
import SubMenu from '@/components/shared/SubMenu'
import { sectoresSubMenuLinks } from '@/config/menuConfig'

const nuevo: ProductoInventario = { codigo: '', nombre: '', demanda_anual: 0, costo_unitario: 0, costo_pedido: 0, costo_mantenimiento_anual: 1, plazo_entrega_dias: 0, stock_seguridad: 0, dias_operacion: 365, existencias: 0 }
const campos = { demanda_anual: 'Demanda anual (unidades)', costo_unitario: 'Costo unitario ($)', costo_pedido: 'Costo por pedido ($)', costo_mantenimiento_anual: 'Mantenimiento por unidad/año ($)', plazo_entrega_dias: 'Plazo de entrega (días)', stock_seguridad: 'Stock de seguridad', dias_operacion: 'Días de operación por año', existencias: 'Existencias actuales' } as const
export default function InventariosPage() {
  const { empresa } = useEmpresaPrincipal()
  const [productos, setProductos] = useState<ReturnType<typeof analizarInventarios>>([])
  const [producto, setProducto] = useState<ProductoInventario>(nuevo)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const cargar = async () => {
    try { setProductos((await apiClient.get('/inventarios')).data); setError('') }
    catch (e) { setError(getErrorMessage(e)) }
  }
  useEffect(() => { const timer = setTimeout(() => void cargar(), 0); return () => clearTimeout(timer) }, [])
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); setOcupado(true)
    try { await apiClient.request({ method: producto.id_producto ? 'PUT' : 'POST', url: '/inventarios', data: producto }); setProducto(nuevo); await cargar() }
    catch (e) { setError(getErrorMessage(e)) }
    finally { setOcupado(false) }
  }
  return <div style={{ padding: '20px' }}>
    <SubMenu links={sectoresSubMenuLinks} ariaLabel="Navegación de Ratios" />
    <div className={view.viewContainer} style={{ marginTop: '2rem' }}>
    <h1>Inventarios ABC, EOQ y punto de reorden</h1>
    <p>{empresa?.nombreEmpresa} · Clasificación por consumo anual en dinero: A hasta 80%, B hasta 95%, C restante. El artículo que cruza el umbral permanece en su clase.</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <form onSubmit={guardar} className="row g-3 mb-4">
      <div className="col-md-3"><label>Código<input className="form-control" required maxLength={50} value={producto.codigo} onChange={e => setProducto({ ...producto, codigo: e.target.value })} /></label></div>
      <div className="col-md-3"><label>Nombre<input className="form-control" required maxLength={150} value={producto.nombre} onChange={e => setProducto({ ...producto, nombre: e.target.value })} /></label></div>
      {Object.entries(campos).map(([key, label]) => <div className="col-md-3" key={key}><label>{label}<input className="form-control" type="number" required min={key === 'dias_operacion' ? 1 : key === 'costo_mantenimiento_anual' ? 0.000001 : 0} step={key === 'dias_operacion' ? 1 : 'any'} max={key === 'dias_operacion' ? 366 : undefined} value={producto[key as keyof typeof campos]} onChange={e => setProducto({ ...producto, [key]: Number(e.target.value) })} /></label></div>)}
      <div><button className={buttons.btnPrimary} disabled={ocupado}>{producto.id_producto ? 'Actualizar' : 'Agregar producto'}</button>{producto.id_producto && <button type="button" className={buttons.btnSecondary} onClick={() => setProducto(nuevo)}>Cancelar edición</button>}</div>
    </form>
    <div className="table-responsive"><table className={view.table}><thead><tr>{['Producto', 'Consumo anual $', 'Clase', '% acumulado', 'EOQ (unidades)', 'Reorden (unidades)', 'Existencias', 'Estado', 'Acciones'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>
      {productos.map(p => <tr key={p.id_producto}><td>{p.codigo} · {p.nombre}</td><td>{p.consumoAnual.toFixed(2)}</td><td>{p.clase}</td><td>{p.acumulado.toFixed(2)}%</td><td>{p.eoq.toFixed(2)}</td><td>{p.puntoReorden.toFixed(2)}</td><td>{p.existencias}</td><td>{p.pedir ? 'Reponer' : 'Suficiente'}</td><td><button className={buttons.btnSecondary} onClick={() => setProducto(p)}>Editar</button> <button className={buttons.btnSecondary} onClick={async () => { if (!window.confirm(`¿Eliminar ${p.codigo}?`)) return; try { await apiClient.delete('/inventarios', { params: { id: p.id_producto } }); await cargar() } catch (e) { setError(getErrorMessage(e)) } }}>Eliminar</button></td></tr>)}
    </tbody></table></div>
    {!productos.length && <p>Agrega los productos para analizar su consumo, lotes y reposición.</p>}
    <p>EOQ = √(2 × demanda anual × costo por pedido / mantenimiento unitario anual). Reorden = demanda diaria × plazo + stock de seguridad. Si el costo por pedido es cero, EOQ es cero y no determina una frecuencia de pedidos.</p>
    </div>
  </div>
}
