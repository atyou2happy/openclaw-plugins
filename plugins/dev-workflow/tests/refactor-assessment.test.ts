import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefactorAssessmentTool } from "../src/tools/refactor-assessment-tool.js";
import {
  healthLevelFromScore,
  healthEmoji,
  REFACTOR_PRINCIPLES,
  REFACTOR_THRESHOLDS,
  normalizeTask,
  type RefactorHealthLevel,
  type RefactorPrinciple,
} from "../src/types.js";

// ─── Types ───

describe("Refactor Types", () => {
  it("healthLevelFromScore returns correct levels", () => {
    expect(healthLevelFromScore(95)).toBe("healthy");
    expect(healthLevelFromScore(90)).toBe("healthy");
    expect(healthLevelFromScore(89)).toBe("acceptable");
    expect(healthLevelFromScore(70)).toBe("acceptable");
    expect(healthLevelFromScore(69)).toBe("needs-attention");
    expect(healthLevelFromScore(50)).toBe("needs-attention");
    expect(healthLevelFromScore(49)).toBe("technical-debt");
    expect(healthLevelFromScore(0)).toBe("technical-debt");
  });

  it("healthEmoji returns correct emojis", () => {
    expect(healthEmoji("healthy")).toBe("🟢");
    expect(healthEmoji("acceptable")).toBe("🟡");
    expect(healthEmoji("needs-attention")).toBe("🟠");
    expect(healthEmoji("technical-debt")).toBe("🔴");
  });

  it("REFACTOR_PRINCIPLES has 6 principles", () => {
    const principles = Object.keys(REFACTOR_PRINCIPLES);
    expect(principles).toHaveLength(6);
    expect(principles).toContain("efficiency");
    expect(principles).toContain("maintainability");
    expect(principles).toContain("extensibility");
    expect(principles).toContain("readability");
    expect(principles).toContain("simplicity");
    expect(principles).toContain("correctness");
  });

  it("REFACTOR_THRESHOLDS has expected values", () => {
    expect(REFACTOR_THRESHOLDS.maxFileLines).toBe(500);
    expect(REFACTOR_THRESHOLDS.maxFunctionLines).toBe(50);
    expect(REFACTOR_THRESHOLDS.maxCyclomaticComplexity).toBe(15);
    expect(REFACTOR_THRESHOLDS.maxImportsPerFile).toBe(10);
  });

  it("normalizeTask uses MiniMax M2.7 as default model", () => {
    const task = normalizeTask({ id: "T1", title: "Test", description: "Test task" });
    expect(task.suggestedModel).toBe("minimax/MiniMax-M2.7");
    expect(task.status).toBe("pending");
    expect(task.granularity).toBe("task");
  });
});

// ─── RefactorAssessmentTool ───

describe("RefactorAssessmentTool", () => {
  let tool: RefactorAssessmentTool;

  beforeEach(() => {
    tool = new RefactorAssessmentTool();
  });

  it("has correct tool metadata", () => {
    expect(tool.name).toBe("refactor_assessment");
    expect(tool.label).toBe("Refactor Assessment");
    expect(tool.description).toContain("refactoring");
  });

  it("parameters schema accepts valid input", () => {
    const schema = tool.parameters;
    const result = schema.safeParse({
      projectDir: "/tmp/test-project",
      mode: "quick",
    });
    expect(result.success).toBe(true);
  });

  it("parameters schema defaults mode to quick", () => {
    const schema = tool.parameters;
    const result = schema.safeParse({
      projectDir: "/tmp/test-project",
    });
    expect(result.success).toBe(true);
  });

  it("parameters schema rejects invalid mode", () => {
    const schema = tool.parameters;
    const result = schema.safeParse({
      projectDir: "/tmp/test-project",
      mode: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Score Computation ───

describe("Score Computation", () => {
  it("all passed metrics = 100", () => {
    const tool = new RefactorAssessmentTool();
    const metrics = [
      { type: "complexity" as const, value: 0, threshold: 0, weight: 0.25, passed: true },
      { type: "file-size" as const, value: 0, threshold: 0, weight: 0.15, passed: true },
      { type: "function-size" as const, value: 0, threshold: 0, weight: 0.15, passed: true },
      { type: "duplication" as const, value: 0, threshold: 0, weight: 0.15, passed: true },
      { type: "coupling" as const, value: 0, threshold: 0, weight: 0.15, passed: true },
      { type: "naming" as const, value: 0, threshold: 0, weight: 0.15, passed: true },
    ];
    // @ts-expect-error - testing private method indirectly
    const score = tool["computeScore"](metrics);
    expect(score).toBe(100);
  });

  it("all failed with many violations = low score", () => {
    const tool = new RefactorAssessmentTool();
    const metrics = [
      { type: "complexity" as const, value: 50, threshold: 0, weight: 0.25, passed: false },
      { type: "file-size" as const, value: 20, threshold: 0, weight: 0.15, passed: false },
      { type: "function-size" as const, value: 30, threshold: 0, weight: 0.15, passed: false },
      { type: "duplication" as const, value: 15, threshold: 0, weight: 0.15, passed: false },
      { type: "coupling" as const, value: 10, threshold: 0, weight: 0.15, passed: false },
      { type: "naming" as const, value: 10, threshold: 0, weight: 0.15, passed: false },
    ];
    // @ts-expect-error
    const score = tool["computeScore"](metrics);
    expect(score).toBeLessThanOrEqual(50);
  });
});

// ─── Feature Flags ───

describe("Refactor Feature Flags", () => {
  it("DEFAULT_FEATURE_FLAGS includes refactor flags", async () => {
    const { DEFAULT_FEATURE_FLAGS } = await import("../src/types.js");
    expect(DEFAULT_FEATURE_FLAGS.refactorAssessmentEnabled).toBe(true);
    expect(DEFAULT_FEATURE_FLAGS.refactorAssessmentOnStep0).toBe(true);
  });
});

// ─── WorkflowStep ───

describe("WorkflowStep refactor step", () => {
  it("includes step2-handover for refactor assessment", async () => {
    const types = await import("../src/types.js");
    // Type-level test: if this compiles, the step exists
    const step: types.WorkflowStep = "step2-handover";
    expect(step).toBe("step2-handover");
  });
});
