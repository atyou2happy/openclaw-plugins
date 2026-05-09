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
import { AgentTeamTool } from "./agent-team-tool.js";

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

// ADR Manager & Swarm Topology (v24)
export { ADRManager } from "./adr-manager.js";
export type { ADR, ADRStatus, ADRAction, DecisionLevel, ADREvent, ADRExport } from "./adr-manager.js";
export { SwarmTopologySelector, DEFAULT_SWARM_CONFIG } from "./swarm-topology.js";
export type { SwarmTopology, AgentCapabilities, TaskRequirements, SwarmConfig, RoutingMatch, TopologyDecision } from "./swarm-topology.js";

// Self-Learning & Goal Decomposition (v24)
export { SelfLearningEngine } from "./self-learning.js";
export type { Experience, ExperienceCategory, Pattern, AdaptiveThreshold, ThresholdAdjustment, LearningExport } from "./self-learning.js";
export { GoalDecompositionEngine, DEFAULT_DECOMPOSITION_CONFIG } from "./goal-decomposition.js";
export type { Goal, GoalComplexity, DecompositionStrategy, DecompositionResult, DecompositionConfig } from "./goal-decomposition.js";

// v24 Integration Bridge
export { V24Bridge } from "./v24-bridge.js";
export type { V24Config, V24Status } from "./v24-bridge.js";

// Workflow Graph Engine (v25 Pillar 5)
export { WorkflowGraph } from "./workflow-graph.js";
export type { WorkflowNode, WorkflowEdge, WorkflowGraphConfig, ExecutionResult, NodeType, EdgeGuard } from "./workflow-graph.js";

// Council Gate / Triangulation (v25 Pillar 6)
export { TriangulationGate } from "./triangulation-gate.js";
export type { VoteRecord, GateResult, Counterfactual, TriangulationConfig, Verdict } from "./triangulation-gate.js";

// Step Middleware Pipeline (v25 Pillar 7)
export { StepMiddleware } from "./step-middleware.js";
export type { StepContext, MiddlewareFn, MiddlewareEntry } from "./step-middleware.js";

// Agent Health Monitor (v25 Pillar 7)
export { AgentHealthMonitor } from "./agent-health-monitor.js";
export type { HealthRecord, HealthConfig } from "./agent-health-monitor.js";

// Experience Propagator (v25 Enhancement)
export { ExperiencePropagator } from "./experience-propagator.js";
export type { ExperienceTemplate, PropagationQuery, PropagationResult as ExperiencePropagationResult } from "./experience-propagator.js";

// Agent Template Registry (v25 Enhancement)
export { AgentTemplateRegistry } from "./agent-template-registry.js";
export type { AgentTemplate, AgentTier, TemplateMatch } from "./agent-template-registry.js";

// v25 Integration Bridge
export { V25Bridge } from "./v25-bridge.js";
export type { V25Config } from "./v25-bridge.js";

// Context Injection Protocol (v25 Principle #127)
export { ContextProtocol } from "./context-protocol.js";

// v26 Pillars 8-10: Safe Execution, Observable Pipeline, Experience Evolution
export { ExecutionSandbox } from "./execution-sandbox.js";
export { StepEventStream } from "./step-event-stream.js";
export { ExperienceLifecycle } from "./experience-lifecycle.js";
export type { ContextBlock, ContextType, InjectionPlan } from "./context-protocol.js";

// v27 Pillars 11-15: LSP Intelligence, Spec-Vibe, Agent Collab, Cost-Aware, Meta-Optimization
export { LSPCodeIntelligence } from "./lsp-code-intelligence.js";
export type { LSPIndex, LSPCodeEntry as LSPEntry, ReferenceEntry, SemanticDiff } from "./lsp-code-intelligence.js";
export { SpecGraduation, DEFAULT_SPEC_LEVEL } from "./spec-graduation.js";
export type { SpecLevel, GraduationContext, GraduationDecision } from "./spec-graduation.js";
export { VibeSpecCapture } from "./vibe-spec-capture.js";
export type { VibeSpec } from "./vibe-spec-capture.js";
export { AgentMessageBus } from "./agent-message-bus.js";
export type { AgentMessage, MessageType, MessageStats } from "./agent-message-bus.js";
export { PhaseMemoryManager } from "./phase-memory-manager.js";
export type { DevPhase, PhaseMemoryBlock, MemoryEntry, CompressedMemory } from "./phase-memory-manager.js";
export { TokenBudgetPool } from "./token-budget-pool.js";
export type { BudgetAllocation, BudgetConfig } from "./token-budget-pool.js";
export { CostTracker } from "./cost-tracker.js";
export type { CostTier, CostConfig, StepCost, AgentCost } from "./cost-tracker.js";
export { WorkflowFitness } from "./workflow-fitness.js";
export type { FitnessScore, FitnessConfig } from "./workflow-fitness.js";
export { WorkflowExperiment } from "./workflow-experiment.js";
export type { ExperimentConfig, ExperimentResult } from "./workflow-experiment.js";
// v27 Bridge
export { V27Bridge } from "./v27-bridge.js";
export type { V27Config } from "./v27-bridge.js";

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
export type { AgentTeamTool } from "./agent-team-tool.js";

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
  api.registerTool(new AgentTeamTool());
}
