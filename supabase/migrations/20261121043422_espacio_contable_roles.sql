-- Separa las áreas sin cambiar estados financieros, partidas ni permisos de usuarios existentes.
BEGIN;
CREATE FUNCTION public.cont_permisos_por_rol() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.rol=NEW.rol THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN DELETE FROM acceso_usuario WHERE usuario_id=NEW.usuario_id; END IF;
 IF NEW.rol='CONTADOR' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,x FROM unnest(ARRAY['5','8','9','10']) x ON CONFLICT DO NOTHING;
 ELSIF NEW.rol='ANALISTA' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,x FROM unnest(ARRAY['0','2','3','6','7']) x ON CONFLICT DO NOTHING;
 ELSIF NEW.rol='ADMIN' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,id_opcion FROM opcion_form ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cont_usuario_rol AFTER INSERT OR UPDATE OF rol ON public.usuario
 FOR EACH ROW EXECUTE FUNCTION public.cont_permisos_por_rol();

CREATE FUNCTION public.cont_validar_acceso_rol() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE perfil TEXT;
BEGIN
 SELECT rol INTO perfil FROM usuario WHERE usuario_id=NEW.usuario_id;
 IF (perfil='CONTADOR' AND NEW.id_opcion NOT IN ('5','8','9','10','11'))
   OR (perfil='ANALISTA' AND NEW.id_opcion IN ('8','9','10','11')) THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Ese permiso pertenece a otra área. Revise el rol del usuario.';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cont_acceso_rol BEFORE INSERT OR UPDATE ON public.acceso_usuario
 FOR EACH ROW EXECUTE FUNCTION public.cont_validar_acceso_rol();
REVOKE ALL ON FUNCTION public.cont_permisos_por_rol() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cont_validar_acceso_rol() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cont_permisos_por_rol(),public.cont_validar_acceso_rol() TO service_role;
COMMIT;
