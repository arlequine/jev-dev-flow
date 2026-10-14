# Kit para el hackatón: Jev en una hora

Jev es una IA que **no escribe textos: toma decisiones**. Le das un contenido (un comentario, un ticket, un documento) y preguntas cerradas. Te devuelve la respuesta y qué tan segura está. Cuesta cientos de veces menos que pedirle lo mismo a un modelo grande, y responde en décimas de segundo.

**Úsalo cuando tu proyecto necesite:** clasificar, filtrar, priorizar, enrutar, verificar o aprobar.

**No lo uses para:** redactar, resumir, explicar, hacer cuentas o comparar fechas. Para eso usa Claude o una fórmula.

---

## 1. Primera llamada en 3 pasos

1. **Consigue tu API key de TypeSafe** (la que te compartan los organizadores o la de tu cuenta en [typesafe.ai](https://typesafe.ai)).
2. **Guárdala** en tu terminal: `export TYPESAFE_API_KEY=...`
3. **Pregunta algo:**

```bash
curl https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jev-1.13.0",
    "state": { "comment": "Me cobraron dos veces y nadie me responde. Si no me regresan mi dinero, cancelo." },
    "questions": {
      "topic": { "type": "choice", "instructions": "What is the main topic of `comment`?",
                 "criteria": { "billing": "Charges or payments", "bug": "Something is broken", "praise": "Positive feedback", "other": "Anything else" } },
      "anger": { "type": "score", "instructions": "How angry is the author of `comment`?",
                 "criteria": ["Calm", "Annoyed", "Frustrated", "Furious"] },
      "will_cancel": { "type": "noul", "instructions": "Does `comment` say the customer may cancel?" }
    }
  }'
```

**Cómo leer la respuesta:**
- `topic.choice`: la opción elegida. `confidence` va de 0 a 1 y dice qué tan segura está.
- `anger.score`: un número de 0 a 3. Puede caer entre niveles, por ejemplo 2.6.
- `will_cancel.noul`: la probabilidad de "sí". Ojo: **0.5 significa "no sé", no "más o menos"**.
- `usage.input_tokens`: los tokens que se cobran. Costo = `input_tokens × 0.042 / 1,000,000` dólares (la salida es gratis).

En JavaScript usa `@typesafe-ai/sdk` y en Python `typesafe_sdk`. Ambos leen `TYPESAFE_API_KEY` y apuntan a la API de TypeSafe por defecto; solo fija `model: "jev-1.13.0"`. Hay un ejemplo en `src/shared/jev.ts`.

---

## 2. Los tres tipos de pregunta

| Tipo | Úsalo para | Ejemplo |
|---|---|---|
| `choice` | Elegir **una** opción de una lista | ¿Qué equipo atiende esto? ¿Qué tipo de documento es? |
| `score` | Ubicar algo en una **escala ordenada** | ¿Qué tan urgente es? ¿Qué tan claro está el texto? |
| `noul` | Una pregunta de **sí o no** | ¿Pide reembolso? ¿Menciona a la competencia? ¿Hay datos personales? |

### Cinco trucos que suben el acierto

1. **Una cosa por pregunta.** En vez de "¿es spam?", pregunta por separado: ¿pide contraseñas?, ¿promete un premio?, ¿mete prisa?
2. **Haz todas las preguntas en una sola llamada.** Diez preguntas juntas cuestan casi lo mismo que una.
3. **Escribe las preguntas en inglés.** El contenido puede ir en español. Jev es más preciso así.
4. **Describe bien cada opción y los casos límite.** Por ejemplo: "mencionar reembolsos con sarcasmo cuenta como false". Jev es muy literal.
5. **Las reglas van en tu código.** "Si `will_cancel` es mayor a 0.7 y `anger` es al menos 2, avisa a ventas". Cambiar la regla es más fácil que reescribir la pregunta.

---

## 3. Diez ideas de proyecto

| Área | Idea | Preguntas de Jev |
|---|---|---|
| Marketing | Radar de menciones en redes | choice: tema · noul: menciona a la competencia · score: sentimiento |
| Marketing | Revisor de copys antes de publicar | noul: promete algo que no podemos cumplir · noul: tono ofensivo · choice: público al que habla |
| UX/UI | Clasificador de feedback de usabilidad | noul: fricción de diseño · choice: pantalla afectada · score: severidad |
| UX/UI | Etiquetado de entrevistas de research | choice: necesidad del usuario · noul: menciona un workaround · score: intensidad del dolor |
| Análisis | Encuestas abiertas a datos | choice: tema · score: satisfacción · noul: sugiere una mejora concreta |
| Negocio | Alerta de cancelación | noul: riesgo de irse · score: frustración · noul: pide hablar con un humano |
| Negocio | Pre-aprobación de solicitudes (descuentos, gastos) | noul: cumple la política · noul: falta información · choice: nivel de aprobación |
| Soporte | Triage de tickets | choice: equipo · score: urgencia · noul: es duplicado de un ticket conocido |
| Producto | Ruteador de modelos | choice: tipo de tarea · score: complejidad · noul: toca dinero o datos sensibles → elegir modelo |
| Dev | Guardia de cambios de código | Un noul por riesgo (secretos, permisos, datos) → aprobar, revisar o bloquear (ver `jev-pr-review`) |

**Fórmula ganadora para tu demo:**
1. Jev decide.
2. Tu código aplica las reglas.
3. Claude escribe **solo** cuando hace falta: la respuesta al cliente, el resumen o el ticket.
4. Muestra en pantalla cuánto costó cada decisión.

---

## 4. ¿Cuánto me va a costar?

Desde este repo puedes calcularlo **sin gastar nada**:

```bash
npm run cost -- feedback:F01 --compare opus,sonnet,haiku --volume 10000
npm run cost -- ./mi-request.json --compare opus     # tu propia request: { "state": ..., "questions": ... }
```

Como referencia, clasificar 10,000 comentarios cuesta unos $0.30 USD con Jev y unos $56 USD con Opus 5.5 (estimación).

---

## 5. Checklist antes de presentar

- [ ] Fijaste el modelo `jev-1.13.0`, no `jev-latest`, para que no cambie a mitad del hackatón.
- [ ] Cada pregunta evalúa una sola cosa y todas van en una llamada.
- [ ] Lo dudoso (confianza baja o un noul cerca de 0.5) va a una persona o a un modelo más grande.
- [ ] Las cuentas, fechas y conteos los haces en código, no con Jev.
- [ ] Probaste con 10 o 20 ejemplos con la respuesta correcta conocida y sabes cuántos acierta.
- [ ] Tienes respuestas grabadas por si falla la red (`JEV_MODE=record` y `replay` en este repo).

**Límites a tener en cuenta:**
- Solo acepta texto: nada de imágenes ni audio.
- Hasta 64K tokens por llamada.
- Si te pasas del límite de solicitudes, recibes un error 429. Los SDKs reintentan solos.
