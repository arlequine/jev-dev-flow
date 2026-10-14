// Estrategia de comparación "todo a un LLM con prompt y parseo".
// Mismo state y mismas preguntas que Jev, pero vía Claude + JSON. Devuelve answers con la forma de Jev
// para reutilizar EXACTAMENTE la misma lógica de decisión (comparación justa).
// Diferencia clave que se ve en la charla: aquí no hay probabilidades calibradas (todo es 0 o 1)
// y sí se pagan tokens de salida.
import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { askClaude, parseJsonLoose } from "./claude.js";
import type { JevCall } from "./jev.js";

export const JUDGE_SYSTEM = `You are a strict classifier. Answer every question about the STATE.
Rules:
- choice: answer with exactly one of the listed labels.
- score: answer with the integer index of the level (0 = first level listed).
- noul: answer true or false.
Return ONLY a JSON object {"<question_id>": <answer>, ...}. No prose.`;

/** El prompt equivalente que un LLM necesitaría para responder lo mismo que Jev. */
export function buildJudgePrompt(state: EntryType, questions: Questions) {
  return { system: JUDGE_SYSTEM, user: `STATE:\n${JSON.stringify(state, null, 2)}\n\nQUESTIONS:\n${JSON.stringify(questions, null, 2)}` };
}

export async function askLlmJudge<const Q extends Questions>(
  model: string,
  state: EntryType,
  questions: Q,
): Promise<JevCall<Q>> {
  const { system, user } = buildJudgePrompt(state, questions);
  const call = await askClaude(model, system, user, 1024);
  const raw = parseJsonLoose(call.text);
  const answers: Record<string, unknown> = {};
  for (const [id, q] of Object.entries(questions)) {
    const v = raw[id];
    if (q.type === "noul") {
      answers[id] = { type: "noul", noul: v === true || v === "true" ? 1 : 0 };
    } else if (q.type === "choice") {
      const labels = Object.keys(q.criteria);
      const choice = labels.includes(String(v)) ? String(v) : labels[labels.length - 1];
      answers[id] = {
        type: "choice",
        choice,
        confidence: 1,
        probabilities: Object.fromEntries(labels.map((l) => [l, l === choice ? 1 : 0])),
      };
    } else {
      const n = q.criteria.length;
      const idx = Math.max(0, Math.min(n - 1, Math.round(Number(v) || 0)));
      answers[id] = {
        type: "score",
        score: idx,
        confidence: 1,
        probabilities: Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), i === idx ? 1 : 0])),
        legend: {},
      };
    }
  }
  return {
    answers: answers as JevCall<Q>["answers"],
    model: call.model,
    input_tokens: call.input_tokens,
    output_tokens: call.output_tokens,
    cost_usd: call.cost_usd,
    latency_ms: call.latency_ms,
  };
}
