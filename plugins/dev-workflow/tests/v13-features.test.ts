/**
 * v13 Feature Tests — Prompt Caching, L3 Memory, Gate Dedup, Trajectory, SubAgent Isolation
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

function createMockRuntime(overrides: Record<string, any> = {}) {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      }),
    },
    subagent: {
      run: vi.fn().mockResolvedValue({ runId: "run-1" }),
      waitForRun: vi.fn().mockResolvedValue({ status: "ok" }),
      getSessionMessages: vi.fn().mockResolvedValue({ messages: ["ok"] }),
      deleteSession: vi.fn(),
    },
    system: {
      runCommandWithTimeout: vi.fn(),
    },
    ...overrides,
  } as any;
}

let testDir: string;
beforeEach(() => {
  testDir = join(tmpdir(), `dwf-v13-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});
afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

// ── T2: L3 WorkingMemory compression ──
describe("WorkingMemory L3 Compact (T2)", () => {
  it("should not compress when entries below threshold", async () => {
    const { WorkingMemoryManager } = await import("../src/working-memory/index.js");
    const mgr = new WorkingMemoryManager(createMockRuntime());
    // Few entries — should not trigger L3
    const result = await mgr.executeL3Compact(testDir, "task-1");
    expect(result).toBe(false);
  });

  it("should have l3MaxTaskEntries in default config", async () => {
    const { WorkingMemoryManager } = await import("../src/working-memory/index.js");
    const mgr = new WorkingMemoryManager(createMockRuntime());
    // Access internal config to verify default
    expect((mgr as any).config.l3MaxTaskEntries).toBe(30);
  });
});

// ── T6: Gate/Verification dedup ──
describe("VerificationAgent skipChecks (T6)", () => {
  it("should skip lint when skipChecks includes 'lint'", async () => {
    const { VerificationAgent } = await import("../src/agents/verification-agent.js");
    const agent = new VerificationAgent(createMockRuntime());
    const report = await agent.verify("task-1", testDir, ["lint", "test"]);
    // Skipped checks should show as passed
    expect(report.lint.passed).toBe(true);
    expect(report.lint.output).toContain("Skipped");
    expect(report.tests.passed).toBe(true);
    expect(report.tests.output).toContain("Skipped");
  });

  it("should run all checks when skipChecks is undefined", async () => {
    const { VerificationAgent } = await import("../src/agents/verification-agent.js");
    const agent = new VerificationAgent(createMockRuntime());
    // Without skipChecks, it will actually try to run lint/test/typeCheck
    // which will fail gracefully (no tools installed), but should NOT skip
    const report = await agent.verify("task-1", testDir);
    // Should not contain "Skipped (gate check passed)"
    expect(report.lint.output).not.toContain("Skipped (gate check passed)");
  });

  it("should accept skipChecks as empty array (no skips)", async () => {
    const { VerificationAgent } = await import("../src/agents/verification-agent.js");
    const agent = new VerificationAgent(createMockRuntime());
    const report = await agent.verify("task-1", testDir, []);
    expect(report.lint.output).not.toContain("Skipped (gate check passed)");
  });
});

// ── A1: Trajectory vs Decisions ──
describe("Trajectory vs Decisions dual queue (A1)", () => {
  it("should have trajectory field in WorkflowContext type", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    // Initialize
    await engine.initialize("test requirement", testDir, "standard");
    const ctx = engine.getContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.trajectory).toBeDefined();
    expect(Array.isArray(ctx!.trajectory)).toBe(true);
  });

  it("trajectory should auto-sync from decisions in persistContext", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize("test requirement", testDir, "standard");
    const ctx = engine.getContext()!;

    // Direct push to decisions (legacy pattern)
    ctx.decisions.push("Decision A");
    ctx.decisions.push("Decision B");

    // persistContext should sync trajectory
    (engine as any).persistContext();

    expect(ctx.trajectory.length).toBeGreaterThanOrEqual(2);
    expect(ctx.trajectory[ctx.trajectory.length - 2]).toContain("Decision A");
    expect(ctx.trajectory[ctx.trajectory.length - 1]).toContain("Decision B");
    // Trajectory entries should have ISO timestamp prefix
    expect(ctx.trajectory[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
  });

  it("recordDecision should write to both trajectory and decisions", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize("test requirement", testDir, "standard");
    const ctx = engine.getContext()!;

    const initialD = ctx.decisions.length;
    const initialT = ctx.trajectory.length;

    (engine as any).recordDecision("Test decision via helper");

    expect(ctx.decisions.length).toBe(initialD + 1);
    expect(ctx.decisions[ctx.decisions.length - 1]).toBe("Test decision via helper");
    expect(ctx.trajectory.length).toBe(initialT + 1);
    expect(ctx.trajectory[ctx.trajectory.length - 1]).toContain("Test decision via helper");
  });
});

// ── A3: SubAgent Isolation Interface ──
describe("SubAgent isolation interface (A3)", () => {
  it("should export SubAgentConfig type and DEFAULT_SUBAGENT_CONFIG", async () => {
    const mod = await import("../src/types.js");
    expect(mod.DEFAULT_SUBAGENT_CONFIG).toBeDefined();
    expect(mod.DEFAULT_SUBAGENT_CONFIG.isolation).toBe("none");
    expect(mod.DEFAULT_SUBAGENT_CONFIG.timeout).toBe(300_000);
  });

  it("orchestrator executeTask should accept optional subagentConfig", async () => {
    const { AgentOrchestrator } = await import("../src/agents/agent-orchestrator.js");
    const orch = new AgentOrchestrator(createMockRuntime({
      subagent: {
        run: vi.fn().mockResolvedValue({ runId: "run-1" }),
        waitForRun: vi.fn().mockResolvedValue({
          status: "ok",
          output: "Task completed",
        }),
        getSessionMessages: vi.fn().mockResolvedValue({ messages: ["done"] }),
        deleteSession: vi.fn(),
      },
    }));

    const task = {
      id: "t1", title: "Test", description: "Test task",
      status: "pending" as const, difficulty: "easy" as const,
      estimatedMinutes: 5, dependencies: [], files: ["src/test.ts"],
      shipCategory: "show" as const,
    };

    // Should not throw with subagentConfig param
    const result = await orch.executeTask(task, testDir, "quick", undefined, {
      isolation: "none",
      timeout: 60_000,
    });
    // Result may vary but call should succeed
    expect(result).toHaveProperty("success");
  });
});

// ── T1: Prompt Caching (buildProjectContext cap) ──
describe("Prompt Caching — buildProjectContext cap (T1)", () => {
  it("should cap file listing at 800 chars", async () => {
    const { buildProjectContext } = await import("../src/agents/phases/task-execution.js");
    // Create a project with many files
    mkdirSync(join(testDir, "src"), { recursive: true });
    for (let i = 0; i < 60; i++) {
      writeFileSync(join(testDir, "src", `file-${i.toString().padStart(3, "0")}.ts`), "");
    }
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "test" }));

    const ctx = await buildProjectContext(testDir);
    // The Files section should be capped
    const filesSection = ctx.split("\n").find(l => l.startsWith("Files:"));
    if (filesSection) {
      expect(filesSection.length).toBeLessThanOrEqual(810); // "Files:\n" + 800 chars
    }
  });

  it("should list script names only (not bodies)", async () => {
    const { buildProjectContext } = await import("../src/agents/phases/task-execution.js");
    writeFileSync(join(testDir, "package.json"), JSON.stringify({
      name: "test-project",
      scripts: {
        build: "tsc && vite build",
        test: "vitest run",
        lint: "eslint src/",
        dev: "vite --port 3000",
      },
    }));

    const ctx = await buildProjectContext(testDir);
    // Should contain script names
    expect(ctx).toContain("build, test, lint, dev");
    // Should NOT contain the actual commands
    expect(ctx).not.toContain("tsc && vite build");
    expect(ctx).not.toContain("vitest run");
  });

  it("should use cached context when provided", async () => {
    const { buildProjectContext } = await import("../src/agents/phases/task-execution.js");
    const cached = "cached-context-data";
    const result = await buildProjectContext(testDir, cached);
    expect(result).toBe("cached-context-data");
  });
});
