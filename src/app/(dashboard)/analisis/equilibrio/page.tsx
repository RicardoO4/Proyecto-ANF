"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function PuntoEquilibrioPage() {
  const [costosFijos, setCostosFijos] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [costoVariable, setCostoVariable] = useState<number>(0);

  const [unidadesEquilibrio, setUnidadesEquilibrio] = useState<number | null>(null);
  const [ventasEquilibrio, setVentasEquilibrio] = useState<number | null>(null);
  const [datosGrafico, setDatosGrafico] = useState<any[]>([]);

  const calcularEquilibrio = () => {
    if (precioVenta <= costoVariable) {
      alert("El precio de venta debe ser mayor al costo variable.");
      return;
    }
    const unidades = costosFijos / (precioVenta - costoVariable);
    const ventas = unidades * precioVenta;

    setUnidadesEquilibrio(unidades);
    setVentasEquilibrio(ventas);

    const nuevosDatos = [];
    for (let i = 0; i <= unidades * 2; i += Math.max(1, Math.floor(unidades / 5))) {
      nuevosDatos.push({
        unidades: i,
        costosFijos: costosFijos,
        costosTotales: costosFijos + (costoVariable * i),
        ventasTotales: precioVenta * i
      });
    }
    setDatosGrafico(nuevosDatos);
  };

  const styles = {
    container: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
    title: { color: 'var(--text-primary)', fontSize: '28px', fontWeight: 'bold', marginBottom: '20px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' },
    card: { backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    label: { display: 'block', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' },
    input: { width: '100%', padding: '10px', border: '1px solid var(--border-default)', borderRadius: '4px', marginBottom: '15px', outlineColor: 'var(--fey-signal)' },
    button: { backgroundColor: 'var(--fey-signal)', color: 'var(--fey-white)', border: 'none', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginTop: '10px', transition: 'background-color 0.3s' },
    resultLabel: { color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' as const, fontWeight: 'bold' },
    resultValue: { color: 'var(--text-primary)', fontSize: '32px', fontWeight: 'bold', margin: '5px 0 20px 0' },
    resultValueHighlight: { color: 'var(--fey-signal)', fontSize: '32px', fontWeight: 'bold', margin: '5px 0 0 0' },
    chartContainer: { backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px', marginTop: '20px', height: '400px' }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Análisis de Punto de Equilibrio</h2>
      
      <div style={styles.grid}>
        <div style={styles.card}>
          <label style={styles.label}>Costos Fijos Totales ($)</label>
          <input type="number" style={styles.input} value={costosFijos} onChange={(e) => setCostosFijos(Number(e.target.value))} />
          
          <label style={styles.label}>Precio de Venta Unitario ($)</label>
          <input type="number" style={styles.input} value={precioVenta} onChange={(e) => setPrecioVenta(Number(e.target.value))} />
          
          <label style={styles.label}>Costo Variable Unitario ($)</label>
          <input type="number" style={styles.input} value={costoVariable} onChange={(e) => setCostoVariable(Number(e.target.value))} />
          
          <button style={styles.button} onClick={calcularEquilibrio}>Calcular y Graficar</button>
        </div>

        <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
           <div>
             <h3 style={styles.resultLabel}>Unidades para alcanzar el equilibrio</h3>
             <p style={styles.resultValue}>{unidadesEquilibrio !== null ? `${unidadesEquilibrio.toFixed(0)} unds` : '---'}</p>
           </div>
           <div>
             <h3 style={styles.resultLabel}>Ventas en dólares para el equilibrio</h3>
             <p style={styles.resultValueHighlight}>{ventasEquilibrio !== null ? `$${ventasEquilibrio.toLocaleString()}` : '---'}</p>
           </div>
        </div>
      </div>

      {datosGrafico.length > 0 && (
        <div style={styles.chartContainer}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="unidades" name="Unidades" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip formatter={(value) => `$${value}`} />
              <Legend />
              <Line type="monotone" dataKey="costosFijos" name="Costos Fijos" stroke="var(--text-secondary)" strokeDasharray="5 5" strokeWidth={2} />
              <Line type="monotone" dataKey="costosTotales" name="Costos Totales" stroke="var(--text-tertiary)" strokeWidth={2} />
              <Line type="monotone" dataKey="ventasTotales" name="Ventas Totales" stroke="var(--accent-positive)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}