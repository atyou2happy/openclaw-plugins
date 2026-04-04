import { describe, expect, it } from "vitest";
import type {
  DevWorkflowAccount,
  WorkflowMode,
  WorkflowStep,
  TaskStatus,
  ShipCategory,
  DifficultyLevel,
  WorkflowTask,
  WorkflowSpec,
  WorkflowContext,
  QAGateCheck,
  AgentResult,
  BrainstormOption,
  FeatureFlags,
  DevWorkflowRule,
} from "../src/types.js";
import { DEFAULT_FEATURE_FLAGS, DEV_WORKFLOW_RULES } from "../src/types.js";

describe("types", () => {
  it("DevWorkflowAccount has required fields", () => {
    const account: DevWorkflowAccount = { accountId: "test", enabled: true };
    expect(account.accountId).toBe("test");
    expect(account.enabled).toBe(true);
  });

  it("WorkflowMode accepts valid values", () => {
    const modes: WorkflowMode[] = ["quick", "standard", "full"];
    expect(modes).toHaveLength(3);
  });

  it("WorkflowStep covers all 12 steps", () => {
    const steps: WorkflowStep[] = [
      "step0-analysis",
      "step0.5-spec-update",
      "step1-requirement",
      "step2-brainstorm",
      "step3-spec",
      "step4-tech-selection",
      "step5-development",
      "step6-review",
      "step7-test",
      "step8-docs",
      "step8.5-github",
      "step9-delivery",
    ];
    expect(steps).toHaveLength(12);
  });

  it("TaskStatus covers all states", () => {
    const statuses: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled", "failed"];
    expect(statuses).toHaveLength(5);
  });

  it("ShipCategory has ship/show/ask", () => {
    const cats: ShipCategory[] = ["ship", "show", "ask"];
    expect(cats).toHaveLength(3);
  });

  it("DifficultyLevel has easy/medium/hard", () => {
    const levels: DifficultyLevel[] = ["easy", "medium", "hard"];
    expect(levels).toHaveLength(3);
  });

  it("WorkflowTask has all required fields", () => {
    const task: WorkflowTask = {
      id: "task-1",
      title: "Test Task",
      description: "A test task",
      status: "pending",
      difficulty: "medium",
      estimatedMinutes: 30,
      dependencies: [],
      files: ["src/index.ts"],
      shipCategory: "show",
    };
    expect(task.id).toBe("task-1");
    expect(task.dependencies).toEqual([]);
  });

  it("WorkflowSpec has proposal, design, tasks, updatedAt", () => {
    const spec: WorkflowSpec = {
      proposal: "# Proposal",
      design: "# Design",
      tasks: [],
      updatedAt: new Date().toISOString(),
    };
    expect(spec.tasks).toHaveLength(0);
  });

  it("WorkflowContext has all required fields", () => {
    const ctx: WorkflowContext = {
      projectId: "test-project",
      projectDir: "/tmp/test",
      mode: "standard",
      currentStep: "step0-analysis",
      spec: null,
      activeTaskIndex: 0,
      brainstormNotes: [],
      decisions: [],
      qaGateResults: [],
      startedAt: new Date().toISOString(),
      openSource: null,
      branchName: null,
      featureFlags: DEFAULT_FEATURE_FLAGS,
    };
    expect(ctx.projectId).toBe("test-project");
    expect(ctx.spec).toBeNull();
    expect(ctx.openSource).toBeNull();
    expect(ctx.branchName).toBeNull();
    expect(ctx.featureFlags).toBeDefined();
    expect(ctx.featureFlags.autoCommit).toBe(true);
  });

  it("QAGateCheck has name, passed, optional output", () => {
    const check: QAGateCheck = { name: "lint", passed: true };
    expect(check.output).toBeUndefined();
    const failedCheck: QAGateCheck = { name: "tests", passed: false, output: "1 test failed" };
    expect(failedCheck.output).toBe("1 test failed");
  });

  it("AgentResult has all required fields", () => {
    const result: AgentResult = {
      agentId: "glm-5.1",
      task: "task-1",
      success: true,
      output: "Done",
      durationMs: 1500,
    };
    expect(result.success).toBe(true);
  });

  it("BrainstormOption has optional directoryStructure", () => {
    const option: BrainstormOption = {
      label: "Option A",
      description: "Description",
      pros: ["Fast"],
      cons: ["Limited"],
    };
    expect(option.directoryStructure).toBeUndefined();
  });

  it("FeatureFlags has all fields with defaults", () => {
    const flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
    expect(flags.strictTdd).toBe(false);
    expect(flags.ruleEnforcement).toBe(true);
    expect(flags.autoCommit).toBe(true);
    expect(flags.workingMemoryPersist).toBe(true);
    expect(flags.dependencyParallelTasks).toBe(true);
    expect(flags.conventionalCommits).toBe(true);
    expect(flags.qaGateBlocking).toBe(false);
    expect(flags.githubIntegration).toBe(true);
    expect(flags.coverageThreshold).toBe(80);
    expect(flags.maxFileLines).toBe(500);
    expect(flags.maxFunctionLines).toBe(50);
  });

  it("FeatureFlags can be partially overridden", () => {
    const custom: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS, strictTdd: true, coverageThreshold: 95 };
    expect(custom.strictTdd).toBe(true);
    expect(custom.coverageThreshold).toBe(95);
    expect(custom.autoCommit).toBe(true);
  });

  it("DEV_WORKFLOW_RULES has 21 rules", () => {
    const ruleKeys = Object.keys(DEV_WORKFLOW_RULES);
    expect(ruleKeys).toHaveLength(21);
  });

  it("DEV_WORKFLOW_RULES each rule has description and severity", () => {
    for (const [key, rule] of Object.entries(DEV_WORKFLOW_RULES)) {
      expect(rule.description.length).toBeGreaterThan(0);
      expect(["error", "warning"]).toContain(rule.severity);
    }
  });

  it("DevWorkflowRule type covers all rule keys", () => {
    const rules: DevWorkflowRule[] = [
      "no-unused-vars", "prefer-const", "no-console-log", "no-any-type",
      "explicit-return-types", "no-magic-numbers", "max-file-lines", "max-function-lines",
      "no-inline-styles", "prefer-immutable", "no-deep-nesting", "no-duplicate-code",
      "meaningful-names", "single-responsibility", "no-commented-code", "no-debugger",
      "no-hardcoded-secrets", "prefer-early-return", "no-boolean-params",
      "no-global-mutation", "prefer-pure-functions",
    ];
    expect(rules).toHaveLength(21);
    for (const r of rules) {
      expect(DEV_WORKFLOW_RULES[r]).toBeDefined();
    }
  });
});
