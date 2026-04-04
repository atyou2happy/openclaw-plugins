import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { DevWorkflowEngine } from "../engine/index.js";

let _runtime: PluginRuntime | null = null;
let _engine: DevWorkflowEngine | null = null;

export function setDevWorkflowRuntime(runtime: PluginRuntime) {
  _runtime = runtime;
  _engine = new DevWorkflowEngine(runtime);
}

export function getRuntime(): PluginRuntime {
  if (!_runtime) {
    throw new Error("DevWorkflow runtime not initialized. Ensure the plugin is loaded.");
  }
  return _runtime;
}

export function getEngine(): DevWorkflowEngine {
  if (!_engine) {
    throw new Error("DevWorkflow engine not initialized. Ensure the plugin is loaded.");
  }
  return _engine;
}
