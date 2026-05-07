// ─── Dev-Workflow Constants ───
// Extracted from types.ts for separation of concerns.
// All constants are re-exported from types.ts for backward compatibility.

import type { RefactorPrinciple, RefactorHealthLevel, ModelTier, DevWorkflowRule } from "./types.js";

// ─── Refactor Constants ───

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

// ─── Tier Model Constants ───

/** Default model used for task execution and spec suggestions — single source of truth */
export const DEFAULT_MODEL = "minimax/MiniMax-M2.7" as const;

export const MODEL_TIERS: Record<ModelTier, { primary: string; fallback: string[] }> = {
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

// ─── Step Migration Map (v5 old → v6+ new) ───

export const STEP_MIGRATION_MAP: Record<string, string> = {
  "step0-analysis": "step1-project-identify",
  "step1-requirement": "step3-requirement",
  "step2-brainstorm": "step3-requirement",
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

// ─── Rule Constants ───

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

// ─── Feature Flag Defaults ───

export const DEFAULT_FEATURE_FLAGS: import("./types.js").FeatureFlags = {
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
  agentTeamEnabled: false,
  agentTeamParallelExecution: true,
  agentTeamContractLayer: true,
  agentTeamFileOwnership: true,
  agentTeamAutoSync: true,
};

// ─── v16: Agent Team Defaults ──

export const DEFAULT_TEAM_CONFIG: import("./types.js").TeamConfig = {
  maxParallelAgents: 3,
  syncAfterBatches: 2,
  syncAfterTasks: 5,
  failoverToSerial: true,
  contractLayerEnabled: true,
};
