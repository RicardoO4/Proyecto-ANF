-- Ejecutar después de 007_presupuestos.sql. No elimina datos existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS inventario_producto (
  id_producto BIGSERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  demanda_anual NUMERIC NOT NULL CHECK (demanda_anual >= 0),
  costo_unitario NUMERIC NOT NULL CHECK (costo_unitario >= 0),
  costo_pedido NUMERIC NOT NULL CHECK (costo_pedido >= 0),
  costo_mantenimiento_anual NUMERIC NOT NULL CHECK (costo_mantenimiento_anual > 0),
  plazo_entrega_dias NUMERIC NOT NULL CHECK (plazo_entrega_dias >= 0),
  stock_seguridad NUMERIC NOT NULL DEFAULT 0 CHECK (stock_seguridad >= 0),
  dias_operacion INTEGER NOT NULL DEFAULT 365 CHECK (dias_operacion BETWEEN 1 AND 366),
  existencias NUMERIC NOT NULL DEFAULT 0 CHECK (existencias >= 0),
  UNIQUE (empresa_id, codigo)
);
ALTER TABLE inventario_producto ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inventario_empresa ON inventario_producto(empresa_id);

-- Serializa la creación por empresa/año para que dos cargas no dupliquen filas.
-- Reutiliza únicamente referencias del mismo sector, sin inventar benchmarks.
CREATE OR REPLACE FUNCTION asegurar_ratios_anio(p_empresa_id INTEGER, p_anio INTEGER, p_categorias TEXT[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE creados INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(p_empresa_id, p_anio);
  INSERT INTO ratio (empresa_id, anio_ratio, periodo_ratio, id_categoria_ratio, id_parametro_sector)
  SELECT e.empresa_id, p_anio, 'ANUAL', c.id_categoria_ratio, ref.id_parametro_sector
  FROM empresa e CROSS JOIN categoria_ratio c
  LEFT JOIN LATERAL (
    SELECT p.id_parametro_sector FROM parametro_sector p
    WHERE p.id_categoria_ratio = c.id_categoria_ratio AND p.id_sector = e.id_sector
      AND (p.anio_referencia <= p_anio OR p.anio_referencia IS NULL)
    ORDER BY p.anio_referencia DESC NULLS LAST, p.id_parametro_sector DESC LIMIT 1
  ) ref ON true
  WHERE e.empresa_id = p_empresa_id AND c.nombre_tipo = ANY(p_categorias)
    AND NOT EXISTS (SELECT 1 FROM ratio r WHERE r.empresa_id = p_empresa_id
      AND r.anio_ratio = p_anio AND r.id_categoria_ratio = c.id_categoria_ratio);
  GET DIAGNOSTICS creados = ROW_COUNT;
  RETURN creados;
END;
$$;
REVOKE ALL ON FUNCTION asegurar_ratios_anio(INTEGER, INTEGER, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION asegurar_ratios_anio(INTEGER, INTEGER, TEXT[]) TO service_role;
COMMIT;
