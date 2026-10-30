-- ============================================================
-- Seed Data for Proyecto ANF (Supabase / Postgres)
-- Seeds ONLY the access/login layer:
--   - opcion_form       (menu options / permission ids)
--   - auth.users + auth.identities (admin login)
--   - usuario           (admin profile linked to its auth id)
--   - acceso_usuario    (admin permissions)
--
-- Business data (sectores, cuentas, catálogo, empresas, estados
-- financieros, ratios, ventas) is NOT seeded: it is loaded with real
-- data through the app.
--
-- Login convention: users sign in with their userName; the app maps
-- it to the Supabase Auth email {userName}@anf.local
-- ============================================================

-- pgcrypto is required to hash the demo password in auth.users
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1) Menu options (opcion_form)
--    id_opcion is the numeric id the frontend menu filters on:
--    user.accesos.includes(link.idOp)
-- ------------------------------------------------------------
INSERT INTO opcion_form (id_opcion, des_opcion, num_form) VALUES
    ('0', 'PAGINA PRINCIPAL',            0),
    ('1', 'GESTION DE EMPRESAS',         1),
    ('2', 'MODULO ANALISIS FINANCIERO',  2),
    ('3', 'MODULO RATIOS',               3),
    ('4', 'ADMINISTRACION DE USUARIOS',  4),
    ('5', 'GESTION CATALOGO DE CUENTAS', 5),
    ('6', 'GESTION DE PROYECCIONES',     6),
    ('7', 'GESTION ESTADOS FINANCIEROS', 7)
ON CONFLICT (id_opcion) DO NOTHING;

-- ------------------------------------------------------------
-- 2) Demo admin user
--    Login: userName 'admin', password 'admin123'
--    (Supabase Auth email: admin@anf.local)
-- ------------------------------------------------------------
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'admin@anf.local', crypt('admin123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
)
ON CONFLICT DO NOTHING;

-- GoTrue signs in with the auth.users row, but accounts created through the
-- Auth API also carry an identity row; without it some GoTrue versions reject
-- the login with "Database error querying schema".
INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
)
SELECT
    u.id::text, u.id,
    jsonb_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', true,
        'phone_verified', false
    ),
    'email', now(), now(), now()
FROM auth.users u
WHERE u.email = 'admin@anf.local'
ON CONFLICT (provider_id, provider) DO NOTHING;

INSERT INTO usuario (nombre_usuario, apellido_usuario, user_name, contrasena, rol, auth_user_id)
SELECT 'Administrador', 'General', 'admin',
       u.encrypted_password, 'ADMIN', u.id
FROM auth.users u
WHERE u.email = 'admin@anf.local'
ON CONFLICT (user_name) DO NOTHING;

-- admin gets every menu option (accesos 0..7)
INSERT INTO acceso_usuario (usuario_id, id_opcion)
SELECT us.usuario_id, op.id_opcion
FROM usuario us, opcion_form op
WHERE us.user_name = 'admin'
ON CONFLICT (usuario_id, id_opcion) DO NOTHING;
