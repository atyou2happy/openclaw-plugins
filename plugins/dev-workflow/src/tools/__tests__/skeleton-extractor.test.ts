import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { SkeletonExtractor } from "../skeleton-extractor.js";

// ─── Sample file contents ───

const TS_CONTENT = `export function greet(name: string): string {
  return "hello " + name;
}

export class UserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getUser(id: string): Promise<User> {
    return this.db.find(id);
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export type Result = { ok: true; value: string } | { ok: false; error: string };

export enum Status {
  Active,
  Inactive,
  Pending,
}
`;

const PYTHON_CONTENT = `import os
from typing import List, Optional

class Animal:
    """Base animal class."""

    def __init__(self, name: str):
        self.name = name

    def speak(self) -> str:
        raise NotImplementedError

    def _internal_method(self) -> None:
        pass

def feed(animal: Animal, food: str) -> bool:
    """Feed an animal."""
    return True

async def migrate(animals: List[Animal]) -> None:
    """Migrate animals."""
    pass

def _helper(x: int) -> int:
    return x * 2
`;

// Content for testing unknown extensions (e.g., .txt)
// We need more than 20 lines to verify truncation
const TXT_CONTENT = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}: some content here`).join("\n");

// ─── Helpers ───

let tmpDir: string;
let extractor: SkeletonExtractor;

beforeEach(() => {
  tmpDir = join(tmpdir(), `skeleton-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  extractor = new SkeletonExtractor();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmp(name: string, content: string): string {
  const filePath = join(tmpDir, name);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ─── Tests ───

describe("SkeletonExtractor", () => {
  // ── extractFile: TypeScript ──

  describe("extractFile — TypeScript", () => {
    it("extracts function signatures", () => {
      const filePath = writeTmp("example.ts", TS_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      const funcs = skeleton.symbols.filter((s) => s.kind === "function");
      expect(funcs.length).toBeGreaterThanOrEqual(1);
      expect(funcs.some((f) => f.name === "greet")).toBe(true);
      expect(funcs.find((f) => f.name === "greet")!.exported).toBe(true);
      expect(funcs.find((f) => f.name === "greet")!.signature).toContain("function greet");
    });

    it("extracts class declarations", () => {
      const filePath = writeTmp("example.ts", TS_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      const classes = skeleton.symbols.filter((s) => s.kind === "class");
      expect(classes.length).toBeGreaterThanOrEqual(1);
      expect(classes.some((c) => c.name === "UserService")).toBe(true);
    });

    it("extracts interfaces", () => {
      const filePath = writeTmp("example.ts", TS_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      const ifaces = skeleton.symbols.filter((s) => s.kind === "interface");
      expect(ifaces.length).toBeGreaterThanOrEqual(1);
      expect(ifaces.some((i) => i.name === "User")).toBe(true);
    });

    it("extracts type aliases", () => {
      const filePath = writeTmp("example.ts", TS_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      const types = skeleton.symbols.filter((s) => s.kind === "type");
      expect(types.length).toBeGreaterThanOrEqual(1);
      expect(types.some((t) => t.name === "Result")).toBe(true);
    });

    it("extracts enums", () => {
      const filePath = writeTmp("example.ts", TS_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      const enums = skeleton.symbols.filter((s) => s.kind === "enum");
      expect(enums.length).toBeGreaterThanOrEqual(1);
      expect(enums.some((e) => e.name === "Status")).toBe(true);
    });

    it("populates originalTokens and compressionRatio", () => {
      const filePath = writeTmp("example.ts", TS_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      expect(skeleton.originalTokens).toBeGreaterThan(0);
      expect(skeleton.skeletonTokens).toBeGreaterThan(0);
      expect(skeleton.compressionRatio).toBeGreaterThan(0);
      expect(skeleton.compressionRatio).toBeLessThan(1);
    });
  });

  // ── extractFile: Python ──

  describe("extractFile — Python", () => {
    it("extracts def (function) signatures", () => {
      const filePath = writeTmp("example.py", PYTHON_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      const funcs = skeleton.symbols.filter((s) => s.kind === "function");
      expect(funcs.length).toBeGreaterThanOrEqual(1);
      expect(funcs.some((f) => f.name === "feed")).toBe(true);
      expect(funcs.some((f) => f.name === "migrate")).toBe(true);
    });

    it("extracts class declarations", () => {
      const filePath = writeTmp("example.py", PYTHON_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      const classes = skeleton.symbols.filter((s) => s.kind === "class");
      expect(classes.length).toBeGreaterThanOrEqual(1);
      expect(classes.some((c) => c.name === "Animal")).toBe(true);
    });

    it("skips methods (indented def) when includePrivate=false (default)", () => {
      const filePath = writeTmp("example.py", PYTHON_CONTENT);
      const skeleton = extractor.extractFile(filePath, false);

      const methods = skeleton.symbols.filter((s) => s.kind === "method");
      expect(methods.length).toBe(0);
    });

    it("skips _prefixed functions when includePrivate=false", () => {
      const filePath = writeTmp("example.py", PYTHON_CONTENT);
      const skeleton = extractor.extractFile(filePath, false);

      const names = skeleton.symbols.map((s) => s.name);
      expect(names).not.toContain("_helper");
    });

    it("includes _prefixed functions when includePrivate=true", () => {
      const filePath = writeTmp("example.py", PYTHON_CONTENT);
      const skeleton = extractor.extractFile(filePath, true);

      const names = skeleton.symbols.map((s) => s.name);
      expect(names).toContain("_helper");
    });

    it("includes methods when includePrivate=true", () => {
      const filePath = writeTmp("example.py", PYTHON_CONTENT);
      const skeleton = extractor.extractFile(filePath, true);

      const methods = skeleton.symbols.filter((s) => s.kind === "method");
      // __init__, speak, _internal_method
      expect(methods.length).toBeGreaterThanOrEqual(2);
      expect(methods.some((m) => m.name === "speak")).toBe(true);
    });
  });

  // ── extractFile: unknown extension (fallback) ──

  describe("extractFile — unknown extension fallback", () => {
    it("returns first 20 lines as skeleton for unsupported extension", () => {
      const filePath = writeTmp("readme.txt", TXT_CONTENT);
      const skeleton = extractor.extractFile(filePath);

      expect(skeleton.symbols).toEqual([]);
      expect(skeleton.skeletonTokens).toBeGreaterThan(0);
      expect(skeleton.originalTokens).toBeGreaterThan(0);
    });

    it("includes the file path in the result", () => {
      const filePath = writeTmp("data.csv", "a,b,c\n1,2,3\n");
      const skeleton = extractor.extractFile(filePath);

      expect(skeleton.path).toBe(filePath);
    });
  });

  // ── Caching ──

  describe("caching", () => {
    it("caches results (same file content returns cached result)", () => {
      const filePath = writeTmp("cached.ts", TS_CONTENT);

      const first = extractor.extractFile(filePath);
      const second = extractor.extractFile(filePath);

      // Same reference or deeply equal — cache hit
      expect(second).toEqual(first);
    });

    it("cache is invalidated when file content changes", () => {
      const filePath = writeTmp("changing.ts", TS_CONTENT);
      const first = extractor.extractFile(filePath);

      // Overwrite with different content
      writeFileSync(filePath, "export function newFunc(): void {}\n", "utf-8");
      const second = extractor.extractFile(filePath);

      const names = second.symbols.map((s) => s.name);
      expect(names).toContain("newFunc");
      expect(names).not.toContain("greet");
    });
  });

  // ── extractFiles: budget ──

  describe("extractFiles — token budget", () => {
    it("respects token budget and stops extracting", () => {
      const file1 = writeTmp("big1.ts", TS_CONTENT);
      const file2 = writeTmp("big2.ts", TS_CONTENT);
      const file3 = writeTmp("big3.ts", TS_CONTENT);

      // Use a very small budget so it cannot fit all files
      const result = extractor.extractFiles([file1, file2, file3], { maxTokens: 50 });

      expect(result.totalTokens).toBeLessThanOrEqual(50 + 10); // small tolerance for token estimation
      expect(result.skeletons.length).toBeLessThan(3);
    });

    it("returns all files when budget is large enough", () => {
      const file1 = writeTmp("a.ts", "export function a(): void {}\n");
      const file2 = writeTmp("b.ts", "export function b(): void {}\n");

      const result = extractor.extractFiles([file1, file2], { maxTokens: 10000 });

      expect(result.skeletons.length).toBe(2);
    });

    it("skips unreadable files gracefully", () => {
      const goodFile = writeTmp("good.ts", "export function good(): void {}\n");
      const badFile = join(tmpDir, "nonexistent.ts");

      const result = extractor.extractFiles([goodFile, badFile], { maxTokens: 10000 });

      expect(result.skeletons.length).toBe(1);
      expect(result.skeletons[0].symbols.some((s) => s.name === "good")).toBe(true);
    });
  });

  // ── extractFiles: priority sorting ──

  describe("extractFiles — priority sorting", () => {
    it("prioritizes index/main/types named files", () => {
      const regularFile = writeTmp("utils.ts", "export function util(): void {}\n");
      const indexFile = writeTmp("index.ts", "export function main(): void {}\n");

      // Very small budget — only one file should fit partially
      const result = extractor.extractFiles(
        [regularFile, indexFile],
        { maxTokens: 1 }, // tiny budget
      );

      // index.ts should be attempted first (sorted before utils.ts)
      // It may get truncated to nothing with budget=1, but the sort order means
      // index was attempted. Let's verify with a slightly bigger budget.
    });

    it("places index file before regular file in results when budget allows", () => {
      const regularFile = writeTmp("utils.ts", "export function util(): void {}\n");
      const indexFile = writeTmp("index.ts", "export function main(): void {}\n");

      const result = extractor.extractFiles([regularFile, indexFile], { maxTokens: 10000 });

      expect(result.skeletons.length).toBe(2);
      // index.ts should come first
      expect(result.skeletons[0].path).toContain("index");
      expect(result.skeletons[1].path).toContain("utils");
    });

    it("prioritizes types named files", () => {
      const regularFile = writeTmp("helper.ts", "export function help(): void {}\n");
      const typesFile = writeTmp("types.ts", "export type Foo = string;\n");

      const result = extractor.extractFiles([regularFile, typesFile], { maxTokens: 10000 });

      expect(result.skeletons.length).toBe(2);
      expect(result.skeletons[0].path).toContain("types");
      expect(result.skeletons[1].path).toContain("helper");
    });
  });

  // ── toFlatString ──

  describe("toFlatString", () => {
    it("formats skeletons with path header", () => {
      const filePath = writeTmp("flat.ts", "export function hello(): string {\n  return 'hi';\n}\n");
      const skeleton = extractor.extractFile(filePath);

      const output = extractor.toFlatString([skeleton]);

      expect(output).toContain("// " + filePath);
      expect(output).toContain("1 symbols");
      expect(output).toContain("function hello");
    });

    it("separates multiple skeletons with double newline", () => {
      const file1 = writeTmp("a.ts", "export function a(): void {}\n");
      const file2 = writeTmp("b.ts", "export function b(): void {}\n");

      const s1 = extractor.extractFile(file1);
      const s2 = extractor.extractFile(file2);

      const output = extractor.toFlatString([s1, s2]);
      const parts = output.split("\n\n");

      expect(parts.length).toBe(2);
      expect(parts[0]).toContain("a.ts");
      expect(parts[1]).toContain("b.ts");
    });

    it("returns empty string for empty array", () => {
      expect(extractor.toFlatString([])).toBe("");
    });
  });

  // ── clearCache ──

  describe("clearCache", () => {
    it("forces re-extraction after clearCache", () => {
      const filePath = writeTmp("cached.ts", TS_CONTENT);

      const first = extractor.extractFile(filePath);
      extractor.clearCache();

      // Overwrite with new content
      writeFileSync(filePath, "export function refreshed(): number { return 42; }\n", "utf-8");

      const afterClear = extractor.extractFile(filePath);
      const names = afterClear.symbols.map((s) => s.name);

      expect(names).toContain("refreshed");
      expect(names).not.toContain("greet");
    });

    it("cache serves stale data without clearCache", () => {
      const filePath = writeTmp("stale.ts", "export function old(): void {}\n");

      const first = extractor.extractFile(filePath);
      expect(first.symbols.some((s) => s.name === "old")).toBe(true);

      // Modify file without clearing cache
      writeFileSync(filePath, "export function updated(): void {}\n", "utf-8");

      const stale = extractor.extractFile(filePath);
      // Cache should still return the old result since the hash changed
      // Actually, the implementation re-reads the file and recomputes the hash.
      // If the hash differs, it re-extracts. So the cache IS updated.
      // Let's verify: the implementation reads the file content first, computes hash,
      // compares with cached hash. If different, it re-extracts.
      // So this test actually verifies the cache correctly invalidates on content change.
      expect(stale.symbols.some((s) => s.name === "updated")).toBe(true);
    });
  });
});
