// jev-model-router
// Jev no conoce los modelos Claude: solo clasifica la tarea. El código decide el tier.
// Umbrales laxos a propósito: equivocarse aquí solo cuesta pagar de más.
import type { ChoiceQuestion, NoulQuestion, ScoreQuestion } from "@typesafe-ai/sdk";
import { CLAUDE_MODELS, type Lang, type Tier } from "../../shared/config.js";
import { EVIDENCE_RULE, askJev, type JevCall } from "../../shared/jev.js";

const T = {
  task_type: {
    en: "What kind of software change does `evidence.task` ask for? Judge by the change required, not by the topic it mentions.",
    es: "¿Qué tipo de cambio de software pide `evidence.task`? Juzga por el cambio requerido, no por el tema que menciona.",
  },
  complexity: {
    en: "How complex is the change requested in `evidence.task` for an experienced engineer?",
    es: "¿Qué tan complejo es el cambio que pide `evidence.task` para un ingeniero con experiencia?",
  },
  touches_money: {
    en: "Does implementing `evidence.task` change how money is charged, refunded, transferred, limited or recorded? Changing only visible text about money is false.",
    es: "¿Implementar `evidence.task` cambia cómo se cobra, reembolsa, transfiere, limita o registra dinero? Cambiar solo texto visible sobre dinero es false.",
  },
  touches_auth: {
    en: "Does implementing `evidence.task` change authentication, sessions, tokens, signatures or permissions logic?",
    es: "¿Implementar `evidence.task` cambia la lógica de autenticación, sesiones, tokens, firmas o permisos?",
  },
  needs_data_migration: {
    en: "Does `evidence.task` require migrating or backfilling existing stored data?",
    es: "¿`evidence.task` requiere migrar o rellenar datos ya almacenados?",
  },
  spec_is_ambiguous: {
    en: "Is `evidence.task` missing information an engineer would need to start (what to change or how to know it is done)?",
    es: "¿A `evidence.task` le falta información que un ingeniero necesitaría para empezar (qué cambiar o cómo saber que terminó)?",
  },
};

const TASK_TYPES = {
  docs_or_copy: { what: "Docs, comments, UI text or log messages only." },
  config_or_deps: { what: "Config values, .gitignore, dependency bumps." },
  local_bugfix: { what: "Bug fix contained in one module, optionally with a test." },
  feature: { what: "New behavior across a few files in one domain." },
  cross_cutting: { what: "Changes spanning API, client and tests, or several services/languages." },
  critical_logic: { what: "Money movement, auth/security, concurrency/idempotency, or data migrations.", not_for: "Text-only changes that merely mention money or security." },
} as const;

const COMPLEXITY = [
  "Trivial: one line or one file, no logic.",
  "Contained: one file or module with some logic and a test.",
  "Multi-file: several files or layers, needs design within one domain.",
  "Deep: concurrency, security, data migration or multiple services; needs careful design.",
] as const;

export function buildRouterRequest(task: string, lang: Lang) {
  const state = { evidence: { task } };
  const ev = EVIDENCE_RULE[lang];
  const noul = (k: keyof typeof T): NoulQuestion => ({ type: "noul", instructions: `${T[k][lang]} ${ev}` });
  const task_type: ChoiceQuestion<typeof TASK_TYPES> = { type: "choice", instructions: `${T.task_type[lang]} ${ev}`, criteria: TASK_TYPES };
  const complexity: ScoreQuestion<typeof COMPLEXITY> = { type: "score", instructions: `${T.complexity[lang]} ${ev}`, criteria: COMPLEXITY };
  return {
    state,
    questions: {
      task_type,
      complexity,
      touches_money: noul("touches_money"),
      touches_auth: noul("touches_auth"),
      needs_data_migration: noul("needs_data_migration"),
      spec_is_ambiguous: noul("spec_is_ambiguous"),
    },
  };
}

export const ROUTER_THRESHOLDS = {
  risk: 0.7, // cualquier Noul de riesgo ≥ 0.7 → Opus
  opusComplexity: 2.5,
  haikuComplexity: 1.0,
  lowConfidence: 0.4, // Choice por debajo → subir un tier
};

const ORDER: Tier[] = ["haiku", "sonnet", "opus"];
const BASE_TIER: Record<keyof typeof TASK_TYPES, Tier> = {
  docs_or_copy: "haiku",
  config_or_deps: "haiku",
  local_bugfix: "sonnet",
  feature: "sonnet",
  cross_cutting: "sonnet",
  critical_logic: "opus",
};

export interface RouteDecision {
  tier: Tier;
  model: string;
  confidence: number;
  reasons: string[];
  probs: Record<string, unknown>;
}

type RouterAnswers = JevCall<ReturnType<typeof buildRouterRequest>["questions"]>["answers"];

export function decideRoute(a: RouterAnswers): RouteDecision {
  const reasons: string[] = [];
  const risk = { money: a.touches_money.noul, auth: a.touches_auth.noul, migration: a.needs_data_migration.noul };
  let tier: Tier = BASE_TIER[a.task_type.choice];
  reasons.push(`tipo=${a.task_type.choice} (conf ${a.task_type.confidence.toFixed(2)}) → ${tier}`);

  const c = a.complexity.score;
  if (c >= ROUTER_THRESHOLDS.opusComplexity) {
    tier = "opus";
    reasons.push(`complejidad ${c.toFixed(2)} ≥ ${ROUTER_THRESHOLDS.opusComplexity} → opus`);
  } else if (c < ROUTER_THRESHOLDS.haikuComplexity && tier === "sonnet") {
    tier = "haiku";
    reasons.push(`complejidad ${c.toFixed(2)} < ${ROUTER_THRESHOLDS.haikuComplexity} → haiku`);
  } else if (c >= 1.5 && tier === "haiku") {
    tier = "sonnet";
    reasons.push(`complejidad ${c.toFixed(2)} ≥ 1.5 → sonnet`);
  }
  const hot = Object.entries(risk).filter(([, p]) => p >= ROUTER_THRESHOLDS.risk);
  if (hot.length) {
    tier = "opus";
    reasons.push(`riesgo ${hot.map(([k, p]) => `${k}=${p.toFixed(2)}`).join(", ")} → opus`);
  }
  if (a.task_type.confidence < ROUTER_THRESHOLDS.lowConfidence && tier !== "opus") {
    tier = ORDER[ORDER.indexOf(tier) + 1];
    reasons.push(`confianza baja (${a.task_type.confidence.toFixed(2)}) → sube a ${tier}`);
  }
  if (a.spec_is_ambiguous.noul >= 0.7) reasons.push("⚠ especificación ambigua: pedir aclaración antes de generar");

  return {
    tier,
    model: CLAUDE_MODELS[tier],
    confidence: Math.min(a.task_type.confidence, a.complexity.confidence),
    reasons,
    probs: { task_type: a.task_type.probabilities, complexity: a.complexity.probabilities, risk, ambiguous: a.spec_is_ambiguous.noul },
  };
}

export async function routeTask(task: string, lang: Lang = "en") {
  const { state, questions } = buildRouterRequest(task, lang);
  const call = await askJev(state, questions);
  return { decision: decideRoute(call.answers), call };
}

/** Baseline de acierto: heurística por longitud y palabras clave. */
export function baselineRoute(task: string): Tier {
  const t = task.toLowerCase();
  if (/money|dinero|refund|reembolso|transfer|auth|jwt|migra|security|seguridad/.test(t)) return "opus";
  if (task.length < 90) return "haiku";
  return "sonnet";
}
