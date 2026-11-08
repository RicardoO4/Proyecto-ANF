"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { proyeccionPromedioMovil, proyeccionLogaritmica } from "@/lib/proyeccion"; // Asegúrate de que esta ruta sea correcta según tu proyecto

export default function PronosticosPage() {
  const [ventas] = useState<number[]>([1200, 1350, 1400, 1600, 1850, 1900, 2100, 2150, 2200, 2350, 2400, 2450]);
  
  // Si tienes las funciones en otro lado, coméntalas o ajusta la importación.
  // Aquí asumo que devuelven un arreglo de números para los próximos 6 meses.
  const pronosticoMovil = proyeccionPromedioMovil(ventas, 3, 6); 
  const pronosticoLog = proyeccionLogaritmica(ventas, 6); 

  const datosGrafico = Array.from({ length: 18 }).map((_, index) => {
    const mes = index + 1;
    const esHistorico = index < 12;
    return {
      mes: `Mes ${mes}`,
      historico: esHistorico ? ventas[index] : null,
      movil: esHistorico ? null : pronosticoMovil[index - 12],
      logaritmico: esHistorico ? null : pronosticoLog[index - 12],
    };
  });

  // Conectar las líneas en el mes 12
  datosGrafico[11].movil = ventas[11];
  datosGrafico[11].logaritmico = ventas[11];

  const styles = {
    container: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
    title: { color: 'var(--color-darkest)', fontSize: '28px', fontWeight: 'bold', marginBottom: '20px' },
    chartContainer: { backgroundColor: 'var(--background-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px', height: '500px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Simulador de Pronósticos de Ventas</h2>
      
      <div style={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="mes" stroke="var(--color-neutral)" />
            <YAxis stroke="var(--color-neutral)" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="historico" name="Ventas Históricas" stroke="var(--color-darkest)" strokeWidth={3} />
            <Line type="monotone" dataKey="movil" name="Promedio Móvil (n=3)" stroke="var(--color-primary)" strokeDasharray="5 5" strokeWidth={2} />
            <Line type="monotone" dataKey="logaritmico" name="Regresión Logarítmica" stroke="var(--color-accent)" strokeDasharray="5 5" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}