// Registro de métricas en JSONL. Una línea por decisión: es la fuente de verdad del dashboard.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type Strategy = "jev" | "baseline" | "llm-parse" | "opus-all";

export interface MetricRow {
  ts: string;
  run_id: string;
  module: "log-triage" | "model-router" | "pr-gate" | "generation";
  item: string;
  strategy: Strategy;
  lang?: "en" | "es";
  model: string; // snapshot que respondió (campo `model` de la respuesta)
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  decision: string;
  gold?: string;
  correct?: boolean;
  confidence?: number;
  detail?: Record<string, unknown>; // probabilidades crudas: permiten reajustar umbrales sin volver a llamar
}

export const METRICS_FILE = join(process.cwd(), "metrics", "runs.jsonl");

export function record(row: MetricRow): void {
  mkdirSync(dirname(METRICS_FILE), { recursive: true });
  appendFileSync(METRICS_FILE, `${JSON.stringify(row)}\n`);
}

export function readRows(file = METRICS_FILE): MetricRow[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as MetricRow);
}

export const newRunId = () => new Date().toISOString().replace(/[:.]/g, "-");
