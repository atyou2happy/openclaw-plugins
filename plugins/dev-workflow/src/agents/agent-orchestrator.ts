import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type {
  WorkflowTask, WorkflowMode, WorkflowSpec, BrainstormOption,
  AgentResult, TechSelection, FeatureFlags,
} from "../types.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Phase modules
import { gitPrepare } from "./phases/git-prepare.js";
import { runAnalysis, analyzeRequirement } from "./phases/analysis.js";
import { brainstorm } from "./phases/brainstorm.js";
import { defineSpec } from "./phases/spec.js";
import { selectTech } from "./phases/tech-selection.js";
import { executeTask, executeSubTask } from "./phases/task-execution.js";
import { runReview } from "./phases/review.js";
import { runTests } from "./phases/testing.js";
import { generateDocs } from "./phases/docs.js";
import { routeByComplexity, routeByGranularity, selectAgent, selectModel } from "./phases/routing.js";

// Re-export for backward compatibility
export { routeByComplexity, routeByGranularity, selectAgent, selectModel } from "./phases/routing.js";
export { runAnalysis, analyzeRequirement } from "./phases/analysis.js";

export class AgentOrchestrator {
  private runtime: PluginRuntime;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  // ─── Delegated methods ───

  async gitPrepare(projectDir: string, taskName?: string) {
    return gitPrepare(this.runtime, projectDir, taskName);
  }

  // T-D1 fix: returns NEW step names (step3-brainstorm, etc.) to match engine step IDs.
  // Logic:
  //   ultra  = minimal: no brainstorm/tech/docs/review (like quick but no dev branch either)
  //   quick  = no brainstorm/tech/docs, YES review+test+dev (most common)
  //   standard = all steps EXCEPT docs (includes brainstorm+tech)
  //   full   = all steps
  //   debug  = all steps (same as full)
  getSkippedSteps(mode: WorkflowMode): string[] {
    switch (mode) {
      case "ultra":    return ["step3-brainstorm", "step5-tech-selection", "step8-review", "step9-test", "step11-docs"];
      case "quick":    return ["step3-brainstorm", "step5-tech-selection", "step11-docs"];
      case "standard": return ["step11-docs"];
      case "full":     return [];
      case "debug":    return [];
      default:         return [];
    }
  }

  async loadHandover(projectDir: string): Promise<{ found: boolean; content: string }> {
    const handoverPath = join(projectDir, "docs", "handover.md");
    if (!existsSync(handoverPath)) return { found: false, content: "" };
    try {
      const content = readFileSync(handoverPath, "utf-8");
      return { found: true, content };
    } catch { return { found: false, content: "" }; }
  }

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

  async runAnalysis(projectDir: string) { return runAnalysis(this.runtime, projectDir); }

  async analyzeRequirement(requirement: string, projectDir: string, mode: WorkflowMode) {
    return analyzeRequirement(this.runtime, requirement, projectDir, mode);
  }

  async brainstorm(requirement: string, projectDir: string) {
    return brainstorm(this.runtime, requirement, projectDir);
  }

  async defineSpec(requirement: string, projectDir: string, brainstormNotes: string[]) {
    return defineSpec(this.runtime, requirement, projectDir, brainstormNotes);
  }

  async selectTech(requirement: string, projectDir: string, brainstormNotes: string[]) {
    return selectTech(this.runtime, requirement, projectDir, brainstormNotes);
  }

  async executeTask(task: WorkflowTask, projectDir: string, mode: WorkflowMode, flags?: FeatureFlags): Promise<AgentResult> {
    return executeTask(this.runtime, task, projectDir, mode, flags);
  }

  async executeSubTask(subtask: any, projectDir: string) {
    return executeSubTask(subtask, projectDir);
  }

  async runReview(projectDir: string) { return runReview(this.runtime, projectDir); }

  async runTests(projectDir: string) { return runTests(projectDir); }

  async generateDocs(projectDir: string, spec: WorkflowSpec | null) {
    return generateDocs(this.runtime, projectDir, spec);
  }

  routeByComplexity(complexity: string) { return routeByComplexity(complexity); }

  routeByGranularity(granularity: "feature" | "task" | "subtask") { return routeByGranularity(granularity); }

  private selectAgentLocal(difficulty: string): string { return selectAgent(difficulty); }

  selectModel(role: string, mode: WorkflowMode, difficulty?: string, modelOverride?: Record<string, string>): string {
    return selectModel(role, mode, difficulty, modelOverride);
  }
}
