/**
 * ImpactAnalyzer — Unified entry point for code impact analysis.
 *
 * Combines three layers:
 * 1. SymbolGraphBuilder — extract symbols and build dependency graph
 * 2. PropagationEngine — BFS impact propagation from changed files
 * 3. CompletenessChecker — verify no files are missed after changes
 *
 * Inspired by:
 * - Aider's repo-map (tag extraction + PageRank + token budget)
 * - Change Impact Analysis (CIA) methodology
 * - Ctxo MCP's "blast radius" concept
 * - daily-stock-report v13 闭环审计
 *
 * Usage:
 *   const analyzer = new ImpactAnalyzer();
 *   const graph = analyzer.buildGraph(projectDir);
 *   const impact = analyzer.analyzeImpact(graph, seeds);
 *   const report = analyzer.checkCompleteness(impact, actualChanges);
 */

import { SymbolGraphBuilder } from "./symbol-graph-builder.js";
import { PropagationEngine } from "./propagation-engine.js";
import { CompletenessChecker } from "./completeness-checker.js";

// Re-export types for convenience
export type { SymbolGraph, SymbolTag, GraphStats, GraphBuildConfig, DefEntry, RefEntry, InheritEntry } from "./symbol-graph-builder.js";
export type { PropagationResult, ImpactSeed, ImpactNode, ImpactReason, PropagationConfig } from "./propagation-engine.js";
export type { CompletenessReport, MissingFile, TestStatus, ChecklistItem, CompletenessStats, CheckInput } from "./completeness-checker.js";

// ─── Types ───

export interface ImpactAnalysisConfig {
  /** Graph build config */
  graph: Partial<import("./symbol-graph-builder.js").GraphBuildConfig>;
  /** Propagation config */
  propagation: Partial<import("./propagation-engine.js").PropagationConfig>;
}

const DEFAULT_ANALYSIS_CONFIG: ImpactAnalysisConfig = {
  graph: {},
  propagation: {},
};

// ─── Implementation ───

export class ImpactAnalyzer {
  private graphBuilder: SymbolGraphBuilder;
  private propagationEngine: PropagationEngine;
  private completenessChecker: CompletenessChecker;
  private cachedGraph: import("./symbol-graph-builder.js").SymbolGraph | null = null;
  private cachedProjectDir: string | null = null;

  constructor(config?: Partial<ImpactAnalysisConfig>) {
    const fullConfig: ImpactAnalysisConfig = {
      graph: { ...DEFAULT_ANALYSIS_CONFIG.graph, ...config?.graph },
      propagation: { ...DEFAULT_ANALYSIS_CONFIG.propagation, ...config?.propagation },
    };

    this.graphBuilder = new SymbolGraphBuilder(fullConfig.graph);
    this.propagationEngine = new PropagationEngine(fullConfig.propagation);
    this.completenessChecker = new CompletenessChecker();
  }

  /**
   * Build symbol graph for a project (cached per project).
   */
  buildGraph(projectDir: string): import("./symbol-graph-builder.js").SymbolGraph {
    if (this.cachedGraph && this.cachedProjectDir === projectDir) {
      return this.cachedGraph;
    }

    const graph = this.graphBuilder.build(projectDir);
    this.cachedGraph = graph;
    this.cachedProjectDir = projectDir;
    return graph;
  }

  /**
   * Incrementally update graph for changed files.
   */
  updateGraph(changedFiles: string[]): import("./symbol-graph-builder.js").SymbolGraph {
    if (!this.cachedGraph || !this.cachedProjectDir) {
      throw new Error("No cached graph. Call buildGraph() first.");
    }

    const absFiles = changedFiles.map((f) =>
      f.startsWith("/") ? f : `${this.cachedProjectDir}/${f}`,
    );

    this.cachedGraph = this.graphBuilder.update(
      this.cachedGraph,
      this.cachedProjectDir,
      absFiles,
    );
    return this.cachedGraph;
  }

  /**
   * Analyze impact from changed files/symbols.
   */
  analyzeImpact(
    graph: import("./symbol-graph-builder.js").SymbolGraph,
    seeds: import("./propagation-engine.js").ImpactSeed[],
  ): import("./propagation-engine.js").PropagationResult {
    return this.propagationEngine.propagate(graph, seeds);
  }

  /**
   * Check completeness after modifications.
   */
  checkCompleteness(
    impactResult: import("./propagation-engine.js").PropagationResult,
    actualChanges: string[],
    options?: { plannedChanges?: string[]; checkTests?: boolean },
  ): import("./completeness-checker.js").CompletenessReport {
    return this.completenessChecker.check({
      actualChanges,
      impactResult,
      plannedChanges: options?.plannedChanges,
      checkTests: options?.checkTests ?? true,
    });
  }

  /**
   * Full pipeline: build graph → analyze impact → check completeness.
   * Convenience method for one-shot analysis.
   */
  fullAnalysis(
    projectDir: string,
    changedFiles: string[],
    changedSymbols: string[][] = [],
    actualChanges?: string[],
  ): {
    graph: import("./symbol-graph-builder.js").SymbolGraph;
    impact: import("./propagation-engine.js").PropagationResult;
    completeness?: import("./completeness-checker.js").CompletenessReport;
    summary: string;
  } {
    // Step 1: Build graph
    const graph = this.buildGraph(projectDir);

    // Step 2: Create seeds
    const seeds: import("./propagation-engine.js").ImpactSeed[] = changedFiles.map((file, i) => ({
      file,
      symbols: changedSymbols[i] ?? [],
      changeType: "signature" as const,
    }));

    // Step 3: Analyze impact
    const impact = this.analyzeImpact(graph, seeds);

    // Step 4: Check completeness (if actual changes provided)
    let completeness: import("./completeness-checker.js").CompletenessReport | undefined;
    if (actualChanges) {
      completeness = this.checkCompleteness(impact, actualChanges);
    }

    // Step 5: Generate summary
    const summary = this.generateSummary(graph, impact, completeness);

    return { graph, impact, completeness, summary };
  }

  /**
   * Generate compact summary for LLM consumption.
   */
  generateSummary(
    graph: import("./symbol-graph-builder.js").SymbolGraph,
    impact: import("./propagation-engine.js").PropagationResult,
    completeness?: import("./completeness-checker.js").CompletenessReport,
  ): string {
    const parts: string[] = [];

    // Graph stats
    parts.push(`[Graph: ${graph.stats.filesScanned} files, ${graph.stats.totalDefs} defs, ${graph.stats.totalRefs} refs]`);

    // Impact summary
    parts.push(`[Impact: ${impact.stats.totalImpacted} affected (${impact.stats.mustChangeCount} must, ${impact.stats.mayChangeCount} may)]`);

    // Compact impact
    parts.push(this.propagationEngine.toCompactString(impact));

    // Completeness check
    if (completeness) {
      parts.push("");
      parts.push(this.completenessChecker.toCompactString(completeness));
    }

    return parts.join("\n");
  }

  /**
   * Invalidate cached graph (e.g., after major file changes).
   */
  invalidateCache(): void {
    this.cachedGraph = null;
    this.cachedProjectDir = null;
  }
}
