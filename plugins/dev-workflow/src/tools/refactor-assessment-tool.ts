import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type {
  RefactorAssessment,
  RefactorMetric,
  RefactorRecommendation,
  RefactorMetricType,
  RefactorPrinciple,
  RefactorHealthLevel,
} from "../types.js";
import { REFACTOR_THRESHOLDS, healthLevelFromScore, healthEmoji } from "../types.js";

const execAsync = promisify(exec);

export class RefactorAssessmentTool implements AnyAgentTool {
  name = "refactor_assessment";
  label = "Refactor Assessment";
  description = "Assess whether an existing project needs refactoring. Quick scan (auto on Step 0) or deep analysis (manual trigger). Outputs health score, metrics, and prioritized recommendations.";
  parameters = z.object({
    projectDir: z.string().describe("Absolute path to the project directory"),
    mode: z.enum(["quick", "deep"]).optional().describe("Assessment mode: quick (Step 0 auto) or deep (manual /dwf:refactor)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const mode = input.mode ?? "quick";
    const projectDir = input.projectDir;

    const assessment = mode === "deep"
      ? await this.deepAssessment(projectDir)
      : await this.quickAssessment(projectDir);

    const summaryLines = [
      `# Refactor Assessment ${healthEmoji(assessment.healthLevel)} [${assessment.healthLevel}]`,
      `Score: ${assessment.score}/100 | Files: ${assessment.fileCount} | Mode: ${mode}`,
      ``,
      `## Metrics`,
      ...assessment.metrics.map(m =>
        `${m.passed ? "✅" : "❌"} ${m.type}: ${m.value} (threshold: ${m.threshold}) [weight: ${m.weight}]`
          + (m.files && m.files.length > 0 ? `\n   Hot files: ${m.files.slice(0, 5).join(", ")}` : "")
      ),
    ];

    if (assessment.recommendations.length > 0) {
      summaryLines.push("", "## Recommendations");
      for (const r of assessment.recommendations) {
        summaryLines.push(`- [${r.priority.toUpperCase()}] [${r.principle}] ${r.title}`);
        summaryLines.push(`  ${r.description}`);
        if (r.affectedFiles.length > 0) {
          summaryLines.push(`  Files: ${r.affectedFiles.slice(0, 5).join(", ")}`);
        }
        summaryLines.push(`  Effort: ${r.estimatedEffort}`);
      }
    }

    return {
      content: [{ type: "text" as const, text: summaryLines.join("\n") }],
      details: { success: true, assessment },
    };
  }

  async quickAssessment(projectDir: string): Promise<RefactorAssessment> {
    const metrics = await this.collectMetrics(projectDir);
    const score = this.computeScore(metrics);
    const healthLevel = healthLevelFromScore(score);
    const recommendations = this.generateRecommendations(metrics, projectDir);

    return {
      score,
      healthLevel,
      metrics,
      recommendations,
      scannedAt: new Date().toISOString(),
      fileCount: metrics.reduce((max, m) => Math.max(max, m.files?.length ?? 0), 0),
    };
  }

  async deepAssessment(projectDir: string): Promise<RefactorAssessment> {
    const quick = await this.quickAssessment(projectDir);

    // Deep adds architecture-level analysis
    const archRecommendations = await this.analyzeArchitecture(projectDir);
    quick.recommendations = [...quick.recommendations, ...archRecommendations];
    quick.recommendations.sort((a, b) => {
      const prio = { high: 0, medium: 1, low: 2 };
      return prio[a.priority] - prio[b.priority];
    });

    return quick;
  }

  private async collectMetrics(projectDir: string): Promise<RefactorMetric[]> {
    const files = await this.getSourceFiles(projectDir);
    const metrics: RefactorMetric[] = [];
    const t = REFACTOR_THRESHOLDS;

    // 1. File size
    const oversizedFiles: string[] = [];
    let totalFileLines = 0;
    for (const file of files) {
      try {
        const content = readFileSync(join(projectDir, file), "utf-8");
        const lines = content.split("\n").length;
        totalFileLines += lines;
        if (lines > t.maxFileLines) oversizedFiles.push(`${file}:${lines}`);
      } catch { /* skip */ }
    }
    const oversizedRatio = files.length > 0 ? oversizedFiles.length / files.length : 0;
    metrics.push({
      type: "file-size",
      value: oversizedFiles.length,
      threshold: 0,
      weight: 0.15,
      passed: oversizedFiles.length === 0,
      files: oversizedFiles,
    });

    // 2. Function size
    const longFunctions: string[] = [];
    for (const file of files) {
      try {
        const content = readFileSync(join(projectDir, file), "utf-8");
        const funcs = this.extractFunctionLengths(content);
        for (const [name, len, line] of funcs) {
          if (len > t.maxFunctionLines) {
            longFunctions.push(`${file}:${line} ${name}(${len}L)`);
          }
        }
      } catch { /* skip */ }
    }
    metrics.push({
      type: "function-size",
      value: longFunctions.length,
      threshold: 0,
      weight: 0.15,
      passed: longFunctions.length === 0,
      files: longFunctions,
    });

    // 3. Complexity (cyclomatic proxy: branch count per function)
    const complexFunctions: string[] = [];
    for (const file of files) {
      try {
        const content = readFileSync(join(projectDir, file), "utf-8");
        const funcs = this.extractFunctionBlocks(content);
        for (const [name, body, line] of funcs) {
          const branches = (body.match(/\bif\b|\belse\b|\bfor\b|\bwhile\b|\bswitch\b|\bcase\b|\?\.|\?\?|\|\||&&/g) || []).length;
          if (branches > t.maxCyclomaticComplexity) {
            complexFunctions.push(`${file}:${line} ${name}(CC:${branches})`);
          }
        }
      } catch { /* skip */ }
    }
    metrics.push({
      type: "complexity",
      value: complexFunctions.length,
      threshold: 0,
      weight: 0.25,
      passed: complexFunctions.length === 0,
      files: complexFunctions,
    });

    // 4. Coupling (imports per file)
    const coupledFiles: string[] = [];
    for (const file of files) {
      try {
        const content = readFileSync(join(projectDir, file), "utf-8");
        const imports = (content.match(/^import\s/gm) || []).length;
        const requires = (content.match(/require\(/g) || []).length;
        const total = imports + requires;
        if (total > t.maxImportsPerFile) {
          coupledFiles.push(`${file}(${total} imports)`);
        }
      } catch { /* skip */ }
    }
    metrics.push({
      type: "coupling",
      value: coupledFiles.length,
      threshold: 0,
      weight: 0.15,
      passed: coupledFiles.length === 0,
      files: coupledFiles,
    });

    // 5. Duplication (simple heuristic: repeated 3+ line blocks)
    const duplicationHotspots = await this.detectDuplication(projectDir, files);
    metrics.push({
      type: "duplication",
      value: duplicationHotspots.length,
      threshold: 0,
      weight: 0.15,
      passed: duplicationHotspots.length === 0,
      files: duplicationHotspots,
    });

    // 6. Naming (single-letter or cryptic names)
    const namingIssues: string[] = [];
    for (const file of files.slice(0, 20)) {
      try {
        const content = readFileSync(join(projectDir, file), "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(/\b(?:const|let|var)\s+([a-z])\b/i);
          if (match && !["i", "j", "k", "x", "y", "z", "_", "e", "n"].includes(match[1])) {
            namingIssues.push(`${file}:${i + 1} var '${match[1]}'`);
          }
        }
      } catch { /* skip */ }
    }
    metrics.push({
      type: "naming",
      value: namingIssues.length,
      threshold: 0,
      weight: 0.15,
      passed: namingIssues.length === 0,
      files: namingIssues,
    });

    return metrics;
  }

  private computeScore(metrics: RefactorMetric[]): number {
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const m of metrics) {
      totalWeight += m.weight;
      if (m.passed) {
        earnedWeight += m.weight;
      } else {
        // Partial credit: fewer violations = higher score
        const violationRatio = Math.min(m.value / 10, 1);
        earnedWeight += m.weight * (1 - violationRatio * 0.5);
      }
    }

    return Math.round((earnedWeight / totalWeight) * 100);
  }

  private generateRecommendations(metrics: RefactorMetric[], _projectDir: string): RefactorRecommendation[] {
    const recs: RefactorRecommendation[] = [];

    for (const m of metrics) {
      if (m.passed) continue;

      switch (m.type) {
        case "complexity":
          recs.push({
            priority: "high",
            principle: "readability",
            title: "Reduce function complexity",
            description: "Functions with high cyclomatic complexity should be decomposed into smaller, single-purpose functions. Use early returns, guard clauses, and extract helper functions.",
            affectedFiles: (m.files || []).map(f => f.split(":")[0]).slice(0, 5),
            estimatedEffort: "2-4h per function",
          });
          break;
        case "file-size":
          recs.push({
            priority: "medium",
            principle: "maintainability",
            title: "Split oversized files",
            description: "Files exceeding 500 lines violate single responsibility. Extract cohesive groups of functions into dedicated modules.",
            affectedFiles: (m.files || []).map(f => f.split(":")[0]).slice(0, 5),
            estimatedEffort: "1-2h per file",
          });
          break;
        case "function-size":
          recs.push({
            priority: "medium",
            principle: "simplicity",
            title: "Break down long functions",
            description: "Functions over 50 lines should be decomposed. Each function should do one thing, do it well, and do it only.",
            affectedFiles: (m.files || []).map(f => f.split(":")[0]).slice(0, 5),
            estimatedEffort: "30min-1h per function",
          });
          break;
        case "coupling":
          recs.push({
            priority: "medium",
            principle: "extensibility",
            title: "Reduce import coupling",
            description: "Files with excessive imports are tightly coupled. Consider facade patterns, dependency injection, or module reorganization.",
            affectedFiles: (m.files || []).map(f => f.split("(")[0]).slice(0, 5),
            estimatedEffort: "2-4h per module",
          });
          break;
        case "duplication":
          recs.push({
            priority: "high",
            principle: "efficiency",
            title: "Eliminate code duplication",
            description: "Duplicated code is a maintenance burden. Extract shared logic into reusable functions or utilities. DRY principle.",
            affectedFiles: (m.files || []).map(f => f.split(":")[0]).slice(0, 5),
            estimatedEffort: "1-3h",
          });
          break;
        case "naming":
          recs.push({
            priority: "low",
            principle: "readability",
            title: "Improve variable naming",
            description: "Cryptic variable names harm readability. Use descriptive names that convey intent. Code should be self-documenting.",
            affectedFiles: (m.files || []).map(f => f.split(":")[0]).slice(0, 5),
            estimatedEffort: "30min",
          });
          break;
      }
    }

    return recs;
  }

  private async analyzeArchitecture(projectDir: string): Promise<RefactorRecommendation[]> {
    const recs: RefactorRecommendation[] = [];

    // Check for circular dependencies
    try {
      const { stdout } = await execAsync(
        `grep -rn "^import.*from '\\..*'" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v dist | head -50`,
        { cwd: projectDir, timeout: 10000 }
      );
      const imports = stdout.trim().split("\n").filter(Boolean);

      // Build adjacency list
      const graph = new Map<string, Set<string>>();
      for (const line of imports) {
        const match = line.match(/^\.\/([^:]+):\d+:import.*from '(\.[^']+)'/);
        if (match) {
          const from = match[1];
          const to = match[2];
          if (!graph.has(from)) graph.set(from, new Set());
          graph.get(from)!.add(to);
        }
      }

      // Detect cycles (simple DFS)
      const visited = new Set<string>();
      const stack = new Set<string>();
      const cyclicFiles: string[] = [];

      const dfs = (node: string): void => {
        if (stack.has(node)) {
          cyclicFiles.push(node);
          return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        stack.add(node);
        for (const dep of graph.get(node) || []) dfs(dep);
        stack.delete(node);
      };

      for (const node of graph.keys()) dfs(node);

      if (cyclicFiles.length > 0) {
        recs.push({
          priority: "high",
          principle: "extensibility",
          title: "Resolve circular dependencies",
          description: "Circular imports indicate tight coupling and make the module graph fragile. Break cycles by extracting shared types/utilities into a separate module.",
          affectedFiles: cyclicFiles.slice(0, 10),
          estimatedEffort: "4-8h",
        });
      }
    } catch { /* skip */ }

    // Check for God objects (files with many exports)
    try {
      const { stdout } = await execAsync(
        `grep -rl "^export" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v dist | head -30`,
        { cwd: projectDir, timeout: 10000 }
      );
      const exportFiles = stdout.trim().split("\n").filter(Boolean);
      const godFiles: string[] = [];

      for (const file of exportFiles) {
        const full = join(projectDir, file);
        if (!existsSync(full)) continue;
        const content = readFileSync(full, "utf-8");
        const exportCount = (content.match(/^export\s/gm) || []).length;
        if (exportCount > 15) godFiles.push(`${file}(${exportCount} exports)`);
      }

      if (godFiles.length > 0) {
        recs.push({
          priority: "medium",
          principle: "maintainability",
          title: "Decompose God objects",
          description: "Files with excessive exports likely violate single responsibility. Split into focused modules with clear boundaries.",
          affectedFiles: godFiles.map(f => f.split("(")[0]).slice(0, 5),
          estimatedEffort: "4-8h per file",
        });
      }
    } catch { /* skip */ }

    return recs;
  }

  private async getSourceFiles(projectDir: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        "find . -name '*.ts' -o -name '*.js' -o -name '*.tsx' -o -name '*.jsx' -o -name '*.py' | grep -v node_modules | grep -v dist | grep -v __tests__ | grep -v .test. | grep -v .spec. | head -50",
        { cwd: projectDir, timeout: 10000 }
      );
      return stdout.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  private extractFunctionLengths(content: string): Array<[string, number, number]> {
    const results: Array<[string, number, number]> = [];
    const lines = content.split("\n");
    let funcStart = -1;
    let funcName = "";
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const funcMatch = line.match(/^\s*(?:async\s+)?(?:function\s+)?(\w+)\s*[<(]/);
      const arrowMatch = line.match(/^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=])\s*=>/);

      if (funcMatch || arrowMatch) {
        if (funcStart >= 0 && depth > 0) {
          results.push([funcName, i - funcStart, funcStart + 1]);
        }
        funcStart = i;
        funcName = funcMatch?.[1] ?? arrowMatch?.[1] ?? "anonymous";
        depth = 0;
      }

      if (funcStart >= 0) {
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth <= 0 && i > funcStart) {
          results.push([funcName, i - funcStart + 1, funcStart + 1]);
          funcStart = -1;
        }
      }
    }

    return results;
  }

  private extractFunctionBlocks(content: string): Array<[string, string, number]> {
    const results: Array<[string, string, number]> = [];
    const lines = content.split("\n");
    let funcStart = -1;
    let funcName = "";
    let bodyLines: string[] = [];
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const funcMatch = line.match(/^\s*(?:async\s+)?(?:function\s+)?(\w+)\s*[<(]/);
      const arrowMatch = line.match(/^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=])\s*=>/);

      if (funcMatch || arrowMatch) {
        if (funcStart >= 0 && bodyLines.length > 0) {
          results.push([funcName, bodyLines.join("\n"), funcStart + 1]);
        }
        funcStart = i;
        funcName = funcMatch?.[1] ?? arrowMatch?.[1] ?? "anonymous";
        bodyLines = [];
        depth = 0;
      }

      if (funcStart >= 0) {
        bodyLines.push(line);
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth <= 0 && i > funcStart) {
          results.push([funcName, bodyLines.join("\n"), funcStart + 1]);
          funcStart = -1;
          bodyLines = [];
        }
      }
    }

    return results;
  }

  private async detectDuplication(_projectDir: string, files: string[]): Promise<string[]> {
    // Simple heuristic: find files with similar line counts and matching first 3 significant lines
    const signatures = new Map<string, string[]>();
    const hotspots: string[] = [];

    for (const file of files.slice(0, 20)) {
      try {
        const content = readFileSync(join(_projectDir, file), "utf-8");
        const lines = content.split("\n").filter(l => l.trim().length > 0 && !l.trim().startsWith("//") && !l.trim().startsWith("import"));
        if (lines.length < 10) continue;

        // Generate 3-line rolling signatures
        for (let i = 0; i < Math.min(lines.length - 2, 20); i++) {
          const sig = [lines[i], lines[i + 1], lines[i + 2]].map(l => l.trim().replace(/\s+/g, " ")).join("|");
          if (!signatures.has(sig)) signatures.set(sig, []);
          signatures.get(sig)!.push(`${file}:${i + 1}`);
        }
      } catch { /* skip */ }
    }

    for (const [sig, locs] of signatures) {
      if (locs.length >= 2 && sig.length > 30) {
        hotspots.push(`${locs[0]} ~ ${locs[1]}`);
      }
    }

    return hotspots.slice(0, 10);
  }
}
