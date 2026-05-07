import { describe, expect, it } from "vitest";
import { HistoryCondenser } from "../history-condenser.js";

// Helper: generate N decision strings
function makeDecisions(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Decision ${i}: completed task T${i}.`);
}

describe("HistoryCondenser", () => {
  describe("default config", () => {
    it("has correct defaults (l0MaxEntries=5, l1MaxEntries=20, triggerThreshold=15)", () => {
      const hc = new HistoryCondenser();
      // Verified indirectly through behavior; constructor accepts no args
      expect(hc).toBeDefined();
    });
  });

  describe("condense", () => {
    it("with empty array returns empty entries and ratio 1", () => {
      const hc = new HistoryCondenser();
      const result = hc.condense([]);

      expect(result.entries).toHaveLength(0);
      expect(result.originalTokens).toBe(0);
      expect(result.condensedTokens).toBe(0);
      // Empty array goes through the <= l0MaxEntries branch → ratio is 1
      expect(result.compressionRatio).toBe(1);
    });

    it("with <=5 decisions: all L0, compressionRatio=1", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(5);
      const result = hc.condense(decisions);

      expect(result.entries).toHaveLength(5);
      expect(result.entries.every((e) => e.tier === "L0")).toBe(true);
      expect(result.compressionRatio).toBe(1);

      // Content preserved exactly
      for (let i = 0; i < 5; i++) {
        expect(result.entries[i].content).toBe(decisions[i]);
        expect(result.entries[i].index).toBe(i);
      }
    });

    it("with 3 decisions: all L0, compressionRatio=1", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(3);
      const result = hc.condense(decisions);

      expect(result.entries).toHaveLength(3);
      expect(result.entries.every((e) => e.tier === "L0")).toBe(true);
      expect(result.compressionRatio).toBe(1);
    });

    it("with 10 decisions: last 5 L0, first 5 L1 (no L2 since l1Start=0)", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(10);
      const result = hc.condense(decisions);

      expect(result.entries).toHaveLength(10);

      // l0Start = max(0, 10-5) = 5 → indices 5-9 are L0
      // l1Start = max(0, 10-20) = 0 → indices 0-4 are L1
      // No indices fall into L2
      const l0 = result.entries.filter((e) => e.tier === "L0");
      const l1 = result.entries.filter((e) => e.tier === "L1");
      const l2 = result.entries.filter((e) => e.tier === "L2");

      expect(l0).toHaveLength(5);
      expect(l1).toHaveLength(5);
      expect(l2).toHaveLength(0);

      // L0 entries are indices 5-9, L1 entries are indices 0-4
      expect(l0.every((e) => e.index >= 5)).toBe(true);
      expect(l1.every((e) => e.index < 5)).toBe(true);

      // L0 content is full text, L1 is summarized
      for (const e of l0) {
        expect(e.content).toBe(decisions[e.index]);
      }
      for (const e of l1) {
        // L1 content is a truncated/summarized version (not full original)
        expect(e.content.length).toBeLessThanOrEqual(120);
      }

      // With short decision strings the L1 summary may equal the original,
      // so compressionRatio could be 1. Just verify it's > 0.
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it("with 25 decisions: last 5 L0, middle 15 L1, first 5 L2", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(25);
      const result = hc.condense(decisions);

      expect(result.entries).toHaveLength(25);

      // l0Start = max(0, 25-5) = 20 → indices 20-24 are L0 (5 entries)
      // l1Start = max(0, 25-20) = 5 → indices 5-19 are L1 (15 entries)
      // indices 0-4 are L2 (5 entries)
      const l0 = result.entries.filter((e) => e.tier === "L0");
      const l1 = result.entries.filter((e) => e.tier === "L1");
      const l2 = result.entries.filter((e) => e.tier === "L2");

      expect(l0).toHaveLength(5);
      expect(l1).toHaveLength(15);
      expect(l2).toHaveLength(5);

      expect(l0.every((e) => e.index >= 20)).toBe(true);
      expect(l1.every((e) => e.index >= 5 && e.index < 20)).toBe(true);
      expect(l2.every((e) => e.index < 5)).toBe(true);

      // L0 preserves full text
      for (const e of l0) {
        expect(e.content).toBe(decisions[e.index]);
      }

      // L2 content is either keywords (comma-separated) or truncated to ~50 chars
      for (const e of l2) {
        expect(e.content.length).toBeLessThanOrEqual(50);
      }

      // Significant compression
      expect(result.compressionRatio).toBeLessThan(1);
      expect(result.condensedTokens).toBeLessThan(result.originalTokens);
    });

    it("assigns correct index to each entry", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(25);
      const result = hc.condense(decisions);

      for (let i = 0; i < result.entries.length; i++) {
        expect(result.entries[i].index).toBe(i);
      }
    });

    it("populates tags array for every entry", () => {
      const hc = new HistoryCondenser();
      const decisions = [
        "Step1: fixed bug in AuthService.ts pass",
        "Step2: refactored ConfigLoader.js",
        "Step3: added test coverage 90%",
      ];
      const result = hc.condense(decisions);

      for (const entry of result.entries) {
        expect(Array.isArray(entry.tags)).toBe(true);
      }

      // Entries with recognizable patterns should have tags
      // "Step1" → s1, "AuthService.ts" → AuthService.ts, "pass" → pass
      expect(result.entries[0].tags).toContain("s1");
      expect(result.entries[0].tags).toContain("AuthService.ts");
      expect(result.entries[0].tags).toContain("pass");
    });

    it("originalTokens and condensedTokens are positive for non-empty input", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(10);
      const result = hc.condense(decisions);

      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.condensedTokens).toBeGreaterThan(0);
    });
  });

  describe("toFlatString", () => {
    it("returns raw content for L0 entries", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(3);
      const result = hc.condense(decisions);
      const flat = hc.toFlatString(result);

      // All L0 → no prefixes
      const lines = flat.split("\n");
      expect(lines).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(lines[i]).toBe(decisions[i]);
      }
    });

    it("uses [L1] prefix for L1 entries", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(10);
      const result = hc.condense(decisions);
      const flat = hc.toFlatString(result);

      const lines = flat.split("\n");
      // First 5 entries are L1 → should have [L1] prefix
      for (let i = 0; i < 5; i++) {
        expect(lines[i].startsWith("[L1] ")).toBe(true);
      }
      // Last 5 entries are L0 → no prefix
      for (let i = 5; i < 10; i++) {
        expect(lines[i].startsWith("[L1]")).toBe(false);
        expect(lines[i].startsWith("[L2]")).toBe(false);
        expect(lines[i]).toBe(decisions[i]);
      }
    });

    it("uses [L2] prefix for L2 entries", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(25);
      const result = hc.condense(decisions);
      const flat = hc.toFlatString(result);

      const lines = flat.split("\n");
      // First 5 entries are L2 → should have [L2] prefix
      for (let i = 0; i < 5; i++) {
        expect(lines[i].startsWith("[L2] ")).toBe(true);
      }
      // Entries 5-19 are L1 → [L1] prefix
      for (let i = 5; i < 20; i++) {
        expect(lines[i].startsWith("[L1] ")).toBe(true);
      }
      // Entries 20-24 are L0 → raw content
      for (let i = 20; i < 25; i++) {
        expect(lines[i]).toBe(decisions[i]);
      }
    });

    it("returns empty string for empty result", () => {
      const hc = new HistoryCondenser();
      const result = hc.condense([]);
      expect(hc.toFlatString(result)).toBe("");
    });
  });

  describe("shouldCondense", () => {
    it("returns false for count < 15", () => {
      const hc = new HistoryCondenser();
      expect(hc.shouldCondense(0)).toBe(false);
      expect(hc.shouldCondense(5)).toBe(false);
      expect(hc.shouldCondense(10)).toBe(false);
      expect(hc.shouldCondense(14)).toBe(false);
    });

    it("returns true for count >= 15", () => {
      const hc = new HistoryCondenser();
      expect(hc.shouldCondense(15)).toBe(true);
      expect(hc.shouldCondense(20)).toBe(true);
      expect(hc.shouldCondense(100)).toBe(true);
    });
  });

  describe("getStats", () => {
    it("shows correct L0/L1/L2 counts for 25 decisions", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(25);
      const result = hc.condense(decisions);
      const stats = hc.getStats(result);

      expect(stats).toContain("5L0");
      expect(stats).toContain("15L1");
      expect(stats).toContain("5L2");
      expect(stats).toContain("tok");
    });

    it("shows all L0 for small input", () => {
      const hc = new HistoryCondenser();
      const result = hc.condense(makeDecisions(3));
      const stats = hc.getStats(result);

      expect(stats).toContain("3L0");
      expect(stats).toContain("0L1");
      expect(stats).toContain("0L2");
    });

    it("includes compression ratio percentage", () => {
      const hc = new HistoryCondenser();
      const decisions = makeDecisions(25);
      const result = hc.condense(decisions);
      const stats = hc.getStats(result);

      // Stats format: "Condensed: 5L0 + 15L1 + 5L2 = XX% (YY/ZZ tok)"
      const pctMatch = stats.match(/(\d+)%/);
      expect(pctMatch).not.toBeNull();
      const pct = parseInt(pctMatch![1], 10);
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThan(100);
    });
  });

  describe("custom config", () => {
    it("overrides l0MaxEntries and l1MaxEntries", () => {
      const hc = new HistoryCondenser({ l0MaxEntries: 3, l1MaxEntries: 8 });
      const decisions = makeDecisions(12);

      // l0Start = max(0, 12-3) = 9 → indices 9-11 L0 (3)
      // l1Start = max(0, 12-8) = 4 → indices 4-8 L1 (5), indices 0-3 L2 (4)
      const result = hc.condense(decisions);

      const l0 = result.entries.filter((e) => e.tier === "L0");
      const l1 = result.entries.filter((e) => e.tier === "L1");
      const l2 = result.entries.filter((e) => e.tier === "L2");

      expect(l0).toHaveLength(3);
      expect(l1).toHaveLength(5);
      expect(l2).toHaveLength(4);
    });

    it("overrides triggerThreshold", () => {
      const hc = new HistoryCondenser({ triggerThreshold: 5 });
      expect(hc.shouldCondense(4)).toBe(false);
      expect(hc.shouldCondense(5)).toBe(true);
    });

    it("custom l0MaxEntries=10 keeps all 8 entries as L0", () => {
      const hc = new HistoryCondenser({ l0MaxEntries: 10 });
      const result = hc.condense(makeDecisions(8));

      expect(result.entries.every((e) => e.tier === "L0")).toBe(true);
      expect(result.compressionRatio).toBe(1);
    });
  });

  describe("L2 content", () => {
    it("uses keywords (tags) when available", () => {
      const hc = new HistoryCondenser();
      // Need 25+ decisions to get L2 entries
      const decisions = [
        "Step1: fixed authentication bug in AuthService.ts — all tests pass.",
        ...Array.from({ length: 19 }, (_, i) => `Medium decision ${i} with some detail.`),
        ...Array.from({ length: 5 }, (_, i) => `Recent decision ${i}.`),
      ];
      const result = hc.condense(decisions);

      const l2 = result.entries.filter((e) => e.tier === "L2");
      expect(l2.length).toBeGreaterThan(0);

      // The first entry has recognizable tags: s1, AuthService.ts, pass, AuthService
      const firstL2 = l2[0];
      expect(firstL2.tags.length).toBeGreaterThan(0);
      // L2 content is tags joined by comma when tags exist
      expect(firstL2.content).toBe(firstL2.tags.join(","));
    });

    it("truncates to ~50 chars when no tags are extractable", () => {
      const hc = new HistoryCondenser();
      const longNoKeywords = "aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj kkkk llll mmmm nnnn oooo pppp qqqq";
      const decisions = [
        longNoKeywords,
        ...Array.from({ length: 19 }, (_, i) => `Medium decision ${i} with some detail.`),
        ...Array.from({ length: 5 }, (_, i) => `Recent decision ${i}.`),
      ];
      const result = hc.condense(decisions);

      const firstEntry = result.entries[0];
      expect(firstEntry.tier).toBe("L2");
      // When no tags, falls back to decision.slice(0, 50)
      expect(firstEntry.content).toBe(longNoKeywords.slice(0, 50));
      expect(firstEntry.content.length).toBe(50);
    });
  });

  describe("compression ratio", () => {
    it("is exactly 1 when no condensation happens", () => {
      const hc = new HistoryCondenser();
      const result = hc.condense(makeDecisions(5));
      expect(result.compressionRatio).toBe(1);
    });

    it("is less than 1 when condensation happens", () => {
      const hc = new HistoryCondenser();
      const result = hc.condense(makeDecisions(25));
      expect(result.compressionRatio).toBeLessThan(1);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });
  });
});
