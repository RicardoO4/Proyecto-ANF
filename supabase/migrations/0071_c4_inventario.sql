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
    ('INV-001', 'Laptop Core i5 16GB', 'Portátil corporativo 16 GB RAM / 512 GB SSD', 850.55::numeric, 201),
    ('INV-002', 'Monitor LED 24 pulgadas', 'Monitor Full HD 24 pulgadas', 189.97::numeric, 585),
    ('INV-003', 'Teclado mecánico', 'Teclado mecánico retroiluminado', 28.03::numeric, 305),
    ('INV-004', 'Mouse inalámbrico', 'Mouse óptico inalámbrico 2.4 GHz', 15.00::numeric, 285),
    ('INV-005', 'Impresora láser', 'Impresora láser monocroma de escritorio', 420.39::numeric, 244),
    ('INV-006', 'Toner negro', 'Cartucho de toner negro alta capacidad', 61.99::numeric, 1379),
    ('INV-007', 'Silla ergonómica', 'Silla de oficina con soporte lumbar', 114.94::numeric, 818),
    ('INV-008', 'Escritorio 1.20 m', 'Escritorio modular de oficina 1.20 m', 159.88::numeric, 695),
    ('INV-009', 'Switch 8 puertos', 'Switch Ethernet 8 puertos 10/100/1000', 48.02::numeric, 1068),
    ('INV-010', 'Cable HDMI 2 m', 'Cable HDMI 2.0 de 2 metros', 7.99::numeric, 107),
    ('INV-011', 'Disco SSD 512 GB', 'Unidad SSD SATA 512 GB', 94.98::numeric, 810),
    ('INV-012', 'Router Wi-Fi', 'Router inalámbrico doble banda', 78.03::numeric, 482)
) AS v(codigo_sku, nombre, descripcion, costo_unitario, stock_actual)
WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
ON CONFLICT (empresa_id, codigo_sku) DO NOTHING;

UPDATE producto p
SET stock_actual = v.stock_actual, costo_unitario = v.costo_unitario
FROM (VALUES
    ('INV-001', 850.55::numeric, 201),
    ('INV-002', 189.97::numeric, 585),
    ('INV-003', 28.03::numeric, 305),
    ('INV-004', 15.00::numeric, 285),
    ('INV-005', 420.39::numeric, 244),
    ('INV-006', 61.99::numeric, 1379),
    ('INV-007', 114.94::numeric, 818),
    ('INV-008', 159.88::numeric, 695),
    ('INV-009', 48.02::numeric, 1068),
    ('INV-010', 7.99::numeric, 107),
    ('INV-011', 94.98::numeric, 810),
    ('INV-012', 78.03::numeric, 482)
) AS v(codigo_sku, costo_unitario, stock_actual)
WHERE p.empresa_id = 2 AND p.codigo_sku = v.codigo_sku;

WITH datos AS (
    SELECT * FROM (VALUES
        ('INV-001', 302.2754::numeric, 921.822616::numeric, 278644.30::numeric),
        ('INV-002', 901.5232::numeric, 206.054442::numeric, 185762.86::numeric),
        ('INV-003', 2548.9496::numeric, 30.365916::numeric, 77401.19::numeric),
        ('INV-004', 3806.4313::numeric, 16.267455::numeric, 61920.95::numeric),
        ('INV-005', 339.8599::numeric, 455.488835::numeric, 154802.39::numeric),
        ('INV-006', 1841.8216::numeric, 67.238819::numeric, 123841.91::numeric),
        ('INV-007', 1117.1048::numeric, 124.717171::numeric, 139322.15::numeric),
        ('INV-008', 892.1323::numeric, 173.519544::numeric, 154802.39::numeric),
        ('INV-009', 1784.2647::numeric, 52.055858::numeric, 92881.43::numeric),
        ('INV-010', 5352.7941::numeric, 8.675977::numeric, 46440.72::numeric),
        ('INV-011', 1352.2848::numeric, 103.027225::numeric, 139322.15::numeric),
        ('INV-012', 1098.0098::numeric, 84.590711::numeric, 92881.43::numeric)
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
        ('INV-001', 318.4610::numeric, 924.730940::numeric, 294490.74::numeric),
        ('INV-002', 949.7959::numeric, 206.704577::numeric, 196327.16::numeric),
        ('INV-003', 2685.4349::numeric, 30.461725::numeric, 81802.98::numeric),
        ('INV-004', 4010.2495::numeric, 16.318783::numeric, 65442.39::numeric),
        ('INV-005', 358.0580::numeric, 456.925889::numeric, 163605.97::numeric),
        ('INV-006', 1940.4433::numeric, 67.450963::numeric, 130884.77::numeric),
        ('INV-007', 1176.9210::numeric, 125.110666::numeric, 147245.37::numeric),
        ('INV-008', 939.9022::numeric, 174.067015::numeric, 163605.97::numeric),
        ('INV-009', 1879.8045::numeric, 52.220101::numeric, 98163.58::numeric),
        ('INV-010', 5639.4134::numeric, 8.703350::numeric, 49081.79::numeric),
        ('INV-011', 1424.6939::numeric, 103.352285::numeric, 147245.37::numeric),
        ('INV-012', 1156.8027::numeric, 84.857677::numeric, 98163.59::numeric)
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
        ('INV-001', 337.1674::numeric, 933.807895::numeric, 314849.58::numeric),
        ('INV-002', 1005.5870::numeric, 208.733526::numeric, 209899.72::numeric),
        ('INV-003', 2843.1777::numeric, 30.760729::numeric, 87458.22::numeric),
        ('INV-004', 4245.8120::numeric, 16.478961::numeric, 69966.57::numeric),
        ('INV-005', 379.0904::numeric, 461.410893::numeric, 174916.44::numeric),
        ('INV-006', 2054.4251::numeric, 68.113045::numeric, 139933.15::numeric),
        ('INV-007', 1246.0535::numeric, 126.338709::numeric, 157424.79::numeric),
        ('INV-008', 995.1122::numeric, 175.775596::numeric, 174916.44::numeric),
        ('INV-009', 1990.2244::numeric, 52.732677::numeric, 104949.86::numeric),
        ('INV-010', 5970.6731::numeric, 8.788780::numeric, 52474.93::numeric),
        ('INV-011', 1508.3806::numeric, 104.366756::numeric, 157424.79::numeric),
        ('INV-012', 1224.7535::numeric, 85.690598::numeric, 104949.86::numeric)
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
    ('INV-001', 121, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-002', 353, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-003', 184, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-004', 172, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-005', 147, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-006', 832, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-007', 493, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-008', 419, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-009', 645, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-010', 64, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-011', 489, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-012', 291, DATE '2022-12-31', 'INV apertura 2022'),
    ('INV-001', 343, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-002', 1019, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-003', 2610, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-004', 3864, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-005', 389, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-006', 2119, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-007', 1282, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-008', 1032, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-009', 1999, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-010', 5374, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-011', 1515, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-012', 1195, DATE '2023-01-05', 'INV compras 2023'),
    ('INV-001', 345, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-002', 1027, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-003', 2726, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-004', 4048, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-005', 390, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-006', 2122, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-007', 1285, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-008', 1032, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-009', 2021, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-010', 5654, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-011', 1532, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-012', 1220, DATE '2024-01-05', 'INV compras 2024'),
    ('INV-001', 350, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-002', 1043, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-003', 2862, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-004', 4264, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-005', 395, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-006', 2142, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-007', 1298, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-008', 1039, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-009', 2058, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-010', 5977, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-011', 1560, DATE '2025-01-05', 'INV compras 2025'),
    ('INV-012', 1255, DATE '2025-01-05', 'INV compras 2025')
) AS d(codigo_sku, cantidad, fecha, observacion)
JOIN producto p ON p.empresa_id = 2 AND p.codigo_sku = d.codigo_sku
WHERE EXISTS (SELECT 1 FROM empresa WHERE empresa_id = 2)
  AND NOT EXISTS (
      SELECT 1 FROM movimiento_inventario m
      WHERE m.empresa_id = 2 AND m.producto_id = p.id_producto AND m.observacion = d.observacion
  );
