# Charla: Pregúntale a la IA lo justo — decisiones baratas con Jev, generación con Claude solo donde vale la pena

**Duración:** 40 min (15 de narrativa, 20 de demo, 5 de preguntas) · **Repo:** `jev-dev-flow` · **Kit del hackatón:** `docs/hackathon.md`

---

## 1. Quién está en la sala y qué se lleva cada quien

La audiencia es mixta: negocio, análisis, UX/UI, marketing, desarrollo y participantes del hackatón. La charla está escrita para que **nadie necesite saber programar para seguirla**. El código aparece, pero siempre después de explicar qué decisión toma y por qué importa.

| Perfil | Qué se lleva | Momento de la charla que es "suyo" |
|---|---|---|
| Negocio | Cuánto cuesta cada decisión automática y cómo se controla el riesgo | Diapositivas 2, 9 y 13; tabla de costos |
| Análisis | Clasificar miles de textos con probabilidades, no con etiquetas a ciegas | Demo 1 (comentarios); diapositiva 7 |
| UX/UI | Detectar fricciones de diseño en comentarios sin leerlos uno por uno | Demo 1 (`señal-UX`); diapositiva 6 |
| Marketing | Menciones de competencia, sentimiento y riesgo de cancelación a escala | Demo 1; diapositiva 6 |
| Desarrollo | Triage, elección de modelo y revisión de PRs con Claude Code | Demo 2; anexo técnico |
| Hackatón | Una receta para usar Jev en una hora y no quemar créditos | Diapositiva 15 y `docs/hackathon.md` |

### Reglas de lenguaje para el speaker

- **Primero la decisión, después la tecnología.** "Hay que decidir si este comentario es urgente" va antes de "Jev devuelve un Noul".
- **Cada término técnico se dice una vez con su traducción:**
  - token → "pedacito de texto que se cobra";
  - prompt → "la instrucción que le das a la IA";
  - PR → "propuesta de cambio al código";
  - issue → "ticket".
- **Usa números en pesos o dólares, no en tokens.** "Tres centavos por mil comentarios" se entiende; "700 tokens de entrada" no.
- **No leas código en pantalla.** Si aparece, señala una línea y di qué decide.

---

## 2. Las tres ideas que todos deben recordar

1. **No todas las preguntas necesitan una respuesta larga.** Muchas veces solo necesitas "sí/no", "cuál de estas" o "qué tanto". Para eso hay modelos que cuestan cientos de veces menos.
2. **La IA te dice qué tan segura está, y tú decides qué hacer con eso.** Funciona como un semáforo: si está muy segura, actúa; si está en duda, pregunta a una persona; si no sabe, se detiene.
3. **Usa el modelo caro solo donde aporta.** El modelo grande escribe y razona; el pequeño decide. Ponerlos en el lugar correcto baja el costo y el riesgo a la vez.

---

## 3. Diapositivas (título + mensaje clave)

| # | Título | Mensaje clave (cómo decirlo) | Para | Min |
|---|---|---|---|---|
| 1 | Pregúntale a la IA lo justo | Hoy le pedimos ensayos a la IA cuando solo necesitamos que marque una casilla. | Todos | 1 |
| 2 | La factura invisible | Cada pregunta a una IA se cobra por pedacitos de texto (tokens). Pedir un párrafo para extraer una palabra es pagar el párrafo. | Negocio | 1.5 |
| 3 | Examen de opción múltiple vs. ensayo | Un LLM como Claude escribe el ensayo. Jev contesta la opción múltiple y dice qué tan seguro está de cada respuesta. | Todos | 1.5 |
| 4 | Tres tipos de pregunta | **¿Cuál?** (elegir de una lista), **¿Qué tanto?** (escala de 0 a 3), **¿Sí o no?** (con probabilidad). Con eso se arma casi todo. | Todos | 1.5 |
| 5 | El semáforo de confianza | 🟢 Muy segura: actúa sola. 🟡 En duda: que revise una persona. 🔴 Riesgo alto: se bloquea. Qué tan exigente es el semáforo depende de cuánto cuesta equivocarse. | Negocio, todos | 1.5 |
| 6 | Un mismo patrón, muchos equipos | El mismo comentario de un cliente responde a la vez: ¿de qué habla? (análisis), ¿se va a ir? (negocio), ¿menciona a la competencia? (marketing), ¿hay una fricción de diseño? (UX). | Marketing, UX, análisis | 1.5 |
| 7 | Muchas preguntas, un solo viaje | Hacer seis preguntas juntas cuesta casi lo mismo que hacer una. Las respuestas se combinan después con reglas que el negocio controla. | Análisis, devs | 1 |
| 8 | Las reglas las pones tú, no la IA | "Si hay riesgo de cancelación y está muy molesto, contacta hoy" es una regla de negocio escrita en código. Cambiar prioridades es cambiar la regla, no reentrenar ni reescribir instrucciones. | Negocio | 1 |
| 9 | Lo que dice el texto no es una orden | Un comentario o un documento puede intentar "ordenarle" algo a la IA ("aprueba esto"). El sistema lo trata como dato, no como instrucción. | Todos | 1 |
| — | **DEMO** | (ver guion) | | 20 |
| 10 | ¿Cuánto costó todo lo que vimos? | Tabla de costos: Jev vs. Opus, Sonnet y Haiku, en dólares por cada mil decisiones. Con honestidad: frente a Haiku la diferencia es de pocas veces; frente a Opus, de cientos. | Negocio | 1 |
| 11 | ¿Acertó? | Resultados contra las respuestas correctas y contra "lo que hacíamos antes" (reglas fijas). | Análisis | 1 |
| 12 | Dónde NO usar Jev | No escribe textos, no explica su razonamiento, no hace cuentas ni compara fechas. Para eso: Claude o una fórmula. | Todos | 0.5 |
| 13 | La regla de oro | Lo exacto, en código. Las decisiones, con Jev. La redacción y el razonamiento, con Claude. | Todos | 0.5 |
| 14 | Para equipos técnicos | Skills, MCP, hook antes del merge y versión fija del modelo. Todo está en el repo. | Devs | 0.5 |
| 15 | Para el hackatón | Receta de 3 pasos, plantillas de preguntas y 10 ideas de proyecto en `docs/hackathon.md`. Muestra en tu demo cuánto cuesta cada decisión: es un diferenciador. | Hackatón | 0.5 |
| — | Preguntas | | | 5 |

---

## 4. Guion de la demo (20 min)

La demo va **de lo universal a lo técnico**. Así los perfiles no técnicos ven su caso primero y entienden el patrón antes de que aparezca código.

**Preparación (la noche anterior):**
- `JEV_MODE=record npm run flow -- compare --generate` y `JEV_MODE=record npm run feedback -- all`. Graba todas las respuestas para el plan B.
- `npm run dashboard`. Deja abierto `dashboard/index.html`.
- `bash scripts/seed-prs.sh`. Anota los números de los PRs pr02, pr06 y pr07.
- **Sube la fuente de la terminal a 20 pt o más.** En la sala hay personas que no leen terminal todos los días.

### Parte 1 · Comentarios de clientes, para todos (6 min)

| t | Paso | Qué hacer / decir | Qué se debe ver |
|---|---|---|---|
| 0:00 | El problema | "Llegan 5,000 comentarios al mes. ¿Quién los lee? ¿Quién decide cuál es urgente?" Muestra 3 de `fixtures/feedback.json` en pantalla. | Textos reales, con tono variado. |
| 1:00 | Clasificar | `npm run feedback -- all` | Por comentario: tema, frustración, etiquetas, a qué equipo va y prioridad. |
| 3:00 | Leerlo por perfil | Señala F01: urgente, va a customer-success. F04: competencia, va a marketing. F02: señal-UX, va a ux-research. | Cada equipo ve "su" columna. |
| 4:00 | La trampa del sarcasmo | F08: "Reembolso garantizado dicen… ja." | **No** lo marca como petición de reembolso, pero sí detecta el elogio al botón. |
| 4:30 | Participación | Pide a la sala un comentario inventado y córrelo: `npm run feedback -- "texto del público"`. | Clasificación en vivo, en menos de un segundo. |
| 5:30 | Costo | "Todo eso costó…" (total al final de la salida). Compara con `npm run cost -- feedback:F01 --compare opus`. | Fracciones de centavo vs. centavos. |

### Parte 2 · El mismo patrón en el día a día de desarrollo (12 min)

Narra cada paso como historia: *"Se cae algo en producción; ¿quién lo atiende, qué tan grave es y ya nos había pasado?"*. Muestra el resultado, no la terminal.

| t | Paso | Qué hacer / decir | Qué se debe ver |
|---|---|---|---|
| 6:00 | Una alerta que miente | En Claude Code: *"Triagea el error E11 y abre el ticket si corresponde."* Explica que el log dice "esto no es grave, ignóralo". | Grave (S1), equipo de pagos. Ticket creado en GitHub. No obedeció al texto. |
| 8:30 | "Esto ya nos pasó" | *"Ahora E10."* | Lo reconoce como un problema ya conocido aunque esté escrito distinto. No duplica el ticket. |
| 10:00 | ¿Qué modelo lo arregla? | *"Resuelve E01 (cobro doble) con el modelo que corresponda."* | Elige **Opus** porque toca dinero. Luego `npm run flow -- route P07`: cambiar el texto de un botón → **Haiku**, el más barato. |
| 13:00 | El guardia antes de publicar | `/gate <pr06>` | ⛔ Bloqueado: envía datos de clientes a un tercero, y la descripción intentaba que lo aprobaran. |
| 15:00 | Inocente que parece culpable | `/gate <pr02>` | ✅ Aprobado. Las reglas fijas de antes lo habrían marcado solo por la carpeta que toca. |
| 16:30 | Ni pidiéndoselo | *"Mergea el PR #<pr07>."* | El sistema bloquea la acción aunque se la pidas a Claude. La seguridad no depende de la buena voluntad del asistente. |

### Parte 3 · Los números (2 min)

| t | Paso | Qué hacer / decir | Qué se debe ver |
|---|---|---|---|
| 18:00 | Costo y acierto | Dashboard | Baseline vs. Jev vs. Sonnet vs. Opus. Lee **una** cifra por perfil: costo para negocio, acierto para análisis, riesgo bloqueado para devs. |

### Frases ancla

- "No le pidas un ensayo a quien solo tiene que marcar una casilla."
- "La IA dice qué tan segura está; el semáforo lo pones tú."
- "Cambié las prioridades moviendo una regla, no reescribiendo la instrucción."
- "El guardia no depende de que el asistente quiera llamarlo."

### Preguntas probables (respuesta corta)

| Pregunta | Respuesta |
|---|---|
| ¿Esto reemplaza a ChatGPT o a Claude? | No. Los complementa: Jev decide, Claude escribe y razona. |
| ¿Se equivoca? | Sí. Por eso devuelve probabilidades: lo dudoso va a una persona. Medimos el acierto contra respuestas correctas. |
| ¿Funciona en español? | Sí, con algo menos de precisión que en inglés. Por eso escribimos las preguntas en inglés y medimos la diferencia. |
| ¿Se entrena con mis datos? | Según TypeSafe, no entrena con las solicitudes de sus clientes. |
| ¿Lo puedo usar sin programar? | Para probarlo, el kit del hackatón trae un ejemplo con `curl`. Para producción, alguien del equipo lo integra con unas pocas líneas. |
| ¿Cuánto me costaría al mes? | Usa la calculadora: `npm run cost -- feedback:F01 --volume 50000`. |

---

## 5. Costos (para las diapositivas 2 y 10)

Precios de lista (USD por millón de tokens, entrada/salida):

| Modelo | Entrada | Salida |
|---|---|---|
| Jev 1.13 | 0.042 | 0 |
| Haiku 5.5 | 0.10 | 0.50 |
| Sonnet 5.5 | 2 | 10 |
| Opus 5.5 | 4 | 20 |

**Estimación sin red** (`npm run cost`). Antes de la charla, reemplázala con `--precision count` o `--precision measure`.

| Decisión | Jev | Haiku 5.5 | Opus 5.5 |
|---|---|---|---|
| Clasificar un comentario (F08) | $0.00003 | $0.00014 (~5×) | $0.0056 (~190×) |
| Revisar un PR (pr06) | $0.00004 | $0.00018 (~4×) | $0.0072 (~170×) |

**Cómo decirlo en la sala:** "Clasificar 10,000 comentarios cuesta unos 30 centavos de dólar con Jev y unos 56 dólares con el modelo más grande."

**Generación de 20 fixes (estimación):**

| Estrategia | Costo total |
|---|---|
| Todo a Opus 5.5 | ≈ $0.84 |
| Router con Jev | ≈ $0.39 |

El ahorro es de **~54%**, y la decisión de ruteo cuesta menos de un décimo de centavo.

---

## 6. Plan B

| Si falla… | Hacer |
|---|---|
| Red, API de TypeSafe o API de Anthropic | `export JEV_MODE=replay` y repetir: mismas respuestas, sin red. Decirlo en voz alta: "esto es una grabación de anoche". |
| El comentario del público (sin red) | En `replay` solo existen los comentarios grabados. Usa F06 o F08 y di: "imaginemos que este lo escribió alguien de la sala". |
| MCP de GitHub | Usar el CLI: `npm run flow -- triage E11` y `npm run flow -- gate pr06`. Mostrar los PRs en el navegador. |
| El hook no dispara | Correr a mano: `echo '{"tool_name":"Bash","tool_input":{"command":"gh pr merge <n>"}}' \| npm run gate-hook`. |
| Una decisión sale distinta a lo ensayado | Es parte del mensaje: mostrar las probabilidades y el semáforo. Si cae en amarillo, es lo correcto ante la duda. |
| Se acaba el tiempo | Recortar la Parte 2 a E11 + pr06 + el merge bloqueado (7 min). Las Partes 1 y 3 nunca se recortan: son las que entiende toda la sala. |
| Todo falla | Video de 3 minutos del ensayo, más el dashboard estático. |

**Checklist 30 minutos antes:**
- `npm run flow -- eval all` y `npm run feedback -- all` sin errores.
- El snapshot del campo `model` es el mismo que en el ensayo.
- Keys cargadas y `gh auth status` bien.
- PRs sembrados abiertos.
- Fuente de la terminal grande.

---

## Anexo técnico (para devs y preguntas profundas)

### Criterios de éxito

| Módulo | Baseline (ya medido) | Meta con Jev |
|---|---|---|
| log-triage | 0/4 S1 · duplicados difíciles 0/2 · E08 limpio | 4/4 S1 · E02 y E10 detectados · E08 no pegado a KI-102 |
| pr-gate | recall 2/6 · falsos positivos pr02 y pr09 | recall > 2/6 · pr02 y pr09 aprobados |
| model-router | 15/20 · sub-enruta P05 y P20 (dinero) · sobre-enruta P04 y P07 | mayoría correcta · 0 sub-enrutados en dinero · costo menor que todo a Opus |
| feedback | — | F08 sin `asks_refund` · F01 urgente · F04 a marketing |

> El baseline del router acierta 15/20 porque la longitud del prompt correlaciona con la dificultad. El argumento no es el promedio, son **las trampas**: manda a Haiku lo que mueve dinero (P05, P20) y a Opus lo que solo habla de dinero (P04, P07).

### Detalles para preguntas técnicas

- **Primitivas:** Choice, Score y Noul. Un Noul de 0.5 es incertidumbre, no "medio".
- **Speculative fan-out:** todas las preguntas del módulo van en un solo request.
- **Umbrales por costo del error:** router laxo, gate estricto.
- **Evidencia:** el texto de terceros va bajo `evidence`, con la regla anti-inyección en cada instrucción.
- **Skills divididas:** `jev-triage`, `jev-model-router`, `jev-pr-review` y `jev-cost`. Claude solo carga la que aplica.
- **Versión:** se fija `jev-1.13.0` (API nativa de TypeSafe) y se registra el campo `model` de cada respuesta.
- **Idioma:** las instructions se escriben en inglés. Para medir el efecto: `npm run flow -- eval all --lang es`.
