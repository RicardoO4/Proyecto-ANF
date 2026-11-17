-- ============================================================
-- 007 — Módulo E: guardar presupuestos (E1-E2) y evaluaciones de
-- presupuesto de capital (E3).
--
-- Qué hace:
--   1. Crea la tabla `presupuesto` (supuestos del presupuesto maestro).
--   2. Crea la tabla `evaluacion_capital` (TMAR, ISR y hasta 3 proyectos).
--   3. Índices por empresa y RLS activado sin políticas, igual que las
--      demás tablas: solo la API (service_role) puede leer y escribir.
--
-- Solo se guardan los DATOS DE ENTRADA (JSONB). Las cédulas, el
-- presupuesto de caja, VAN, TIR, etc. se recalculan al abrir con
-- src/lib/presupuesto.ts y src/lib/capital.ts.
--
-- No modifica ninguna tabla existente. Es idempotente: se puede correr
-- dos veces sin error ni duplicados.
--
-- Para deshacer:
--   DROP TABLE IF EXISTS evaluacion_capital;
--   DROP TABLE IF EXISTS presupuesto;
-- ============================================================

-- 1) Presupuesto maestro (E1-E2) ---------------------------------
CREATE TABLE IF NOT EXISTS presupuesto (
    id_presupuesto  BIGSERIAL    PRIMARY KEY,
    empresa_id      INTEGER      NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    usuario_id      INTEGER      REFERENCES usuario(usuario_id) ON DELETE SET NULL,
    nombre          VARCHAR(100) NOT NULL,
    anio            INTEGER      NOT NULL,
    supuestos       JSONB        NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_presupuesto_empresa_nombre UNIQUE (empresa_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_empresa ON presupuesto(empresa_id);

-- 2) Evaluación de presupuesto de capital (E3) -------------------
CREATE TABLE IF NOT EXISTS evaluacion_capital (
    id_evaluacion   BIGSERIAL    PRIMARY KEY,
    empresa_id      INTEGER      NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    usuario_id      INTEGER      REFERENCES usuario(usuario_id) ON DELETE SET NULL,
    nombre          VARCHAR(100) NOT NULL,
    datos           JSONB        NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_evaluacion_capital_empresa_nombre UNIQUE (empresa_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_evaluacion_capital_empresa ON evaluacion_capital(empresa_id);

-- 3) Row Level Security ------------------------------------------
-- Sin políticas: la clave pública (anon) no puede leer ni escribir.
ALTER TABLE presupuesto        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluacion_capital ENABLE ROW LEVEL SECURITY;
