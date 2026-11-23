-- Ejecutar después de 011. No elimina estados ni indicadores existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ratio_recalculo (
  empresa_id INTEGER NOT NULL REFERENCES public.empresa(empresa_id) ON DELETE CASCADE,
  anio INTEGER NOT NULL,
  version TEXT NOT NULL,
  huella TEXT NOT NULL,
  huella_resultados TEXT NOT NULL,
  calculado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, anio)
);
ALTER TABLE public.ratio_recalculo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ratio_recalculo FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratio_recalculo TO service_role;

CREATE OR REPLACE FUNCTION public.base_recalculo_ratios(p_empresa_id INTEGER, p_anio INTEGER)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'empresa', (SELECT jsonb_build_object('empresa_id', empresa_id, 'id_sector', id_sector) FROM empresa WHERE empresa_id = p_empresa_id),
    'estados', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.anio, e.tipo_reporte, e.id_estado_financiero)
      FROM estado_financiero e WHERE e.empresa_id = p_empresa_id AND e.anio IN (p_anio, p_anio - 1)), '[]'::JSONB),
    'lineas', COALESCE((SELECT jsonb_agg(jsonb_build_object('anio', e.anio, 'tipo_reporte', e.tipo_reporte,
        'codigo', c.cue_cuenta_id, 'saldo', l.saldo) ORDER BY l.id_linea)
      FROM linea_estado_financiero l JOIN estado_financiero e USING (id_estado_financiero)
      JOIN cuenta c USING (cuenta_id)
      WHERE e.empresa_id = p_empresa_id AND e.anio IN (p_anio, p_anio - 1)), '[]'::JSONB),
    'categorias', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id_categoria_ratio) FROM categoria_ratio c), '[]'::JSONB),
    'referencias', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id_parametro_sector) FROM parametro_sector p
      JOIN empresa e ON e.id_sector = p.id_sector WHERE e.empresa_id = p_empresa_id
      AND (p.anio_referencia <= p_anio OR p.anio_referencia IS NULL)), '[]'::JSONB),
    'ratios', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id_ratio', r.id_ratio, 'anio_ratio', r.anio_ratio, 'empresa_id', r.empresa_id,
        'periodo_ratio', r.periodo_ratio, 'interpretacion', NULL,
        'categoriaRatio', CASE WHEN c.id_categoria_ratio IS NULL THEN NULL ELSE to_jsonb(c) END,
        'parametroSector', CASE WHEN p.id_parametro_sector IS NULL THEN NULL ELSE to_jsonb(p) END) ORDER BY r.id_ratio)
      FROM ratio r LEFT JOIN categoria_ratio c USING (id_categoria_ratio)
      LEFT JOIN parametro_sector p ON p.id_parametro_sector = r.id_parametro_sector
      WHERE r.empresa_id = p_empresa_id AND r.anio_ratio = p_anio), '[]'::JSONB)
  );
$$;
CREATE OR REPLACE FUNCTION public.salida_recalculo_ratios(p_empresa_id INTEGER, p_anio INTEGER)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id_ratio), '[]'::JSONB)
  FROM ratio r WHERE r.empresa_id = p_empresa_id AND r.anio_ratio = p_anio;
$$;
CREATE OR REPLACE FUNCTION public.consultar_recalculo_ratios(p_empresa_id INTEGER, p_anio INTEGER, p_version TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE base JSONB; firma TEXT; vigente BOOLEAN;
BEGIN
  base := public.base_recalculo_ratios(p_empresa_id, p_anio);
  firma := md5(base::TEXT);
  SELECT EXISTS (SELECT 1 FROM ratio_recalculo r WHERE r.empresa_id = p_empresa_id AND r.anio = p_anio
    AND r.version = p_version AND r.huella = firma
    AND r.huella_resultados = md5(public.salida_recalculo_ratios(p_empresa_id, p_anio)::TEXT)) INTO vigente;
  RETURN jsonb_build_object('vigente', vigente, 'huella', firma, 'datos', base);
END;
$$;
CREATE OR REPLACE FUNCTION public.guardar_recalculo_ratios(
  p_empresa_id INTEGER, p_anio INTEGER, p_version TEXT, p_huella TEXT, p_filas JSONB, p_completo BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(p_empresa_id, p_anio);
  IF md5(public.base_recalculo_ratios(p_empresa_id, p_anio)::TEXT) <> p_huella THEN
    RAISE EXCEPTION USING ERRCODE = 'ANF03', MESSAGE = 'Los datos cambiaron durante el cálculo. Intente actualizar de nuevo.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_filas) j WHERE NOT EXISTS (
    SELECT 1 FROM ratio r WHERE r.id_ratio = (j->>'id_ratio')::INTEGER
      AND r.empresa_id = p_empresa_id AND r.anio_ratio = p_anio)) THEN
    RAISE EXCEPTION 'Indicador ajeno al año o empresa';
  END IF;
  DELETE FROM ratio_recalculo WHERE empresa_id = p_empresa_id AND anio = p_anio;
  UPDATE ratio r SET valor_calculado = f.valor_calculado, valor_sector_promedio = f.valor_sector_promedio,
    diferencia_vs_sector = f.diferencia_vs_sector, cumple_sector = f.cumple_sector, interpretacion = f.interpretacion
  FROM jsonb_to_recordset(p_filas) AS f(id_ratio INTEGER, valor_calculado NUMERIC, valor_sector_promedio NUMERIC,
    diferencia_vs_sector NUMERIC, cumple_sector BOOLEAN, interpretacion TEXT)
  WHERE r.id_ratio = f.id_ratio AND r.empresa_id = p_empresa_id AND r.anio_ratio = p_anio;
  IF p_completo THEN
    INSERT INTO ratio_recalculo (empresa_id, anio, version, huella, huella_resultados)
    VALUES (p_empresa_id, p_anio, p_version, p_huella, md5(public.salida_recalculo_ratios(p_empresa_id, p_anio)::TEXT));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.base_recalculo_ratios(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salida_recalculo_ratios(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_recalculo_ratios(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guardar_recalculo_ratios(INTEGER, INTEGER, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.base_recalculo_ratios(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.salida_recalculo_ratios(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_recalculo_ratios(INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.guardar_recalculo_ratios(INTEGER, INTEGER, TEXT, TEXT, JSONB, BOOLEAN) TO service_role;
COMMIT;
