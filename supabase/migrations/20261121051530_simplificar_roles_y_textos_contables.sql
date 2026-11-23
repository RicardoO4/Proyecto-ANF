-- Simplifica los accesos sin modificar partidas ni estados financieros.
BEGIN;
CREATE OR REPLACE FUNCTION public.cont_permisos_por_rol() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 DELETE FROM acceso_usuario WHERE usuario_id=NEW.usuario_id;
 IF NEW.rol='CONTADOR' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,x FROM unnest(ARRAY['5','8','9','10','11']) x;
 ELSIF NEW.rol='ANALISTA' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,x FROM unnest(ARRAY['0','2','3','6','7']) x;
 ELSIF NEW.rol='ADMIN' THEN
   INSERT INTO acceso_usuario(usuario_id,id_opcion) SELECT NEW.usuario_id,id_opcion FROM opcion_form;
 END IF;
 RETURN NEW;
END; $$;

-- Los usuarios anteriores exclusivamente contables conservan esa área.
-- Los demás usuarios anteriores pasan al análisis financiero.
UPDATE public.usuario u SET rol=CASE
 WHEN EXISTS(SELECT 1 FROM acceso_usuario a WHERE a.usuario_id=u.usuario_id AND a.id_opcion='8')
 AND NOT EXISTS(SELECT 1 FROM acceso_usuario a WHERE a.usuario_id=u.usuario_id AND a.id_opcion IN ('0','1','2','3','4','6','7'))
 THEN 'CONTADOR' ELSE 'ANALISTA' END
WHERE rol NOT IN ('ADMIN','CONTADOR','ANALISTA');
ALTER TABLE public.usuario ADD CONSTRAINT usuario_tres_roles CHECK(rol IN ('ADMIN','CONTADOR','ANALISTA'));
UPDATE public.usuario SET rol=rol;

CREATE OR REPLACE FUNCTION public.cont_validar_acceso_rol() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE perfil TEXT;
BEGIN
 SELECT rol INTO perfil FROM usuario WHERE usuario_id=NEW.usuario_id;
 IF (perfil='CONTADOR' AND NEW.id_opcion NOT IN ('5','8','9','10','11'))
   OR (perfil='ANALISTA' AND NEW.id_opcion NOT IN ('0','2','3','6','7')) THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Los permisos se asignan según el rol del usuario.';
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.cont_operar(p_empresa INTEGER,p_usuario INTEGER,p_accion TEXT,p_datos JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p cont_periodo; base cont_periodo; a cont_asiento; anterior cont_asiento; j JSONB;
 idp BIGINT; ida BIGINT; n INTEGER; v NUMERIC; d NUMERIC; h NUMERIC; y INTEGER; acumulados INTEGER;
 r_id INTEGER; estados JSONB; bg_id BIGINT; er_id BIGINT; padre cuenta; codigo_nuevo TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM usuario WHERE usuario_id=p_usuario AND rol IN ('ADMIN','CONTADOR')) THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Solo el contador y el administrador pueden gestionar la contabilidad.';
 END IF;
 IF p_accion NOT IN ('crear_cuenta','importar','crear_periodo','guardar','contabilizar','descartar','revertir','revision','publicar','cerrar','reabrir') OR p_accion IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Acción contable desconocida.';
 END IF;
 -- Comparte orden de bloqueo con la carga financiera existente.
 PERFORM 1 FROM empresa WHERE empresa_id=p_empresa FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Empresa inexistente.'; END IF;
 IF p_accion='crear_cuenta' THEN
   IF NOT EXISTS(SELECT 1 FROM usuario WHERE usuario_id=p_usuario AND rol='ADMIN')
     AND NOT EXISTS(SELECT 1 FROM acceso_usuario WHERE usuario_id=p_usuario AND id_opcion='5') THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Requiere permiso de gestión del catálogo ANF.';
   END IF;
   SELECT c.* INTO padre FROM cuenta c JOIN catalogo ca USING(cuenta_id)
     WHERE c.cuenta_id=(p_datos->>'padreId')::INTEGER AND ca.empresa_id=p_empresa AND ca.activo FOR UPDATE OF c;
   IF NOT FOUND OR length(padre.cue_cuenta_id)<4 OR left(padre.cue_cuenta_id,1) NOT IN ('1','2','3','4','5')
     OR padre.cue_cuenta_id LIKE '3204%' OR COALESCE(p_datos->>'segmento','') !~ '^[0-9]{2,6}$'
     OR length(btrim(COALESCE(p_datos->>'nombre',''))) NOT BETWEEN 3 AND 256 THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Seleccione una cuenta ANF activa de cuatro o más dígitos, un segmento numérico y un nombre válido.';
   END IF;
   codigo_nuevo:=padre.cue_cuenta_id||'.'||(p_datos->>'segmento');
   IF length(codigo_nuevo)>256 OR EXISTS(SELECT 1 FROM cuenta WHERE cue_cuenta_id=codigo_nuevo) THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El código ya existe o excede la longitud admitida.';
   END IF;
   INSERT INTO cuenta(cue_cuenta_id,nombre_cuenta,codigo_individual,codigo_generado,tipo_cuenta,id_cuenta_padre,is_postable)
     VALUES(codigo_nuevo,btrim(p_datos->>'nombre'),p_datos->>'segmento',codigo_nuevo,padre.tipo_cuenta,padre.cuenta_id,true) RETURNING cuenta_id INTO r_id;
   UPDATE cuenta SET is_postable=false WHERE cuenta_id=padre.cuenta_id;
   INSERT INTO catalogo(empresa_id,cuenta_id,activo) VALUES(p_empresa,r_id,true);
   INSERT INTO cont_auditoria(usuario_id,accion,detalle) VALUES(p_usuario,'CREAR_SUBCUENTA',jsonb_build_object('empresaId',p_empresa,'codigo',codigo_nuevo));
   RETURN jsonb_build_object('ok',true,'cuentaId',r_id);
 END IF;
 IF p_accion='importar' THEN
   FOR y IN SELECT anio FROM estado_financiero WHERE empresa_id=p_empresa
     AND tipo_reporte IN ('BALANCE_GENERAL','ESTADO_RESULTADOS') GROUP BY anio HAVING count(DISTINCT tipo_reporte)=2 LOOP
     SELECT COALESCE(jsonb_agg(jsonb_build_object('cuenta_id',c.cuenta_id,'codigo',c.cue_cuenta_id,'nombre',c.nombre_cuenta,
       'firmado',CASE WHEN left(c.cue_cuenta_id,1) IN ('2','3','5') AND c.cue_cuenta_id NOT LIKE '5101.02%' THEN -l.saldo ELSE l.saldo END)
       ORDER BY l.id_linea),'[]'::JSONB) INTO j
     FROM linea_estado_financiero l JOIN estado_financiero e USING(id_estado_financiero) JOIN cuenta c USING(cuenta_id)
     WHERE e.empresa_id=p_empresa AND e.anio=y;
     INSERT INTO cont_periodo(empresa_id,anio,origen,estado,base_historica)
     VALUES(p_empresa,y,'HISTORICO','CERRADO',j) ON CONFLICT(empresa_id,anio) DO NOTHING RETURNING id INTO idp;
     IF idp IS NOT NULL THEN INSERT INTO cont_auditoria(periodo_id,usuario_id,accion) VALUES(idp,p_usuario,'IMPORTAR_SALDOS_HISTORICOS'); END IF;
   END LOOP;
   RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_accion='crear_periodo' THEN
   y:=(p_datos->>'anio')::INTEGER;
   IF EXISTS(SELECT 1 FROM estado_financiero WHERE empresa_id=p_empresa AND anio=y) THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Ese año ya tiene estados. Incorpórelo como histórico para conservarlos.';
   END IF;
   IF EXISTS(SELECT 1 FROM cont_periodo WHERE empresa_id=p_empresa AND origen='CONTABILIDAD' AND estado<>'CERRADO') THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Cierre el ejercicio operativo anterior antes de abrir otro.';
   END IF;
   idp:=NULLIF(p_datos->>'base','')::BIGINT;
   IF idp IS NOT NULL THEN
     SELECT * INTO base FROM cont_periodo WHERE id=idp AND empresa_id=p_empresa AND estado='CERRADO';
     IF NOT FOUND OR base.anio<>y-1 THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='La apertura debe partir del cierre del año anterior.'; END IF;
   ELSIF EXISTS(SELECT 1 FROM cont_periodo WHERE empresa_id=p_empresa) THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Seleccione el cierre del año anterior como base de apertura.';
   END IF;
   INSERT INTO cont_periodo(empresa_id,anio,origen,periodo_base) VALUES(p_empresa,y,'CONTABILIDAD',idp) RETURNING * INTO p;
   IF idp IS NOT NULL THEN
     estados:=cont_estados(idp); acumulados:=NULLIF(p_datos->>'cuentaAcumulados','')::INTEGER;
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(estados->'balance') x WHERE x->>'codigo' LIKE '3204%' AND (x->>'saldo')::NUMERIC<>0)
       AND NOT EXISTS(SELECT 1 FROM cuenta c JOIN catalogo ca USING(cuenta_id) WHERE c.cuenta_id=acumulados AND ca.empresa_id=p_empresa
         AND ca.activo AND c.cue_cuenta_id LIKE '3%' AND c.cue_cuenta_id NOT LIKE '3204%') THEN
       RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Seleccione la cuenta patrimonial ANF para trasladar el resultado anterior a acumulados.';
     END IF;
     INSERT INTO cont_asiento(periodo_id,numero,fecha,descripcion,tipo,usuario_id,clave)
       VALUES(p.id,1,make_date(y,1,1),'Apertura desde cierre anual '||base.anio,'APERTURA',p_usuario,gen_random_uuid()) RETURNING id INTO ida;
     INSERT INTO cont_linea(asiento_id,cuenta_id,debe,haber)
     SELECT ida,cid,GREATEST(sum(firmado),0),GREATEST(-sum(firmado),0) FROM (
       SELECT CASE WHEN x->>'codigo' LIKE '3204%' THEN acumulados ELSE (x->>'cuentaId')::INTEGER END cid,
       (x->>'saldo')::NUMERIC * CASE WHEN left(x->>'codigo',1) IN ('2','3') THEN -1 ELSE 1 END firmado
       FROM jsonb_array_elements(estados->'balance') x) t GROUP BY cid HAVING sum(firmado)<>0;
     UPDATE cont_asiento SET estado='CONTABILIZADO' WHERE id=ida;
   END IF;
   INSERT INTO cont_auditoria(periodo_id,usuario_id,accion,detalle) VALUES(p.id,p_usuario,'CREAR_PERIODO',p_datos);
   RETURN jsonb_build_object('periodoId',p.id);
 END IF;
 idp:=(p_datos->>'periodoId')::BIGINT;
 SELECT * INTO p FROM cont_periodo WHERE id=idp AND empresa_id=p_empresa FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Período no encontrado.'; END IF;
 IF p.origen='HISTORICO' THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El histórico conserva saldos importados; no admite partidas inventadas ni modificaciones.'; END IF;

 IF p_accion='reabrir' THEN
   IF p.estado<>'CERRADO' THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El período no está cerrado.'; END IF;
   IF length(btrim(COALESCE(p_datos->>'motivo','')))<5 THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Indique el motivo de reapertura.'; END IF;
   IF EXISTS(SELECT 1 FROM cont_periodo WHERE periodo_base=p.id) THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Ya existe una apertura dependiente. No se permite alterar su cierre base.';
   END IF;
   UPDATE cont_periodo SET estado='REVISION' WHERE id=p.id;
   SELECT * INTO anterior FROM cont_asiento WHERE periodo_id=p.id AND tipo='CIERRE'
     AND NOT EXISTS(SELECT 1 FROM cont_asiento r WHERE r.reversa_de=cont_asiento.id) ORDER BY id DESC LIMIT 1;
   IF FOUND THEN
     INSERT INTO cont_asiento(periodo_id,numero,fecha,descripcion,tipo,usuario_id,clave,reversa_de)
       SELECT p.id,COALESCE(max(numero),0)+1,make_date(p.anio,12,31),'Reapertura: '||(p_datos->>'motivo'),'REAPERTURA',p_usuario,gen_random_uuid(),anterior.id
       FROM cont_asiento WHERE periodo_id=p.id RETURNING id INTO ida;
     INSERT INTO cont_linea(asiento_id,cuenta_id,debe,haber) SELECT ida,cuenta_id,haber,debe FROM cont_linea WHERE asiento_id=anterior.id;
     UPDATE cont_asiento SET estado='CONTABILIZADO' WHERE id=ida;
   END IF;
 ELSE
   IF p.estado='CERRADO' THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El ejercicio está cerrado.'; END IF;
   IF p_accion IN ('guardar','contabilizar','descartar','revertir') THEN
     ida:=NULLIF(p_datos->>'id','')::BIGINT;
     IF ida IS NOT NULL THEN
       SELECT * INTO a FROM cont_asiento WHERE id=ida AND periodo_id=p.id FOR UPDATE;
       IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Partida ajena al período.'; END IF;
     END IF;
   END IF;
   CASE p_accion
   WHEN 'guardar' THEN
     IF p_datos->>'tipo' NOT IN ('OPERACION','CORRECCION','AJUSTE','APERTURA') OR p_datos->>'tipo' IS NULL THEN
       RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Tipo de partida inválido.';
     END IF;
     IF p_datos->>'tipo'='APERTURA' AND (p.periodo_base IS NOT NULL OR EXISTS(SELECT 1 FROM cont_asiento WHERE periodo_id=p.id AND estado='CONTABILIZADO')) THEN
       RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='La apertura solo se permite al inicio de un ejercicio sin cierre base.';
     END IF;
     IF ida IS NULL THEN
       SELECT id INTO ida FROM cont_asiento WHERE clave=(p_datos->>'clave')::UUID AND periodo_id=p.id;
       IF ida IS NOT NULL THEN RETURN jsonb_build_object('id',ida,'repetido',true); END IF;
       SELECT COALESCE(max(numero),0)+1 INTO n FROM cont_asiento WHERE periodo_id=p.id;
       INSERT INTO cont_asiento(periodo_id,numero,fecha,descripcion,tipo,usuario_id,clave)
         VALUES(p.id,n,(p_datos->>'fecha')::DATE,p_datos->>'descripcion',p_datos->>'tipo',p_usuario,(p_datos->>'clave')::UUID) RETURNING id INTO ida;
     ELSE
       UPDATE cont_asiento SET fecha=(p_datos->>'fecha')::DATE,descripcion=p_datos->>'descripcion',tipo=p_datos->>'tipo' WHERE id=ida;
       DELETE FROM cont_linea WHERE asiento_id=ida;
     END IF;
     IF jsonb_typeof(p_datos->'lineas')<>'array' OR jsonb_array_length(p_datos->'lineas') NOT BETWEEN 2 AND 500 THEN
       RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Ingrese entre 2 y 500 líneas.';
     END IF;
     FOR j IN SELECT value FROM jsonb_array_elements(p_datos->'lineas') LOOP
       d:=(j->>'debe')::NUMERIC; h:=(j->>'haber')::NUMERIC;
       IF d IS NULL OR h IS NULL OR d::TEXT IN ('NaN','Infinity','-Infinity') OR h::TEXT IN ('NaN','Infinity','-Infinity')
         OR d<>round(d,2) OR h<>round(h,2) THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Importes finitos con un máximo de dos decimales.'; END IF;
       INSERT INTO cont_linea(asiento_id,cuenta_id,debe,haber) VALUES(ida,(j->>'cuentaId')::INTEGER,d,h);
     END LOOP;
   WHEN 'contabilizar' THEN
     IF a.tipo IN ('CIERRE','REAPERTURA') THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Partida técnica reservada.'; END IF;
     UPDATE cont_asiento SET estado='CONTABILIZADO' WHERE id=a.id;
   WHEN 'descartar' THEN
     IF a.estado<>'BORRADOR' THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Solo se puede descartar un borrador.'; END IF;
     DELETE FROM cont_linea WHERE asiento_id=a.id;
     DELETE FROM cont_asiento WHERE id=a.id;
   WHEN 'revertir' THEN
     IF a.estado<>'CONTABILIZADO' OR a.tipo IN ('CIERRE','REAPERTURA','APERTURA') THEN
       RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Seleccione una operación contabilizada para revertir.';
     END IF;
     IF length(btrim(COALESCE(p_datos->>'motivo','')))<5 THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Indique el motivo de la corrección.'; END IF;
     INSERT INTO cont_asiento(periodo_id,numero,fecha,descripcion,tipo,usuario_id,clave,reversa_de)
       SELECT p.id,COALESCE(max(numero),0)+1,(p_datos->>'fecha')::DATE,'Reversión de partida '||a.numero||': '||(p_datos->>'motivo'),
         'CORRECCION',p_usuario,(p_datos->>'clave')::UUID,a.id FROM cont_asiento WHERE periodo_id=p.id RETURNING id INTO ida;
     INSERT INTO cont_linea(asiento_id,cuenta_id,debe,haber) SELECT ida,cuenta_id,haber,debe FROM cont_linea WHERE asiento_id=a.id;
     UPDATE cont_asiento SET estado='CONTABILIZADO' WHERE id=ida;
   WHEN 'revision' THEN
     UPDATE cont_periodo SET estado=CASE WHEN p.estado='ABIERTO' THEN 'REVISION' ELSE 'ABIERTO' END WHERE id=p.id;
   WHEN 'publicar' THEN
     IF (p_datos->>'version')::INTEGER IS DISTINCT FROM p.version THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Las partidas cambiaron. Actualice la pantalla antes de publicar.'; END IF;
     IF EXISTS(SELECT 1 FROM cont_asiento WHERE periodo_id=p.id AND estado='BORRADOR') THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Contabilice o descarte los borradores antes de publicar.'; END IF;
     IF NOT EXISTS(SELECT 1 FROM cont_asiento WHERE periodo_id=p.id AND tipo='APERTURA' AND estado='CONTABILIZADO') THEN
       RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Registre primero la partida de apertura.';
     END IF;
     estados:=cont_estados(p.id);
     SELECT COALESCE(sum(CASE WHEN left(x->>'codigo',1)='1' THEN (x->>'saldo')::NUMERIC ELSE -(x->>'saldo')::NUMERIC END),0)
       INTO v FROM jsonb_array_elements(estados->'balance') x;
     IF v<>0 THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El Balance General no cuadra exactamente.'; END IF;
     PERFORM pg_advisory_xact_lock(p_empresa,p.anio);
     PERFORM set_config('anf.cont_publicando',p.id::TEXT,true);
     INSERT INTO estado_financiero(empresa_id,anio,tipo_reporte) VALUES(p_empresa,p.anio,'BALANCE_GENERAL')
       ON CONFLICT(empresa_id,anio,tipo_reporte) DO UPDATE SET anio=EXCLUDED.anio RETURNING id_estado_financiero INTO bg_id;
     INSERT INTO estado_financiero(empresa_id,anio,tipo_reporte) VALUES(p_empresa,p.anio,'ESTADO_RESULTADOS')
       ON CONFLICT(empresa_id,anio,tipo_reporte) DO UPDATE SET anio=EXCLUDED.anio RETURNING id_estado_financiero INTO er_id;
     DELETE FROM linea_estado_financiero WHERE id_estado_financiero IN (bg_id,er_id);
     INSERT INTO linea_estado_financiero(id_estado_financiero,cuenta_id,saldo)
       SELECT bg_id,(x->>'cuentaId')::INTEGER,(x->>'saldo')::NUMERIC FROM jsonb_array_elements(estados->'balance') x
       UNION ALL SELECT er_id,(x->>'cuentaId')::INTEGER,(x->>'saldo')::NUMERIC FROM jsonb_array_elements(estados->'resultados') x;
     DELETE FROM venta WHERE empresa_id=p_empresa AND observacion='Generado desde estados financieros '||p.anio;
     INSERT INTO venta(empresa_id,fecha_venta,monto_venta,observacion) VALUES(p_empresa,make_date(p.anio,12,31),
       (estados->>'ventas')::NUMERIC,'Generado desde estados financieros '||p.anio);
     INSERT INTO cont_publicacion(periodo_id,version,estados,usuario_id) VALUES(p.id,p.version,estados,p_usuario)
       ON CONFLICT(periodo_id,version) DO NOTHING;
     UPDATE cont_periodo SET version_publicada=p.version WHERE id=p.id;
     PERFORM set_config('anf.cont_publicando','',true);
   WHEN 'cerrar' THEN
     IF p.version_publicada IS DISTINCT FROM p.version THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Publique la versión actual antes del cierre.'; END IF;
     IF EXISTS(SELECT 1 FROM cont_asiento WHERE periodo_id=p.id AND estado='BORRADOR') THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Existen borradores pendientes.'; END IF;
     SELECT cuenta_id INTO r_id FROM cuenta WHERE cue_cuenta_id='3204' ORDER BY cuenta_id LIMIT 1;
     SELECT -COALESCE(sum(saldo),0) INTO v FROM cont_saldos(p.id) WHERE left(codigo,1) IN ('4','5');
     IF EXISTS(SELECT 1 FROM cont_saldos(p.id) WHERE left(codigo,1) IN ('4','5') AND saldo<>0) THEN
       INSERT INTO cont_asiento(periodo_id,numero,fecha,descripcion,tipo,usuario_id,clave)
         SELECT p.id,COALESCE(max(numero),0)+1,make_date(p.anio,12,31),'Cierre de resultados del ejercicio','CIERRE',p_usuario,gen_random_uuid()
         FROM cont_asiento WHERE periodo_id=p.id RETURNING id INTO ida;
       INSERT INTO cont_linea(asiento_id,cuenta_id,debe,haber)
         SELECT ida,cuenta_id,GREATEST(-saldo,0),GREATEST(saldo,0) FROM cont_saldos(p.id) WHERE left(codigo,1) IN ('4','5') AND saldo<>0;
       IF v<>0 THEN INSERT INTO cont_linea(asiento_id,cuenta_id,debe,haber) VALUES(ida,r_id,GREATEST(-v,0),GREATEST(v,0)); END IF;
       UPDATE cont_asiento SET estado='CONTABILIZADO' WHERE id=ida;
     END IF;
     UPDATE cont_periodo SET estado='CERRADO',version_publicada=version WHERE id=p.id;
   ELSE RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Acción contable desconocida.';
   END CASE;
 END IF;
 INSERT INTO cont_auditoria(periodo_id,usuario_id,accion,detalle)
   VALUES(p.id,p_usuario,upper(p_accion),jsonb_build_object('partidaId',ida,'motivo',p_datos->>'motivo'));
 RETURN jsonb_build_object('ok',true,'id',ida,'periodoId',p.id);
END; $$;
COMMIT;
