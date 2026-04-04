import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";

export class TaskExecuteTool implements AnyAgentTool {
  name = "task_execute";
  label = "Execute Task";
  description = "Execute a specific task in the current workflow by task ID.";
  parameters = z.object({
    taskId: z.string().describe("The ID of the task to execute (e.g., task-1)"),
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

    const orchestrator = engine.getOrchestrator();
    const ctx = context!;
    const result = await orchestrator.executeTask(task, ctx.projectDir, ctx.mode);
    const resultText = result.success
      ? `Task ${task.id} (${task.title}) completed successfully in ${result.durationMs}ms.\n\n${result.output}`
      : `Task ${task.id} (${task.title}) failed: ${result.output}`;

    return {
      content: [{ type: "text" as const, text: resultText }],
      details: result,
    };
  }
}
