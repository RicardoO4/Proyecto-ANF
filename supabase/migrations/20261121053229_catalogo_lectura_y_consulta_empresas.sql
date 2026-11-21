BEGIN;
CREATE OR REPLACE FUNCTION public.cont_validar_acceso_rol() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE perfil TEXT;
BEGIN
 SELECT rol INTO perfil FROM usuario WHERE usuario_id=NEW.usuario_id;
 IF (perfil='CONTADOR' AND NEW.id_opcion NOT IN ('5','8','9','10','11'))
   OR (perfil='ANALISTA' AND NEW.id_opcion NOT IN ('0','1','2','3','5','6','7')) THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Los permisos se asignan según el rol del usuario.';
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.cont_permisos_por_rol() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 DELETE FROM acceso_usuario WHERE usuario_id=NEW.usuario_id;
 IF NEW.rol='CONTADOR' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,x FROM unnest(ARRAY['5','8','9','10','11']) x;
 ELSIF NEW.rol='ANALISTA' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,x FROM unnest(ARRAY['0','1','2','3','5','6','7']) x;
 ELSIF NEW.rol='ADMIN' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,id_opcion FROM opcion_form;
 END IF;
 RETURN NEW;
END; $$;
UPDATE public.usuario SET rol=rol WHERE rol='ANALISTA';

-- Mantiene el ciclo contable y restringe únicamente la creación de subcuentas.
DO $$
DECLARE definicion TEXT;
 regla TEXT := $regla$IF NOT EXISTS(SELECT 1 FROM usuario WHERE usuario_id=p_usuario AND rol='ADMIN')
     AND NOT EXISTS(SELECT 1 FROM acceso_usuario WHERE usuario_id=p_usuario AND id_opcion='5') THEN$regla$;
BEGIN
 SELECT pg_get_functiondef('public.cont_operar(integer,integer,text,jsonb)'::regprocedure) INTO definicion;
 IF strpos(definicion,regla)=0 THEN
   RAISE EXCEPTION 'No se encontró la regla de gestión del catálogo. Revise las migraciones anteriores.';
 END IF;
 EXECUTE replace(definicion,regla,$regla$IF NOT EXISTS(SELECT 1 FROM usuario WHERE usuario_id=p_usuario AND rol='ADMIN') THEN$regla$);
END; $$;
COMMIT;
