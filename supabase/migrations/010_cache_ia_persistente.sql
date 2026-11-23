-- Caché privada y reserva atómica entre instancias de Vercel.
-- Ejecutar después de 009. No contiene claves ni elimina datos existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ia_cache (
  clave TEXT PRIMARY KEY CHECK (clave ~ '^[a-f0-9]{64}$'),
  modelo TEXT NOT NULL,
  contenido JSONB,
  generado_en TIMESTAMPTZ,
  propietario UUID,
  reservado_hasta TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((contenido IS NULL) = (generado_en IS NULL))
);
ALTER TABLE public.ia_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ia_cache FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_cache TO service_role;

-- El hash incluye modelo, versión, instrucciones, esquema, contexto y datos.
-- No se guarda el mensaje enviado a Google; solo su hash y la respuesta.
-- Sin caducidad automática: datos iguales reutilizan la interpretación guardada.
CREATE OR REPLACE FUNCTION public.reservar_cache_ia(
  p_clave TEXT, p_modelo TEXT, p_propietario UUID, p_forzar BOOLEAN DEFAULT FALSE
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE fila public.ia_cache%ROWTYPE;
BEGIN
  IF p_propietario IS NULL OR p_modelo IS NULL OR length(p_modelo) = 0 THEN
    RAISE EXCEPTION 'Reserva de IA inválida';
  END IF;
  INSERT INTO public.ia_cache (clave, modelo) VALUES (p_clave, p_modelo)
  ON CONFLICT (clave) DO NOTHING;
  SELECT * INTO fila FROM public.ia_cache WHERE clave = p_clave FOR UPDATE;
  IF fila.modelo <> p_modelo THEN RAISE EXCEPTION 'Modelo de caché inválido'; END IF;
  IF fila.contenido IS NOT NULL AND
     (NOT p_forzar OR fila.generado_en > now() - interval '1 minute') THEN
    RETURN jsonb_build_object('estado', 'guardado', 'contenido', fila.contenido);
  END IF;
  IF fila.reservado_hasta > now() THEN
    RETURN jsonb_build_object('estado', 'esperar');
  END IF;
  UPDATE public.ia_cache SET propietario = p_propietario,
    reservado_hasta = now() + interval '90 seconds', actualizado_en = now()
    WHERE clave = p_clave;
  RETURN jsonb_build_object('estado', 'generar');
END;
$$;
REVOKE ALL ON FUNCTION public.reservar_cache_ia(TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_cache_ia(TEXT, TEXT, UUID, BOOLEAN) TO service_role;
COMMENT ON TABLE public.ia_cache IS 'Respuestas de IA privadas; acceso exclusivo desde el servidor. No contiene API keys.';
COMMIT;
