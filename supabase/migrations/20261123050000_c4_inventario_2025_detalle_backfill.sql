BEGIN;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
