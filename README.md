# jev-dev-flow

Demo de la charla **"Decisiones baratas y calibradas con Jev, generación con Claude solo donde aporta valor"**.

Para audiencia mixta (negocio, análisis, UX/UI, marketing, desarrollo y hackatón). La demo empieza con un ejemplo que todos reconocen, clasificar comentarios de clientes (`npm run feedback -- all`), y luego muestra el mismo patrón en el flujo de desarrollo. Kit del hackatón: `docs/hackathon.md`.

Jev se llama directo a la **API nativa de TypeSafe** (`https://api.typesafe.ai/v1/systemone`, modelo fijado `jev-1.13.0`) con el SDK `@typesafe-ai/sdk`.

El flujo de desarrollo tiene tres módulos:

```
error de prod → [log-triage]  Jev: team (Choice) + severity (Score) + dup por candidato (Noul)
                     │        código: huella exacta, umbrales → issue vía MCP de GitHub
                     ▼
issue/tarea   → [model-router] Jev: task_type + complexity + riesgos  → código elige Haiku | Sonnet | Opus 5.5
                     │        el modelo elegido genera el fix vía API → PR vía MCP de GitHub
                     ▼
PR            → [pr-gate]     código: regex de secretos · Jev: 6 Nouls de señal + 1 de inyección
                              código: pesos + umbrales → approve | review | block (comentario + hook + CI)
```

## Estructura

```
src/shared/        cliente Jev (modelo fijado, snapshot, costo, replay), cliente Claude, métricas, fixtures
src/modules/       log-triage · model-router · pr-gate · feedback (preguntas, decisión en código, baseline)
src/eval.ts        evaluación contra gold con 4 estrategias
src/cli.ts         CLI de la demo
src/mcp/server.ts  MCP propio "jev": triage_error, route_task, solve_task, gate_pr, estimate_cost
src/dashboard/     genera dashboard/index.html desde metrics/runs.jsonl
fixtures/          12 errores + 5 issues conocidos · 12 PRs · 20 prompts · 8 comentarios de clientes (con gold y caso límite)
demo-shop/         app de ejemplo sobre la que se abren los PRs reales
src/cost/          calculadora de costo Jev vs. Claude (estimate | count | measure)
scripts/           gate-hook.ts (Claude Code) · ci-gate.ts (Actions) · seed-prs.sh · cost.ts
.claude/skills/    jev-triage · jev-model-router · jev-pr-review · jev-cost
.claude/           hook PreToolUse · comandos /gate y /cost
docs/jev-basics.md referencia común que comparten las skills
docs/charla.md     diapositivas, guion de la demo y plan B (audiencia mixta)
docs/hackathon.md  kit para el hackatón: primera llamada, plantillas, 10 ideas, checklist
```

## Puesta en marcha

```bash
npm install
cp .env.example .env   # llena TYPESAFE_API_KEY, ANTHROPIC_API_KEY, GITHUB_PAT
set -a; source .env; set +a

npm run feedback -- all               # comentarios de clientes (ejemplo para todo público)
npm run flow -- triage E11            # un error
npm run flow -- route P07             # una tarea
npm run flow -- gate pr06             # un PR
npm run flow -- run E01 --generate    # flujo completo
npm run flow -- eval all --strategy baseline
npm run flow -- compare --generate    # las 4 estrategias + costo real de 20 fixes
npm run dashboard
npm run cost -- gate:pr06 --compare opus,sonnet,haiku   # costo de un prompt de Jev vs. Claude
```

### Repo en GitHub

1. Sube este repo (rama `main`) y agrega el secret `TYPESAFE_API_KEY` en Settings → Secrets → Actions.
2. `bash scripts/seed-prs.sh` abre los PRs de la demo (pr02 inocente, pr06 exfiltración + inyección, pr07 IDOR).
3. Abre Claude Code en la raíz: carga `.mcp.json` (MCP `jev` y GitHub), las cuatro skills y el hook.

## Skills (una por paso del flujo)

| Skill | Cuándo se activa | Usa |
|---|---|---|
| `jev-triage` | Llega un error, alerta o log de producción | `triage_error` + MCP GitHub (issue o comentario) |
| `jev-model-router` | Hay que resolver un issue o elegir modelo | `solve_task` / `route_task` + MCP GitHub (PR) |
| `jev-pr-review` | Revisar, aprobar o mergear un PR | MCP GitHub (leer PR y comentar) + `gate_pr` |
| `jev-cost` | "¿Cuánto cuesta este prompt?", "¿cuánto ahorro vs. Opus?" | `estimate_cost` o `npm run cost` |

Están separadas a propósito. Claude Code solo carga el nombre y la descripción de cada skill hasta que la tarea la necesita, así que cada paso carga únicamente sus instrucciones. Lo común vive en `docs/jev-basics.md` y solo se lee si hace falta.

### Calculadora de costo

| Precisión | Qué hace | Costo de correrla |
|---|---|---|
| `estimate` | Tokens ≈ caracteres/ratio, sin red | $0 |
| `count` | Entrada exacta de Claude con `messages.countTokens` | $0 (requiere `ANTHROPIC_API_KEY`) |
| `measure` | Llamadas reales (tokens reales de Jev y `usage` de Claude) | Centavos |

## Estrategias que se comparan

| Estrategia | Qué es |
|---|---|
| `baseline` | Reglas sin modelo: huella exacta, palabras clave, regex ingenua, rutas sensibles |
| `jev` | Jev + reglas deterministas + umbrales en código (la propuesta) |
| `llm-parse` | Mismas preguntas a Sonnet 5.5 con prompt y parseo JSON; misma lógica de decisión |
| `opus-all` | Lo mismo con Opus 5.5 (y en el router: todo a Opus) |

`llm-parse` y `opus-all` reutilizan exactamente las mismas preguntas y la misma función de decisión. Así la diferencia medida es solo el modelo que decide.

## Experimento de idioma

Las `instructions` y los `criteria` existen en EN y ES. Los fixtures mezclan descripciones de PR y prompts en ambos idiomas.

```bash
npm run flow -- eval all --strategy jev --lang en
npm run flow -- eval all --strategy jev --lang es
```

## Notas

- `JEV_MODE=record` graba cada respuesta en `replays/`; `JEV_MODE=replay` las sirve sin red, que es el plan B de la charla. La llave es el hash del request: si cambias una pregunta, hay que volver a grabar.
- El hook `PreToolUse` corre en cada llamada a Bash, pero sale de inmediato si el comando no es `gh pr merge`. Ante cualquier error, el gate bloquea el merge (fail-closed).
- Los precios de Claude están en `src/shared/config.ts` (verificados el 2026-10-13). Revalídalos antes de la charla.
