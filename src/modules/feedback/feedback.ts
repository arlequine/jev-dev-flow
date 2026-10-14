// Ejemplo para todo público: clasificar comentarios de clientes.
// Sirve igual a marketing (menciones, competencia), UX (fricciones), análisis (temas y tendencias)
// y negocio (riesgo de cancelación). Mismo patrón que el resto: Jev decide, el código enruta.
import type { ChoiceQuestion, NoulQuestion, ScoreQuestion } from "@typesafe-ai/sdk";
import type { Lang } from "../../shared/config.js";
import { EVIDENCE_RULE, askJev, type JevCall } from "../../shared/jev.js";

const TOPICS = {
  billing: { what: "Charges, invoices, double charges, payment problems." },
  pricing: { what: "Price level or price changes.", not_for: "Charging errors (billing)." },
  bug: { what: "Something is broken or crashes." },
  ux_confusion: { what: "The user cannot find or understand how to do something; nothing is broken." },
  feature_request: { what: "Asks for something the product does not do yet." },
  praise: { what: "Mainly positive about the product." },
  other: { what: "Questions or comments that fit none of the above." },
} as const;

const FRUSTRATION = [
  "Calm or positive.",
  "Mild annoyance.",
  "Clearly frustrated.",
  "Angry or threatening to leave.",
] as const;

const Q = {
  topic: { en: "What is the main topic of `evidence.comment`?", es: "¿Cuál es el tema principal de `evidence.comment`?" },
  frustration: { en: "How frustrated is the customer who wrote `evidence.comment`?", es: "¿Qué tan frustrado está el cliente que escribió `evidence.comment`?" },
  asks_refund: {
    en: "Does `evidence.comment` ask for money back? Mentioning refunds sarcastically or in passing is false.",
    es: "¿`evidence.comment` pide que le devuelvan dinero? Mencionar reembolsos con sarcasmo o de pasada es false.",
  },
  churn_risk: {
    en: "Does `evidence.comment` say or clearly imply the customer may cancel or switch to another option?",
    es: "¿`evidence.comment` dice o implica claramente que el cliente podría cancelar o irse a otra opción?",
  },
  mentions_competitor: {
    en: "Does `evidence.comment` name or compare against a competing product or company?",
    es: "¿`evidence.comment` nombra o se compara con un producto o empresa competidora?",
  },
  design_signal: {
    en: "Does `evidence.comment` say something useful about the interface or experience design (confusing, clear, hard to find, pleasant)?",
    es: "¿`evidence.comment` dice algo útil sobre el diseño de la interfaz o la experiencia (confuso, claro, difícil de encontrar, agradable)?",
  },
};

export function buildFeedbackRequest(comment: string, channel: string, lang: Lang) {
  const ev = EVIDENCE_RULE[lang];
  const noul = (k: keyof typeof Q): NoulQuestion => ({ type: "noul", instructions: `${Q[k][lang]} ${ev}` });
  const topic: ChoiceQuestion<typeof TOPICS> = { type: "choice", instructions: `${Q.topic[lang]} ${ev}`, criteria: TOPICS };
  const frustration: ScoreQuestion<typeof FRUSTRATION> = { type: "score", instructions: `${Q.frustration[lang]} ${ev}`, criteria: FRUSTRATION };
  return {
    state: { channel, evidence: { comment } },
    questions: {
      topic,
      frustration,
      asks_refund: noul("asks_refund"),
      churn_risk: noul("churn_risk"),
      mentions_competitor: noul("mentions_competitor"),
      design_signal: noul("design_signal"),
    },
  };
}

type FeedbackAnswers = JevCall<ReturnType<typeof buildFeedbackRequest>["questions"]>["answers"];

/** Reglas de negocio en código: cambiar a quién llega cada cosa es editar esta tabla, no un prompt. */
export function decideFeedback(a: FeedbackAnswers) {
  const tags: string[] = [];
  const routes: string[] = [];
  if (a.asks_refund.noul >= 0.7) { tags.push("reembolso"); routes.push("soporte-pagos"); }
  if (a.churn_risk.noul >= 0.7) { tags.push("riesgo-cancelación"); routes.push("customer-success"); }
  if (a.mentions_competitor.noul >= 0.7) { tags.push("competencia"); routes.push("marketing"); }
  if (a.design_signal.noul >= 0.7) { tags.push("señal-UX"); routes.push("ux-research"); }
  if (a.topic.choice === "bug") routes.push("ingeniería");
  if (a.topic.choice === "feature_request") routes.push("producto");
  const urgent = a.churn_risk.noul >= 0.7 && a.frustration.score >= 2;
  const unsure = a.topic.confidence < 0.4;
  return {
    topic: a.topic.choice,
    frustration: Math.round(a.frustration.score),
    tags,
    routes: [...new Set(routes)],
    priority: urgent ? "urgente (contactar hoy)" : routes.length ? "normal" : "solo métricas",
    needs_human: unsure,
    probs: {
      topic: a.topic.probabilities,
      asks_refund: a.asks_refund.noul,
      churn_risk: a.churn_risk.noul,
      mentions_competitor: a.mentions_competitor.noul,
      design_signal: a.design_signal.noul,
    },
  };
}

export async function classifyFeedback(comment: string, channel = "unknown", lang: Lang = "en") {
  const { state, questions } = buildFeedbackRequest(comment, channel, lang);
  const call = await askJev(state, questions);
  return { decision: decideFeedback(call.answers), call };
}
