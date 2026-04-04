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
        { id: "task-1", title: "Setup", description: "Create project skeleton", status: "pending", difficulty: "easy", estimatedMinutes: 30, dependencies: [], files: ["package.json"], shipCategory: "ship" },
        { id: "task-2", title: "Core implementation", description: "Implement core logic", status: "pending", difficulty: "medium", estimatedMinutes: 60, dependencies: ["task-1"], files: ["src/index.ts"], shipCategory: "show" },
        { id: "task-3", title: "Tests", description: "Write unit tests", status: "pending", difficulty: "medium", estimatedMinutes: 45, dependencies: ["task-2"], files: ["tests/index.test.ts"], shipCategory: "show" },
        { id: "task-4", title: "Documentation", description: "Write docs", status: "pending", difficulty: "easy", estimatedMinutes: 30, dependencies: ["task-2"], files: ["README.md"], shipCategory: "ship" },
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

  private selectAgent(difficulty: string): string {
    return difficulty === "hard" ? "glm-5.1" : "minimax-m2.5";
  }
}
