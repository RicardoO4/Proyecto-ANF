# Verificación del despliegue — 19/11/2026

Destino: https://proyecto-anf.vercel.app. No se consultó Gemini, no se subieron Excel y no se crearon, actualizaron o eliminaron registros de negocio.

## Resultado observado

La prueba pública y las consultas autenticadas respondieron sin errores. El login funcionó, lo que verifica funcionalmente la URL, anon key y service role de Supabase utilizadas por el servidor publicado; no se inspeccionó el panel de Vercel ni los valores de sus variables.

| Comprobación en Vercel | Resultado |
| --- | --- |
| Login y empresa principal | 200 |
| Estados financieros | 200; 6 estados |
| Catálogo de ratios | 200; 23 categorías |
| Ratios guardados | 200; 45 registros |
| Análisis horizontal/vertical y evolución B | 200 |
| Base financiera de D y pronóstico anual | 200 |
| Inventarios | 200; lista vacía |
| Presupuestos y evaluación de capital | 200; listas vacías |
| Años disponibles del asistente IA | 200; lectura sin generar explicación |
| Seis pantallas de D/E/inventario y Excel de ejemplo | 200; disponibilidad HTTP, sin comprobar interacción del navegador |
| API sin sesión | 401 esperado |

Las consultas directas a la base configurada localmente también confirmaron las tablas `presupuesto`, `evaluacion_capital` e `inventario_producto`, el bucket privado `excel-uploads` y las funciones publicadas `cargar_estados_financieros` y `asegurar_ratios_anio`. Las funciones se verificaron en el esquema de la API, sin ejecutarlas. La lectura de Storage no comprueba una subida real desde Vercel.

## Configuración para el compañero con acceso a Vercel

En el proyecto, **Settings → Environment Variables**:

| Variable | Uso | Estado |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase | Funciona en las consultas probadas |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login | Funciona en el login probado |
| `SUPABASE_SERVICE_ROLE_KEY` | Base, usuarios y Storage desde el servidor | Funciona para las lecturas probadas; mantener secreta |
| `GEMINI_API_KEY` | Generación de explicaciones | Faltaba en el despliegue mostrado por el usuario; agregar en Production |
| `GEMINI_MODEL` | Selección del modelo | Opcional: el código usa `gemini-3.5-flash-lite` si se omite |

Tras guardar variables, desplegar de nuevo el commit que incluya las correcciones actuales. No subir `.env.local` a Git. No usar `NEXT_PUBLIC_` para la clave de Gemini ni para service role. Configurar Preview únicamente si también se necesitan esas integraciones en despliegues de prueba.

La aplicación usa `/api/v1` en el mismo dominio: no necesita otra URL de backend ni configurar CORS para el flujo actual. El login actual es usuario/contraseña; no utiliza OAuth, correos de confirmación ni recuperación por correo, de modo que esos servicios no son requisitos del flujo probado.

## Pendientes concretos

1. **Cambiar la contraseña administrativa de ejemplo.** El inicio de sesión con la cuenta del README funcionó en la web pública. No se cambió durante la auditoría.
2. **Ratios: recálculo completado.** Tras el recálculo del usuario se verificaron registros para las 23 categorías en 2023–2025; 21 valores calculables por año. Algunos indicadores no son significativos y faltan referencias sectoriales en categorías nuevas; no inventarlas.
3. **Caché duradera implementada, pendiente de desplegar el código.** El usuario ejecutó 010 y se verificó `ia_cache` con reservas SQL compartidas. Sin caducidad automática; modelo, datos o instrucciones distintos generan otra entrada. No necesita una variable nueva. El botón de regeneración informa del consumo de cuota.
4. **Histórico mensual e inventarios.** Hay tres ventas anuales y ningún producto. Los pronósticos mensuales necesitan datos mensuales reales; ABC/EOQ/reorden necesitan productos y sus parámetros. Las listas vacías no son un error de conexión.
5. **Verificar límites del proyecto en Vercel.** La subida de estados también recalcula indicadores y puede tardar; ahora declara `maxDuration = 300`. Revisar que Fluid compute y el plan del proyecto permitan esa duración. No se probó una carga ni un recálculo completo en la web publicada para evitar modificar datos.

La corrección de D también está lista para desplegar: 011 permite diciembre mensual junto al total anual, evita duplicados concurrentes y guarda lotes en una transacción. La UI muestra los meses disponibles y facilita ingresar doce meses sin generar importes. El usuario ejecutó 011; se verificó con filas aisladas que se eliminaron al terminar. Estas pruebas no utilizaron Gemini.

Vercel documenta un límite de 4.5 MB para el cuerpo de solicitudes/respuestas de Functions: los Excel grandes pueden devolver 413 antes de entrar al código. Las balanzas del proyecto pesan aproximadamente 5.6 KB, por lo que están muy por debajo. El código tampoco avisa al usuario si falla el archivo original en Storage: registra el error y continúa con los datos; aunque el bucket existe, queda pendiente mejorar ese aviso.

## Repetir las comprobaciones

```powershell
node scripts/verify-despliegue.mjs
node --import ./scripts/register-ts.mjs scripts/verify-servicios.mjs
```

La primera prueba hace solo GET públicos. Para consultas autenticadas se necesita autorización de acceso al sitio, variables locales `E2E_USER` y `E2E_PASSWORD` y la opción `--autenticado`; nunca se imprimen credenciales ni tokens. El script solo añade un login y GET, sin Gemini ni escrituras de negocio. `E2E_BASE_URL` permite elegir el destino.

Referencias: [variables de Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables), [límites de Functions](https://vercel.com/docs/functions/limitations), [duración de funciones](https://vercel.com/docs/functions/configuring-functions/duration).
