---
name: jev-model-router
description: Elige qué modelo Claude (Haiku 5.5, Sonnet 5.5 u Opus 5.5) debe resolver una tarea de código según su tipo, complejidad y riesgo, usando Jev, y genera el fix vía API con el modelo elegido. Úsala cuando haya que resolver un issue, implementar un cambio o decidir "qué modelo uso para esto".
---

# jev-model-router

Pagar Opus para cambiar un texto es tirar dinero. Pagar Haiku para tocar cobros es arriesgar calidad. Esta skill decide el modelo con **una request de Jev de fracciones de centavo** y deja la generación cara solo para cuando aporta.

Si necesitas repasar las primitivas o las reglas comunes, lee `docs/jev-basics.md`.

## Flujo

1. **Reúne contexto mínimo:** la descripción de la tarea (o el issue) y el contenido de los archivos de `demo-shop/` que la tarea toca. Nada más: el contexto de más se paga dos veces.
2. **Llama a `solve_task`** (MCP `jev`) con `task` y `files`. Por dentro:
   - Jev clasifica la tarea.
   - El código elige el tier.
   - El modelo elegido genera el diff vía la API de Anthropic.
   - Si solo quieres la decisión, sin generar, usa `route_task`.
3. **Si `routing.reasons` dice que la especificación es ambigua,** detente y pregunta antes de generar.
4. **Muestra la decisión** en una línea: tier, modelo y la razón principal. Agrega el costo de decidir (Jev) frente al de generar (modelo).
5. **Aplica el diff** en una rama `fix/<issue>`, haz commit y abre el PR con el MCP de GitHub. En el cuerpo del PR van el resumen, el tier y sus razones.
6. El PR pasa después por la skill `jev-pr-review`. No lo mergees desde aquí.

## Qué pregunta Jev (un solo request)

| ID | Primitiva | Qué decide |
|---|---|---|
| `task_type` | Choice | docs_or_copy, config_or_deps, local_bugfix, feature, cross_cutting o critical_logic |
| `complexity` | Score (4 niveles) | Trivial → contenido → multi-archivo → profundo |
| `touches_money` | Noul | ¿Cambia cómo se cobra, transfiere o registra dinero? (Solo texto sobre dinero = false) |
| `touches_auth` | Noul | ¿Cambia lógica de auth, sesiones, tokens o firmas? |
| `needs_data_migration` | Noul | ¿Requiere migrar datos existentes? |
| `spec_is_ambiguous` | Noul | ¿Falta información para empezar? |

## Reglas en código

Viven en `ROUTER_THRESHOLDS` y `BASE_TIER`.

1. **Tier base:** sale del `task_type`.
2. **Complejidad:** si es ≥ 2.5, Opus. Si es < 1, baja de Sonnet a Haiku. Si es ≥ 1.5, sube de Haiku a Sonnet.
3. **Riesgo:** cualquier riesgo (dinero, auth o migración) ≥ 0.7 manda a **Opus**.
4. **Confianza baja:** si la confianza del `task_type` es < 0.4, sube un tier.

Los umbrales son laxos a propósito: aquí equivocarse solo cuesta pagar de más. El gate de PRs es el que es estricto.

## Cuidado

- **No cambies el tier por tu cuenta.** Si crees que está mal, dilo. Usa `force_tier` solo si la persona lo pide.
- **Trampas de la demo:**
  - P07 ("texto del botón de reembolso") → Haiku.
  - P18 ("límite diario de transferencias por tenant") → Opus.
  - P13 ("paginación") → Sonnet, aunque suene simple.
- **Si quieres saber cuánto costaría la tarea con otro modelo,** usa la skill `jev-cost`.
