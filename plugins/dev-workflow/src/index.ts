import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { devWorkflowChannel } from "./channel/dev-workflow-channel.js";
import { setDevWorkflowRuntime } from "./channel/runtime.js";
import { registerDevWorkflowTools } from "./tools/index.js";
import { registerDevWorkflowHooks } from "./hooks/index.js";

export { devWorkflowChannel } from "./channel/dev-workflow-channel.js";
export { setDevWorkflowRuntime } from "./channel/runtime.js";
export { DevWorkflowEngine } from "./engine/index.js";
export { AgentOrchestrator } from "./agents/index.js";

export default defineChannelPluginEntry({
  id: "dev-workflow",
  name: "Dev Workflow",
  description: "AI-driven spec-driven development workflow with multi-agent orchestration",
  plugin: devWorkflowChannel,
  setRuntime: setDevWorkflowRuntime,
  registerFull(api) {
    registerDevWorkflowTools(api);
    registerDevWorkflowHooks(api);
  },
});
