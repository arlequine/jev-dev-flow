// Hook PreToolUse de Claude Code: corre el gate ANTES de cualquier merge, sin depender del agente.
// Se dispara en: Bash con `gh pr merge <n>` y en la tool de merge del MCP de GitHub.
// Exit 0 = permitir · Exit 2 = bloquear (stderr se le muestra a Claude como motivo).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gateComment, gatePr } from "../src/modules/pr-gate/gate.js";

interface HookInput {
  tool_name: string;
  tool_input: { command?: string; pullNumber?: number; pull_number?: number; owner?: string; repo?: string };
}

const input = JSON.parse(readFileSync(0, "utf8")) as HookInput;
let prNumber: number | undefined;
let repoFlag: string[] = [];

if (input.tool_name === "Bash") {
  const m = /\bgh\s+pr\s+merge\s+(\d+)/.exec(input.tool_input.command ?? "");
  if (!m) process.exit(0); // no es un merge: no intervenimos
  prNumber = Number(m[1]);
} else {
  prNumber = input.tool_input.pullNumber ?? input.tool_input.pull_number;
  if (input.tool_input.owner && input.tool_input.repo) repoFlag = ["--repo", `${input.tool_input.owner}/${input.tool_input.repo}`];
}
if (!prNumber) {
  console.error("jev-pr-gate: no pude identificar el número de PR; merge bloqueado por precaución.");
  process.exit(2);
}

try {
  const meta = JSON.parse(execFileSync("gh", ["pr", "view", String(prNumber), ...repoFlag, "--json", "title,body,files"], { encoding: "utf8" })) as {
    title: string;
    body: string;
    files: { path: string }[];
  };
  const diff = execFileSync("gh", ["pr", "diff", String(prNumber), ...repoFlag], { encoding: "utf8" });
  const { decision, call } = await gatePr({ title: meta.title, description: meta.body ?? "", files: meta.files.map((f) => f.path), diff });
  if (decision.verdict === "approve") process.exit(0);
  console.error(`jev-pr-gate bloqueó el merge del PR #${prNumber}.\n\n${gateComment(decision, call?.model)}\n\nPublica este comentario en el PR y pide revisión humana. No intentes saltarte el gate.`);
  process.exit(2);
} catch (e) {
  // Fail-closed: si el gate no puede evaluar, no se mergea.
  console.error(`jev-pr-gate no pudo evaluar el PR #${prNumber}: ${e instanceof Error ? e.message : e}. Merge bloqueado.`);
  process.exit(2);
}
