-- ============================================================
-- 005 — Módulo A: carga unificada de estados financieros + monoempresa
--
-- Qué hace:
--   1. Marca una empresa principal (A4). Solo puede haber una; por
--      defecto es Inv ABC (empresa_id = 2), que es la que usan los
--      seeds 003/004 del Módulo C.
--   2. Amplía venta.monto_venta para que quepan las ventas anuales.
--   3. Crea cargar_estados_financieros(): guarda el Balance General, el
--      Estado de Resultados y la venta del año en UNA transacción (A1-A3).
--
-- Idempotente: se puede correr dos veces.
-- ============================================================

-- 1) Empresa principal ------------------------------------------
ALTER TABLE empresa
  ADD COLUMN IF NOT EXISTS es_principal BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_empresa_principal
  ON empresa (es_principal) WHERE es_principal;

UPDATE empresa SET es_principal = TRUE
WHERE empresa_id = 2
  AND NOT EXISTS (SELECT 1 FROM empresa WHERE es_principal);

-- 2) Ventas anuales -----------------------------------------------
-- NUMERIC(10,2) se queda corto (máximo 99,999,999.99) para una venta anual.
ALTER TABLE venta
  ALTER COLUMN monto_venta TYPE NUMERIC(15,2);

CREATE INDEX IF NOT EXISTS idx_venta_empresa_observacion
  ON venta (empresa_id, observacion);

-- 3) Carga transaccional ------------------------------------------
-- p_balance / p_resultados: [{ "cuentaId": 12, "saldo": 1500.25 }, ...]
-- p_venta: ventas netas del año (NULL = no registrar venta).
-- Si ya existe el BG o el ER del año y p_reemplazar es FALSE, lanza el
-- SQLSTATE 'ANF01' para que la API responda 409. Con p_reemplazar borra
-- ambos (las líneas caen por ON DELETE CASCADE) y los vuelve a crear, así
-- nunca queda un año con un solo estado.
CREATE OR REPLACE FUNCTION cargar_estados_financieros(
  p_empresa_id  INTEGER,
  p_anio        INTEGER,
  p_balance     JSONB,
  p_resultados  JSONB,
  p_venta       NUMERIC,
  p_reemplazar  BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existentes  INTEGER;
  v_id_balance  BIGINT;
  v_id_result   BIGINT;
  v_observacion TEXT := 'Generado desde estados financieros ' || p_anio;
BEGIN
  IF jsonb_array_length(COALESCE(p_balance, '[]'::jsonb)) = 0
     OR jsonb_array_length(COALESCE(p_resultados, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'El Balance General y el Estado de Resultados deben tener líneas.'
      USING ERRCODE = '22023';
  END IF;

  -- Bloquea la empresa para que dos cargas simultáneas del mismo año no
  -- pasen ambas el control de duplicados.
  PERFORM 1 FROM empresa WHERE empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa % no encontrada', p_empresa_id USING ERRCODE = 'ANF02';
  END IF;

  SELECT count(*) INTO v_existentes
  FROM estado_financiero
  WHERE empresa_id = p_empresa_id
    AND anio = p_anio
    AND tipo_reporte IN ('BALANCE_GENERAL', 'ESTADO_RESULTADOS');

  IF v_existentes > 0 AND NOT p_reemplazar THEN
    RAISE EXCEPTION 'Ya existen estados financieros para el año %', p_anio
      USING ERRCODE = 'ANF01';
  END IF;

  DELETE FROM estado_financiero
  WHERE empresa_id = p_empresa_id
    AND anio = p_anio
    AND tipo_reporte IN ('BALANCE_GENERAL', 'ESTADO_RESULTADOS');

  INSERT INTO estado_financiero (anio, tipo_reporte, empresa_id)
  VALUES (p_anio, 'BALANCE_GENERAL', p_empresa_id)
  RETURNING id_estado_financiero INTO v_id_balance;

  INSERT INTO estado_financiero (anio, tipo_reporte, empresa_id)
  VALUES (p_anio, 'ESTADO_RESULTADOS', p_empresa_id)
  RETURNING id_estado_financiero INTO v_id_result;

  INSERT INTO linea_estado_financiero (id_estado_financiero, cuenta_id, saldo)
  SELECT v_id_balance, (l->>'cuentaId')::INTEGER, ROUND((l->>'saldo')::NUMERIC, 2)
  FROM jsonb_array_elements(p_balance) AS l;

  INSERT INTO linea_estado_financiero (id_estado_financiero, cuenta_id, saldo)
  SELECT v_id_result, (l->>'cuentaId')::INTEGER, ROUND((l->>'saldo')::NUMERIC, 2)
  FROM jsonb_array_elements(p_resultados) AS l;

  DELETE FROM venta
  WHERE empresa_id = p_empresa_id AND observacion = v_observacion;

  IF p_venta IS NOT NULL THEN
    INSERT INTO venta (fecha_venta, monto_venta, observacion, empresa_id)
    VALUES (make_date(p_anio, 12, 31), ROUND(p_venta, 2), v_observacion, p_empresa_id);
  END IF;

  RETURN jsonb_build_object(
    'idBalance', v_id_balance,
    'idResultados', v_id_result,
    'reemplazado', v_existentes > 0
  );
END;
$$;

-- Solo el backend (service_role) puede ejecutarla; la anon key del
-- navegador no.
REVOKE ALL ON FUNCTION cargar_estados_financieros(INTEGER, INTEGER, JSONB, JSONB, NUMERIC, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cargar_estados_financieros(INTEGER, INTEGER, JSONB, JSONB, NUMERIC, BOOLEAN)
  TO service_role;
