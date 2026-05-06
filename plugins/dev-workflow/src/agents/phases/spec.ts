import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowSpec } from "../../types.js";
import { DEFAULT_MODEL } from "../../constants.js";

export function defaultSpec(requirement: string): WorkflowSpec {
  return {
    proposal: `# Proposal\n\n${requirement}`,
    design: "# Design\n\nArchitecture TBD.",
    tasks: [
      { id: "task-1", title: "Setup", description: "Create project skeleton", status: "pending" as const, difficulty: "easy" as const, estimatedMinutes: 30, dependencies: [], files: ["package.json"], shipCategory: "ship" as const, granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
      { id: "task-2", title: "Core implementation", description: "Implement core logic", status: "pending" as const, difficulty: "medium" as const, estimatedMinutes: 60, dependencies: ["task-1"], files: ["src/index.ts"], shipCategory: "show" as const, granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
      { id: "task-3", title: "Tests", description: "Write unit tests", status: "pending" as const, difficulty: "medium" as const, estimatedMinutes: 45, dependencies: ["task-2"], files: ["tests/index.test.ts"], shipCategory: "show" as const, granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
      { id: "task-4", title: "Documentation", description: "Write docs", status: "pending" as const, difficulty: "easy" as const, estimatedMinutes: 30, dependencies: ["task-2"], files: ["README.md"], shipCategory: "ship" as const, granularity: "task" as const, suggestedModel: "minimax/MiniMax-M2.7", maxLines: 200, subtasks: [], gates: [] },
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
      try {
        const p = JSON.parse(m[0]);
        return {
          proposal: p.proposal ?? `# Proposal\n\n${requirement}`,
          design: p.design ?? "# Design\n\nTBD",
          tasks: (() => {
            const all = (Array.isArray(p.tasks) ? p.tasks : []).map((t: any, i: number) => ({
              // T-C1 fix: use ?? defaults so required fields are never undefined
              id: t.id ?? `task-${i + 1}`,
              title: t.title ?? `Task ${i + 1}`,
              description: t.description ?? "",
              status: "pending" as const,
              difficulty: t.difficulty ?? "medium",
              estimatedMinutes: t.estimatedMinutes ?? 30,
              dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
              files: Array.isArray(t.files) ? t.files : [],
              shipCategory: t.shipCategory ?? "show",
              granularity: t.granularity ?? "task",
              suggestedModel: t.suggestedModel ?? DEFAULT_MODEL,
              maxLines: t.maxLines ?? 200,
              subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
              gates: Array.isArray(t.gates) ? t.gates : [],
            }));
            const MAX_TASKS = 15;
            if (all.length <= MAX_TASKS) return all;
            const excess = all.length - MAX_TASKS;
            const kept = all.slice(0, MAX_TASKS);
            // Attach cap note to the last kept task's description
            kept[kept.length - 1].description += `\n...and ${excess} more (capped for token budget)`;
            return kept;
          })(),
          updatedAt: new Date().toISOString(),
        };
      } catch (e) {
        logger.warn(`Spec JSON parse failed (${e}), falling back to default spec`);
      }
    }
  } catch (e) { logger.warn(`Spec subagent failed: ${e}`); }
  return defaultSpec(requirement);
}
