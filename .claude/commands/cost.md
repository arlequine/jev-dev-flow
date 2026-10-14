---
description: Calcula el costo de una request de Jev vs. Opus (u otros modelos) con la skill jev-cost
argument-hint: <triage:E11 | route:P05 | gate:pr06 | ruta.json> [modelos] [volumen]
---

Usa la skill `jev-cost` para calcular el costo de `$ARGUMENTS`. Por defecto, compara contra Opus, Sonnet y Haiku 5.5 con precisión `count` (o `estimate` si no hay `ANTHROPIC_API_KEY`) y un volumen de 10,000 requests. Responde con la tabla y una conclusión de una línea.
