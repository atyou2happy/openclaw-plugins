import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { BrainstormOption } from "../../types.js";

export function defaultBrainstorm(): BrainstormOption[] {
  return [
    { label: "Minimal", description: "Simplest solution that meets the requirement", pros: ["Fast"], cons: ["Limited scalability"] },
    { label: "Standard", description: "Balanced approach with proper architecture", pros: ["Maintainable"], cons: ["More time"] },
    { label: "Full", description: "Comprehensive solution with full documentation", pros: ["Production-ready"], cons: ["Complex"] },
  ];
}

export async function brainstorm(runtime: PluginRuntime, requirement: string, projectDir: string): Promise<BrainstormOption[]> {
  const logger = runtime.logging.getChildLogger({ level: "info" });
  const sessionKey = `dwf-brainstorm-${Date.now()}`;
  const systemPrompt = `Propose 3 distinct implementation approaches. Return a JSON array where each entry has:
- "label": short name
- "description": 1-2 sentences
- "pros": string[]
- "cons": string[]
Return ONLY valid JSON.`;
  try {
    const runResult = await runtime.subagent.run({ sessionKey, message: `Requirement: ${requirement}\nProject: ${projectDir}`, extraSystemPrompt: systemPrompt, deliver: false });
    const waitResult = await runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
    if (waitResult.status !== "ok") return defaultBrainstorm();
    const msgResult = await runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
    const last = msgResult.messages[msgResult.messages.length - 1] as any;
    const text = typeof last === "string" ? last : (last?.content ?? "");
    const m = text.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch (e) { logger.warn(`Brainstorm subagent failed: ${e}`); }
  return defaultBrainstorm();
}
