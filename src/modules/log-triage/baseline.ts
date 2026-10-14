// Baseline de triage: huella exacta + severidad por palabras clave + equipo por nombre de servicio.
// Representa lo que hace hoy un pipeline sin modelo.
import type { KnownIssue, ProdError, Severity, Team } from "../../shared/fixtures.js";
import { exactDuplicate } from "./triage.js";

export function baselineTriage(error: ProdError, kis: KnownIssue[]) {
  const dup = exactDuplicate(error, kis);
  const text = `${error.type} ${error.message}`.toLowerCase();
  let severity: Severity = "S3";
  if (/fatal|panic|outage|data loss/.test(text)) severity = "S1";
  else if (/500|timeout|timed out|refused/.test(text)) severity = "S2";
  else if (/deprecat|warning/.test(text)) severity = "S4";
  const svc = error.service;
  const team: Team = /pay|checkout|transfer|webhook/.test(svc)
    ? "payments"
    : /auth/.test(svc)
      ? "auth"
      : svc === "web"
        ? "frontend"
        : /db|report/.test(svc)
          ? "data"
          : "other";
  return { team, severity: dup ? "S3" : severity, duplicate_of: dup?.id ?? null };
}
