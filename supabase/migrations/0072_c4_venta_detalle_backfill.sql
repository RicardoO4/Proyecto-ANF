BEGIN;

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
)
INSERT INTO venta_detalle (venta_id, producto_id, empresa_id, cantidad, precio_unitario, subtotal)
SELECT v.id_venta, p.id_producto, 2, d.cantidad, d.precio_unitario, d.subtotal
FROM venta v
JOIN datos d ON d.codigo_sku = SUBSTRING(v.observacion FROM 10)
JOIN producto p ON p.empresa_id = 2 AND p.codigo_sku = d.codigo_sku
WHERE v.empresa_id = 2 AND v.observacion LIKE 'INV 2025 %'
ON CONFLICT (venta_id, producto_id) DO NOTHING;

COMMIT;
