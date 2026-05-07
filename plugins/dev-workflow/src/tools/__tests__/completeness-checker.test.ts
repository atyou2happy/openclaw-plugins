import { describe, expect, it } from "vitest";
import { CompletenessChecker } from "../completeness-checker.js";
import type { PropagationResult } from "../propagation-engine.js";

// ─── Helpers ───

function makeImpactResult(overrides: Partial<PropagationResult> = {}): PropagationResult {
  return {
    impacts: [],
    mustChange: [],
    mayChange: [],
    testFiles: [],
    stats: {
      seedsCount: 1,
      totalImpacted: 0,
      mustChangeCount: 0,
      mayChangeCount: 0,
      maxDistance: 0,
      propagationTimeMs: 1,
    },
    ...overrides,
  };
}

describe("CompletenessChecker", () => {
  const checker = new CompletenessChecker();

  it("returns complete when all must-change files are modified", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts", "src/b.ts"],
      mayChange: ["src/c.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/b.ts", reasons: [{ symbol: "bar", kind: "implementor" as const, sourceFile: "src/x.ts", line: 2 }], level: "must-change", distance: 1, score: 9 },
        { file: "src/c.ts", reasons: [{ symbol: "baz", kind: "importer" as const, sourceFile: "src/x.ts", line: 3 }], level: "may-change", distance: 2, score: 5 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts", "src/b.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.status).toBe("complete");
    expect(report.score).toBe(100);
    expect(report.missingFiles).toHaveLength(0);
  });

  it("returns incomplete when must-change files are missing", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts", "src/b.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/b.ts", reasons: [{ symbol: "bar", kind: "implementor" as const, sourceFile: "src/x.ts", line: 2 }], level: "must-change", distance: 1, score: 9 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.status).toBe("incomplete");
    expect(report.missingFiles.length).toBeGreaterThanOrEqual(1);
    expect(report.missingFiles.some((m) => m.file === "src/b.ts")).toBe(true);
  });

  it("returns warning when tests are missing", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      testFiles: ["src/__tests__/a.test.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/__tests__/a.test.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "may-change", distance: 1, score: 5 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.status).toBe("warning");
    expect(report.testStatus.missingTests).toContain("src/__tests__/a.test.ts");
  });

  it("handles empty impact result", () => {
    const impact = makeImpactResult();
    const report = checker.check({
      actualChanges: ["src/a.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.status).toBe("complete");
    expect(report.score).toBe(100);
  });

  it("finds extra changes", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts", "src/unrelated.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.extraChanges).toContain("src/unrelated.ts");
  });

  it("respects plannedChanges", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts", "src/b.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/b.ts", reasons: [{ symbol: "bar", kind: "implementor" as const, sourceFile: "src/x.ts", line: 2 }], level: "must-change", distance: 1, score: 9 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts"],
      plannedChanges: ["src/b.ts"],
      impactResult: impact,
      checkTests: true,
    });

    // src/b.ts is planned but not yet actual — should not be missing
    expect(report.missingFiles.every((m) => m.file !== "src/b.ts")).toBe(true);
  });

  it("skips test check when checkTests=false", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      testFiles: ["src/__tests__/a.test.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts"],
      impactResult: impact,
      checkTests: false,
    });

    expect(report.testStatus.adequate).toBe(true);
    expect(report.testStatus.hasTestFiles).toBe(false);
  });

  it("calculates score correctly", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts", "src/b.ts", "src/c.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/b.ts", reasons: [{ symbol: "bar", kind: "caller" as const, sourceFile: "src/x.ts", line: 2 }], level: "must-change", distance: 1, score: 9 },
        { file: "src/c.ts", reasons: [{ symbol: "baz", kind: "caller" as const, sourceFile: "src/x.ts", line: 3 }], level: "must-change", distance: 1, score: 8 },
      ],
    });

    // 2/3 must-change covered = 46.7, + 30 test = 76.7 → round 77
    const report = checker.check({
      actualChanges: ["src/a.ts", "src/b.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.stats.mustChangeCovered).toBe(2);
    expect(report.stats.mustChangeTotal).toBe(3);
    expect(report.score).toBe(77);
  });

  it("classifies missing files by category", () => {
    const impact = makeImpactResult({
      mustChange: ["src/caller.ts", "src/impl.ts"],
      impacts: [
        { file: "src/caller.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/impl.ts", reasons: [{ symbol: "IWidget", kind: "implementor" as const, sourceFile: "src/x.ts", line: 2 }], level: "must-change", distance: 1, score: 9 },
      ],
    });

    const report = checker.check({
      actualChanges: [],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.missingFiles.some((m) => m.category === "caller")).toBe(true);
    expect(report.missingFiles.some((m) => m.category === "implementor")).toBe(true);
  });

  it("deduplicates missing files keeping highest priority", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      impacts: [
        {
          file: "src/a.ts",
          reasons: [
            { symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 },
            { symbol: "IWidget", kind: "implementor" as const, sourceFile: "src/x.ts", line: 2 },
          ],
          level: "must-change",
          distance: 1,
          score: 10,
        },
      ],
    });

    const report = checker.check({
      actualChanges: [],
      impactResult: impact,
      checkTests: true,
    });

    // Should deduplicate to one entry per file
    const aFiles = report.missingFiles.filter((m) => m.file === "src/a.ts");
    expect(aFiles.length).toBeLessThanOrEqual(1);
  });

  it("generates checklist with priorities", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      testFiles: ["src/__tests__/a.test.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/__tests__/a.test.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "may-change", distance: 2, score: 5 },
      ],
    });

    const report = checker.check({
      actualChanges: [],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.checklist.length).toBeGreaterThan(0);
    expect(report.checklist.some((item) => item.priority === "critical")).toBe(true);
    expect(report.checklist.every((item) => !item.done)).toBe(true);
  });

  it("normalizes paths correctly", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
      ],
    });

    // Windows-style path should match
    const report = checker.check({
      actualChanges: ["src\\a.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.missingFiles).toHaveLength(0);
  });

  it("toCompactString produces readable output", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
      ],
    });

    const report = checker.check({
      actualChanges: [],
      impactResult: impact,
      checkTests: true,
    });

    const str = checker.toCompactString(report);
    expect(str).toContain("INCOMPLETE");
    expect(str).toContain("src/a.ts");
  });

  it("toCompactString shows complete when nothing missing", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts"],
      impactResult: impact,
      checkTests: true,
    });

    const str = checker.toCompactString(report);
    expect(str).toContain("COMPLETE");
    expect(str).toContain("100/100");
  });

  it("stats are consistent with report", () => {
    const impact = makeImpactResult({
      mustChange: ["src/a.ts"],
      mayChange: ["src/b.ts"],
      testFiles: ["src/__tests__/a.test.ts"],
      impacts: [
        { file: "src/a.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "must-change", distance: 1, score: 10 },
        { file: "src/b.ts", reasons: [{ symbol: "bar", kind: "importer" as const, sourceFile: "src/x.ts", line: 2 }], level: "may-change", distance: 2, score: 5 },
        { file: "src/__tests__/a.test.ts", reasons: [{ symbol: "foo", kind: "caller" as const, sourceFile: "src/x.ts", line: 1 }], level: "may-change", distance: 1, score: 3 },
      ],
    });

    const report = checker.check({
      actualChanges: ["src/a.ts", "src/b.ts"],
      impactResult: impact,
      checkTests: true,
    });

    expect(report.stats.mustChangeTotal).toBe(1);
    expect(report.stats.mustChangeCovered).toBe(1);
    expect(report.stats.mayChangeTotal).toBe(1);
    expect(report.stats.mayChangeCovered).toBe(1);
    expect(report.stats.testTotal).toBe(1);
    expect(report.stats.testCovered).toBe(0);
  });
});
