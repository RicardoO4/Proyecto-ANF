-- ============================================================
-- 004 — Módulo C: Ratios C1-C2 (Cobertura, Rentabilidad, DuPont)
--                y C3 (Ciclos Operativos y CCE)
--
-- Idempotente: seguro de correr múltiples veces.
-- ============================================================

-- 1) Tipo de ratio Rentabilidad --------------------------------
INSERT INTO tipo_ratio (nombre_ratio, codigo_ratio, descripcion, unidad_ratio)
SELECT 'Rentabilidad', 'RENT', 'Rendimiento sobre ventas, activos y patrimonio', 'porcentaje'
WHERE NOT EXISTS (
  SELECT 1 FROM tipo_ratio WHERE nombre_ratio = 'Rentabilidad'
);

-- 2) Categorías de ratio ---------------------------------------
INSERT INTO categoria_ratio (nombre_tipo, descripcion, id_tipo_ratio)
SELECT v.nombre, v.descripcion, t.id_tipo_ratio
FROM (VALUES
  ('Razón de cobertura de intereses',        'Capacidad de cubrir gastos financieros con utilidad operativa',   'Apalancamiento'),
  ('Índice de margen neto',                  'Utilidad neta sobre ventas netas',                                'Rentabilidad'),
  ('Rendimiento sobre activos (ROA)',        'Utilidad neta sobre activo total promedio',                       'Rentabilidad'),
  ('Rendimiento sobre capital contable (ROE)','Utilidad neta sobre patrimonio promedio',                         'Rentabilidad'),
  ('Análisis DuPont',                        'Desglose del ROE en margen neto, rotación y apalancamiento',      'Rentabilidad'),
  ('Razón de rotación de inventarios',       'Veces que rota el inventario al año',                             'Actividad'),
  ('Edad promedio del inventario',           'Días que permanece el inventario en bodega (EPI)',               'Actividad'),
  ('Período medio de pago',                  'Días que tarda la empresa en pagar a proveedores (PPP)',          'Actividad'),
  ('Ciclo operativo',                        'Días totales de ciclo operativo (EPI + PPC)',                     'Actividad'),
  ('Ciclo de conversión de efectivo',        'Días netos de conversión de efectivo (CO - PPP)',                 'Actividad')
) AS v(nombre, descripcion, tipo)
JOIN tipo_ratio t ON t.nombre_ratio = v.tipo
WHERE NOT EXISTS (
  SELECT 1 FROM categoria_ratio c WHERE c.nombre_tipo = v.nombre
);

-- 3) Benchmarks Sectoriales (Cátedra ANF115) -------------------
INSERT INTO parametro_sector
  (nombre_ratio, valor_referencia, fuente, anio_referencia, id_sector, id_categoria_ratio)
SELECT
  v.nombre,
  v.ref,
  'Cátedra ANF115 - Estándar Sectorial UES',
  v.anio,
  e.id_sector,
  c.id_categoria_ratio
FROM (VALUES
  -- Cobertura de Intereses (3.0x)
  ('Razón de cobertura de intereses',         3.00::numeric, 2023),
  ('Razón de cobertura de intereses',         3.00::numeric, 2024),
  ('Razón de cobertura de intereses',         3.00::numeric, 2025),
  -- Margen Neto (8%)
  ('Índice de margen neto',                   0.08::numeric, 2023),
  ('Índice de margen neto',                   0.08::numeric, 2024),
  ('Índice de margen neto',                   0.08::numeric, 2025),
  -- ROA (8%)
  ('Rendimiento sobre activos (ROA)',         0.08::numeric, 2023),
  ('Rendimiento sobre activos (ROA)',         0.08::numeric, 2024),
  ('Rendimiento sobre activos (ROA)',         0.08::numeric, 2025),
  -- ROE (15%)
  ('Rendimiento sobre capital contable (ROE)', 0.15::numeric, 2023),
  ('Rendimiento sobre capital contable (ROE)', 0.15::numeric, 2024),
  ('Rendimiento sobre capital contable (ROE)', 0.15::numeric, 2025),
  -- DuPont (15%)
  ('Análisis DuPont',                         0.15::numeric, 2023),
  ('Análisis DuPont',                         0.15::numeric, 2024),
  ('Análisis DuPont',                         0.15::numeric, 2025),
  -- Rotación de Inventarios (4x)
  ('Razón de rotación de inventarios',        4.00::numeric, 2023),
  ('Razón de rotación de inventarios',        4.00::numeric, 2024),
  ('Razón de rotación de inventarios',        4.00::numeric, 2025),
  -- EPI (90 días)
  ('Edad promedio del inventario',            90.00::numeric, 2023),
  ('Edad promedio del inventario',            90.00::numeric, 2024),
  ('Edad promedio del inventario',            90.00::numeric, 2025),
  -- PPP (60 días)
  ('Período medio de pago',                   60.00::numeric, 2023),
  ('Período medio de pago',                   60.00::numeric, 2024),
  ('Período medio de pago',                   60.00::numeric, 2025),
  -- Ciclo Operativo (120 días)
  ('Ciclo operativo',                         120.00::numeric, 2023),
  ('Ciclo operativo',                         120.00::numeric, 2024),
  ('Ciclo operativo',                         120.00::numeric, 2025),
  -- CCE (60 días)
  ('Ciclo de conversión de efectivo',         60.00::numeric, 2023),
  ('Ciclo de conversión de efectivo',         60.00::numeric, 2024),
  ('Ciclo de conversión de efectivo',         60.00::numeric, 2025)
) AS v(nombre, ref, anio)
JOIN categoria_ratio c ON c.nombre_tipo = v.nombre
CROSS JOIN empresa e
WHERE e.empresa_id = 2
  AND NOT EXISTS (
    SELECT 1 FROM parametro_sector p
    WHERE p.nombre_ratio = v.nombre
      AND p.anio_referencia = v.anio
      AND p.id_sector = e.id_sector
  );

-- 3b) Recalibrar la fuente de los benchmarks de 003 ------------
-- 003 ya pudo haberse ejecutado: las migraciones no se re-ejecutan, así que
-- el cambio de `fuente` se aplica aquí en lugar de editar 003.
UPDATE parametro_sector
SET fuente = 'Cátedra ANF115 - Estándar Sectorial UES'
WHERE fuente = 'Referencia inicial Módulo C — pendiente de calibración sectorial';

-- 4) Filas de ratio para Inv ABC -------------------------------
INSERT INTO ratio
  (anio_ratio, periodo_ratio, empresa_id, id_categoria_ratio, id_parametro_sector)
SELECT
  p.anio_referencia,
  'ANUAL',
  e.empresa_id,
  c.id_categoria_ratio,
  p.id_parametro_sector
FROM empresa e
JOIN categoria_ratio c
  ON c.nombre_tipo IN (
    'Razón de cobertura de intereses',
    'Índice de margen neto',
    'Rendimiento sobre activos (ROA)',
    'Rendimiento sobre capital contable (ROE)',
    'Análisis DuPont',
    'Razón de rotación de inventarios',
    'Edad promedio del inventario',
    'Período medio de pago',
    'Ciclo operativo',
    'Ciclo de conversión de efectivo'
  )
JOIN parametro_sector p
  ON p.id_categoria_ratio = c.id_categoria_ratio
 AND p.id_sector            = e.id_sector
WHERE e.empresa_id = 2
  AND p.anio_referencia IN (2023, 2024, 2025)
  AND NOT EXISTS (
    SELECT 1 FROM ratio r
    WHERE r.empresa_id        = e.empresa_id
      AND r.anio_ratio        = p.anio_referencia
      AND r.id_categoria_ratio = c.id_categoria_ratio
  );
