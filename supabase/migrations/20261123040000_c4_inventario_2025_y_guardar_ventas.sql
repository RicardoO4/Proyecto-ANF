BEGIN;

CREATE OR REPLACE FUNCTION public.guardar_ventas_mensuales(p_empresa_id INTEGER, p_ventas JSONB, p_id INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v JSONB; fecha DATE; mes TEXT; meses TEXT[] := '{}'; monto NUMERIC; observ TEXT; identificador INTEGER;
BEGIN
  IF jsonb_typeof(p_ventas) <> 'array' OR jsonb_array_length(p_ventas) NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'Ingrese entre 1 y 600 ventas mensuales.';
  END IF;
  IF p_id IS NOT NULL AND jsonb_array_length(p_ventas) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'La edición requiere una sola venta.';
  END IF;
  PERFORM pg_advisory_xact_lock(p_empresa_id, -203);
  IF NOT EXISTS (SELECT 1 FROM empresa WHERE empresa_id = p_empresa_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'Empresa no encontrada.';
  END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM venta WHERE id_venta = p_id AND empresa_id = p_empresa_id
      AND (observacion IS NULL OR (observacion NOT LIKE 'Generado desde estados financieros %' AND observacion !~ '^INV [0-9]{4} '))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'No se puede editar un total anual automático ni una venta de detalle por SKU como venta mensual.';
  END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(p_ventas) LOOP
    fecha := (v->>'fechaVenta')::DATE; monto := (v->>'montoVenta')::NUMERIC; observ := NULLIF(btrim(v->>'observacion'), '');
    IF fecha IS NULL OR monto IS NULL OR monto < 0 OR monto::TEXT IN ('NaN', 'Infinity', '-Infinity')
       OR extract(year FROM fecha) NOT BETWEEN 1900 AND 2200
       OR observ LIKE 'Generado desde estados financieros %'
       OR observ ~ '^INV [0-9]{4} ' THEN
      RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'Fecha, monto u observación inválidos.';
    END IF;
    mes := to_char(fecha, 'YYYY-MM');
    IF mes = ANY(meses) OR EXISTS (
      SELECT 1 FROM venta WHERE empresa_id = p_empresa_id
        AND fecha_venta >= date_trunc('month', fecha::TIMESTAMP)::DATE
        AND fecha_venta < (date_trunc('month', fecha::TIMESTAMP) + interval '1 month')::DATE
        AND (p_id IS NULL OR id_venta <> p_id)
        AND (observacion IS NULL OR (observacion NOT LIKE 'Generado desde estados financieros %' AND observacion !~ '^INV [0-9]{4} '))
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'Ya existe una venta mensual para ' || mes || '. Edite el registro existente.';
    END IF;
    meses := array_append(meses, mes);
    IF p_id IS NULL THEN
      INSERT INTO venta (empresa_id, fecha_venta, monto_venta, observacion)
      VALUES (p_empresa_id, fecha, round(monto, 2), observ) RETURNING id_venta INTO identificador;
    ELSE
      UPDATE venta SET fecha_venta = fecha, monto_venta = round(monto, 2), observacion = observ
      WHERE id_venta = p_id RETURNING id_venta INTO identificador;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('cantidad', jsonb_array_length(p_ventas), 'id', identificador);
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_ventas_mensuales(INTEGER, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_ventas_mensuales(INTEGER, JSONB, INTEGER) TO service_role;

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
SELECT id_venta, observacion FROM nuevas_ventas;

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
