import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowSpec } from "../../types.js";

export function defaultSpec(requirement: string): WorkflowSpec {
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

export async function defineSpec(runtime: PluginRuntime, requirement: string, projectDir: string, brainstormNotes: string[]): Promise<WorkflowSpec> {
  const logger = runtime.logging.getChildLogger({ level: "info" });
  const sessionKey = `dwf-spec-${Date.now()}`;
  const notes = brainstormNotes.length > 0 ? `\nBrainstorm notes:\n${brainstormNotes.join("\n")}` : "";
  const systemPrompt = `You are a tech lead defining a spec. Return a JSON object with:
- "proposal": markdown string
- "design": markdown string
- "tasks": array of { id, title, description, difficulty ("easy"|"medium"|"hard"), estimatedMinutes, dependencies (string[]), files (string[]), shipCategory ("ship"|"show"|"ask") }
Return ONLY valid JSON.`;
  try {
    const runResult = await runtime.subagent.run({ sessionKey, message: `Requirement: ${requirement}${notes}`, extraSystemPrompt: systemPrompt, deliver: false });
    const waitResult = await runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 180000 });
    if (waitResult.status !== "ok") return defaultSpec(requirement);
    const msgResult = await runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
    const last = msgResult.messages[msgResult.messages.length - 1] as any;
    const text = typeof last === "string" ? last : (last?.content ?? "");
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      return {
        proposal: p.proposal ?? `# Proposal\n\n${requirement}`,
        design: p.design ?? "# Design\n\nTBD",
        tasks: (p.tasks ?? []).map((t: any, i: number) => ({
          id: t.id ?? `task-${i + 1}`, title: t.title ?? `Task ${i + 1}`, description: t.description ?? "",
          status: "pending" as const, difficulty: t.difficulty ?? "medium", estimatedMinutes: t.estimatedMinutes ?? 30,
          dependencies: t.dependencies ?? [], files: t.files ?? [], shipCategory: t.shipCategory ?? "show",
        })),
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (e) { logger.warn(`Spec subagent failed: ${e}`); }
  return defaultSpec(requirement);
}
