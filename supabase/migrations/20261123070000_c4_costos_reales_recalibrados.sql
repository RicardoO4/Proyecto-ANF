BEGIN;

DO $$
BEGIN
  PERFORM set_config('anf.inventario_movimiento','1',true);

  UPDATE public.producto AS p
  SET costo_unitario = v.costo_unitario,
      stock_actual = v.stock_actual
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
  WHERE p.empresa_id = 2
    AND p.codigo_sku = v.codigo_sku
    AND (p.costo_unitario, p.stock_actual) IS DISTINCT FROM (v.costo_unitario, v.stock_actual);

  PERFORM set_config('anf.inventario_movimiento','0',true);
END $$;

WITH datos AS (
    SELECT * FROM (VALUES
        (2023, 'INV-001', 233.7276::numeric, 1192.1754::numeric),
        (2023, 'INV-002', 114.1749::numeric, 1627.0026::numeric),
        (2023, 'INV-003', 75.2074::numeric, 1029.1699::numeric),
        (2023, 'INV-004', 87.8407::numeric, 704.9232::numeric),
        (2023, 'INV-005', 59.5307::numeric, 2600.3791::numeric),
        (2023, 'INV-006', 163.1065::numeric, 759.2702::numeric),
        (2023, 'INV-007', 71.3334::numeric, 1953.1124::numeric),
        (2023, 'INV-008', 114.1073::numeric, 1356.6388::numeric),
        (2023, 'INV-009', 450.9732::numeric, 205.9578::numeric),
        (2023, 'INV-010', 11225.4121::numeric, 4.1371::numeric),
        (2023, 'INV-011', 31713.5605::numeric, 4.3931::numeric),
        (2023, 'INV-012', 1314.6801::numeric, 70.6495::numeric),
        (2024, 'INV-001', 246.2427::numeric, 1195.9369::numeric),
        (2024, 'INV-002', 120.2885::numeric, 1632.1357::numeric),
        (2024, 'INV-003', 79.2345::numeric, 1032.4162::numeric),
        (2024, 'INV-004', 92.5442::numeric, 707.1474::numeric),
        (2024, 'INV-005', 62.7183::numeric, 2608.5843::numeric),
        (2024, 'INV-006', 171.8401::numeric, 761.6660::numeric),
        (2024, 'INV-007', 75.1529::numeric, 1959.2773::numeric),
        (2024, 'INV-008', 120.2172::numeric, 1360.9198::numeric),
        (2024, 'INV-009', 475.1208::numeric, 206.6076::numeric),
        (2024, 'INV-010', 11826.4856::numeric, 4.1502::numeric),
        (2024, 'INV-011', 33411.7728::numeric, 4.4070::numeric),
        (2024, 'INV-012', 1385.0746::numeric, 70.8724::numeric),
        (2025, 'INV-001', 260.7070::numeric, 1207.6760::numeric),
        (2025, 'INV-002', 127.3542::numeric, 1648.1570::numeric),
        (2025, 'INV-003', 83.8887::numeric, 1042.5507::numeric),
        (2025, 'INV-004', 97.9803::numeric, 714.0881::numeric),
        (2025, 'INV-005', 66.4024::numeric, 2634.1885::numeric),
        (2025, 'INV-006', 181.9340::numeric, 769.1424::numeric),
        (2025, 'INV-007', 79.5674::numeric, 1978.5087::numeric),
        (2025, 'INV-008', 127.2788::numeric, 1374.2779::numeric),
        (2025, 'INV-009', 503.0295::numeric, 208.6356::numeric),
        (2025, 'INV-010', 12521.1759::numeric, 4.1909::numeric),
        (2025, 'INV-011', 35374.3802::numeric, 4.4502::numeric),
        (2025, 'INV-012', 1466.4342::numeric, 71.5681::numeric)
    ) AS v(anio, codigo_sku, cantidad, precio_unitario)
)
UPDATE public.venta_detalle AS d
SET cantidad = datos.cantidad,
    precio_unitario = datos.precio_unitario
FROM datos
JOIN public.venta AS ven ON ven.observacion = 'INV ' || datos.anio::text || ' ' || datos.codigo_sku
JOIN public.producto AS p ON p.codigo_sku = datos.codigo_sku
WHERE d.empresa_id = 2
  AND d.venta_id = ven.id_venta
  AND d.producto_id = p.id_producto
  AND ven.empresa_id = 2
  AND p.empresa_id = 2
  AND (d.cantidad, d.precio_unitario) IS DISTINCT FROM (datos.cantidad, datos.precio_unitario);

WITH datos AS (
    SELECT * FROM (VALUES
        ('INV-001', 'INV apertura 2022', 116),
        ('INV-002', 'INV apertura 2022', 56),
        ('INV-003', 'INV apertura 2022', 7),
        ('INV-004', 'INV apertura 2022', 5),
        ('INV-005', 'INV apertura 2022', 32),
        ('INV-006', 'INV apertura 2022', 92),
        ('INV-007', 'INV apertura 2022', 39),
        ('INV-008', 'INV apertura 2022', 67),
        ('INV-009', 'INV apertura 2022', 203),
        ('INV-010', 'INV apertura 2022', 180),
        ('INV-011', 'INV apertura 2022', 14247),
        ('INV-012', 'INV apertura 2022', 433),
        ('INV-001', 'INV compras 2023', 246),
        ('INV-002', 'INV compras 2023', 120),
        ('INV-003', 'INV compras 2023', 76),
        ('INV-004', 'INV compras 2023', 88),
        ('INV-005', 'INV compras 2023', 64),
        ('INV-006', 'INV compras 2023', 172),
        ('INV-007', 'INV compras 2023', 76),
        ('INV-008', 'INV compras 2023', 121),
        ('INV-009', 'INV compras 2023', 472),
        ('INV-010', 'INV compras 2023', 11245),
        ('INV-011', 'INV compras 2023', 33212),
        ('INV-012', 'INV compras 2023', 1360),
        ('INV-001', 'INV compras 2024', 259),
        ('INV-002', 'INV compras 2024', 126),
        ('INV-003', 'INV compras 2024', 80),
        ('INV-004', 'INV compras 2024', 93),
        ('INV-005', 'INV compras 2024', 66),
        ('INV-006', 'INV compras 2024', 182),
        ('INV-007', 'INV compras 2024', 79),
        ('INV-008', 'INV compras 2024', 128),
        ('INV-009', 'INV compras 2024', 497),
        ('INV-010', 'INV compras 2024', 11846),
        ('INV-011', 'INV compras 2024', 34991),
        ('INV-012', 'INV compras 2024', 1433),
        ('INV-001', 'INV compras 2025', 275),
        ('INV-002', 'INV compras 2025', 134),
        ('INV-003', 'INV compras 2025', 114),
        ('INV-004', 'INV compras 2025', 199),
        ('INV-005', 'INV compras 2025', 70),
        ('INV-006', 'INV compras 2025', 193),
        ('INV-007', 'INV compras 2025', 84),
        ('INV-008', 'INV compras 2025', 135),
        ('INV-009', 'INV compras 2025', 527),
        ('INV-010', 'INV compras 2025', 12542),
        ('INV-011', 'INV compras 2025', 37046),
        ('INV-012', 'INV compras 2025', 1517)
    ) AS v(codigo_sku, observacion, cantidad)
)
UPDATE public.movimiento_inventario AS m
SET cantidad = datos.cantidad
FROM datos
JOIN public.producto AS p ON p.codigo_sku = datos.codigo_sku
WHERE m.empresa_id = 2
  AND m.producto_id = p.id_producto
  AND p.empresa_id = 2
  AND m.observacion = datos.observacion
  AND m.cantidad IS DISTINCT FROM datos.cantidad;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.venta_detalle WHERE empresa_id = 2) <> 36 THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: El detalle de inventario debe tener 36 filas.';
  END IF;

  IF EXISTS (
    WITH conteo AS (
      SELECT split_part(ven.observacion, ' ', 2)::INTEGER AS anio, COUNT(*) AS filas
      FROM public.venta_detalle d
      JOIN public.venta ven ON ven.id_venta = d.venta_id
      WHERE d.empresa_id = 2
        AND ven.empresa_id = 2
        AND ven.observacion LIKE 'INV 20__ %'
      GROUP BY 1
    ), esperado(anio, filas) AS (
      VALUES (2023, 12::BIGINT), (2024, 12::BIGINT), (2025, 12::BIGINT)
    )
    SELECT 1
    FROM esperado e
    LEFT JOIN conteo c ON c.anio = e.anio
    WHERE c.filas IS DISTINCT FROM e.filas
  ) THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: Cada anio debe tener 12 filas de detalle.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.venta_detalle d
    JOIN public.venta ven ON ven.id_venta = d.venta_id
    WHERE d.empresa_id = 2
      AND ven.empresa_id = 2
      AND ven.observacion LIKE 'INV 20__ %'
      AND d.subtotal IS DISTINCT FROM ven.monto_venta
  ) THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: El subtotal del detalle no cuadra con la venta.';
  END IF;

  IF EXISTS (
    WITH calculado AS (
      SELECT split_part(ven.observacion, ' ', 2)::INTEGER AS anio,
             ROUND(SUM(ven.monto_venta), 2) AS total
      FROM public.venta ven
      WHERE ven.empresa_id = 2
        AND ven.observacion LIKE 'INV 20__ %'
      GROUP BY 1
    ), esperado(anio, total) AS (
      VALUES (2023, 1548023.87::numeric), (2024, 1636059.68::numeric), (2025, 1749164.35::numeric)
    )
    SELECT 1
    FROM esperado e
    LEFT JOIN calculado c ON c.anio = e.anio
    WHERE c.total IS DISTINCT FROM e.total
  ) THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: Los totales anuales de venta cambiaron.';
  END IF;

  IF EXISTS (
    WITH calculado AS (
      SELECT split_part(ven.observacion, ' ', 2)::INTEGER AS anio,
             ROUND(SUM(ROUND(d.cantidad * p.costo_unitario, 2)), 2) AS total
      FROM public.venta_detalle d
      JOIN public.venta ven ON ven.id_venta = d.venta_id
      JOIN public.producto p ON p.id_producto = d.producto_id
      WHERE d.empresa_id = 2
        AND ven.empresa_id = 2
        AND p.empresa_id = 2
        AND ven.observacion LIKE 'INV 20__ %'
      GROUP BY 1
    ), esperado(anio, total) AS (
      VALUES (2023, 1427555.52::numeric), (2024, 1503995.04::numeric), (2025, 1592339.86::numeric)
    )
    SELECT 1
    FROM esperado e
    LEFT JOIN calculado c ON c.anio = e.anio
    WHERE c.total IS DISTINCT FROM e.total
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE='ANF04',
      MESSAGE='ANF04: El costo anual recalculado no cuadra. Calculado=' || COALESCE((
        WITH calculado AS (
          SELECT split_part(ven.observacion, ' ', 2)::INTEGER AS anio,
                 ROUND(SUM(ROUND(d.cantidad * p.costo_unitario, 2)), 2) AS total,
                 ROUND(SUM(d.cantidad * p.costo_unitario), 2) AS raw
          FROM public.venta_detalle d
          JOIN public.venta ven ON ven.id_venta = d.venta_id
          JOIN public.producto p ON p.id_producto = d.producto_id
          WHERE d.empresa_id = 2
            AND ven.empresa_id = 2
            AND p.empresa_id = 2
            AND ven.observacion LIKE 'INV 20__ %'
          GROUP BY 1
        )
        SELECT string_agg(anio::text || ':' || total::text || '(raw ' || raw::text || ')', ',' ORDER BY anio)
        FROM calculado
      ), 'sin filas') || ' Esperado=2023:1427555.52,2024:1503995.04,2025:1592339.86';
  END IF;

  IF (SELECT COUNT(*) FROM public.producto WHERE empresa_id = 2 AND codigo_sku BETWEEN 'INV-001' AND 'INV-012') <> 12
     OR (SELECT ROUND(SUM(costo_unitario * stock_actual), 2)
         FROM public.producto
         WHERE empresa_id = 2 AND codigo_sku BETWEEN 'INV-001' AND 'INV-012') <> 854798.59::numeric THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: El valor de stock de 12 SKU no cuadra.';
  END IF;

  IF (SELECT COUNT(*) FROM public.producto WHERE empresa_id = 2 AND codigo_sku LIKE 'INV-%') <> 13
     OR (SELECT ROUND(SUM(costo_unitario * stock_actual), 2)
         FROM public.producto
         WHERE empresa_id = 2 AND codigo_sku LIKE 'INV-%') <> 856423.59::numeric THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: El valor de stock de 13 SKU no cuadra.';
  END IF;

  IF (SELECT stock_actual FROM public.producto WHERE empresa_id = 2 AND codigo_sku = 'INV-013') <> 13 THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: El stock de INV-013 debe ser 13.';
  END IF;

  IF (SELECT COUNT(*) FROM public.movimiento_inventario WHERE empresa_id = 2) <> 51 THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: No se deben agregar ni eliminar movimientos.';
  END IF;

  IF EXISTS (
    WITH libro AS (
      SELECT p.codigo_sku,
             ROUND(
               COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'ENTRADA' THEN m.cantidad::numeric ELSE -m.cantidad::numeric END), 0)
               - COALESCE((
                   SELECT SUM(d.cantidad)
                   FROM public.venta_detalle d
                   JOIN public.venta ven ON ven.id_venta = d.venta_id
                   WHERE d.empresa_id = 2
                     AND ven.empresa_id = 2
                     AND d.producto_id = p.id_producto
                     AND ven.observacion LIKE 'INV 20__ %'
                 ), 0),
               0
             ) AS stock_libro,
             p.stock_actual
      FROM public.producto p
      LEFT JOIN public.movimiento_inventario m ON m.producto_id = p.id_producto AND m.empresa_id = 2
      WHERE p.empresa_id = 2
        AND p.codigo_sku <> 'INV-013'
      GROUP BY p.codigo_sku, p.id_producto, p.stock_actual
    )
    SELECT 1
    FROM libro
    WHERE stock_libro <> stock_actual::numeric
  ) THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='ANF04: El libro de movimientos no cuadra con el stock.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
