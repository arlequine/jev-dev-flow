// Calculadora de costo de prompts de Jev vs. Claude.
//   npm run cost -- gate:pr06                                   estimación sin red, vs. Opus 5.5
//   npm run cost -- triage:E11 --compare opus,sonnet,haiku
//   npm run cost -- route:P05 --precision count                 conteo exacto de Claude (gratis)
//   npm run cost -- ./mi-request.json --precision measure       llamadas reales (cuesta centavos)
//   npm run cost -- gate:pr06 --volume 50000                    proyección a N requests
// Un archivo JSON debe tener { "state": ..., "questions": { ... } } (el mismo body que va a Jev).
import { readFileSync } from "node:fs";
import type { Lang, Tier } from "../src/shared/config.js";
import { costReport, estimateCost, requestFromRef, type JevRequest, type Precision } from "../src/cost/estimate.js";

const args = process.argv.slice(2);
const flag = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const target = args[0];
if (!target || target.startsWith("--")) {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(0, 7).join("\n"));
  process.exit(1);
}

const lang = flag("lang", "en") as Lang;
const req: JevRequest = target.endsWith(".json") ? (JSON.parse(readFileSync(target, "utf8")) as JevRequest) : requestFromRef(target, lang);
const compare = flag("compare", "opus")!.split(",") as Tier[];
const precision = flag("precision", "estimate") as Precision;
const volume = Number(flag("volume", "10000"));

const result = await estimateCost(req, { compare, precision });
console.log(`\nCosto de ${target}\n`);
console.log(costReport(result, volume));
