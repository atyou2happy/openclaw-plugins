import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";
import { runCheck } from "./qa-checks.js";

export class QAGateTool implements AnyAgentTool {
  name = "qa_gate_check";
  label = "QA Gate Check";
  description = "Run QA gate check with blocking/non-blocking mode. Auto-trigger after each task (v2 enhancement).";
  parameters = z.object({
    projectDir: z.string().describe("Absolute path to the project directory"),
    checks: z.array(z.enum(["lint", "format", "tests", "coverage", "typecheck", "simplify", "commits", "todos", "docs", "rules", "boundary", "integration", "performance"])).optional().describe("Specific checks to run (default: all)"),
    blocking: z.boolean().optional().describe("If true, failed checks block workflow (default: false)"),
    taskId: z.string().optional().describe("Task ID for auto-trigger mode"),
    subtaskId: z.string().optional().describe("Sub-task ID for v6 subtask gate check"),
    gateLevel: z.enum(["subtask", "task"]).optional().describe("v6: gate level - subtask (3 gates) or task (5 gates)")
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const engine = getEngine();
    const context = engine.getContext();

    if (!context) {
      return {
        content: [{ type: "text" as const, text: "No active workflow. Start one first." }],
        details: { success: false, error: "No active workflow" },
      };
    }

    const checksToRun = input.checks ?? ["lint", "format", "tests", "coverage", "typecheck", "simplify", "commits", "todos", "docs", "rules"];
    const results: Array<{ name: string; passed: boolean; output?: string }> = [];

    for (const check of checksToRun) {
      const result = await runCheck(check, input.projectDir);
      results.push(result);
    }

    context.qaGateResults = results;

    const allPassed = results.every((r) => r.passed);
    const failed = results.filter((r) => !r.passed);

    const summaryText = results.map((r) => `${r.passed ? "✅" : "❌"} ${r.name}: ${r.output ?? ""}`).join("\n");

    return {
      content: [{ type: "text" as const, text: summaryText }],
      details: {
        success: allPassed,
        checks: results,
        summary: allPassed
          ? "All QA gate checks passed."
          : `${failed.length} check(s) failed: ${failed.map((f) => f.name).join(", ")}`,
        failedChecks: failed.map((f) => f.name),
        ...(input.blocking && !allPassed ? { blockingFailed: true } : {}),
      },
    };
  }
}

export { runCheck } from "./qa-checks.js";
