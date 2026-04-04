import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";

export class WorkflowStatusTool implements AnyAgentTool {
  name = "workflow_status";
  label = "Workflow Status";
  description = "Check the current status of a dev workflow, including completed steps, active tasks, and QA gate results.";
  parameters = z.object({});

  async execute(_toolCallId: string, _input: z.infer<typeof this.parameters>) {
    const engine = getEngine();
    const context = engine.getContext();

    if (!context) {
      return {
        content: [{ type: "text" as const, text: "No active workflow. Start one with dev_workflow_start first." }],
        details: { success: false, error: "No active workflow" },
      };
    }

    const result = {
      success: true,
      projectId: context.projectId,
      mode: context.mode,
      currentStep: context.currentStep,
      tasksCompleted: context.spec?.tasks.filter((t) => t.status === "completed").length ?? 0,
      tasksTotal: context.spec?.tasks.length ?? 0,
      decisions: context.decisions,
      qaGateResults: context.qaGateResults,
      duration: this.calculateDuration(context.startedAt),
    };

    const statusText = [
      `**Workflow Status**`,
      `Project: ${context.projectId}`,
      `Mode: ${context.mode}`,
      `Step: ${context.currentStep}`,
      `Tasks: ${result.tasksCompleted}/${result.tasksTotal} completed`,
      `Duration: ${result.duration}`,
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: statusText }],
      details: result,
    };
  }

  private calculateDuration(startedAt: string): string {
    const elapsed = Date.now() - new Date(startedAt).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
