-- Completa las 23 categorías que implementa el motor. No crea benchmarks ficticios.
BEGIN;
INSERT INTO tipo_ratio (nombre_ratio, codigo_ratio, descripcion, unidad_ratio)
SELECT nombre, codigo, nombre, 'razon' FROM (VALUES
 ('Liquidez', 'LIQ'), ('Actividad', 'ACTI'), ('Apalancamiento', 'APAL'), ('Rentabilidad', 'RENT')
) AS v(nombre, codigo)
WHERE NOT EXISTS (SELECT 1 FROM tipo_ratio t WHERE t.nombre_ratio = v.nombre);

INSERT INTO categoria_ratio (nombre_tipo, descripcion, id_tipo_ratio)
SELECT v.nombre, v.nombre, t.id_tipo_ratio FROM (VALUES
 ('Razón de circulante o liquidez corriente', 'Liquidez'),
 ('Razón de capital de trabajo', 'Liquidez'),
 ('Razón de efectivo', 'Liquidez'),
 ('Prueba ácida', 'Liquidez'),
 ('Razón de rotación de cuentas por cobrar', 'Actividad'),
 ('Período medio de cobranza', 'Actividad'),
 ('Índice de rotación de activos totales', 'Actividad'),
 ('Índice de rotación de activos fijos', 'Actividad'),
 ('Grado de endeudamiento', 'Apalancamiento'),
 ('Grado de propiedad', 'Apalancamiento'),
 ('Razón de endeudamiento patrimonial', 'Apalancamiento'),
 ('Razón de cobertura de intereses', 'Apalancamiento'),
 ('Índice de margen bruto', 'Rentabilidad'),
 ('Índice de margen operativo', 'Rentabilidad'),
 ('Índice de margen neto', 'Rentabilidad'),
 ('Rendimiento sobre activos (ROA)', 'Rentabilidad'),
 ('Rendimiento sobre capital contable (ROE)', 'Rentabilidad'),
 ('Análisis DuPont', 'Rentabilidad'),
 ('Razón de rotación de inventarios', 'Actividad'),
 ('Edad promedio del inventario', 'Actividad'),
 ('Período medio de pago', 'Actividad'),
 ('Ciclo operativo', 'Actividad'),
 ('Ciclo de conversión de efectivo', 'Actividad')
) AS v(nombre, tipo)
JOIN tipo_ratio t ON t.nombre_ratio = v.tipo
WHERE NOT EXISTS (SELECT 1 FROM categoria_ratio c WHERE c.nombre_tipo = v.nombre);
COMMIT;
