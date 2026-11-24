CREATE TABLE IF NOT EXISTS producto (
    id_producto     BIGSERIAL PRIMARY KEY,
    codigo_sku      VARCHAR(50)   NOT NULL,
    nombre          VARCHAR(100)  NOT NULL,
    descripcion     VARCHAR(256),
    costo_unitario  NUMERIC(15,2) NOT NULL CHECK (costo_unitario >= 0),
    stock_actual    INTEGER       NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    empresa_id      INTEGER       NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    UNIQUE (empresa_id, codigo_sku)
);

CREATE TABLE IF NOT EXISTS movimiento_inventario (
    id_movimiento   BIGSERIAL PRIMARY KEY,
    producto_id     BIGINT        NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    empresa_id      INTEGER       NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(10)   NOT NULL CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA')),
    cantidad        INTEGER       NOT NULL CHECK (cantidad > 0),
    fecha           DATE          NOT NULL DEFAULT CURRENT_DATE,
    observacion     VARCHAR(256)
);

CREATE TABLE IF NOT EXISTS venta_detalle (
    id_detalle       BIGSERIAL PRIMARY KEY,
    venta_id         BIGINT        NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
    producto_id      BIGINT        NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
    empresa_id       INTEGER       NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    cantidad         NUMERIC(15,4) NOT NULL CHECK (cantidad > 0),
    precio_unitario  NUMERIC(15,4) NOT NULL CHECK (precio_unitario >= 0),
    subtotal         NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
    UNIQUE (venta_id, producto_id)
);

CREATE TABLE IF NOT EXISTS parametro_inventario (
    empresa_id         INTEGER       PRIMARY KEY REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    costo_pedido       NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (costo_pedido >= 0),
    tasa_mantenimiento NUMERIC(8,4)  NOT NULL DEFAULT 0 CHECK (tasa_mantenimiento >= 0),
    lead_time_dias     INTEGER       NOT NULL DEFAULT 0 CHECK (lead_time_dias >= 0),
    dias_anio          INTEGER       NOT NULL DEFAULT 365 CHECK (dias_anio > 0),
    corte_a            NUMERIC(5,4)  NOT NULL DEFAULT 0.8000 CHECK (corte_a > 0 AND corte_a < 1),
    corte_b            NUMERIC(5,4)  NOT NULL DEFAULT 0.9500 CHECK (corte_b > corte_a AND corte_b <= 1)
);

ALTER TABLE venta_detalle ALTER COLUMN precio_unitario TYPE NUMERIC(15,4);
ALTER TABLE producto ALTER COLUMN stock_actual TYPE INTEGER USING ROUND(stock_actual::numeric)::INTEGER;
ALTER TABLE movimiento_inventario ALTER COLUMN cantidad TYPE INTEGER USING ROUND(cantidad::numeric)::INTEGER;

CREATE INDEX IF NOT EXISTS idx_producto_empresa ON producto(empresa_id, activo);
CREATE INDEX IF NOT EXISTS idx_movimiento_empresa ON movimiento_inventario(empresa_id, fecha);
CREATE INDEX IF NOT EXISTS idx_movimiento_producto ON movimiento_inventario(producto_id, fecha);
CREATE INDEX IF NOT EXISTS idx_venta_detalle_empresa ON venta_detalle(empresa_id);
CREATE INDEX IF NOT EXISTS idx_venta_detalle_producto ON venta_detalle(producto_id);

ALTER TABLE producto              ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_detalle         ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametro_inventario  ENABLE ROW LEVEL SECURITY;

INSERT INTO opcion_form (id_opcion, des_opcion, num_form)
VALUES ('12', 'GESTION INVENTARIO', 12)
ON CONFLICT (id_opcion) DO NOTHING;

UPDATE opcion_form SET des_opcion = 'GESTION INVENTARIO' WHERE id_opcion = '12';

INSERT INTO acceso_usuario (usuario_id, id_opcion)
SELECT us.usuario_id, '12'
FROM usuario us
WHERE us.rol = 'ADMIN'
ON CONFLICT (usuario_id, id_opcion) DO NOTHING;

DELETE FROM venta_detalle
WHERE empresa_id = 2
  AND producto_id IN (
      SELECT id_producto FROM producto
      WHERE empresa_id = 2 AND codigo_sku LIKE 'C4-P%'
  );

DELETE FROM movimiento_inventario
WHERE empresa_id = 2
  AND producto_id IN (
      SELECT id_producto FROM producto
      WHERE empresa_id = 2 AND codigo_sku LIKE 'C4-P%'
  );

DELETE FROM venta
WHERE empresa_id = 2 AND observacion LIKE 'C4 DEMO C4-P%';

DELETE FROM producto
WHERE empresa_id = 2 AND codigo_sku LIKE 'C4-P%';

INSERT INTO parametro_inventario (empresa_id, costo_pedido, tasa_mantenimiento, lead_time_dias, dias_anio, corte_a, corte_b)
SELECT 2, 100, 0.2000, 15, 365, 0.8000, 0.9500
WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
ON CONFLICT (empresa_id) DO NOTHING;

UPDATE parametro_inventario
SET costo_pedido = 100, tasa_mantenimiento = 0.2000, lead_time_dias = 15,
    dias_anio = 365, corte_a = 0.8000, corte_b = 0.9500
WHERE empresa_id = 2;

INSERT INTO producto (codigo_sku, nombre, descripcion, costo_unitario, stock_actual, empresa_id)
SELECT v.codigo_sku, v.nombre, v.descripcion, v.costo_unitario, v.stock_actual, 2
FROM (VALUES
    ('INV-001', 'Motor 1.6 L', 'Motor completo 1.6 L para vehículo ligero', 1100.00::numeric, 155),
    ('INV-002', 'Motor 1.8 L', 'Motor completo 1.8 L para vehículo ligero', 1500.00::numeric, 74),
    ('INV-003', 'Motor 1.4 L', 'Motor completo 1.4 L para vehículo ligero', 950.00::numeric, 9),
    ('INV-004', 'Motor 1.0 L', 'Motor completo 1.0 L para vehículo ligero', 650.00::numeric, 7),
    ('INV-005', 'Motor 2.0 L diésel', 'Motor diésel 2.0 L para vehículo ligero', 2400.00::numeric, 43),
    ('INV-006', 'Motor 1.2 L', 'Motor completo 1.2 L para vehículo ligero', 700.00::numeric, 122),
    ('INV-007', 'Motor 1.5 L turbo', 'Motor turbo 1.5 L para vehículo ligero', 1800.00::numeric, 52),
    ('INV-008', 'Motor 2.4 L', 'Motor completo 2.4 L para vehículo ligero', 1250.00::numeric, 89),
    ('INV-009', 'Alternador', 'Alternador de vehículo', 189.99::numeric, 270),
    ('INV-010', 'Bujía', 'Bujía de encendido', 3.81::numeric, 240),
    ('INV-011', 'Filtro de aceite', 'Filtro de aceite de motor', 4.05::numeric, 18996),
    ('INV-012', 'Correa de distribución', 'Correa de distribución de motor', 65.17::numeric, 577),
    ('INV-013', 'Módulo ECU', 'Unidad de control electrónico del motor', 125.00::numeric, 13)
) AS v(codigo_sku, nombre, descripcion, costo_unitario, stock_actual)
WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
ON CONFLICT (empresa_id, codigo_sku) DO NOTHING;

DO $$
BEGIN
  PERFORM set_config('anf.inventario_movimiento','1',true);

  UPDATE producto p
  SET stock_actual = v.stock_actual, costo_unitario = v.costo_unitario
  FROM (VALUES
      ('INV-001', 1100.00::numeric, 155),
      ('INV-002', 1500.00::numeric, 74),
      ('INV-003', 950.00::numeric, 9),
      ('INV-004', 650.00::numeric, 7),
      ('INV-005', 2400.00::numeric, 43),
      ('INV-006', 700.00::numeric, 122),
      ('INV-007', 1800.00::numeric, 52),
      ('INV-008', 1250.00::numeric, 89),
      ('INV-009', 189.99::numeric, 270),
      ('INV-010', 3.81::numeric, 240),
      ('INV-011', 4.05::numeric, 18996),
      ('INV-012', 65.17::numeric, 577),
      ('INV-013', 125.00::numeric, 13)
  ) AS v(codigo_sku, costo_unitario, stock_actual)
  WHERE p.empresa_id = 2 AND p.codigo_sku = v.codigo_sku;

  PERFORM set_config('anf.inventario_movimiento','0',true);
END $$;

WITH datos AS (
    SELECT * FROM (VALUES
        ('INV-001', 233.7276::numeric, 1192.1754::numeric, 278644.30::numeric),
        ('INV-002', 114.1749::numeric, 1627.0026::numeric, 185762.86::numeric),
        ('INV-003', 75.2074::numeric, 1029.1699::numeric, 77401.19::numeric),
        ('INV-004', 87.8407::numeric, 704.9232::numeric, 61920.95::numeric),
        ('INV-005', 59.5307::numeric, 2600.3791::numeric, 154802.39::numeric),
        ('INV-006', 163.1065::numeric, 759.2702::numeric, 123841.91::numeric),
        ('INV-007', 71.3334::numeric, 1953.1124::numeric, 139322.15::numeric),
        ('INV-008', 114.1073::numeric, 1356.6388::numeric, 154802.39::numeric),
        ('INV-009', 450.9732::numeric, 205.9578::numeric, 92881.43::numeric),
        ('INV-010', 11225.4121::numeric, 4.1371::numeric, 46440.72::numeric),
        ('INV-011', 31713.5605::numeric, 4.3931::numeric, 139322.15::numeric),
        ('INV-012', 1314.6801::numeric, 70.6495::numeric, 92881.43::numeric)
    ) AS v(codigo_sku, cantidad, precio_unitario, subtotal)
), nuevas_ventas AS (
    INSERT INTO venta (fecha_venta, monto_venta, observacion, empresa_id)
    SELECT DATE '2023-06-30', d.subtotal, 'INV 2023 ' || d.codigo_sku, 2
    FROM datos d
    WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
      AND NOT EXISTS (SELECT 1 FROM venta v WHERE v.empresa_id = 2 AND v.observacion = 'INV 2023 ' || d.codigo_sku)
    RETURNING id_venta, observacion
)
INSERT INTO venta_detalle (venta_id, producto_id, empresa_id, cantidad, precio_unitario, subtotal)
SELECT v.id_venta, p.id_producto, 2, d.cantidad, d.precio_unitario, d.subtotal
FROM venta v
JOIN datos d ON d.codigo_sku = SUBSTRING(v.observacion FROM 10)
JOIN producto p ON p.empresa_id = 2 AND p.codigo_sku = d.codigo_sku
WHERE v.empresa_id = 2 AND v.observacion LIKE 'INV 2023 %'
ON CONFLICT (venta_id, producto_id) DO NOTHING;

WITH datos AS (
    SELECT * FROM (VALUES
        ('INV-001', 246.2427::numeric, 1195.9369::numeric, 294490.74::numeric),
        ('INV-002', 120.2885::numeric, 1632.1357::numeric, 196327.16::numeric),
        ('INV-003', 79.2345::numeric, 1032.4162::numeric, 81802.98::numeric),
        ('INV-004', 92.5442::numeric, 707.1474::numeric, 65442.39::numeric),
        ('INV-005', 62.7183::numeric, 2608.5843::numeric, 163605.97::numeric),
        ('INV-006', 171.8401::numeric, 761.6660::numeric, 130884.77::numeric),
        ('INV-007', 75.1529::numeric, 1959.2773::numeric, 147245.37::numeric),
        ('INV-008', 120.2172::numeric, 1360.9198::numeric, 163605.97::numeric),
        ('INV-009', 475.1208::numeric, 206.6076::numeric, 98163.58::numeric),
        ('INV-010', 11826.4856::numeric, 4.1502::numeric, 49081.79::numeric),
        ('INV-011', 33411.7728::numeric, 4.4070::numeric, 147245.37::numeric),
        ('INV-012', 1385.0746::numeric, 70.8724::numeric, 98163.59::numeric)
    ) AS v(codigo_sku, cantidad, precio_unitario, subtotal)
), nuevas_ventas AS (
    INSERT INTO venta (fecha_venta, monto_venta, observacion, empresa_id)
    SELECT DATE '2024-06-30', d.subtotal, 'INV 2024 ' || d.codigo_sku, 2
    FROM datos d
    WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
      AND NOT EXISTS (SELECT 1 FROM venta v WHERE v.empresa_id = 2 AND v.observacion = 'INV 2024 ' || d.codigo_sku)
    RETURNING id_venta, observacion
)
INSERT INTO venta_detalle (venta_id, producto_id, empresa_id, cantidad, precio_unitario, subtotal)
SELECT v.id_venta, p.id_producto, 2, d.cantidad, d.precio_unitario, d.subtotal
FROM venta v
JOIN datos d ON d.codigo_sku = SUBSTRING(v.observacion FROM 10)
JOIN producto p ON p.empresa_id = 2 AND p.codigo_sku = d.codigo_sku
WHERE v.empresa_id = 2 AND v.observacion LIKE 'INV 2024 %'
ON CONFLICT (venta_id, producto_id) DO NOTHING;

WITH datos AS (
    SELECT * FROM (VALUES
        ('INV-001', 260.7070::numeric, 1207.6760::numeric, 314849.58::numeric),
        ('INV-002', 127.3542::numeric, 1648.1570::numeric, 209899.72::numeric),
        ('INV-003', 83.8887::numeric, 1042.5507::numeric, 87458.22::numeric),
        ('INV-004', 97.9803::numeric, 714.0881::numeric, 69966.57::numeric),
        ('INV-005', 66.4024::numeric, 2634.1885::numeric, 174916.44::numeric),
        ('INV-006', 181.9340::numeric, 769.1424::numeric, 139933.15::numeric),
        ('INV-007', 79.5674::numeric, 1978.5087::numeric, 157424.79::numeric),
        ('INV-008', 127.2788::numeric, 1374.2779::numeric, 174916.44::numeric),
        ('INV-009', 503.0295::numeric, 208.6356::numeric, 104949.86::numeric),
        ('INV-010', 12521.1759::numeric, 4.1909::numeric, 52474.93::numeric),
        ('INV-011', 35374.3802::numeric, 4.4502::numeric, 157424.79::numeric),
        ('INV-012', 1466.4342::numeric, 71.5681::numeric, 104949.86::numeric)
    ) AS v(codigo_sku, cantidad, precio_unitario, subtotal)
), nuevas_ventas AS (
    INSERT INTO venta (fecha_venta, monto_venta, observacion, empresa_id)
    SELECT DATE '2025-06-30', d.subtotal, 'INV 2025 ' || d.codigo_sku, 2
    FROM datos d
    WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
      AND NOT EXISTS (SELECT 1 FROM venta v WHERE v.empresa_id = 2 AND v.observacion = 'INV 2025 ' || d.codigo_sku)
    RETURNING id_venta, observacion
)
INSERT INTO venta_detalle (venta_id, producto_id, empresa_id, cantidad, precio_unitario, subtotal)
SELECT v.id_venta, p.id_producto, 2, d.cantidad, d.precio_unitario, d.subtotal
FROM venta v
JOIN datos d ON d.codigo_sku = SUBSTRING(v.observacion FROM 10)
JOIN producto p ON p.empresa_id = 2 AND p.codigo_sku = d.codigo_sku
WHERE v.empresa_id = 2 AND v.observacion LIKE 'INV 2025 %'
ON CONFLICT (venta_id, producto_id) DO NOTHING;

INSERT INTO movimiento_inventario (producto_id, empresa_id, tipo_movimiento, cantidad, fecha, observacion)
SELECT p.id_producto, 2, 'ENTRADA', d.cantidad, d.fecha, d.observacion
FROM (VALUES
    ('INV-001', 116, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-002', 56, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-003', 7, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-004', 5, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-005', 32, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-006', 92, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-007', 39, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-008', 67, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-009', 203, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-010', 180, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-011', 14247, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-012', 433, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-001', 246, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-002', 120, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-003', 76, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-004', 88, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-005', 64, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-006', 172, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-007', 76, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-008', 121, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-009', 472, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-010', 11245, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-011', 33212, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-012', 1360, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-001', 259, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-002', 126, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-003', 80, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-004', 93, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-005', 66, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-006', 182, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-007', 79, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-008', 128, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-009', 497, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-010', 11846, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-011', 34991, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-012', 1433, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-001', 275, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-002', 134, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-003', 84, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-004', 99, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-005', 70, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-006', 193, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-007', 84, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-008', 135, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-009', 527, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-010', 12542, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-011', 37046, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-012', 1517, DATE '2025-01-05', 'INV compras 2025')
) AS d(codigo_sku, cantidad, fecha, observacion)
JOIN producto p ON p.empresa_id = 2 AND p.codigo_sku = d.codigo_sku
WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
  AND NOT EXISTS (
      SELECT 1 FROM movimiento_inventario m
      WHERE m.empresa_id = 2 AND m.producto_id = p.id_producto AND m.observacion = d.observacion
  );
