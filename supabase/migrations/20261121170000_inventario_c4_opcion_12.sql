BEGIN;

INSERT INTO public.opcion_form (id_opcion, des_opcion, num_form)
VALUES ('12', 'GESTION INVENTARIO', 12)
ON CONFLICT (id_opcion) DO UPDATE
SET des_opcion = EXCLUDED.des_opcion, num_form = EXCLUDED.num_form;

UPDATE public.opcion_form
SET des_opcion = 'CONTABILIDAD: CONSULTAR', num_form = 8
WHERE id_opcion = '8';

INSERT INTO public.acceso_usuario (usuario_id, id_opcion)
SELECT u.usuario_id, '12'
FROM public.usuario u
WHERE u.rol = 'ADMIN'
ON CONFLICT (usuario_id, id_opcion) DO NOTHING;

COMMIT;
