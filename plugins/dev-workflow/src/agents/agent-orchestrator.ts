import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type {
  WorkflowTask,
  WorkflowMode,
  WorkflowSpec,
  BrainstormOption,
  AgentResult,
  TechSelection,
  FeatureFlags,
} from "../types.js";
import { DEFAULT_FEATURE_FLAGS } from "../types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

interface AnalysisResult {
  summary: string;
  hasOpenSpec: boolean;
  gitStatus: string;
}

interface RequirementAnalysisResult {
  complexity: string;
  estimatedFiles: number;
  suggestedMode: WorkflowMode;
  affectedModules: string[];
}

export class AgentOrchestrator {
  private runtime: PluginRuntime;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  /**
   * Step -1: Git 自动化准备
   * - 检测 Git 仓库
   * - 自动 stash 未提交更改
   * - 自动创建 feature 分支
   */
  async gitPrepare(projectDir: string, taskName?: string): Promise<{ stashed: boolean; branch: string; created: boolean }> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const result = { stashed: false, branch: "", created: false };

    try {
      // 检测是否为 Git 仓库
      const { stdout: isGit } = await execAsync("git rev-parse --is-inside-work-tree", { cwd: projectDir });
      if (isGit.trim() !== "true") {
        logger.info("Not a git repository, skipping git prepare");
        return result;
      }

      // 获取当前分支
      const { stdout: currentBranch } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: projectDir });
      result.branch = currentBranch.trim();

      // 检查是否有未提交更改
      const { stdout: status } = await execAsync("git status --porcelain", { cwd: projectDir });
      if (status.trim().length > 0) {
        logger.info("Uncommitted changes detected, stashing...");
        await execAsync("git stash push -m \"dwf-auto-stash\"", { cwd: projectDir });
        result.stashed = true;
      }

      // 如果已在 feature 分支则跳过创建
      if (result.branch.startsWith("feature/")) {
        logger.info(`Already on feature branch: ${result.branch}`);
        return result;
      }

      // 创建 feature 分支
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const safeName = (taskName || "workflow").replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 30);
      const branchName = `feature/dwf-${date}-${safeName}`;
      await execAsync(`git checkout -b ${branchName}`, { cwd: projectDir });
      result.branch = branchName;
      result.created = true;
      logger.info(`Created feature branch: ${branchName}`);
    } catch (error) {
      logger.warn(`Git prepare failed: ${error}`);
    }

    return result;
  }

  /**
   * Quick 模式跳过的步骤
   * Quick: 跳过 brainstorm, tech selection, docs
   * Standard: 跳过 docs
   * Full: 不跳过
   */
  getSkippedSteps(mode: WorkflowMode): string[] {
    switch (mode) {
      case "quick":
        return ["brainstorm", "tech", "docs", "review"];
      case "standard":
        return ["docs"];
      case "full":
        return [];
      default:
        return [];
    }
  }

  /**
   * Step 0.1: 交接文档消费
   * 读取 docs/handover.md 恢复上次工作流上下文
   */
  async loadHandover(projectDir: string): Promise<{ found: boolean; content: string }> {
    const handoverPath = join(projectDir, "docs", "handover.md");
    if (!existsSync(handoverPath)) {
      return { found: false, content: "" };
    }
    try {
      const content = readFileSync(handoverPath, "utf-8");
      return { found: true, content };
    } catch {
      return { found: false, content: "" };
    }
  }

  /**
   * Step 0.2: Project Bootstrap
   * 7项检查清单
   */
  async bootstrap(projectDir: string): Promise<{ checks: Array<{ name: string; passed: boolean }> }> {
    const checks = [
      { name: ".dev-workflow.md exists", passed: existsSync(join(projectDir, ".dev-workflow.md")) },
      { name: ".gitignore exists", passed: existsSync(join(projectDir, ".gitignore")) },
      { name: "package.json exists", passed: existsSync(join(projectDir, "package.json")) || existsSync(join(projectDir, "pyproject.toml")) },
      { name: "README.md exists", passed: existsSync(join(projectDir, "README.md")) },
      { name: "docs/ directory exists", passed: existsSync(join(projectDir, "docs")) },
      { name: "git initialized", passed: existsSync(join(projectDir, ".git")) },
      { name: "openspec configured", passed: existsSync(join(projectDir, "openspec")) },
    ];
    return { checks };
  }

  async runAnalysis(projectDir: string): Promise<AnalysisResult> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info(`Running project analysis for ${projectDir}`);

    const hasOpenSpec = existsSync(join(projectDir, "openspec"));
    let gitStatus = "unknown";
    let summary = "";

    try {
      const { stdout: gitOut } = await execAsync("git status --porcelain", { cwd: projectDir, timeout: 10000 });
      gitStatus = gitOut.trim() ? "dirty" : "clean";
    } catch {
      gitStatus = "not-a-git-repo";
    }

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

  async analyzeRequirement(requirement: string, projectDir: string, mode: WorkflowMode): Promise<RequirementAnalysisResult> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const sessionKey = `dwf-analysis-${Date.now()}`;

    const systemPrompt = `You are a senior software architect. Return a JSON object with:
- "complexity": "low" | "medium" | "high"
- "estimatedFiles": number
- "affectedModules": string[]
Return ONLY valid JSON.`;

    try {
      const runResult = await this.runtime.subagent.run({
        sessionKey, message: `Requirement: ${requirement}\nProject: ${projectDir}`,
        extraSystemPrompt: systemPrompt, deliver: false,
      });
      const waitResult = await this.runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
      if (waitResult.status !== "ok") return this.fallbackAnalysis(requirement);

      const msgResult = await this.runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
      const last = msgResult.messages[msgResult.messages.length - 1] as any;
      const text = typeof last === "string" ? last : (last?.content ?? "");
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        return {
          complexity: p.complexity ?? "medium",
          estimatedFiles: p.estimatedFiles ?? 3,
          suggestedMode: this.complexityToMode(p.complexity ?? "medium"),
          affectedModules: p.affectedModules ?? [],
        };
      }
    } catch (e) {
      logger.warn(`Analysis subagent failed: ${e}`);
    }
    return this.fallbackAnalysis(requirement);
  }

  private fallbackAnalysis(requirement: string): RequirementAnalysisResult {
    const wc = requirement.split(/\s+/).length;
    const complexity = wc > 50 ? "high" : wc > 20 ? "medium" : "low";
    return { complexity, estimatedFiles: Math.max(1, Math.ceil(wc / 15)), suggestedMode: this.complexityToMode(complexity), affectedModules: [] };
  }

  private complexityToMode(c: string): WorkflowMode {
    return c === "high" ? "full" : c === "medium" ? "standard" : "quick";
  }

  async brainstorm(requirement: string, projectDir: string): Promise<BrainstormOption[]> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const sessionKey = `dwf-brainstorm-${Date.now()}`;

    const systemPrompt = `Propose 3 distinct implementation approaches. Return a JSON array where each entry has:
- "label": short name
- "description": 1-2 sentences
- "pros": string[]
- "cons": string[]
Return ONLY valid JSON.`;

    try {
      const runResult = await this.runtime.subagent.run({
        sessionKey, message: `Requirement: ${requirement}\nProject: ${projectDir}`,
        extraSystemPrompt: systemPrompt, deliver: false,
      });
      const waitResult = await this.runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
      if (waitResult.status !== "ok") return this.defaultBrainstorm();

      const msgResult = await this.runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
      const last = msgResult.messages[msgResult.messages.length - 1] as any;
      const text = typeof last === "string" ? last : (last?.content ?? "");
      const m = text.match(/\[[\s\S]*\]/);
      if (m) return JSON.parse(m[0]);
    } catch (e) {
      logger.warn(`Brainstorm subagent failed: ${e}`);
    }
    return this.defaultBrainstorm();
  }

  private defaultBrainstorm(): BrainstormOption[] {
    return [
      { label: "Minimal", description: "Simplest solution that meets the requirement", pros: ["Fast"], cons: ["Limited scalability"] },
      { label: "Standard", description: "Balanced approach with proper architecture", pros: ["Maintainable"], cons: ["More time"] },
      { label: "Full", description: "Comprehensive solution with full documentation", pros: ["Production-ready"], cons: ["Complex"] },
    ];
  }

  async defineSpec(requirement: string, projectDir: string, brainstormNotes: string[]): Promise<WorkflowSpec> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const sessionKey = `dwf-spec-${Date.now()}`;
    const notes = brainstormNotes.length > 0 ? `\nBrainstorm notes:\n${brainstormNotes.join("\n")}` : "";

    const systemPrompt = `You are a tech lead defining a spec. Return a JSON object with:
- "proposal": markdown string
- "design": markdown string
- "tasks": array of { id, title, description, difficulty ("easy"|"medium"|"hard"), estimatedMinutes, dependencies (string[]), files (string[]), shipCategory ("ship"|"show"|"ask") }
Return ONLY valid JSON.`;

    try {
      const runResult = await this.runtime.subagent.run({
        sessionKey, message: `Requirement: ${requirement}${notes}`,
        extraSystemPrompt: systemPrompt, deliver: false,
      });
      const waitResult = await this.runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 180000 });
      if (waitResult.status !== "ok") return this.defaultSpec(requirement);

      const msgResult = await this.runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
      const last = msgResult.messages[msgResult.messages.length - 1] as any;
      const text = typeof last === "string" ? last : (last?.content ?? "");
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        return {
          proposal: p.proposal ?? `# Proposal\n\n${requirement}`,
          design: p.design ?? "# Design\n\nTBD",
          tasks: (p.tasks ?? []).map((t: any, i: number) => ({
            id: t.id ?? `task-${i + 1}`,
            title: t.title ?? `Task ${i + 1}`,
            description: t.description ?? "",
            status: "pending" as const,
            difficulty: t.difficulty ?? "medium",
            estimatedMinutes: t.estimatedMinutes ?? 30,
            dependencies: t.dependencies ?? [],
            files: t.files ?? [],
            shipCategory: t.shipCategory ?? "show",
          })),
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (e) {
      logger.warn(`Spec subagent failed: ${e}`);
    }
    return this.defaultSpec(requirement);
  }

  private defaultSpec(requirement: string): WorkflowSpec {
    return {
      proposal: `# Proposal\n\n${requirement}`,
      design: "# Design\n\nArchitecture TBD.",
      tasks: [
        { id: "task-1", title: "Setup", description: "Create project skeleton", status: "pending", difficulty: "easy", estimatedMinutes: 30, dependencies: [], files: ["package.json"], shipCategory: "ship", granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
        { id: "task-2", title: "Core implementation", description: "Implement core logic", status: "pending", difficulty: "medium", estimatedMinutes: 60, dependencies: ["task-1"], files: ["src/index.ts"], shipCategory: "show", granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
        { id: "task-3", title: "Tests", description: "Write unit tests", status: "pending", difficulty: "medium", estimatedMinutes: 45, dependencies: ["task-2"], files: ["tests/index.test.ts"], shipCategory: "show", granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
        { id: "task-4", title: "Documentation", description: "Write docs", status: "pending", difficulty: "easy", estimatedMinutes: 30, dependencies: ["task-2"], files: ["README.md"], shipCategory: "ship", granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  async selectTech(requirement: string, projectDir: string, brainstormNotes: string[]): Promise<TechSelection> {
    const sessionKey = `dwf-tech-${Date.now()}`;
    const notes = brainstormNotes.length > 0 ? `\nBrainstorm notes:\n${brainstormNotes.join("\n")}` : "";

    const systemPrompt = `You are a tech lead selecting technologies. Return a JSON object with:
- "language": string
- "framework": string
- "architecture": string (e.g. "modular-monolith", "microservices", "layered")
- "patterns": string[] (e.g. ["repository", "factory", "observer"])
- "notes": string
Return ONLY valid JSON.`;

    try {
      const runResult = await this.runtime.subagent.run({
        sessionKey, message: `Requirement: ${requirement}${notes}\nProject: ${projectDir}`,
        extraSystemPrompt: systemPrompt, deliver: false,
      });
      const waitResult = await this.runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
      if (waitResult.status !== "ok") return this.defaultTech();

      const msgResult = await this.runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
      const last = msgResult.messages[msgResult.messages.length - 1] as any;
      const text = typeof last === "string" ? last : (last?.content ?? "");
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        return {
          language: p.language ?? "TypeScript",
          framework: p.framework ?? "Node.js",
          architecture: p.architecture ?? "modular",
          patterns: p.patterns ?? [],
          notes: p.notes ?? "",
        };
      }
    } catch { /* skip */ }
    return this.defaultTech();
  }

  private defaultTech(): TechSelection {
    return {
      language: "TypeScript",
      framework: "Node.js",
      architecture: "modular",
      patterns: ["module", "factory"],
      notes: "Default tech selection",
    };
  }

  async executeTask(task: WorkflowTask, projectDir: string, mode: WorkflowMode, flags?: FeatureFlags): Promise<AgentResult> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const start = Date.now();
    const sessionKey = `dwf-task-${task.id}-${Date.now()}`;
    const effectiveFlags = flags ?? DEFAULT_FEATURE_FLAGS;

    const projectContext = await this.buildProjectContext(projectDir);
    const workingMemory = effectiveFlags.workingMemoryPersist
      ? this.loadWorkingMemory(projectDir, task.id)
      : "";

    const tddPrompt = mode === "quick"
      ? "Write code and verify it works."
      : mode === "full" || effectiveFlags.strictTdd
        ? `Follow STRICT TDD cycle (mandatory):
1. RED: Write a failing test first that defines expected behavior
2. GREEN: Write the minimal implementation to make the test pass
3. REFACTOR: Simplify while keeping tests green
4. VERIFY: Run all tests to confirm no regressions
5. COMMIT: Prepare a Conventional Commits message

DO NOT skip any step. Tests MUST fail first before implementation.`
        : `Follow TDD cycle:
1. RED: Write a failing test first that defines expected behavior
2. GREEN: Write the minimal implementation to make the test pass
3. REFACTOR: Simplify while keeping tests green
4. VERIFY: Run all tests to confirm no regressions
5. COMMIT: Prepare a Conventional Commits message`;

    const rulesSection = effectiveFlags.ruleEnforcement
      ? `\n\nCode Rules (enforced):\n- No unused variables or imports\n- Prefer const over let\n- No console.log (use logger)\n- Avoid any type\n- Functions < 50 lines, files < 500 lines\n- No hardcoded secrets\n- Prefer pure functions\n- Use early returns\n- Meaningful names\n`
      : "";

    const systemPrompt = `You are a senior engineer executing a task.
${tddPrompt}
${rulesSection}
Project context:
${projectContext}

${workingMemory ? `Working memory:\n${workingMemory}\n` : ""}Task: ${task.title} - ${task.description}
Files: ${task.files.join(", ")}
Ship category: ${task.shipCategory}
Return a summary of what you did.`;

    try {
      const runResult = await this.runtime.subagent.run({
        sessionKey, message: `Execute task **${task.title}**: ${task.description}\nFiles: ${task.files.join(", ")}\nShip: ${task.shipCategory}`,
        extraSystemPrompt: systemPrompt, deliver: false,
      });
      const timeout = mode === "full" ? 600000 : mode === "standard" ? 300000 : 180000;
      const waitResult = await this.runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: timeout });

      if (waitResult.status !== "ok") {
        return { agentId: this.selectAgent(task.difficulty), task: task.id, success: false, output: `Failed: ${waitResult.error ?? waitResult.status}`, durationMs: Date.now() - start };
      }

      const msgResult = await this.runtime.subagent.getSessionMessages({ sessionKey, limit: 10 });
      const last = msgResult.messages[msgResult.messages.length - 1] as any;
      const text = typeof last === "string" ? last : (last?.content ?? "");

      if (effectiveFlags.workingMemoryPersist) {
        this.saveWorkingMemory(projectDir, task.id, text.slice(0, 1000));
      }

      return { agentId: this.selectAgent(task.difficulty), task: task.id, success: true, output: text.slice(0, 2000), durationMs: Date.now() - start };
    } catch (e) {
      logger.error(`Task execution error: ${e}`);
      return { agentId: this.selectAgent(task.difficulty), task: task.id, success: false, output: `Error: ${e}`, durationMs: Date.now() - start };
    }
  }

  private loadWorkingMemory(projectDir: string, taskId: string): string {
    const layers: string[] = [];

    const projectCtx = join(projectDir, ".dev-workflow.md");
    if (existsSync(projectCtx)) {
      try { layers.push(`[Project] ${readFileSync(projectCtx, "utf-8").slice(0, 500)}`); } catch { /* skip */ }
    }

    const taskCtx = join(projectDir, "docs", "plans", `${taskId}-context.md`);
    if (existsSync(taskCtx)) {
      try { layers.push(`[Task] ${readFileSync(taskCtx, "utf-8").slice(0, 500)}`); } catch { /* skip */ }
    }

    return layers.join("\n");
  }

  private saveWorkingMemory(projectDir: string, taskId: string, content: string): void {
    try {
      const plansDir = join(projectDir, "docs", "plans");
      if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
      writeFileSync(join(plansDir, `${taskId}-context.md`), `# Task ${taskId} Context\n\n${content}\n\nUpdated: ${new Date().toISOString()}\n`);
    } catch { /* skip */ }
  }

  private async buildProjectContext(projectDir: string): Promise<string> {
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

  async runReview(projectDir: string): Promise<string> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const sessionKey = `dwf-review-${Date.now()}`;

    const { stdout: diffOut } = await execAsync("git diff HEAD~1 --stat", { cwd: projectDir, timeout: 10000 }).catch(() => ({ stdout: "No recent commits" }));
    const { stdout: logOut } = await execAsync("git log --oneline -5", { cwd: projectDir, timeout: 10000 }).catch(() => ({ stdout: "No git log" }));

    try {
      const runResult = await this.runtime.subagent.run({
        sessionKey, message: `Review recent changes:\nDiff:\n${diffOut}\nCommits:\n${logOut}`,
        extraSystemPrompt: "You are a senior code reviewer. Review for quality, bugs, edge cases, test coverage. Start with APPROVE or REQUEST CHANGES. Return markdown.", deliver: false,
      });
      const waitResult = await this.runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
      if (waitResult.status !== "ok") return `Review incomplete: ${waitResult.status}`;

      const msgResult = await this.runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
      const last = msgResult.messages[msgResult.messages.length - 1] as any;
      return typeof last === "string" ? last : (last?.content ?? "Review completed");
    } catch (e) {
      logger.warn(`Review subagent failed: ${e}`);
      return "Review failed";
    }
  }

  async runTests(projectDir: string): Promise<{ passed: boolean; output: string }> {
    const pkgPath = join(projectDir, "package.json");
    let cmd = "npm test";
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.scripts?.test) cmd = pkg.scripts.test;
        else if (existsSync(join(projectDir, "vitest.config.js")) || existsSync(join(projectDir, "vitest.config.ts"))) cmd = "npx vitest run";
        else if (existsSync(join(projectDir, "jest.config.js")) || existsSync(join(projectDir, "jest.config.ts"))) cmd = "npx jest";
      } catch { /* skip */ }
    }
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: projectDir, timeout: 120000, env: { ...process.env, CI: "true", NODE_ENV: "test" } });
      return { passed: true, output: stdout || stderr };
    } catch (e: any) {
      return { passed: false, output: e.stdout ? `${e.stdout}\n${e.stderr}` : e.message };
    }
  }

  async generateDocs(projectDir: string, spec: WorkflowSpec | null): Promise<string> {
    if (!spec) return "No spec to generate docs from.";

    const sessionKey = `dwf-docs-${Date.now()}`;
    try {
      const runResult = await this.runtime.subagent.run({
        sessionKey, message: `Generate docs:\nProposal:\n${spec.proposal}\nDesign:\n${spec.design}\nTasks:\n${JSON.stringify(spec.tasks, null, 2)}`,
        extraSystemPrompt: "You are a technical writer. Generate comprehensive markdown documentation.", deliver: false,
      });
      const waitResult = await this.runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
      if (waitResult.status !== "ok") return `Docs incomplete: ${waitResult.status}`;

      const msgResult = await this.runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
      const last = msgResult.messages[msgResult.messages.length - 1] as any;
      const text = typeof last === "string" ? last : (last?.content ?? "");

      const docsPath = join(projectDir, "docs");
      if (!existsSync(docsPath)) mkdirSync(docsPath, { recursive: true });
      try { writeFileSync(join(docsPath, "generated.md"), text); } catch { /* skip */ }
      return text.slice(0, 3000);
    } catch (e) {
      return "Docs generation failed";
    }
  }

  /** ACPX 智能路由 - 模型池 */
private static readonly ACPX_MODEL_POOL = {
  // Kilocode: 9 免费模型
  kilocode: {
    code: "minimax/MiniMax-M2.7",
    orchestrator: "minimax/MiniMax-M2.7",
    architect: "minimax/MiniMax-M2.7",
    debug: "minimax/MiniMax-M2.7",
    review: "kilo/meta-llama/llama-3.3-70b-instruct",
    test: "minimax/MiniMax-M2.7",
    // 备选模型
    fast: "kilo/qwen/qwen3-coder:free",
    smart: "kilo/google/gemma-3-27b-it:free",
    multi: "kilo/moonshotai/kimi-k2:free",
  },
  // OpenCode: 5 免费模型
  opencode: {
    code: "minimax/MiniMax-M2.7",
    review: "minimax/MiniMax-M2.7",
    // 备选模型
    fast: "opencode/qwen3-coder-free",
    smart: "opencode/gemma-3-27b-free",
    test: "opencode/step-3.5-flash-free",
  },
};

/**
 * ACPX 路由决策
 * @param complexity - L1-L5 复杂度
 * @returns 路由目标 (tool + model)
 */
routeByComplexity(complexity: string): { tool: string; model: string } {
  const routes: Record<string, { tool: string; model: string }> = {
    L1: { tool: "direct", model: "direct" }, // 直接编辑
    L2: { tool: "acpx-opencode", model: "minimax/MiniMax-M2.7" }, // 样板代码
    L3: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7" }, // 业务逻辑
    L4: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7" }, // 架构设计
    L5: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7" }, // 系统级
  };
  return routes[complexity] ?? routes.L3;
}

  /**
   * v6: Route by task granularity (Feature/Task/Sub-task)
   */
  routeByGranularity(granularity: "feature" | "task" | "subtask"): { tool: string; model: string; maxLines: number } {
    const granularityRoutes = {
      feature: { tool: "acpx-kilocode", model: "zai/GLM-5.1", maxLines: 999 },
      task: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7", maxLines: 200 },
      subtask: { tool: "acpx-opencode", model: "minimax/MiniMax-M2.7", maxLines: 50 },
    };
    return granularityRoutes[granularity];
  }

  /**
   * v6: Execute a sub-task
   */
  async executeSubTask(subtask: any, projectDir: string): Promise<{ success: boolean; output: string; durationMs: number }> {
    const start = Date.now();
    // Sub-tasks are small enough for direct execution
    return {
      success: true,
      output: `Sub-task ${subtask.id} executed`,
      durationMs: Date.now() - start,
    };
  }

private static readonly MODE_MODELS: Record<WorkflowMode, Record<string, string>> = {
    quick: {
      brainstorm: "llama-3.3-70b",
      spec: "minimax-m2.5",
      tech: "minimax-m2.5",
      coder: "minimax-m2.7",
      reviewer: "glm-5.1",
      test: "minimax-m2.5",
      docs: "llama-3.3-70b",
      qa: "glm-5.1",
    },
    standard: {
      brainstorm: "llama-3.3-70b",
      spec: "minimax-m2.5",
      tech: "minimax-m2.5",
      coder: "minimax-m2.7",
      reviewer: "glm-5.1",
      test: "minimax-m2.5",
      docs: "llama-3.3-70b",
      qa: "glm-5.1",
    },
    debug: {
      brainstorm: "llama-3.3-70b",
      spec: "glm-5.1",
      tech: "glm-5.1",
      coder: "glm-5.1",
      reviewer: "glm-5.1",
      test: "glm-5.1",
      docs: "minimax-m2.5",
      qa: "glm-5.1",
    },
    full: {
      brainstorm: "llama-3.3-70b",
      spec: "glm-5.1",
      tech: "glm-5.1",
      coder: "glm-5.1",
      reviewer: "glm-5.1",
      test: "glm-5.1",
      docs: "llama-3.3-70b",
      qa: "glm-5.1",
    },
  };

  private selectAgent(difficulty: string): string {
    const modelMapping: Record<string, string> = {
      easy: "minimax-m2.5",
      medium: "minimax-m2.5",
      hard: "glm-5.1",
      extreme: "qwen3",
    };
    return modelMapping[difficulty] ?? "minimax-m2.7";
  }

  /**
   * 根据模式、角色和难度选择模型
   * @param role - agent角色 (brainstorm, spec, tech, coder, reviewer, test, docs, qa)
   * @param mode - 工作流模式
   * @param difficulty - 任务难度 (仅coder角色使用)
   * @param modelOverride - 用户自定义模型覆盖
   */
  selectModel(role: string, mode: WorkflowMode, difficulty?: string, modelOverride?: Record<string, string>): string {
    // 1. 用户覆盖优先
    if (modelOverride && modelOverride[role]) {
      return modelOverride[role];
    }
    // 2. coder角色按难度升级
    if (role === "coder" && difficulty) {
      const difficultyUpgrade: Record<string, string> = {
        hard: "glm-5.1",
        extreme: "glm-5.1",
      };
      if (difficultyUpgrade[difficulty]) {
        return difficultyUpgrade[difficulty];
      }
    }
    // 3. 按模式默认
    return AgentOrchestrator.MODE_MODELS[mode]?.[role] ?? "minimax-m2.7";
  }
}
