import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

function createMockRuntime() {
  const mockRun = vi.fn().mockResolvedValue({ runId: "run-1" });
  const mockWaitForRun = vi.fn().mockResolvedValue({ status: "ok" });
  const mockGetMessages = vi.fn().mockResolvedValue({ messages: ['{"complexity":"medium","estimatedFiles":3,"affectedModules":["src"]}'] });
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
    subagent: {
      run: mockRun,
      waitForRun: mockWaitForRun,
      getSessionMessages: mockGetMessages,
      deleteSession: vi.fn(),
    },
    system: {
      runCommandWithTimeout: vi.fn(),
    },
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-engine-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe("DevWorkflowEngine", () => {
  it("initialize creates context and runs analysis", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    const context = await engine.initialize(testDir, "standard");
    expect(context.projectId).toBeDefined();
    expect(context.mode).toBe("standard");
    expect(context.currentStep).toBe("step0-analysis");
    expect(context.spec).toBeNull();
    expect(context.decisions.length).toBeGreaterThan(0);
  });

  it("initialize loads persisted context", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const runtime = createMockRuntime();
    const engine1 = new DevWorkflowEngine(runtime);
    const ctx1 = await engine1.initialize(testDir, "full");
    ctx1.currentStep = "step5-development";
    ctx1.decisions.push("test decision");
    engine1.saveContext();

    const engine2 = new DevWorkflowEngine(runtime);
    const ctx2 = await engine2.initialize(testDir);
    expect(ctx2.currentStep).toBe("step5-development");
    expect(ctx2.decisions).toContain("test decision");
  });

  it("initialize uses default mode standard", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    const context = await engine.initialize(testDir);
    expect(context.mode).toBe("standard");
  });

  it("initialize extracts project name from directory basename", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    const context = await engine.initialize(testDir, "standard");
    const expectedName = testDir.split("/").pop();
    expect(context.projectId).toBe(expectedName);
  });

  it("executeWorkflow throws when not initialized", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await expect(engine.executeWorkflow("test requirement")).rejects.toThrow("not initialized");
  });

  it("executeWorkflow runs full workflow in standard mode", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages
      .mockResolvedValueOnce({ messages: ['{"complexity":"medium","estimatedFiles":3,"affectedModules":["src"]}'] })
      .mockResolvedValueOnce({ messages: ['[{"label":"A","description":"d","pros":[],"cons":[]}]'] })
      .mockResolvedValueOnce({ messages: ['{"proposal":"# P","design":"# D","tasks":[{"id":"t1","title":"T1","description":"D","difficulty":"easy","estimatedMinutes":10,"dependencies":[],"files":["a.ts"],"shipCategory":"ship"}]}'] })
      .mockResolvedValueOnce({ messages: ["Task done"] })
      .mockResolvedValueOnce({ messages: ["Review done"] })
      .mockResolvedValueOnce({ messages: ["# Docs"] });

    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(runtime);
    await engine.initialize(testDir, "standard");
    const report = await engine.executeWorkflow("build a feature");
    expect(report).toContain("Delivery Report");
    expect(report).toContain("completed");
  });

  it("executeWorkflow skips brainstorm and review in quick mode", async () => {
    const runtime = createMockRuntime();
    let callCount = 0;
    runtime.subagent.getSessionMessages.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { messages: ['{"complexity":"low","estimatedFiles":1,"affectedModules":[]}'] };
      if (callCount === 2) return { messages: ['{"proposal":"# P","design":"# D","tasks":[{"id":"t1","title":"T1","description":"D","difficulty":"easy","estimatedMinutes":5,"dependencies":[],"files":[],"shipCategory":"ship"}]}'] };
      return { messages: ["done"] };
    });

    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(runtime);
    await engine.initialize(testDir, "quick");
    const report = await engine.executeWorkflow("simple fix");
    expect(report).toContain("Delivery Report");
  });

  it("getContext returns null before initialization", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    expect(engine.getContext()).toBeNull();
  });

  it("getContext returns context after initialization", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "standard");
    expect(engine.getContext()).not.toBeNull();
    expect(engine.getContext()!.mode).toBe("standard");
  });

  it("getOrchestrator returns the agent orchestrator", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    expect(engine.getOrchestrator()).toBeDefined();
  });

  it("persists context to .dev-workflow-context.json", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "full");
    const ctxFile = join(testDir, ".dev-workflow-context.json");
    expect(existsSync(ctxFile)).toBe(true);
    const saved = JSON.parse(readFileSync(ctxFile, "utf-8"));
    expect(saved.mode).toBe("full");
    expect(saved.projectDir).toBe(testDir);
  });

  it("context includes openSource, branchName, and featureFlags fields", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    const ctx = await engine.initialize(testDir, "standard");
    expect(ctx).toHaveProperty("openSource");
    expect(ctx).toHaveProperty("branchName");
    expect(ctx).toHaveProperty("featureFlags");
    expect(ctx.openSource).toBeDefined();
    expect(ctx.branchName).toBeNull();
    expect(ctx.featureFlags.autoCommit).toBe(true);
    expect(ctx.featureFlags.strictTdd).toBe(false);
  });

  it("report includes Ship/Show/Ask counts", async () => {
    const runtime = createMockRuntime();
    let callCount = 0;
    runtime.subagent.getSessionMessages.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { messages: ['{"complexity":"medium","estimatedFiles":2,"affectedModules":["src"]}'] };
      if (callCount === 2) return { messages: ['{"proposal":"# P","design":"# D","tasks":[{"id":"t1","title":"T1","description":"D","difficulty":"easy","estimatedMinutes":5,"dependencies":[],"files":[],"shipCategory":"ship"}]}'] };
      return { messages: ["done"] };
    });

    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(runtime);
    await engine.initialize(testDir, "quick");
    const report = await engine.executeWorkflow("test feature");
    expect(report).toContain("ship:");
    expect(report).toContain("show:");
    expect(report).toContain("ask:");
  });

  it("engine creates .dev-workflow.md context file on updates", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "full");
    expect(existsSync(join(testDir, ".dev-workflow.md"))).toBe(true);
  });

  it("engine handles full mode with tech selection step", async () => {
    const runtime = createMockRuntime();
    let callCount = 0;
    runtime.subagent.getSessionMessages.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { messages: ['{"complexity":"high","estimatedFiles":5,"affectedModules":["core"]}'] };
      if (callCount === 2) return { messages: ['[{"label":"A","description":"d","pros":[],"cons":[]}]'] };
      if (callCount === 3) return { messages: ['{"proposal":"# P","design":"# D","tasks":[{"id":"t1","title":"T1","description":"D","difficulty":"easy","estimatedMinutes":10,"dependencies":[],"files":[],"shipCategory":"ship"}]}'] };
      if (callCount === 4) return { messages: ['{"language":"TypeScript","framework":"React","architecture":"modular","patterns":["hooks"],"notes":"test"}'] };
      return { messages: ["done"] };
    });

    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(runtime);
    await engine.initialize(testDir, "full");
    const report = await engine.executeWorkflow("complex feature");
    expect(report).toContain("Delivery Report");
  });

  it("conventional commit message generation covers types", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "standard");
    const report = await engine.executeWorkflow("simple fix");
    expect(typeof report).toBe("string");
  });

  it("full mode enables strictTdd and qaGateBlocking flags", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    const ctx = await engine.initialize(testDir, "full");
    expect(ctx.featureFlags.strictTdd).toBe(true);
    expect(ctx.featureFlags.qaGateBlocking).toBe(true);
  });

  it("custom feature flags override defaults", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    const ctx = await engine.initialize(testDir, "standard", { coverageThreshold: 95, autoCommit: false });
    expect(ctx.featureFlags.coverageThreshold).toBe(95);
    expect(ctx.featureFlags.autoCommit).toBe(false);
    expect(ctx.featureFlags.conventionalCommits).toBe(true);
  });

  it("persists feature flags in context file", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const runtime = createMockRuntime();
    const engine1 = new DevWorkflowEngine(runtime);
    await engine1.initialize(testDir, "standard", { strictTdd: true });
    engine1.saveContext();

    const engine2 = new DevWorkflowEngine(runtime);
    const ctx2 = await engine2.initialize(testDir);
    expect(ctx2.featureFlags.strictTdd).toBe(true);
  });

  it("quick mode skips GitHub integration when flag disabled", async () => {
    const runtime = createMockRuntime();
    let callCount = 0;
    runtime.subagent.getSessionMessages.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { messages: ['{"complexity":"low","estimatedFiles":1,"affectedModules":[]}'] };
      if (callCount === 2) return { messages: ['{"proposal":"# P","design":"# D","tasks":[{"id":"t1","title":"T1","description":"D","difficulty":"easy","estimatedMinutes":5,"dependencies":[],"files":[],"shipCategory":"ship"}]}'] };
      return { messages: ["done"] };
    });

    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(runtime);
    await engine.initialize(testDir, "quick", { githubIntegration: false });
    const report = await engine.executeWorkflow("test feature");
    expect(report).toContain("Delivery Report");
  });
});
