export interface DevWorkflowAccount {
  accountId: string;
  enabled: boolean;
}

export type WorkflowMode = "quick" | "standard" | "full" | "debug";
export type WorkflowStep =
  | "step0-analysis"
  | "step0.1-handover"
  | "step0.2-bootstrap"
  | "step0.5-spec-update"
  | "step1-requirement"
  | "step2-brainstorm"
  | "step3-spec"
  | "step4-tech-selection"
  | "step4.5-plan-gate"
  | "step5-development"
  | "step6-review"
  | "step7-test"
  | "step8-docs"
  | "step8.5-github"
  | "step8.6-tag-release"
  | "step9-delivery"
  | "step9.5-handover-cleanup"
  | "step6.5-security-audit"
  | "step10-retro"
  | "step10.5-experience";

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "failed";
export type TaskGranularity = "feature" | "task" | "subtask";
export type GateType = "lint" | "boundary" | "unit_test" | "integration" | "performance";
export type GateStatus = "pending" | "passed" | "failed" | "skipped";

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
  decisions: string[];
  qaGateResults: QAGateCheck[];
  startedAt: string;
  openSource: boolean | null;
  branchName: string | null;
  featureFlags: FeatureFlags;
  taskRouting?: Record<string, { complexity: string; tool: string; model: string }>;
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
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  strictTdd: false,
  ruleEnforcement: true,
  autoCommit: true,
  workingMemoryPersist: true,
  dependencyParallelTasks: true,
  conventionalCommits: true,
  qaGateBlocking: false,
  githubIntegration: true,
  coverageThreshold: 80,
  maxFileLines: 500,
  maxFunctionLines: 50,
  modelOverride: {},
  subtaskGatesEnabled: true,
  subtaskMaxLines: 50,
  taskMaxLines: 200,
  tmuxForLongTasks: true,
  tmuxTimeoutSeconds: 30,
  noProxyLocalhost: true,
  readmeDualLanguage: true,
};

export interface WorkflowConfig {
  mode: WorkflowMode;
  featureFlags: FeatureFlags;
  taskRouting?: Record<string, { complexity: string; tool: string; model: string }>;
  projectDir: string;
}

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

export const DEV_WORKFLOW_RULES: Record<DevWorkflowRule, { description: string; severity: "error" | "warning" }> = {
  "no-unused-vars": { description: "No unused variables or imports", severity: "error" },
  "prefer-const": { description: "Prefer const over let when variable is not reassigned", severity: "warning" },
  "no-console-log": { description: "No console.log in production code (use logger)", severity: "warning" },
  "no-any-type": { description: "Avoid TypeScript any type", severity: "error" },
  "explicit-return-types": { description: "Functions should have explicit return types", severity: "warning" },
  "no-magic-numbers": { description: "Extract magic numbers into named constants", severity: "warning" },
  "max-file-lines": { description: "Files should not exceed 500 lines", severity: "warning" },
  "max-function-lines": { description: "Functions should not exceed 50 lines", severity: "warning" },
  "no-inline-styles": { description: "No inline styles, use CSS classes or style objects", severity: "warning" },
  "prefer-immutable": { description: "Prefer immutable data patterns", severity: "warning" },
  "no-deep-nesting": { description: "Avoid deeply nested code (>3 levels)", severity: "warning" },
  "no-duplicate-code": { description: "No duplicate code blocks", severity: "error" },
  "meaningful-names": { description: "Use descriptive variable and function names", severity: "warning" },
  "single-responsibility": { description: "Each function/module should do one thing", severity: "warning" },
  "no-commented-code": { description: "No commented-out code blocks", severity: "warning" },
  "no-debugger": { description: "No debugger statements in production code", severity: "error" },
  "no-hardcoded-secrets": { description: "No hardcoded secrets or credentials", severity: "error" },
  "prefer-early-return": { description: "Use early returns to reduce nesting", severity: "warning" },
  "no-boolean-params": { description: "Avoid boolean parameters that change function behavior", severity: "warning" },
  "no-global-mutation": { description: "Avoid mutating global state", severity: "error" },
  "prefer-pure-functions": { description: "Prefer pure functions over side-effecting ones", severity: "warning" },
  "karpathy-no-speculative-code": { description: "No features beyond what was asked — YAGNI enforced", severity: "error" },
  "karpathy-minimal-abstraction": { description: "No abstraction for single-use code — don't generalize prematurely", severity: "warning" },
  "karpathy-surgical-edit": { description: "Only touch code directly related to the task — no unrelated refactoring", severity: "error" },
  "karpathy-define-success-criteria": { description: "Every task must have verifiable success criteria before implementation", severity: "warning" },
  "karpathy-state-assumptions": { description: "Ambiguous requirements must list assumptions explicitly before proceeding", severity: "warning" },
};

/**
 * v6: Normalize a task object to ensure all v6 fields are present.
 * Handles tasks loaded from external sources (OpenSpec/Kilocode) that may lack v6 fields.
 */
export function normalizeTask(task: Partial<WorkflowTask> & Pick<WorkflowTask, "id" | "title" | "description">): WorkflowTask {
  return {
    status: "pending",
    difficulty: "medium",
    estimatedMinutes: 30,
    dependencies: [],
    files: [],
    shipCategory: "ship",
    granularity: "task",
    suggestedModel: "minimax/MiniMax-M2.7",
    maxLines: 200,
    subtasks: [],
    gates: [],
    ...task,
  };
}
