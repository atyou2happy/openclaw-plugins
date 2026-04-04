import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

export function registerDevWorkflowHooks(api: OpenClawPluginApi) {
  api.registerHook("session_start", async (event: any) => {
    api.logger.info(`[dev-workflow] Session started: ${event?.sessionKey ?? "unknown"}`);
  }, { name: "dev-workflow-session-start" });

  api.registerHook("session_end", async (event: any) => {
    api.logger.info(`[dev-workflow] Session ended: ${event?.sessionKey ?? "unknown"}`);
  }, { name: "dev-workflow-session-end" });

  api.registerHook("before_tool_call", async (event: any) => {
    api.logger.info(`[dev-workflow] Tool about to be called: ${event?.toolName ?? "unknown"}`);
  }, { name: "dev-workflow-before-tool-call" });

  api.registerHook("after_tool_call", async (event: any) => {
    api.logger.info(`[dev-workflow] Tool call completed: ${event?.toolName ?? "unknown"}`);
  }, { name: "dev-workflow-after-tool-call" });
}
