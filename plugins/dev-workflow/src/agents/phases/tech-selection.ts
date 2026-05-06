import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { TechSelection } from "../../types.js";

export function defaultTech(): TechSelection {
  return { language: "TypeScript", framework: "Node.js", architecture: "modular", patterns: ["module", "factory"], notes: "Default tech selection" };
}

export async function selectTech(runtime: PluginRuntime, requirement: string, projectDir: string, brainstormNotes: string[]): Promise<TechSelection> {
  const sessionKey = `dwf-tech-${Date.now()}`;
  const notes = brainstormNotes.length > 0 ? `\nBrainstorm notes:\n${brainstormNotes.join("\n")}` : "";
  const systemPrompt = `You are a tech lead selecting technologies. Return a JSON object with:
- "language": string
- "framework": string
- "architecture": string (e.g. "modular-monolith", "microservices", "layered")
- "patterns": string[] (e.g. ["repository", "factory", "observer"])
- "notes": string
Return ONLY valid JSON.`;
  try {
    const runResult = await runtime.subagent.run({ sessionKey, message: `Requirement: ${requirement}${notes}\nProject: ${projectDir}`, extraSystemPrompt: systemPrompt, deliver: false });
    const waitResult = await runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
    if (waitResult.status !== "ok") return defaultTech();
    const msgResult = await runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
    const last = msgResult.messages[msgResult.messages.length - 1] as any;
    const text = typeof last === "string" ? last : (last?.content ?? "");
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      return { language: p.language ?? "TypeScript", framework: p.framework ?? "Node.js", architecture: p.architecture ?? "modular", patterns: p.patterns ?? [], notes: p.notes ?? "" };
    }
  } catch { /* skip */ }
  return defaultTech();
}
