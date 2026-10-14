// Cliente Claude (API de Anthropic) con medición de tokens y costo.
import Anthropic from "@anthropic-ai/sdk";
import { claudeCost } from "./config.js";
import { withReplay } from "./replay.js";

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic()); // lee ANTHROPIC_API_KEY

export interface ClaudeCall {
  text: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

export async function askClaude(model: string, system: string, user: string, maxTokens = 4096): Promise<ClaudeCall> {
  const payload = { model, system, user, maxTokens };
  return withReplay("claude", payload, async () => {
    const t0 = performance.now();
    const msg = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return {
      text,
      model: msg.model,
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cost_usd: claudeCost(model, msg.usage.input_tokens, msg.usage.output_tokens),
      latency_ms: Math.round(performance.now() - t0),
    };
  });
}

/** Extrae el primer objeto JSON de un texto (para la estrategia "prompt y parseo"). */
export function parseJsonLoose(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`Sin JSON en la respuesta: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}
