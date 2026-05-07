/**
 * CompletenessChecker — Verifies no files are missed after modification.
 *
 * Inspired by:
 * - Aider's verify action (check all related nodes covered)
 * - Code review best practices: "check callers, implementors, tests"
 * - SWE-agent's constrained editing (verify before commit)
 * - daily-stock-report v13.1 闭环设计 (SERIALIZE_KEYS → render → load → insert)
 *
 * Strategy:
 * 1. Compare actual changes against impact analysis results
 * 2. Identify missing files: must-change but not actually modified
 * 3. Classify missing items by category (interface, caller, config, test)
 * 4. Generate actionable checklist for developers
 *
 * This is the key module that prevents "forgetting to modify related files".
 */

import type { PropagationResult } from "./propagation-engine.js";

// ─── Types ───

export interface CheckInput {
  /** Files that were actually modified */
  actualChanges: string[];
  /** Propagation result from impact analysis */
  impactResult: PropagationResult;
  /** Optional: files planned to change (before implementation) */
  plannedChanges?: string[];
  /** Whether to check test coverage */
  checkTests: boolean;
}

export interface CompletenessReport {
  /** Overall completeness score (0-100) */
  score: number;
  /** Status */
  status: "complete" | "incomplete" | "warning";
  /** Files that must change but were not modified */
  missingFiles: MissingFile[];
  /** Files that were modified but not in impact list (bonus) */
  extraChanges: string[];
  /** Test coverage status */
  testStatus: TestStatus;
  /** Checklist for developer */
  checklist: ChecklistItem[];
  /** Summary stats */
  stats: CompletenessStats;
}

export interface MissingFile {
  /** File path */
  file: string;
  /** Why it should change */
  reason: string;
  /** Category of the missing change */
  category: "caller" | "implementor" | "extender" | "importer" | "type-user" | "config-ref" | "test";
  /** The symbol that links this file to the change */
  relatedSymbol: string;
  /** Impact level from propagation */
  impactLevel: "must-change" | "may-change";
  /** Suggested action */
  suggestion: string;
}

export interface TestStatus {
  /** Whether test files were identified in impact analysis */
  hasTestFiles: boolean;
  /** Test files that were modified */
  coveredTests: string[];
  /** Test files that should be modified but weren't */
  missingTests: string[];
  /** Whether test coverage is adequate */
  adequate: boolean;
}

export interface ChecklistItem {
  /** What to check */
  action: string;
  /** File to check */
  file: string;
  /** Priority */
  priority: "critical" | "important" | "optional";
  /** Whether completed */
  done: boolean;
}

export interface CompletenessStats {
  mustChangeTotal: number;
  mustChangeCovered: number;
  mayChangeTotal: number;
  mayChangeCovered: number;
  testTotal: number;
  testCovered: number;
  missingCount: number;
}

// ─── Implementation ───

export class CompletenessChecker {
  /**
   * Check completeness: compare actual changes against impact analysis.
   */
  check(input: CheckInput): CompletenessReport {
    const { actualChanges, impactResult, plannedChanges, checkTests } = input;

    const actualSet = new Set(actualChanges.map(normalizePath));
    const plannedSet = plannedChanges ? new Set(plannedChanges.map(normalizePath)) : null;

    // Phase 1: Find missing files (must-change but not in actual)
    const missingFiles: MissingFile[] = [];

    for (const impact of impactResult.impacts) {
      const normFile = normalizePath(impact.file);
      const isActual = actualSet.has(normFile);
      const isPlanned = plannedSet ? plannedSet.has(normFile) : false;

      if (!isActual && !isPlanned && impact.level === "must-change") {
        for (const reason of impact.reasons) {
          missingFiles.push({
            file: impact.file,
            reason: `${formatKind(reason.kind)} of '${reason.symbol}' (defined in ${reason.sourceFile})`,
            category: mapReasonToCategory(reason.kind),
            relatedSymbol: reason.symbol,
            impactLevel: impact.level,
            suggestion: generateSuggestion(reason.kind, reason.symbol, impact.file),
          });
        }
      }
    }

    // Deduplicate missing files (keep highest priority)
    const dedupedMissing = deduplicateMissing(missingFiles);

    // Phase 2: Find extra changes (modified but not in impact analysis)
    const mustChangeSet = new Set(impactResult.mustChange.map(normalizePath));
    const mayChangeSet = new Set(impactResult.mayChange.map(normalizePath));
    const allImpacted = new Set(Array.from(mustChangeSet).concat(Array.from(mayChangeSet)));

    const extraChanges = actualChanges.filter(
      (f) => !allImpacted.has(normalizePath(f)),
    );

    // Phase 3: Test coverage analysis
    const testStatus = this.analyzeTestCoverage(impactResult, actualSet, checkTests);

    // Phase 4: Build checklist
    const checklist = this.buildChecklist(dedupedMissing, testStatus, impactResult);

    // Phase 5: Calculate score
    const stats = this.calculateStats(impactResult, actualSet, dedupedMissing, testStatus);
    const score = this.calculateScore(stats);
    const status = this.determineStatus(score, dedupedMissing, testStatus);

    return {
      score,
      status,
      missingFiles: dedupedMissing,
      extraChanges,
      testStatus,
      checklist,
      stats,
    };
  }

  /**
   * Serialize report to compact string for LLM.
   */
  toCompactString(report: CompletenessReport): string {
    const lines: string[] = [];

    lines.push(`## Completeness Check: ${report.status.toUpperCase()} (${report.score}/100)`);
    lines.push("");

    if (report.missingFiles.length > 0) {
      lines.push("### MISSING CHANGES:");
      for (const missing of report.missingFiles) {
        lines.push(`  [${missing.category}] ${missing.file}`);
        lines.push(`    Reason: ${missing.reason}`);
        lines.push(`    Action: ${missing.suggestion}`);
      }
      lines.push("");
    }

    if (report.testStatus.missingTests.length > 0) {
      lines.push("### MISSING TESTS:");
      for (const test of report.testStatus.missingTests) {
        lines.push(`  [test] ${test}`);
      }
      lines.push("");
    }

    if (report.extraChanges.length > 0) {
      lines.push("### EXTRA CHANGES (not in impact analysis):");
      for (const extra of report.extraChanges) {
        lines.push(`  ${extra}`);
      }
      lines.push("");
    }

    lines.push("### CHECKLIST:");
    for (const item of report.checklist) {
      const icon = item.done ? "[x]" : "[ ]";
      const prio = item.priority === "critical" ? "!!" : item.priority === "important" ? "!" : " ";
      lines.push(`  ${icon} ${prio} ${item.action} (${item.file})`);
    }

    return lines.join("\n");
  }

  // ─── Internal Methods ───

  private analyzeTestCoverage(
    impactResult: PropagationResult,
    actualSet: Set<string>,
    checkTests: boolean,
  ): TestStatus {
    if (!checkTests) {
      return {
        hasTestFiles: false,
        coveredTests: [],
        missingTests: [],
        adequate: true,
      };
    }

    const identifiedTests = impactResult.testFiles;
    const coveredTests = identifiedTests.filter((f) => actualSet.has(normalizePath(f)));
    const missingTests = identifiedTests.filter((f) => !actualSet.has(normalizePath(f)));

    return {
      hasTestFiles: identifiedTests.length > 0,
      coveredTests,
      missingTests,
      adequate: identifiedTests.length === 0 || missingTests.length === 0,
    };
  }

  private buildChecklist(
    missing: MissingFile[],
    testStatus: TestStatus,
    _impactResult: PropagationResult,
  ): ChecklistItem[] {
    const items: ChecklistItem[] = [];

    // Critical: must-change files
    for (const m of missing) {
      if (m.impactLevel === "must-change") {
        items.push({
          action: `Update ${m.category}: ${m.suggestion}`,
          file: m.file,
          priority: "critical",
          done: false,
        });
      }
    }

    // Important: missing tests
    for (const test of testStatus.missingTests) {
      items.push({
        action: `Update or add tests for changed functionality`,
        file: test,
        priority: "important",
        done: false,
      });
    }

    // Optional: may-change files (not in missing, but worth checking)
    // Already handled by missing list

    return items;
  }

  private calculateStats(
    impactResult: PropagationResult,
    actualSet: Set<string>,
    missing: MissingFile[],
    testStatus: TestStatus,
  ): CompletenessStats {
    const mustChangeTotal = impactResult.mustChange.length;
    const mustChangeCovered = impactResult.mustChange.filter((f) =>
      actualSet.has(normalizePath(f)),
    ).length;
    const mayChangeTotal = impactResult.mayChange.length;
    const mayChangeCovered = impactResult.mayChange.filter((f) =>
      actualSet.has(normalizePath(f)),
    ).length;
    const testTotal = testStatus.hasTestFiles ? impactResult.testFiles.length : 0;
    const testCovered = testStatus.coveredTests.length;

    return {
      mustChangeTotal,
      mustChangeCovered,
      mayChangeTotal,
      mayChangeCovered,
      testTotal,
      testCovered,
      missingCount: missing.length,
    };
  }

  private calculateScore(stats: CompletenessStats): number {
    if (stats.mustChangeTotal === 0) return 100;

    // Weighted score: must-change coverage (70%) + test coverage (30%)
    const mustScore = stats.mustChangeTotal > 0
      ? (stats.mustChangeCovered / stats.mustChangeTotal) * 70
      : 70;
    const testScore = stats.testTotal > 0
      ? (stats.testCovered / stats.testTotal) * 30
      : 30;

    return Math.round(mustScore + testScore);
  }

  private determineStatus(
    score: number,
    missing: MissingFile[],
    testStatus: TestStatus,
  ): "complete" | "incomplete" | "warning" {
    if (missing.some((m) => m.impactLevel === "must-change")) return "incomplete";
    if (!testStatus.adequate && testStatus.hasTestFiles) return "warning";
    if (score < 80) return "incomplete";
    if (score < 95) return "warning";
    return "complete";
  }
}

// ─── Helpers ───

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

function formatKind(kind: string): string {
  const map: Record<string, string> = {
    caller: "Caller",
    implementor: "Implementor",
    extender: "Extender",
    importer: "Importer",
    "type-user": "Type user",
    "config-ref": "Config reference",
  };
  return map[kind] ?? kind;
}

function mapReasonToCategory(kind: string): MissingFile["category"] {
  const map: Record<string, MissingFile["category"]> = {
    caller: "caller",
    implementor: "implementor",
    extender: "extender",
    importer: "importer",
    "type-user": "type-user",
    "config-ref": "config-ref",
  };
  return map[kind] ?? "caller";
}

function generateSuggestion(
  kind: string,
  symbol: string,
  file: string,
): string {
  const map: Record<string, string> = {
    caller: `Update call to '${symbol}' in ${file}`,
    implementor: `Update implementation of '${symbol}' in ${file}`,
    extender: `Update extension of '${symbol}' in ${file}`,
    importer: `Update import/usage of changed module in ${file}`,
    "type-user": `Update usage of type '${symbol}' in ${file}`,
    "config-ref": `Update config reference '${symbol}' in ${file}`,
  };
  return map[kind] ?? `Check '${symbol}' usage in ${file}`;
}

function deduplicateMissing(files: MissingFile[]): MissingFile[] {
  const byFile = new Map<string, MissingFile>();
  for (const f of files) {
    const existing = byFile.get(f.file);
    if (!existing) {
      byFile.set(f.file, f);
    } else {
      // Keep the one with higher priority category
      const priorityOrder: MissingFile["category"][] = [
        "caller", "implementor", "config-ref", "extender", "type-user", "importer", "test",
      ];
      const existingIdx = priorityOrder.indexOf(existing.category);
      const newIdx = priorityOrder.indexOf(f.category);
      if (newIdx < existingIdx) {
        byFile.set(f.file, f);
      }
    }
  }
  return Array.from(byFile.values());
}
