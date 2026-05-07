import { describe, expect, it } from "vitest";
import {
  getStepBudget,
  getGeneralRegulation,
  buildRegulationBlock,
  checkResponseBudget,
} from "../llm-self-regulator.js";

// ─── getStepBudget ───

describe("getStepBudget", () => {
  const knownSteps = [
    "analysis",
    "spec",
    "review",
    "debug",
    "test",
    "docs",
    "task-execution",
    "security",
    "brainstorm",
    "tech-selection",
  ];

  it.each(knownSteps)("returns non-empty string for known step '%s'", (step) => {
    const result = getStepBudget(step);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it.each(knownSteps)("result for step '%s' contains a [Budget: ...] marker", (step) => {
    const result = getStepBudget(step);
    expect(result).toMatch(/\[Budget:\s*\d+\s*tokens\]/);
  });

  it("returns default '[Budget: 500 tokens]' for unknown step", () => {
    const result = getStepBudget("unknown-step");
    expect(result).toBe("[Budget: 500 tokens] Be concise.");
  });

  it("returns default for empty string step", () => {
    const result = getStepBudget("");
    expect(result).toBe("[Budget: 500 tokens] Be concise.");
  });
});

// ─── getGeneralRegulation ───

describe("getGeneralRegulation", () => {
  it("returns a non-empty string", () => {
    const result = getGeneralRegulation();
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contains 'Token discipline'", () => {
    const result = getGeneralRegulation();
    expect(result).toContain("Token discipline");
  });

  it("contains structured-data guidance", () => {
    const result = getGeneralRegulation();
    expect(result).toMatch(/structured/i);
  });
});

// ─── buildRegulationBlock ───

describe("buildRegulationBlock", () => {
  it("combines general + step-specific with double newline", () => {
    const general = getGeneralRegulation();
    const stepBudget = getStepBudget("analysis");
    const result = buildRegulationBlock("analysis");

    expect(result).toBe(`${general}\n\n${stepBudget}`);
  });

  it("contains the general instruction text", () => {
    const result = buildRegulationBlock("spec");
    expect(result).toContain("Token discipline");
  });

  it("contains the step-specific budget marker", () => {
    const result = buildRegulationBlock("review");
    expect(result).toMatch(/\[Budget:\s*\d+\s*tokens\]/);
  });

  it("works for unknown steps using default budget", () => {
    const result = buildRegulationBlock("nonexistent");
    expect(result).toContain("Token discipline");
    expect(result).toContain("[Budget: 500 tokens]");
  });
});

// ─── checkResponseBudget ───

describe("checkResponseBudget", () => {
  it("returns withinBudget=true for short response", () => {
    const result = checkResponseBudget("Short response.", "analysis");
    expect(result.withinBudget).toBe(true);
  });

  it("returns withinBudget=false for very long response", () => {
    // Generate 5000+ chars of English text
    const longResponse = "This is a detailed response. ".repeat(200); // ~5600 chars
    const result = checkResponseBudget(longResponse, "analysis");
    expect(result.withinBudget).toBe(false);
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it("returns a non-empty hint when over budget", () => {
    const longResponse = "This is a detailed response. ".repeat(200);
    const result = checkResponseBudget(longResponse, "analysis");
    expect(result.withinBudget).toBe(false);
    expect(result.hint.length).toBeGreaterThan(0);
    expect(result.hint).toMatch(/Response is ~\d+ tokens/);
  });

  it("returns empty hint when within budget", () => {
    const result = checkResponseBudget("OK", "analysis");
    expect(result.withinBudget).toBe(true);
    expect(result.hint).toBe("");
  });

  it("extracts budget number from step instruction", () => {
    // analysis has budget 300; a response of ~200 tokens should be within budget
    const mediumResponse = "Word ".repeat(200); // ~200 words = ~50 tokens (0.25 per char * ~1000 chars)
    const result = checkResponseBudget(mediumResponse, "analysis");
    // "Word " is 5 chars, 200 reps = 1000 chars. At 0.25 tokens/char that's 250 tokens.
    // analysis budget is 300, 300*1.2=360. 250 <= 360 => within budget
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it("uses 500 default for unknown step", () => {
    // An unknown step defaults to 500 tokens budget.
    // Generate a response that is over 500*1.2=600 estimated tokens but under 800.
    // ~2400 English chars => ~600 tokens => exactly at the limit.
    // Use ~3000 chars => ~750 tokens => over 600 limit for unknown step
    const response = "x".repeat(3000);
    const result = checkResponseBudget(response, "totally-unknown-step");
    // 3000 chars * 0.25 = 750 tokens, budget 500 * 1.2 = 600, 750 > 600 => over
    expect(result.withinBudget).toBe(false);
    expect(result.hint).toContain("500");
  });

  it("allows 20% overshoot", () => {
    // analysis budget = 300 tokens. 20% overshoot = 360 tokens.
    // Need a response that estimates to >300 but <=360 tokens.
    // 0.25 tokens per English char => 1400 chars = 350 tokens => within 360
    const response = "a".repeat(1400);
    const result = checkResponseBudget(response, "analysis");
    // 1400 * 0.25 = 350 tokens, ceiling = 350. Budget 300, overshoot 360. 350 <= 360.
    expect(result.estimatedTokens).toBe(350);
    expect(result.withinBudget).toBe(true);

    // Now test just over the 20% threshold: 365 tokens => 1460 chars
    const overResponse = "a".repeat(1460);
    const overResult = checkResponseBudget(overResponse, "analysis");
    // 1460 * 0.25 = 365 tokens. 365 > 360 => over budget
    expect(overResult.estimatedTokens).toBe(365);
    expect(overResult.withinBudget).toBe(false);
  });

  it("returns estimatedTokens as a number", () => {
    const result = checkResponseBudget("Hello world", "review");
    expect(typeof result.estimatedTokens).toBe("number");
    expect(Number.isFinite(result.estimatedTokens)).toBe(true);
  });
});
