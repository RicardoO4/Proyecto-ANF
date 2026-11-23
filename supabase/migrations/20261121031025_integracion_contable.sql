-- Contabilidad anual integrada con el contrato financiero de ANF.
-- Solo backend. No modifica ni vuelve a cargar estados históricos existentes.
BEGIN;

INSERT INTO public.opcion_form(id_opcion,des_opcion,num_form) VALUES
 ('8','CONTABILIDAD: CONSULTAR',8), ('9','CONTABILIDAD: PREPARAR PARTIDAS',9),
 ('10','CONTABILIDAD: CONTABILIZAR Y AJUSTAR',10), ('11','CONTABILIDAD: PUBLICAR Y CERRAR',11)
ON CONFLICT(id_opcion) DO NOTHING;
INSERT INTO public.acceso_usuario(usuario_id,id_opcion)
 SELECT u.usuario_id,op.id_opcion FROM public.usuario u CROSS JOIN public.opcion_form op
 WHERE u.rol='ADMIN' AND op.id_opcion IN ('8','9','10','11')
 ON CONFLICT(usuario_id,id_opcion) DO NOTHING;

CREATE TABLE public.cont_periodo (
 id BIGSERIAL PRIMARY KEY,
 empresa_id INTEGER NOT NULL REFERENCES public.empresa ON DELETE RESTRICT,
 anio INTEGER NOT NULL CHECK(anio BETWEEN 1900 AND 2200),
 origen TEXT NOT NULL CHECK(origen IN ('HISTORICO','CONTABILIDAD')),
 estado TEXT NOT NULL DEFAULT 'ABIERTO' CHECK(estado IN ('ABIERTO','REVISION','CERRADO')),
 moneda TEXT NOT NULL DEFAULT 'USD' CHECK(moneda='USD'),
 version INTEGER NOT NULL DEFAULT 0,
 version_publicada INTEGER,
 periodo_base BIGINT REFERENCES public.cont_periodo ON DELETE RESTRICT,
 base_historica JSONB,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,anio),
 CHECK(origen <> 'HISTORICO' OR (estado='CERRADO' AND base_historica IS NOT NULL))
);
CREATE TABLE public.cont_asiento (
 id BIGSERIAL PRIMARY KEY,
 periodo_id BIGINT NOT NULL REFERENCES public.cont_periodo ON DELETE RESTRICT,
 numero INTEGER NOT NULL,
 fecha DATE NOT NULL,
 descripcion TEXT NOT NULL CHECK(length(btrim(descripcion)) BETWEEN 3 AND 500),
 tipo TEXT NOT NULL CHECK(tipo IN ('APERTURA','OPERACION','CORRECCION','AJUSTE','CIERRE','REAPERTURA')),
 estado TEXT NOT NULL DEFAULT 'BORRADOR' CHECK(estado IN ('BORRADOR','CONTABILIZADO')),
 usuario_id INTEGER NOT NULL REFERENCES public.usuario ON DELETE RESTRICT,
 reversa_de BIGINT UNIQUE REFERENCES public.cont_asiento ON DELETE RESTRICT,
 clave UUID NOT NULL UNIQUE,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(periodo_id,numero)
);
CREATE INDEX cont_periodo_base ON public.cont_periodo(periodo_base);
CREATE UNIQUE INDEX cont_apertura_unica ON public.cont_asiento(periodo_id) WHERE tipo='APERTURA';
CREATE TABLE public.cont_linea (
 id BIGSERIAL PRIMARY KEY,
 asiento_id BIGINT NOT NULL REFERENCES public.cont_asiento ON DELETE RESTRICT,
 cuenta_id INTEGER NOT NULL REFERENCES public.cuenta ON DELETE RESTRICT,
 debe NUMERIC(15,2) NOT NULL DEFAULT 0,
 haber NUMERIC(15,2) NOT NULL DEFAULT 0,
 CHECK(debe>=0 AND haber>=0 AND ((debe>0 AND haber=0) OR (haber>0 AND debe=0)))
);
CREATE INDEX cont_linea_asiento ON public.cont_linea(asiento_id);
CREATE INDEX cont_linea_cuenta ON public.cont_linea(cuenta_id);
CREATE INDEX cont_asiento_periodo ON public.cont_asiento(periodo_id,fecha,numero);
CREATE TABLE public.cont_publicacion (
 id BIGSERIAL PRIMARY KEY,
 periodo_id BIGINT NOT NULL REFERENCES public.cont_periodo ON DELETE RESTRICT,
 version INTEGER NOT NULL,
 estados JSONB NOT NULL,
 usuario_id INTEGER NOT NULL REFERENCES public.usuario ON DELETE RESTRICT,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(periodo_id,version)
);
CREATE TABLE public.cont_auditoria (
 id BIGSERIAL PRIMARY KEY,
 periodo_id BIGINT REFERENCES public.cont_periodo ON DELETE RESTRICT,
 usuario_id INTEGER NOT NULL REFERENCES public.usuario ON DELETE RESTRICT,
 accion TEXT NOT NULL,
 detalle JSONB NOT NULL DEFAULT '{}'::JSONB,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cont_auditoria_periodo ON public.cont_auditoria(periodo_id,id DESC);

CREATE FUNCTION public.cont_proteger_linea() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE aid BIGINT; p cont_periodo; a cont_asiento;
BEGIN
 aid := CASE WHEN TG_OP='DELETE' THEN OLD.asiento_id ELSE NEW.asiento_id END;
 SELECT * INTO a FROM cont_asiento WHERE id=aid;
 SELECT * INTO p FROM cont_periodo WHERE id=a.periodo_id FOR UPDATE;
 IF a.estado='CONTABILIZADO' OR p.estado='CERRADO' OR p.origen='HISTORICO' THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Las partidas contabilizadas son inmutables. Registre una corrección vinculada.';
 END IF;
 IF TG_OP='UPDATE' AND NEW.asiento_id<>OLD.asiento_id THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='No se puede trasladar una línea a otra partida.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cont_linea_inmutable BEFORE INSERT OR UPDATE OR DELETE ON public.cont_linea
 FOR EACH ROW EXECUTE FUNCTION public.cont_proteger_linea();

CREATE FUNCTION public.cont_proteger_asiento() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p cont_periodo; n INTEGER; d NUMERIC; h NUMERIC;
BEGIN
 IF TG_OP<>'INSERT' AND OLD.estado='CONTABILIZADO' THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='No se puede editar ni eliminar una partida contabilizada.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 SELECT * INTO p FROM cont_periodo WHERE id=NEW.periodo_id FOR UPDATE;
 IF p.origen='HISTORICO' OR p.estado='CERRADO' THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El período no admite movimientos.';
 END IF;
 IF TG_OP='UPDATE' AND (NEW.periodo_id<>OLD.periodo_id OR NEW.numero<>OLD.numero OR NEW.clave<>OLD.clave) THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='No se puede cambiar la identidad de una partida.';
 END IF;
 IF extract(year FROM NEW.fecha)<>p.anio THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='La fecha debe pertenecer al ejercicio anual seleccionado.';
 END IF;
 IF p.estado='REVISION' AND NEW.tipo='OPERACION' THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El período está en revisión: solo se admiten ajustes y correcciones.';
 END IF;
 IF NEW.estado='CONTABILIZADO' THEN
   IF NEW.tipo NOT IN ('APERTURA','CIERRE','REAPERTURA') AND NOT EXISTS(
     SELECT 1 FROM cont_asiento WHERE periodo_id=p.id AND tipo='APERTURA' AND estado='CONTABILIZADO') THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Contabilice la apertura antes de registrar operaciones del ejercicio.';
   END IF;
   SELECT count(*),COALESCE(sum(debe),0),COALESCE(sum(haber),0) INTO n,d,h FROM cont_linea WHERE asiento_id=NEW.id;
   IF n<2 OR d<>h OR d=0 THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Se necesitan al menos dos líneas y Debe = Haber exactamente.';
   END IF;
   IF NEW.tipo='APERTURA' AND EXISTS(SELECT 1 FROM cont_linea l JOIN cuenta c USING(cuenta_id)
     WHERE l.asiento_id=NEW.id AND left(c.cue_cuenta_id,1) NOT IN ('1','2','3')) THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='La apertura solo traslada activos, pasivos y patrimonio; no ingresos ni gastos anteriores.';
   END IF;
   IF EXISTS(SELECT 1 FROM cont_linea l JOIN cuenta c USING(cuenta_id)
     WHERE l.asiento_id=NEW.id AND (left(c.cue_cuenta_id,1) NOT IN ('1','2','3','4','5')
       OR NOT EXISTS(SELECT 1 FROM catalogo ca WHERE ca.empresa_id=p.empresa_id AND ca.cuenta_id=l.cuenta_id AND ca.activo)
       OR (NOT c.is_postable AND NEW.tipo NOT IN ('APERTURA','CIERRE','REAPERTURA')))) THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Use cuentas activas del catálogo ANF habilitadas para movimientos.';
   END IF;
   IF NEW.tipo NOT IN ('CIERRE','REAPERTURA') AND EXISTS(SELECT 1 FROM cont_linea l JOIN cuenta c USING(cuenta_id)
     WHERE l.asiento_id=NEW.id AND c.cue_cuenta_id LIKE '3204%') THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El resultado del ejercicio lo genera el sistema. Use resultados acumulados para la apertura.';
   END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cont_asiento_inmutable BEFORE INSERT OR UPDATE OR DELETE ON public.cont_asiento
 FOR EACH ROW EXECUTE FUNCTION public.cont_proteger_asiento();
CREATE FUNCTION public.cont_registrar_version() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NEW.estado='CONTABILIZADO' AND NEW.tipo NOT IN ('CIERRE','REAPERTURA') THEN
   UPDATE cont_periodo SET version=version+1 WHERE id=NEW.periodo_id;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cont_version AFTER INSERT OR UPDATE ON public.cont_asiento
 FOR EACH ROW EXECUTE FUNCTION public.cont_registrar_version();

-- Un saldo firmado siempre representa Debe - Haber. El histórico no inventa movimientos.
CREATE FUNCTION public.cont_saldos(p_periodo BIGINT)
RETURNS TABLE(cuenta_id INTEGER,codigo TEXT,nombre TEXT,debe NUMERIC,haber NUMERIC,sin_ajustes NUMERIC,ajuste NUMERIC,saldo NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT c.cuenta_id,c.cue_cuenta_id::TEXT,c.nombre_cuenta::TEXT,sum(l.debe),sum(l.haber),
 sum(CASE WHEN a.tipo<>'AJUSTE' THEN l.debe-l.haber ELSE 0 END),
 sum(CASE WHEN a.tipo='AJUSTE' THEN l.debe-l.haber ELSE 0 END),sum(l.debe-l.haber)
 FROM cont_linea l JOIN cont_asiento a ON a.id=l.asiento_id JOIN cuenta c USING(cuenta_id)
 WHERE a.periodo_id=p_periodo AND a.estado='CONTABILIZADO' AND a.tipo NOT IN ('CIERRE','REAPERTURA')
 GROUP BY c.cuenta_id,c.cue_cuenta_id,c.nombre_cuenta
 UNION ALL
 SELECT (j->>'cuenta_id')::INTEGER,j->>'codigo',j->>'nombre',NULL::NUMERIC,NULL::NUMERIC,
 (j->>'firmado')::NUMERIC,0::NUMERIC,(j->>'firmado')::NUMERIC
 FROM cont_periodo p CROSS JOIN LATERAL jsonb_array_elements(p.base_historica) j
 WHERE p.id=p_periodo AND p.origen='HISTORICO' AND j->>'codigo' NOT LIKE '3204%';
$$;

-- Las partidas contienen movimientos exclusivos: un saldo inicial resumido y
-- sus movimientos nuevos en subcuentas se suman, nunca son subtotales repetidos.
-- Publica un único nivel de cuentas compatible con las sumas por prefijo de ANF.
CREATE FUNCTION public.cont_saldos_estado(p_periodo BIGINT)
RETURNS TABLE(cuenta_id INTEGER,codigo TEXT,nombre TEXT,saldo NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH saldos AS MATERIALIZED (SELECT * FROM cont_saldos(p_periodo)), agrupados AS (
   SELECT padre.cuenta_id,padre.codigo,padre.nombre,s.saldo
   FROM saldos s CROSS JOIN LATERAL (
     SELECT a.cuenta_id,a.codigo,a.nombre FROM saldos a
     WHERE s.codigo LIKE a.codigo||'%' ORDER BY length(a.codigo),a.cuenta_id LIMIT 1
   ) padre
 ) SELECT a.cuenta_id,a.codigo,a.nombre,sum(a.saldo) FROM agrupados a GROUP BY a.cuenta_id,a.codigo,a.nombre;
$$;

CREATE FUNCTION public.cont_estados(p_periodo BIGINT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE p cont_periodo; utilidad NUMERIC; balance JSONB; resultados JSONB; resultado_id INTEGER; venta_id INTEGER;
BEGIN
 SELECT * INTO STRICT p FROM cont_periodo WHERE id=p_periodo;
 SELECT -COALESCE(sum(saldo),0) INTO utilidad FROM cont_saldos(p_periodo) WHERE left(codigo,1) IN ('4','5');
 IF p.origen='HISTORICO' THEN
   -- El BG ya contiene el resultado sintetizado por ANF. No duplicarlo en comprobación.
   SELECT COALESCE(jsonb_agg(jsonb_build_object('cuentaId',(x->>'cuenta_id')::INTEGER,'codigo',x->>'codigo','nombre',x->>'nombre',
     'saldo',(x->>'firmado')::NUMERIC * CASE WHEN left(x->>'codigo',1) IN ('2','3') THEN -1 ELSE 1 END) ORDER BY x->>'codigo'),'[]'::JSONB)
     INTO balance FROM jsonb_array_elements(p.base_historica) x WHERE left(x->>'codigo',1) IN ('1','2','3');
   SELECT COALESCE(jsonb_agg(jsonb_build_object('cuentaId',(x->>'cuenta_id')::INTEGER,'codigo',x->>'codigo','nombre',x->>'nombre',
     'saldo',(x->>'firmado')::NUMERIC * CASE WHEN left(x->>'codigo',1)='5' AND x->>'codigo' NOT LIKE '5101.02%' THEN -1 ELSE 1 END) ORDER BY x->>'codigo'),'[]'::JSONB)
     INTO resultados FROM jsonb_array_elements(p.base_historica) x WHERE left(x->>'codigo',1) IN ('4','5');
   RETURN jsonb_build_object('balance',balance,'resultados',resultados,'utilidad',utilidad,'version',p.version,
     'ventas',COALESCE((SELECT -sum(saldo) FROM cont_saldos(p_periodo) WHERE codigo LIKE '5101.01%' OR codigo LIKE '5101.02%'),0));
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('cuentaId',cuenta_id,'codigo',codigo,'nombre',nombre,
   'saldo',CASE WHEN left(codigo,1) IN ('2','3') THEN -saldo ELSE saldo END) ORDER BY codigo),'[]'::JSONB)
 INTO balance FROM cont_saldos_estado(p_periodo) WHERE left(codigo,1) IN ('1','2','3');
 SELECT COALESCE(jsonb_agg(jsonb_build_object('cuentaId',cuenta_id,'codigo',codigo,'nombre',nombre,
   'saldo',CASE WHEN left(codigo,1)='5' AND codigo NOT LIKE '5101.02%' THEN -saldo ELSE saldo END) ORDER BY codigo),'[]'::JSONB)
 INTO resultados FROM cont_saldos_estado(p_periodo) WHERE left(codigo,1) IN ('4','5');
 SELECT cuenta_id INTO resultado_id FROM cuenta WHERE cue_cuenta_id='3204' ORDER BY cuenta_id LIMIT 1;
 SELECT cuenta_id INTO venta_id FROM cuenta WHERE cue_cuenta_id='5101.01' ORDER BY cuenta_id LIMIT 1;
 IF resultado_id IS NULL OR venta_id IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El catálogo ANF debe incluir 3204 y 5101.01.';
 END IF;
 IF p.origen='CONTABILIDAD' THEN
   balance:=balance||jsonb_build_array(jsonb_build_object('cuentaId',resultado_id,'codigo','3204','nombre','Resultado del ejercicio','saldo',utilidad));
 END IF;
 IF jsonb_array_length(resultados)=0 THEN
   resultados:=jsonb_build_array(jsonb_build_object('cuentaId',venta_id,'codigo','5101.01','nombre','Ventas','saldo',0));
 END IF;
 RETURN jsonb_build_object('balance',balance,'resultados',resultados,'utilidad',utilidad,'version',p.version,
 'ventas',COALESCE((SELECT -sum(saldo) FROM cont_saldos(p_periodo) WHERE codigo LIKE '5101.01%' OR codigo LIKE '5101.02%'),0));
END; $$;

-- La consulta debe seguir permitiendo corregir cuentas aun si el reporte está bloqueado.
CREATE FUNCTION public.cont_vista_estados(p_periodo BIGINT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN RETURN cont_estados(p_periodo);
EXCEPTION WHEN SQLSTATE 'ANF04' THEN
 RETURN jsonb_build_object('balance','[]'::JSONB,'resultados','[]'::JSONB,'utilidad',0,'ventas',0,'error',SQLERRM);
END; $$;

CREATE FUNCTION public.cont_consultar(p_empresa INTEGER,p_periodo BIGINT DEFAULT NULL) RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT jsonb_build_object(
 'periodos',COALESCE((SELECT jsonb_agg(to_jsonb(p)-'base_historica' ORDER BY p.anio DESC) FROM cont_periodo p WHERE empresa_id=p_empresa),'[]'::JSONB),
 'cuentas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.cuenta_id,'codigo',c.cue_cuenta_id,'nombre',c.nombre_cuenta,
   'tipo',c.tipo_cuenta,'imputable',c.is_postable,'activa',COALESCE(ca.activo,false)) ORDER BY c.cue_cuenta_id)
   FROM cuenta c LEFT JOIN catalogo ca ON ca.cuenta_id=c.cuenta_id AND ca.empresa_id=p_empresa),'[]'::JSONB),
 'partidas',COALESCE((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('autor',u.user_name,'lineas',
   (SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('codigo',c.cue_cuenta_id,'nombre',c.nombre_cuenta) ORDER BY l.id)
     FROM cont_linea l JOIN cuenta c USING(cuenta_id) WHERE asiento_id=a.id)) ORDER BY a.fecha DESC,a.numero DESC)
   FROM cont_asiento a JOIN cont_periodo p ON p.id=a.periodo_id JOIN usuario u ON u.usuario_id=a.usuario_id
   WHERE p.id=p_periodo AND p.empresa_id=p_empresa),'[]'::JSONB),
 'saldos',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY codigo) FROM cont_saldos(p_periodo) s
   WHERE EXISTS(SELECT 1 FROM cont_periodo WHERE id=p_periodo AND empresa_id=p_empresa)),'[]'::JSONB),
 'publicaciones',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id DESC) FROM cont_publicacion v
   JOIN cont_periodo p ON p.id=v.periodo_id WHERE p.id=p_periodo AND p.empresa_id=p_empresa),'[]'::JSONB),
 'auditoria',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id DESC) FROM
   (SELECT a.* FROM cont_auditoria a LEFT JOIN cont_periodo p ON p.id=a.periodo_id
     WHERE (p.id=p_periodo AND p.empresa_id=p_empresa) OR
       (a.periodo_id IS NULL AND a.detalle->>'empresaId'=p_empresa::TEXT)
     ORDER BY a.id DESC LIMIT 200) v),'[]'::JSONB),
 'estados',CASE WHEN EXISTS(SELECT 1 FROM cont_periodo WHERE id=p_periodo AND empresa_id=p_empresa)
   THEN cont_vista_estados(p_periodo) ELSE NULL END,
 'apertura',COALESCE((SELECT jsonb_agg(jsonb_build_object('codigo',c.cue_cuenta_id,'saldo',l.haber-l.debe))
   FROM cont_linea l JOIN cuenta c USING(cuenta_id) JOIN cont_asiento a ON a.id=l.asiento_id
   JOIN cont_periodo p ON p.id=a.periodo_id WHERE p.id=p_periodo AND p.empresa_id=p_empresa
   AND a.tipo='APERTURA' AND a.estado='CONTABILIZADO'),'[]'::JSONB)
);
$$;

CREATE FUNCTION public.cont_operar(p_empresa INTEGER,p_usuario INTEGER,p_accion TEXT,p_datos JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p cont_periodo; base cont_periodo; a cont_asiento; anterior cont_asiento; j JSONB;
 idp BIGINT; ida BIGINT; n INTEGER; v NUMERIC; d NUMERIC; h NUMERIC; y INTEGER; acumulados INTEGER;
 r_id INTEGER; estados JSONB; bg_id BIGINT; er_id BIGINT; padre cuenta; codigo_nuevo TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM usuario WHERE usuario_id=p_usuario) THEN RAISE EXCEPTION 'Usuario inexistente'; END IF;
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
 IF p_accion='perfil' THEN
   IF NOT EXISTS(SELECT 1 FROM usuario WHERE usuario_id=p_usuario AND rol='ADMIN') THEN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Solo el administrador asigna perfiles.'; END IF;
   n:=(p_datos->>'usuarioId')::INTEGER;
   IF NOT EXISTS(SELECT 1 FROM usuario WHERE usuario_id=n AND rol<>'ADMIN') OR p_datos->>'perfil' NOT IN ('SIN_ACCESO','AUDITOR','AUXILIAR','CONTADOR','SUPERVISOR') THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Usuario o perfil inválido.';
   END IF;
   DELETE FROM acceso_usuario WHERE usuario_id=n AND id_opcion IN ('8','9','10','11');
   INSERT INTO acceso_usuario(usuario_id,id_opcion)
     SELECT n,op::TEXT FROM generate_series(8,CASE p_datos->>'perfil' WHEN 'AUDITOR' THEN 8 WHEN 'AUXILIAR' THEN 9 WHEN 'CONTADOR' THEN 10 WHEN 'SUPERVISOR' THEN 11 ELSE 7 END) op;
   INSERT INTO cont_auditoria(usuario_id,accion,detalle) VALUES(p_usuario,'ASIGNAR_PERFIL',p_datos||jsonb_build_object('empresaId',p_empresa));
   RETURN jsonb_build_object('ok',true);
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

-- Evita sobreescritura por Excel o CRUD de estados administrados por Contabilidad.
CREATE FUNCTION public.cont_proteger_estado() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE eid INTEGER; y INTEGER; pid BIGINT; sid BIGINT;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF TG_TABLE_NAME='estado_financiero' THEN eid:=OLD.empresa_id; y:=OLD.anio;
   ELSE SELECT empresa_id,anio INTO eid,y FROM estado_financiero WHERE id_estado_financiero=OLD.id_estado_financiero; END IF;
   SELECT id INTO pid FROM cont_periodo WHERE empresa_id=eid AND anio=y;
   IF pid IS NOT NULL AND COALESCE(current_setting('anf.cont_publicando',true),'')<>pid::TEXT THEN
     RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='No se puede trasladar un estado o línea administrado por Contabilidad.';
   END IF;
 END IF;
 IF TG_TABLE_NAME='estado_financiero' THEN
   IF TG_OP='DELETE' THEN eid:=OLD.empresa_id; y:=OLD.anio; ELSE eid:=NEW.empresa_id; y:=NEW.anio; END IF;
 ELSE
   sid:=CASE WHEN TG_OP='DELETE' THEN OLD.id_estado_financiero ELSE NEW.id_estado_financiero END;
   SELECT empresa_id,anio INTO eid,y FROM estado_financiero WHERE id_estado_financiero=sid;
 END IF;
 SELECT id INTO pid FROM cont_periodo WHERE empresa_id=eid AND anio=y;
 IF pid IS NOT NULL AND COALESCE(current_setting('anf.cont_publicando',true),'')<>pid::TEXT THEN
   RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='Este año está administrado por Contabilidad. Use su flujo de publicación.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cont_estado_protegido BEFORE INSERT OR UPDATE OR DELETE ON public.estado_financiero FOR EACH ROW EXECUTE FUNCTION public.cont_proteger_estado();
CREATE TRIGGER cont_estado_linea_protegida BEFORE INSERT OR UPDATE OR DELETE ON public.linea_estado_financiero FOR EACH ROW EXECUTE FUNCTION public.cont_proteger_estado();

CREATE FUNCTION public.cont_inmutable_registro() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='ANF04',MESSAGE='El historial de auditoría y las publicaciones son inmutables.'; END; $$;
CREATE TRIGGER cont_auditoria_inmutable BEFORE UPDATE OR DELETE ON public.cont_auditoria FOR EACH ROW EXECUTE FUNCTION public.cont_inmutable_registro();
CREATE TRIGGER cont_publicacion_inmutable BEFORE UPDATE OR DELETE ON public.cont_publicacion FOR EACH ROW EXECUTE FUNCTION public.cont_inmutable_registro();

DO $$ DECLARE t TEXT; f RECORD; BEGIN
 FOREACH t IN ARRAY ARRAY['cont_periodo','cont_asiento','cont_linea','cont_publicacion','cont_auditoria'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
 FOR f IN SELECT oid::regprocedure firma FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'cont_%' LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.firma);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.firma);
 END LOOP;
END; $$;
GRANT USAGE,SELECT ON SEQUENCE cont_periodo_id_seq,cont_asiento_id_seq,cont_linea_id_seq,cont_publicacion_id_seq,cont_auditoria_id_seq TO service_role;
COMMIT;
