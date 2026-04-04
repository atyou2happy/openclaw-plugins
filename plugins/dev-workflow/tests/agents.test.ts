import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function createMockRuntime(overrides: Record<string, any> = {}) {
  const mockRun = vi.fn().mockResolvedValue({ runId: "run-1" });
  const mockWaitForRun = vi.fn().mockResolvedValue({ status: "ok" });
  const mockGetMessages = vi.fn().mockResolvedValue({ messages: ["default response"] });
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
    ...overrides,
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

// Must import dynamically after mocks
vi.mock("openclaw/plugin-sdk/core", () => ({}));

describe("AgentOrchestrator", () => {
  async function getOrchestrator(runtimeOverrides: Record<string, any> = {}) {
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    return new AgentOrchestrator(createMockRuntime(runtimeOverrides));
  }

  it("runAnalysis detects git status", async () => {
    const orchestrator = await getOrchestrator();
    const result = await orchestrator.runAnalysis(testDir);
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("hasOpenSpec");
    expect(result).toHaveProperty("gitStatus");
    expect(result.gitStatus).toBe("not-a-git-repo");
  });

  it("runAnalysis reads package.json info", async () => {
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "test-pkg", scripts: { build: "tsc" } }));
    const orchestrator = await getOrchestrator();
    const result = await orchestrator.runAnalysis(testDir);
    expect(result.summary).toContain("test-pkg");
    expect(result.summary).toContain("build");
  });

  it("runAnalysis detects tsconfig.json", async () => {
    writeFileSync(join(testDir, "tsconfig.json"), "{}");
    const orchestrator = await getOrchestrator();
    const result = await orchestrator.runAnalysis(testDir);
    expect(result.summary).toContain("TS: true");
  });

  it("runAnalysis detects openspec directory", async () => {
    mkdirSync(join(testDir, "openspec"), { recursive: true });
    const orchestrator = await getOrchestrator();
    const result = await orchestrator.runAnalysis(testDir);
    expect(result.hasOpenSpec).toBe(true);
  });

  it("analyzeRequirement falls back on subagent failure", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.run.mockRejectedValue(new Error("subagent error"));
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const result = await orchestrator.analyzeRequirement("short req", testDir, "quick");
    expect(result).toHaveProperty("complexity");
    expect(result).toHaveProperty("estimatedFiles");
    expect(result).toHaveProperty("suggestedMode");
    expect(result).toHaveProperty("affectedModules");
  });

  it("analyzeRequirement parses LLM JSON response", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ['{"complexity":"high","estimatedFiles":10,"affectedModules":["core","api"]}'],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const result = await orchestrator.analyzeRequirement("complex feature request", testDir, "full");
    expect(result.complexity).toBe("high");
    expect(result.estimatedFiles).toBe(10);
    expect(result.suggestedMode).toBe("full");
    expect(result.affectedModules).toEqual(["core", "api"]);
  });

  it("brainstorm falls back to default options", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.run.mockRejectedValue(new Error("fail"));
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const options = await orchestrator.brainstorm("test requirement", testDir);
    expect(options).toHaveLength(3);
    expect(options[0].label).toBe("Minimal");
    expect(options[1].label).toBe("Standard");
    expect(options[2].label).toBe("Full");
  });

  it("brainstorm parses LLM JSON array response", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ['[{"label":"Custom A","description":"Desc","pros":["p1"],"cons":["c1"]}]'],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const options = await orchestrator.brainstorm("test", testDir);
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe("Custom A");
  });

  it("defineSpec falls back to default spec", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.run.mockRejectedValue(new Error("fail"));
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const spec = await orchestrator.defineSpec("test requirement", testDir, []);
    expect(spec.proposal).toContain("test requirement");
    expect(spec.tasks.length).toBeGreaterThan(0);
    expect(spec.tasks[0].status).toBe("pending");
  });

  it("defineSpec parses LLM JSON response with tasks", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ['{"proposal":"# Prop","design":"# Design","tasks":[{"id":"t1","title":"Task1","description":"D","difficulty":"hard","estimatedMinutes":60,"dependencies":[],"files":["a.ts"],"shipCategory":"ship"}]}'],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const spec = await orchestrator.defineSpec("test", testDir, ["note1"]);
    expect(spec.proposal).toBe("# Prop");
    expect(spec.tasks).toHaveLength(1);
    expect(spec.tasks[0].id).toBe("t1");
    expect(spec.tasks[0].difficulty).toBe("hard");
  });

  it("executeTask returns AgentResult on subagent failure", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.waitForRun.mockResolvedValue({ status: "error", error: "timeout" });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const task = {
      id: "task-1", title: "Test", description: "Test task",
      status: "pending" as const, difficulty: "medium" as const,
      estimatedMinutes: 30, dependencies: [], files: ["src/test.ts"],
      shipCategory: "show" as const,
    };
    const result = await orchestrator.executeTask(task, testDir, "standard");
    expect(result.agentId).toBeDefined();
    expect(result.task).toBe("task-1");
    expect(result.success).toBe(false);
  });

  it("executeTask returns success on valid subagent response", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ["Implemented the feature successfully"],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const task = {
      id: "task-1", title: "Test", description: "Test task",
      status: "pending" as const, difficulty: "easy" as const,
      estimatedMinutes: 15, dependencies: [], files: ["src/test.ts"],
      shipCategory: "ship" as const,
    };
    const result = await orchestrator.executeTask(task, testDir, "quick");
    expect(result.success).toBe(true);
    expect(result.output).toContain("Implemented");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("runTests detects and runs test command", async () => {
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ scripts: { test: "echo test passed" } }));
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(createMockRuntime());
    const result = await orchestrator.runTests(testDir);
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("output");
  });

  it("runReview returns string", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ["Code review looks good"],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const review = await orchestrator.runReview(testDir);
    expect(typeof review).toBe("string");
  });

  it("generateDocs returns string", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ["# Generated Docs\n\nContent here"],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const spec = { proposal: "# P", design: "# D", tasks: [], updatedAt: new Date().toISOString() };
    const docs = await orchestrator.generateDocs(testDir, spec as any);
    expect(typeof docs).toBe("string");
  });

  it("generateDocs returns message when no spec", async () => {
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(createMockRuntime());
    const docs = await orchestrator.generateDocs(testDir, null);
    expect(docs).toContain("No spec");
  });

  it("selectTech falls back to default on subagent failure", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.run.mockRejectedValue(new Error("fail"));
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const tech = await orchestrator.selectTech("build something", testDir, []);
    expect(tech.language).toBe("TypeScript");
    expect(tech.framework).toBe("Node.js");
    expect(tech.architecture).toBe("modular");
    expect(tech.patterns).toContain("module");
  });

  it("selectTech parses LLM JSON response", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ['{"language":"Python","framework":"FastAPI","architecture":"microservices","patterns":["repository","cqrs"],"notes":"Good for APIs"}'],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const tech = await orchestrator.selectTech("build API", testDir, ["note"]);
    expect(tech.language).toBe("Python");
    expect(tech.framework).toBe("FastAPI");
    expect(tech.architecture).toBe("microservices");
    expect(tech.patterns).toEqual(["repository", "cqrs"]);
  });

  it("executeTask saves working memory after success", async () => {
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({
      messages: ["Done implementing feature"],
    });
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const orchestrator = new AgentOrchestrator(runtime);
    const task = {
      id: "task-mem", title: "Memory Test", description: "Test memory",
      status: "pending" as const, difficulty: "easy" as const,
      estimatedMinutes: 10, dependencies: [], files: ["src/a.ts"],
      shipCategory: "ship" as const,
    };
    await orchestrator.executeTask(task, testDir, "standard");
    const { existsSync, readFileSync } = await import("fs");
    const memPath = join(testDir, "docs", "plans", "task-mem-context.md");
    expect(existsSync(memPath)).toBe(true);
    const content = readFileSync(memPath, "utf-8");
    expect(content).toContain("task-mem");
  });

  it("executeTask loads working memory for subsequent runs", async () => {
    const { writeFileSync } = await import("fs");
    const { AgentOrchestrator } = await import("../src/agents/index.js");
    const plansDir = join(testDir, "docs", "plans");
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(join(plansDir, "task-wm-context.md"), "Previous context info");
    const runtime = createMockRuntime();
    runtime.subagent.getSessionMessages.mockResolvedValue({ messages: ["OK"] });
    const orchestrator = new AgentOrchestrator(runtime);
    const task = {
      id: "task-wm", title: "WM Test", description: "WM task",
      status: "pending" as const, difficulty: "easy" as const,
      estimatedMinutes: 10, dependencies: [], files: [],
      shipCategory: "ship" as const,
    };
    await orchestrator.executeTask(task, testDir, "standard");
    const runCalls = runtime.subagent.run.mock.calls;
    expect(runCalls.length).toBe(1);
  });
});
