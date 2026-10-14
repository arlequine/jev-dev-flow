import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Tier } from "./config.js";

const load = <T>(name: string): T => JSON.parse(readFileSync(join(process.cwd(), "fixtures", name), "utf8")) as T;

export type Team = "payments" | "auth" | "frontend" | "data" | "other";
export type Severity = "S1" | "S2" | "S3" | "S4";

export interface ProdError {
  service: string;
  type: string;
  message: string;
  top_frame: string;
  endpoint: string;
  occurrences_10m: number;
  affected_users_10m: number;
  error_rate_pct: number;
  note?: string;
}
export interface ErrorFixture {
  id: string;
  gold: { team: Team; severity: Severity; duplicate_of: string | null };
  edge_case: string;
  error: ProdError;
}
export interface KnownIssue {
  id: string;
  team: Team;
  title: string;
  service: string;
  type: string;
  message: string;
  top_frame: string;
  root_cause: string;
  github_issue: number;
}
export type Verdict = "approve" | "review" | "block";
export interface PullRequest {
  title: string;
  description: string;
  files: string[];
  diff: string;
}
export interface PrFixture extends PullRequest {
  id: string;
  gold: { verdict: Verdict; risky: boolean; signals: string[]; injection?: boolean };
  baseline_catches: boolean;
  edge_case: string;
}
export interface PromptFixture {
  id: string;
  gold: Tier;
  why: string;
  task: string;
}

export const errors = () => load<ErrorFixture[]>("errors.json");
export const knownIssues = () => load<KnownIssue[]>("known-issues.json");
export const prs = () => load<PrFixture[]>("prs.json");
export const prompts = () => load<PromptFixture[]>("prompts.json");

export interface FeedbackFixture {
  id: string;
  channel: string;
  text: string;
  gold: { topic: string; frustration: number; asks_refund: boolean; churn_risk: boolean; mentions_competitor: boolean; design_signal: boolean };
  edge_case?: string;
}
export const feedback = () => load<FeedbackFixture[]>("feedback.json");
