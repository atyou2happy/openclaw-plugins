/**
 * PropagationEngine — BFS impact propagation from changed symbols/files.
 *
 * Inspired by:
 * - Aider's PageRank-based relevance scoring
 * - Change Impact Analysis (CIA) dependency-graph method (Arnold & Bohner 1996)
 * - Ctxo MCP's "blast radius" concept
 * - SmartFileSelector's BFS import graph traversal
 *
 * Strategy:
 * 1. Start from changed files/symbols (seeds)
 * 2. BFS along reverse dependency edges (who depends on what)
 * 3. Classify impact: must-change (direct ref) vs may-change (indirect/transitive)
 * 4. Token budget: binary search to fit within budget (Aider strategy)
 * 5. Priority: direct callers > interface implementors > import neighbors > transitive
 *
 * Token efficiency: output only file:symbol pairs, no code content.
 */

import type { SymbolGraph } from "./symbol-graph-builder.js";

// ─── Types ───

export interface ImpactSeed {
  /** File that changed */
  file: string;
  /** Specific symbols that changed (empty = all symbols in file changed) */
  symbols: string[];
  /** Type of change */
  changeType: "signature" | "behavior" | "addition" | "removal" | "refactor";
}

export interface ImpactNode {
  /** Affected file */
  file: string;
  /** Why this file is affected */
  reasons: ImpactReason[];
  /** Impact level */
  level: "must-change" | "may-change" | "info";
  /** Propagation distance from seed (0 = seed itself) */
  distance: number;
  /** Relevance score (higher = more important) */
  score: number;
}

export interface ImpactReason {
  /** What symbol triggered this impact */
  symbol: string;
  /** Kind of dependency */
  kind: "caller" | "implementor" | "extender" | "importer" | "type-user" | "config-ref";
  /** Source file of the symbol */
  sourceFile: string;
  /** Line number of the reference */
  line: number;
}

export interface PropagationResult {
  /** All affected nodes, sorted by score descending */
  impacts: ImpactNode[];
  /** Files that must change */
  mustChange: string[];
  /** Files that may need changes */
  mayChange: string[];
  /** Test files that may need updates */
  testFiles: string[];
  /** Propagation stats */
  stats: PropagationStats;
}

export interface PropagationStats {
  seedsCount: number;
  totalImpacted: number;
  mustChangeCount: number;
  mayChangeCount: number;
  maxDistance: number;
  propagationTimeMs: number;
}

export interface PropagationConfig {
  /** Maximum BFS depth (default: 2) */
  maxDepth: number;
  /** Maximum result tokens for serialization */
  tokenBudget: number;
  /** Include test files in results */
  includeTests: boolean;
  /** Score weights */
  weights: ScoreWeights;
}

export interface ScoreWeights {
  /** Direct caller of changed function */
  directCaller: number;
  /** Implementor of changed interface */
  implementor: number;
  /** Extender of changed class */
  extender: number;
  /** Importer of changed file */
  importer: number;
  /** Type user (references a changed type) */
  typeUser: number;
  /** Transitive (distance > 1) penalty per hop */
  distanceDecay: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  directCaller: 10,
  implementor: 9,
  extender: 8,
  importer: 5,
  typeUser: 6,
  distanceDecay: 0.6,
};

const DEFAULT_CONFIG: PropagationConfig = {
  maxDepth: 2,
  tokenBudget: 2000,
  includeTests: true,
  weights: DEFAULT_WEIGHTS,
};

// ─── Implementation ───

export class PropagationEngine {
  private config: PropagationConfig;

  constructor(config?: Partial<PropagationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (config?.weights) {
      this.config.weights = { ...DEFAULT_WEIGHTS, ...config.weights };
    }
  }

  /**
   * Propagate impact from changed seeds through the symbol graph.
   */
  propagate(graph: SymbolGraph, seeds: ImpactSeed[]): PropagationResult {
    const start = Date.now();
    const impacts = new Map<string, ImpactNode>();

    // Phase 1: Collect all changed symbols from seeds
    const changedSymbols = this.collectChangedSymbols(graph, seeds);
    const changedFiles = new Set(seeds.map((s) => s.file));

    // Phase 2: BFS propagation
    // Queue entries: [file, distance]
    const visited = new Map<string, number>(); // file → distance
    const queue: Array<{ file: string; distance: number }> = [];

    // Seed the queue
    changedFiles.forEach((file) => {
      visited.set(file, 0);
      queue.push({ file, distance: 0 });
    });

    let head = 0;
    while (head < queue.length) {
      const { file, distance } = queue[head++];
      if (distance >= this.config.maxDepth) continue;

      // Find all files that depend on this file or its symbols
      const dependents = this.findDependents(graph, file, changedSymbols, changedFiles);

      for (const dep of dependents) {
        const prevDistance = visited.get(dep.file);
        if (prevDistance !== undefined && prevDistance <= distance + 1) continue;

        visited.set(dep.file, distance + 1);
        queue.push({ file: dep.file, distance: distance + 1 });

        // Build or update impact node
        const existing = impacts.get(dep.file);
        const reason: ImpactReason = {
          symbol: dep.symbol,
          kind: dep.kind,
          sourceFile: file,
          line: dep.line,
        };

        if (existing) {
          existing.reasons.push(reason);
          // Upgrade level if needed
          if (dep.level === "must-change" && existing.level === "may-change") {
            existing.level = "must-change";
          }
          existing.score = Math.max(existing.score, dep.score);
        } else {
          impacts.set(dep.file, {
            file: dep.file,
            reasons: [reason],
            level: dep.level,
            distance: distance + 1,
            score: dep.score,
          });
        }
      }
    }

    // Phase 3: Also check inheritance (interface → implementors)
    changedSymbols.forEach((symbolName) => {
      const inheritors = graph.inheritanceMap.get(symbolName) ?? [];
      for (const inh of inheritors) {
        if (changedFiles.has(inh.file)) continue;

        const existing = impacts.get(inh.file);
        const reason: ImpactReason = {
          symbol: symbolName,
          kind: inh.kind === "implements" ? "implementor" : "extender",
          sourceFile: "", // Resolved from definitions
          line: inh.line,
        };

        if (existing) {
          existing.reasons.push(reason);
        } else {
          impacts.set(inh.file, {
            file: inh.file,
            reasons: [reason],
            level: "must-change",
            distance: 1,
            score: this.config.weights.implementor,
          });
        }
      }
    });

    // Phase 4: Classify and sort
    const allImpacts = Array.from(impacts.values());
    allImpacts.forEach((impact) => {
      // Re-classify: direct distance-1 with caller/implementor = must-change
      if (impact.distance === 1 && impact.reasons.some((r) => r.kind === "caller" || r.kind === "implementor")) {
        impact.level = "must-change";
      }
      // Test file detection
      // (handled in result classification below)
    });

    allImpacts.sort((a, b) => b.score - a.score);

    const mustChange = allImpacts.filter((i) => i.level === "must-change").map((i) => i.file);
    const mayChange = allImpacts.filter((i) => i.level === "may-change").map((i) => i.file);
    const testFiles = allImpacts
      .filter((i) => isTestFile(i.file))
      .map((i) => i.file);

    const propagationTimeMs = Date.now() - start;

    return {
      impacts: allImpacts,
      mustChange,
      mayChange,
      testFiles,
      stats: {
        seedsCount: seeds.length,
        totalImpacted: allImpacts.length,
        mustChangeCount: mustChange.length,
        mayChangeCount: mayChange.length,
        maxDistance: allImpacts.length > 0 ? Math.max(...allImpacts.map((i) => i.distance)) : 0,
        propagationTimeMs,
      },
    };
  }

  /**
   * Serialize propagation result to compact string for LLM.
   */
  toCompactString(result: PropagationResult): string {
    const lines: string[] = [];
    let tokenEstimate = 0;
    const budget = this.config.tokenBudget;

    lines.push(`## Impact Analysis (${result.stats.totalImpacted} files affected)`);
    lines.push("");

    // Must-change section
    if (result.mustChange.length > 0) {
      lines.push("### MUST CHANGE:");
      for (const impact of result.impacts) {
        if (impact.level !== "must-change") continue;
        if (tokenEstimate >= budget) break;
        const reasons = impact.reasons.map((r) => `${r.kind}(${r.symbol})`).join(", ");
        const line = `  ${impact.file} ← ${reasons}`;
        lines.push(line);
        tokenEstimate += line.length;
      }
      lines.push("");
    }

    // May-change section
    if (result.mayChange.length > 0) {
      lines.push("### MAY CHANGE:");
      for (const impact of result.impacts) {
        if (impact.level !== "may-change") continue;
        if (tokenEstimate >= budget) break;
        const reasons = impact.reasons.map((r) => `${r.kind}(${r.symbol})`).join(", ");
        const line = `  ${impact.file} ← ${reasons}`;
        lines.push(line);
        tokenEstimate += line.length;
      }
    }

    return lines.join("\n");
  }

  // ─── Internal Methods ───

  private collectChangedSymbols(graph: SymbolGraph, seeds: ImpactSeed[]): Set<string> {
    const symbols = new Set<string>();

    for (const seed of seeds) {
      if (seed.symbols.length > 0) {
        for (const s of seed.symbols) {
          symbols.add(s);
        }
      } else {
        // All symbols in the file changed
        for (const tag of graph.tags) {
          if (tag.file === seed.file && tag.kind === "def") {
            symbols.add(tag.name);
          }
        }
      }
    }

    return symbols;
  }

  private findDependents(
    graph: SymbolGraph,
    sourceFile: string,
    changedSymbols: Set<string>,
    _changedFiles: Set<string>,
  ): Array<{ file: string; symbol: string; kind: ImpactReason["kind"]; line: number; level: "must-change" | "may-change"; score: number }> {
    const results: Array<{ file: string; symbol: string; kind: ImpactReason["kind"]; line: number; level: "must-change" | "may-change"; score: number }> = [];

    // 1. Find callers of changed symbols defined in this file
    changedSymbols.forEach((symName) => {
      const defs = graph.definitions.get(symName) ?? [];
      const definedHere = defs.some((d) => d.file === sourceFile);
      if (!definedHere) return;

      const refs = graph.reverseRefs.get(symName) ?? [];
      refs.forEach((ref) => {
        if (ref.file === sourceFile) return;

        // Determine if this is a caller, type-user, or importer
        const kind: ImpactReason["kind"] = ref.type === "class" ? "type-user" : "caller";
        const score = kind === "caller"
          ? this.config.weights.directCaller
          : this.config.weights.typeUser;

        results.push({
          file: ref.file,
          symbol: symName,
          kind,
          line: ref.line,
          level: "must-change",
          score,
        });
      });
    });

    // 2. Find importers of this file
    const importEntries = graph.importGraph;
    importEntries.forEach((imports, importerFile) => {
      if (importerFile === sourceFile) return;
      // Check if importer imports from sourceFile (use some() for early break)
      Array.from(imports).some((imp) => {
        if (imp.includes(sourceFile.replace(/\.\w+$/, "")) || sourceFile.includes(imp)) {
          results.push({
            file: importerFile,
            symbol: imp,
            kind: "importer",
            line: 0,
            level: "may-change",
            score: this.config.weights.importer,
          });
          return true; // break
        }
        return false;
      });
    });

    return results;
  }
}

// ─── Helpers ───

function isTestFile(file: string): boolean {
  const normalized = file.replace(/\\/g, "/");
  return (
    normalized.includes("__tests__") ||
    normalized.includes(".test.") ||
    normalized.includes(".spec.") ||
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    normalized.includes("/__tests__/")
  );
}

export { isTestFile };
