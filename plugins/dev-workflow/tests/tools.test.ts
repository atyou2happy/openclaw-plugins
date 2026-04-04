import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-tools-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
  vi.resetModules();
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

async function setupEngine() {
  const mockRun = vi.fn().mockResolvedValue({ runId: "run-1" });
  const mockWaitForRun = vi.fn().mockResolvedValue({ status: "ok" });
  const mockGetMessages = vi.fn().mockResolvedValue({ messages: ['{"complexity":"medium","estimatedFiles":3,"affectedModules":["src"]}'] });
  const runtime = {
    logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
    subagent: { run: mockRun, waitForRun: mockWaitForRun, getSessionMessages: mockGetMessages, deleteSession: vi.fn() },
    system: { runCommandWithTimeout: vi.fn() },
  } as any;

  const { setDevWorkflowRuntime } = await import("../src/channel/runtime.js");
  setDevWorkflowRuntime(runtime);
  return { runtime };
}

describe("DevWorkflowTool", () => {
  it("executes workflow and returns report", async () => {
    await setupEngine();
    const { DevWorkflowTool } = await import("../src/tools/dev-workflow-tool.js");
    const tool = new DevWorkflowTool();

    expect(tool.name).toBe("dev_workflow_start");
    expect(tool.label).toBe("Start Dev Workflow");

    const specResponse = '{"proposal":"# P","design":"# D","tasks":[{"id":"t1","title":"T1","description":"D","difficulty":"easy","estimatedMinutes":5,"dependencies":[],"files":[],"shipCategory":"ship"}]}';
    const { getRuntime } = await import("../src/channel/runtime.js");
    getRuntime().subagent.getSessionMessages
      .mockResolvedValueOnce({ messages: ['{"complexity":"low","estimatedFiles":1,"affectedModules":[]}'] })
      .mockResolvedValueOnce({ messages: [specResponse] })
      .mockResolvedValueOnce({ messages: ["done"] });

    const result = await tool.execute("call-1", { requirement: "test feature", projectDir: testDir, mode: "quick" });
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Delivery Report");
    expect(result.details.success).toBe(true);
  });

  it("uses standard mode by default", async () => {
    await setupEngine();
    const { DevWorkflowTool } = await import("../src/tools/dev-workflow-tool.js");
    const tool = new DevWorkflowTool();
    const result = await tool.execute("call-2", { requirement: "test", projectDir: testDir });
    expect(result.details.context.mode).toBe("standard");
  });
});

describe("WorkflowStatusTool", () => {
  it("returns error when no active workflow", async () => {
    vi.resetModules();
    const mockRuntime = {
      logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
      subagent: { run: vi.fn(), waitForRun: vi.fn(), getSessionMessages: vi.fn(), deleteSession: vi.fn() },
      system: { runCommandWithTimeout: vi.fn() },
    } as any;
    const { setDevWorkflowRuntime } = await import("../src/channel/runtime.js");
    setDevWorkflowRuntime(mockRuntime);

    const { WorkflowStatusTool } = await import("../src/tools/workflow-status-tool.js");
    const tool = new WorkflowStatusTool();
    const result = await tool.execute("call-1", {});
    expect(result.content[0].text).toContain("No active workflow");
    expect(result.details.success).toBe(false);
  });

  it("returns status when workflow is active", async () => {
    await setupEngine();
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard");

    const { WorkflowStatusTool } = await import("../src/tools/workflow-status-tool.js");
    const tool = new WorkflowStatusTool();
    const result = await tool.execute("call-1", {});
    expect(result.details.success).toBe(true);
    expect(result.details.mode).toBe("standard");
    expect(result.content[0].text).toContain("Workflow Status");
  });
});

describe("SpecViewTool", () => {
  it("returns error when no active workflow", async () => {
    vi.resetModules();
    const mockRuntime = {
      logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
      subagent: { run: vi.fn(), waitForRun: vi.fn(), getSessionMessages: vi.fn(), deleteSession: vi.fn() },
      system: { runCommandWithTimeout: vi.fn() },
    } as any;
    const { setDevWorkflowRuntime } = await import("../src/channel/runtime.js");
    setDevWorkflowRuntime(mockRuntime);

    const { SpecViewTool } = await import("../src/tools/spec-view-tool.js");
    const tool = new SpecViewTool();
    const result = await tool.execute("call-1", {});
    expect(result.details.success).toBe(false);
  });

  it("returns proposal section", async () => {
    await setupEngine();
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard");
    engine.getContext()!.spec = {
      proposal: "# My Proposal",
      design: "# My Design",
      tasks: [{ id: "t1", title: "Task 1", description: "D", status: "pending", difficulty: "easy", estimatedMinutes: 10, dependencies: [], files: [], shipCategory: "ship" }],
      updatedAt: new Date().toISOString(),
    };

    const { SpecViewTool } = await import("../src/tools/spec-view-tool.js");
    const tool = new SpecViewTool();
    const result = await tool.execute("call-1", { section: "proposal" });
    expect(result.details.success).toBe(true);
    expect(result.content[0].text).toBe("# My Proposal");
  });

  it("returns all sections by default", async () => {
    await setupEngine();
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard");
    engine.getContext()!.spec = {
      proposal: "# Proposal",
      design: "# Design",
      tasks: [{ id: "t1", title: "T1", description: "D", status: "pending", difficulty: "easy", estimatedMinutes: 5, dependencies: [], files: [], shipCategory: "ship" }],
      updatedAt: new Date().toISOString(),
    };

    const { SpecViewTool } = await import("../src/tools/spec-view-tool.js");
    const tool = new SpecViewTool();
    const result = await tool.execute("call-1", {});
    expect(result.content[0].text).toContain("# Proposal");
    expect(result.content[0].text).toContain("# Design");
    expect(result.content[0].text).toContain("T1");
  });
});

describe("TaskExecuteTool", () => {
  it("returns error when no active workflow", async () => {
    vi.resetModules();
    const mockRuntime = {
      logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
      subagent: { run: vi.fn(), waitForRun: vi.fn(), getSessionMessages: vi.fn(), deleteSession: vi.fn() },
      system: { runCommandWithTimeout: vi.fn() },
    } as any;
    const { setDevWorkflowRuntime } = await import("../src/channel/runtime.js");
    setDevWorkflowRuntime(mockRuntime);

    const { TaskExecuteTool } = await import("../src/tools/task-execute-tool.js");
    const tool = new TaskExecuteTool();
    const result = await tool.execute("call-1", { taskId: "task-1" });
    expect(result.details.success).toBe(false);
  });

  it("returns error for unknown task ID", async () => {
    await setupEngine();
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard");
    engine.getContext()!.spec = {
      proposal: "# P",
      design: "# D",
      tasks: [{ id: "task-1", title: "T1", description: "D", status: "pending", difficulty: "easy", estimatedMinutes: 5, dependencies: [], files: [], shipCategory: "ship" }],
      updatedAt: new Date().toISOString(),
    };

    const { TaskExecuteTool } = await import("../src/tools/task-execute-tool.js");
    const tool = new TaskExecuteTool();
    const result = await tool.execute("call-1", { taskId: "nonexistent" });
    expect(result.details.success).toBe(false);
    expect(result.content[0].text).toContain("not found");
  });
});

describe("QAGateTool", () => {
  it("returns error when no active workflow", async () => {
    vi.resetModules();
    const mockRuntime = {
      logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
      subagent: { run: vi.fn(), waitForRun: vi.fn(), getSessionMessages: vi.fn(), deleteSession: vi.fn() },
      system: { runCommandWithTimeout: vi.fn() },
    } as any;
    const { setDevWorkflowRuntime } = await import("../src/channel/runtime.js");
    setDevWorkflowRuntime(mockRuntime);

    const { QAGateTool } = await import("../src/tools/qa-gate-tool.js");
    const tool = new QAGateTool();
    const result = await tool.execute("call-1", { projectDir: testDir });
    expect(result.details.success).toBe(false);
  });

  it("runs all checks and returns results", async () => {
    await setupEngine();
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard");

    writeFileSync(join(testDir, "README.md"), "# Test Project\n\nThis is a test project with enough content to pass the docs check.");

    const { QAGateTool } = await import("../src/tools/qa-gate-tool.js");
    const tool = new QAGateTool();
    const result = await tool.execute("call-1", { projectDir: testDir, checks: ["docs", "typecheck"] });
    expect(result.details.checks).toHaveLength(2);
    expect(result.details.checks[0].name).toBe("docs");
  });

  it("runs rules check and detects violations", async () => {
    await setupEngine();
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard");

    writeFileSync(join(testDir, "sample.ts"), `const x = 5;\nconsole.log("hello");\ndebugger;\nconst pw = "secret123";\n`);

    const { QAGateTool } = await import("../src/tools/qa-gate-tool.js");
    const tool = new QAGateTool();
    const result = await tool.execute("call-1", { projectDir: testDir, checks: ["rules"] });
    expect(result.details.checks).toHaveLength(1);
    expect(result.details.checks[0].name).toBe("rules");
    expect(result.details.checks[0].output).toContain("console.log");
  });

  it("rules check passes when rule enforcement disabled", async () => {
    await setupEngine();
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard", { ruleEnforcement: false });

    writeFileSync(join(testDir, "sample.ts"), `console.log("hello");\n`);

    const { QAGateTool } = await import("../src/tools/qa-gate-tool.js");
    const tool = new QAGateTool();
    const result = await tool.execute("call-1", { projectDir: testDir, checks: ["rules"] });
    expect(result.details.checks[0].passed).toBe(true);
    expect(result.details.checks[0].output).toContain("disabled");
  });

  it("default checks include rules", async () => {
    await setupEngine();
    const { getEngine } = await import("../src/channel/runtime.js");
    const engine = getEngine();
    await engine.initialize(testDir, "standard");

    writeFileSync(join(testDir, "README.md"), "# Test Project with enough content for docs check.\n");

    const { QAGateTool } = await import("../src/tools/qa-gate-tool.js");
    const tool = new QAGateTool();
    const result = await tool.execute("call-1", { projectDir: testDir });
    const checkNames = result.details.checks.map((c: any) => c.name);
    expect(checkNames).toContain("rules");
    expect(checkNames).toHaveLength(10);
  });
});
