# Contabilidad integrada y desarrollo local

Implementación en `IntegracionContable`. El análisis financiero conserva su catálogo, sus convenciones de signos y su contrato anual. No se hicieron commits ni migraciones en Supabase remoto.

## Área contable independiente

Contabilidad tiene su propio menú e inicio. Cada tarea tiene una pantalla: Ejercicios, Catálogo, Transacciones, Libros, Ajustes y revisión, Estados financieros, Publicación y cierre, Auditoría. Los usuarios se administran desde Usuarios en el área financiera. El ejercicio seleccionado se mantiene durante la navegación.

Los estados de un ejercicio abierto o en revisión están identificados como **provisionales**, incluso cuando se haya enviado una versión a ANF. Un ejercicio contable cerrado muestra sus estados finales. Los históricos conservan su identificación de origen.

| Rol de usuario | Área e ingreso |
| --- | --- |
| Contador | Entra directamente a `/contabilidad`; no accede a páginas ni API financieras. |
| Analista financiero | Entra al dashboard financiero; no accede al área ni a la API de Contabilidad. |
| Administrador | Accede a ambas áreas y administra usuarios/permisos. Desde Contabilidad puede volver a ANF con el enlace del menú. |

Desde **Usuarios**, el administrador asigna uno de tres roles: **Administrador**, **Contador** o **Analista financiero**. Contador incluye catálogo, apertura, borradores, contabilización, ajustes, revisión, envío de estados, cierre y reapertura. No hay perfiles adicionales.

El catálogo es de consulta para Contador y Analista financiero. Solo el Administrador puede activar o desactivar cuentas y crear subcuentas. El Analista financiero también puede crear, editar y eliminar empresas; las empresas que registra se asignan a su propio usuario. La lista y administración de usuarios siguen reservadas al Administrador.

La migración de simplificación asigna los permisos completos de cada rol. Los usuarios anteriores exclusivamente contables pasan a Contador; los demás usuarios con rol anterior pasan a Analista financiero. Administrador permanece como Administrador. Crear un usuario o cambiar su rol asigna automáticamente sus permisos. Rol y permisos se consultan en cada petición al servidor, sin reutilizar un perfil anterior almacenado en caché. Volver a iniciar sesión después de un cambio actualiza también el menú del navegador.

Existe una cuenta de prueba **solo local**: `contador` / `Contador123!`. Dispone del ciclo contable completo. `npm run db:contador` crea esa cuenta si aún no existe y nunca reemplaza contraseñas de usuarios existentes.

El recorrido cotidiano es **Inicio contable → Transacciones → Libros → Ajustes → Estados financieros → Publicación y cierre**. La apertura propone automáticamente `3201.01` si el cierre anterior tiene utilidad, o `3203.01` si tiene pérdida, y permite revisar la cuenta antes de confirmar.

## Entorno de esta computadora

Se instaló Ubuntu 24.04 en WSL2, Docker Engine y Docker CLI. Docker Desktop fue retirado. Supabase ejecuta cuatro contenedores: PostgreSQL, Auth, PostgREST y Kong. Studio, correo, Realtime, Storage y funciones Edge no se arrancan en el perfil mínimo.

La copia local contiene las 461 cuentas ANF, la empresa, los estados 2023–2025, referencias, indicadores y ventas. No se copiaron usuarios, sesiones, contraseñas ni archivos de Storage del proyecto remoto. Los históricos ya están incorporados en Contabilidad.

```powershell
npm run db:start
npm run db:status
npm run dev:local -- --port 3100
```

Abrir `http://localhost:3100/contabilidad`. Credenciales **exclusivas del entorno local**: `admin` / `admin123`. Al volver a iniciar sesión aparecerá Contabilidad en el menú.

`db:start` inicia Docker Engine y mantiene WSL activo sin una ventana de Docker Desktop. `db:stop` detiene Supabase conservando los datos. Después puede ejecutar `wsl --terminate Ubuntu-24.04` para liberar la memoria de esa distribución.

Para usar Docker desde PowerShell:

```powershell
wsl -d Ubuntu-24.04 -u root -- docker ps
wsl -d Ubuntu-24.04 -u root -- docker stats --no-stream
```

Studio es opcional: `npm run db:studio`. Reinicia el entorno con Studio en `http://localhost:54323` y requiere descargar servicios adicionales. Para regresar al perfil mínimo: `npm run db:stop`, seguido de `npm run db:start`.

En esta instalación quedó poco espacio libre en C:. Evitar arrancar servicios opcionales hasta liberar espacio. Los cuatro contenedores mínimos consumieron aproximadamente 224 MiB durante la verificación; esto no incluye la memoria de WSL, Windows ni Next.js.

## Configuración y datos privados

`npm run db:env` configura `.env.local` con las claves locales. Conserva una copia privada inicial de la configuración anterior en `.env.remote-backup.local`. Ambos archivos están ignorados por Git.

`dev:local` y la comprobación `ANF_LOCAL_ONLY=1` rechazan una URL remota. Los comandos `db:start`, `db:migrate`, `db:seed` y `db:env` están limitados al entorno local y no aceptan destinos externos.

La exportación de datos está en `.local-data/anf-snapshot.json`, también ignorada por Git. `db:export` solo hace peticiones GET contra el origen; no es un respaldo completo de Supabase ni una herramienta para migrar Auth/Storage. Para una copia coherente, exportar mientras nadie esté cargando o modificando datos en el origen.

En una instalación nueva, con `.env.local` todavía apuntando al origen autorizado:

```powershell
npm ci
npm run db:export
# Si WSL/Ubuntu aún no están instalados:
wsl --install -d Ubuntu-24.04 --no-launch --web-download
wsl -d Ubuntu-24.04 -u root -- sh /mnt/c/Users/INTEL/Desktop/Proyecto-ANF/scripts/instalar-docker-wsl.sh
npm run db:start
npm run db:seed
npm run db:env
npm run dev:local
```

Ajustar la ruta `/mnt/c/...` al repositorio de esa computadora. El instalador es para Ubuntu 24.04 y necesita conexión a Internet. `db:seed` reemplaza únicamente las tablas de negocio explícitas de una base local todavía sin períodos contables; se niega a sobrescribir una base ya inicializada. Los períodos operativos y sus movimientos se conservan entre arranques. No usar `supabase db reset` para el trabajo diario: reconstruye la base y pierde datos locales.

## Uso del módulo

1. Los ejercicios 2023–2025 se consultan como **históricos cerrados**. Conservan BG y ER existentes y no contienen un diario ficticio. La comprobación histórica se deriva de sus saldos, excluyendo el resultado sintetizado `3204` para no duplicarlo con ingresos y gastos.
2. Crear 2026 con el cierre 2025 como base. Seleccionar la cuenta ANF de resultados acumulados apropiada: el traslado conserva el patrimonio total; no representa una distribución de utilidades. La apertura automática incluye solamente activos, pasivos y patrimonio.
3. En **Transacciones**, registrar partidas como borradores. Cada línea tiene un cargo o un abono positivo, con dos decimales. Contabilizar exige al menos dos líneas, Debe = Haber exacto, fecha dentro del año y cuentas activas.
4. En **Libros contables**, consultar el diario, mayor y comprobación ajustada. El mayor incluye cierres y permite filtrar fechas conservando el saldo anterior al filtro. Los borradores no afectan saldos ni aparecen en el diario contable.
5. Corregir un asiento contabilizado con una reversión vinculada y, cuando corresponda, una nueva partida correcta. El original permanece. Los ajustes de período son partidas independientes: no se limitan a corregir errores y se preparan antes de publicar/cerrar. No se calculan automáticamente depreciaciones, impuestos, provisiones ni distribuciones.
6. Revisar BG, ER y EC. El EC de los ejercicios nuevos enlaza patrimonio inicial, movimientos patrimoniales netos y resultado. No se reconstruye el EC histórico sin sus movimientos de origen.
7. Publicar para entregar BG/ER y ventas anuales a ANF. La publicación es una transacción y deja una versión auditable; las partidas posteriores quedan pendientes de publicación. El recálculo de indicadores del año y del siguiente reutiliza el motor existente. Si el recálculo falla, se informa que los estados ya se publicaron y los indicadores siguen pendientes.
8. Cerrar para saldar ingresos/gastos contra `3204` y bloquear movimientos. El ER publicado sigue mostrando el resultado del año: la vista ajustada excluye los asientos técnicos de cierre y reapertura. La comprobación posterior al cierre incluye esos asientos.
9. Reabrir exige permiso de supervisor y motivo. Revierte el cierre mediante otra partida, conservando la original. Si ya existe una apertura del año siguiente dependiente del cierre, se bloquea la reapertura.

Los períodos siguen siendo **anuales**. Tener fechas diarias o filtros mensuales no cambia los indicadores ni convierte ventas anuales en ventas mensuales. No se ha incorporado gestión de costos del SIC.

## Catálogo y compatibilidad con ANF

La pantalla Catálogo consulta todas las cuentas ANF y permite buscar por código/nombre. Quien tenga permiso de gestión de catálogo puede crear subcuentas activas debajo de una cuenta existente, heredando su clasificación. La cuenta padre pasa a agrupación; los movimientos anteriores permanecen. El administrador conserva la activación/desactivación en el módulo de catálogo de ANF.

Los saldos de apertura pueden provenir de cuentas resumidas. Los movimientos posteriores usan cuentas imputables. Para generar BG/ER se suman esos movimientos exclusivos y se publica un único nivel de cuentas compatible con las sumas por prefijo de ANF. No se crean transacciones detalladas a partir de un saldo final.

Los años incorporados a Contabilidad quedan protegidos frente a sustitución por Excel y edición/eliminación desde el CRUD financiero. La carga Excel sigue disponible para otros años. Esto evita dos fuentes que sobrescriban el mismo ejercicio. No se modifica ni borra un asiento contabilizado, una publicación o el historial de auditoría.

La moneda inicial es USD y los importes tienen dos decimales. El resultado usa `3204`, tal como lo hace ANF, aunque el nombre histórico de esa cuenta diga “déficit”. No se adaptó el catálogo de SIC.

## Accesos

Solo existen tres roles, administrados desde **Usuarios**:

| Rol | Permisos |
| --- | --- |
| Administrador | Ambas áreas y gestión de usuarios |
| Contador | Ciclo contable completo, consulta y exportación |
| Analista financiero | Gestión de empresas, consulta del catálogo, estados financieros, indicadores, análisis y proyecciones |

Los permisos se asignan por rol. La API rechaza perfiles contables adicionales y cambios de permisos individuales. El servidor comprueba el rol y los accesos en cada petición; volver a iniciar sesión actualiza el menú después de cambiar un rol.

Las tablas y funciones contables tienen RLS, permisos revocados para `anon`/`authenticated` y acceso mediante el backend con `service_role`. Los bloqueos por empresa/período serializan las operaciones y la publicación comprueba la versión seleccionada.

## Verificación

```powershell
npm run verify:contabilidad
npm run verify:contabilidad-local
npm run e2e:contabilidad
npm run verify:integracion
npm run verify:recalculo
npm run build
```

`verify:contabilidad-local` usa exclusivamente `127.0.0.1:54322`, comprueba los históricos contra la copia privada, crea datos de prueba dentro de una transacción y hace rollback. También comprueba los permisos predeterminados y restricciones de los roles nuevos. No deja movimientos de ejemplo en la empresa. `e2e:contabilidad` necesita el servidor en el puerto 3100, prueba las pantallas separadas con Edge/Chrome y los inicios de sesión Contador/Analista, verifica el rechazo de la otra área y elimina las cuentas temporales al terminar. Guarda capturas privadas ignoradas en `.local-data/e2e-contabilidad/`. No llama a Gemini.

Antes de llevar esta funcionalidad a otro entorno, revisar la migración y conciliar un ejercicio completo con los documentos de la empresa. La rama Git aísla código; la separación de bases y de variables de entorno es lo que aísla los datos.

## Avisos preexistentes observados

La compilación y las comprobaciones del módulo pasan. El arranque de Next.js mostró un aviso de seguridad sobre la versión instalada; no se cambió la versión del framework en este trabajo. El validador SQL también informa una advertencia de conversión en `guardar_ventas_mensuales` (migración 011), y el asesor señala `search_path` mutable en `cargar_estados_financieros` (migración 005). Ninguno corresponde a funciones nuevas de Contabilidad. Deben revisarse antes de un despliegue; no se modificaron las migraciones históricas ni el entorno remoto.
