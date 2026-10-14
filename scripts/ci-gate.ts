// Gate en CI (GitHub Actions): comenta en el PR y falla el check si el veredicto no es approve.
// Segunda línea de defensa: el hook de Claude Code protege merges desde el agente; esto protege todo lo demás.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { gateComment, gatePr } from "../src/modules/pr-gate/gate.js";

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, "utf8")) as {
  pull_request: { number: number; title: string; body: string | null };
};
const n = String(event.pull_request.number);
const files = (JSON.parse(execFileSync("gh", ["pr", "view", n, "--json", "files"], { encoding: "utf8" })) as { files: { path: string }[] }).files.map((f) => f.path);
const diff = execFileSync("gh", ["pr", "diff", n], { encoding: "utf8" });

const { decision, call } = await gatePr({ title: event.pull_request.title, description: event.pull_request.body ?? "", files, diff });
const body = gateComment(decision, call?.model);
writeFileSync("gate-comment.md", body);
execFileSync("gh", ["pr", "comment", n, "--body-file", "gate-comment.md"]);
console.log(body);
process.exit(decision.verdict === "approve" ? 0 : 1);
