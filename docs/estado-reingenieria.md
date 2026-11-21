# Estado de la reingeniería ANF

Actualizado: 19 de noviembre de 2026. Referencia: `plan_reigenieria.md`. Cambios sin commit.

## Implementación

| Plan | Comportamiento |
| --- | --- |
| A1–A4 | Carga unificada/balanza, validaciones, duplicados y empresa principal conservados. |
| A5–A8 | Identificadores del dashboard corregidos y control de acceso directo por módulo. API valida sesión y permisos de escritura; inventarios exige permiso también para lectura. |
| B1–B5 | Códigos centralizados y análisis por tipo de reporte. Evolución ROA/ROE usa promedios, igual que C. Un ER con ingresos cero conserva sus gastos. |
| C1–C3 | Calculadores existentes conservados. ROE/DuPont no significativos se distinguen del retorno cero. |
| C4 | Productos persistidos por empresa; clasificación ABC por consumo anual; EOQ, reorden, existencias y aviso de reposición. Acceso desde Ratios. |
| AU1 | Prepara indicadores de años nuevos, actualiza el siguiente año, limita concurrencia, registra fallos, invalida valores anteriores y devuelve avisos en la carga. |
| D1 | Histórico real anual/mensual, promedio móvil, regresión logarítmica y cuadrática. Rechaza huecos y evita duplicar total anual con detalle. |
| D3 | DuPont desde estados reales, selección de año y sensibilidad interactiva. Patrimonio no positivo se informa como N/M. |
| D4 | Cálculo de equilibrio compartido, validaciones, gráficos acotados e invalidación al editar. |
| D5 | ER por cuentas con parte fija/variable y Balance General Proforma con utilidades retenidas, FER y excedente de caja. Valida el balance base. |
| E1–E3 | Cédulas, caja e inversiones conservados. CRUD verificado contra Supabase. |
| IA | Resúmenes de pronóstico/Proforma conectados con datos reales; filtros invalidan resultados previos. Clave solo en `.env.local`, ignorada por Git. Prueba real autorizada el 19/11/2026: Google respondió 503; generación completa pendiente. Caché verificada sin consumir la API. |

## Supabase

Ejecutadas por el usuario: `007_presupuestos.sql`, `008_integracion_inventarios_ratios.sql`, `009_catalogo_completo_ratios.sql`, `010_cache_ia_persistente.sql` y `011_ventas_mensuales.sql`.

No se inventan benchmarks. Sin referencia sectorial se calcula el indicador y la comparación queda sin valor. Para años nuevos se reutiliza la referencia más reciente del mismo sector que no sea posterior al ejercicio; el parámetro conserva su año de referencia.

Para actualizar registros históricos con los criterios nuevos, entrar a Ratios y pulsar **Actualizar indicadores**. Muestra los avisos de indicadores no calculables y no oculta errores. **Forzar recálculo completo** permite procesar también los años que ya están vigentes.

## Criterios

- ROA/ROE usan promedio entre cierre actual y previo. Sin balance previo, cierre actual. Patrimonio de cierre/promedio no positivo implica ROE no significativo.
- Rebajas y devoluciones se almacenan positivas y se descuentan de los ingresos. Excel, evolución de B, rentabilidad de C, base financiera de D y resumen para IA comparten ese criterio. Se corrigió una suma incorrecta que sobreestimaba la utilidad en presencia de devoluciones; los indicadores históricos guardados necesitan recalcularse.
- Los totales de la carga de estados son anuales. La proyección mensual exige doce meses reales consecutivos; no interpola meses faltantes.
- ABC: el artículo que cruza 80% o 95% permanece en la clase de origen. Demanda cero es C. Mantenimiento es costo por unidad/año. Demanda diaria usa los días de operación ingresados.
- Proforma: ingresos/costo de ventas proporcionales; fracción variable de gastos operativos configurable; demás gastos fijos. Activos corrientes sin caja y proveedores proporcionales; otros saldos constantes. Las pérdidas reducen completas el patrimonio. FER positivo agrega financiamiento y negativo se incorpora al efectivo. La pantalla informa estas hipótesis.
- Las series cortas pueden producir extrapolaciones inestables: los pronósticos no son certezas.

## Pruebas reproducibles

```powershell
npm run lint
npm run build
npm run verify:carga
npm run verify:ratios
npm run verify:presupuesto
npm run verify:capital
npm run verify:integracion
npm run verify:excel-modulos
npm run verify:cache-ia
npm run verify:modulo-d
npm run verify:servicios
```

`verify:integracion` no usa red: prueba fórmulas y Route Handlers reales con Supabase simulado, permisos, JSON inválido, CRUD y fallos de AU1. `verify:servicios` solo lee Supabase; no llama a Gemini.

`verify:excel-modulos` recorre cinco Excel reales/de ejemplo (2020, 2021, 2023–2025) por las funciones de A/B/C/D con Supabase simulado: compara utilidad, ventas, ROA y Proforma sin crecimiento. Incluye devoluciones para prevenir la regresión.

`verify:cache-ia` intercepta toda conexión con Google y Supabase: prueba reutilización, solicitudes simultáneas, cambio de datos, regeneración, persistencia después de seis horas y errores 429/503 sin reintentos. Los tokens que muestra son ficticios.

`verify:modulo-d` prueba disponibilidad mensual, fechas y lotes inválidos y Excel mensual. `verify:persistencia` usa Supabase real con filas propias y un año de ventas previamente vacío (2096); comprueba las reservas de caché y las transacciones mensuales, y elimina sus filas al terminar. No llama a Gemini; no ejecutar dos instancias simultáneas.

Para HTTP y navegador reales, iniciar el servidor y usar otra terminal:

```powershell
npm start -- --port 3100
node --import ./scripts/register-ts.mjs scripts/e2e-integracion.mjs
node scripts/e2e-browser.mjs
```

Se admiten `E2E_BASE_URL`, `E2E_USER` y `E2E_PASSWORD`. El test HTTP comprueba primero que 2097/2098 estén vacíos, usa nombres únicos y limpia únicamente sus documentos, productos, estados, ratios, ventas y Excel. No ejecutar simultáneamente dos instancias. El navegador usa perfil aislado y capturas ignoradas en `.next/`.

## Resultados ejecutados

- Build de producción y TypeScript correctos.
- Lint: 0 errores, 44 advertencias de código existente.
- Carga: 58/58; ratios: 35/35; presupuestos: 59/59; capital: 19/19.
- Integración local: 17/17 pruebas, incluyendo permisos, CRUD y lotes mensuales.
- Excel entre módulos: 5/5; caché de IA simulada: 7/7; módulo D: 3/3.
- Supabase real: las tres tablas existen y hay 23 categorías; lecturas entre módulos y Proforma cuadrado verificados.
- HTTP real: CRUD de presupuestos/capital/inventario y carga 2098 → 2097; creación de 23 indicadores por año y actualización del ROA del año siguiente verificadas. Datos y archivos de prueba eliminados.
- Navegador real: seis pantallas, cambio de crecimiento en Proforma, invalidación/recuperación al cambiar periodicidad y bloqueo de acceso directo. Sin errores de hidratación ni excepciones.
- Clave ausente de todos los archivos modificados/nuevos publicables. `.env.local` y capturas de `.next/` ignorados por Git.

## Pendiente de producción

La prueba real de Gemini del 19/11/2026 hizo dos peticiones HTTP en total: primero un 400 de configuración, después un 503 de alta demanda tras corregir el pensamiento mínimo del modelo. No se obtuvo una interpretación real ni metadatos de tokens. Se detuvieron los intentos para cuidar la cuota; no se afirma que la generación completa funcione. El cliente ahora hace un solo intento por generación, sin reintentos automáticos. La prueba manual `node --import ./scripts/register-ts.mjs scripts/verify-gemini.mjs` permite como máximo una petición real por ejecución y comprueba la reutilización si Google responde bien; no forma parte de los tests normales.

La caché ahora se guarda en la tabla privada `ia_cache` de Supabase. Sobrevive a reinicios y despliegues y se comparte entre instancias. No caduca automáticamente: el hash incluye modelo, contexto, instrucciones, esquema y datos. Datos distintos generan otra entrada. Una reserva SQL atómica evita duplicar generaciones concurrentes durante su vigencia; si una instancia falla, vence en un minuto. La regeneración explícita puede consultar otra vez después de un minuto desde la respuesta anterior. Si el almacenamiento no está disponible, se informa el problema antes de consultar Gemini. No se guardan claves ni el mensaje original. Verificado contra Supabase con respuestas ficticias sin consumir Gemini.

## Correcciones finales de D

El total anual automático y el detalle mensual de diciembre pueden coexistir. `guardar_ventas_mensuales` valida y guarda el lote en una transacción y serializa las operaciones mensuales de la misma empresa; rechaza duplicados incluso entre solicitudes concurrentes. Los importes cero son válidos y los negativos/fechas inexistentes no. El Excel mensual ya no omite silenciosamente filas inválidas. Los totales anuales se actualizan desde estados financieros; no se editan ni eliminan desde el histórico mensual.

La interfaz muestra la cantidad de meses reales, bloquea la proyección clásica hasta disponer de doce meses consecutivos al final del histórico y ofrece el pronóstico anual. La captura manual permite preparar doce filas vacías de un año. Los importes deben proporcionarse con información real; no se reparten totales anuales en meses. El pronóstico avanzado mensual necesita al menos tres meses reales sin huecos.

La carga de estados declara `maxDuration = 300` para incluir el recálculo de ratios; el proyecto Vercel debe permitir esa duración. Estas correcciones requieren desplegar el código nuevo. Las migraciones 010/011 ya se verificaron en Supabase y no requieren claves adicionales.

## Actualización incremental de ratios — 20/11/2026

El usuario ejecutó `20261121011703_recalculo_ratios_incremental.sql`. Crea `ratio_recalculo` y cuatro funciones privadas, sin borrar información anterior. El primer cálculo establece una huella persistente por empresa y año. La huella incluye estados/líneas del año actual y previo, códigos contables, categorías, sector y referencias. Otra huella detecta modificaciones manuales de los resultados guardados. Un valor N/M nulo es válido; un cálculo fallido no se marca como vigente y se vuelve a intentar.

El recálculo normal omite años con entradas, resultados y versión iguales. El año anterior forma parte de la huella para los indicadores que usan promedios. `VERSION_CALCULO_RATIOS` en `src/lib/ratios.ts` debe incrementarse al cambiar fórmulas, reglas contables o interpretaciones. La casilla de forzado evita la omisión cuando se necesita mantenimiento.

Cada año pendiente se calcula sobre una sola lectura consistente de la base; `AsyncLocalStorage` aísla el contexto entre solicitudes y empresas. El guardado de todos los resultados es una transacción. Si la base cambió antes del guardado, se rechaza la operación para no certificar datos anteriores. El listado de ratios también carga sus relaciones en una sola consulta en vez de tres consultas por indicador. Una verificación sin cambios no vuelve a descargar la tabla en el navegador.

Pruebas: seis regresiones locales, contratos/permisos de API y navegador con POST simulado para preservar los años reales. Supabase real: años vacíos 2093/2094, 23 indicadores iniciales por año y luego 23 omitidos, cambios de balance actual/previo, referencia, resultado guardado, versión y forzado; rechazo de una base que cambia antes de guardar. Todos los datos propios se eliminaron. En esa prueba, el cálculo por año tomó aproximadamente 0,7–1,0 s y la verificación sin cambios 0,2 s; no es una garantía de tiempo en producción. Gemini no se utiliza en este flujo.

Comandos: `npm run verify:recalculo` (sin red), `npm run verify:recalculo-servicios` (filas temporales con limpieza) y `npm run e2e:ratios` (servidor local 3100, POST simulado y lecturas reales).

La aceptación del equipo con los datos de la cátedra sigue siendo necesaria. Revisar hipótesis de Proforma y referencias sectoriales con el docente. El lint debe pasar sin errores; las advertencias anteriores se reportan por separado.
