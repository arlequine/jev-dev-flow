// Configuración central. Todo lo que cambia entre versiones vive aquí.
import { existsSync } from "node:fs";

// Carga .env si existe (en CI las variables vienen de secrets; no pisa las ya definidas).
if (existsSync(".env")) process.loadEnvFile(".env");

/** Versión fijada (ID versionado de la API nativa de TypeSafe). NUNCA usar jev-latest ni jev-preview:
 *  los alias se mueven con cada release y los umbrales están calibrados contra 1.13. */
export const JEV_MODEL = "jev-1.13.0" as const;

/** API nativa de TypeSafe. El SDK agrega /v1/systemone. Se puede sobrescribir con TYPESAFE_BASE_URL. */
export const TYPESAFE_BASE_URL = process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai";

/** IDs de modelos Claude en la API de Anthropic. */
export const CLAUDE_MODELS = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
} as const;
export type Tier = keyof typeof CLAUDE_MODELS;

/**
 * Precios de lista USD por millón de tokens (API de Anthropic, verificados 2026-10-13).
 * Haiku 5.5 sube a 0.50/2.50 por encima de 100K tokens de prompt: no aplica a esta demo.
 * Revalidar antes de la charla: https://docs.claude.com (pricing).
 */
export const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2.0, output: 10.0 },
  "claude-opus-5-5": { input: 4.0, output: 20.0 },
};

/** Jev 1.13: USD 0.042 por millón de tokens de entrada, salida gratis (docs.typesafe.ai/models, 2026-10-13).
 *  La API nativa no devuelve el costo: se calcula aquí a partir de usage.input_tokens. */
export const JEV_PRICE_INPUT_PER_M = 0.042;

export type Lang = "en" | "es";

/** live: llama a las APIs · record: llama y graba · replay: sirve respuestas grabadas (plan B). */
export type Mode = "live" | "record" | "replay";
export const MODE: Mode = (process.env.JEV_MODE as Mode) ?? "live";

export function claudeCost(model: string, input: number, output: number): number {
  const p = CLAUDE_PRICING[model];
  if (!p) throw new Error(`Sin precio para ${model}`);
  return (input * p.input + output * p.output) / 1_000_000;
}
