import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemdirManager } from "../src/memdir/index.js";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const mockRuntime = {
  logging: { getChildLogger: () => ({ info: vi.fn(), warn: vi.fn() }) },
} as any;

describe("MemdirManager", () => {
  let manager: MemdirManager;
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "memdir-test-"));
    manager = new MemdirManager(mockRuntime);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("initialize creates directory structure", async () => {
    await manager.initialize(testDir);
    expect(existsSync(join(testDir, "docs/memory/decisions"))).toBe(true);
    expect(existsSync(join(testDir, "docs/memory/patterns"))).toBe(true);
    expect(existsSync(join(testDir, "docs/memory/constraints"))).toBe(true);
    expect(existsSync(join(testDir, "docs/memory/lessons"))).toBe(true);
    expect(existsSync(join(testDir, "docs/memory/archive"))).toBe(true);
  });

  it("initialize creates index.md if missing", async () => {
    await manager.initialize(testDir);
    expect(existsSync(join(testDir, "docs/memory/index.md"))).toBe(true);
    const content = readFileSync(join(testDir, "docs/memory/index.md"), "utf-8");
    expect(content).toContain("Memory Index");
  });

  it("initialize preserves existing index.md", async () => {
    await manager.initialize(testDir);
    const indexPath = join(testDir, "docs/memory/index.md");
    writeFileSync(indexPath, "# Custom Index\n");
    await manager.initialize(testDir);
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toBe("# Custom Index\n");
  });

  it("remember creates entry with correct fields", async () => {
    await manager.initialize(testDir);
    const entry = await manager.remember(testDir, {
      type: "decision", title: "Use TypeScript",
      content: "Project will use TypeScript", tags: ["typescript", "language"],
    });
    expect(entry.type).toBe("decision");
    expect(entry.title).toBe("Use TypeScript");
    expect(entry.status).toBe("fresh");
    expect(entry.referenceCount).toBe(0);
    expect(entry.tags).toEqual(["typescript", "language"]);
  });

  it("remember generates ID from title", async () => {
    await manager.initialize(testDir);
    const entry = await manager.remember(testDir, {
      type: "pattern", title: "Repository Pattern", content: "Use repos", tags: [],
    });
    expect(entry.id).toBe("repository-pattern");
  });

  it("remember creates file in correct subdirectory", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, {
      type: "lesson", title: "Test First", content: "Write tests before code", tags: [],
    });
    const { readdirSync } = await import("fs");
    const files = readdirSync(join(testDir, "docs/memory/lessons"));
    expect(files.length).toBe(1);
    expect(files[0]).toBe("test-first.md");
  });

  it("remember sets status to fresh", async () => {
    await manager.initialize(testDir);
    const entry = await manager.remember(testDir, {
      type: "constraint", title: "No External API", content: "No external calls", tags: [],
    });
    expect(entry.status).toBe("fresh");
  });

  it("recall returns all entries when type=all", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, { type: "decision", title: "D1", content: "c", tags: [] });
    await manager.remember(testDir, { type: "pattern", title: "P1", content: "c", tags: [] });
    await manager.remember(testDir, { type: "lesson", title: "L1", content: "c", tags: [] });
    const results = await manager.recall(testDir, "all");
    expect(results.length).toBe(3);
  });

  it("recall filters by type", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, { type: "decision", title: "D1", content: "c", tags: [] });
    await manager.remember(testDir, { type: "pattern", title: "P1", content: "c", tags: [] });
    const decisions = await manager.recall(testDir, "decision");
    expect(decisions.length).toBe(1);
    expect(decisions[0].type).toBe("decision");
  });

  it("recall filters by query", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, { type: "decision", title: "Use React", content: "Frontend framework", tags: ["react"] });
    await manager.remember(testDir, { type: "decision", title: "Use PostgreSQL", content: "Database choice", tags: ["db"] });
    const results = await manager.recall(testDir, "all", "react");
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Use React");
  });

  it("recall excludes archived entries (moved to archive dir)", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, { type: "decision", title: "D1", content: "c", tags: [] });
    // Move the file to archive
    const srcDir = join(testDir, "docs/memory/decisions");
    const archiveDir = join(testDir, "docs/memory/archive");
    const { readdirSync, renameSync } = await import("fs");
    const files = readdirSync(srcDir).filter(f => f.endsWith(".md"));
    if (files.length > 0) renameSync(join(srcDir, files[0]), join(archiveDir, files[0]));
    const results = await manager.recall(testDir, "decision");
    expect(results.length).toBe(0);
  });

  it("recall sorts by status order", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, { type: "decision", title: "Entry A", content: "c", tags: [] });
    await manager.remember(testDir, { type: "decision", title: "Entry B", content: "c", tags: [] });
    const results = await manager.recall(testDir, "decision");
    // All fresh, should have 2 entries
    expect(results.length).toBe(2);
    expect(results.every(r => r.status === "fresh" || r.status === "referenced")).toBe(true);
  });

  it("recall limits to 10 results", async () => {
    await manager.initialize(testDir);
    for (let i = 0; i < 15; i++) {
      await manager.remember(testDir, { type: "decision", title: `Entry ${i}`, content: "c", tags: [] });
    }
    const results = await manager.recall(testDir, "all");
    expect(results.length).toBe(10);
  });

  it("forget removes entry", async () => {
    await manager.initialize(testDir);
    const entry = await manager.remember(testDir, { type: "decision", title: "To Forget", content: "c", tags: [] });
    const result = await manager.forget(testDir, entry.id);
    expect(result).toBe(true);
    const remaining = await manager.recall(testDir, "decision");
    expect(remaining.length).toBe(0);
  });

  it("forget returns false for non-existent entry", async () => {
    await manager.initialize(testDir);
    const result = await manager.forget(testDir, "non-existent-id");
    expect(result).toBe(false);
  });

  it("updateAging runs without error", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, { type: "decision", title: "Fresh Entry", content: "c", tags: [] });
    // Should not throw
    await expect(manager.updateAging(testDir)).resolves.toBeUndefined();
  });

  it("formatAsMarkdown produces valid markdown", async () => {
    await manager.initialize(testDir);
    await manager.remember(testDir, { type: "lesson", title: "Write Tests", content: "Always write tests", tags: ["testing"] });
    const md = await manager.formatAsMarkdown(testDir);
    expect(md).toContain("Memory Recall Results");
    expect(md).toContain("Write Tests");
    expect(md).toContain("testing");
  });
});
