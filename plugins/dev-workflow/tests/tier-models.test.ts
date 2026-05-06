/**
 * Tier 模型选择测试
 */
import { describe, it, expect } from "vitest";
import {
  MODEL_TIERS,
  ROLE_TIERS,
  ModelTier,
  STEP_MIGRATION_MAP,
} from "../src/types.js";

describe("MODEL_TIERS 常量", () => {
  const tiers: ModelTier[] = ["lightweight", "standard", "advanced", "critical"];

  it("四个 Tier 都有定义", () => {
    for (const t of tiers) {
      expect(MODEL_TIERS[t]).toBeDefined();
      expect(MODEL_TIERS[t].primary).toBeTruthy();
      expect(Array.isArray(MODEL_TIERS[t].fallback)).toBe(true);
    }
  });

  it("primary 模型名非空字符串", () => {
    for (const t of tiers) {
      expect(typeof MODEL_TIERS[t].primary).toBe("string");
      expect(MODEL_TIERS[t].primary.length).toBeGreaterThan(0);
    }
  });
});

describe("ROLE_TIERS 映射", () => {
  const roles = ["brainstorm", "spec", "coder", "reviewer", "security"];

  it("核心角色都有 Tier 映射", () => {
    for (const role of roles) {
      expect(ROLE_TIERS[role]).toBeDefined();
      expect(["lightweight", "standard", "advanced", "critical"]).toContain(ROLE_TIERS[role]);
    }
  });

  it("reviewer 是 advanced", () => {
    expect(ROLE_TIERS.reviewer).toBe("advanced");
  });

  it("brainstorm 是 lightweight", () => {
    expect(ROLE_TIERS.brainstorm).toBe("lightweight");
  });
});

describe("STEP_MIGRATION_MAP 向后兼容", () => {
  it("旧的 step 名能映射到新 step 名", () => {
    const oldSteps = [
      "step0-analysis", "step1-requirement", "step2-brainstorm",
      "step3-spec", "step4-tech-selection", "step5-development",
      "step6-review", "step7-test", "step8-docs", "step9-delivery",
    ];
    for (const old of oldSteps) {
      expect(STEP_MIGRATION_MAP[old]).toBeDefined();
      expect(STEP_MIGRATION_MAP[old].startsWith("step")).toBe(true);
    }
  });

  it("映射目标是有效的新 step 名", () => {
    const validNew: string[] = [
      "step1-project-identify", "step2-handover", "step3-requirement",
      "step4-spec", "step5-tech-selection",
      "step6-plan-gate", "step7-development", "step8-review",
      "step9-test", "step10-security-audit", "step11-docs", "step12-delivery",
    ];
    const allMapped = Object.values(STEP_MIGRATION_MAP);
    for (const m of allMapped) {
      expect(validNew).toContain(m);
    }
  });
});
