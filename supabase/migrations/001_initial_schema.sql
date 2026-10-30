-- ============================================================
-- Initial Schema Migration for Proyecto ANF (Supabase / Postgres)
-- Faithful port of the Spring Boot + MySQL entity model.
-- Naming follows the exact column names used by the original
-- JPA entities so every query/DTO keeps the same shape.
-- ============================================================

-- ------------------------------------------------------------
-- MODULE: usuario
-- ------------------------------------------------------------

-- OpcionForm: menu options. id_opcion is a String PK (NOT serial),
-- the frontend menu switches on its numeric value via accesos[].
CREATE TABLE IF NOT EXISTS opcion_form (
    id_opcion  VARCHAR(10)  PRIMARY KEY,
    des_opcion VARCHAR(100) NOT NULL,
    num_form   INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usuario (
    usuario_id      SERIAL PRIMARY KEY,
    nombre_usuario  VARCHAR(50)  NOT NULL,
    apellido_usuario VARCHAR(50) NOT NULL,
    user_name       VARCHAR(50)  NOT NULL UNIQUE,
    contrasena      VARCHAR(256) NOT NULL,       -- bcrypt hash (mirror of auth.users password)
    rol             VARCHAR(15)  NOT NULL,       -- 'ADMIN' | 'USER'
    auth_user_id    UUID UNIQUE                  -- links to supabase auth.users
);

-- AccesoUsuario: permission row per user per menu option.
-- FK column is id_opcion (matches OpcionForm's PK), as in the original.
CREATE TABLE IF NOT EXISTS acceso_usuario (
    acceso_id  SERIAL PRIMARY KEY,
    usuario_id INTEGER      NOT NULL REFERENCES usuario(usuario_id) ON DELETE CASCADE,
    id_opcion  VARCHAR(10)  NOT NULL REFERENCES opcion_form(id_opcion),
    empresa_id INTEGER,                        -- optional, unused by logic; FK added after empresa exists
    UNIQUE (usuario_id, id_opcion)
);

-- ------------------------------------------------------------
-- MODULE: empresa (sector + empresa + parametro_sector)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sector (
    id_sector       SERIAL PRIMARY KEY,
    nombre_sector   VARCHAR(100) NOT NULL,
    descripcion     VARCHAR(256),
    pais_referencia VARCHAR(100),
    fuente_datos    VARCHAR(256)
);

-- FK to sector column is id_sector (NOT sector_id) per the original entity.
CREATE TABLE IF NOT EXISTS empresa (
    empresa_id     SERIAL PRIMARY KEY,
    nombre_empresa VARCHAR(50) NOT NULL,
    empresa_dui    VARCHAR(10),
    empresa_nit    VARCHAR(17),
    empresa_nrc    VARCHAR(14),
    usuario_id     INTEGER REFERENCES usuario(usuario_id),
    id_sector      INTEGER REFERENCES sector(id_sector)
);

-- categoria_ratio must exist before parametro_sector FK (created below in
-- MODULE: analisis but referenced here; Postgres allows forward references
-- only with ALTER, so the FK is added after categoria_ratio is created).
CREATE TABLE IF NOT EXISTS parametro_sector (
    id_parametro_sector SERIAL PRIMARY KEY,
    nombre_ratio        VARCHAR(100)   NOT NULL,
    valor_referencia    NUMERIC(15,2)  NOT NULL,
    fuente              VARCHAR(256),
    anio_referencia     INTEGER,
    id_sector           INTEGER REFERENCES sector(id_sector),
    id_categoria_ratio  INTEGER        -- FK added in MODULE: analisis
);

-- ------------------------------------------------------------
-- MODULE: catalogo (cuenta master + per-company catalog)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cuenta (
    cuenta_id         SERIAL PRIMARY KEY,
    cue_cuenta_id     VARCHAR(256) NOT NULL,   -- the master account code (NOT codigo_cuenta)
    nombre_cuenta     VARCHAR(256) NOT NULL,
    codigo_individual VARCHAR(256),
    codigo_generado   VARCHAR(256),
    tipo_cuenta       VARCHAR(50),             -- e.g. 'ACTIVO'
    id_cuenta_padre   INTEGER REFERENCES cuenta(cuenta_id),
    is_postable       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS catalogo (
    id_catalogo SERIAL PRIMARY KEY,
    activo      BOOLEAN NOT NULL,
    empresa_id  INTEGER NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    cuenta_id   INTEGER NOT NULL REFERENCES cuenta(cuenta_id),
    UNIQUE (empresa_id, cuenta_id)
);

-- ------------------------------------------------------------
-- MODULE: estadofinanciero
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estado_financiero (
    id_estado_financiero BIGSERIAL PRIMARY KEY,
    anio                 INTEGER    NOT NULL,
    tipo_reporte         VARCHAR(20) NOT NULL,   -- 'BALANCE_GENERAL' | 'ESTADO_RESULTADOS'
    empresa_id           INTEGER    NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    UNIQUE (empresa_id, anio, tipo_reporte)
);

CREATE TABLE IF NOT EXISTS linea_estado_financiero (
    id_linea             BIGSERIAL PRIMARY KEY,
    saldo                NUMERIC(15,2) NOT NULL,
    id_estado_financiero BIGINT NOT NULL REFERENCES estado_financiero(id_estado_financiero) ON DELETE CASCADE,
    cuenta_id            INTEGER NOT NULL REFERENCES cuenta(cuenta_id)
);

-- ------------------------------------------------------------
-- MODULE: analisis (tipo_ratio + categoria_ratio + ratio)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipo_ratio (
    id_tipo_ratio SERIAL PRIMARY KEY,
    nombre_ratio  VARCHAR(100) NOT NULL,
    codigo_ratio  VARCHAR(10),
    descripcion   VARCHAR(256),
    unidad_ratio  VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS categoria_ratio (
    id_categoria_ratio SERIAL PRIMARY KEY,
    nombre_tipo        VARCHAR(50) NOT NULL,   -- must match the ratio calculator category names
    descripcion        VARCHAR(256),
    id_tipo_ratio      INTEGER NOT NULL REFERENCES tipo_ratio(id_tipo_ratio)
);

ALTER TABLE parametro_sector
    ADD CONSTRAINT fk_parametro_sector_categoria
    FOREIGN KEY (id_categoria_ratio) REFERENCES categoria_ratio(id_categoria_ratio);

-- acceso_usuario is declared before empresa (original entity order), so its
-- optional FK is added here once empresa exists.
ALTER TABLE acceso_usuario
    ADD CONSTRAINT fk_acceso_usuario_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresa(empresa_id);

-- NOTE: ratio.* columns are snake_case in the ORIGINAL entity (field names
-- literally are anio_ratio etc.) - JSON keys of Ratio*DTOs are the same.
CREATE TABLE IF NOT EXISTS ratio (
    id_ratio              SERIAL PRIMARY KEY,
    anio_ratio            INTEGER,
    periodo_ratio         VARCHAR(10),
    valor_calculado       NUMERIC(15,2),
    valor_sector_promedio NUMERIC(15,2),
    diferencia_vs_sector  NUMERIC(15,2),
    cumple_sector         BOOLEAN,
    interpretacion        VARCHAR(256),
    empresa_id            INTEGER NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE,
    id_categoria_ratio    INTEGER REFERENCES categoria_ratio(id_categoria_ratio),
    id_parametro_sector   INTEGER REFERENCES parametro_sector(id_parametro_sector)
);

-- ------------------------------------------------------------
-- MODULE: proyeccion (venta)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS venta (
    id_venta    BIGSERIAL PRIMARY KEY,
    fecha_venta DATE         NOT NULL,
    monto_venta NUMERIC(10,2) NOT NULL,
    observacion VARCHAR(256),
    empresa_id  INTEGER NOT NULL REFERENCES empresa(empresa_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_acceso_usuario ON acceso_usuario(usuario_id, id_opcion);
CREATE INDEX IF NOT EXISTS idx_empresa_usuario ON empresa(usuario_id);
CREATE INDEX IF NOT EXISTS idx_empresa_sector ON empresa(id_sector);
CREATE INDEX IF NOT EXISTS idx_parametro_sector ON parametro_sector(id_sector, id_categoria_ratio);
CREATE INDEX IF NOT EXISTS idx_cuenta_padre ON cuenta(id_cuenta_padre);
CREATE INDEX IF NOT EXISTS idx_catalogo_empresa ON catalogo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_estado_financiero_empresa ON estado_financiero(empresa_id);
CREATE INDEX IF NOT EXISTS idx_linea_estado ON linea_estado_financiero(id_estado_financiero);
CREATE INDEX IF NOT EXISTS idx_linea_cuenta ON linea_estado_financiero(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_ratio_empresa ON ratio(empresa_id);
CREATE INDEX IF NOT EXISTS idx_venta_empresa ON venta(empresa_id);

-- ------------------------------------------------------------
-- Storage bucket for Excel uploads (estado financiero + ventas)
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-uploads', 'excel-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Row Level Security
-- All data access goes through Route Handlers using the service_role key,
-- which bypasses RLS. Enabling RLS with no policies denies direct access to
-- the public anon key (shipped to the browser) on every table. Add policies
-- only if a browser-side client ever needs direct reads.
-- ------------------------------------------------------------

ALTER TABLE opcion_form            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario                ENABLE ROW LEVEL SECURITY;
ALTER TABLE acceso_usuario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa                ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametro_sector       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuenta                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo               ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_financiero      ENABLE ROW LEVEL SECURITY;
ALTER TABLE linea_estado_financiero ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_ratio             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria_ratio        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratio                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta                  ENABLE ROW LEVEL SECURITY;
