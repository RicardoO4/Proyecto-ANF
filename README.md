# Análisis Financiero — Next.js + Supabase

Sistema de análisis financiero (estados financieros, ratios, proyecciones de ventas
y análisis comparativo) migrado de un monolito Spring Boot + React a un monolito
**Next.js (App Router) + TypeScript** con **Supabase** como capa de
autenticación, base de datos y almacenamiento.

## Stack

| Capa            | Tecnología                                                   |
| --------------- | ------------------------------------------------------------ |
| Frontend        | Next.js 16 (App Router), React 19, TypeScript                |
| UI              | Bootstrap 5, React Bootstrap, react-icons, rc-tree, recharts, MUI (multiselect) |
| API interna     | Route Handlers en `src/app/api/v1/**` (mismos paths que Spring) |
| Base de datos   | Supabase Postgres (acceso vía `@supabase/supabase-js`)        |
| Autenticación   | Supabase Auth (mapeada a la API original de usuarios/accesos) |
| Notificaciones  | react-hot-toast (toasts) + sweetalert2 (diálogos)            |
| Excel           | `xlsx` (upload de estados financieros y ventas masivas)      |

## Requisitos

- Node.js 20+
- Un proyecto de Supabase (URL + anon key + service role key)

## Puesta en marcha

### 1. Configurar Supabase

En la [consola de Supabase](https://supabase.com/dashboard):

1. **New project** → nombre, contraseña de base de datos y región. Espera a que
   el proyecto quede *Healthy*.
2. **Project Settings → API**: copia `Project URL`, la clave `anon` y la clave
   `service_role` (esta última es secreta: solo va en `.env.local`).
3. Ve a **SQL Editor** y ejecuta las migraciones en orden:
   - `supabase/migrations/001_initial_schema.sql` (esquema completo + bucket
     privado `excel-uploads`)
   - `supabase/migrations/002_seed_data.sql` (solo acceso/login: opciones de
     menú, usuario admin y sus permisos). Los datos de negocio (empresas,
     cuentas, sectores, estados financieros, ratios, ventas) no se siembran:
     se cargan con datos reales desde la app.

Verifica en **Table Editor** que existan `usuario`, `opcion_form` y
`acceso_usuario`. Si el proyecto gratuito estuvo inactivo ~7 días se pausa:
reanúdalo desde el dashboard antes de correr la app.

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completa en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

> `.env.local` está ignorado por git (`.gitignore`: `.env*`). No escribas las
> claves reales en `.env.example`: ese archivo es la plantilla que se comparte.
> Si la `service_role` key llegó a salir del proyecto, rótala en
> **Project Settings → API keys**.

### 3. Instalar y correr

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>.

**Credenciales de prueba** (seed): usuario `admin` / contraseña `admin123`.

Este usuario tiene todos los accesos del menú; los demás usuarios solo verán
las opciones seleccionadas en la pantalla de Usuarios (permisos `accesos[]`).

## Estructura del proyecto

```text
src/
  app/
    api/v1/...        # API REST (mismos paths y contratos que el backend Spring)
    (dashboard)/...   # Rutas protegidas (MainLayout + sidebar con permisos)
    page.tsx          # "/" → Login
    not-found.tsx     # 404
  components/         # Vistas y modales (equivalente a frontend/src/components)
  config/menuConfig   # Menú lateral + submenús (con verificación de accesos)
  context/AuthContext # Sesión (sessionStorage keys: analisis_token / analisis_user)
  lib/                # Lógica de ratios, análisis, proyección, Excel, Supabase clients
  services/           # Clientes axios de la API /api/v1
  styles/             # CSS Modules + estilos globales compartidos
  types/              # DTOs (nombres de campos fieles a la API original)
supabase/migrations/  # Esquema + seed de la base de datos
public/templates/     # Plantillas .xlsx (estado financiero y ventas)
```

## Modelado de la API

Los Route Handlers en `src/app/api/v1/**` replican los paths, métodos y
contratos JSON del backend de Spring (`/usuarios/{id}/accesos`,
`/catalogo-empresa/activar`, `/estados-financieros/upload`, etc.), incluyendo
las asimetrías de nombres (camelCase vs snake_case) de los DTOs originales.

## Notas de despliegue

- El HTML de las páginas es renderizado en cliente donde la sesión vive en
  `sessionStorage` (igual que la app original de React); las rutas API son
  dinámicas y validan el token `Bearer` para consultas a Supabase.
- Para producción, despliega en Vercel/Node y define las tres variables de
  entorno de Supabase en el entorno.
