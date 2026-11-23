> Documento de la entrega original de C. Para la implementación actual de C4, AU1 y pruebas globales consultar [estado-reingenieria.md](estado-reingenieria.md). Las limitaciones y conteos siguientes describen aquella entrega.

# Plan de pruebas — Módulo C (ratios avanzados, apalancamiento, rentabilidad, ciclos y AU1)

Rama: `Modulo-C`
Alcance de esta entrega: **C1 (completo)**, **C2 (completo)**, **C3 (completo)**, **C4 (completo)** y **AU1 (completo y calibrado)**.
C4 usa datos nuevos por producto (ABC/EOQ/punto de reorden); los 16 indicadores y el CCE no se modifican.

---

## 0. Qué se implementó

| Pieza | Archivo | Qué hace |
|---|---|---|
| Fórmulas puras | `src/lib/ratioFormulas.ts` | 15 fórmulas sin I/O (liquidez, apalancamiento, rentabilidad, ciclos y DuPont) |
| Calculadores | `src/lib/ratios.ts` | 14 calculadores integrados en `CALCULADORES` + `recalcularRatios()` |
| Endpoints | `src/app/api/v1/ratios/[id]/calcular-*` | 23 rutas PUT dedicadas (14 de C + 9 heredadas) |
| Cliente | `src/services/ratioService.ts` | Métodos para los 14 calculadores |
| UI | `src/components/ratio/Ratio.tsx` | Mapeo completo categoría → endpoint en el botón Calcular |
| AU1 | `src/app/api/v1/estados-financieros/upload/route.ts` | Recálculo automático y silencioso tras subir balances/resultados |
| Esquema/seed | `supabase/migrations/003_seed_ratios.sql` y `004_seed_ratios_c1_c3.sql` | Tipos, categorías, benchmarks y filas para 2023, 2024 y 2025 |
| Seed por REST | `scripts/seed-ratios.mjs` | Aplica y calibra los benchmarks con estándares de la Cátedra ANF115 |
| Aceptación | `scripts/verify-ratios.mts` | 35 comprobaciones automáticas de las fórmulas |
| E2E AU1 | `scripts/e2e-au1.mjs` | Carga sintética real + verificación de recálculo y limpieza automática |

Ratios incorporados:

| Ratio | Categoría (`nombre_tipo`) | Fórmula | Dirección |
|---|---|---|---|
| Prueba ácida | `Prueba ácida` | (Activo cte − Inventario) / Pasivo cte | mayor es mejor |
| Grado de endeudamiento | `Grado de endeudamiento` | Pasivo total / Activo total | menor es mejor |
| Grado de propiedad | `Grado de propiedad` | Patrimonio / Activo total | mayor es mejor |
| Razón de endeudamiento patrimonial | `Razón de endeudamiento patrimonial` | Pasivo total / Patrimonio | menor es mejor |
| Cobertura de intereses | `Razón de cobertura de intereses` | EBIT / Gastos financieros | mayor es mejor |
| Margen neto | `Índice de margen neto` | Utilidad neta / Ventas netas | mayor es mejor |
| ROA | `Rendimiento sobre activos (ROA)` | Utilidad neta / Activo total promedio | mayor es mejor |
| ROE | `Rendimiento sobre capital contable (ROE)` | Utilidad neta / Patrimonio promedio | mayor es mejor |
| DuPont | `Análisis DuPont` | Margen neto × Rotación de activos × Multiplicador de capital | mayor es mejor |
| Rotación de inventario | `Razón de rotación de inventarios` | Costo de ventas / Inventario promedio | mayor es mejor |
| Edad promedio inventario | `Edad promedio del inventario` | (Inventario promedio × 365) / Costo de ventas | menor es mejor |
| Período medio de pago | `Período medio de pago` | (Cuentas por pagar promedio × 365) / Costo de ventas | mayor es mejor |
| Ciclo operativo | `Ciclo operativo` | EPI + PPC | menor es mejor |
| Ciclo conversión efectivo | `Ciclo de conversión de efectivo` | Ciclo operativo − PPP | menor es mejor |

Nota: si el patrimonio promedio es cero o negativo, DuPont devuelve `valor_calculado = 0`,
`cumple_sector = false` y una interpretación que advierte que el indicador no es
interpretable en esa situación (no se genera `NaN` ni un infinito).

---

## 1. Prerrequisitos

1. `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY`.
2. Dependencias instaladas: `npm install`.
3. Empresa **2 (Inv ABC)** con `BALANCE_GENERAL` y `ESTADO_RESULTADOS` cargados
   para 2023, 2024 y 2025 (el ER tiene 18 líneas por año).
4. Catálogo sembrado: `npm run seed:ratios` (idempotente).
5. Precisión `NUMERIC(15,4)` ya aplicada en `ratio` y `parametro_sector`
   (verificado en la BD; no requiere paso manual).

---

## 2. Pruebas automáticas (ejecutar en este orden)

### 2.1 Tipos

```powershell
npx tsc --noEmit
```

- [x] Sale con código `0`, sin errores.

### 2.2 Fórmulas

```powershell
npm run verify:ratios
```

- [x] `OK: 35/35 comprobaciones`, código de salida `0`.

El script importa las mismas fórmulas de `src/lib/ratioFormulas.ts` que usan los
endpoints. Los valores de Inv ABC que compara son un **snapshot fijo** escrito en
el propio script: **no consulta la BD en vivo**. La coincidencia con los saldos
reales de la BD se validó por separado durante la aceptación (los 10 ratios que
dependen del ER coinciden para 2023, 2024 y 2025).

Cubre:
- Empresa ABC de `TAREA RATIOS.xlsx` (2019/2020): prueba ácida `0.8034` / `0.6093`,
  endeudamiento `0.6117`, propiedad `0.3883`, patrimonial `1.5755`.
- Inv ABC (snapshot del script): prueba ácida, endeudamiento, propiedad y patrimonial.
- Identidad `endeudamiento + propiedad = 1`.
- Casos borde: denominador cero y **año anterior ausente ≠ saldo cero**
  (`promedioSaldo(100, null) = 100`, `promedioSaldo(100, 0) = 50`).

### 2.3 Build de producción

```powershell
npm run build
```

- [x] Compila sin errores; las 23 rutas `calcular-*` aparecen en el listado.

### 2.4 E2E de AU1 (servidor en marcha)

```powershell
npm run start        # en otra terminal
npm run e2e:au1
```

- [x] `OK: 4/4 comprobaciones`.
- [x] Al final imprime `limpieza: 4 ratios, 1 estados financieros eliminados`.

El script crea un balance sintético para **2099** (año sin datos reales, cuyo
siguiente 2100 tampoco existe), lo sube por el endpoint real de carga y verifica
que AU1 calculó los 4 ratios sin intervención: ácida `1.60`, endeudamiento `0.64`,
propiedad `0.36`, patrimonial `1.80`. Luego borra todo lo creado; usar 2099 evita
que AU1 recalcule 2023 como “año siguiente” y altere promedios históricos. Se
puede repetir sin ensuciar la BD. Si se interrumpe, la siguiente ejecución limpia
los restos antes de empezar.

---

## 3. Pruebas manuales de API (servidor en marcha)

Los PUT requieren autenticación. Primero obtener el token:

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/login" `
  -ContentType 'application/json' -Body (@{ userName='admin'; contrasena='admin123' } | ConvertTo-Json)
$headers = @{ Authorization = 'Bearer ' + $login.token }
```

Luego ejecutar los 14 endpoints de C para cada año (42 PUT en total):

```powershell
$endpoints = @(
  'calcular-prueba-acida', 'calcular-endeudamiento', 'calcular-propiedad',
  'calcular-endeudamiento-patrimonial', 'calcular-cobertura-intereses',
  'calcular-margen-neto', 'calcular-roa', 'calcular-roe', 'calcular-dupont',
  'calcular-rotacion-inventarios', 'calcular-edad-promedio-inventario',
  'calcular-periodo-pago', 'calcular-ciclo-operativo', 'calcular-cce'
)
```

Cada endpoint se invoca sobre la fila `ratio` de la categoría correspondiente en
el año indicado; el `id` de la fila depende del año y de la categoría.

Resultado esperado (valores persistidos, `NUMERIC(15,4)`):

| Ratio | 2023 | 2024 | 2025 |
|---|---|---|---|
| Prueba ácida | `0.2430` | `0.2616` | `0.2688` |
| Grado de endeudamiento | `1.0181` | `1.0355` | `1.0294` |
| Grado de propiedad | `-0.0181` | `-0.0355` | `-0.0294` |
| Endeudamiento patrimonial | `-56.3234` | `-29.1968` | `-35.0381` |
| Cobertura de intereses | `-1.9297` | `-1.9531` | `-1.9847` |
| Margen neto | `-0.0934` | `-0.0580` | `0.0134` |
| ROA | `-0.0243` | `-0.0163` | `0.0040` |
| ROE | `1.3421` | `0.4682` | `-0.1312` |
| DuPont | `0.0000` | `0.0000` | `0.0000` |
| Rotación de inventarios | `2.0752` | `2.0206` | `1.9235` |
| Edad promedio del inventario | `175.8900` | `180.6400` | `189.7600` |
| Período medio de pago | `6.5700` | `6.6400` | `6.9000` |
| Ciclo operativo | `451.2100` | `446.5900` | `459.1700` |
| Ciclo de conversión de efectivo | `444.6400` | `439.9500` | `452.2700` |

Contexto de los saldos reales: patrimonio negativo en los tres años
(2023 `-107.741,49`; 2024 `-202.612,24`; 2025 `-179.113,35`). Por eso propiedad
y patrimonial son negativos, ROE puede cambiar de signo y DuPont no es
interpretable (valor `0` por el guard).

Comprobaciones por respuesta:

- [x] HTTP `200` y JSON con `valor_calculado`, `cumple_sector`, `interpretacion`.
- [x] `cumple_sector = false` en los 42 casos, porque los benchmarks sembrados
      quedan del lado desfavorable para la empresa.
- [x] En los tres años la interpretación de propiedad, patrimonial y ROE advierte
      que **el patrimonio es negativo**. Propiedad y patrimonial conservan su
      valor negativo y explican que no es comparable; ROE conserva el valor
      numérico y lo describe como **referencial**, sin presentarlo como un
      rendimiento equivalente al de un patrimonio positivo.
- [x] La liquidez muestra el cociente en la interpretación persistida (por
      ejemplo `1.36 USD de activo corriente por cada dólar`), no el saldo crudo
      de activo corriente. Los textos anteriores se recalcularon con
      `VERSION_CALCULO_RATIOS = 2026-11-22.1`.
- [x] Los márgenes y el ROA con pérdidas dicen «pierde» o «pérdida equivalente»
      en lugar de «genera/retiene -X».
- [x] `interpretacion` nunca supera 256 caracteres (máximo observado: 181).

Pruebas negativas:

- [x] `PUT /api/v1/ratios/7/calcular-prueba-acida` (ratio de otra categoría)
      → HTTP `500` con el mensaje genérico «Ocurrió un error inesperado. Por
      favor, contacte al administrador.». El detalle de categoría incorrecta
      queda en el log del servidor, no se expone al cliente.
- [x] `PUT /api/v1/ratios/99999/calcular-endeudamiento`
      → `404` «Ratio no encontrado».

Regresión de liquidez 2024 (las tres filas existen):

- [x] `calcular-liquidez` → `0.3978`
- [x] `calcular-efectivo` → `0.0431`
- [x] `calcular-capital-trabajo` → `-0.6198`

---

## 4. Pruebas de UI

En `http://localhost:3000/ratios`, con el build de producción:

- [x] Aparecen las 14 categorías del Módulo C en la tabla, para 2023, 2024 y 2025.
- [x] El botón **Calcular** actualiza el valor sin recargar la página.
- [x] Los valores mostrados en **Detalles del Ratio** coinciden con la tabla de §3,
      con 4 decimales (`RatioDetailsModal` usa `toFixed(4)`).
- [x] El texto de interpretación se lee completo (sin cortes) y no muestra
      `undefined` ni `NaN`.
- [x] Las categorías con patrimonio negativo muestran la advertencia esperada y
      DuPont devuelve `0.0000` con su interpretación de quiebra técnica.
- [x] Los valores persisten tras recargar la página (F5).
- [x] La liquidez 2024 sigue mostrando `0.3978`, `0.0431` y `-0.6198`.

Verificación ejecutada con Chrome headless contra el build de producción:
**125 comprobaciones, 0 fallos**, 21 PUT `200` (14 cálculos de 2023 + 7 cruces de
año), sin errores de consola ni respuestas API `>= 400`. Para probar que
**Calcular** reemplaza el valor mostrado se forzó temporalmente `999.0000` en el
ratio 4; tras pulsar el botón el modal mostró `0.2430` y al final se restauró el
valor real. Tras la corrección de interpretaciones se repitió la auditoría con
69 filas (23 categorías × 3 años) y 48 PUT `200` (42 de C + 6 duplicados de
liquidez con benchmark); ver §10.

El mapa de `Ratio.tsx` tiene 23 claves y las 23 categorías presentes hoy en la BD
coinciden exactamente con `categoria_ratio.nombre_tipo`: 14 del Módulo C, 3 de
liquidez heredada y 6 de apoyo (rotación/activos/márgenes). Las filas sin
`id_parametro_sector` no se recalculan desde la UI; el fallback de
`Ratio.tsx:167-170` queda como defensa de código.

---

## 5. AU1 — recálculo automático

Automatizado en §2.4. Verificación manual complementaria:

- [x] Subir un estado financiero desde `/estados-financieros/cargar` y
      confirmar que la carga termina en éxito.
- [x] Los ratios ya existentes para esa empresa/año quedan recalculados.
- [x] Si un cálculo falla (p. ej. ratio sin benchmark o sin ventas), la carga
      **no falla**: responde `201` y el ratio queda con su valor anterior. Con
      ER completo se recalcularon 6 ratios de prueba; sin ER, ROE pasó a `0` y
      margen neto conservó `0.6105`.
- [x] En la consola del servidor aparece `[AU1] no se pudieron recalcular los
      ratios de 2099: …` cuando algo falla dentro del hook (el cliente nunca ve
      el error).

Verificación realizada con el año aislado 2099/2100: **22/22 comprobaciones**,
sin errores de consola del navegador y con limpieza final de estados y ratios
de prueba.

---

## 6. Precisión numérica

Ya aplicado y verificado en la BD:

```sql
ALTER TABLE ratio
  ALTER COLUMN valor_calculado       TYPE NUMERIC(15,4),
  ALTER COLUMN valor_sector_promedio TYPE NUMERIC(15,4),
  ALTER COLUMN diferencia_vs_sector  TYPE NUMERIC(15,4);

ALTER TABLE parametro_sector
  ALTER COLUMN valor_referencia TYPE NUMERIC(15,4);
```

- [x] Los valores se guardan y devuelven con 4 decimales (ver tabla de §3).
- [x] `npm run verify:ratios` sigue en `35/35`.

---

## 7. Regresión de lo existente

- [x] `GET /api/v1/ratios`, `/api/v1/estados-financieros`,
      `/api/v1/empresas`, `/api/v1/categorias-ratio` y
      `/api/v1/parametros-sector` responden `200`.
- [x] `GET /api/v1/ventas-historicas/empresa/2`,
      `/empresa/2/anio/2023` y
      `/empresa/2/proyeccion/3?metodo=MINIMOS_CUADRADOS` responden `200`.
      (`/api/v1/ventas-historicas` es solo POST; sin `metodo` la proyección
      devuelve `400`, comportamiento esperado.)
- [x] `GET /api/v1/analisis/reporte-interno` y `/api/v1/analisis/evolucion-ratios`
      responden `200`.
- [x] La página `/ratios` responde `200`.
- [x] Los 3 endpoints de liquidez se recalcularon por PUT sin cambios en sus valores.
- [x] Los 6 endpoints de ratios previos restantes ya tienen categoría en
      `categoria_ratio` y filas `ratio` para 2023–2025, pero esas filas no tienen
      `id_parametro_sector`, por lo que no se pueden ejercitar por PUT. El
      catálogo y el listado general sí responden. Sembrar benchmarks para esas
      6 categorías queda fuera de C y requiere coordinación con A/B.
- [x] `recalcularRatios` solo recorre filas de `ratio` **existentes** para la
      empresa/año: no crea ni borra filas.

---

## 8. Limitaciones conocidas (no son fallos de esta entrega)

1. **Ratios sin benchmark sí se calculan.** `calculateRatio` persiste el valor
   calculado y una interpretación que indica «Sin referencia sectorial
   configurada para esta categoría»; `cumple_sector` queda `null`. De los 69
   ratios calculados, 21 no tienen referencia sectorial. La tabla y el modal
   muestran «Sin referencia sectorial (cálculo realizado)» en lugar de un `N/A`
   engañoso. No se inventan benchmarks; los existentes deben indicar sector,
   período, unidad y fuente.
2. **DuPont no es interpretable con patrimonio negativo.** Devuelve `0` con una
   interpretación explícita; no se fuerza un valor engañoso.
3. **C4 depende de datos por producto.** `venta` sigue guardando fecha + monto
   para proyecciones; el desglose por SKU vive en `venta_detalle` y el inventario
   en `producto`/`movimiento_inventario`. La línea `1105` del balance no se
   modifica ni se usa para ABC/EOQ.
4. **Los benchmarks sembrados no son sectoriales.** `fuente` lo dice
   explícitamente (`Cátedra ANF115 - Estándar Sectorial UES`); hay que
   calibrarlos con datos reales del sector.
5. **La categoría es la clave de enrutamiento.** El nombre en
   `categoria_ratio.nombre_tipo` debe coincidir exactamente con el de
   `lib/ratios.ts` y `Ratio.tsx`. Un cambio de nombre exige tocar los tres
   lugares (deuda registrada, no se refactorizó a slug en esta entrega).
6. **`verify-ratios` usa un snapshot fijo.** No detecta cambios posteriores en
   los saldos de la BD; para eso se hizo la validación independiente contra la
   BD durante la aceptación.

---

## 9. Criterio de aceptación

Se considera aceptado cuando:

1. `npx tsc --noEmit` → `0`. **[Cumplido]**
2. `npm run build` → `0`, con las 23 rutas. **[Cumplido]**
3. `npm run verify:ratios` → `35/35`. **[Cumplido]**
4. `npm run e2e:au1` → `4/4` y limpieza completa. **[Cumplido]**
5. Los 42 PUT (14 endpoints × 3 años) responden `200` con los valores de §3.
   **[Cumplido]**
6. Las pruebas negativas y la regresión de liquidez se comportan como se describe.
   **[Cumplido]**
7. La UI muestra y calcula las 23 categorías, con valores a 4 decimales,
   advertencias de patrimonio negativo y persistencia. **[Cumplido: 125
   comprobaciones automatizadas originales + 51 de coherencia de
   interpretaciones, 0 fallos]**
8. Lint de los archivos modificados de C (`ratios.ts`, `ratioFormulas.ts`,
   `RatioDetailsModal.tsx`) → `0` errores. **[Cumplido]**
   `npm run lint` global sigue fallando por errores preexistentes fuera de C
   (p. ej. `UsuarioFormModal.tsx`, `Usuarios.tsx`, `TipoRatio.tsx`).

---

## 10. Etapas de ejecución y pruebas (T1–T8)

| Etapa | Nombre | Objetivo |
|---|---|---|
| T1 | Auditoría | Encontrar textos con importes crudos, signos negativos mal redactados y valores no interpretables. |
| T2 | Corrección de plantillas | Ajustar `src/lib/ratios.ts` sin cambiar fórmulas ni precisión. |
| T3 | Repersistencia | Recalcular por endpoint las filas con benchmark y verificar los textos guardados. |
| T4 | Documentación | Reflejar los textos nuevos, la cantidad real de categorías y los duplicados 2025. |
| T5 | Cruces de año | Recalcular y abrir los IDs de la misma categoría en 2023/2024/2025 para comprobar que se usa el año correcto. |
| T6 | Regresión automática | `tsc`, `verify:ratios`, lint, build y `e2e:au1`. |
| T7 | UI | Modal de detalles, 4 decimales, coherencia texto/valor y persistencia tras F5. |
| T8 | Cierre | Auditoría final de BD y documentación, sin commit. |

Secuencias de IDs para T5 (mismo orden en 2023 / 2024 / 2025):

- Liquidez `112 / 1 / 127`, efectivo `113 / 2 / 128`, capital de trabajo
  `114 / 3 / 129`.
- Prueba ácida `4 / 5 / 6`, endeudamiento `7 / 8 / 9`, propiedad
  `10 / 11 / 12`, patrimonial `13 / 14 / 15`.
- Cobertura `28 / 29 / 30`, margen neto `31 / 32 / 33`, ROA `34 / 35 / 36`,
  ROE `37 / 38 / 39`, DuPont `40 / 41 / 42`.
- Rotación de inventarios `43 / 44 / 45`, edad del inventario `46 / 47 / 48`,
  periodo de pago `49 / 50 / 51`, ciclo operativo `52 / 53 / 54`, CCE
  `55 / 56 / 57`.

En T5 se comprueba que el valor y el texto de cada fila corresponden a su
`anio_ratio`: por ejemplo, patrimonial debe mostrar `-107741.49`, `-202612.24` y
`-179113.35` USD respectivamente, y ROE `134.21%`, `46.82%` y `-13.12%` como
valores referenciales. Las filas `112–126` y `130–135` no entran en el recálculo
porque no tienen `id_parametro_sector`; sus valores se revisan solo como cruce
de año. Con benchmark sí se recalculan los duplicados `127–129`.

Auditoría final: 69 filas, `MAX_LEN=181`, 21 filas sin parámetro sectorial y
48 PUT `200` (42 de C + 6 duplicados). UI: 51 comprobaciones nuevas sobre IDs
`1`, `14`, `29`, `32`, `35`, `38`, `39`, `42` y `127`, con 0 fallos y sin errores
de consola.

---

## 11. Módulo C4 — inventario por producto

### 11.1 Modelo de datos

La migración `supabase/migrations/0071_c4_inventario.sql` crea `producto`,
`movimiento_inventario`, `venta_detalle` y `parametro_inventario`, habilita RLS
sin policies (acceso por `service_role`) y registra la opción de menú `12` con
acceso para `admin`. Incluye 12 SKU sintéticos idempotentes para la empresa 2,
reconciliados con las balanzas de comprobación de 2023–2025.

La demanda anual de cada SKU sale de `venta_detalle` filtrando por
`venta.fecha_venta` dentro del año solicitado. El stock actual se lee de
`producto.stock_actual`; los movimientos registran entradas/salidas y ajustan ese
stock. `venta.monto_venta` se conserva para proyecciones y no se recalcula.

### 11.2 Fórmulas

| Modelo | Fórmula | Parámetros |
|---|---|---|
| ABC | valor anual = demanda × costo unitario; acumulado ≤ 80% → A, ≤ 95% → B, resto → C | `corte_a`, `corte_b` |
| EOQ | `√(2·D·S / (h·costo_unitario))` | `costo_pedido` (S), `tasa_mantenimiento` (h) |
| Punto de reorden | `(D / dias_anio) · lead_time_dias` | `lead_time_dias`, `dias_anio=365` |

No hay stock de seguridad ni factor `z`. Un denominador en cero devuelve `0`,
igual que el criterio de `ratioFormulas.ts`.

Las unidades son: demanda en unidades del año seleccionado, costo unitario en
USD por unidad, `S` en USD por pedido, `h` como tasa anual aplicada al costo
unitario, lead time y días/año en días, y consumo diario en unidades/día. El
acumulado ABC incluye el artículo evaluado; `≤80%` → A, `≤95%` → B. Los
resultados se redondean a 2 decimales y no se presenta precisión decimal exacta.
El costo unitario y el stock son un snapshot único calibrado a 2025: al consultar
2023 o 2024 cambia la demanda, pero esos dos valores se mantienen, por lo que el
horizonte debe interpretarse con esa hipótesis.

### 11.3 Endpoints y UI

- `/api/v1/inventario/productos` y `/productos/[id]`: CRUD de SKU.
- `/api/v1/inventario/movimientos` y `/movimientos/[id]`: registro/eliminación
  con ajuste de stock.
- `/api/v1/inventario/parametros`: parámetros por empresa (`upsert`).
- `/api/v1/inventario/modelos?empresaId=2&anio=2024`: devuelve ABC, EOQ,
  reorden, los supuestos usados y `aniosDisponibles` (ordenados de mayor a
  menor). La UI usa el último año con datos cuando el inicial no tiene ventas.
- Rutas UI: `/inventario/productos`, `/inventario/movimientos`,
  `/inventario/parametros` y `/inventario/modelos`.
- Permisos: `src/lib/permisos.ts` exige `id_opcion = 12` para escrituras.

### 11.4 Aceptación con fixture sintético

`npm run verify:inventario` importa `src/lib/inventarioFormulas.ts` (el mismo
código que usan los endpoints) y comprueba **47/47** casos. El fixture toma
cuatro SKU reales del seed 2025 (demanda y stock incluidos), no nombres demo:

| SKU | Producto | Demanda | Costo | Valor anual | Acumulado | Clase | H | EOQ | PR |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| INV-001 | Laptop Core i5 16GB | 337.1674 | 850.55 | 286777.73 | 47.38% | A | 170.11 | 19.91 | 13.86 |
| INV-002 | Monitor LED 24 pulgadas | 1005.5870 | 189.97 | 191031.36 | 78.95% | A | 37.99 | 72.76 | 41.33 |
| INV-003 | Teclado mecánico | 2843.1777 | 28.03 | 79694.27 | 92.12% | B | 5.61 | 318.49 | 116.84 |
| INV-010 | Cable HDMI 2 m | 5970.6731 | 7.99 | 47705.68 | 100.00% | C | 1.6 | 864.45 | 245.37 |

Parámetros del fixture: `S=100`, `h=20%`, `lead_time=15 días`, `365 días/año`.
También se verifican casos límite: demanda 0, `h=0`, lead time 0 y redondeo a 2
decimales.

Para que la UI muestre datos hay que ejecutar la migración `0071` y, sobre una
BD que ya tuviera el seed anterior, el backfill `0072` en Supabase.

### 11.5 Datos sembrados de producto (empresa 2)

Los 12 SKU (`INV-001` a `INV-012`) son inventados pero están calibrados contra
los saldos contables reales de la BC. Los importes son idénticos a los usados en
el Módulo C; no provienen de los Excel de `estados-financieros/`, que solo
contienen cuentas contables. Si ya se había ejecutado una versión anterior de la
migración, vuelve a ejecutarla para limpiar los SKU `C4-P%`, actualizar
parámetros y la descripción de la opción `12`, y restaurar los stocks del seed;
después aplica `0072`, que reinserta solo los tres bloques de `venta_detalle`
sin alterar stocks ni parámetros. El estado verificado es de 36 filas en
`venta_detalle`, 12 por año (`2023`, `2024` y `2025`).

| Año | Ventas `Σ venta_detalle.subtotal` | Costo de ventas `Σ cantidad·costo_unitario` | Margen | Inventario `Σ stock·costo_unitario` |
|---|---:|---:|---:|---:|
| 2023 | 1,548,023.87 | 1,427,555.52 | 120,468.35 (7.78%) | 687,849.15 |
| 2024 | 1,636,059.68 | 1,503,995.03 | 132,064.65 (8.07%) | 800,699.18 |
| 2025 | 1,749,164.35 | 1,592,339.86 | 156,824.49 (8.97%) | 854,798.59 |

El inventario final sembrado en `producto.stock_actual` es el de 2025
(`854,798.59`, línea `1105`). Las unidades de stock y las cantidades de
`movimiento_inventario` son enteras; el `costo_unitario` se ajustó a dos
decimales por SKU para conservar exactamente ese total de inventario. Como
efecto colateral, el costo de ventas calculado desde `venta_detalle` cambia
ligeramente respecto del costo BC original. Las entradas de
`movimiento_inventario` parten de una apertura 2022 equivalente al 75% del
inventario 2023 y agregan compras anuales; las salidas se representan en
`venta_detalle`, por lo que `apertura + compras − ventas = stock final` por SKU.

Parámetros aplicados: `S=100`, `h=20%`, `lead_time=15 días`, `365 días/año`.
Con los valores de 2025 la clasificación ABC queda en 7 artículos A, 3 B y 2 C;
el SKU `INV-010` (cable HDMI) queda con stock por debajo del punto de reorden,
para que la reposición sugerida no sea trivial.

Todas las cifras monetarias visibles usan `src/lib/formatoMonetario.ts`
(`es-SV`, USD, 2 decimales, símbolo `$`). Las cantidades se expresan en unidades,
el consumo diario en unidades/día, el lead time y los días/año en días, y las
tasas como porcentaje anual; todos conservan su formato numérico original.
La gráfica de DuPont es una sensibilidad teórica por factor: al variar un solo
factor en el mismo porcentaje las curvas coinciden por la identidad
multiplicativa. Los deslizadores del escenario afectan solo al ROE mostrado
arriba, no a esas curvas.

Los SKU nuevos se asignan automáticamente por empresa con el consecutivo
`INV-###` siguiente al mayor existente (`INV-014` después de `INV-013`). El
formulario muestra ese valor en un textbox deshabilitado.
