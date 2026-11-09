-- ============================================================
-- 003 — Módulo C: precisión de ratios + catálogo inicial
--
-- Qué hace:
--   1. Sube la precisión de los valores de ratio a 4 decimales.
--   2. Crea los tipos de ratio que faltaban (Apalancamiento, Actividad).
--   3. Crea las 4 categorías de la primera entrega del Módulo C.
--   4. Crea benchmarks (parametro_sector) para 2023, 2024 y 2025.
--   5. Crea las filas de `ratio` de la empresa 2 (Inv ABC) para que los
--      calculadores tengan algo que actualizar.
--
-- Es idempotente: se puede correr dos veces sin duplicar filas.
--
-- Equivalente sin editor SQL: `node scripts/seed-ratios.mjs`.
-- Si se edita un seed, editar el otro.
--
-- Contexto: el catálogo en BD solo tenía 3 categorías de liquidez, así
-- que 6 de los 9 endpoints existentes no se podían ejecutar. Sin este
-- seed, los ratios del Módulo C tampoco aparecen en la UI.
-- ============================================================

-- 1) Precisión -------------------------------------------------
-- Con NUMERIC(15,2) un valor como 0.2664 se guarda 0.26 y se pierde el
-- dato. 4 decimales conservan el ratio; la escala monetaria no cambia.
ALTER TABLE ratio
  ALTER COLUMN valor_calculado       TYPE NUMERIC(15,4),
  ALTER COLUMN valor_sector_promedio TYPE NUMERIC(15,4),
  ALTER COLUMN diferencia_vs_sector  TYPE NUMERIC(15,4);

ALTER TABLE parametro_sector
  ALTER COLUMN valor_referencia TYPE NUMERIC(15,4);

-- 2) Tipos de ratio --------------------------------------------
INSERT INTO tipo_ratio (nombre_ratio, codigo_ratio, descripcion, unidad_ratio)
SELECT v.nombre, v.codigo, v.descripcion, 'razon'
FROM (VALUES
  ('Apalancamiento', 'APAL', 'Endeudamiento y estructura de capital'),
  ('Actividad',      'ACTI', 'Eficiencia y rotación de cuentas')
) AS v(nombre, codigo, descripcion)
WHERE NOT EXISTS (
  SELECT 1 FROM tipo_ratio t WHERE t.nombre_ratio = v.nombre
);

-- 3) Categorías ------------------------------------------------
-- `nombre_tipo` es la clave que comparan los calculadores
-- (expectedCategory en lib/ratios.ts) y el mapa del cliente en
-- Ratio.tsx. Si se cambia acá, hay que cambiarlo en los dos archivos.
INSERT INTO categoria_ratio (nombre_tipo, descripcion, id_tipo_ratio)
SELECT v.nombre, v.descripcion, t.id_tipo_ratio
FROM (VALUES
  ('Prueba ácida',                       'Liquidez inmediata sin inventario',            'Liquidez'),
  ('Grado de endeudamiento',             'Pasivo total sobre activo total',              'Apalancamiento'),
  ('Grado de propiedad',                 'Patrimonio sobre activo total',                'Apalancamiento'),
  ('Razón de endeudamiento patrimonial', 'Pasivo total sobre patrimonio',                'Apalancamiento')
) AS v(nombre, descripcion, tipo)
JOIN tipo_ratio t ON t.nombre_ratio = v.tipo
WHERE NOT EXISTS (
  SELECT 1 FROM categoria_ratio c WHERE c.nombre_tipo = v.nombre
);

-- 4) Benchmarks ------------------------------------------------
-- Valores de referencia iniciales, coherentes entre sí
-- (endeudamiento 60% + propiedad 40% = 100%). No salen de un estudio
-- sectorial: `fuente` lo deja explícito para que se calibren después.
INSERT INTO parametro_sector
  (nombre_ratio, valor_referencia, fuente, anio_referencia, id_sector, id_categoria_ratio)
SELECT
  v.nombre,
  v.ref,
  'Referencia inicial Módulo C — pendiente de calibración sectorial',
  v.anio,
  e.id_sector,
  c.id_categoria_ratio
FROM (VALUES
  ('Prueba ácida',                       1.00::numeric, 2023),
  ('Prueba ácida',                       1.00::numeric, 2024),
  ('Prueba ácida',                       1.00::numeric, 2025),
  ('Grado de endeudamiento',             0.60::numeric, 2023),
  ('Grado de endeudamiento',             0.60::numeric, 2024),
  ('Grado de endeudamiento',             0.60::numeric, 2025),
  ('Grado de propiedad',                 0.40::numeric, 2023),
  ('Grado de propiedad',                 0.40::numeric, 2024),
  ('Grado de propiedad',                 0.40::numeric, 2025),
  ('Razón de endeudamiento patrimonial', 1.50::numeric, 2023),
  ('Razón de endeudamiento patrimonial', 1.50::numeric, 2024),
  ('Razón de endeudamiento patrimonial', 1.50::numeric, 2025)
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

-- 5) Filas de ratio para Inv ABC -------------------------------
-- Cada fila es "un ratio a calcular" de la UI. Sin ellas, el botón
-- Calcular no existe y `recalcularRatios` no tiene nada que recorrer.
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
    'Prueba ácida',
    'Grado de endeudamiento',
    'Grado de propiedad',
    'Razón de endeudamiento patrimonial'
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
