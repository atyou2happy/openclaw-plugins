import { describe, expect, it, vi } from "vitest";
import {
  PropagationEngine,
  isTestFile,
} from "../propagation-engine.js";
import type { ImpactSeed, PropagationResult } from "../propagation-engine.js";
import type {
  SymbolGraph,
  RefEntry,
  DefEntry,
  InheritEntry,
} from "../symbol-graph-builder.js";

// ─── Mock SymbolGraph Factory ───

interface MockGraphOptions {
  tags?: SymbolGraph["tags"];
  definitions?: Map<string, DefEntry[]>;
  reverseRefs?: Map<string, RefEntry[]>;
  inheritanceMap?: Map<string, InheritEntry[]>;
  importGraph?: Map<string, Set<string>>;
}

function makeMockGraph(opts: MockGraphOptions = {}): SymbolGraph {
  return {
    tags: opts.tags ?? [],
    definitions: opts.definitions ?? new Map(),
    reverseRefs: opts.reverseRefs ?? new Map(),
    inheritanceMap: opts.inheritanceMap ?? new Map(),
    importGraph: opts.importGraph ?? new Map(),
    stats: {
      filesScanned: 0,
      totalTags: 0,
      totalDefs: 0,
      totalRefs: 0,
      totalInheritance: 0,
      totalImports: 0,
    },
  };
}

// ─── Tests ───

describe("PropagationEngine", () => {
  describe("propagate()", () => {
    it("finds direct callers from a single file change", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "doWork", kind: "def", type: "function", file: "src/worker.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["doWork", [{ file: "src/worker.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["doWork", [{ file: "src/main.ts", line: 10, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine();
      const seeds: ImpactSeed[] = [
        { file: "src/worker.ts", symbols: [], changeType: "signature" },
      ];

      const result = engine.propagate(graph, seeds);

      expect(result.impacts.length).toBe(1);
      expect(result.impacts[0].file).toBe("src/main.ts");
      expect(result.impacts[0].reasons[0].kind).toBe("caller");
      expect(result.impacts[0].reasons[0].symbol).toBe("doWork");
    });

    it("finds only refs to a specific symbol when symbols are specified", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnA", kind: "def", type: "function", file: "src/lib.ts", line: 1, exported: true, parent: null },
          { name: "fnB", kind: "def", type: "function", file: "src/lib.ts", line: 5, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnA", [{ file: "src/lib.ts", line: 1, exported: true, type: "function", parent: null }]],
          ["fnB", [{ file: "src/lib.ts", line: 5, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnA", [{ file: "src/callerA.ts", line: 3, type: "function" }]],
          ["fnB", [{ file: "src/callerB.ts", line: 7, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine();
      const seeds: ImpactSeed[] = [
        { file: "src/lib.ts", symbols: ["fnA"], changeType: "signature" },
      ];

      const result = engine.propagate(graph, seeds);

      // Only fnA's caller should be found, not fnB's
      expect(result.impacts.length).toBe(1);
      expect(result.impacts[0].file).toBe("src/callerA.ts");
      expect(result.impacts[0].reasons[0].symbol).toBe("fnA");
    });

    it("classifies direct callers as must-change", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "process", kind: "def", type: "function", file: "src/core.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["process", [{ file: "src/core.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["process", [{ file: "src/api.ts", line: 20, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/core.ts", symbols: [], changeType: "signature" },
      ]);

      expect(result.impacts[0].level).toBe("must-change");
      expect(result.mustChange).toContain("src/api.ts");
    });

    it("classifies importers as may-change", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "util", kind: "def", type: "function", file: "src/utils.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["util", [{ file: "src/utils.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map(),
        importGraph: new Map([
          ["src/consumer.ts", new Set(["src/utils"])],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/utils.ts", symbols: [], changeType: "behavior" },
      ]);

      const importerImpact = result.impacts.find((i) => i.file === "src/consumer.ts");
      expect(importerImpact).toBeDefined();
      expect(importerImpact!.level).toBe("may-change");
      expect(result.mayChange).toContain("src/consumer.ts");
    });

    it("finds interface implementors via inheritanceMap", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "IRepository", kind: "def", type: "interface", file: "src/types.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["IRepository", [{ file: "src/types.ts", line: 1, exported: true, type: "interface", parent: null }]],
        ]),
        reverseRefs: new Map(),
        inheritanceMap: new Map([
          ["IRepository", [
            { file: "src/sql-repo.ts", child: "SqlRepo", kind: "implements", line: 5 },
            { file: "src/memory-repo.ts", child: "MemoryRepo", kind: "implements", line: 3 },
          ]],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/types.ts", symbols: ["IRepository"], changeType: "signature" },
      ]);

      expect(result.impacts.length).toBeGreaterThanOrEqual(2);
      const files = result.impacts.map((i) => i.file);
      expect(files).toContain("src/sql-repo.ts");
      expect(files).toContain("src/memory-repo.ts");
      // Implementors are must-change
      result.impacts.forEach((imp) => {
        expect(imp.level).toBe("must-change");
      });
    });

    it("performs multi-hop propagation (distance 2) via import graph", () => {
      // Chain: c.ts <-imports- b.ts <-imports- a.ts
      // Multi-hop in this engine works via importGraph for transitive dependencies
      const graph = makeMockGraph({
        tags: [
          { name: "fnC", kind: "def", type: "function", file: "src/c.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnC", [{ file: "src/c.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnC", [{ file: "src/b.ts", line: 5, type: "function" }]],
        ]),
        importGraph: new Map([
          ["src/b.ts", new Set(["src/c"])],
          ["src/a.ts", new Set(["src/b"])],
        ]),
      });

      const engine = new PropagationEngine({ maxDepth: 2 });
      const result = engine.propagate(graph, [
        { file: "src/c.ts", symbols: [], changeType: "signature" },
      ]);

      const files = result.impacts.map((i) => i.file);
      expect(files).toContain("src/b.ts");
      // a.ts imports b.ts which depends on c.ts -> distance 2
      expect(files).toContain("src/a.ts");

      const bNode = result.impacts.find((i) => i.file === "src/b.ts")!;
      const aNode = result.impacts.find((i) => i.file === "src/a.ts")!;
      expect(bNode.distance).toBe(1);
      expect(aNode.distance).toBe(2);
    });

    it("respects maxDepth=1: no multi-hop", () => {
      // Same chain but depth limited
      const graph = makeMockGraph({
        tags: [
          { name: "fnC", kind: "def", type: "function", file: "src/c.ts", line: 1, exported: true, parent: null },
          { name: "fnB", kind: "def", type: "function", file: "src/b.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnC", [{ file: "src/c.ts", line: 1, exported: true, type: "function", parent: null }]],
          ["fnB", [{ file: "src/b.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnC", [{ file: "src/b.ts", line: 5, type: "function" }]],
          ["fnB", [{ file: "src/a.ts", line: 10, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine({ maxDepth: 1 });
      const result = engine.propagate(graph, [
        { file: "src/c.ts", symbols: [], changeType: "signature" },
      ]);

      const files = result.impacts.map((i) => i.file);
      expect(files).toContain("src/b.ts");
      expect(files).not.toContain("src/a.ts");
    });

    it("respects maxDepth=0: no propagation at all", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnC", kind: "def", type: "function", file: "src/c.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnC", [{ file: "src/c.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnC", [{ file: "src/b.ts", line: 5, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine({ maxDepth: 0 });
      const result = engine.propagate(graph, [
        { file: "src/c.ts", symbols: [], changeType: "signature" },
      ]);

      expect(result.impacts.length).toBe(0);
    });

    it("scores directCaller higher than typeUser and importer", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "MyClass", kind: "def", type: "class", file: "src/model.ts", line: 1, exported: true, parent: null },
          { name: "doWork", kind: "def", type: "function", file: "src/model.ts", line: 10, exported: true, parent: null },
        ],
        definitions: new Map([
          ["MyClass", [{ file: "src/model.ts", line: 1, exported: true, type: "class", parent: null }]],
          ["doWork", [{ file: "src/model.ts", line: 10, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          // type-user (class ref)
          ["MyClass", [{ file: "src/type-user.ts", line: 3, type: "class" }]],
          // direct caller (function ref)
          ["doWork", [{ file: "src/caller.ts", line: 5, type: "function" }]],
        ]),
        importGraph: new Map([
          ["src/importer.ts", new Set(["src/model"])],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/model.ts", symbols: [], changeType: "signature" },
      ]);

      const caller = result.impacts.find((i) => i.file === "src/caller.ts");
      const typeUser = result.impacts.find((i) => i.file === "src/type-user.ts");
      const importer = result.impacts.find((i) => i.file === "src/importer.ts");

      expect(caller).toBeDefined();
      expect(typeUser).toBeDefined();
      expect(importer).toBeDefined();
      expect(caller!.score).toBeGreaterThan(typeUser!.score);
      expect(caller!.score).toBeGreaterThan(importer!.score);
      expect(typeUser!.score).toBeGreaterThan(importer!.score);
    });

    it("handles empty seeds gracefully", () => {
      const graph = makeMockGraph();
      const engine = new PropagationEngine();
      const result = engine.propagate(graph, []);

      expect(result.impacts).toEqual([]);
      expect(result.mustChange).toEqual([]);
      expect(result.mayChange).toEqual([]);
      expect(result.stats.seedsCount).toBe(0);
      expect(result.stats.totalImpacted).toBe(0);
    });

    it("handles seed with no references (no impact)", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "lonely", kind: "def", type: "function", file: "src/lonely.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["lonely", [{ file: "src/lonely.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map(),
        importGraph: new Map(),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/lonely.ts", symbols: [], changeType: "refactor" },
      ]);

      expect(result.impacts.length).toBe(0);
      expect(result.stats.totalImpacted).toBe(0);
    });

    it("produces union of impacts from multiple seeds", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnA", kind: "def", type: "function", file: "src/a.ts", line: 1, exported: true, parent: null },
          { name: "fnB", kind: "def", type: "function", file: "src/b.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnA", [{ file: "src/a.ts", line: 1, exported: true, type: "function", parent: null }]],
          ["fnB", [{ file: "src/b.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnA", [{ file: "src/consumer1.ts", line: 5, type: "function" }]],
          ["fnB", [{ file: "src/consumer2.ts", line: 10, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/a.ts", symbols: [], changeType: "signature" },
        { file: "src/b.ts", symbols: [], changeType: "signature" },
      ]);

      expect(result.stats.seedsCount).toBe(2);
      const files = result.impacts.map((i) => i.file);
      expect(files).toContain("src/consumer1.ts");
      expect(files).toContain("src/consumer2.ts");
    });

    it("records propagationTimeMs as reasonable", () => {
      const graph = makeMockGraph();
      const engine = new PropagationEngine();
      const result = engine.propagate(graph, []);

      expect(result.stats.propagationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.propagationTimeMs).toBeLessThan(5000);
    });

    it("does not include seed files as impacts", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnA", kind: "def", type: "function", file: "src/seed.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnA", [{ file: "src/seed.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnA", [
            { file: "src/seed.ts", line: 5, type: "function" }, // self-ref (should be skipped)
            { file: "src/other.ts", line: 3, type: "function" },
          ]],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/seed.ts", symbols: [], changeType: "signature" },
      ]);

      const files = result.impacts.map((i) => i.file);
      expect(files).not.toContain("src/seed.ts");
      expect(files).toContain("src/other.ts");
    });

    it("sorts impacts by score descending", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnHi", kind: "def", type: "function", file: "src/core.ts", line: 1, exported: true, parent: null },
          { name: "MyType", kind: "def", type: "class", file: "src/core.ts", line: 5, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnHi", [{ file: "src/core.ts", line: 1, exported: true, type: "function", parent: null }]],
          ["MyType", [{ file: "src/core.ts", line: 5, exported: true, type: "class", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnHi", [{ file: "src/caller.ts", line: 3, type: "function" }]],
          ["MyType", [{ file: "src/typeuser.ts", line: 7, type: "class" }]],
        ]),
        importGraph: new Map([
          ["src/importer.ts", new Set(["src/core"])],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/core.ts", symbols: [], changeType: "signature" },
      ]);

      for (let i = 1; i < result.impacts.length; i++) {
        expect(result.impacts[i - 1].score).toBeGreaterThanOrEqual(result.impacts[i].score);
      }
    });

    it("populates stats correctly", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnA", kind: "def", type: "function", file: "src/a.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnA", [{ file: "src/a.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnA", [
            { file: "src/b.ts", line: 3, type: "function" },
          ]],
        ]),
        importGraph: new Map([
          ["src/c.ts", new Set(["src/a"])],
        ]),
      });

      const engine = new PropagationEngine({ maxDepth: 2 });
      const result = engine.propagate(graph, [
        { file: "src/a.ts", symbols: [], changeType: "signature" },
      ]);

      expect(result.stats.seedsCount).toBe(1);
      expect(result.stats.totalImpacted).toBe(result.impacts.length);
      expect(result.stats.mustChangeCount).toBe(result.mustChange.length);
      expect(result.stats.mayChangeCount).toBe(result.mayChange.length);
      expect(result.stats.maxDistance).toBe(
        result.impacts.length > 0
          ? Math.max(...result.impacts.map((i) => i.distance))
          : 0,
      );
    });

    it("identifies test files in the result", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnA", kind: "def", type: "function", file: "src/a.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnA", [{ file: "src/a.ts", line: 1, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnA", [{ file: "src/__tests__/a.test.ts", line: 5, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/a.ts", symbols: [], changeType: "signature" },
      ]);

      expect(result.testFiles).toContain("src/__tests__/a.test.ts");
    });

    it("uses all symbols in file when seed.symbols is empty", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fn1", kind: "def", type: "function", file: "src/lib.ts", line: 1, exported: true, parent: null },
          { name: "fn2", kind: "def", type: "function", file: "src/lib.ts", line: 5, exported: true, parent: null },
          { name: "fn3", kind: "ref", type: "function", file: "src/lib.ts", line: 10, exported: false, parent: null },
        ],
        definitions: new Map([
          ["fn1", [{ file: "src/lib.ts", line: 1, exported: true, type: "function", parent: null }]],
          ["fn2", [{ file: "src/lib.ts", line: 5, exported: true, type: "function", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fn1", [{ file: "src/c1.ts", line: 3, type: "function" }]],
          ["fn2", [{ file: "src/c2.ts", line: 7, type: "function" }]],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/lib.ts", symbols: [], changeType: "behavior" },
      ]);

      const files = result.impacts.map((i) => i.file);
      // Both fn1 and fn2 callers should be found (ref tags are skipped)
      expect(files).toContain("src/c1.ts");
      expect(files).toContain("src/c2.ts");
    });

    it("finds extendors via inheritanceMap with kind 'extends'", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "BaseClass", kind: "def", type: "class", file: "src/base.ts", line: 1, exported: true, parent: null },
        ],
        definitions: new Map([
          ["BaseClass", [{ file: "src/base.ts", line: 1, exported: true, type: "class", parent: null }]],
        ]),
        reverseRefs: new Map(),
        inheritanceMap: new Map([
          ["BaseClass", [
            { file: "src/child.ts", child: "ChildClass", kind: "extends", line: 3 },
          ]],
        ]),
      });

      const engine = new PropagationEngine();
      const result = engine.propagate(graph, [
        { file: "src/base.ts", symbols: ["BaseClass"], changeType: "signature" },
      ]);

      const extImpact = result.impacts.find((i) => i.file === "src/child.ts");
      expect(extImpact).toBeDefined();
      expect(extImpact!.reasons[0].kind).toBe("extender");
      expect(extImpact!.level).toBe("must-change");
    });

    it("applies custom weights from config", () => {
      const graph = makeMockGraph({
        tags: [
          { name: "fnA", kind: "def", type: "function", file: "src/a.ts", line: 1, exported: true, parent: null },
          { name: "MyType", kind: "def", type: "class", file: "src/a.ts", line: 5, exported: true, parent: null },
        ],
        definitions: new Map([
          ["fnA", [{ file: "src/a.ts", line: 1, exported: true, type: "function", parent: null }]],
          ["MyType", [{ file: "src/a.ts", line: 5, exported: true, type: "class", parent: null }]],
        ]),
        reverseRefs: new Map([
          ["fnA", [{ file: "src/caller.ts", line: 3, type: "function" }]],
          ["MyType", [{ file: "src/typeuser.ts", line: 5, type: "class" }]],
        ]),
      });

      const engine = new PropagationEngine({
        weights: { directCaller: 1, typeUser: 100, implementor: 9, extender: 8, importer: 5, distanceDecay: 0.6 },
      });
      const result = engine.propagate(graph, [
        { file: "src/a.ts", symbols: [], changeType: "signature" },
      ]);

      const caller = result.impacts.find((i) => i.file === "src/caller.ts")!;
      const typeUser = result.impacts.find((i) => i.file === "src/typeuser.ts")!;
      // With custom weights, typeUser (100) > caller (1)
      expect(typeUser.score).toBeGreaterThan(caller.score);
    });
  });

  describe("toCompactString()", () => {
    it("serializes must-change and may-change sections", () => {
      const engine = new PropagationEngine();
      const result: PropagationResult = {
        impacts: [
          {
            file: "src/api.ts",
            reasons: [{ symbol: "handleRequest", kind: "caller", sourceFile: "src/server.ts", line: 10 }],
            level: "must-change",
            distance: 1,
            score: 10,
          },
          {
            file: "src/logger.ts",
            reasons: [{ symbol: "src/server", kind: "importer", sourceFile: "src/server.ts", line: 0 }],
            level: "may-change",
            distance: 1,
            score: 5,
          },
        ],
        mustChange: ["src/api.ts"],
        mayChange: ["src/logger.ts"],
        testFiles: [],
        stats: { seedsCount: 1, totalImpacted: 2, mustChangeCount: 1, mayChangeCount: 1, maxDistance: 1, propagationTimeMs: 5 },
      };

      const str = engine.toCompactString(result);
      expect(str).toContain("### MUST CHANGE:");
      expect(str).toContain("src/api.ts");
      expect(str).toContain("caller(handleRequest)");
      expect(str).toContain("### MAY CHANGE:");
      expect(str).toContain("src/logger.ts");
      expect(str).toContain("importer(src/server)");
    });

    it("respects token budget by truncating output", () => {
      const engine = new PropagationEngine({ tokenBudget: 50 });
      const manyImpacts: PropagationResult = {
        impacts: Array.from({ length: 50 }, (_, i) => ({
          file: `src/file-${i}.ts`,
          reasons: [{ symbol: `sym${i}`, kind: "caller" as const, sourceFile: "src/changed.ts", line: i }],
          level: "must-change" as const,
          distance: 1,
          score: 10 - i * 0.1,
        })),
        mustChange: Array.from({ length: 50 }, (_, i) => `src/file-${i}.ts`),
        mayChange: [],
        testFiles: [],
        stats: { seedsCount: 1, totalImpacted: 50, mustChangeCount: 50, mayChangeCount: 0, maxDistance: 1, propagationTimeMs: 1 },
      };

      const str = engine.toCompactString(manyImpacts);
      // Should not contain all 50 files due to budget constraint
      const fileMentions = str.split("\n").filter((l) => l.includes("src/file-")).length;
      expect(fileMentions).toBeLessThan(50);
    });

    it("handles empty result", () => {
      const engine = new PropagationEngine();
      const result: PropagationResult = {
        impacts: [],
        mustChange: [],
        mayChange: [],
        testFiles: [],
        stats: { seedsCount: 0, totalImpacted: 0, mustChangeCount: 0, mayChangeCount: 0, maxDistance: 0, propagationTimeMs: 0 },
      };

      const str = engine.toCompactString(result);
      expect(str).toContain("Impact Analysis (0 files affected)");
      expect(str).not.toContain("### MUST CHANGE:");
      expect(str).not.toContain("### MAY CHANGE:");
    });

    it("includes header with total count", () => {
      const engine = new PropagationEngine();
      const result: PropagationResult = {
        impacts: [
          {
            file: "src/a.ts",
            reasons: [{ symbol: "fn", kind: "caller", sourceFile: "src/b.ts", line: 1 }],
            level: "must-change",
            distance: 1,
            score: 10,
          },
        ],
        mustChange: ["src/a.ts"],
        mayChange: [],
        testFiles: [],
        stats: { seedsCount: 1, totalImpacted: 1, mustChangeCount: 1, mayChangeCount: 0, maxDistance: 1, propagationTimeMs: 0 },
      };

      const str = engine.toCompactString(result);
      expect(str).toContain("Impact Analysis (1 files affected)");
    });
  });

  describe("isTestFile()", () => {
    it("detects .test. files", () => {
      expect(isTestFile("src/utils.test.ts")).toBe(true);
      expect(isTestFile("src/components/button.test.tsx")).toBe(true);
    });

    it("detects .spec. files", () => {
      expect(isTestFile("src/utils.spec.ts")).toBe(true);
      expect(isTestFile("features/login.spec.js")).toBe(true);
    });

    it("detects __tests__ directory", () => {
      expect(isTestFile("src/__tests__/utils.ts")).toBe(true);
      expect(isTestFile("__tests__/integration/api.ts")).toBe(true);
    });

    it("detects /test/ directory", () => {
      expect(isTestFile("src/test/helpers.ts")).toBe(true);
      expect(isTestFile("packages/app/test/mock.ts")).toBe(true);
    });

    it("detects /tests/ directory", () => {
      expect(isTestFile("src/tests/setup.ts")).toBe(true);
      expect(isTestFile("packages/app/tests/unit/auth.ts")).toBe(true);
    });

    it("rejects non-test files", () => {
      expect(isTestFile("src/utils.ts")).toBe(false);
      expect(isTestFile("src/components/button.tsx")).toBe(false);
      expect(isTestFile("lib/index.js")).toBe(false);
      expect(isTestFile("src/testing.ts")).toBe(false);
    });

    it("handles Windows-style backslash paths", () => {
      expect(isTestFile("src\\__tests__\\utils.ts")).toBe(true);
      expect(isTestFile("src\\utils.test.ts")).toBe(true);
    });
  });
});
