-- El corte pertenece a la versión publicada; no cambia al registrar partidas posteriores.
BEGIN;
CREATE FUNCTION public.cont_registrar_corte_publicacion() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE corte DATE;
BEGIN
  SELECT max(fecha) INTO corte FROM public.cont_asiento
    WHERE periodo_id = NEW.periodo_id AND estado = 'CONTABILIZADO'
      AND tipo NOT IN ('CIERRE', 'REAPERTURA');
  NEW.estados := NEW.estados || jsonb_build_object('fechaCorte', corte);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cont_registrar_corte_publicacion() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cont_publicacion_registrar_corte BEFORE INSERT ON public.cont_publicacion
FOR EACH ROW EXECUTE FUNCTION public.cont_registrar_corte_publicacion();
COMMIT;
