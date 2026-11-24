BEGIN;

UPDATE public.producto AS p
SET nombre = v.nombre, descripcion = v.descripcion
FROM (VALUES
    ('INV-001', 'Motor 1.6 L', 'Motor completo 1.6 L para vehículo ligero'),
    ('INV-002', 'Motor 1.8 L', 'Motor completo 1.8 L para vehículo ligero'),
    ('INV-003', 'Motor 1.4 L', 'Motor completo 1.4 L para vehículo ligero'),
    ('INV-004', 'Motor 1.0 L', 'Motor completo 1.0 L para vehículo ligero'),
    ('INV-005', 'Motor 2.0 L diésel', 'Motor diésel 2.0 L para vehículo ligero'),
    ('INV-006', 'Motor 1.2 L', 'Motor completo 1.2 L para vehículo ligero'),
    ('INV-007', 'Motor 1.5 L turbo', 'Motor turbo 1.5 L para vehículo ligero'),
    ('INV-008', 'Motor 2.4 L', 'Motor completo 2.4 L para vehículo ligero'),
    ('INV-009', 'Alternador', 'Alternador de vehículo'),
    ('INV-010', 'Bujía', 'Bujía de encendido'),
    ('INV-011', 'Filtro de aceite', 'Filtro de aceite de motor'),
    ('INV-012', 'Correa de distribución', 'Correa de distribución de motor'),
    ('INV-013', 'Módulo ECU', 'Unidad de control electrónico del motor')
) AS v(codigo_sku, nombre, descripcion)
WHERE p.empresa_id = 2 AND p.codigo_sku = v.codigo_sku
  AND (p.nombre, p.descripcion) IS DISTINCT FROM (v.nombre, v.descripcion);

NOTIFY pgrst, 'reload schema';

COMMIT;
