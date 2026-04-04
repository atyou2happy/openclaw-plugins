import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";
import type { FeatureFlags } from "../types.js";

export class DevWorkflowTool implements AnyAgentTool {
  name = "dev_workflow_start";
  label = "Start Dev Workflow";
  description = "Start an AI-driven development workflow for a given requirement. Supports quick, standard, and full complexity modes with configurable feature flags.";
  parameters = z.object({
    requirement: z.string().describe("The development requirement or feature request"),
    projectDir: z.string().describe("Absolute path to the project directory"),
    mode: z.enum(["quick", "standard", "full"]).optional().describe("Complexity mode (default: standard)"),
    featureFlags: z.object({
      strictTdd: z.boolean().optional(),
      ruleEnforcement: z.boolean().optional(),
      autoCommit: z.boolean().optional(),
      workingMemoryPersist: z.boolean().optional(),
      dependencyParallelTasks: z.boolean().optional(),
      conventionalCommits: z.boolean().optional(),
      qaGateBlocking: z.boolean().optional(),
      githubIntegration: z.boolean().optional(),
      coverageThreshold: z.number().optional(),
      maxFileLines: z.number().optional(),
      maxFunctionLines: z.number().optional(),
    }).optional().describe("Optional feature flag overrides"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const engine = getEngine();
    const context = await engine.initialize(input.projectDir, input.mode ?? "standard", input.featureFlags as Partial<FeatureFlags>);
    const report = await engine.executeWorkflow(input.requirement);

    const result = {
      success: true,
      context: {
        projectId: context.projectId,
        mode: context.mode,
        currentStep: context.currentStep,
        tasksCount: context.spec?.tasks.length ?? 0,
      },
      report,
    };

    return {
      content: [{ type: "text" as const, text: report }],
      details: result,
    };
  }
}
