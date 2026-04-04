export interface DevWorkflowAccount {
  accountId: string;
  enabled: boolean;
}

export type WorkflowMode = "quick" | "standard" | "full";
export type WorkflowStep =
  | "step0-analysis"
  | "step0.5-spec-update"
  | "step1-requirement"
  | "step2-brainstorm"
  | "step3-spec"
  | "step4-tech-selection"
  | "step5-development"
  | "step6-review"
  | "step7-test"
  | "step8-docs"
  | "step8.5-github"
  | "step9-delivery";

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "failed";
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
};

export interface WorkflowConfig {
  mode: WorkflowMode;
  featureFlags: FeatureFlags;
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
  | "prefer-pure-functions";

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
};
