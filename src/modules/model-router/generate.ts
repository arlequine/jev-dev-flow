// Generación del fix con el modelo que eligió el router (API de Anthropic).
// Es el ÚNICO lugar del flujo donde se generan tokens de salida caros.
import { CLAUDE_MODELS, type Tier } from "../../shared/config.js";
import { askClaude } from "../../shared/claude.js";

const SYSTEM = `You are a senior engineer. Produce a minimal, correct fix as a unified diff (git apply compatible).
Rules: change only what the task needs; add or update a test when behavior changes; no secrets; no unrelated refactors.
Output: a one-line summary, then a single \`\`\`diff block. Nothing else.`;

export interface ContextFile {
  path: string;
  content: string;
}

export async function generateFix(task: string, tier: Tier, files: ContextFile[] = []) {
  const context = files.map((f) => `--- ${f.path}\n${f.content}`).join("\n\n");
  const user = `TASK:\n${task}\n\nREPOSITORY FILES:\n${context || "(none provided)"}`;
  const call = await askClaude(CLAUDE_MODELS[tier], SYSTEM, user, 8000);
  const diff = /```diff\n([\s\S]*?)```/.exec(call.text)?.[1] ?? "";
  const summary = call.text.split("\n")[0].trim();
  return { summary, diff, call };
}
