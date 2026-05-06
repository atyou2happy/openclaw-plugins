export interface DevWorkflowAccount {
  accountId: string;
  enabled: boolean;
}

export type WorkflowMode = "quick" | "standard" | "full" | "debug";
export type WorkflowStep =
  | "step0-analysis"
  | "step0.1-handover"
  | "step0.2-bootstrap"
  | "step0.3-refactor-assessment"
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
  refactorAssessment?: RefactorAssessment;
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

// ─── Refactor Assessment Types (v6.2) ───

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

export const REFACTOR_PRINCIPLES: Record<RefactorPrinciple, { label: string; description: string }> = {
  efficiency: { label: "效率优先", description: "O(n)优化、惰性计算、批量操作、避免重复计算" },
  maintainability: { label: "可维护性", description: "单一职责、显式依赖、完善错误处理、一致的风格" },
  extensibility: { label: "可扩展性", description: "开放封闭原则、插件化设计、配置驱动、接口抽象" },
  readability: { label: "可读性", description: "自解释命名、最小抽象层级、线性逻辑流、有意义的注释" },
  simplicity: { label: "简洁性", description: "YAGNI、删除无用代码、组合优于继承、数据驱动" },
  correctness: { label: "正确性优先", description: "测试覆盖、边界处理、幂等操作、防御性编程" },
};

export const REFACTOR_THRESHOLDS = {
  maxFileLines: 500,
  maxFunctionLines: 50,
  maxCyclomaticComplexity: 15,
  maxImportsPerFile: 10,
  maxDuplicationPercent: 3,
  minNameLength: 2,
} as const;

export function healthLevelFromScore(score: number): RefactorHealthLevel {
  if (score >= 90) return "healthy";
  if (score >= 70) return "acceptable";
  if (score >= 50) return "needs-attention";
  return "technical-debt";
}

export function healthEmoji(level: RefactorHealthLevel): string {
  const map: Record<RefactorHealthLevel, string> = {
    healthy: "🟢",
    acceptable: "🟡",
    "needs-attention": "🟠",
    "technical-debt": "🔴",
  };
  return map[level];
}

// ─── End Refactor Types ───

// ─── Tier Model Selection (v6.2) ───

export type ModelTier = "lightweight" | "standard" | "advanced" | "critical";

export interface TierModel {
  primary: string;
  fallback: string[];
}

export const MODEL_TIERS: Record<ModelTier, TierModel> = {
  lightweight: { primary: "llama-3.3-70b", fallback: ["minimax-m2.5"] },
  standard: { primary: "minimax-m2.7", fallback: ["minimax-m2.7"] },
  advanced: { primary: "glm-5.1", fallback: ["deepseek-v3.2"] },
  critical: { primary: "glm-5.1", fallback: ["deepseek-v3.2", "gpt-oss-120b"] },
};

export const ROLE_TIERS: Record<string, ModelTier> = {
  brainstorm: "lightweight",
  spec: "advanced",
  tech: "standard",
  coder: "standard",
  reviewer: "advanced",
  test: "standard",
  docs: "lightweight",
  qa: "advanced",
  security: "advanced",
};

export const STEP_MIGRATION_MAP: Record<string, string> = {
  "step0-analysis": "step1-project-identify",
  "step1-requirement": "step3-requirement",
  "step2-brainstorm": "step3-brainstorm",
  "step3-spec": "step4-spec",
  "step4-tech-selection": "step5-tech-selection",
  "step4.5-plan-gate": "step6-plan-gate",
  "step5-development": "step7-development",
  "step6-review": "step8-review",
  "step7-test": "step9-test",
  "step6.5-security-audit": "step10-security-audit",
  "step8-docs": "step11-docs",
  "step8.5-github": "step11-docs",
  "step9-delivery": "step12-delivery",
};

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
  refactorAssessmentEnabled: true,
  refactorAssessmentOnStep0: true,
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
