import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { HandoverManager } from "../src/handover/index.js";
import type { WorkflowContext } from "../src/types.js";
import { DEFAULT_FEATURE_FLAGS } from "../src/types.js";

const mockRuntime = {
  logging: {
    getChildLogger: () => ({ info: vi.fn(), warn: vi.fn() }),
  },
} as any;

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "handover-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    projectId: "test-project",
    projectDir: testDir,
    mode: "standard",
    currentStep: "step7-development",
    spec: null,
    activeTaskIndex: 0,
    brainstormNotes: [],
    decisions: ["Use TypeScript"],
    qaGateResults: [],
    startedAt: new Date().toISOString(),
    openSource: true,
    branchName: "feature/test",
    featureFlags: DEFAULT_FEATURE_FLAGS,
    ...overrides,
  };
}

describe("HandoverManager", () => {
  // 1. generate creates handover.md file
  it("generate creates docs/handover.md file", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext();
    await mgr.generate(ctx, "test-model");
    expect(existsSync(join(testDir, "docs", "handover.md"))).toBe(true);
  });

  // 2. generate includes project name and step
  it("generate includes project name and step in output", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext();
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("test-project");
    expect(content).toContain("step7-development");
  });

  // 3. generate includes decisions
  it("generate includes key decisions", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext({ decisions: ["Use TypeScript", "Use Vitest"] });
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("Use TypeScript");
    expect(content).toContain("Use Vitest");
  });

  // 4. generate with spec includes task progress info
  it("generate with spec includes task progress info", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext({
      spec: {
        proposal: "p",
        design: "d",
        tasks: [
          { id: "t1", title: "Task 1", description: "desc1", status: "completed", difficulty: "easy", estimatedMinutes: 10, dependencies: [], files: [], shipCategory: "ship", granularity: "fine", suggestedModel: "gpt-4", maxLines: 100, subtasks: [], gates: [] },
          { id: "t2", title: "Task 2", description: "desc2", status: "pending", difficulty: "medium", estimatedMinutes: 30, dependencies: [], files: [], shipCategory: "ship", granularity: "fine", suggestedModel: "gpt-4", maxLines: 100, subtasks: [], gates: [] },
          { id: "t3", title: "Task 3", description: "desc3", status: "in_progress", difficulty: "hard", estimatedMinutes: 60, dependencies: [], files: [], shipCategory: "ship", granularity: "fine", suggestedModel: "gpt-4", maxLines: 100, subtasks: [], gates: [] },
        ],
        updatedAt: new Date().toISOString(),
      },
    });
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("1/3"); // tasksCompleted
    expect(content).toContain("t3"); // current in_progress task
    expect(content).toContain("[x] t1: Task 1"); // completed items
  });

  // 5. generate includes tech context
  it("generate includes tech context section", async () => {
    const mgr = new HandoverManager(mockRuntime);
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "test" }));
    const ctx = makeContext({ openSource: true });
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("技术上下文");
    expect(content).toContain("standard");
    expect(content).toContain("Open Source");
  });

  // 6. generate includes spec status
  it("generate includes spec status section", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext();
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("Spec 状态");
    expect(content).toContain("proposal.md");
    expect(content).toContain("design.md");
    expect(content).toContain("tasks.md");
  });

  // 7. generate includes recovery strategy
  it("generate includes recovery strategy", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext();
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("恢复策略");
    expect(content).toContain("Run Step 0 scan to verify project state");
    expect(content).toContain("step7-development");
  });

  // 8. consume returns null when no handover file
  it("consume returns null when no handover file exists", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const result = await mgr.consume(testDir);
    expect(result).toBeNull();
  });

  // 9. consume parses existing handover file
  it("consume parses existing handover file", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext();
    await mgr.generate(ctx, "test-model");

    const doc = await mgr.consume(testDir);
    expect(doc).not.toBeNull();
    expect(doc!.projectName).toBe("test-project");
    expect(doc!.generatedBy).toBe("test-model");
  });

  // 10. consume archives the handover file
  it("consume archives the handover file", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext();
    await mgr.generate(ctx, "test-model");

    expect(existsSync(join(testDir, "docs", "handover.md"))).toBe(true);
    await mgr.consume(testDir);
    // Original file should be gone (moved to archive)
    expect(existsSync(join(testDir, "docs", "handover.md"))).toBe(false);
    // Archive dir should exist with a file
    const archiveDir = join(testDir, "docs", "handover", "archive");
    expect(existsSync(archiveDir)).toBe(true);
  });

  // 11. archive creates unique filenames on collision
  it("archive creates unique filenames on collision", async () => {
    const mgr = new HandoverManager(mockRuntime);

    // Generate and consume first handover
    await mgr.generate(makeContext({ projectId: "proj1" }), "model-a");
    await mgr.consume(testDir);

    // Generate and consume second handover on same day
    await mgr.generate(makeContext({ projectId: "proj2" }), "model-b");
    await mgr.consume(testDir);

    const archiveDir = join(testDir, "docs", "handover", "archive");
    const { readdirSync } = await import("fs");
    const files = readdirSync(archiveDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
    // Second file should have a -1 suffix
    expect(files.some((f) => f.includes("handover-1.md"))).toBe(true);
  });

  // 12. detectTechStack detects TypeScript
  it("detectTechStack detects TypeScript via package.json and tsconfig.json", async () => {
    const mgr = new HandoverManager(mockRuntime);
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "ts-proj" }));
    writeFileSync(join(testDir, "tsconfig.json"), "{}");
    const ctx = makeContext();
    const content = await mgr.generate(ctx, "test-model");
    // The tech stack should mention Node.js/TypeScript and TypeScript
    expect(content).toContain("Node.js/TypeScript");
    expect(content).toContain("TypeScript");
  });

  // 13. detectTechStack detects Python
  it("detectTechStack detects Python via requirements.txt", async () => {
    const mgr = new HandoverManager(mockRuntime);
    writeFileSync(join(testDir, "requirements.txt"), "flask\nrequests\n");
    const ctx = makeContext();
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("Python");
  });

  // 14. detectDependencies from package.json
  it("detectDependencies reads from package.json", async () => {
    const mgr = new HandoverManager(mockRuntime);
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        name: "my-pkg",
        dependencies: { express: "^4.18.0", lodash: "^4.17.0" },
        devDependencies: { vitest: "^1.0.0" },
      })
    );
    const ctx = makeContext();
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("express");
    expect(content).toContain("lodash");
    expect(content).toContain("vitest");
  });

  // 15. generate with failed tasks includes known issues
  it("generate with failed tasks includes known issues", async () => {
    const mgr = new HandoverManager(mockRuntime);
    const ctx = makeContext({
      spec: {
        proposal: "p",
        design: "d",
        tasks: [
          { id: "t1", title: "Broken Task", description: "Something went wrong", status: "failed", difficulty: "hard", estimatedMinutes: 30, dependencies: [], files: [], shipCategory: "ship", granularity: "fine", suggestedModel: "gpt-4", maxLines: 100, subtasks: [], gates: [] },
        ],
        updatedAt: new Date().toISOString(),
      },
    });
    const content = await mgr.generate(ctx, "test-model");
    expect(content).toContain("已知问题");
    expect(content).toContain("Broken Task");
    expect(content).toContain("Something went wrong");
    expect(content).toContain("medium");
  });
});
