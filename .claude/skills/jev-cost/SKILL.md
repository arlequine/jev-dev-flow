---
name: jev-cost
description: Calcula cuánto cuesta un prompt o request de Jev y lo compara con la misma decisión hecha por Claude (Opus, Sonnet o Haiku 5.5) con prompt y parseo, con proyección por volumen. Úsala cuando pregunten cuánto cuesta un prompt, cuánto se ahorra con Jev, o pidan comparar el costo de Jev contra Opus u otro modelo.
---

# jev-cost

Responde una pregunta con números: **¿cuánto cuesta esta decisión con Jev y cuánto costaría con Opus (u otro Claude)?**

Si necesitas repasar las primitivas o las reglas comunes, lee `docs/jev-basics.md`.

## Qué compara

- **Jev:** la request tal como se envía (`state` + `questions`). Solo cobra entrada (USD 0.042/1M).
- **Claude con "prompt y parseo":** el mismo state y las mismas preguntas, con el prompt de `buildJudgePrompt` (`src/shared/llm-judge.ts`). Es el mismo que usa la comparativa del dashboard. Cobra entrada y salida.

## Cómo usarla

Con el MCP `jev`, usa la tool `estimate_cost`. Desde terminal, usa `npm run cost --`.

| Qué te piden | Llamada |
|---|---|
| Costo de un módulo de la demo | `estimate_cost {ref: "gate:pr06"}`, o `triage:E11` o `route:P05` |
| Comparar con varios modelos | `compare: ["opus","sonnet","haiku"]` |
| Una request propia | `request: {state, questions}`, o `npm run cost -- ./request.json` |
| Proyección mensual | `volume: 50000` (número de requests) |

## Elegir la precisión

| precision | Qué hace | Costo de correrla | Cuándo |
|---|---|---|---|
| `estimate` (default) | Tokens ≈ caracteres/ratio, sin red | $0 | Para iterar sobre el prompt |
| `count` | Conteo **exacto** de entrada de Claude con `countTokens`; salida estimada; Jev estimado | $0 (requiere `ANTHROPIC_API_KEY`) | Para las diapositivas |
| `measure` | Llamadas reales: tokens reales de Jev (costo = entrada × 0.042/1M, la API de TypeSafe no devuelve el costo) y `usage` de Claude | Centavos | Para el número final de la charla |

Siempre di qué precisión usaste. Nunca presentes una estimación como medición.

## Cómo reportar

1. Pega la tabla de `report_markdown`.
2. Agrega una conclusión de una línea: el múltiplo frente a Jev y el costo al volumen pedido.
3. **Sé honesto con las comparaciones cercanas.** Frente a Haiku 5.5 la diferencia es de pocas veces, no de cientos. Ahí la ventaja de Jev no es solo el precio, sino:
   - probabilidades calibradas, que permiten umbrales;
   - respuestas restringidas a las opciones, sin parseo que falle;
   - cero tokens de salida.

## Cuidado

- No calcules tokens ni costos "de cabeza": usa la tool. La aritmética va en código.
- Los precios están en `src/shared/config.ts` (verificados el 2026-10-13). Si la persona menciona otro precio, señala la diferencia y no edites el archivo sin que lo pida.
- Si pasa un prompt que no es una request de Jev (texto libre), primero conviértelo a `state` + `questions` atómicas. Muéstraselo antes de calcular, porque la comparación solo es justa si ambos lados responden lo mismo.
