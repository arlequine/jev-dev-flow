// jev-log-triage
// 1) Código: huella exacta → duplicado sin llamar a Jev.
// 2) Jev (1 request): team (Choice) + severity (Score) + un Noul por issue conocido candidato.
// 3) Código: decide duplicado / severidad / si abrir issue.
import type { ChoiceQuestion, NoulQuestion, ScoreQuestion } from "@typesafe-ai/sdk";
import type { Lang } from "../../shared/config.js";
import type { KnownIssue, ProdError, Severity, Team } from "../../shared/fixtures.js";
import { EVIDENCE_RULE, askJev, noulConfidence, type JevCall } from "../../shared/jev.js";

// ---------- Determinista ----------

/** Normaliza para que IDs, números y líneas no cambien la huella. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/:\d+(:\d+)?\)?/g, "")
    .replace(/\b[0-9a-f]{8,}\b/g, "#")
    .replace(/\d+(\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim();

export const fingerprint = (e: { service: string; type: string; message: string; top_frame: string }) =>
  [e.service, e.type, norm(e.message), norm(e.top_frame)].join("|");

export function exactDuplicate(error: ProdError, kis: KnownIssue[]): KnownIssue | undefined {
  const fp = fingerprint(error);
  return kis.find((k) => fingerprint(k) === fp);
}

// ---------- Preguntas ----------

const T = {
  team: {
    en: "Which team owns the failing component described in `evidence.error`? Judge by the component and code path that fails, not by the words used.",
    es: "¿Qué equipo es dueño del componente que falla en `evidence.error`? Juzga por el componente y la ruta de código que falla, no por las palabras usadas.",
  },
  severity: {
    en: "How severe is the production error in `evidence.error`, given its business impact and the numbers in `evidence.error` (occurrences, affected users, error rate)?",
    es: "¿Qué tan severo es el error de producción en `evidence.error`, según su impacto de negocio y las cifras de `evidence.error` (ocurrencias, usuarios afectados, tasa de error)?",
  },
  dup: {
    en: (k: string) =>
      `Do \`evidence.error\` and \`known_issues.${k}\` have the same root cause in the same component? Different file names, line numbers, wording or language are fine if the root cause is the same.`,
    es: (k: string) =>
      `¿\`evidence.error\` y \`known_issues.${k}\` tienen la misma causa raíz en el mismo componente? Nombres de archivo, líneas, redacción o lenguaje distintos no importan si la causa raíz es la misma.`,
  },
};

const TEAM_CRITERIA = {
  payments: {
    what: "Charges, checkout pricing, coupons, transfers, ledger, payment webhooks.",
    not_for: "Login, sessions or tokens (auth); UI-only rendering bugs (frontend).",
  },
  auth: {
    what: "Login, sessions, tokens, JWT/JWKS, permissions, API gateway authentication.",
    not_for: "Payment webhook signatures (payments).",
  },
  frontend: {
    what: "Browser rendering, hydration, client-side JS errors, UI components.",
    not_for: "Server-side pricing even if triggered from the UI (payments).",
  },
  data: {
    what: "Databases, storage capacity, reports, exports, queries.",
    not_for: "Timeouts calling another service's API (team owning that flow).",
  },
  other: { what: "Anything else: media, notifications, internal tools." },
} as const;

/** Índice 0 = S4 … índice 3 = S1. */
const SEVERITY_LEVELS = [
  { level: "S4", what: "Warning or noise. No user-facing failure.", signals: "0 affected users, deprecations, logs only" },
  { level: "S3", what: "A secondary feature degraded for a subset of users, or a workaround exists.", signals: "low error rate, non-core endpoint" },
  {
    level: "S2",
    what: "An important flow is broken for a large segment, but the core business keeps operating (e.g. queued, not lost).",
    signals: "one browser/region, queue backlog, elevated error rate on a core flow",
  },
  {
    level: "S1",
    what: "Core business stopped or money is being lost or duplicated right now: payments, login or data writes failing for most users.",
    signals: "error rate near 100% on a core flow, duplicate charges, writes failing, payment confirmations not recorded",
  },
] as const;

export function buildTriageRequest(error: ProdError, candidates: KnownIssue[], lang: Lang) {
  const state = {
    evidence: { error: { ...error } },
    known_issues: Object.fromEntries(
      candidates.map((k) => [
        k.id.replace("-", "_"),
        { title: k.title, service: k.service, type: k.type, message: k.message, top_frame: k.top_frame, root_cause: k.root_cause },
      ]),
    ),
  };

  const team: ChoiceQuestion<typeof TEAM_CRITERIA> = {
    type: "choice",
    instructions: `${T.team[lang]} ${EVIDENCE_RULE[lang]}`,
    criteria: TEAM_CRITERIA,
  };
  const severity: ScoreQuestion = {
    type: "score",
    instructions: `${T.severity[lang]} ${EVIDENCE_RULE[lang]}`,
    criteria: SEVERITY_LEVELS.map((l) => ({ ...l })) as unknown as ScoreQuestion["criteria"],
  };
  const dups: Record<string, NoulQuestion> = {};
  for (const k of candidates) {
    const key = k.id.replace("-", "_");
    dups[`dup_${key}`] = {
      type: "noul",
      instructions: `${T.dup[lang](key)} ${EVIDENCE_RULE[lang]}`,
      criteria: {
        true: "Same underlying defect; fixing the known issue would fix this error.",
        false: "Different defect, or the same symptom (e.g. a timeout) against a different downstream service.",
      },
    };
  }
  return { state, questions: { team, severity, ...dups } };
}

// ---------- Decisión en código ----------

export const TRIAGE_THRESHOLDS = {
  dupYes: 0.8, // un solo candidato ≥ 0.8 → duplicado
  dupAmbiguous: 0.5, // dos o más ≥ 0.5 → humano
  severityLowConfidence: 0.5, // por debajo, subimos un nivel (subestimar cuesta más)
};

export interface TriageDecision {
  source: "fingerprint" | "jev";
  team: Team | "unknown";
  severity: Severity;
  duplicate_of: string | null;
  needs_human: boolean;
  open_issue: boolean;
  confidence: number;
  reasons: string[];
  probs: Record<string, unknown>;
}

const SEV_BY_INDEX: Severity[] = ["S4", "S3", "S2", "S1"];

export function scoreToSeverity(score: number, confidence: number): { sev: Severity; bumped: boolean } {
  let idx = score >= 2.5 ? 3 : score >= 1.5 ? 2 : score >= 0.5 ? 1 : 0;
  const bumped = confidence < TRIAGE_THRESHOLDS.severityLowConfidence && idx < 3;
  if (bumped) idx += 1;
  return { sev: SEV_BY_INDEX[idx], bumped };
}

type TriageAnswers = JevCall<ReturnType<typeof buildTriageRequest>["questions"]>["answers"];

export function decideTriage(answers: TriageAnswers): TriageDecision {
  const reasons: string[] = [];
  const team = answers.team as { choice: Team; confidence: number; probabilities: Record<string, number> };
  const sevA = answers.severity as { score: number; confidence: number; probabilities: Record<string, number> };
  const dupEntries = Object.entries(answers)
    .filter(([k]) => k.startsWith("dup_"))
    .map(([k, v]) => [k.replace("dup_", "").replace("_", "-"), (v as unknown as { noul: number }).noul] as const);

  const strong = dupEntries.filter(([, p]) => p >= TRIAGE_THRESHOLDS.dupYes);
  const plausible = dupEntries.filter(([, p]) => p >= TRIAGE_THRESHOLDS.dupAmbiguous);
  let duplicate_of: string | null = null;
  let needs_human = false;
  if (strong.length === 1 && plausible.length === 1) {
    duplicate_of = strong[0][0];
    reasons.push(`duplicado de ${duplicate_of} (p=${strong[0][1].toFixed(2)})`);
  } else if (plausible.length >= 1) {
    needs_human = true;
    reasons.push(`duplicado ambiguo: ${plausible.map(([k, p]) => `${k}=${p.toFixed(2)}`).join(", ")}`);
  }

  const { sev, bumped } = scoreToSeverity(sevA.score, sevA.confidence);
  reasons.push(`severity score=${sevA.score.toFixed(2)} conf=${sevA.confidence.toFixed(2)}${bumped ? " → subido un nivel por baja confianza" : ""}`);
  if (team.confidence < 0.3) {
    needs_human = true;
    reasons.push(`equipo incierto (conf=${team.confidence.toFixed(2)})`);
  }

  const open_issue = !duplicate_of && !needs_human && (sev === "S1" || sev === "S2");
  const confidence = Math.min(team.confidence, sevA.confidence, ...dupEntries.map(([, p]) => noulConfidence(p)));
  return {
    source: "jev",
    team: team.choice,
    severity: sev,
    duplicate_of,
    needs_human,
    open_issue,
    confidence,
    reasons,
    probs: { team: team.probabilities, severity: sevA.probabilities, dup: Object.fromEntries(dupEntries) },
  };
}

/** Punto de entrada usado por el CLI y por jev-mcp. */
export async function triageError(error: ProdError, kis: KnownIssue[], lang: Lang = "en") {
  const exact = exactDuplicate(error, kis);
  if (exact) {
    const decision: TriageDecision = {
      source: "fingerprint",
      team: exact.team,
      severity: "S3",
      duplicate_of: exact.id,
      needs_human: false,
      open_issue: false,
      confidence: 1,
      reasons: [`huella exacta = ${exact.id}; Jev no se llamó`],
      probs: {},
    };
    return { decision, call: null };
  }
  const { state, questions } = buildTriageRequest(error, kis, lang);
  const call = await askJev(state, questions);
  return { decision: decideTriage(call.answers), call };
}

/** Borrador de issue (lo publica Claude vía MCP de GitHub; Jev no genera texto). */
export function issueDraft(error: ProdError, d: TriageDecision) {
  return {
    title: `[${d.severity}] ${error.service}: ${error.type}`,
    labels: [`team:${d.team}`, `severity:${d.severity}`, "triage:jev"],
    body: [
      `**Servicio:** ${error.service} · **Endpoint:** ${error.endpoint}`,
      `**Error:** \`${error.type}\`: ${error.message}`,
      `**Frame:** \`${error.top_frame}\``,
      `**Impacto (10 min):** ${error.occurrences_10m} ocurrencias, ${error.affected_users_10m} usuarios, ${error.error_rate_pct}% error rate`,
      "",
      `**Triage Jev:** ${d.reasons.join(" · ")}`,
    ].join("\n"),
  };
}
