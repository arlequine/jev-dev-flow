// CLI de la demo.
//   npm run flow -- triage E01            decide un error (id de fixture o ruta a JSON)
//   npm run flow -- route P05             elige el modelo para una tarea (id o texto)
//   npm run flow -- gate pr06             evalúa un PR (id de fixture o ruta a JSON)
//   npm run flow -- run E01 [--generate]  flujo end-to-end: triage → route → (fix) → gate
//   npm run flow -- eval all --strategy jev|baseline|llm-parse|opus-all --lang en|es
//   npm run flow -- compare [--generate]  las cuatro estrategias + costo de generación
//   npm run flow -- feedback all           clasifica comentarios de clientes (ejemplo para todo público)
import { readFileSync } from "node:fs";
import { CLAUDE_MODELS, type Lang, type Tier } from "./shared/config.js";
import { errors, feedback, knownIssues, prompts, prs, type ProdError, type PullRequest } from "./shared/fixtures.js";
import { classifyFeedback } from "./modules/feedback/feedback.js";
import { newRunId, record, type Strategy } from "./shared/metrics.js";
import { issueDraft, triageError } from "./modules/log-triage/triage.js";
import { routeTask } from "./modules/model-router/router.js";
import { generateFix } from "./modules/model-router/generate.js";
import { gateComment, gatePr } from "./modules/pr-gate/gate.js";
import { evalGate, evalRouter, evalTriage, printSummary } from "./eval.js";

const args = process.argv.slice(2);
const flag = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const has = (name: string) => args.includes(`--${name}`);
const lang = (flag("lang", "en") as Lang);
const [cmd, target] = args;
const json = (o: unknown) => console.log(JSON.stringify(o, null, 2));

function loadError(t: string): ProdError {
  const f = errors().find((e) => e.id === t);
  return f ? f.error : (JSON.parse(readFileSync(t, "utf8")) as ProdError);
}
function loadPr(t: string): PullRequest {
  const f = prs().find((p) => p.id === t);
  return f ?? (JSON.parse(readFileSync(t, "utf8")) as PullRequest);
}
function loadTask(t: string): string {
  return prompts().find((p) => p.id === t)?.task ?? t;
}

async function main() {
  switch (cmd) {
    case "triage": {
      const error = loadError(target);
      const { decision, call } = await triageError(error, knownIssues(), lang);
      json({ decision, snapshot: call?.model, usage: call && { in: call.input_tokens, out: call.output_tokens, cost: call.cost_usd, ms: call.latency_ms } });
      if (decision.open_issue) json({ issue_draft: issueDraft(error, decision) });
      break;
    }
    case "route": {
      const { decision, call } = await routeTask(loadTask(target), lang);
      json({ decision, snapshot: call.model, usage: { in: call.input_tokens, cost: call.cost_usd, ms: call.latency_ms } });
      break;
    }
    case "gate": {
      const { decision, call } = await gatePr(loadPr(target), lang);
      console.log(gateComment(decision, call?.model));
      break;
    }
    case "run": {
      const error = loadError(target);
      const run_id = newRunId();
      console.log(`\n① TRIAGE ${target}`);
      const t = await triageError(error, knownIssues(), lang);
      console.log(`  → ${t.decision.team} · ${t.decision.severity} · ${t.decision.duplicate_of ?? "nuevo"} (${t.decision.reasons.join(" · ")})`);
      if (!t.decision.open_issue) {
        console.log("  Sin issue nuevo: fin del flujo.");
        break;
      }
      const draft = issueDraft(error, t.decision);
      console.log(`  → issue: "${draft.title}" (Claude lo abre vía MCP de GitHub)`);
      const task = `Fix this production issue.\n${draft.title}\n${draft.body}`;
      console.log("\n② ROUTER");
      const r = await routeTask(task, lang);
      console.log(`  → ${r.decision.tier} (${r.decision.model}) · ${r.decision.reasons.join(" · ")}`);
      if (!has("generate")) {
        console.log("\n③ GATE: usa --generate para generar el fix con la API y pasarlo por el gate.");
        break;
      }
      console.log(`\n③ FIX con ${r.decision.model}`);
      const fix = await generateFix(task, r.decision.tier);
      record({ ts: new Date().toISOString(), run_id, module: "generation", item: target, strategy: "jev", model: fix.call.model,
        input_tokens: fix.call.input_tokens, output_tokens: fix.call.output_tokens, cost_usd: fix.call.cost_usd, latency_ms: fix.call.latency_ms, decision: r.decision.tier });
      console.log(`  ${fix.summary} · ${fix.call.output_tokens} tokens · $${fix.call.cost_usd.toFixed(4)}`);
      console.log("\n④ GATE");
      const files = [...fix.diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
      const g = await gatePr({ title: draft.title, description: fix.summary, files, diff: fix.diff }, lang);
      console.log(gateComment(g.decision, g.call?.model));
      break;
    }
    case "feedback": {
      const items = target === "all" || !target ? feedback() : feedback().filter((f) => f.id === target);
      const list = items.length ? items : [{ id: "texto", channel: "manual", text: target }];
      let total = 0;
      for (const f of list) {
        const { decision, call } = await classifyFeedback(f.text, f.channel, lang);
        total += call.cost_usd;
        console.log(`\n${f.id} · "${f.text.slice(0, 70)}${f.text.length > 70 ? "…" : ""}"`);
        console.log(`  tema: ${decision.topic} · frustración ${decision.frustration}/3 · ${decision.priority}`);
        console.log(`  etiquetas: ${decision.tags.join(", ") || "—"} · enviar a: ${decision.routes.join(", ") || "—"}${decision.needs_human ? " · ⚠ revisar a mano" : ""}`);
      }
      console.log(`\n${list.length} comentarios · costo total Jev: $${total.toFixed(6)}`);
      break;
    }
    case "eval": {
      const strategy = flag("strategy", "jev") as Strategy;
      const which = target ?? "all";
      if (which === "triage" || which === "all") printSummary(await evalTriage(strategy, lang));
      if (which === "router" || which === "all") printSummary(await evalRouter(strategy, lang));
      if (which === "gate" || which === "all") printSummary(await evalGate(strategy, lang));
      break;
    }
    case "compare": {
      const strategies: Strategy[] = ["baseline", "jev", "llm-parse", "opus-all"];
      for (const s of strategies) {
        printSummary(await evalTriage(s, lang));
        printSummary(await evalRouter(s, lang));
        printSummary(await evalGate(s, lang));
      }
      if (has("generate")) await compareGeneration(lang);
      console.log("\nGenera el dashboard con: npm run dashboard");
      break;
    }
    default:
      console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(0, 8).join("\n"));
  }
}

/** Costo real de generar los 20 fixes: tier elegido por Jev vs. todo a Opus 5.5. */
async function compareGeneration(lang: Lang) {
  const run_id = newRunId();
  let routed = 0, allOpus = 0;
  for (const p of prompts()) {
    const r = await routeTask(p.task, lang);
    const plans: [Strategy, Tier][] = [["jev", r.decision.tier], ["opus-all", "opus"]];
    for (const [strategy, tier] of plans) {
      const fix = await generateFix(p.task, tier);
      if (strategy === "jev") routed += fix.call.cost_usd + r.call.cost_usd;
      else allOpus += fix.call.cost_usd;
      record({ ts: new Date().toISOString(), run_id, module: "generation", item: p.id, strategy, lang, model: CLAUDE_MODELS[tier],
        input_tokens: fix.call.input_tokens, output_tokens: fix.call.output_tokens, cost_usd: fix.call.cost_usd, latency_ms: fix.call.latency_ms,
        decision: tier, gold: p.gold, correct: tier === p.gold });
    }
  }
  console.log(`\n■ Generación de 20 fixes\n  Jev router + modelo elegido: $${routed.toFixed(4)}\n  Todo a Opus 5.5:             $${allOpus.toFixed(4)}\n  Ahorro: ${((1 - routed / allOpus) * 100).toFixed(1)}%`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
