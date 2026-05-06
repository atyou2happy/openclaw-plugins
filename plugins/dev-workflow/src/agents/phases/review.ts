import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runReview(runtime: PluginRuntime, projectDir: string): Promise<string> {
  const logger = runtime.logging.getChildLogger({ level: "info" });
  const sessionKey = `dwf-review-${Date.now()}`;
  const { stdout: diffOut } = await execAsync("git diff HEAD~1 --stat", { cwd: projectDir, timeout: 10000 }).catch(() => ({ stdout: "No recent commits" }));
  const { stdout: logOut } = await execAsync("git log --oneline -5", { cwd: projectDir, timeout: 10000 }).catch(() => ({ stdout: "No git log" }));
  try {
    const runResult = await runtime.subagent.run({ sessionKey, message: `Review recent changes:\nDiff:\n${diffOut}\nCommits:\n${logOut}`, extraSystemPrompt: "You are a senior code reviewer. Review for quality, bugs, edge cases, test coverage. Start with APPROVE or REQUEST CHANGES. Return markdown.", deliver: false });
    const waitResult = await runtime.subagent.waitForRun({ runId: runResult.runId, timeoutMs: 120000 });
    if (waitResult.status !== "ok") return `Review incomplete: ${waitResult.status}`;
    const msgResult = await runtime.subagent.getSessionMessages({ sessionKey, limit: 5 });
    const last = msgResult.messages[msgResult.messages.length - 1] as any;
    return typeof last === "string" ? last : (last?.content ?? "Review completed");
  } catch (e) { logger.warn(`Review subagent failed: ${e}`); return "Review failed"; }
}
