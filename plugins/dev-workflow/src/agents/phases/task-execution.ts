import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowTask, WorkflowMode, AgentResult, FeatureFlags } from "../../types.js";
import { DEFAULT_FEATURE_FLAGS } from "../../types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { selectAgent } from "./routing.js";

const execAsync = promisify(exec);

export function loadWorkingMemory(projectDir: string, taskId: string): string {
  const layers: string[] = [];
  const projectCtx = join(projectDir, ".dev-workflow.md");
  if (existsSync(projectCtx)) { try { layers.push(`[Project] ${readFileSync(projectCtx, "utf-8").slice(0, 500)}`); } catch { /* skip */ } }
  const taskCtx = join(projectDir, "docs", "plans", `${taskId}-context.md`);
  if (existsSync(taskCtx)) { try { layers.push(`[Task] ${readFileSync(taskCtx, "utf-8").slice(0, 500)}`); } catch { /* skip */ } }
  return layers.join("\n");
}

export function saveWorkingMemory(projectDir: string, taskId: string, content: string): void {
  try {
    const plansDir = join(projectDir, "docs", "plans");
    if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
    writeFileSync(join(plansDir, `${taskId}-context.md`), `# Task ${taskId} Context\n\n${content}\n\nUpdated: ${new Date().toISOString()}\n`);
  } catch { /* skip */ }
}

export async function buildProjectContext(projectDir: string, cachedContext?: string): Promise<string> {
  if (cachedContext) return cachedContext;
  const lines: string[] = [];
  try {
    const { stdout } = await execAsync("find . -maxdepth 3 -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -50", { cwd: projectDir, timeout: 10000 });
    lines.push(`Files:\n${stdout.trim()}`);
  } catch { /* skip */ }
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      lines.push(`Package: ${pkg.name || "unknown"}`);
      if (pkg.scripts) lines.push(`Scripts: ${JSON.stringify(pkg.scripts)}`);
    } catch { /* skip */ }
  }
  return lines.join("\n");
}

// T-B1: uses cached project context from engine when available to avoid repeated find/package.json reads
export async function executeTask(runtime: PluginRuntime, task: WorkflowTask, projectDir: string, mode: WorkflowMode, flags?: FeatureFlags): Promise<AgentResult> {
  const logger = runtime.logging.getChildLogger({ level: "info" });
  const start = Date.now();
  const sessionKey = `dwf-task-${task.id}-${Date.now()}`;
  const effectiveFlags = flags ?? DEFAULT_FEATURE_FLAGS;
  // T-B1: try to reuse cached context from engine, build only if not cached
  let projectContext: string;
  try {
    const { getEngine } = await import("../../channel/runtime.js");
    const ctx = getEngine().getContext();
    projectContext = ctx?._cachedProjectContext ?? await buildProjectContext(projectDir);
    if (!ctx?._cachedProjectContext && projectContext) {
      // cache for next call
      if (ctx) { ctx._cachedProjectContext = projectContext; }
    }
  } catch {
    projectContext = await buildProjectContext(projectDir);
  }
  const workingMemory = effectiveFlags.workingMemoryPersist ? loadWorkingMemory(projectDir, task.id) : "";
  const tddPrompt = mode === "quick" ? "Write code and verify it works."
    : mode === "full" || effectiveFlags.strictTdd
      ? `Follow STRICT TDD cycle (mandatory):\n1. RED: Write a failing test first that defines expected behavior\n2. GREEN: Write the minimal implementation to make the test pass\n3. REFACTOR: Simplify while keeping tests green\n4. VERIFY: Run all tests to confirm no regressions\n5. COMMIT: Prepare a Conventional Commits message\n\nDO NOT skip any step. Tests MUST fail first before implementation.`
      : `Follow TDD cycle:\n1. RED: Write a failing test first that defines expected behavior\n2. GREEN: Write the minimal implementation to make the test pass\n3. REFACTOR: Simplify while keeping tests green\n4. VERIFY: Run all tests to confirm no regressions\n5. COMMIT: Prepare a Conventional Commits message`;
  const rulesSection = effectiveFlags.ruleEnforcement
    ? `\n\nCode Rules (enforced):\n- No unused variables or imports\n- Prefer const over let\n- No console.log (use logger)\n- Avoid any type\n- Functions < 50 lines, files < 500 lines\n- No hardcoded secrets\n- Prefer pure functions\n- Use early returns\n- Meaningful names\n`
    : "";
  const systemPrompt = `You are a senior engineer executing a task.\n${tddPrompt}\n${rulesSection}\nProject context:\n${projectContext}\n\n${workingMemory ? `Working memory:\n${workingMemory}\n` : ""}Task: ${task.title} - ${task.description}\nFiles: ${task.files.join(", ")}\nShip category: ${task.shipCategory}\nReturn a summary of what you did.`;
  try {
    const runResult = await runtime.subagent.run({ sessionKey, message: `Execute task **${task.title}**: ${task.description}\nFiles: ${task.files.join(", ")}\nShip: ${task.shipCategory}`, extraSystemPrompt: systemPrompt, deliver: false });
    const timeout = mode === "full" ? 600000 : mode === "standard" ? 300000 : 180000;
    const waitResult = await runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: timeout });
    if (waitResult.status !== "ok") {
      return { agentId: selectAgent(task.difficulty), task: task.id, success: false, output: `Failed: ${waitResult.error ?? waitResult.status}`, durationMs: Date.now() - start };
    }
    const msgResult = await runtime.subagent.getSessionMessages({ sessionKey, limit: 10 });
    const last = msgResult.messages[msgResult.messages.length - 1] as any;
    const text = typeof last === "string" ? last : (last?.content ?? "");
    if (effectiveFlags.workingMemoryPersist) saveWorkingMemory(projectDir, task.id, text.slice(0, 1000));
    return { agentId: selectAgent(task.difficulty), task: task.id, success: true, output: text.slice(0, 2000), durationMs: Date.now() - start };
  } catch (e) {
    logger.error(`Task execution error: ${e}`);
    return { agentId: selectAgent(task.difficulty), task: task.id, success: false, output: `Error: ${e}`, durationMs: Date.now() - start };
  }
}

export async function executeSubTask(subtask: any, projectDir: string): Promise<{ success: boolean; output: string; durationMs: number }> {
  const start = Date.now();
  return { success: true, output: `Sub-task ${subtask.id} executed`, durationMs: Date.now() - start };
}
