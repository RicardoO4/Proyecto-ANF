# Contrato del módulo B para integración

Fuente de alcance: `plan_reigenieria.md`, tareas B1–B5. Este documento explica el contrato existente; la ingesta unificada A1–A3 corresponde a A. BC = Balance de Comprobación, BG = Balance General, ER = Estado de Resultados. El trabajo para usar BC como fuente única queda aplazado mientras A define su enfoque.

## Entrega para A

Importar desde `@/lib/accountCodes`:

```ts
import {
  TIPO_REPORTE,
  esTipoReporte,
  clasificarCuenta,
  CUENTAS_ER_REQUERIDAS,
} from '@/lib/accountCodes'
import type { TipoReporte } from '@/lib/accountCodes'
```

- BG: `TIPO_REPORTE.BALANCE` = `BALANCE_GENERAL`.
- ER: `TIPO_REPORTE.RESULTADOS` = `ESTADO_RESULTADOS`.
- Validar con `esTipoReporte(valor)`. Otros textos pueden almacenarse en la columna VARCHAR, pero quedan fuera de los filtros del motor y producen resultados vacíos o cero. El guard está disponible; A debe integrarlo en su validación de carga.
- `clasificarCuenta(codigo)` orienta por grupo: 1/2/3 → BG, 4/5 → ER, otros → `null`. No valida el catálogo ni convierte códigos de BC. El catálogo del sistema usa 4 para costos/gastos y 5 para ingresos.
- Cada estado corresponde a un cierre anual. La BD impone `UNIQUE(empresa_id, anio, tipo_reporte)`. BG y ER del mismo año son dos registros distintos; A debe gestionar duplicados y consistencia de la carga.
- Resolver códigos de texto mediante `cuenta.cue_cuenta_id` y persistir su `cuenta_id`. Las cuentas deben existir previamente. Conservar puntos y ceros: una celda numérica puede perder parte del código en el parser actual.
- Usar códigos únicos por estado y un nivel sin solapamiento: padre agregado **o** sus detalles. Cargar ambos duplica las sumas por prefijo. `getSaldoMap` conserva la primera fila de un código repetido, mientras `sumSaldos` suma las filas: la ingesta debe impedir duplicados.

## Cobertura de ER

`CUENTAS_ER_REQUERIDAS` contiene las referencias que A puede usar para revisar cobertura. Se aceptan desgloses por prefijo sin cargar también el padre; una cuenta sin movimiento puede llevar saldo cero.

| Prefijo | Uso |
| --- | --- |
| `5101.01` | Ventas brutas |
| `5101.02` | Rebajas/devoluciones, se restan de las ventas brutas |
| `4101` | Costo de ventas |
| `4102` | Gastos administrativos |
| `4103` | Gastos de venta |
| `4201` | Gastos financieros |

Ventas netas = `5101.01 - 5101.02`. El motor resta el saldo recibido de rebajas/devoluciones; evitar invertirlo de nuevo al cargar. Para utilidad real se necesitan **todos los movimientos pertinentes de ingresos (5) y costos/gastos (4)** del ejercicio; estas seis referencias no garantizan un ER completo. La utilidad neta es grupo 5 menos grupo 4.

Sin líneas de ER, el vertical de resultados está vacío y la evolución de ROE/ROA usa `3204` del BG como resultado del ejercicio. Con cualquier línea de ER, pasa a calcular la utilidad desde ER, aunque esté incompleto: validar la carga antes de publicarla. Una cuenta ausente aporta cero; no hace desaparecer por sí sola la sección. Si ventas netas es cero, los porcentajes verticales de ER son cero. ROE con patrimonio menor o igual a cero devuelve `null` y se presenta como N/M.

## Plantilla actual y trabajo de A

El parser actual (`src/lib/excel.ts`) lee `metadata` (B3 empresa, B4 año, B5 tipo exacto) y **`lineas`** (encabezado en primera fila, A código en texto, B saldo numérico). Carga un estado por archivo.

El objetivo A1 del plan es un único Excel con `metadata`, `balance` y `resultados`. **Esa ingesta unificada sigue siendo trabajo de A**: este contrato no implica que ya esté implementada. B consume los estados persistidos y no requiere cambios para leer un ER correctamente cargado.

Si A decide aceptar un BC como fuente única, no se puede guardar simplemente con otro `tipo_reporte`: B consulta únicamente BG y ER, así que ignoraría ese registro. La opción que permite conservar el motor B es que A convierta el BC a los dos estados anuales canónicos antes de guardarlos: BG (`BALANCE_GENERAL`) y ER (`ESTADO_RESULTADOS`). Para eso el equipo debe definir el mapeo de códigos del BC al catálogo ANF (incluyendo códigos con guiones y la diferencia de grupos 4/5), las reglas contables/signos y qué saldo representa el cierre anual. Un balance de comprobación mensual no es por sí mismo el cierre anual.

Con esa normalización completa en la frontera de ingesta, B debería necesitar poco o ningún cambio de fórmula; sí habrá que comprobar los códigos y saldos normalizados y repetir la aceptación. Si se almacenan códigos/tipos crudos del BC, entonces sí se debe adaptar B — filtros, mapeo de cuentas, clasificación y bases, además de los cálculos que dependan del ER — y coordinar los cambios de lectura de ratios con C. No implementar un tipo BC sin resolver primero ese contrato con A.

## API y aceptación

- `GET /api/v1/analisis/reporte-interno?empresaId=2&anio1=2023&anio2=2024`: devuelve `analisisHorizontal` y `analisisVertical`; cada línea incluye `tipoReporte`. BG usa Total Activo como base, ER usa Ventas Netas. No incluye ratios ficticios.
- `GET /api/v1/analisis/evolucion-ratios?empresaId=2&ratios=LIQUIDEZ_CORRIENTE,PRUEBA_ACIDA,ENDEUDAMIENTO,ROE,ROA`: devuelve objetos por año. También acepta `ratios[]=...` repetido. ROE/ROA y endeudamiento son porcentajes; liquidez y prueba ácida son cocientes.

Valores de referencia de Inv ABC (empresa 2), contrastados con los endpoints en esta sesión:

| Indicador | 2023 | 2024 | 2025 |
| --- | ---: | ---: | ---: |
| Total Activo | 5,297,318.03 | 5,632,723.49 | 5,951,250.73 |
| Liquidez corriente | 0.36 | 0.38 | 0.41 |
| Prueba ácida | 0.26 | 0.27 | 0.29 |
| Endeudamiento (%) | 97.22 | 102.41 | 103.80 |
| ROE (%) | 71.11 | N/M | N/M |
| ROA (%) | 1.98 | -3.43 | -1.52 |

Comparativo 2023/2024: 21 líneas de BG, Caja 2024 = 0.67%, ninguna línea de ER y ningún campo `ratios`. Los totales de Activo 2023/2024 y toda la evolución se comprobaron con aserciones. Total Activo 2025 procede de la verificación previa resumida al retomar el trabajo.

## Coordinación con C y demás integrantes

C debe revisar los cambios locales de `src/lib/ratios.ts` antes de integrar: códigos y tipos centralizados, sumas por prefijo y embeds de tablas `categoria_ratio(...)` / `parametro_sector(...)`, luego mapeados a camelCase. Los calculadores existentes persisten mediante PUT; no se ejecutaron escrituras en esta sesión. Sus nombres de categoría deben coincidir exactamente.

La BD almacena `valor_calculado` y `diferencia_vs_sector` en `NUMERIC(15,2)`: conserva dos decimales aunque la fórmula calcule más. No se modificó el esquema. Los ratios nuevos, DuPont y el recálculo automático pertenecen a C; los otros integrantes pueden consumir las mismas constantes y estados anuales.
