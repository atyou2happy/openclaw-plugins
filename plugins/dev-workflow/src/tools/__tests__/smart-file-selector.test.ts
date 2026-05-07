import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock child_process so git commands don't hit the real shell
vi.mock("child_process", () => ({
  execSync: vi.fn(() => ""),
}));

import { execSync } from "child_process";
import { SmartFileSelector } from "../smart-file-selector.js";

// ─── Helpers ───

let tmpDir: string;
let selector: SmartFileSelector;

beforeEach(() => {
  tmpDir = join(tmpdir(), `sfs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  selector = new SmartFileSelector();
  vi.mocked(execSync).mockClear();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmp(name: string, content: string): string {
  const filePath = join(tmpDir, name);
  // Ensure parent directories exist
  mkdirSync(filePath.substring(0, filePath.lastIndexOf("/")), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ─── Tests ───

describe("SmartFileSelector", () => {
  // ── selectFiles: non-existent task files ──

  describe("selectFiles — non-existent task files", () => {
    it("returns empty files array when task files do not exist", () => {
      const result = selector.selectFiles(tmpDir, ["no-such-file.ts", "also-missing.ts"], {
        includeGitTouched: false,
        includeTests: false,
        importDepth: 0,
      });

      expect(result.files).toEqual([]);
      expect(result.totalTokens).toBe(0);
    });
  });

  // ── selectFiles: existing task files scored as task-file ──

  describe("selectFiles — task file scoring", () => {
    it("scores existing task files as task-file with score 1.0", () => {
      const filePath = writeTmp("app.ts", "export function main(): void {}\n");

      const result = selector.selectFiles(tmpDir, ["app.ts"], {
        includeGitTouched: false,
        includeTests: false,
        importDepth: 0,
      });

      expect(result.files.length).toBe(1);
      expect(result.files[0].path).toBe(filePath);
      expect(result.files[0].score).toBe(1.0);
      expect(result.files[0].reason).toBe("task-file");
      expect(result.files[0].tokens).toBeGreaterThan(0);
    });
  });

  // ── selectFiles: token budget ──

  describe("selectFiles — maxTokens budget", () => {
    it("excludes files when they exceed the token budget", () => {
      // Create two files: one small, one large
      const smallContent = "export function a(): void {}\n";
      const largeContent = Array.from({ length: 200 }, (_, i) => `// line ${i} padding content here`).join("\n");

      writeTmp("small.ts", smallContent);
      writeTmp("large.ts", largeContent);

      const result = selector.selectFiles(tmpDir, ["small.ts", "large.ts"], {
        maxTokens: 50, // very tight budget
        includeGitTouched: false,
        includeTests: false,
        importDepth: 0,
      });

      // At least one file should be selected
      expect(result.files.length).toBeGreaterThanOrEqual(1);
      // Total tokens must not exceed budget
      expect(result.totalTokens).toBeLessThanOrEqual(50);
      // The higher-scored file (task-file, score=1.0) should be present
      expect(result.files.every((f) => f.reason === "task-file")).toBe(true);
    });
  });

  // ── selectFiles: test pair discovery ──

  describe("selectFiles — test pairs", () => {
    it("finds test pairs (foo.ts + foo.test.ts)", () => {
      const sourcePath = writeTmp("foo.ts", "export function foo(): number { return 1; }\n");
      writeTmp("foo.test.ts", `import { foo } from "./foo";\ntest("foo", () => { expect(foo()).toBe(1); });\n`);

      const result = selector.selectFiles(tmpDir, ["foo.ts"], {
        includeGitTouched: false,
        includeTests: true,
        importDepth: 0,
        maxTokens: 10000,
      });

      // Should have the task file + the test pair
      const testFile = result.files.find((f) => f.reason === "test-pair");
      expect(testFile).toBeDefined();
      expect(testFile!.path).toContain("foo.test.ts");
      expect(testFile!.score).toBe(0.6);
    });

    it("skips test pairs when includeTests=false", () => {
      writeTmp("bar.ts", "export function bar(): void {}\n");
      writeTmp("bar.test.ts", `import { bar } from "./bar";\ntest("bar", () => {});\n`);

      const result = selector.selectFiles(tmpDir, ["bar.ts"], {
        includeGitTouched: false,
        includeTests: false,
        importDepth: 0,
        maxTokens: 10000,
      });

      const testFile = result.files.find((f) => f.reason === "test-pair");
      expect(testFile).toBeUndefined();
    });
  });

  // ── selectFiles: git touched ──

  describe("selectFiles — git-touched files", () => {
    it("calls execSync for git discovery when includeGitTouched=true", () => {
      writeTmp("main.ts", "export function main(): void {}\n");

      selector.selectFiles(tmpDir, ["main.ts"], {
        includeGitTouched: true,
        includeTests: false,
        importDepth: 0,
      });

      expect(execSync).toHaveBeenCalled();
      // The first argument to execSync should contain "git"
      const callArgs = vi.mocked(execSync).mock.calls.map((c) => c[0]);
      expect(callArgs.some((arg) => typeof arg === "string" && arg.includes("git"))).toBe(true);
    });

    it("skips git discovery when includeGitTouched=false", () => {
      writeTmp("main.ts", "export function main(): void {}\n");

      selector.selectFiles(tmpDir, ["main.ts"], {
        includeGitTouched: false,
        includeTests: false,
        importDepth: 0,
      });

      expect(execSync).not.toHaveBeenCalled();
    });

    it("includes git-touched files from execSync output", () => {
      const gitFilePath = writeTmp("changed.ts", "export function changed(): void {}\n");

      vi.mocked(execSync).mockReturnValueOnce("changed.ts\n");

      const result = selector.selectFiles(tmpDir, [], {
        includeGitTouched: true,
        includeTests: false,
        importDepth: 0,
        maxTokens: 10000,
      });

      const gitFile = result.files.find((f) => f.reason === "git-touched");
      expect(gitFile).toBeDefined();
      expect(gitFile!.path).toBe(gitFilePath);
      expect(gitFile!.score).toBe(0.4);
    });
  });

  // ── selectFiles: import neighbors via BFS ──

  describe("selectFiles — import neighbors (BFS)", () => {
    it("discovers import neighbors via BFS", () => {
      // Create a chain: main.ts imports ./utils
      writeTmp(
        "main.ts",
        `import { helper } from "./utils";\nexport function main(): void { helper(); }\n`,
      );
      writeTmp("utils.ts", "export function helper(): void {}\n");

      const result = selector.selectFiles(tmpDir, ["main.ts"], {
        includeGitTouched: false,
        includeTests: false,
        importDepth: 1,
        maxTokens: 10000,
      });

      // Should have main.ts (task-file) and utils.ts (import-neighbor)
      expect(result.files.length).toBe(2);

      const taskFile = result.files.find((f) => f.reason === "task-file");
      const neighbor = result.files.find((f) => f.reason === "import-neighbor");

      expect(taskFile).toBeDefined();
      expect(taskFile!.path).toContain("main.ts");
      expect(neighbor).toBeDefined();
      expect(neighbor!.path).toContain("utils.ts");
      expect(neighbor!.score).toBeGreaterThanOrEqual(0.3);
    });

    it("does not follow imports when importDepth=0", () => {
      writeTmp(
        "entry.ts",
        `import { x } from "./dep";\nexport function entry(): void {}\n`,
      );
      writeTmp("dep.ts", "export const x = 1;\n");

      const result = selector.selectFiles(tmpDir, ["entry.ts"], {
        includeGitTouched: false,
        includeTests: false,
        importDepth: 0,
        maxTokens: 10000,
      });

      expect(result.files.length).toBe(1);
      expect(result.files[0].reason).toBe("task-file");
    });
  });

  // ── toContentString: full content with headers ──

  describe("toContentString — full content", () => {
    it("returns file contents with headers (// === path ...)", () => {
      const filePath = writeTmp("hello.ts", "export function hello(): string { return 'hi'; }\n");

      const selection = {
        files: [
          {
            path: filePath,
            score: 1.0,
            reason: "task-file" as const,
            tokens: 20,
          },
        ],
        totalTokens: 20,
        excludedCount: 0,
        strategy: "test",
      };

      const output = selector.toContentString(selection);

      expect(output).toContain(`// === ${filePath}`);
      expect(output).toContain("task-file");
      expect(output).toContain("export function hello");
    });

    it("separates multiple files with double newline", () => {
      const file1 = writeTmp("a.ts", "export function a(): void {}\n");
      const file2 = writeTmp("b.ts", "export function b(): void {}\n");

      const selection = {
        files: [
          { path: file1, score: 1.0, reason: "task-file" as const, tokens: 10 },
          { path: file2, score: 1.0, reason: "task-file" as const, tokens: 10 },
        ],
        totalTokens: 20,
        excludedCount: 0,
        strategy: "test",
      };

      const output = selector.toContentString(selection);
      const parts = output.split("\n\n");

      expect(parts.length).toBe(2);
      expect(parts[0]).toContain("a.ts");
      expect(parts[1]).toContain("b.ts");
    });

    it("handles unreadable files gracefully", () => {
      const selection = {
        files: [
          { path: "/nonexistent/path/file.ts", score: 1.0, reason: "task-file" as const, tokens: 10 },
        ],
        totalTokens: 10,
        excludedCount: 0,
        strategy: "test",
      };

      const output = selector.toContentString(selection);
      expect(output).toContain("unreadable");
    });
  });

  // ── toContentString: skeleton mode ──

  describe("toContentString — skeleton mode", () => {
    it("returns only file paths when useSkeleton=true", () => {
      const file1 = writeTmp("one.ts", "export const one = 1;\n");
      const file2 = writeTmp("two.ts", "export const two = 2;\n");

      const selection = {
        files: [
          { path: file1, score: 1.0, reason: "task-file" as const, tokens: 5 },
          { path: file2, score: 0.8, reason: "import-neighbor" as const, tokens: 5 },
        ],
        totalTokens: 10,
        excludedCount: 0,
        strategy: "test",
      };

      const output = selector.toContentString(selection, true);

      // Should be just paths joined by newline, no content or headers
      expect(output).toBe(`${file1}\n${file2}`);
      expect(output).not.toContain("// ===");
      expect(output).not.toContain("export");
    });
  });

  // ── excludedCount ──

  describe("excludedCount", () => {
    it("is correct when budget is exceeded", () => {
      // Create 3 files with enough content to exceed a small budget
      const content = Array.from({ length: 50 }, (_, i) => `// padding line ${i}`).join("\n");

      writeTmp("file1.ts", content);
      writeTmp("file2.ts", content);
      writeTmp("file3.ts", content);

      const result = selector.selectFiles(tmpDir, ["file1.ts", "file2.ts", "file3.ts"], {
        maxTokens: 100, // very tight — at most one file fits
        includeGitTouched: false,
        includeTests: false,
        importDepth: 0,
      });

      expect(result.excludedCount).toBeGreaterThan(0);
      expect(result.excludedCount + result.files.length).toBe(3);
    });
  });

  // ── strategy string ──

  describe("strategy string", () => {
    it("encodes task file count and config in strategy", () => {
      writeTmp("x.ts", "export const x = 1;\n");

      const result = selector.selectFiles(tmpDir, ["x.ts"], {
        includeGitTouched: false,
        includeTests: false,
        importDepth: 2,
      });

      expect(result.strategy).toContain("task(1)");
      expect(result.strategy).toContain("imports(2)");
      expect(result.strategy).toContain("git(false)");
    });
  });
});
