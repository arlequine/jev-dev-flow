// Grabación y reproducción de respuestas para el plan B de la demo.
// La llave es un hash del request completo: si cambias una pregunta, el replay falla en voz alta.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MODE } from "./config.js";

const DIR = join(process.cwd(), "replays");

export function replayKey(kind: string, payload: unknown): string {
  return `${kind}-${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16)}`;
}

export async function withReplay<T>(kind: string, payload: unknown, live: () => Promise<T>): Promise<T> {
  const file = join(DIR, `${replayKey(kind, payload)}.json`);
  if (MODE === "replay") {
    if (!existsSync(file)) throw new Error(`Sin replay para ${kind} (${file}). Corre antes con JEV_MODE=record.`);
    return JSON.parse(readFileSync(file, "utf8")) as T;
  }
  const result = await live();
  if (MODE === "record") {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(result, null, 2));
  }
  return result;
}
