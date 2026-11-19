-- Permite diciembre mensual junto al total anual y valida lotes de forma atómica.
-- No cambia registros previos ni elimina ventas. Solo el servidor puede invocarla.
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
      AND (observacion IS NULL OR observacion NOT LIKE 'Generado desde estados financieros %')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'No se puede editar un total anual automático como venta mensual.';
  END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(p_ventas) LOOP
    fecha := (v->>'fechaVenta')::DATE; monto := (v->>'montoVenta')::NUMERIC; observ := NULLIF(btrim(v->>'observacion'), '');
    IF fecha IS NULL OR monto IS NULL OR monto < 0 OR monto::TEXT IN ('NaN', 'Infinity', '-Infinity')
       OR extract(year FROM fecha) NOT BETWEEN 1900 AND 2200
       OR observ LIKE 'Generado desde estados financieros %' THEN
      RAISE EXCEPTION USING ERRCODE = 'ANF02', MESSAGE = 'Fecha, monto u observación inválidos.';
    END IF;
    mes := to_char(fecha, 'YYYY-MM');
    IF mes = ANY(meses) OR EXISTS (
      SELECT 1 FROM venta WHERE empresa_id = p_empresa_id
        AND fecha_venta >= date_trunc('month', fecha::TIMESTAMP)::DATE
        AND fecha_venta < (date_trunc('month', fecha::TIMESTAMP) + interval '1 month')::DATE
        AND (p_id IS NULL OR id_venta <> p_id)
        AND (observacion IS NULL OR observacion NOT LIKE 'Generado desde estados financieros %')
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
COMMIT;
