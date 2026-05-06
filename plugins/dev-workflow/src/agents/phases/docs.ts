import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowSpec } from "../../types.js";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export async function generateDocs(runtime: PluginRuntime, projectDir: string, spec: WorkflowSpec | null): Promise<string> {
  if (!spec) return "No spec to generate docs from.";
  const sessionKey = `dwf-docs-${Date.now()}`;
  try {
    const runResult = await runtime.subagent.run({ sessionKey, message: `Generate docs:\nProposal:\n${spec.proposal}\nDesign:\n${spec.design}\nTasks:\n${JSON.stringify(spec.tasks, null, 2)}`, extraSystemPrompt: "You are a technical writer. Generate comprehensive markdown documentation.", deliver: false });
    const waitResult = await runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
    if (waitResult.status !== "ok") return `Docs incomplete: ${waitResult.status}`;
    const msgResult = await runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
    const last = msgResult.messages[msgResult.messages.length - 1] as any;
    const text = typeof last === "string" ? last : (last?.content ?? "");
    const docsPath = join(projectDir, "docs");
    if (!existsSync(docsPath)) mkdirSync(docsPath, { recursive: true });
    try { writeFileSync(join(docsPath, "generated.md"), text); } catch { /* skip */ }
    return text.slice(0, 3000);
  } catch (e) { return "Docs generation failed"; }
}
