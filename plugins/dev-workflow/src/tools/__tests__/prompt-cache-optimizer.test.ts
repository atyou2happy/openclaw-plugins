import { describe, expect, it } from "vitest";
import { PromptCacheOptimizer } from "../prompt-cache-optimizer.js";

describe("PromptCacheOptimizer", () => {
  const optimizer = new PromptCacheOptimizer();

  // ─── buildOptimizedPrompt ───

  describe("buildOptimizedPrompt", () => {
    it("returns blocks with static ones first, dynamic last", () => {
      const result = optimizer.buildOptimizedPrompt(
        "spec",
        "user asks to implement feature X",
        "project: my-app, stack: TypeScript",
      );

      const blocks = result.blocks;

      // Find the indices of static vs dynamic blocks
      const staticIndices = blocks
        .map((b, i) => (b.isStatic ? i : -1))
        .filter((i) => i >= 0);
      const dynamicIndices = blocks
        .map((b, i) => (!b.isStatic ? i : -1))
        .filter((i) => i >= 0);

      // All static indices come before all dynamic indices
      const lastStatic = Math.max(...staticIndices);
      const firstDynamic = Math.min(...dynamicIndices);
      expect(lastStatic).toBeLessThan(firstDynamic);

      // The very last block should be dynamic (dynamic-context)
      expect(blocks[blocks.length - 1].id).toBe("dynamic-context");
      expect(blocks[blocks.length - 1].isStatic).toBe(false);
    });

    it("includes step-specific block when step is known", () => {
      const result = optimizer.buildOptimizedPrompt("brainstorm", "ctx");

      const brainstormBlock = result.blocks.find(
        (b) => b.id === "brainstorm-context",
      );
      expect(brainstormBlock).toBeDefined();
      expect(brainstormBlock!.isStatic).toBe(true);
    });

    it("includes global static system blocks", () => {
      const result = optimizer.buildOptimizedPrompt("spec", "ctx");

      const ids = result.blocks.map((b) => b.id);
      expect(ids).toContain("role-definition");
      expect(ids).toContain("output-format");
      expect(ids).toContain("token-budget-awareness");
    });

    it("includes project-context block when projectContext is provided", () => {
      const result = optimizer.buildOptimizedPrompt(
        "spec",
        "ctx",
        "my project context",
      );

      const projBlock = result.blocks.find((b) => b.id === "project-context");
      expect(projBlock).toBeDefined();
      expect(projBlock!.content).toBe("my project context");
      expect(projBlock!.isStatic).toBe(false);
    });

    it("omits project-context block when projectContext is omitted", () => {
      const result = optimizer.buildOptimizedPrompt("spec", "ctx");

      const projBlock = result.blocks.find((b) => b.id === "project-context");
      expect(projBlock).toBeUndefined();
    });

    it("sets cacheHitPotential to staticTokens / totalTokens", () => {
      const result = optimizer.buildOptimizedPrompt(
        "spec",
        "dynamic content here",
      );

      expect(result.cacheHitPotential).toBeGreaterThan(0);
      expect(result.cacheHitPotential).toBeLessThanOrEqual(1);

      // Manual verification: ratio of static tokens to total tokens
      let staticTokens = 0;
      let totalTokens = 0;
      for (const b of result.blocks) {
        const t = Math.ceil(b.content.length * 0.25); // rough ASCII estimate
        totalTokens += t;
        if (b.isStatic) staticTokens += t;
      }
      // The ratio should be in the right ballpark (within rounding tolerance)
      const expected =
        totalTokens > 0 ? staticTokens / totalTokens : 0;
      expect(result.cacheHitPotential).toBeCloseTo(expected, 0);
    });

    it("counts cacheableBlocks as number of static blocks", () => {
      const result = optimizer.buildOptimizedPrompt("review", "ctx");

      const staticCount = result.blocks.filter((b) => b.isStatic).length;
      expect(result.cacheableBlocks).toBe(staticCount);
    });

    it("works with unknown step (no stepBlock)", () => {
      const result = optimizer.buildOptimizedPrompt(
        "unknown-step-xyz",
        "some dynamic context",
      );

      // Should still have the 3 global static blocks
      const staticBlocks = result.blocks.filter((b) => b.isStatic);
      expect(staticBlocks.length).toBe(3);

      // No step-specific block
      const stepBlock = result.blocks.find(
        (b) => b.id === "unknown-step-xyz-context",
      );
      expect(stepBlock).toBeUndefined();

      // Dynamic block is still present and last
      expect(result.blocks[result.blocks.length - 1].id).toBe(
        "dynamic-context",
      );
    });
  });

  // ─── toFlatString ───

  describe("toFlatString", () => {
    it("joins block contents with --- separator", () => {
      const result = optimizer.buildOptimizedPrompt("spec", "hello world");
      const flat = optimizer.toFlatString(result);

      // Should contain the --- separator between blocks
      expect(flat).toContain("\n\n---\n\n");

      // Each block's content should appear in order
      for (const block of result.blocks) {
        expect(flat).toContain(block.content);
      }
    });

    it("produces separators count = blocks count - 1", () => {
      const result = optimizer.buildOptimizedPrompt("spec", "ctx");
      const flat = optimizer.toFlatString(result);

      const sepCount = flat.split("\n\n---\n\n").length - 1;
      expect(sepCount).toBe(result.blocks.length - 1);
    });
  });

  // ─── toAnthropicBlocks ───

  describe("toAnthropicBlocks", () => {
    it("marks only the last static block with cache_control ephemeral", () => {
      const result = optimizer.buildOptimizedPrompt("spec", "dynamic");
      const anthropic = optimizer.toAnthropicBlocks(result);

      // Find all blocks with cache_control
      const withCacheControl = anthropic.filter(
        (b) => b.cache_control !== undefined,
      );
      expect(withCacheControl).toHaveLength(1);
      expect(withCacheControl[0].cache_control).toEqual({ type: "ephemeral" });

      // Verify it corresponds to the last static PromptBlock
      let lastStaticIdx = -1;
      for (let i = result.blocks.length - 1; i >= 0; i--) {
        if (result.blocks[i].isStatic) {
          lastStaticIdx = i;
          break;
        }
      }
      expect(anthropic[lastStaticIdx].cache_control).toEqual({
        type: "ephemeral",
      });
    });

    it("produces type:text objects for every block", () => {
      const result = optimizer.buildOptimizedPrompt("review", "ctx");
      const anthropic = optimizer.toAnthropicBlocks(result);

      expect(anthropic).toHaveLength(result.blocks.length);
      for (const ab of anthropic) {
        expect(ab.type).toBe("text");
        expect(typeof ab.text).toBe("string");
      }
    });
  });

  // ─── isCacheHit ───

  describe("isCacheHit", () => {
    it("returns false on first call with new content", () => {
      const fresh = new PromptCacheOptimizer();
      const hit = fresh.isCacheHit("block-a", "content-a");
      expect(hit).toBe(false);
    });

    it("returns true on second call with same content", () => {
      const fresh = new PromptCacheOptimizer();
      fresh.isCacheHit("block-a", "content-a");
      const hit = fresh.isCacheHit("block-a", "content-a");
      expect(hit).toBe(true);
    });

    it("returns false when content changes between calls", () => {
      const fresh = new PromptCacheOptimizer();
      fresh.isCacheHit("block-a", "content-v1");
      const hit = fresh.isCacheHit("block-a", "content-v2");
      expect(hit).toBe(false);
    });

    it("tracks different blockIds independently", () => {
      const fresh = new PromptCacheOptimizer();
      fresh.isCacheHit("block-a", "same");
      // Different blockId, same content → should be a miss (independent tracking)
      const hit = fresh.isCacheHit("block-b", "same");
      expect(hit).toBe(false);
    });
  });

  // ─── getStats / reset ───

  describe("getStats and reset", () => {
    it("tracks totalCalls and cacheHits", () => {
      const fresh = new PromptCacheOptimizer();

      fresh.isCacheHit("b1", "aaa"); // call 1, miss
      fresh.isCacheHit("b1", "aaa"); // call 2, hit
      fresh.isCacheHit("b1", "bbb"); // call 3, miss
      fresh.isCacheHit("b1", "bbb"); // call 4, hit

      const stats = fresh.getStats();
      expect(stats.totalCalls).toBe(4);
      expect(stats.cacheHits).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it("reset clears all state", () => {
      const fresh = new PromptCacheOptimizer();

      fresh.isCacheHit("b1", "aaa");
      fresh.isCacheHit("b1", "aaa");
      fresh.isCacheHit("b2", "xxx");

      expect(fresh.getStats().totalCalls).toBe(3);

      fresh.reset();

      const stats = fresh.getStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.hitRate).toBe(0);

      // After reset, previously cached content should be a miss again
      const hit = fresh.isCacheHit("b1", "aaa");
      expect(hit).toBe(false);
    });

    it("hitRate is 0 when no calls made", () => {
      const fresh = new PromptCacheOptimizer();
      expect(fresh.getStats().hitRate).toBe(0);
    });
  });
});
