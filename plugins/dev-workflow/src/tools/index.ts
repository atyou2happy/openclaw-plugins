import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { DevWorkflowTool } from "./dev-workflow-tool.js";
import { WorkflowStatusTool } from "./workflow-status-tool.js";
import { TaskExecuteTool } from "./task-execute-tool.js";
import { SpecViewTool } from "./spec-view-tool.js";
import { QAGateTool } from "./qa-gate-tool.js";
import { PlanGateTool } from "./plan-gate-tool.js";
import { PermissionTool } from "./permission-tool.js";
import { BackgroundTaskTool } from "./background-task-tool.js";
import { FeedbackTool } from "./feedback-tool.js";
import { DebugTool } from "./debug-tool.js";
import { SecurityAuditTool } from "./security-audit-tool.js";
import { RetroTool } from "./retro-tool.js";
import { RefactorAssessmentTool } from "./refactor-assessment-tool.js";
import { CodeGraphTool } from "./code-graph-tool.js";

// Tool type exports
export type { DevWorkflowTool } from "./dev-workflow-tool.js";
export type { WorkflowStatusTool } from "./workflow-status-tool.js";
export type { TaskExecuteTool } from "./task-execute-tool.js";
export type { SpecViewTool } from "./spec-view-tool.js";
export type { QAGateTool } from "./qa-gate-tool.js";
export type { PlanGateTool } from "./plan-gate-tool.js";
export type { PermissionTool } from "./permission-tool.js";
export type { BackgroundTaskTool } from "./background-task-tool.js";
export type { FeedbackTool } from "./feedback-tool.js";
export type { DebugTool } from "./debug-tool.js";
export type { SecurityAuditTool } from "./security-audit-tool.js";
export type { RetroTool } from "./retro-tool.js";
export type { RefactorAssessmentTool } from "./refactor-assessment-tool.js";
export type { CodeGraphTool } from "./code-graph-tool.js";

export function registerDevWorkflowTools(api: OpenClawPluginApi) {
  api.registerTool(new DevWorkflowTool());
  api.registerTool(new WorkflowStatusTool());
  api.registerTool(new TaskExecuteTool());
  api.registerTool(new SpecViewTool());
  api.registerTool(new QAGateTool());
  api.registerTool(new PlanGateTool());
  api.registerTool(new PermissionTool());
  api.registerTool(new BackgroundTaskTool());
  api.registerTool(new FeedbackTool());
  api.registerTool(new DebugTool());
  api.registerTool(new SecurityAuditTool());
  api.registerTool(new RetroTool());
  api.registerTool(new RefactorAssessmentTool());
  api.registerTool(new CodeGraphTool());
}
