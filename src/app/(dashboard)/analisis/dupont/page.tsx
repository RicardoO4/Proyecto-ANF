"use client";

import { useState } from "react";

export default function SistemaDupontPage() {
  const [ventas, setVentas] = useState<number>(100000);
  const [utilidadNeta, setUtilidadNeta] = useState<number>(15000);
  const [activoTotal, setActivoTotal] = useState<number>(50000);
  const [patrimonio, setPatrimonio] = useState<number>(25000);

  const margenNeto = ventas > 0 ? utilidadNeta / ventas : 0;
  const rotacionActivos = activoTotal > 0 ? ventas / activoTotal : 0;
  const multiplicadorCapital = patrimonio > 0 ? activoTotal / patrimonio : 0;
  const roe = margenNeto * rotacionActivos * multiplicadorCapital;

  const styles = {
    container: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
    title: { color: 'var(--color-darkest)', fontSize: '28px', fontWeight: 'bold', marginBottom: '10px' },
    subtitle: { color: 'var(--color-neutral)', marginBottom: '30px' },
    inputGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', backgroundColor: 'var(--background-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '40px' },
    label: { display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-darkest)', marginBottom: '8px' },
    input: { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', outlineColor: 'var(--color-primary)' },
    treeContainer: { display: 'flex', flexDirection: 'column' as const, gap: '20px', alignItems: 'center' },
    nodesRow: { display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' as const, width: '100%' },
    node: { flex: 1, minWidth: '250px', backgroundColor: 'var(--background-card)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', borderTop: '4px solid var(--color-primary)', textAlign: 'center' as const, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    nodeTitle: { fontSize: '16px', color: 'var(--color-darkest)', fontWeight: 'bold', marginBottom: '10px' },
    nodeValue: { fontSize: '32px', fontWeight: 'bold', color: 'var(--color-primary)' },
    nodeFormula: { fontSize: '12px', color: 'var(--color-neutral)', marginTop: '10px' },
    operator: { display: 'flex', alignItems: 'center', fontSize: '24px', color: 'var(--color-neutral)', fontWeight: 'bold' },
    resultNode: { width: '100%', maxWidth: '500px', backgroundColor: 'var(--color-darkest)', padding: '30px', borderRadius: '12px', textAlign: 'center' as const, color: 'var(--text-light)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
    resultTitle: { fontSize: '20px', color: 'var(--color-neutral)', marginBottom: '10px' },
    resultValue: { fontSize: '48px', fontWeight: '900', color: 'var(--color-accent)' },
    resultDesc: { fontSize: '14px', color: 'var(--text-light)', marginTop: '15px', opacity: 0.9 }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Sistema DuPont</h2>
      <p style={styles.subtitle}>Modifica los saldos base para simular distintos escenarios de rentabilidad.</p>

      <div style={styles.inputGrid}>
        <div>
          <label style={styles.label}>Ventas Totales ($)</label>
          <input type="number" style={styles.input} value={ventas} onChange={(e) => setVentas(Number(e.target.value))} />
        </div>
        <div>
          <label style={styles.label}>Utilidad Neta ($)</label>
          <input type="number" style={styles.input} value={utilidadNeta} onChange={(e) => setUtilidadNeta(Number(e.target.value))} />
        </div>
        <div>
          <label style={styles.label}>Activo Total ($)</label>
          <input type="number" style={styles.input} value={activoTotal} onChange={(e) => setActivoTotal(Number(e.target.value))} />
        </div>
        <div>
          <label style={styles.label}>Patrimonio Total ($)</label>
          <input type="number" style={styles.input} value={patrimonio} onChange={(e) => setPatrimonio(Number(e.target.value))} />
        </div>
      </div>

      <div style={styles.treeContainer}>
        <div style={styles.nodesRow}>
          <div style={styles.node}>
            <h3 style={styles.nodeTitle}>Margen Neto</h3>
            <p style={styles.nodeValue}>{(margenNeto * 100).toFixed(2)}%</p>
            <p style={styles.nodeFormula}>Utilidad Neta / Ventas</p>
          </div>
          <div style={styles.operator}>✖</div>
          <div style={{ ...styles.node, borderTopColor: 'var(--color-neutral)' }}>
            <h3 style={styles.nodeTitle}>Rotación de Activos</h3>
            <p style={{ ...styles.nodeValue, color: 'var(--color-neutral)' }}>{rotacionActivos.toFixed(2)}x</p>
            <p style={styles.nodeFormula}>Ventas / Activo Total</p>
          </div>
          <div style={styles.operator}>✖</div>
          <div style={{ ...styles.node, borderTopColor: 'var(--color-dark)' }}>
            <h3 style={styles.nodeTitle}>Multiplicador de Capital</h3>
            <p style={{ ...styles.nodeValue, color: 'var(--color-dark)' }}>{multiplicadorCapital.toFixed(2)}x</p>
            <p style={styles.nodeFormula}>Activo Total / Patrimonio</p>
          </div>
        </div>

        <div style={styles.operator}>⬇</div>

        <div style={styles.resultNode}>
          <h2 style={styles.resultTitle}>Retorno sobre el Patrimonio (ROE)</h2>
          <p style={styles.resultValue}>{(roe * 100).toFixed(2)}%</p>
          <p style={styles.resultDesc}>
            La empresa genera ${(roe).toFixed(2)} de utilidad por cada $1 aportado.
          </p>
        </div>
      </div>
    </div>
  );
}