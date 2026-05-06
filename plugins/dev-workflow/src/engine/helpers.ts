import type { WorkflowTask, WorkflowContext, AgentResult } from "../types.js";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { DEFAULT_MODEL } from "../constants.js";

/** T3: Classify a decision string into a category */
function categorizeDecision(d: string): "decision" | "error" | "skip" | "info" {
  const lower = d.toLowerCase();
  if (/error|fail|exception|crash/i.test(lower)) return "error";
  if (/skip|skipped|skip\b/i.test(lower)) return "skip";
  if (/approved|confirmed|selected|chose|decided|gate/i.test(lower)) return "decision";
  return "info";
}

/** T3: Group decisions by category */
function groupDecisions(decisions: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = { decision: [], error: [], skip: [], info: [] };
  for (const d of decisions) {
    const cat = categorizeDecision(d);
    groups[cat].push(d);
  }
  // Remove empty groups
  for (const k of Object.keys(groups)) {
    if (groups[k].length === 0) delete groups[k];
  }
  return groups;
}
export function getVersion(dir: string): string {
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.version) return pkg.version;
    } catch { /* skip */ }
  }
  const date = new Date();
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

export function gitCommit(projectDir: string, message: string, files?: string[], onSkip?: (msg: string) => void): void {
  try {
    if (files && files.length > 0) {
      const fileList = files.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(" ");
      execSync(`git add -- ${fileList}`, { cwd: projectDir, stdio: "pipe", timeout: 10000 });
    } else {
      execSync("git add -u", { cwd: projectDir, stdio: "pipe", timeout: 10000 });
    }
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectDir, stdio: "pipe", timeout: 10000 });
  } catch (e) {
    onSkip?.(`Commit skipped: ${message}`);
  }
}

export function inferCommitType(task: WorkflowTask): string {
  const t = task.title.toLowerCase();
  const d = task.description.toLowerCase();
  if (t.includes("test") || d.includes("test")) return "test";
  if (t.includes("doc") || d.includes("doc")) return "docs";
  if (t.includes("fix") || d.includes("fix") || d.includes("bug")) return "fix";
  if (t.includes("refactor") || d.includes("refactor")) return "refactor";
  if (t.includes("setup") || t.includes("config") || t.includes("init")) return "chore";
  return "feat";
}

export function inferScope(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length >= 2 && parts[0] === "src") return parts[1].replace(/\.[^.]+$/, "");
  if (parts.length >= 1) return parts[0].replace(/\.[^.]+$/, "");
  return "";
}

export function generateCommitMessage(task: WorkflowTask): string {
  const type = inferCommitType(task);
  const scope = task.files.length > 0 ? inferScope(task.files[0]) : "";
  const desc = task.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const scopeStr = scope ? `(${scope})` : "";
  return `${type}${scopeStr}: ${desc}`;
}

export function buildReport(context: WorkflowContext): string {
  const spec = context.spec;
  const completed = spec?.tasks.filter((t) => t.status === "completed").length ?? 0;
  const total = spec?.tasks.length ?? 0;
  const elapsed = Date.now() - new Date(context.startedAt).getTime();
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  const shipCounts = {
    ship: spec?.tasks.filter((t) => t.shipCategory === "ship" && t.status === "completed").length ?? 0,
    show: spec?.tasks.filter((t) => t.shipCategory === "show" && t.status === "completed").length ?? 0,
    ask: spec?.tasks.filter((t) => t.shipCategory === "ask" && t.status === "completed").length ?? 0,
  };

  const lines = [
    `# Delivery Report`,
    `Project: ${context.projectId} | Mode: ${context.mode} | Duration: ${mins}m ${secs}s`,
    `Tasks: ${completed}/${total} completed (ship:${shipCounts.ship} show:${shipCounts.show} ask:${shipCounts.ask})`,
    `Branch: ${context.branchName ?? "N/A"}`,
    ``,
    spec ? spec.proposal : "No spec generated.",
  ];

  if (context.decisions.length > 0) {
    lines.push(``, `## Decisions`);
    // T3: Group decisions by category for compact output
    const grouped = groupDecisions(context.decisions);
    for (const [category, items] of Object.entries(grouped)) {
      if (items.length <= 15) {
        for (const d of items) lines.push(`- [${category}] ${d}`);
      } else {
        // Show first 10 + summary
        for (const d of items.slice(0, 10)) lines.push(`- [${category}] ${d}`);
        lines.push(`  ... and ${items.length - 10} more ${category} items`);
      }
    }
  }

  if (context.qaGateResults.length > 0) {
    lines.push(``, `## QA Gate`);
    for (const c of context.qaGateResults) lines.push(`- [${c.passed ? "x" : " "}] ${c.name}`);
  }

  return lines.join("\n");
}

export function persistContext(context: WorkflowContext, contextFile: string): void {
  try { writeFileSync(contextFile, JSON.stringify(context, null, 2)); } catch { /* skip */ }
}

export function loadContextFromDisk(projectDir: string, contextFile: string): WorkflowContext | null {
  const p = join(projectDir, contextFile);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")) as WorkflowContext; } catch { return null; }
}
