import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";

export class SpecViewTool implements AnyAgentTool {
  name = "spec_view";
  label = "View Spec";
  description = "View the current workflow specification including proposal, design, and task list.";
  parameters = z.object({
    section: z.enum(["proposal", "design", "tasks", "all"]).optional().describe("Which section to view (default: all)"),
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

    const spec = context.spec;
    const section = input.section ?? "all";

    let text = "";
    let details: any;

    if (section === "proposal") {
      text = spec.proposal;
      details = { success: true, proposal: spec.proposal };
    } else if (section === "design") {
      text = spec.design;
      details = { success: true, design: spec.design };
    } else if (section === "tasks") {
      text = spec.tasks.map((t) => `- [${t.status === "completed" ? "x" : " "}] **${t.id}**: ${t.title} (${t.difficulty}, ~${t.estimatedMinutes}min)`).join("\n");
      details = {
        success: true,
        tasks: spec.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          difficulty: t.difficulty,
          estimatedMinutes: t.estimatedMinutes,
          dependencies: t.dependencies,
        })),
      };
    } else {
      text = `${spec.proposal}\n\n---\n\n${spec.design}\n\n---\n\n## Tasks\n\n${spec.tasks.map((t) => `- [${t.status === "completed" ? "x" : " "}] **${t.id}**: ${t.title} (${t.difficulty}, ~${t.estimatedMinutes}min)`).join("\n")}`;
      details = {
        success: true,
        proposal: spec.proposal,
        design: spec.design,
        tasks: spec.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          difficulty: t.difficulty,
          estimatedMinutes: t.estimatedMinutes,
          dependencies: t.dependencies,
        })),
        updatedAt: spec.updatedAt,
      };
    }

    return {
      content: [{ type: "text" as const, text }],
      details,
    };
  }
}
