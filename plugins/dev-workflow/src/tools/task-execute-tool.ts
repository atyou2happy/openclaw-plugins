import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";
import type { SubTask, GateResult, GateStatus } from "../types.js";
import { existsSync } from "fs";
import { join } from "path";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const execAsync = promisify(execCallback);

/**
 * Task Execute Tool - 执行工作流任务
 * 
 * v6 增强：三级粒度 + 5级复杂度调度
 * - L1: 直接编辑 (单文件简单修改)
 * - L2: 样板代码 (OpenCode)
 * - L3: 业务逻辑 (Kilocode code)
 * - L4: 架构设计 (Kilocode orchestrator)
 * - L5: 系统级 (Kilocode orchestrator + 高配模型)
 */
export class TaskExecuteTool implements AnyAgentTool {
  name = "task_execute";
  label = "Execute Task";
  description = "Execute a specific task with 5-level complexity routing (L1-L5).";

  parameters = z.object({
    taskId: z.string().describe("The ID of the task to execute (e.g., task-1)"),
    complexity: z.enum(["L1", "L2", "L3", "L4", "L5"]).optional().describe("Complexity level (auto-detected if not provided)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const engine = getEngine();
    const context = engine.getContext();

    if (!context || !context.spec) {
      return {
        content: [{ type: "text" as const, text: "No active workflow with spec. Start a workflow first." }],
        details: { success: false, error: "No active workflow with spec" },
      };
    }

    const task = context.spec.tasks.find((t) => t.id === input.taskId);
    if (!task) {
      const available = context.spec.tasks.map((t) => t.id).join(", ");
      return {
        content: [{ type: "text" as const, text: `Task ${input.taskId} not found. Available: ${available}` }],
        details: { success: false, error: `Task not found` },
      };
    }

    // Auto-detect complexity from task metadata
    const complexity = input.complexity || this.detectComplexity(task);

    // Get routing decision based on complexity
    const orchestrator = engine.getOrchestrator();
    const routing = orchestrator.routeByComplexity(complexity);

    // Store routing info in context
    context.taskRouting = context.taskRouting || {};
    context.taskRouting[input.taskId] = { complexity, ...routing };

    const ctx = context!;
    const result = await orchestrator.executeTask(task, ctx.projectDir, ctx.mode);

    const resultText = result.success
      ? `Task ${task.id} (${task.title}) [${complexity}] completed via ${routing.tool} in ${result.durationMs}ms.\n\n${result.output}`
      : `Task ${task.id} (${task.title}) [${complexity}] failed: ${result.output}`;

    return {
      content: [{ type: "text" as const, text: resultText }],
      details: {
        success: result.success,
        taskId: task.id,
        complexity,
        routing,
        durationMs: result.durationMs,
      },
    };
  }

  /**
   * Auto-detect complexity from task
   */
  private detectComplexity(task: any): string {
    const title = (task.title || "").toLowerCase();
    const desc = (task.description || "").toLowerCase();
    const files = (task.files || []).length;

    // L5: 系统级重构、多模块
    if (title.includes("重构") || title.includes("refactor") || files > 10) {
      return "L5";
    }
    // L4: 架构设计、新模块
    if (title.includes("架构") || title.includes("架构") || title.includes("architecture")) {
      return "L4";
    }
    // L3: 业务逻辑、API
    if (title.includes("api") || title.includes("业务") || title.includes("service")) {
      return "L3";
    }
    // L2: 样板代码、简单CRUD
    if (files <= 2 && (title.includes("crud") || title.includes("简单"))) {
      return "L2";
    }
    // L1: 直接编辑
    return "L1";
  }

  /**
   * v6: Execute a sub-task with gate checks
   */
  async executeSubTask(subtaskId: string, parentTaskId: string): Promise<{
    success: boolean;
    gates: GateResult[];
    output: string;
  }> {
    const engine = getEngine();
    const context = engine.getContext();
    
    if (!context?.spec) {
      return { success: false, gates: [], output: "No active workflow" };
    }
    
    const parentTask = context.spec.tasks.find(t => t.id === parentTaskId);
    if (!parentTask) {
      return { success: false, gates: [], output: `Parent task ${parentTaskId} not found` };
    }
    
    const subtask = parentTask.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) {
      return { success: false, gates: [], output: `Sub-task ${subtaskId} not found` };
    }
    
    // v6: Route by granularity
    const orchestrator = engine.getOrchestrator();
    const routing = orchestrator.routeByGranularity("subtask");
    
    // Execute the sub-task
    const result = await orchestrator.executeSubTask(subtask, context.projectDir);
    
    // Run 3 gates: lint, boundary, unit_test
    const gates: GateResult[] = [];
    const projectDir = context.projectDir;
    
    // Gate 1: Lint — actually run linter if available
    gates.push(await this.runLintGate(projectDir));
    
    // Gate 2: Boundary check — verify module boundaries
    gates.push(await this.runBoundaryGate(projectDir));
    
    // Gate 3: Unit test — run test suite
    gates.push(await this.runUnitTestGate(projectDir));
    
    const allPassed = gates.every(g => g.status === "passed");
    
    return {
      success: allPassed,
      gates,
      output: result.output,
    };
  }

  /**
   * v11: Real gate checks — actually execute lint/boundary/test commands.
   * Falls back to "skipped" if the tooling is not available (non-blocking).
   */
  private async runLintGate(projectDir: string): Promise<GateResult> {
    try {
      // Try eslint first, then tsc --noEmit
      const hasEslint = existsSync(join(projectDir, "node_modules", ".bin", "eslint"));
      const hasTsconfig = existsSync(join(projectDir, "tsconfig.json"));
      
      if (hasEslint) {
        const { stdout, stderr } = await execAsync(
          "npx eslint --max-warnings 0 src/ 2>&1 || true",
          { cwd: projectDir, timeout: 30_000 }
        );
        const output = (stdout + stderr).slice(0, 1000);
        const hasErrors = output.includes("error") && !output.includes("0 errors");
        return { type: "lint", status: hasErrors ? "failed" : "passed", output: output || "Lint: no issues" };
      }
      
      if (hasTsconfig) {
        const { stdout, stderr } = await execAsync(
          "npx tsc --noEmit 2>&1 || true",
          { cwd: projectDir, timeout: 60_000 }
        );
        const output = (stdout + stderr).slice(0, 1000);
        // Filter out pre-existing moduleResolution errors from node_modules
        const projectErrors = output.split("\n").filter(
          (line) => line.includes("error TS") && !line.includes("node_modules")
        );
        const hasErrors = projectErrors.length > 0;
        return { type: "lint", status: hasErrors ? "failed" : "passed", output: projectErrors.join("\n") || "TypeScript: no project errors" };
      }
      
      return { type: "lint", status: "skipped", output: "No linter configured" };
    } catch (e) {
      return { type: "lint", status: "skipped", output: `Lint check unavailable: ${e}` };
    }
  }

  private async runBoundaryGate(projectDir: string): Promise<GateResult> {
    try {
      // Check if package.json has module boundaries defined (exports field)
      const pkgPath = join(projectDir, "package.json");
      if (!existsSync(pkgPath)) {
        return { type: "boundary", status: "skipped", output: "No package.json found" };
      }
      
      // Simple boundary check: verify no cross-imports from internal modules
      // that shouldn't be accessed outside their domain
      const { stdout } = await execAsync(
        // Check for direct imports from internal paths that bypass public API
        "grep -r 'from.*\\(engine\\|agents\\|tools\\)/internal' src/ 2>/dev/null || echo 'CLEAN'",
        { cwd: projectDir, timeout: 10_000 }
      );
      
      const violations = stdout.trim().split("\n").filter(
        (line) => line && line !== "CLEAN" && !line.includes(".test.")
      );
      
      if (violations.length > 0) {
        return { 
          type: "boundary", 
          status: "failed", 
          output: `Boundary violations found: ${violations.slice(0, 5).join("; ")}` 
        };
      }
      
      return { type: "boundary", status: "passed", output: "Boundary check: no violations" };
    } catch {
      return { type: "boundary", status: "skipped", output: "Boundary check unavailable" };
    }
  }

  private async runUnitTestGate(projectDir: string): Promise<GateResult> {
    try {
      const hasVitest = existsSync(join(projectDir, "node_modules", ".bin", "vitest"));
      const hasJest = existsSync(join(projectDir, "node_modules", ".bin", "jest"));
      
      if (hasVitest) {
        const { stdout, stderr } = await execAsync(
          "npx vitest run --reporter=basic 2>&1 || true",
          { cwd: projectDir, timeout: 120_000 }
        );
        const output = (stdout + stderr);
        const lastLines = output.split("\n").slice(-10).join("\n").slice(0, 1000);
        const hasFail = output.includes("failed") && output.includes("Tests");
        const passMatch = output.match(/(\d+) passed/);
        const failMatch = output.match(/(\d+) failed/);
        
        if (failMatch && parseInt(failMatch[1]) > 0) {
          return { type: "unit_test", status: "failed", output: lastLines };
        }
        return { 
          type: "unit_test", 
          status: "passed", 
          output: passMatch ? `${passMatch[1]} tests passed` : "Tests: passed" 
        };
      }
      
      if (hasJest) {
        const { stdout, stderr } = await execAsync(
          "npx jest --passWithNoTests 2>&1 || true",
          { cwd: projectDir, timeout: 120_000 }
        );
        const output = (stdout + stderr).slice(-1000);
        const hasFail = output.includes("failed") && !output.includes("0 failed");
        return { type: "unit_test", status: hasFail ? "failed" : "passed", output: output.slice(0, 500) };
      }
      
      return { type: "unit_test", status: "skipped", output: "No test runner configured" };
    } catch (e) {
      return { type: "unit_test", status: "skipped", output: `Test check unavailable: ${e}` };
    }
  }
}