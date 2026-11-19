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

Ejecutadas por el usuario: `007_presupuestos.sql`, `008_integracion_inventarios_ratios.sql` y `009_catalogo_completo_ratios.sql`.

No se inventan benchmarks. Sin referencia sectorial se calcula el indicador y la comparación queda sin valor. Para años nuevos se reutiliza la referencia más reciente del mismo sector que no sea posterior al ejercicio; el parámetro conserva su año de referencia.

Para actualizar registros históricos con los criterios nuevos, entrar a Ratios y pulsar **Recalcular todos los años**. Muestra los avisos de indicadores no calculables y no oculta errores.

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
npm run verify:servicios
```

`verify:integracion` no usa red: prueba fórmulas y Route Handlers reales con Supabase simulado, permisos, JSON inválido, CRUD y fallos de AU1. `verify:servicios` solo lee Supabase; no llama a Gemini.

`verify:excel-modulos` recorre cinco Excel reales/de ejemplo (2020, 2021, 2023–2025) por las funciones de A/B/C/D con Supabase simulado: compara utilidad, ventas, ROA y Proforma sin crecimiento. Incluye devoluciones para prevenir la regresión.

`verify:cache-ia` intercepta toda conexión con Google: prueba reutilización, solicitudes simultáneas, cambio de datos, regeneración, vencimiento y errores 429/503 sin reintentos. Los tokens que muestra son ficticios.

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
- Integración local: 16/16 pruebas, incluyendo permisos y CRUD.
- Excel entre módulos: 5/5; caché de IA simulada: 5/5.
- Supabase real: las tres tablas existen y hay 23 categorías; lecturas entre módulos y Proforma cuadrado verificados.
- HTTP real: CRUD de presupuestos/capital/inventario y carga 2098 → 2097; creación de 23 indicadores por año y actualización del ROA del año siguiente verificadas. Datos y archivos de prueba eliminados.
- Navegador real: seis pantallas, cambio de crecimiento en Proforma, invalidación/recuperación al cambiar periodicidad y bloqueo de acceso directo. Sin errores de hidratación ni excepciones.
- Clave ausente de todos los archivos modificados/nuevos publicables. `.env.local` y capturas de `.next/` ignorados por Git.

## Pendiente de producción

La prueba real de Gemini del 19/11/2026 hizo dos peticiones HTTP en total: primero un 400 de configuración, después un 503 de alta demanda tras corregir el pensamiento mínimo del modelo. No se obtuvo una interpretación real ni metadatos de tokens. Se detuvieron los intentos para cuidar la cuota; no se afirma que la generación completa funcione. El cliente ahora hace un solo intento por generación, sin reintentos automáticos. La prueba manual `node --import ./scripts/register-ts.mjs scripts/verify-gemini.mjs` permite como máximo una petición real por ejecución y comprueba la reutilización si Google responde bien; no forma parte de los tests normales.

La caché actual es **en memoria por proceso**, dura seis horas y admite hasta 100 entradas. Reutiliza el mismo modelo, clave de análisis y mensaje; agrupa solicitudes iguales simultáneas. Se pierde al reiniciar/desplegar y no se comparte entre instancias. No guarda interpretaciones en Supabase ni garantiza reutilización permanente. Una regeneración explícita puede llamar otra vez después de un minuto. Sigue pendiente implementar almacenamiento persistente si se necesita conservar respuestas entre despliegues y validar el recorrido real de Gemini cuando el servicio esté disponible.

La aceptación del equipo con los datos de la cátedra sigue siendo necesaria. Revisar hipótesis de Proforma y referencias sectoriales con el docente. El lint debe pasar sin errores; las advertencias anteriores se reportan por separado.
