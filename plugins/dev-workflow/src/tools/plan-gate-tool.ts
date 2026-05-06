import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";
import type { WorkflowMode } from "../types.js";

export class PlanGateTool implements AnyAgentTool {
  name = "plan_gate";
  label = "Plan Gate";
  description = "Review and confirm the implementation plan before development begins. Shows file list, execution order, dependencies, and risk assessment. Blocks write access until confirmed.";
  parameters = z.object({
    action: z.enum(["review", "confirm", "modify"]).describe("Action: review the plan, confirm to proceed, or request modifications"),
    projectDir: z.string().optional().describe("Project directory (uses current context if not provided)"),
    feedback: z.string().optional().describe("Feedback when requesting modifications"),
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

    if (input.action === "confirm") {
      // T-A1: Resolve the engine's plan gate wait promise, triggering write access upgrade
      engine.resolvePlanGate();
      return {
        content: [{ type: "text" as const, text: "✅ Plan Gate confirmed. Write access unlocked. Development can begin." }],
        details: {
          success: true,
          permissionLevel: "WorkspaceWrite",
          message: "Plan Gate passed — write access granted",
        },
      };
    }

    if (input.action === "modify") {
      return {
        content: [{ type: "text" as const, text: `🔒 Plan Gate: modification requested.\n\nFeedback: ${input.feedback ?? "No feedback provided"}\n\nPlease revise the plan and re-submit for review.` }],
        details: {
          success: false,
          permissionLevel: "ReadOnly",
          message: "Plan Gate blocked — modifications required",
          feedback: input.feedback,
        },
      };
    }

    const spec = context.spec;
    const tasks = spec.tasks;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const total = tasks.length;

    const filesToCreate: string[] = [];
    const filesToModify: string[] = [];
    const executionOrder: string[] = [];

    for (const task of tasks) {
      if (task.status === "pending") {
        executionOrder.push(`${task.id}: ${task.title} [${task.difficulty}, ${task.granularity ?? "task"}, ~${task.estimatedMinutes}min]`);
        for (const file of task.files) {
          if (file.includes("test") || file.includes("spec")) {
            filesToCreate.push(file);
          } else {
            filesToModify.push(file);
          }
        }
      }
    }

    const riskLevel = this.assessRisk(context.mode, tasks);
    const permissionLevel = this.getPermissionLevel(context.mode);

    const planText = [
      "📋 **实施计划确认**",
      "",
      `**项目**: ${context.projectId}`,
      `**模式**: ${context.mode}`,
      `**任务**: ${completed}/${total} completed, ${pending} pending`,
      "",
      "**将要执行的操作：**",
      "",
      filesToCreate.length > 0 ? `**创建文件：**\n${filesToCreate.map((f) => `  - ${f}`).join("\n")}` : "创建文件：无",
      "",
      filesToModify.length > 0 ? `**修改文件：**\n${filesToModify.map((f) => `  - ${f}`).join("\n")}` : "修改文件：无",
      "",
      `**执行顺序：**\n${executionOrder.map((e) => `  ${e}`).join("\n")}`,
      "",
      `**风险评估：** ${riskLevel}`,
      `**权限级别：** ${permissionLevel}`,
      "",
      "**权限说明：**",
      permissionLevel === "🔒 ReadOnly" ? "- 当前为只读模式，无法创建/修改文件" : "",
      permissionLevel === "🔓 WorkspaceWrite" ? "- 已解锁写权限，可以创建/修改文件" : "",
      permissionLevel === "⚠️ DangerFullAccess" ? "- 需要额外授权才能执行破坏性操作" : "",
      "",
      "请确认 **开始开发** 以解锁执行，或提出修改意见。",
    ].filter(Boolean).join("\n");

    return {
      content: [{ type: "text" as const, text: planText }],
      details: {
        success: true,
        permissionLevel,
        riskLevel,
        filesToCreate,
        filesToModify,
        executionOrder,
        tasksPending: pending,
        tasksCompleted: completed,
      },
    };
  }

  private assessRisk(mode: WorkflowMode, tasks: any[]): string {
    const hasAsk = tasks.some((t) => t.shipCategory === "ask");
    const hasHard = tasks.some((t) => t.difficulty === "hard");
    const fileCount = tasks.reduce((sum, t) => sum + t.files.length, 0);

    if (mode === "full" || hasAsk || hasHard) return "🔴 高";
    if (fileCount > 10 || mode === "standard") return "🟡 中";
    return "🟢 低";
  }

  private getPermissionLevel(mode: WorkflowMode): string {
    switch (mode) {
      case "quick":
        return "🔓 WorkspaceWrite";
      case "standard":
        return "🔓 WorkspaceWrite";
      case "full":
        return "🔒 ReadOnly → 确认后解锁 🔓 WorkspaceWrite";
      default:
        return "🔒 ReadOnly";
    }
  }
}
