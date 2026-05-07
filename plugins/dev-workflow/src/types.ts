// ─── Dev-Workflow Type Definitions ───
// v10: Pure types only. Constants moved to constants.ts, helpers to helpers.ts.
// All exports re-exported here for backward compatibility.

// ─── Re-exports for backward compatibility ───
export { REFACTOR_PRINCIPLES, REFACTOR_THRESHOLDS, MODEL_TIERS, ROLE_TIERS, STEP_MIGRATION_MAP, DEV_WORKFLOW_RULES, DEFAULT_FEATURE_FLAGS, DEFAULT_TEAM_CONFIG } from "./constants.js";
export { healthLevelFromScore, healthEmoji, normalizeTask } from "./helpers.js";

// ─── Account ───

export interface DevWorkflowAccount {
  accountId: string;
  enabled: boolean;
}

// ─── Workflow Types ───

export type WorkflowMode = "ultra" | "quick" | "standard" | "full" | "debug";

export type WorkflowStep =
  | "step1-project-identify"
  | "step2-handover"
  | "step3-requirement"
  | "step4-spec"
  | "step5-tech-selection"
  | "step6-plan-gate"
  | "step7-development"
  | "step8-review"
  | "step9-test"
  | "step10-security-audit"
  | "step11-docs"
  | "step12-delivery";

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "failed";
export type TaskGranularity = "feature" | "task" | "subtask";
export type GateType = "lint" | "boundary" | "unit_test" | "integration" | "performance";
export type GateStatus = "pending" | "passed" | "failed" | "skipped";

// ─── Task Types ───

export interface SubTask {
  id: string;
  parentTaskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  suggestedModel: string;
  maxLines: number;
  gates: GateResult[];
}

export interface GateResult {
  type: GateType;
  status: GateStatus;
  output?: string;
  checkedAt?: string;
}

export type ShipCategory = "ship" | "show" | "ask";
export type DifficultyLevel = "easy" | "medium" | "hard";

export interface WorkflowTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  difficulty: DifficultyLevel;
  estimatedMinutes: number;
  dependencies: string[];
  files: string[];
  shipCategory: ShipCategory;
  granularity: TaskGranularity;
  suggestedModel: string;
  maxLines: number;
  subtasks: SubTask[];
  gates: GateResult[];
}

// ─── Spec & Context ───

export interface WorkflowSpec {
  proposal: string;
  design: string;
  tasks: WorkflowTask[];
  updatedAt: string;
}

export interface WorkflowContext {
  projectId: string;
  projectDir: string;
  mode: WorkflowMode;
  currentStep: WorkflowStep;
  spec: WorkflowSpec | null;
  activeTaskIndex: number;
  brainstormNotes: string[];
  decisions: string[];    // Compressed decisions for LLM context
  /** A1: Immutable execution trajectory — full audit trail, never compressed */
  trajectory: string[];
  qaGateResults: QAGateCheck[];
  refactorAssessment?: RefactorAssessment;
  startedAt: string;
  openSource: boolean | null;
  branchName: string | null;
  featureFlags: FeatureFlags;
  taskRouting?: Record<string, { complexity: string; tool: string; model: string }>;
  // T-A1: plan gate confirmation state
  planGateConfirmed?: boolean;
  // T-B1: cached project context to avoid repeated rebuilds
  _cachedProjectContext?: string;
  // v16: Agent Team
  teamConfig?: TeamConfig;
  teamState?: TeamState;
}

export interface QAGateCheck {
  name: string;
  passed: boolean;
  output?: string;
}

export interface AgentResult {
  agentId: string;
  task: string;
  success: boolean;
  output: string;
  durationMs: number;
}

export interface BrainstormOption {
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  directoryStructure?: string;
}

export interface TechSelection {
  language: string;
  framework: string;
  architecture: string;
  patterns: string[];
  notes: string;
}

export interface WorkingMemoryLayer {
  project: string;
  task: string;
  step: string;
}

export interface ConventionalCommit {
  type: string;
  scope: string;
  description: string;
  breaking: boolean;
}

// ─── Refactor Assessment Types ───

export type RefactorHealthLevel = "healthy" | "acceptable" | "needs-attention" | "technical-debt";

export type RefactorMetricType =
  | "complexity"
  | "file-size"
  | "function-size"
  | "duplication"
  | "coupling"
  | "naming";

export interface RefactorMetric {
  type: RefactorMetricType;
  value: number;
  threshold: number;
  weight: number;
  passed: boolean;
  files?: string[];
}

export interface RefactorRecommendation {
  priority: "high" | "medium" | "low";
  principle: RefactorPrinciple;
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedEffort: string;
}

export type RefactorPrinciple =
  | "efficiency"
  | "maintainability"
  | "extensibility"
  | "readability"
  | "simplicity"
  | "correctness";

export interface RefactorAssessment {
  score: number;
  healthLevel: RefactorHealthLevel;
  metrics: RefactorMetric[];
  recommendations: RefactorRecommendation[];
  scannedAt: string;
  fileCount: number;
}

// ─── Tier Model Types ───

export type ModelTier = "lightweight" | "standard" | "advanced" | "critical";

export interface TierModel {
  primary: string;
  fallback: string[];
}

// ─── Feature Flags ───

export interface FeatureFlags {
  strictTdd: boolean;
  ruleEnforcement: boolean;
  autoCommit: boolean;
  workingMemoryPersist: boolean;
  dependencyParallelTasks: boolean;
  conventionalCommits: boolean;
  qaGateBlocking: boolean;
  githubIntegration: boolean;
  coverageThreshold: number;
  maxFileLines: number;
  maxFunctionLines: number;
  modelOverride: Record<string, string>;
  subtaskGatesEnabled: boolean;
  subtaskMaxLines: number;
  taskMaxLines: number;
  tmuxForLongTasks: boolean;
  tmuxTimeoutSeconds: number;
  noProxyLocalhost: boolean;
  readmeDualLanguage: boolean;
  refactorAssessmentEnabled: boolean;
  refactorAssessmentOnStep0: boolean;
  // v16: Agent Team flags
  agentTeamEnabled: boolean;
  agentTeamParallelExecution: boolean;
  agentTeamContractLayer: boolean;
  agentTeamFileOwnership: boolean;
  agentTeamAutoSync: boolean;
}

// ─── Config ───

export interface WorkflowConfig {
  mode: WorkflowMode;
  featureFlags: FeatureFlags;
  taskRouting?: Record<string, { complexity: string; tool: string; model: string }>;
  projectDir: string;
}

// ─── Rules ───

export type DevWorkflowRule =
  | "no-unused-vars"
  | "prefer-const"
  | "no-console-log"
  | "no-any-type"
  | "explicit-return-types"
  | "no-magic-numbers"
  | "max-file-lines"
  | "max-function-lines"
  | "no-inline-styles"
  | "prefer-immutable"
  | "no-deep-nesting"
  | "no-duplicate-code"
  | "meaningful-names"
  | "single-responsibility"
  | "no-commented-code"
  | "no-debugger"
  | "no-hardcoded-secrets"
  | "prefer-early-return"
  | "no-boolean-params"
  | "no-global-mutation"
  | "prefer-pure-functions"
  | "karpathy-no-speculative-code"
  | "karpathy-minimal-abstraction"
  | "karpathy-surgical-edit"
  | "karpathy-define-success-criteria"
  | "karpathy-state-assumptions";

// ── A3: SubAgent Isolation Interface ──

/** Isolation level for task execution */
export type IsolationLevel = "none" | "subprocess";

/** Configuration for isolated task execution */
export interface SubAgentConfig {
  /** Isolation level — none = same process (default), subprocess = child process with JSON IPC */
  isolation: IsolationLevel;
  /** Maximum execution time in ms (default: 300000 = 5 min) */
  timeout: number;
  /** Environment variables to pass to subprocess */
  env?: Record<string, string>;
}

export const DEFAULT_SUBAGENT_CONFIG: SubAgentConfig = {
  isolation: "none",
  timeout: 300_000,
};

// ── v16: Agent Team Types ──

export interface TeamConfig {
  maxParallelAgents: number;
  syncAfterBatches: number;
  syncAfterTasks: number;
  failoverToSerial: boolean;
  contractLayerEnabled: boolean;
}

export interface TeamState {
  currentBatchIndex: number;
  activeAgents: TeamAgentInfo[];
  fileOwnership: FileOwnershipMap;
  publishedContracts: Contract[];
  syncHistory: SyncResultInfo[];
  fallbackUsed: boolean;
}

export interface TeamAgentInfo {
  id: string;
  assignedTaskId: string;
  ownedFiles: string[];
  status: "idle" | "running" | "completed" | "failed";
}

export interface TaskBatch {
  id: string;
  tasks: WorkflowTask[];
  dependsOn: string[];
  syncAfter: boolean;
  estimatedParallelTime: number;
}

export interface SyncPoint {
  afterBatch: string;
  actions: SyncAction[];
}

export type SyncAction =
  | { type: "merge"; strategy: "ff" | "no-ff" }
  | { type: "test"; scope: "changed" | "full" }
  | { type: "conflict-check" }
  | { type: "lint"; scope: "changed" }
  | { type: "contract-publish"; contracts: string[] };

export interface ParallelExecutionPlan {
  batches: TaskBatch[];
  syncPoints: SyncPoint[];
  totalEstimatedTime: number;
  estimatedSpeedup: number;
}

export interface FileOwnershipMap {
  allocations: Record<string, string[]>; // agentId → fileGlobs
  ownership: Record<string, string>;     // filePath → agentId
}

export interface FileConflict {
  file: string;
  taskIds: string[];
  resolution: "serialize" | "split" | "merge-task";
}

export interface Contract {
  id: string;
  taskId: string;
  type: "interface" | "type" | "api-schema" | "function-sig";
  name: string;
  definition: string;
  filePath: string;
  publishedAt: string;
}

export interface SyncResultInfo {
  syncPoint: string;
  passed: boolean;
  actions: SyncActionResult[];
  conflicts: MergeConflict[];
}

export interface SyncActionResult {
  type: string;
  passed: boolean;
  output: string;
}

export interface MergeConflict {
  file: string;
  agentIds: string[];
  resolution: "auto-merged" | "manual-required";
}

export interface TeamExecutionResult {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  batchResults: BatchResultInfo[];
  syncResults: SyncResultInfo[];
  totalDurationMs: number;
  estimatedSpeedup: number;
  fallbackUsed: boolean;
}

export interface BatchResultInfo {
  batchId: string;
  agentResults: Record<string, AgentResult>;
  allSucceeded: boolean;
  durationMs: number;
}
