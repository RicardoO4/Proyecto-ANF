# Plan de pruebas — Módulo C (ratios avanzados, apalancamiento y AU1)

Rama: `Modulo-C`
Alcance de esta entrega: **C1–C2 (parcial)**, **C3** y **AU1**.
Fuera de alcance por falta de datos/modelo: rentabilidad (ROE, ROA, márgenes),
DuPont automático y C4 (ABC/EOQ/punto de reorden).

---

## 0. Qué se implementó

| Pieza | Archivo | Qué hace |
|---|---|---|
| Fórmulas puras | `src/lib/ratioFormulas.ts` | 5 fórmulas sin I/O, compartidas por la app y el script de aceptación |
| Calculadores | `src/lib/ratios.ts` | 4 nuevos + `recalcularRatios()` + `tieneEstado()` |
| Endpoints | `src/app/api/v1/ratios/[id]/calcular-*` | 4 rutas PUT nuevas |
| Cliente | `src/services/ratioService.ts` | 4 métodos nuevos |
| UI | `src/components/ratio/Ratio.tsx` | 4 entradas en el mapa categoría → endpoint |
| AU1 | `src/app/api/v1/estados-financieros/upload/route.ts` | recálculo tras la carga, sin bloquear la respuesta 201 |
| Esquema/seed | `supabase/migrations/003_seed_ratios.sql` | precisión `NUMERIC(15,4)`, 2 tipos, 4 categorías, 12 benchmarks, 12 filas de `ratio` |
| Seed por REST | `scripts/seed-ratios.mjs` | mismo seed sin editor SQL (salvo el `ALTER`) |
| Aceptación | `scripts/verify-ratios.mts` | 23 comprobaciones contra la cátedra y la BD |
| E2E AU1 | `scripts/e2e-au1.mjs` | carga sintética real + limpieza automática |

Ratios agregados:

| Ratio | Categoría (`nombre_tipo`) | Fórmula | Dirección |
|---|---|---|---|
| Prueba ácida | `Prueba ácida` | (Activo cte − Inventario) / Pasivo cte | mayor es mejor |
| Grado de endeudamiento | `Grado de endeudamiento` | Pasivo total / Activo total | menor es mejor |
| Grado de propiedad | `Grado de propiedad` | Patrimonio / Activo total | mayor es mejor |
| Razón de endeudamiento patrimonial | `Razón de endeudamiento patrimonial` | Pasivo total / Patrimonio | menor es mejor |

---

## 1. Prerrequisitos

1. `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY`.
2. Dependencias instaladas: `npm install`.
3. La empresa **2 (Inv ABC)** debe tener `BALANCE_GENERAL` cargado para 2023,
   2024 y 2025. En la BD verificada: 21 líneas por año y cierra
   `Activo = Pasivo + Patrimonio`.
4. Catálogo sembrado: `npm run seed:ratios` (idempotente).

> **Pendiente manual:** el `ALTER` de precisión a `NUMERIC(15,4)` solo se puede
> ejecutar desde el editor SQL de Supabase (no hay conexión Postgres directa).
> Mientras no corra, los valores se guardan con 2 decimales: es lo esperado, no
> un bug. Ver §6.

---

## 2. Pruebas automáticas (ejecutar en este orden)

### 2.1 Tipos

```powershell
npx tsc --noEmit
```

- [ ] Sale con código `0`, sin errores.

### 2.2 Fórmulas contra la cátedra y la BD

```powershell
npm run verify:ratios
```

- [ ] `OK: 23/23 comprobaciones`, código de salida `0`.

Cubre:
- Empresa ABC de `TAREA RATIOS.xlsx` (2019/2020): prueba ácida `0.8034` / `0.6093`,
  endeudamiento `0.6117`, propiedad `0.3883`, patrimonial `1.5755`.
- Inv ABC real (2023–2025): prueba ácida `0.2627 / 0.2664 / 0.2866`,
  endeudamiento `0.9722 / 1.0241 / 1.0380`, patrimonial `34.9181 / -42.5459`.
- Identidad `endeudamiento + propiedad = 1` en los tres años.
- Casos borde: denominador cero y **año anterior ausente ≠ saldo cero**
  (`promedioSaldo(100, null) = 100`, `promedioSaldo(100, 0) = 50`).

### 2.3 Build de producción

```powershell
npm run build
```

- [ ] Compila sin errores; las 4 rutas nuevas aparecen en el listado.

### 2.4 E2E de AU1 (servidor en marcha)

```powershell
npm run dev          # en otra terminal
npm run e2e:au1
```

- [ ] `OK: 4/4 comprobaciones`.
- [ ] Al final imprime `limpieza: 4 ratios, 1 estados financieros eliminados`.

El script crea un balance sintético para **2022** (año sin datos reales), lo sube
por el endpoint real de carga y verifica que AU1 calculó los 4 ratios sin
intervención: ácida `1.60`, endeudamiento `0.64`, propiedad `0.36`,
patrimonial `1.80`. Luego borra todo lo creado; se puede repetir sin ensuciar la
BD. Si se interrumpe, la siguiente ejecución limpia los restos antes de empezar.

---

## 3. Pruebas manuales de API

Levantar el servidor (`npm run dev`) y ejecutar:

```powershell
$casos = @(
  @{id=4;  ep='calcular-prueba-acida';             anio=2023},
  @{id=5;  ep='calcular-prueba-acida';             anio=2024},
  @{id=6;  ep='calcular-prueba-acida';             anio=2025},
  @{id=7;  ep='calcular-endeudamiento';            anio=2023},
  @{id=8;  ep='calcular-endeudamiento';            anio=2024},
  @{id=9;  ep='calcular-endeudamiento';            anio=2025},
  @{id=10; ep='calcular-propiedad';                anio=2023},
  @{id=11; ep='calcular-propiedad';                anio=2024},
  @{id=12; ep='calcular-propiedad';                anio=2025},
  @{id=13; ep='calcular-endeudamiento-patrimonial';anio=2023},
  @{id=14; ep='calcular-endeudamiento-patrimonial';anio=2024},
  @{id=15; ep='calcular-endeudamiento-patrimonial';anio=2025}
)
foreach ($c in $casos) {
  $r = Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/v1/ratios/$($c.id)/$($c.ep)"
  "{0} {1} -> {2}" -f $c.anio, $c.ep, $r.valor_calculado
}
```

Resultado esperado con la precisión actual `NUMERIC(15,2)`:

| Año | Prueba ácida | Endeudamiento | Propiedad | Patrimonial |
|---|---|---|---|---|
| 2023 | `0.26` | `0.97` | `0.03` | `34.92` |
| 2024 | `0.27` | `1.02` | `-0.02` | `-42.55` |
| 2025 | `0.29` | `1.04` | `-0.04` | `-27.31` |

Con `NUMERIC(15,4)` (después del `ALTER`), los mismos valores deben dar
`0.2627 / 0.2664 / 0.2866`, `0.9722 / 1.0241 / 1.0380`, `0.0278 / -0.0241 /
-0.0380` y `34.9181 / -42.5459 / -27.3144`.

Comprobaciones por respuesta:

- [ ] HTTP `200` y JSON con `valor_calculado`, `cumple_sector`, `interpretacion`.
- [ ] `cumple_sector = false` en los 12 casos, porque los benchmarks sembrados
      son 1.00 / 0.60 / 0.40 / 1.50 y la empresa queda del lado desfavorable.
- [ ] En 2024 y 2025 la interpretación de propiedad y de patrimonial dice
      explícitamente que **el patrimonio es negativo** y que el indicador no
      admite lectura normal de solvencia.
- [ ] `interpretacion` nunca supera 256 caracteres (límite de la columna).

Pruebas negativas:

- [ ] `PUT /api/v1/ratios/1/calcular-prueba-acida` (ratio de otra categoría)
      → error de servidor con el mensaje de categoría incorrecta.
- [ ] `PUT /api/v1/ratios/99999/calcular-endeudamiento`
      → `404` «Ratio no encontrado».

---

## 4. Pruebas manuales de UI

En `http://localhost:3000/ratios`:

- [ ] Aparecen las 4 categorías nuevas en la tabla (Prueba ácida, Grado de
      endeudamiento, Grado de propiedad, Razón de endeudamiento patrimonial),
      para 2023, 2024 y 2025.
- [ ] El botón **Calcular** actualiza el valor en pantalla sin recargar.
- [ ] Los valores mostrados coinciden con la tabla de §3.
- [ ] El texto de interpretación se lee completo (sin cortes) y no muestra
      `undefined` ni `NaN`.
- [ ] Un ratio de una categoría sin calculador no rompe la página: muestra el
      aviso de categoría no soportada.

---

## 5. AU1 — recálculo automático

Automatizado en §2.4. Verificación manual complementaria:

- [ ] Subir un estado financiero desde `/estados-financieros/cargar` y
      confirmar que la carga termina en éxito.
- [ ] Los ratios ya existentes para esa empresa/año quedan recalculados.
- [ ] Si un ratio no se puede calcular (p. ej. sin Estado de Resultados), la
      carga **no falla**: responde `201` y el ratio queda con su valor anterior.
- [ ] En la consola del servidor aparece `[AU1] no se pudieron recalcular los
      ratios: …` cuando algo falla dentro del hook (el cliente nunca ve el error).

---

## 6. Precisión numérica (paso manual obligatorio)

Sin conexión Postgres directa, ejecutar en el **SQL editor de Supabase**:

```sql
ALTER TABLE ratio
  ALTER COLUMN valor_calculado       TYPE NUMERIC(15,4),
  ALTER COLUMN valor_sector_promedio TYPE NUMERIC(15,4),
  ALTER COLUMN diferencia_vs_sector  TYPE NUMERIC(15,4);

ALTER TABLE parametro_sector
  ALTER COLUMN valor_referencia TYPE NUMERIC(15,4);
```

Verificación:

```powershell
# PATCH 0.2664 y leer de vuelta: si vuelve 0.2664, el ALTER corrió;
# si vuelve 0.27, sigue en NUMERIC(15,2).
```

- [ ] Tras el `ALTER`, `npm run verify:ratios` sigue en `23/23`.
- [ ] Los 12 endpoints devuelven los valores de 4 decimales de §3.

---

## 7. Regresión de lo existente

- [ ] Los 9 endpoints de ratios previos siguen respondiendo.
- [ ] `/api/v1/estados-financieros`, `/api/v1/proyecciones` y `/api/v1/ventas-historicas`
      siguen respondiendo (no se tocaron, pero el build los recompila).
- [ ] `recalcularRatios` solo recorre filas de `ratio` **existentes** para la
      empresa/año: no crea ni borra filas.

---

## 8. Limitaciones conocidas (no son fallos de esta entrega)

1. **Precisión en 2 decimales** hasta correr el `ALTER` de §6.
2. **Ratios sin benchmark no se calculan.** `calculateRatio` exige
   `parametro_sector`; si una fila de `ratio` no lo tiene, el endpoint devuelve
   error y AU1 la salta en silencio. El seed siempre crea el benchmark junto con
   la fila, así que solo afecta a filas creadas a mano.
3. **Rentabilidad, DuPont y ciclos** dependen de `ESTADO_RESULTADOS`, que hoy
   tiene 0 filas. No se pueden validar contra la BD hasta que A cargue el ER.
   El simulador manual de DuPont (`/analisis/dupont`, de D) queda intacto.
4. **C4 (ABC/EOQ/punto de reorden)** no tiene modelo de datos: `venta` guarda
   fecha + monto y el inventario es una sola línea de balance (`1105`).
5. **Los benchmarks sembrados no son sectoriales.** `fuente` lo dice
   explícitamente; hay que calibrarlos con datos reales del sector.
6. **La categoría es la clave de enrutamiento.** El nombre en
   `categoria_ratio.nombre_tipo` debe coincidir exactamente con el de
   `lib/ratios.ts` y `Ratio.tsx`. Un cambio de nombre exige tocar los tres
   lugares (deuda registrada, no se refactorizó a slug en esta entrega).

---

## 9. Criterio de aceptación

Se considera aceptado cuando:

1. `npx tsc --noEmit` → `0`.
2. `npm run build` → `0`.
3. `npm run verify:ratios` → `23/23`.
4. `npm run e2e:au1` → `4/4` y limpieza completa.
5. Los 12 PUT de §3 responden `200` con los valores de la tabla.
6. La UI muestra y calcula las 4 categorías nuevas.
