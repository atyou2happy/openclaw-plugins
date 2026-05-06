import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowMode } from "../../types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

export interface AnalysisResult { summary: string; hasOpenSpec: boolean; gitStatus: string; }
export interface RequirementAnalysisResult { complexity: string; estimatedFiles: number; suggestedMode: WorkflowMode; affectedModules: string[]; }

export async function runAnalysis(runtime: PluginRuntime, projectDir: string): Promise<AnalysisResult> {
  const logger = runtime.logging.getChildLogger({ level: "info" });
  logger.info(`Running project analysis for ${projectDir}`);
  const hasOpenSpec = existsSync(join(projectDir, "openspec"));
  let gitStatus = "unknown";
  let summary = "";
  try {
    const { stdout: gitOut } = await execAsync("git status --porcelain", { cwd: projectDir, timeout: 10000 });
    gitStatus = gitOut.trim() ? "dirty" : "clean";
  } catch { gitStatus = "not-a-git-repo"; }
  let pkgInfo = "";
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      pkgInfo = `name: ${pkg.name || "unknown"}`;
      if (pkg.scripts) pkgInfo += `, scripts: ${Object.keys(pkg.scripts).join(", ")}`;
    } catch { /* skip */ }
  }
  const tsConfig = existsSync(join(projectDir, "tsconfig.json"));
  const dirs = readdirSync(projectDir).filter((e) => {
    try { return statSync(join(projectDir, e)).isDirectory() && !e.startsWith("."); } catch { return false; }
  });
  summary = `Project: ${pkgInfo}. Dirs: ${dirs.join(", ")}. TS: ${tsConfig}. OpenSpec: ${hasOpenSpec}. Git: ${gitStatus}.`;
  return { summary, hasOpenSpec, gitStatus };
}

function complexityToMode(c: string): WorkflowMode {
  return c === "high" ? "full" : c === "medium" ? "standard" : "quick";
}

function fallbackAnalysis(requirement: string): RequirementAnalysisResult {
  const wc = requirement.split(/\s+/).length;
  const complexity = wc > 50 ? "high" : wc > 20 ? "medium" : "low";
  return { complexity, estimatedFiles: Math.max(1, Math.ceil(wc / 15)), suggestedMode: complexityToMode(complexity), affectedModules: [] };
}

export async function analyzeRequirement(runtime: PluginRuntime, requirement: string, projectDir: string, mode: WorkflowMode): Promise<RequirementAnalysisResult> {
  const logger = runtime.logging.getChildLogger({ level: "info" });
  const sessionKey = `dwf-analysis-${Date.now()}`;
  const systemPrompt = `You are a senior software architect. Return a JSON object with:
- "complexity": "low" | "medium" | "high"
- "estimatedFiles": number
- "affectedModules": string[]
Return ONLY valid JSON.`;
  try {
    const runResult = await runtime.subagent.run({ sessionKey, message: `Requirement: ${requirement}\nProject: ${projectDir}`, extraSystemPrompt: systemPrompt, deliver: false });
    const waitResult = await runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
    if (waitResult.status !== "ok") return fallbackAnalysis(requirement);
    const msgResult = await runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
    const last = msgResult.messages[msgResult.messages.length - 1] as any;
    const text = typeof last === "string" ? last : (last?.content ?? "");
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      return { complexity: p.complexity ?? "medium", estimatedFiles: p.estimatedFiles ?? 3, suggestedMode: complexityToMode(p.complexity ?? "medium"), affectedModules: p.affectedModules ?? [] };
    }
  } catch (e) { logger.warn(`Analysis subagent failed: ${e}`); }
  return fallbackAnalysis(requirement);
}
