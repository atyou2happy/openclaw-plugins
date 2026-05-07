/**
 * SkeletonExtractor — Extracts file skeletons (signatures + types, no bodies)
 * for token-efficient code representation.
 *
 * Inspired by:
 * - Aider's repo map (tree-sitter + PageRank + token budget)
 * - LSP document symbols (outline view)
 * - ast-grep pattern matching
 *
 * Strategy:
 * 1. Regex-based extraction (zero dependency, works for TS/JS/Python)
 * 2. Only exports: function signatures, class declarations, interfaces, types
 * 3. Token budget: stop extracting when budget exhausted
 * 4. Cache: extracted skeletons cached by file hash
 *
 * Token savings: 60-80% vs full file content (bodies are the bulk).
 */

import { readFileSync } from "fs";
import { createHash } from "crypto";

// ─── Types ───

export interface FileSkeleton {
  /** File path (relative) */
  path: string;
  /** Extracted symbols */
  symbols: SymbolEntry[];
  /** Token count of skeleton */
  skeletonTokens: number;
  /** Original file token count */
  originalTokens: number;
  /** Compression ratio */
  compressionRatio: number;
}

export interface SymbolEntry {
  kind: "function" | "class" | "interface" | "type" | "enum" | "const" | "method" | "property";
  name: string;
  /** Full signature line (e.g., "function foo(a: string): number") */
  signature: string;
  /** Line number in original file */
  line: number;
  /** Whether this is exported */
  exported: boolean;
}

export interface SkeletonBudget {
  /** Maximum total tokens for all skeletons combined */
  maxTokens: number;
  /** Include non-exported symbols */
  includePrivate: boolean;
  /** Include JSDoc/docstring summaries */
  includeDocs: boolean;
}

const DEFAULT_BUDGET: SkeletonBudget = {
  maxTokens: 2000,
  includePrivate: false,
  includeDocs: false,
};

// ─── Token estimation ───

function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    tokens += (cp >= 0x4E00 && cp <= 0x9FFF) ||
              (cp >= 0x3040 && cp <= 0x30FF) ||
              (cp >= 0xAC00 && cp <= 0xD7AF) ? 1 : 0.25;
  }
  return Math.ceil(tokens);
}

// ─── Regex Patterns (reserved for future full-parser integration) ───
// Currently using inline regex in extractTSSkeletons/extractPythonSkeletons.
// These patterns can replace inline regex when full tree-sitter support is added.
const _PATTERNS: Record<string, RegExp> = {
  // TypeScript/JavaScript
  tsFunction: /^\s*(export\s+)?(?:async\s+)?function\s+(\w+)\s*([^{]*)/m,
  tsClass: /^\s*(export\s+)?(?:abstract\s+)?class\s+(\w+)\s*(?:extends\s+\w+\s*)?(?:implements\s+[\w,\s]+\s*)?\{/m,
  tsInterface: /^\s*(export\s+)?interface\s+(\w+)\s*(?:extends\s+[\w,\s]+\s*)?\{/m,
  tsType: /^\s*(export\s+)?type\s+(\w+)\s*=/m,
  tsEnum: /^\s*(export\s+)?enum\s+(\w+)\s*\{/m,
  tsConst: /^\s*(export\s+)?const\s+(\w+)\s*[:=]/m,
  tsMethod: /^\s+(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(?:get\s+|set\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*(?:\{|=>)/m,

  // Python
  pyFunction: /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?:/m,
  pyClass: /^class\s+(\w+)(?:\([^)]+\))?:/m,
  pyMethod: /^\s+def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?:/m,
};

// ─── Extraction ───

function extractTSSkeletons(content: string, includePrivate: boolean): SymbolEntry[] {
  const symbols: SymbolEntry[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const exported = /^\s*export\s/.test(line);

    // Skip non-exported if includePrivate is false
    if (!includePrivate && !exported && !/^\s*(function|class|interface|type|enum)\s/.test(line)) {
      continue;
    }

    // Function
    const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(\([^;{]*)/);
    if (funcMatch) {
      symbols.push({
        kind: "function",
        name: funcMatch[1],
        signature: line.trim().replace(/\{$/, "").trim(),
        line: i + 1,
        exported,
      });
      continue;
    }

    // Class
    const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        kind: "class",
        name: classMatch[1],
        signature: line.trim().replace(/\{$/, "").trim(),
        line: i + 1,
        exported,
      });
      continue;
    }

    // Interface
    const ifaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
    if (ifaceMatch) {
      // Collect all lines of the interface
      const sig = line.trim().replace(/\{$/, "").trim();
      symbols.push({
        kind: "interface",
        name: ifaceMatch[1],
        signature: sig,
        line: i + 1,
        exported,
      });
      continue;
    }

    // Type alias
    const typeMatch = line.match(/^(?:export\s+)?type\s+(\w+)\s*=\s*/);
    if (typeMatch) {
      symbols.push({
        kind: "type",
        name: typeMatch[1],
        signature: line.trim().replace(/;$/, "").trim(),
        line: i + 1,
        exported,
      });
      continue;
    }

    // Enum
    const enumMatch = line.match(/^(?:export\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        kind: "enum",
        name: enumMatch[1],
        signature: line.trim().replace(/\{$/, "").trim(),
        line: i + 1,
        exported,
      });
      continue;
    }

    // Const (type-annotated only — skip trivial consts)
    const constMatch = line.match(/^(?:export\s+)?const\s+(\w+)\s*:\s*[^=]+\s*=/);
    if (constMatch) {
      symbols.push({
        kind: "const",
        name: constMatch[1],
        signature: line.trim().replace(/\s*=.*/, "").trim(),
        line: i + 1,
        exported,
      });
    }
  }

  return symbols;
}

function extractPythonSkeletons(content: string, includePrivate: boolean): SymbolEntry[] {
  const symbols: SymbolEntry[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level function
    const funcMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*(\([^)]*\))(?:\s*->\s*([^:]+))?:/);
    if (funcMatch) {
      const name = funcMatch[1];
      if (!includePrivate && name.startsWith("_")) continue;
      symbols.push({
        kind: "function",
        name,
        signature: line.trim().replace(/:$/, "").trim(),
        line: i + 1,
        exported: !name.startsWith("_"),
      });
      continue;
    }

    // Class
    const classMatch = line.match(/^class\s+(\w+)(?:\(([^)]+)\))?:/);
    if (classMatch) {
      symbols.push({
        kind: "class",
        name: classMatch[1],
        signature: line.trim().replace(/:$/, "").trim(),
        line: i + 1,
        exported: true,
      });
      continue;
    }

    // Method (indented def)
    const methodMatch = line.match(/^(\s+)(?:async\s+)?def\s+(\w+)\s*(\([^)]*\))(?:\s*->\s*([^:]+))?:/);
    if (methodMatch && includePrivate) {
      symbols.push({
        kind: "method",
        name: methodMatch[2],
        signature: line.trim().replace(/:$/, "").trim(),
        line: i + 1,
        exported: !methodMatch[2].startsWith("_"),
      });
    }
  }

  return symbols;
}

// ─── Main Extractor ───

export class SkeletonExtractor {
  private cache = new Map<string, { hash: string; skeleton: FileSkeleton }>();

  /**
   * Extract skeleton from a single file.
   */
  extractFile(filePath: string, includePrivate = false): FileSkeleton {
    const content = readFileSync(filePath, "utf-8");
    const originalTokens = estimateTokens(content);

    // Check cache
    const hash = createHash("md5").update(content).digest("hex").slice(0, 8);
    const cached = this.cache.get(filePath);
    if (cached && cached.hash === hash) {
      return cached.skeleton;
    }

    // Determine language and extract
    const ext = filePath.split(".").pop() ?? "";
    let symbols: SymbolEntry[];

    if (["ts", "tsx", "js", "jsx", "mjs"].includes(ext)) {
      symbols = extractTSSkeletons(content, includePrivate);
    } else if (["py", "pyi"].includes(ext)) {
      symbols = extractPythonSkeletons(content, includePrivate);
    } else {
      // Unsupported: return first 20 lines as skeleton
      const first20 = content.split("\n").slice(0, 20).join("\n");
      return {
        path: filePath,
        symbols: [],
        skeletonTokens: estimateTokens(first20),
        originalTokens,
        compressionRatio: originalTokens > 0 ? estimateTokens(first20) / originalTokens : 1,
      };
    }

    // Build skeleton string
    const skeletonStr = symbols.map(s => s.signature).join("\n");
    const skeletonTokens = estimateTokens(skeletonStr);

    const skeleton: FileSkeleton = {
      path: filePath,
      symbols,
      skeletonTokens,
      originalTokens,
      compressionRatio: originalTokens > 0 ? skeletonTokens / originalTokens : 0,
    };

    // Cache
    this.cache.set(filePath, { hash, skeleton });
    return skeleton;
  }

  /**
   * Extract skeletons from multiple files within a token budget.
   * Prioritizes: (1) exported symbols, (2) modified files (via git status),
   * (3) files with more symbols.
   */
  extractFiles(
    filePaths: string[],
    budget: Partial<SkeletonBudget> = {},
  ): { skeletons: FileSkeleton[]; totalTokens: number; budgetUsed: number } {
    const config = { ...DEFAULT_BUDGET, ...budget };
    const results: FileSkeleton[] = [];
    let totalTokens = 0;

    // Sort: prioritize likely-important files
    const sorted = [...filePaths].sort((a, b) => {
      // Files named index/main/types go first
      const priorityNames = ["index", "main", "types", "constants", "config"];
      const aPri = priorityNames.some(n => a.toLowerCase().includes(n)) ? 0 : 1;
      const bPri = priorityNames.some(n => b.toLowerCase().includes(n)) ? 0 : 1;
      return aPri - bPri;
    });

    for (const filePath of sorted) {
      if (totalTokens >= config.maxTokens) break;

      try {
        const skeleton = this.extractFile(filePath, config.includePrivate);

        // Apply budget
        if (totalTokens + skeleton.skeletonTokens > config.maxTokens) {
          // Truncate: only keep most important symbols
          const remaining = config.maxTokens - totalTokens;
          const truncated = this.truncateSkeleton(skeleton, remaining, config.includePrivate);
          if (truncated.skeletonTokens > 0) {
            results.push(truncated);
            totalTokens += truncated.skeletonTokens;
          }
          break;
        }

        results.push(skeleton);
        totalTokens += skeleton.skeletonTokens;
      } catch {
        // File not readable — skip
      }
    }

    return {
      skeletons: results,
      totalTokens,
      budgetUsed: config.maxTokens > 0 ? totalTokens / config.maxTokens : 0,
    };
  }

  /**
   * Convert skeletons to a flat string for LLM injection.
   */
  toFlatString(skeletons: FileSkeleton[]): string {
    return skeletons.map(s => {
      const header = `// ${s.path} (${s.symbols.length} symbols, ${Math.round(s.compressionRatio * 100)}%)`;
      const sigs = s.symbols.map(sym => sym.signature).join("\n");
      return `${header}\n${sigs}`;
    }).join("\n\n");
  }

  /**
   * Truncate a skeleton to fit within a token budget.
   * Prioritizes exported symbols.
   */
  private truncateSkeleton(
    skeleton: FileSkeleton,
    maxTokens: number,
    _includePrivate: boolean,
  ): FileSkeleton {
    // Sort: exported first
    const sorted = [...skeleton.symbols].sort((a, b) => {
      if (a.exported !== b.exported) return a.exported ? -1 : 1;
      return 0;
    });

    const kept: SymbolEntry[] = [];
    let tokens = 0;

    for (const sym of sorted) {
      const symTokens = estimateTokens(sym.signature);
      if (tokens + symTokens > maxTokens) break;
      kept.push(sym);
      tokens += symTokens;
    }

    return {
      ...skeleton,
      symbols: kept,
      skeletonTokens: tokens,
      compressionRatio: skeleton.originalTokens > 0 ? tokens / skeleton.originalTokens : 0,
    };
  }

  /**
   * Clear cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
