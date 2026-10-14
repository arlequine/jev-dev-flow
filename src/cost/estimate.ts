// Calculadora de costo: cuánto cuesta una request de Jev y cuánto costaría la misma decisión
// con un modelo Claude usando "prompt y parseo".
//
// Tres niveles de precisión (se reporta cuál se usó en cada número):
//   estimate → sin red: tokens ≈ caracteres / ratio. Rápido, para iterar sobre el prompt.
//   count    → Claude: conteo exacto de entrada con messages.countTokens (gratis). Salida estimada.
//   measure  → llamada real: tokens reales de Jev (costo = input × precio) y usage real de Claude.
import Anthropic from "@anthropic-ai/sdk";
import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { CLAUDE_MODELS, CLAUDE_PRICING, JEV_MODEL, JEV_PRICE_INPUT_PER_M, claudeCost, type Lang, type Tier } from "../shared/config.js";
import { askClaude } from "../shared/claude.js";
import { askJev } from "../shared/jev.js";
import { buildJudgePrompt } from "../shared/llm-judge.js";
import { errors, feedback, knownIssues, prompts, prs } from "../shared/fixtures.js";
import { buildFeedbackRequest } from "../modules/feedback/feedback.js";
import { buildTriageRequest } from "../modules/log-triage/triage.js";
import { buildRouterRequest } from "../modules/model-router/router.js";
import { buildGateRequest } from "../modules/pr-gate/gate.js";

export type Precision = "estimate" | "count" | "measure";

/** Caracteres por token aproximados. Claude 5.5 usa un tokenizer que cuenta más tokens: ratio menor. */
const CHARS_PER_TOKEN = { jev: 3.6, claude: 3.0 };
/** Salida típica del JSON de "prompt y parseo": unos 10 tokens por pregunta + llaves. */
const estOutputTokens = (nQuestions: number) => 10 + nQuestions * 10;

export interface JevRequest {
  state: EntryType;
  questions: Questions;
}

/** Resuelve "gate:pr06", "triage:E11", "route:P07" a la request real que manda el módulo. */
export function requestFromRef(ref: string, lang: Lang = "en"): JevRequest {
  const [mod, id] = ref.split(":");
  if (mod === "triage") {
    const e = errors().find((x) => x.id === id);
    if (!e) throw new Error(`No existe el error ${id}`);
    return buildTriageRequest(e.error, knownIssues(), lang);
  }
  if (mod === "route") {
    const p = prompts().find((x) => x.id === id);
    return buildRouterRequest(p?.task ?? id, lang);
  }
  if (mod === "gate") {
    const pr = prs().find((x) => x.id === id);
    if (!pr) throw new Error(`No existe el PR ${id}`);
    return buildGateRequest(pr, lang);
  }
  if (mod === "feedback") {
    const fb = feedback().find((x) => x.id === id);
    return buildFeedbackRequest(fb?.text ?? id, fb?.channel ?? "unknown", lang);
  }
  throw new Error(`Referencia inválida "${ref}". Usa triage:E01, route:P05, gate:pr06 o feedback:F01.`);
}

export interface CostLine {
  model: string;
  precision: Precision;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  vs_jev: number; // múltiplo respecto a Jev
}

export async function estimateCost(
  req: JevRequest,
  opts: { compare?: Tier[]; precision?: Precision } = {},
): Promise<{ jev: CostLine; others: CostLine[]; questions: number }> {
  const precision = opts.precision ?? "estimate";
  const compare = opts.compare ?? ["opus"];
  const nQ = Object.keys(req.questions).length;

  // --- Jev ---
  let jev: CostLine;
  if (precision === "measure") {
    const call = await askJev(req.state, req.questions);
    jev = { model: call.model, precision, input_tokens: call.input_tokens, output_tokens: call.output_tokens, cost_usd: call.cost_usd, vs_jev: 1 };
  } else {
    const chars = JSON.stringify({ model: JEV_MODEL, ...req }).length;
    const input_tokens = Math.ceil(chars / CHARS_PER_TOKEN.jev);
    jev = { model: JEV_MODEL, precision: "estimate", input_tokens, output_tokens: 0, cost_usd: (input_tokens * JEV_PRICE_INPUT_PER_M) / 1e6, vs_jev: 1 };
  }

  // --- Claude con prompt y parseo ---
  const { system, user } = buildJudgePrompt(req.state, req.questions);
  const others: CostLine[] = [];
  for (const tier of compare) {
    const model = CLAUDE_MODELS[tier];
    let input_tokens: number, output_tokens: number, used: Precision = precision;
    if (precision === "measure") {
      const call = await askClaude(model, system, user, 1024);
      ({ input_tokens, output_tokens } = call);
    } else if (precision === "count") {
      const r = await new Anthropic().messages.countTokens({ model, system, messages: [{ role: "user", content: user }] });
      input_tokens = r.input_tokens;
      output_tokens = estOutputTokens(nQ);
    } else {
      input_tokens = Math.ceil((system.length + user.length) / CHARS_PER_TOKEN.claude);
      output_tokens = estOutputTokens(nQ);
      used = "estimate";
    }
    const cost_usd = claudeCost(model, input_tokens, output_tokens);
    others.push({ model, precision: used, input_tokens, output_tokens, cost_usd, vs_jev: cost_usd / jev.cost_usd });
  }
  return { jev, others, questions: nQ };
}

/** Tabla Markdown con proyección por volumen. */
export function costReport(r: Awaited<ReturnType<typeof estimateCost>>, volume = 10_000): string {
  const usd = (x: number) => `$${x.toFixed(x < 0.001 ? 6 : x < 1 ? 4 : 2)}`;
  const rows = [r.jev, ...r.others]
    .map(
      (l) =>
        `| ${l.model} | ${l.precision} | ${l.input_tokens} | ${l.output_tokens} | ${usd(l.cost_usd)} | ${usd(l.cost_usd * volume)} | ${l.vs_jev === 1 ? "1×" : `${l.vs_jev.toFixed(0)}×`} |`,
    )
    .join("\n");
  const notes = [
    `Request con ${r.questions} preguntas. Jev cobra solo entrada (USD ${JEV_PRICE_INPUT_PER_M}/1M); Claude cobra entrada y salida.`,
    `Precios Claude usados: ${Object.entries(CLAUDE_PRICING).map(([m, p]) => `${m} ${p.input}/${p.output}`).join(" · ")} USD por 1M.`,
    r.others.some((o) => o.precision !== "measure") ? "Salida de Claude estimada (~10 tokens por pregunta). Usa --precision measure para el número real." : "",
  ].filter(Boolean);
  return `| Modelo | Precisión | Tokens in | Tokens out | Costo por request | Costo × ${volume.toLocaleString("es-MX")} | vs. Jev |\n|---|---|---|---|---|---|---|\n${rows}\n\n${notes.map((n) => `- ${n}`).join("\n")}`;
}
