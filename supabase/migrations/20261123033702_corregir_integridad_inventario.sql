-- No contiene semillas ni modifica saldos o transacciones existentes.
-- Aplicar antes de desplegar las rutas de movimientos que invocan estas funciones.
BEGIN;
GRANT SELECT, UPDATE ON public.producto TO service_role;
GRANT SELECT, INSERT, DELETE ON public.movimiento_inventario TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.movimiento_inventario_id_movimiento_seq TO service_role;

CREATE OR REPLACE FUNCTION public.inventario_registrar_movimiento(
  p_empresa INTEGER, p_producto BIGINT, p_tipo TEXT, p_cantidad INTEGER,
  p_fecha DATE, p_observacion TEXT DEFAULT NULL
) RETURNS public.movimiento_inventario
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE producto public.producto; movimiento public.movimiento_inventario; stock_nuevo BIGINT;
BEGIN
  IF p_empresa IS NULL OR p_empresa <= 0 OR p_producto IS NULL OR p_producto <= 0
     OR p_tipo IS NULL OR p_tipo NOT IN ('ENTRADA','SALIDA')
     OR p_cantidad IS NULL OR p_cantidad <= 0 OR p_fecha IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Datos inválidos del movimiento de inventario.';
  END IF;
  SELECT * INTO producto FROM public.producto
    WHERE id_producto=p_producto AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Producto no encontrado en la empresa.';
  END IF;
  IF NOT producto.activo THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='No se pueden registrar movimientos de un producto inactivo.';
  END IF;
  stock_nuevo := producto.stock_actual::BIGINT + CASE WHEN p_tipo='ENTRADA' THEN p_cantidad::BIGINT ELSE -p_cantidad::BIGINT END;
  IF stock_nuevo < 0 OR stock_nuevo > 2147483647 THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='Stock insuficiente o cantidad fuera del rango admitido.';
  END IF;
  INSERT INTO public.movimiento_inventario(empresa_id,producto_id,tipo_movimiento,cantidad,fecha,observacion)
    VALUES(p_empresa,p_producto,p_tipo,p_cantidad,p_fecha,p_observacion) RETURNING * INTO movimiento;
  PERFORM set_config('anf.inventario_movimiento','1',true);
  UPDATE public.producto SET stock_actual=stock_nuevo WHERE id_producto=p_producto AND empresa_id=p_empresa;
  PERFORM set_config('anf.inventario_movimiento','0',true);
  RETURN movimiento;
END; $$;

CREATE OR REPLACE FUNCTION public.inventario_eliminar_movimiento(p_empresa INTEGER, p_movimiento BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE movimiento public.movimiento_inventario; stock_anterior INTEGER; stock_nuevo BIGINT;
BEGIN
  SELECT * INTO movimiento FROM public.movimiento_inventario WHERE id_movimiento=p_movimiento AND empresa_id=p_empresa;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Movimiento no encontrado en la empresa.'; END IF;
  -- Mismo orden de bloqueo que el alta: primero producto y después movimiento.
  SELECT stock_actual INTO stock_anterior FROM public.producto
    WHERE id_producto=movimiento.producto_id AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Producto no encontrado en la empresa.'; END IF;
  SELECT * INTO movimiento FROM public.movimiento_inventario
    WHERE id_movimiento=p_movimiento AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='El movimiento ya fue eliminado.'; END IF;
  stock_nuevo := stock_anterior::BIGINT + CASE WHEN movimiento.tipo_movimiento='ENTRADA' THEN -movimiento.cantidad::BIGINT ELSE movimiento.cantidad::BIGINT END;
  IF stock_nuevo < 0 OR stock_nuevo > 2147483647 THEN
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='No se puede eliminar la entrada: sus unidades ya fueron consumidas. Registre un movimiento de corrección.';
  END IF;
  DELETE FROM public.movimiento_inventario WHERE id_movimiento=p_movimiento AND empresa_id=p_empresa;
  PERFORM set_config('anf.inventario_movimiento','1',true);
  UPDATE public.producto SET stock_actual=stock_nuevo WHERE id_producto=movimiento.producto_id AND empresa_id=p_empresa;
  PERFORM set_config('anf.inventario_movimiento','0',true);
END; $$;

REVOKE ALL ON FUNCTION public.inventario_registrar_movimiento(INTEGER,BIGINT,TEXT,INTEGER,DATE,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventario_eliminar_movimiento(INTEGER,BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventario_registrar_movimiento(INTEGER,BIGINT,TEXT,INTEGER,DATE,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.inventario_eliminar_movimiento(INTEGER,BIGINT) TO service_role;

-- Conservar movimientos y demanda: un producto con historial se desactiva.
CREATE OR REPLACE FUNCTION public.inventario_proteger_historial_producto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.stock_actual=OLD.stock_actual OR current_setting('anf.inventario_movimiento',true)='1') THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.movimiento_inventario WHERE producto_id=OLD.id_producto)
     OR EXISTS(SELECT 1 FROM public.venta_detalle WHERE producto_id=OLD.id_producto) THEN
    IF TG_OP='UPDATE' THEN RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='El producto tiene historial. Cambie sus existencias mediante Movimientos.'; END IF;
    RAISE EXCEPTION USING ERRCODE='ANF04', MESSAGE='El producto tiene historial. Desactívelo en lugar de eliminarlo.';
  END IF;
  IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS inventario_proteger_historial ON public.producto;
CREATE TRIGGER inventario_proteger_historial BEFORE DELETE OR UPDATE OF stock_actual ON public.producto
  FOR EACH ROW EXECUTE FUNCTION public.inventario_proteger_historial_producto();
REVOKE ALL ON FUNCTION public.inventario_proteger_historial_producto() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
