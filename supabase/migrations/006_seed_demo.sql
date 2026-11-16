-- ============================================================
-- 006 — Módulo A (A5): datos mínimos para probar la carga unificada
--
-- Qué hace:
--   1. En una BD vacía crea un sector y la empresa Inv ABC con
--      empresa_id = 2 (los seeds 003/004 del Módulo C dependen de ese id).
--   2. La marca como empresa principal si no hay otra.
--   3. Agrega al catálogo SOLO las cuentas que usan las plantillas de
--      ejemplo y que todavía no existan. El catálogo real (FINAN II 2025)
--      no se modifica: cada cuenta nueva se cuelga del padre existente con
--      el prefijo más largo.
--   4. Activa esas cuentas en el catálogo de la empresa principal.
--
-- Requiere 005. Idempotente: se puede correr dos veces.
-- Archivos de ejemplo: public/templates/ejemplo_estados_2020.xlsx y
-- ejemplo_estados_2021.xlsx (años sin datos reales).
-- ============================================================

-- 1) Sector y empresa ------------------------------------------
INSERT INTO sector (nombre_sector, descripcion, pais_referencia, fuente_datos)
SELECT 'Comercio', 'Empresas comerciales', 'El Salvador', 'Seed 006'
WHERE NOT EXISTS (SELECT 1 FROM empresa)
  AND NOT EXISTS (SELECT 1 FROM sector WHERE nombre_sector = 'Comercio');

INSERT INTO empresa (empresa_id, nombre_empresa, id_sector)
SELECT 2, 'Inv ABC', (SELECT id_sector FROM sector WHERE nombre_sector = 'Comercio' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM empresa);

-- la inserción con id explícito no avanza la secuencia
SELECT setval(
  pg_get_serial_sequence('empresa', 'empresa_id'),
  GREATEST((SELECT COALESCE(MAX(empresa_id), 1) FROM empresa), 1)
);

-- 2) Empresa principal -----------------------------------------
-- Inv ABC (id 2) si existe; si no, la de menor id.
UPDATE empresa SET es_principal = TRUE
WHERE empresa_id = COALESCE(
        (SELECT empresa_id FROM empresa WHERE empresa_id = 2),
        (SELECT MIN(empresa_id) FROM empresa))
  AND NOT EXISTS (SELECT 1 FROM empresa WHERE es_principal);

-- 3) Cuentas de las plantillas ---------------------------------
WITH nuevas(codigo, nombre, tipo) AS (
  VALUES
    ('1101.01', 'Caja',                               'ACTIVO'),
    ('1101.02', 'Bancos',                             'ACTIVO'),
    ('1102',    'Cuentas y documentos por cobrar',    'ACTIVO'),
    ('1105',    'Inventarios',                        'ACTIVO'),
    ('1201',    'Propiedades, planta y equipo',       'ACTIVO'),
    ('2101',    'Préstamos y sobregiros bancarios',   'PASIVO'),
    ('2102',    'Cuentas comerciales por pagar',      'PASIVO'),
    ('2201',    'Préstamos bancarios a largo plazo',  'PASIVO'),
    ('3101',    'Capital social',                     'PATRIMONIO'),
    ('3204',    'Resultado del presente ejercicio',   'PATRIMONIO'),
    ('4101',    'Costo de ventas',                    'COSTOS Y GASTOS'),
    ('4102',    'Gastos de administración',           'COSTOS Y GASTOS'),
    ('4103',    'Gastos de venta',                    'COSTOS Y GASTOS'),
    ('4201',    'Gastos financieros',                 'COSTOS Y GASTOS'),
    ('5101.01', 'Ventas',                             'INGRESOS'),
    ('5101.02', 'Rebajas y devoluciones sobre ventas','INGRESOS')
)
INSERT INTO cuenta (cue_cuenta_id, nombre_cuenta, codigo_individual, codigo_generado, tipo_cuenta, id_cuenta_padre, is_postable)
SELECT n.codigo, n.nombre, n.codigo, n.codigo, n.tipo,
       (SELECT p.cuenta_id FROM cuenta p
        WHERE n.codigo LIKE p.cue_cuenta_id || '%' AND p.cue_cuenta_id <> n.codigo
        ORDER BY length(p.cue_cuenta_id) DESC
        LIMIT 1),
       TRUE
FROM nuevas n
WHERE NOT EXISTS (SELECT 1 FROM cuenta c WHERE c.cue_cuenta_id = n.codigo);

-- 4) Catálogo de la empresa principal ---------------------------
INSERT INTO catalogo (activo, empresa_id, cuenta_id)
SELECT TRUE, e.empresa_id, c.cuenta_id
FROM empresa e
JOIN cuenta c ON c.cue_cuenta_id IN (
  '1101.01', '1101.02', '1102', '1105', '1201', '2101', '2102', '2201',
  '3101', '3204', '4101', '4102', '4103', '4201', '5101.01', '5101.02'
)
WHERE e.es_principal
ON CONFLICT (empresa_id, cuenta_id) DO NOTHING;
