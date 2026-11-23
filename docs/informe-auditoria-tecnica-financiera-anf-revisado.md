# Informe de revisión técnica y funcional del sistema ANF

**Fecha de revisión:** 22 de noviembre de 2026  
**Alcance:** análisis financiero, ratios, inventarios, proyecciones, presupuestos, evaluación de proyectos y módulo de Contabilidad.

## Seguimiento de correcciones — 22 de noviembre de 2026

**Ajuste de presentación solicitado:** cuando ambos importes son cero, el análisis horizontal muestra 0 %. En el vertical se aplica la misma convención cuando la cuenta y su base son cero. Un importe distinto de cero con base cero permanece como «No calculable: base cero». El 0 % en el caso 0/0 es una convención visual solicitada, no el resultado de una división matemáticamente definida. Esta precisión actualiza el tratamiento de bases cero descrito en los hallazgos originales.

Los hallazgos que se describen más adelante corresponden al estado auditado. Posteriormente se corrigieron en el código de trabajo los siete puntos priorizados: porcentajes de análisis horizontal y vertical con base cero, interpretación de liquidez, arrastre de inventario excedente, detección de TIR de raíz doble, relación B/C con entradas y salidas separadas y consistencia de unidades e importes en la gráfica de equilibrio.

Los porcentajes no calculables se devuelven como `null` y se presentan con un mensaje explícito, también en los datos utilizados para preparar el resumen de IA. El cero calculado continúa mostrándose como 0 %. La corrección de inventario conserva las existencias efectivas para el siguiente mes. La evaluación B/C considera inversión, capital de trabajo, costos e impuestos como salidas, y reconoce ingresos, rescate y recuperación del capital de trabajo como entradas; la depreciación no se cuenta como desembolso. VAN y recuperación mantienen su cálculo sobre los flujos netos. El Excel de capital incorpora las entradas y salidas que permiten revisar B/C.

Se incrementó la versión interna de cálculo de ratios para que el siguiente recálculo renueve las interpretaciones persistidas. Después del despliegue debe ejecutarse **Actualizar indicadores**; las correcciones locales no modifican automáticamente los registros remotos antes de ese paso.

La validación posterior incluyó 171 comprobaciones aprobadas de regresión y casos nuevos, revisión estática sin incidencias en los archivos modificados, TypeScript y compilación de producción. Las pruebas utilizan datos en memoria y simulaciones de servicios; no constituyen un recorrido visual completo del despliegue. Se corrigió una simulación de Excel que no contemplaba la consulta de períodos contables, conservando sus comprobaciones financieras.

Este conjunto de cambios no requiere migraciones SQL y no reemplaza balances, catálogo, ventas ni supuestos guardados. Al recalcular presupuestos con inventario excedente y evaluaciones de capital, sus resultados pueden cambiar conforme a las fórmulas corregidas. Proforma y la clasificación de reversiones de ajustes permanecen fuera de este conjunto de correcciones. No se realizó commit ni despliegue como parte de este trabajo.

## Seguimiento de proyecciones — integración de `753eb6e`, 22 de noviembre de 2026

Se actualizó la rama local `main` al commit remoto `753eb6e` («Cambio auditoria 5,6,8») y se adaptó el filtro local sobre esa versión. Se conservan las nuevas pantallas, gráficas y confirmación posterior a la carga. No se realizó commit ni despliegue adicional, ni se modificaron ventas, detalles de inventarios, balances o esquema de Supabase.

| Hallazgo original | Estado después de integrar | Evidencia y límites |
|---|---|---|
| 5. Consistencia entre unidades e importes de equilibrio | Resuelto para los casos comprobados | Los importes de cada punto se calculan con sus mismas unidades. La prueba numérica del informe continúa pasando. |
| 6. Sensibilidad DuPont | Mejorada; requiere precisar su explicación | Las curvas ahora incorporan los controles y existe una curva del escenario combinado. La coincidencia de curvas con cambios iguales sigue siendo posible. Esta revisión comprobó el código; no certifica toda su interacción visual. |
| 8.1. Estado posterior a cargar Excel | Implementado en el cambio recibido | Se oculta el formulario y aparece el archivo cargado y «Cargar otro archivo». No se realizó una carga en producción para verificarlo, pues alteraría los datos. |
| 8.2. Nombres de herramientas | Corregido localmente | La vista avanzada conserva periodicidad mensual y anual; título y navegación dicen «Pronósticos: métodos avanzados». Se conserva la proyección mensual con los tres métodos clásicos. |
| 8.3. Mezcla de fuentes mensuales | Corregida para el escenario actual | Gráfica clásica, cálculo clásico, pronóstico avanzado, disponibilidad y resumen de IA usan la selección mensual correspondiente. El anual sigue priorizando los totales contables. |
| 8.4. Protección de totales contables | Se conserva | No se cambiaron las operaciones de edición y eliminación ni los datos del historial general. El historial puede seguir mostrando registros de inventarios, aunque no se usen para este escenario de pronóstico. |
| 8.5. Procedencia simulada | Corregida en las dos pantallas revisadas | Se muestra la fuente simulada y se incluye esa condición en el mensaje preparado para la IA. No se presenta la distribución mensual como ventas reales verificadas. |
| 9. Alcance de Proforma y FER | Pendiente | Este cambio no amplía el modelo de impuestos, costo del financiamiento ni supuestos por cuenta señalados en la auditoría. |

**Regla temporal de fuentes:** si existen registros cuya observación empieza por `Escenario simulado mensual `, las herramientas mensuales utilizan exclusivamente esa serie, sin completarla con ventas de otras fuentes. Por tanto, cargar nuevas ventas sin esa marca no extiende el escenario seleccionado. Cuando no existe ese escenario se toman las ventas registradas, excluyendo los totales contables automáticos y los agregados de inventarios identificados por `INV AAAA INV-…`. Esta identificación textual es provisional; la integración futura requiere una clasificación explícita de procedencia y conciliación de totales entre ambos módulos.

**Correcciones de integración:** se retiró el descarte por importe superior a $500,000, que podía ocultar ventas válidas y no eliminaba los agregados de inventarios. Se restableció la exigencia de doce meses consecutivos para los métodos clásicos. El servidor de IA ahora admite `UNIFICADO_COMPARATIVO`, que envía la nueva pantalla, y recalcula los tres métodos desde los datos seleccionados en lugar de confiar en resultados enviados por el navegador.

**Cambio metodológico que debe acordarse:** el commit recibido calcula el incremento porcentual como suma de variaciones absolutas dividida entre suma de bases. Es una tasa ponderada; no equivale al promedio aritmético de las tasas de cambio mensuales usado anteriormente. Se conserva esa decisión del cambio recibido y no se certifica su equivalencia con el método específico de clase.

**Verificación:** compilación de producción y TypeScript aprobados; 34 pruebas de integración, períodos, módulo D y correcciones matemáticas, más 7 de caché IA, aprobadas. Se comprobaron adicionalmente fuentes mezcladas, conservación de ventas superiores a $500,000 y meses con monto cero, rechazo de huecos, conservación del anual y resumen unificado sin llamar a Gemini. En navegador se verificaron ambas gráficas locales con lectura de Supabase remoto, sin errores JavaScript. La API devolvió 36 meses con totales de $1,600,000, $1,700,000 y $1,830,000; el mayor importe mensual seleccionado fue $195,020.22. No se solicitó una interpretación real a Gemini.

Las capturas de comprobación se guardan fuera de los archivos versionados, en `.local-data/verificacion-proyecciones-main/`. La discrepancia entre los datos de inventarios y el escenario financiero nuevo sigue pendiente de conciliación; excluirlos del pronóstico no la resuelve.

## 1. Propósito y alcance de la revisión

Este informe revisa el funcionamiento del sistema de Análisis Financiero (ANF), amplía las observaciones de una auditoría anterior e incorpora el módulo de Contabilidad. Su propósito es explicar qué funcionalidades están respaldadas por la revisión, cuáles tienen limitaciones y qué correcciones conviene realizar.

Se contrastaron las afirmaciones del informe anterior con las fórmulas, componentes y controles implementados. También se realizaron consultas de lectura a la base de datos remota y se ejecutaron pruebas automatizadas y casos numéricos adicionales. No se modificaron datos de producción durante la revisión.

Las 219 comprobaciones automatizadas ejecutadas finalizaron correctamente. Sin embargo, los casos adicionales identificaron comportamientos que esas pruebas no cubrían. Por ello, aprobar las pruebas existentes no equivale a certificar que todas las operaciones del sistema sean correctas para cualquier conjunto de datos.

La revisión no incluyó una prueba visual autenticada de todas las pantallas en producción, una auditoría de seguridad integral ni la ejecución de un ciclo contable operativo completo en la base remota. Cuando un hallazgo procede del código y no de una operación reproducida en producción, se indica expresamente.

### Criterios utilizados

| Clasificación | Significado |
|---|---|
| Respaldado en los casos revisados | El comportamiento y las pruebas examinadas apoyan la funcionalidad descrita. |
| Error confirmado | Se identificó un resultado incorrecto mediante un caso reproducible o un dato observado. |
| Limitación del modelo | La funcionalidad opera bajo supuestos que deben explicarse y que restringen su aplicación. |
| Mejora de presentación | La propuesta facilita la comprensión o navegación, sin corregir necesariamente una fórmula. |
| Requiere validación adicional | Existe una observación que necesita una prueba específica antes de certificar su alcance. |

## 2. Análisis y reportes financieros

### 2.1. Análisis horizontal

**Evaluación:** respaldado para bases distintas de cero, con una excepción en el tratamiento de la variación porcentual.

El análisis horizontal compara los saldos de dos ejercicios y obtiene la variación absoluta y relativa:

- Variación absoluta = saldo del segundo año − saldo del primer año.
- Variación relativa = variación absoluta ÷ saldo del primer año × 100.

Estas operaciones están implementadas. La excepción ocurre cuando el saldo inicial es cero: el sistema devuelve una variación relativa de 0 %, aunque no es posible dividir entre esa base.

**Ejemplo:** una cuenta pasa de $0 a $100. La variación absoluta es $100, pero presentar una variación relativa de 0 % comunica que no hubo cambio porcentual, lo cual resulta engañoso.

**Corrección recomendada:** conservar la variación absoluta y presentar la relativa como «No calculable: saldo inicial igual a cero». El valor no calculable debe distinguirse de un crecimiento real de 0 %.

### 2.2. Análisis vertical

**Evaluación:** el informe anterior describe correctamente la base del Balance General, pero omite la base del Estado de Resultados.

El sistema utiliza bases diferentes según el reporte:

| Reporte | Base del porcentaje vertical |
|---|---|
| Balance General | Total Activo del mismo ejercicio. |
| Estado de Resultados | Ventas Netas del mismo ejercicio. |

Por tanto, no debe documentarse que todo el análisis vertical utiliza Total Activo. También existe un tratamiento mejorable cuando la base es cero, ya que el sistema devuelve 0 %.

**Corrección recomendada:** identificar la base utilizada en cada reporte y mostrar un aviso cuando no sea posible calcular sus porcentajes. Un porcentaje no calculable no debe representarse como un cero real.

### 2.3. Acceso a Gestión de Ratios o Benchmark

**Evaluación:** observación de usabilidad, no error funcional.

El acceso a Ratios desde una vista de análisis puede repetir una opción disponible en el menú lateral. Sin embargo, un acceso contextual también puede facilitar el recorrido del usuario.

**Recomendación:** decidir su permanencia según el diseño de navegación. Si se conserva, utilizar una etiqueta que explique su propósito, por ejemplo, «Comparar con referencias sectoriales».

## 3. Ratios financieros y referencias sectoriales

### 3.1. Tabla principal de ratios

**Evaluación:** las observaciones del informe anterior están respaldadas.

La tabla presenta el nombre de la categoría y, en la columna Parámetro, el nombre del ratio asociado a la referencia sectorial. Cuando ambas descripciones coinciden, la tabla repite información sin mostrar directamente el valor del benchmark.

Además, el valor calculado del ratio no aparece como columna principal. El usuario debe abrir el detalle para consultarlo.

**Mejora recomendada:** incluir en el listado la siguiente información:

| Campo | Propósito |
|---|---|
| Indicador | Identificar la razón financiera. |
| Valor calculado | Consultar directamente el resultado de la empresa. |
| Unidad | Distinguir veces, porcentaje, días u otra magnitud. |
| Referencia sectorial | Mostrar el valor de comparación, si existe. |
| Año de referencia | Identificar la antigüedad del benchmark. |
| Año del cálculo | Identificar el ejercicio analizado. |

Los detalles y la interpretación pueden mantenerse en el modal como información complementaria.

### 3.2. Significado de N/A en Parámetro

**Evaluación:** la ausencia de referencia debe distinguirse de un cálculo faltante.

La consulta remota encontró 69 ratios con valor calculado. De ellos, 21 no tienen una referencia sectorial asociada. En esos casos, N/A en la columna Parámetro indica que falta una referencia para comparar; no significa que el cálculo financiero haya desaparecido.

**Corrección recomendada:** sustituir ese N/A por una descripción explícita, como «Sin referencia sectorial». No deben inventarse benchmarks únicamente para completar la tabla. Las referencias que se incorporen deben indicar sector, período, unidad y fuente.

### 3.3. Interpretación de liquidez corriente

**Evaluación:** error confirmado en el texto interpretativo almacenado en la base remota.

El valor de liquidez corriente de 2024 es 1.3629. Sin embargo, su interpretación presenta el total del activo corriente, $2,569,340.85, como si fuera el importe disponible por cada dólar de deuda corriente.

La razón financiera y el total del activo son magnitudes distintas. Una explicación consistente con el valor calculado sería:

> La empresa dispone de aproximadamente $1.36 de activo corriente por cada dólar de pasivo corriente.

**Impacto:** el valor del ratio puede estar calculado correctamente mientras su explicación induce a una conclusión equivocada.

**Corrección recomendada:** utilizar el resultado de la división en esa frase y actualizar las interpretaciones persistidas mediante el recálculo correspondiente. Cambiar únicamente el texto del código no actualiza por sí solo las explicaciones ya guardadas.

### 3.4. Evolución multianual de ratios

**Evaluación:** respaldada en los casos revisados.

El sistema obtiene los ejercicios disponibles a partir de los estados financieros y permite representar los indicadores seleccionados. La revisión no identificó un fallo que contradiga la evaluación general del informe anterior.

Esto no elimina la necesidad de revisar las unidades, los redondeos y el tratamiento de valores no calculables en cada indicador.

## 4. Inventarios: ABC, EOQ y punto de reorden

**Evaluación:** las fórmulas y los casos revisados respaldan su funcionamiento.

La clasificación ABC ordena los productos por su consumo anual monetario, calculado a partir de demanda y costo unitario. El modelo EOQ utiliza demanda anual, costo de pedido y costo anual de mantenimiento por unidad. El punto de reorden considera la demanda diaria, el plazo de entrega y el stock de seguridad.

No se identificó un error en estos cálculos dentro de los casos examinados. No obstante, la expresión «precisión decimal exacta» debe evitarse, porque los cálculos utilizan números de punto flotante y dependen de las unidades y supuestos ingresados.

**Recomendación:** documentar las unidades de cada entrada y la convención utilizada cuando un producto cruza los umbrales de clasificación ABC. La validación del modelo debe considerar que demanda y costos pertenecen a un mismo horizonte temporal.

## 5. Punto de equilibrio

**Evaluación:** fórmula respaldada, con un detalle de consistencia gráfica.

El sistema calcula:

- Unidades de equilibrio = costos fijos ÷ (precio unitario − costo variable unitario).
- Ventas de equilibrio = unidades de equilibrio × precio unitario.

También rechaza entradas inválidas, incluyendo un precio que no supera al costo variable unitario.

En los puntos de la gráfica se redondea la cantidad de unidades, pero los importes se calculan con la cantidad previa al redondeo. Esto puede producir diferencias entre las unidades mostradas y sus ingresos o costos asociados.

**Ejemplo reproducido:** con costos fijos de $100, precio de $13 y costo variable de $4, un punto gráfico muestra 2 unidades y ventas de $28.89. Si fueran exactamente 2 unidades, las ventas serían $26.

**Corrección recomendada:** utilizar cantidades coherentes en ambos ejes. Si la gráfica admite unidades fraccionarias, conservarlas; si trabaja con unidades enteras, calcular los importes a partir de esas mismas cantidades.

## 6. DuPont y sensibilidad

### 6.1. Resultado del escenario

**Evaluación:** el resultado responde a los controles examinados.

El modelo relaciona margen neto, rotación de activos y multiplicador de capital. Los controles permiten introducir cambios relativos en esos factores y obtener un ROE de escenario sin modificar los estados financieros originales.

### 6.2. Gráfica de sensibilidad

**Evaluación:** la observación anterior es parcialmente correcta y necesita explicación.

La gráfica construye las tres curvas con valores iguales y no incorpora las posiciones de los controles del escenario. Por eso puede permanecer sin cambios mientras el ROE del escenario se modifica.

Sin embargo, la superposición no demuestra por sí sola un error matemático. En una identidad multiplicativa, aumentar individualmente cualquiera de los factores en el mismo porcentaje produce el mismo cambio proporcional del producto, manteniendo los demás constantes.

**Corrección recomendada:** aclarar qué representa la gráfica. Se puede conservar como sensibilidad relativa individual y mostrar por separado el escenario combinado de los controles. Si se desea que responda a ellos, se debe definir una comparación coherente. No corresponde separar artificialmente las curvas solo para que se vean diferentes.

## 7. Catálogo de cuentas

**Evaluación:** el informe anterior es incompleto porque no considera el catálogo contable.

El catálogo del área financiera permite consultar y gestionar la activación de cuentas, pero no presenta directamente un formulario de creación. En cambio, el módulo de Contabilidad permite al Administrador registrar subcuentas bajo cuentas existentes, heredando su clasificación.

Por tanto, no es correcto afirmar que el sistema carece completamente de una opción para agregar cuentas. La capacidad disponible consiste específicamente en crear subcuentas dentro de la estructura ANF; no equivale a crear libremente cualquier cuenta raíz.

**Mejora recomendada:** documentar la ubicación de esta función y, si resulta conveniente, incorporar un acceso desde el catálogo financiero. Debe mantenerse la restricción de administración correspondiente.

## 8. Ventas y pronósticos

### 8.1. Carga masiva de ventas

**Evaluación:** la permanencia del formulario después de cargar está confirmada en el componente.

Después de una carga exitosa, el sistema limpia el archivo seleccionado y reinicia el formulario, pero mantiene visible el área de carga. Esto no implica que los datos se hayan cargado incorrectamente.

**Mejora recomendada:** mostrar un resumen de la operación y un botón «Cargar otro archivo». El resumen podría incluir cantidad de registros, período y total importado. Si se conserva el formulario visible, debe existir una confirmación clara que evite cargas repetidas por confusión.

### 8.2. Diferencia entre las dos herramientas de proyección

**Evaluación:** es conveniente mejorar los nombres, pero no llamar exclusivamente anual a la vista avanzada.

| Herramienta | Métodos | Periodicidad |
|---|---|---|
| Proyección clásica | Mínimos cuadrados lineales, incremento porcentual e incremento absoluto. | Mensual. |
| Pronóstico avanzado | Promedio móvil, regresión logarítmica y regresión cuadrática. | Mensual o anual. |

La propuesta anterior de renombrar la vista avanzada como «Pronóstico de ventas anuales» no describe todas sus capacidades.

**Mejora recomendada:** utilizar nombres como «Proyección mensual: métodos clásicos» y «Pronósticos: métodos avanzados». La carga de ventas puede distinguirse visualmente del cálculo, aunque ambas tareas estén disponibles en una misma pantalla.

### 8.3. Fuente de las ventas y prevención de duplicación

El pronóstico anual prioriza los totales generados desde los estados financieros. Si existe un total anual contable, su detalle mensual no se vuelve a sumar para ese mismo año.

El pronóstico mensual utiliza los registros mensuales. Un balance anual no permite reconstruir las ventas originales de cada mes. Actualmente, ese detalle se incorpora mediante carga masiva o registro manual; no se extrae automáticamente de las partidas contables.

### 8.4. Historial y protección de totales contables

**Evaluación:** respaldada en la revisión de los controles implementados.

La consulta permite filtrar por empresa y año. La API bloquea la edición y eliminación desde el historial mensual de los registros identificados como generados desde estados financieros. Estos totales deben actualizarse mediante el flujo financiero o contable correspondiente.

### 8.5. Procedencia simulada de los datos mensuales

**Evaluación:** inconsistencia de presentación confirmada.

En la base remota se encontraron 36 registros mensuales con observaciones de escenario simulado. Sus totales concilian con los valores anuales:

| Año | Meses cargados | Total mensual acumulado | Total anual |
|---|---:|---:|---:|
| 2023 | 12 | $1,600,000.00 | $1,600,000.00 |
| 2024 | 12 | $1,700,000.00 | $1,700,000.00 |
| 2025 | 12 | $1,830,000.00 | $1,830,000.00 |

Aunque la información está identificada como simulada en sus observaciones, la interfaz utiliza expresiones como «Histórico real» y «Meses reales». La conciliación de las sumas no convierte una distribución simulada en información mensual histórica comprobada.

**Corrección recomendada:** utilizar «Histórico registrado» o mostrar expresamente su procedencia. Los pronósticos obtenidos a partir de una serie simulada deben presentarse con esa condición.

## 9. Estados Proforma y financiamiento externo requerido

**Evaluación:** funcionalidad operativa bajo un modelo simplificado; no corresponde certificarla como una proyección integral sin reservas.

El sistema proyecta ventas, separa determinadas partidas en componentes fijos y variables y estima el financiamiento externo requerido (FER). El balance resultante cuadra bajo las reglas implementadas.

Sin embargo, las reglas de comportamiento están definidas principalmente por prefijos contables. No se incorpora un cálculo explícito de ISR sobre la utilidad proyectada ni una modelación completa del costo de un financiamiento adicional. Tampoco se ofrecen supuestos independientes de comportamiento para cada cuenta del balance.

Un balance que cuadra demuestra consistencia aritmética bajo esos supuestos, pero no garantiza por sí solo que todos sean adecuados para la empresa.

**Correcciones recomendadas:**

1. Explicar qué cuentas crecen con las ventas y cuáles permanecen constantes.
2. Presentar claramente las hipótesis de gastos y retención de utilidades.
3. Definir si el alcance incluirá cálculo de impuestos sobre la utilidad proyectada.
4. Definir si el financiamiento adicional generará intereses dentro de la proyección.
5. Validar el resultado con un ejemplo completo de la metodología utilizada en clase.

Estas observaciones no significan que el FER siempre sea incorrecto. Significan que su validez depende del modelo y que el informe anterior no describe sus restricciones.

## 10. Presupuestos de operación y caja

### 10.1. Cédulas y flujos escalonados

Las pruebas existentes respaldan los casos revisados de ventas, producción, materia prima, mano de obra, costos indirectos, gastos de operación y cobros y pagos escalonados. Sin embargo, se encontró un caso no cubierto que afecta el arrastre de inventarios.

### 10.2. Pérdida del inventario excedente entre meses

**Evaluación:** error confirmado mediante un caso numérico reproducible.

El modelo calcula un inventario final deseado y evita que la producción sea negativa. El problema aparece cuando el inventario inicial supera lo necesario: al limitar la producción a cero, no conserva el excedente real como inventario final y lo sustituye por el objetivo deseado.

**Ejemplo:**

| Concepto | Enero |
|---|---:|
| Inventario inicial | 1,000 unidades |
| Ventas | 100 unidades |
| Inventario final deseado | 0 unidades |
| Producción necesaria | 0 unidades |
| Inventario final real | 900 unidades |

El sistema muestra un inventario final de cero y utiliza ese valor como inventario inicial de febrero. De esa forma, deja de reconocer las 900 unidades disponibles y puede presupuestar producción adicional innecesaria.

El patrón de cálculo también está presente en el tratamiento de materia prima.

**Impacto:** puede sobreestimar producción, compras, mano de obra, costos y desembolsos. Por su propagación a otras cédulas, es uno de los hallazgos de mayor prioridad.

**Corrección recomendada:** distinguir el inventario final deseado del inventario final efectivo. El saldo que pasa al siguiente mes debe cumplir:

> Inventario final efectivo = inventario inicial + producción − ventas.

Para materia prima:

> Inventario final efectivo = inventario inicial + compras − consumo.

Las pruebas adicionales deben incluir exceso de inventario, meses sin demanda y utilización progresiva de existencias acumuladas.

### 10.3. Interpretación del financiamiento en caja

El presupuesto informa las necesidades de financiamiento y los excedentes, pero no suma automáticamente ese financiamiento al saldo de efectivo del mes siguiente. Esto puede ser una convención válida del reporte de necesidades, siempre que se documente.

**Recomendación:** no presentar esa salida como si fuera un calendario completo de contratación, amortización e intereses de préstamos, porque ese alcance requeriría reglas adicionales.

## 11. Presupuesto de capital y evaluación de proyectos

### 11.1. VAN y períodos de recuperación

**Evaluación:** respaldados para los ejemplos revisados.

Las comprobaciones ejecutadas cubren descuento de flujos, inversión inicial, capital de trabajo, valor de rescate y recuperación simple y descontada. Esto respalda esos casos, sin extender la conclusión a cualquier estructura posible de flujos.

### 11.2. TIR no detectada en un caso especial

**Evaluación:** error confirmado mediante un caso reproducible.

El algoritmo explora un intervalo de tasas y busca principalmente cambios de signo del VAN. Ese mecanismo puede omitir una raíz en la que el VAN toca cero sin cambiar de signo.

**Caso:** flujos de −100, +220 y −121. Existe una TIR de 10 %, de raíz doble, pero el sistema informa que no existe TIR en su intervalo de búsqueda.

**Corrección recomendada:** mejorar la detección de raíces y sus tolerancias, incorporar ese caso a las pruebas y mantener explícito el intervalo de búsqueda. También debe distinguirse entre no encontrar una solución con el procedimiento y demostrar que no existe una TIR.

### 11.3. Definición de la relación beneficio/costo

**Evaluación:** requiere precisar la metodología.

El sistema divide el valor presente de los flujos netos positivos entre el valor presente absoluto de los flujos netos negativos. Esa definición no siempre coincide con separar beneficios brutos y todos los costos de operación e inversión.

**Ejemplo sin descuento:** una inversión inicial de $1,000 y un año con ingresos de $3,000 y costos operativos de $1,000 produce un flujo neto de $2,000. El cociente de flujos netos sería 2. En cambio, beneficios brutos divididos entre inversión y costos sería $3,000 ÷ $2,000 = 1.5.

**Recomendación:** acordar con la metodología de clase cuál definición corresponde y documentarla en la interfaz y en el informe. No deben presentarse ambas como equivalentes.

## 12. Módulo de Contabilidad

### 12.1. Funciones disponibles

El módulo contempla ejercicios anuales, apertura desde un cierre anterior, incorporación de saldos históricos, catálogo de cuentas, preparación de partidas, contabilización, reversión, ajustes, diario, mayor, comprobación, estados financieros, publicación a ANF, cierre, reapertura y auditoría.

Las partidas se preparan como borradores y afectan los saldos después de contabilizarse. Una partida contabilizada no se edita directamente: la corrección conserva el original y registra nuevos movimientos. La publicación hacia ANF es manual y se distingue del cierre.

Las nueve pruebas contables ejecutadas respaldan aspectos de permisos, validación de importes, mayor, comprobación posterior al cierre y Estado de Capital. No sustituyen la prueba de un ciclo completo contra una base de datos.

### 12.2. Estado de los datos remotos

En la fecha de revisión, la base remota contenía únicamente los ejercicios 2023, 2024 y 2025 como históricos cerrados. No se encontraron partidas contables, publicaciones operativas ni un ejercicio 2026.

Por tanto, no sería correcto documentar que ya se probó en producción el ciclo operativo de 2026 basándose en los movimientos existentes en otro entorno local.

La ausencia de movimientos en los libros históricos es esperable: se incorporaron saldos y no las transacciones originales de esos años. No deben generarse partidas retrospectivas ficticias para completar visualmente el diario o el mayor.

### 12.3. Libro mayor por cuenta

**Evaluación:** comportamiento previsto de la consulta, no error de cálculo.

El libro mayor espera la selección de una cuenta antes de mostrar sus movimientos y saldo acumulado. El diario es la consulta que reúne las partidas contabilizadas del ejercicio.

**Mejora opcional:** ofrecer un mayor general agrupado por cuenta, manteniendo un saldo independiente para cada una. No debe mezclarse toda la información en un único saldo acumulado común.

### 12.4. Borradores incluidos en la exportación del diario

**Evaluación:** inconsistencia confirmada en el código de exportación; no se modificaron datos para reproducirla en producción.

La pantalla del diario filtra las partidas contabilizadas, pero la hoja «Diario» del Excel se genera recorriendo todas las partidas, incluyendo borradores. El archivo indica el estado, pero su contenido no coincide con el criterio de la pantalla.

**Impacto:** el usuario puede interpretar que todos los movimientos exportados pertenecen al diario contabilizado.

**Corrección recomendada:** filtrar los contabilizados al generar esa hoja. Si se desea conservar los borradores en la exportación, colocarlos en una hoja separada e identificada expresamente.

### 12.5. Reversión de ajustes y columnas de comprobación

**Evaluación:** observación identificada en el código SQL; requiere una prueba específica de integración.

Las partidas de ajuste se clasifican como AJUSTE, pero su reversión se crea como CORRECCION. La comprobación distribuye sus columnas según el tipo de partida: solo los movimientos AJUSTE se incluyen en la columna de ajustes.

Esto puede dejar el ajuste original en una columna y su reversión en la columna de movimientos sin ajustes. El saldo final se neutraliza, pero la separación entre saldo sin ajustes y ajustes deja de expresar claramente la cancelación.

**Corrección recomendada:** definir cómo debe clasificarse la reversión de un ajuste en los reportes y aplicar un criterio coherente. Debe probarse la secuencia ajuste, contabilización, reversión y consulta de comprobación, verificando tanto el saldo final como las columnas intermedias.

### 12.6. Publicación y recálculo financiero

Publicar comparte una versión de estados financieros con ANF; cerrar bloquea el ejercicio y ejecuta el tratamiento de cierre correspondiente. Son operaciones diferentes.

Los movimientos posteriores a una publicación requieren un nuevo envío para actualizar la información de ANF. Asimismo, el recálculo de indicadores es una etapa que puede fallar después de una publicación exitosa; el sistema debe informar esa diferencia.

**Validación pendiente recomendada:** ejecutar en un entorno aislado el recorrido completo de apertura, operaciones, ajustes, publicación, recálculo, cierre y reapertura. También debe verificarse el bloqueo de reapertura cuando existe una apertura posterior dependiente.

## 13. Funciones transversales y límites de verificación

La revisión incluyó pruebas de carga financiera, ratios, presupuesto, capital, controles de API, Contabilidad, disponibilidad de ventas, dashboard, períodos financieros y caché del asistente IA.

Las pruebas del asistente utilizaron respuestas simuladas y no consumieron el servicio real de Gemini. Por tanto, respaldan el comportamiento del código de caché y tratamiento de errores examinado, pero no certifican disponibilidad, cuota, configuración ni calidad de las respuestas del servicio real.

La auditoría anterior no evalúa de forma suficiente el dashboard, la seguridad integral, todos los roles, la administración de usuarios y empresas, la configuración de despliegue y la calidad de las interpretaciones de IA. La ausencia de hallazgos sobre esas áreas no debe interpretarse como una certificación completa.

## 14. Priorización de correcciones

| Prioridad sugerida | Acción | Motivo |
|---|---|---|
| Alta | Conservar inventarios excedentes en producción y materia prima. | El error se propaga a costos y caja. |
| Alta | Corregir la interpretación de liquidez y recalcular los textos guardados. | Existe información explicativa incorrecta en los datos remotos. |
| Media | Diferenciar porcentajes no calculables de valores iguales a cero. | Evita conclusiones erróneas en los análisis horizontal y vertical. |
| Media | Separar borradores del diario exportado. | Mantiene consistencia entre consulta y archivo. |
| Media | Validar la clasificación de reversiones de ajustes. | Asegura claridad en las columnas de comprobación. |
| Media | Precisar los supuestos de Proforma y el alcance del FER. | Evita presentar un modelo simplificado como una proyección integral. |
| Media | Corregir el caso de TIR de raíz doble y documentar B/C. | Mejora la fiabilidad y coherencia metodológica. |
| Media | Identificar la procedencia simulada de las ventas. | Preserva la trazabilidad de la información utilizada. |
| Baja | Mostrar valor y referencia en la tabla de ratios. | Facilita la consulta sin abrir cada detalle. |
| Baja | Aclarar nombres de pronósticos, gráfica DuPont y ubicación de creación de subcuentas. | Reduce confusiones sobre funciones existentes. |
| Baja | Mejorar el estado posterior a la carga de Excel. | Reduce la posibilidad de repetir cargas por confusión. |

La prioridad debe ajustarse al uso previsto. Si una funcionalidad se utilizará como evidencia académica o para apoyar decisiones, sus supuestos y limitaciones deben quedar visibles antes de presentar sus resultados como definitivos.

## 15. Conclusiones

El sistema integra funcionalidades financieras y contables que cuentan con respaldo en los casos examinados. No obstante, el informe anterior atribuye una exactitud general que las evidencias disponibles no permiten sostener.

Las observaciones de interfaz sobre la tabla de ratios y la carga de ventas son válidas. En cambio, la ausencia total de creación de cuentas y la identificación de la vista avanzada como exclusivamente anual necesitan corregirse, porque omiten capacidades existentes.

Los hallazgos de mayor impacto están relacionados con el arrastre de inventarios y la interpretación de liquidez. También requieren atención el tratamiento de bases cero, la detección de TIR especiales, la definición de B/C, los límites de Proforma y la consistencia de determinados reportes contables.

La documentación final debe separar funcionalidades verificadas, supuestos del modelo, mejoras de usabilidad y pruebas pendientes. Los datos simulados deben conservar esa identificación, y los históricos de saldos no deben confundirse con ejercicios que poseen transacciones originales.

## Anexo. Trazabilidad técnica de la revisión

Las siguientes rutas se incluyen como apoyo para localizar los comportamientos descritos; no sustituyen las explicaciones funcionales del informe.

| Área | Archivos principales revisados |
|---|---|
| Análisis horizontal y vertical | `src/lib/analisis.ts` |
| Tabla e interpretación de ratios | `src/components/ratio/Ratio.tsx`, `src/lib/ratios.ts` |
| Inventarios | `src/lib/inventarios.ts` |
| Punto de equilibrio | `src/lib/equilibrio.ts` |
| DuPont | `src/components/analisis/DupontIntegrado.tsx`, `src/lib/rentabilidad.ts` |
| Catálogo contable | `src/components/contabilidad/CatalogoContable.tsx` |
| Ventas y pronósticos | `src/lib/proyeccion.ts`, `src/lib/pronosticos.ts`, `src/components/proyeccion/PronosticoIntegrado.tsx` |
| Carga de ventas | `src/components/proyeccion/CargaMasivaVentas.tsx` |
| Proforma | `src/lib/proforma.ts` |
| Presupuesto maestro | `src/lib/presupuesto.ts` |
| Capital | `src/lib/capital.ts` |
| Exportación contable | `src/components/contabilidad/ExportarContabilidad.tsx` |
| Clasificación de ajustes y reversiones | `supabase/migrations/20261121031025_integracion_contable.sql` |

### Comprobaciones ejecutadas

| Conjunto | Comprobaciones aprobadas |
|---|---:|
| Carga de estados financieros | 58 |
| Fórmulas de ratios | 35 |
| Presupuesto maestro | 59 |
| Presupuesto de capital | 19 |
| Integración y API | 19 |
| Contabilidad | 9 |
| Ventas mensuales y validaciones del módulo D | 3 |
| Dashboard | 5 |
| Períodos financieros | 5 |
| Caché de IA con servicio simulado | 7 |
| **Total** | **219** |

Los casos adicionales de inventario excedente, TIR de raíz doble y consistencia de puntos del gráfico permitieron identificar limitaciones no cubiertas por esos conjuntos.
