// Evaluación contra gold de los tres módulos, con las cuatro estrategias.
//   jev       → Jev + lógica en código (la propuesta)
//   baseline  → reglas sin modelo (lo que hay hoy)
//   llm-parse → mismas preguntas a Sonnet 5.5 con prompt y parseo JSON
//   opus-all  → mismas preguntas a Opus 5.5 con prompt y parseo JSON
import { CLAUDE_MODELS, type Lang } from "./shared/config.js";
import { errors, knownIssues, prompts, prs } from "./shared/fixtures.js";
import { askLlmJudge } from "./shared/llm-judge.js";
import { newRunId, record, type Strategy } from "./shared/metrics.js";
import { baselineTriage } from "./modules/log-triage/baseline.js";
import { buildTriageRequest, decideTriage, exactDuplicate, triageError } from "./modules/log-triage/triage.js";
import { baselineRoute, buildRouterRequest, decideRoute, routeTask } from "./modules/model-router/router.js";
import { baselineGate, buildGateRequest, decideGate, findSecrets, gatePr } from "./modules/pr-gate/gate.js";

const judgeModel = (s: Strategy) => (s === "opus-all" ? CLAUDE_MODELS.opus : CLAUDE_MODELS.sonnet);
const ts = () => new Date().toISOString();
const pct = (a: number, b: number) => `${a}/${b}`;

interface Summary {
  module: string;
  strategy: Strategy;
  lang: Lang;
  lines: string[];
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  p50_ms: number;
}
const p50 = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);

// ---------------- Triage ----------------
export async function evalTriage(strategy: Strategy, lang: Lang): Promise<Summary> {
  const run_id = newRunId();
  const kis = knownIssues();
  let s1Hit = 0, s1Total = 0, sevOk = 0, teamOk = 0, dupOk = 0, e08Clean = true, n = 0;
  const hardDups: string[] = [];
  let cost = 0, inTok = 0, outTok = 0;
  const lat: number[] = [];

  for (const f of errors()) {
    n++;
    let team: string, severity: string, duplicate_of: string | null, model = "rules", confidence: number | undefined;
    let detail: Record<string, unknown> = {};
    const t0 = performance.now();
    let c = { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0 };

    if (strategy === "baseline") {
      ({ team, severity, duplicate_of } = baselineTriage(f.error, kis));
      c.latency_ms = Math.round(performance.now() - t0);
    } else if (strategy === "jev") {
      const { decision, call } = await triageError(f.error, kis, lang);
      ({ team, severity, duplicate_of, confidence } = decision);
      detail = { reasons: decision.reasons, probs: decision.probs, needs_human: decision.needs_human, source: decision.source };
      if (call) { c = call; model = call.model; }
    } else {
      const exact = exactDuplicate(f.error, kis);
      if (exact) {
        team = exact.team; severity = "S3"; duplicate_of = exact.id;
      } else {
        const { state, questions } = buildTriageRequest(f.error, kis, lang);
        const call = await askLlmJudge(judgeModel(strategy), state, questions);
        const d = decideTriage(call.answers);
        ({ team, severity, duplicate_of } = d);
        c = call; model = call.model;
      }
    }

    const g = f.gold;
    if (g.severity === "S1") { s1Total++; if (severity === "S1") s1Hit++; }
    if (severity === g.severity) sevOk++;
    if (team === g.team) teamOk++;
    if (duplicate_of === g.duplicate_of) dupOk++;
    if (["E02", "E10"].includes(f.id) && duplicate_of === g.duplicate_of) hardDups.push(f.id);
    if (f.id === "E08" && duplicate_of === "KI-102") e08Clean = false;
    cost += c.cost_usd; inTok += c.input_tokens; outTok += c.output_tokens; lat.push(c.latency_ms);

    record({
      ts: ts(), run_id, module: "log-triage", item: f.id, strategy, lang, model,
      input_tokens: c.input_tokens, output_tokens: c.output_tokens, cost_usd: c.cost_usd, latency_ms: c.latency_ms,
      decision: `${team}/${severity}/${duplicate_of ?? "new"}`, gold: `${g.team}/${g.severity}/${g.duplicate_of ?? "new"}`,
      correct: severity === g.severity && team === g.team && duplicate_of === g.duplicate_of, confidence, detail,
    });
  }
  return {
    module: "log-triage", strategy, lang, cost_usd: cost, input_tokens: inTok, output_tokens: outTok, p50_ms: p50(lat),
    lines: [
      `S1 detectados: ${pct(s1Hit, s1Total)}  ${s1Hit === s1Total ? "✅" : "❌"}`,
      `Duplicados difíciles (E02, E10): ${hardDups.join(", ") || "ninguno"}  ${hardDups.length === 2 ? "✅" : "❌"}`,
      `E08 no pegado a KI-102: ${e08Clean ? "✅" : "❌"}`,
      `Severidad exacta: ${pct(sevOk, n)} · Equipo: ${pct(teamOk, n)} · Duplicado: ${pct(dupOk, n)}`,
    ],
  };
}

// ---------------- Router ----------------
export async function evalRouter(strategy: Strategy, lang: Lang): Promise<Summary> {
  const run_id = newRunId();
  let ok = 0, under = 0, over = 0, cost = 0, inTok = 0, outTok = 0;
  const lat: number[] = [];
  const order = ["haiku", "sonnet", "opus"];
  const items = prompts();

  for (const p of items) {
    let tier: string, model = "rules", confidence: number | undefined, detail: Record<string, unknown> = {};
    let c = { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0 };
    if (strategy === "baseline") tier = baselineRoute(p.task);
    else if (strategy === "jev") {
      const { decision, call } = await routeTask(p.task, lang);
      tier = decision.tier; confidence = decision.confidence; c = call; model = call.model;
      detail = { reasons: decision.reasons, probs: decision.probs };
    } else if (strategy === "opus-all") {
      tier = "opus"; // la estrategia "todo a Opus" no decide: siempre Opus
    } else {
      const { state, questions } = buildRouterRequest(p.task, lang);
      const call = await askLlmJudge(judgeModel(strategy), state, questions);
      tier = decideRoute(call.answers).tier; c = call; model = call.model;
    }
    if (tier === p.gold) ok++;
    else if (order.indexOf(tier) < order.indexOf(p.gold)) under++;
    else over++;
    cost += c.cost_usd; inTok += c.input_tokens; outTok += c.output_tokens; lat.push(c.latency_ms);
    record({
      ts: ts(), run_id, module: "model-router", item: p.id, strategy, lang, model,
      input_tokens: c.input_tokens, output_tokens: c.output_tokens, cost_usd: c.cost_usd, latency_ms: c.latency_ms,
      decision: tier, gold: p.gold, correct: tier === p.gold, confidence, detail,
    });
  }
  return {
    module: "model-router", strategy, lang, cost_usd: cost, input_tokens: inTok, output_tokens: outTok, p50_ms: p50(lat),
    lines: [
      `Nivel correcto: ${pct(ok, items.length)}  ${ok > items.length / 2 ? "✅" : "❌"}`,
      `Sub-enrutados (riesgo de calidad): ${under} · Sobre-enrutados (solo costo): ${over}`,
    ],
  };
}

// ---------------- Gate ----------------
export async function evalGate(strategy: Strategy, lang: Lang): Promise<Summary> {
  const run_id = newRunId();
  let riskyFlagged = 0, riskyTotal = 0, exact = 0, cost = 0, inTok = 0, outTok = 0;
  const falsePos: string[] = [];
  const lat: number[] = [];
  const items = prs();

  for (const pr of items) {
    let verdict: string, model = "rules", detail: Record<string, unknown> = {};
    let c = { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0 };
    if (strategy === "baseline") verdict = baselineGate(pr);
    else if (strategy === "jev") {
      const { decision, call } = await gatePr(pr, lang);
      verdict = decision.verdict; detail = { reasons: decision.reasons, signals: decision.signals, source: decision.source };
      if (call) { c = call; model = call.model; }
    } else if (findSecrets(pr.diff).length) verdict = "block";
    else {
      const { state, questions } = buildGateRequest(pr, lang);
      const call = await askLlmJudge(judgeModel(strategy), state, questions);
      verdict = decideGate(call.answers as Record<string, { noul: number }>).verdict; c = call; model = call.model;
    }
    const flagged = verdict !== "approve";
    if (pr.gold.risky) { riskyTotal++; if (flagged) riskyFlagged++; }
    else if (flagged) falsePos.push(pr.id);
    if (verdict === pr.gold.verdict) exact++;
    cost += c.cost_usd; inTok += c.input_tokens; outTok += c.output_tokens; lat.push(c.latency_ms);
    record({
      ts: ts(), run_id, module: "pr-gate", item: pr.id, strategy, lang, model,
      input_tokens: c.input_tokens, output_tokens: c.output_tokens, cost_usd: c.cost_usd, latency_ms: c.latency_ms,
      decision: verdict, gold: pr.gold.verdict, correct: flagged === pr.gold.risky, detail,
    });
  }
  const innocentsOk = !falsePos.includes("pr02") && !falsePos.includes("pr09");
  return {
    module: "pr-gate", strategy, lang, cost_usd: cost, input_tokens: inTok, output_tokens: outTok, p50_ms: p50(lat),
    lines: [
      `Recall de seguridad: ${pct(riskyFlagged, riskyTotal)}  ${riskyFlagged > 2 ? "✅" : "❌"} (baseline 2/6)`,
      `Falsos positivos: ${falsePos.join(", ") || "ninguno"}  ${innocentsOk ? "✅ pr02 y pr09 limpios" : "❌"}`,
      `Veredicto exacto: ${pct(exact, items.length)}`,
    ],
  };
}

export function printSummary(s: Summary) {
  console.log(`\n■ ${s.module} · ${s.strategy} · instrucciones ${s.lang.toUpperCase()}`);
  for (const l of s.lines) console.log(`  ${l}`);
  console.log(`  Tokens in/out: ${s.input_tokens}/${s.output_tokens} · Costo: $${s.cost_usd.toFixed(6)} · P50: ${s.p50_ms} ms`);
}
