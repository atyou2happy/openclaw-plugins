import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { WorkingMemoryManager } from "../src/working-memory/index.js";

function createMockRuntime() {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-wm-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe("WorkingMemoryManager", () => {
  it("initialize creates plans directory", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    await mgr.initialize(testDir);
    expect(existsSync(join(testDir, "docs", "plans"))).toBe(true);
  });

  it("loadProjectLayer returns null when file does not exist", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    const layer = await mgr.loadProjectLayer(testDir);
    expect(layer).toBeNull();
  });

  it("loadProjectLayer returns layer when file exists", async () => {
    writeFileSync(join(testDir, ".dev-workflow.md"), "# Test\nContent");
    const mgr = new WorkingMemoryManager(createMockRuntime());
    const layer = await mgr.loadProjectLayer(testDir);
    expect(layer).not.toBeNull();
    expect(layer?.content).toContain("# Test");
    expect(layer?.sizeTokens).toBeGreaterThan(0);
  });

  it("updateProjectLayer creates new section", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    await mgr.updateProjectLayer(testDir, "Tech Stack", "TypeScript");
    const content = readFileSync(join(testDir, ".dev-workflow.md"), "utf-8");
    expect(content).toContain("## Tech Stack");
    expect(content).toContain("TypeScript");
  });

  it("updateProjectLayer updates existing section", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    await mgr.updateProjectLayer(testDir, "Tech Stack", "TypeScript");
    await mgr.updateProjectLayer(testDir, "Tech Stack", "JavaScript");
    const content = readFileSync(join(testDir, ".dev-workflow.md"), "utf-8");
    expect(content).toContain("JavaScript");
  });

  it("loadTaskLayer returns null when file does not exist", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    const layer = await mgr.loadTaskLayer(testDir, "task-1");
    expect(layer).toBeNull();
  });

  it("saveTaskLayer creates task context file", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    await mgr.saveTaskLayer(testDir, "task-1", {
      decisions: ["Use TypeScript"],
      completedItems: ["Setup project"],
      currentState: "In progress",
      pendingItems: ["Write tests"],
    });
    const filePath = join(testDir, "docs", "plans", "task-1-context.md");
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("关键决策");
    expect(content).toContain("Use TypeScript");
  });

  it("loadTaskLayer parses sections correctly", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    await mgr.saveTaskLayer(testDir, "task-1", {
      decisions: ["Decision A", "Decision B"],
      completedItems: ["Item 1"],
      currentState: "Done",
      pendingItems: [],
    });
    const layer = await mgr.loadTaskLayer(testDir, "task-1");
    expect(layer).not.toBeNull();
    expect(layer?.decisions).toContain("Decision A");
    expect(layer?.decisions).toContain("Decision B");
    expect(layer?.completedItems[0]).toBe("[x] Item 1");
    expect(layer?.currentState).toBe("Done");
  });

  it("getStepLayer returns a copy of the step layer", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    const layer = mgr.getStepLayer();
    expect(layer.activeFiles).toEqual([]);
    expect(layer.recentCommands).toEqual([]);
    expect(layer.failedAttempts).toEqual([]);
  });

  it("updateStepLayerActiveFile adds file to active files", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    mgr.updateStepLayerActiveFile("src/index.ts");
    const layer = mgr.getStepLayer();
    expect(layer.activeFiles).toContain("src/index.ts");
  });

  it("updateStepLayerActiveFile limits to 3 files", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    mgr.updateStepLayerActiveFile("a.ts");
    mgr.updateStepLayerActiveFile("b.ts");
    mgr.updateStepLayerActiveFile("c.ts");
    mgr.updateStepLayerActiveFile("d.ts");
    const layer = mgr.getStepLayer();
    expect(layer.activeFiles).toHaveLength(3);
    expect(layer.activeFiles[0]).toBe("d.ts");
  });

  it("updateStepLayerCommand adds command output", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    mgr.updateStepLayerCommand("npm test passed");
    const layer = mgr.getStepLayer();
    expect(layer.recentCommands).toContain("npm test passed");
  });

  it("updateStepLayerCommand limits to 5 commands", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    for (let i = 0; i < 10; i++) {
      mgr.updateStepLayerCommand(`cmd ${i}`);
    }
    const layer = mgr.getStepLayer();
    expect(layer.recentCommands).toHaveLength(5);
  });

  it("addFailedAttempt adds to failed attempts", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    mgr.addFailedAttempt("Test failed");
    const layer = mgr.getStepLayer();
    expect(layer.failedAttempts).toContain("Test failed");
  });

  it("shouldCompact returns false by default", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    const result = mgr.shouldCompact();
    expect(result.needed).toBe(false);
    expect(result.level).toBe("none");
  });

  it("shouldCompact returns true when L1 threshold exceeded", () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    // Each command is capped at 200 chars internally; 5 entries * 200 = 1000 chars.
    // Use a custom config with lower thresholds for testability.
    (mgr as any).config = {
      l1MaxToolOutputs: 5,
      l1MaxChars: 500,
      l2MaxToolOutputs: 50,
      l2MaxChars: 100_000,
    };
    // 5 commands * 200 chars = 1000 chars > 500 l1MaxChars
    for (let i = 0; i < 5; i++) {
      mgr.updateStepLayerCommand(`cmd output ${i} `.repeat(20)); // ~400 chars each
    }
    const result = mgr.shouldCompact();
    expect(result.needed).toBe(true);
    expect(result.level).toBe("l1");
  });

  it("executeL1Compact clears step layer outputs", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    for (let i = 0; i < 55; i++) {
      mgr.updateStepLayerCommand(`output ${i}`);
    }
    await mgr.executeL1Compact();
    const layer = mgr.getStepLayer();
    expect(layer.recentCommands.length).toBeLessThanOrEqual(3);
    expect(layer.activeFiles.length).toBeLessThanOrEqual(3);
  });

  it("executeL2Compact creates compact summary", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    mgr.updateStepLayerActiveFile("src/index.ts");
    mgr.updateStepLayerCommand("Running tests");
    const summary = await mgr.executeL2Compact(testDir, "task-1");
    expect(summary.iteration).toBe(1);
    expect(summary.fileTracking).toContain("src/index.ts");
    expect(summary.timestamp).toBeDefined();
  });

  it("executeRecompaction merges with previous summary", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    await mgr.executeL2Compact(testDir, "task-1");
    mgr.updateStepLayerActiveFile("src/new.ts");
    const summary = await mgr.executeRecompaction(testDir, "task-1");
    expect(summary.iteration).toBe(2);
  });

  it("executeRecompaction falls back to L2 when no previous", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    const summary = await mgr.executeRecompaction(testDir, "task-1");
    expect(summary.iteration).toBe(1);
  });

  it("compactTaskToSummary archives task file", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    await mgr.saveTaskLayer(testDir, "task-1", {
      decisions: ["Decision A"],
      completedItems: [],
      currentState: "Done",
      pendingItems: [],
    });
    await mgr.compactTaskToSummary(testDir, "task-1");
    const archivePath = join(testDir, "docs", "plans", "archive", "task-1-context.md");
    const taskPath = join(testDir, "docs", "plans", "task-1-context.md");
    expect(existsSync(archivePath)).toBe(true);
    expect(existsSync(taskPath)).toBe(false);
  });

  it("estimateTokens calculates approximate token count", async () => {
    const mgr = new WorkingMemoryManager(createMockRuntime());
    writeFileSync(join(testDir, ".dev-workflow.md"), "A".repeat(400));
    const layer = await mgr.loadProjectLayer(testDir);
    expect(layer?.sizeTokens).toBeGreaterThan(0);
  });
});
