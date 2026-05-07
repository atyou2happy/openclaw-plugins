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

// Token optimization modules (v14)
export { PromptCacheOptimizer } from "./prompt-cache-optimizer.js";
export { SpecCompressor } from "./spec-compressor.js";
export { SkeletonExtractor } from "./skeleton-extractor.js";
export { HistoryCondenser } from "./history-condenser.js";
export { SmartFileSelector } from "./smart-file-selector.js";
export { getStepBudget, getGeneralRegulation, buildRegulationBlock, checkResponseBudget } from "./llm-self-regulator.js";

// Code graph / impact analysis modules (v15)
export { SymbolGraphBuilder } from "./symbol-graph-builder.js";
export { PropagationEngine, isTestFile } from "./propagation-engine.js";
export { CompletenessChecker } from "./completeness-checker.js";
export { ImpactAnalyzer } from "./impact-analyzer.js";

// Re-export types — token optimization (v14)
export type { OptimizedPrompt, PromptBlock } from "./prompt-cache-optimizer.js";
export type { CompressedSpec, CompressedDesign, CompressedTask } from "./spec-compressor.js";
export type { FileSkeleton, SymbolEntry, SkeletonBudget } from "./skeleton-extractor.js";
export type { CondensedEntry, CondensationResult, CondensationConfig } from "./history-condenser.js";
export type { FileSelection, ScoredFile, SelectionConfig } from "./smart-file-selector.js";

// Re-export types — code graph / impact analysis (v15)
export type { SymbolGraph, SymbolTag, GraphStats, GraphBuildConfig, DefEntry, RefEntry, InheritEntry } from "./symbol-graph-builder.js";
export type { PropagationResult, ImpactSeed, ImpactNode, ImpactReason, PropagationConfig, ScoreWeights } from "./propagation-engine.js";
export type { CompletenessReport, MissingFile, TestStatus, ChecklistItem, CompletenessStats, CheckInput } from "./completeness-checker.js";
export type { ImpactAnalysisConfig } from "./impact-analyzer.js";

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
