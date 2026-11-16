"use client";

import { useState } from "react";

export default function EstadosProformaPage() {
  const [ventasActuales, setVentasActuales] = useState<number>(100000);
  const [ventasProyectadas, setVentasProyectadas] = useState<number>(125000);
  const [activosEspontaneos, setActivosEspontaneos] = useState<number>(60000); 
  const [pasivosEspontaneos, setPasivosEspontaneos] = useState<number>(20000);
  const [margenNetoPorcentaje, setMargenNetoPorcentaje] = useState<number>(15); 
  const [retencionPorcentaje, setRetencionPorcentaje] = useState<number>(40); 

  const variacionVentas = ventasProyectadas - ventasActuales;
  const incrementoActivos = ventasActuales > 0 ? (activosEspontaneos / ventasActuales) * variacionVentas : 0;
  const incrementoPasivos = ventasActuales > 0 ? (pasivosEspontaneos / ventasActuales) * variacionVentas : 0;
  const utilidadProyectada = ventasProyectadas * (margenNetoPorcentaje / 100);
  const utilidadRetenidaAdicional = utilidadProyectada * (retencionPorcentaje / 100);
  const fer = incrementoActivos - incrementoPasivos - utilidadRetenidaAdicional;

  const styles = {
    container: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
    title: { color: 'var(--text-primary)', fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' },
    subtitle: { color: 'var(--text-secondary)', marginBottom: '30px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' },
    card: { backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    sectionTitle: { color: 'var(--text-primary)', fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '10px' },
    inputGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' },
    label: { display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' },
    input: { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-default)', outlineColor: 'var(--fey-signal)' },
    inputHighlight: { width: '100%', padding: '10px', borderRadius: '4px', border: '2px solid var(--fey-signal)', backgroundColor: 'var(--surface-elevated)', outlineColor: 'var(--fey-signal)' },
    listItem: { display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--border-default)', fontSize: '14px', color: 'var(--text-primary)' },
    ferContainer: { marginTop: '20px', padding: '24px', borderRadius: '8px', textAlign: 'center' as const, border: `1px solid ${fer > 0 ? 'rgba(224, 108, 90, 0.5)' : 'rgba(78, 190, 150, 0.5)'}`, backgroundColor: fer > 0 ? 'rgba(224, 108, 90, 0.12)' : 'rgba(78, 190, 150, 0.12)' },
    ferTitle: { fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '10px' },
    ferValue: { fontSize: '48px', fontWeight: '900', color: fer > 0 ? 'var(--accent-negative)' : 'var(--accent-positive)' },
    ferDesc: { fontSize: '14px', color: 'var(--text-secondary)', marginTop: '10px' }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Estados Proforma y FER</h2>
      <p style={styles.subtitle}>Proyección de necesidades de capital mediante el método de porcentaje de ventas.</p>

      <div style={styles.grid}>
        
        {/* Panel de Inputs */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Variables Base</h3>
          
          <div style={styles.inputGroup}>
            <div>
              <label style={styles.label}>Ventas Actuales ($)</label>
              <input type="number" style={styles.input} value={ventasActuales} onChange={(e) => setVentasActuales(Number(e.target.value))} />
            </div>
            <div>
              <label style={styles.label}>Ventas Proyectadas ($)</label>
              <input type="number" style={styles.inputHighlight} value={ventasProyectadas} onChange={(e) => setVentasProyectadas(Number(e.target.value))} />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <div>
              <label style={styles.label}>Activos Espontáneos ($)</label>
              <input type="number" style={styles.input} value={activosEspontaneos} onChange={(e) => setActivosEspontaneos(Number(e.target.value))} />
            </div>
            <div>
              <label style={styles.label}>Pasivos Espontáneos ($)</label>
              <input type="number" style={styles.input} value={pasivosEspontaneos} onChange={(e) => setPasivosEspontaneos(Number(e.target.value))} />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <div>
              <label style={styles.label}>Margen Neto (%)</label>
              <input type="number" style={styles.input} value={margenNetoPorcentaje} onChange={(e) => setMargenNetoPorcentaje(Number(e.target.value))} />
            </div>
            <div>
              <label style={styles.label}>Retención Utilidades (%)</label>
              <input type="number" style={styles.input} value={retencionPorcentaje} onChange={(e) => setRetencionPorcentaje(Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Panel de Resultados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Desglose de Variaciones</h3>
            
            <div style={styles.listItem}>
              <span>Variación de Ventas Proyectadas:</span>
              <span style={{ fontWeight: 'bold' }}>+${variacionVentas.toLocaleString()}</span>
            </div>
            <div style={styles.listItem}>
              <span>Nuevos Activos Requeridos:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-negative)' }}>+${incrementoActivos.toLocaleString()}</span>
            </div>
            <div style={styles.listItem}>
              <span>Financiamiento Espontáneo:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-positive)' }}>-${incrementoPasivos.toLocaleString()}</span>
            </div>
            <div style={{ ...styles.listItem, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
              <span>Utilidad Retenida (Fondos Propios):</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-positive)' }}>-${utilidadRetenidaAdicional.toLocaleString()}</span>
            </div>
          </div>

          <div style={styles.ferContainer}>
            <h3 style={styles.ferTitle}>Financiamiento Externo Requerido (FER)</h3>
            <p style={styles.ferValue}>${Math.abs(fer).toLocaleString()}</p>
            <p style={styles.ferDesc}>
              {fer > 0 
                ? "La empresa necesita pedir un préstamo para soportar este nivel de ventas." 
                : "La empresa tiene exceso de liquidez. No requiere financiamiento bancario."}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}