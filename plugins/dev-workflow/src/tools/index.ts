import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { DevWorkflowTool } from "./dev-workflow-tool.js";
import { WorkflowStatusTool } from "./workflow-status-tool.js";
import { TaskExecuteTool } from "./task-execute-tool.js";
import { SpecViewTool } from "./spec-view-tool.js";
import { QAGateTool } from "./qa-gate-tool.js";

export function registerDevWorkflowTools(api: OpenClawPluginApi) {
  api.registerTool(new DevWorkflowTool());
  api.registerTool(new WorkflowStatusTool());
  api.registerTool(new TaskExecuteTool());
  api.registerTool(new SpecViewTool());
  api.registerTool(new QAGateTool());
}
