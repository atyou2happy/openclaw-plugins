/**
 * T12: Engine executeAllTasks feature flag routing integration tests
 *
 * Tests that DevWorkflowEngine.executeAllTasks() correctly routes between
 * serial execution (executeSerialTasks) and parallel agent team execution
 * (executeWithAgentTeam) based on the agentTeamEnabled feature flag.
 *
 * Strategy: Spy on private prototype methods to verify routing behavior
 * without actually running heavy agent/orchestrator logic.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { FeatureFlags, WorkflowTask } from "../src/types.js";

// ── Mock external dependencies before importing Engine ──

vi.mock("openclaw/plugin-sdk/core", () => ({}));

vi.mock("../src/agents/agent-orchestrator.js", () => ({
  AgentOrchestrator: vi.fn().mockImplementation(() => ({
    runAnalysis: vi.fn().mockResolvedValue({ summary: "mock", hasOpenSpec: false }),
    executeTask: vi.fn().mockResolvedValue({ success: true, output: "ok" }),
  })),
}));

vi.mock("../src/agents/verification-agent.js", () => ({
  VerificationAgent: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../src/agents/task-dependency-graph.js", () => ({
  TaskDependencyGraph: vi.fn().mockImplementation(() => ({
    generateExecutionPlan: vi.fn().mockReturnValue({
      batches: [],
      syncPoints: [],
      estimatedSpeedup: 1,
    }),
  })),
}));

vi.mock("../src/agents/file-ownership.js", () => ({
  FileOwnershipManager: vi.fn().mockImplementation(() => ({
    getSnapshot: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock("../src/agents/contract-layer.js", () => ({
  ContractLayer: vi.fn().mockImplementation(() => ({
    getContracts: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock("../src/agents/agent-team-orchestrator.js", () => ({
  AgentTeamOrchestrator: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      batchResults: [],
      syncResults: [],
      completedTasks: 0,
      totalTasks: 0,
      estimatedSpeedup: 1,
      fallbackUsed: false,
    }),
  })),
}));

vi.mock("../src/handover/index.js", () => ({
  HandoverManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
  })),
}));

vi.mock("../src/bootstrap/index.js", () => ({
  BootstrapManager: vi.fn().mockImplementation(() => ({
    bootstrap: vi.fn().mockResolvedValue({ checks: [] }),
  })),
}));

vi.mock("../src/memdir/index.js", () => ({
  MemdirManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    updateAging: vi.fn(),
    recall: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../src/feature-flags/index.js", () => ({
  FeatureFlagManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../src/permissions/index.js", () => ({
  PermissionManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../src/background-tasks/index.js", () => ({
  BackgroundTaskManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../src/working-memory/index.js", () => ({
  WorkingMemoryManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
  })),
}));

vi.mock("../src/directory-templates/index.js", () => ({
  DirectoryTemplateManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../src/tools/refactor-assessment-tool.js", () => ({
  RefactorAssessmentTool: vi.fn().mockImplementation(() => ({
    quickAssessment: vi.fn().mockResolvedValue({
      score: 80, healthLevel: "healthy", recommendations: [],
    }),
  })),
}));

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual };
});

// ── Helpers ──

const makeTask = (id: string): WorkflowTask => ({
  id,
  title: `Task ${id}`,
  description: `Desc ${id}`,
  status: "pending",
  difficulty: "medium",
  estimatedMinutes: 10,
  dependencies: [],
  files: [],
  shipCategory: "ship",
  granularity: "task",
  suggestedModel: "standard",
  maxLines: 200,
  subtasks: [],
  gates: [],
});

const BASE_FLAGS: FeatureFlags = {
  strictTdd: false,
  ruleEnforcement: true,
  autoCommit: true,
  workingMemoryPersist: true,
  dependencyParallelTasks: false,
  conventionalCommits: true,
  qaGateBlocking: false,
  githubIntegration: false,
  coverageThreshold: 80,
  maxFileLines: 500,
  maxFunctionLines: 50,
  modelOverride: {},
  subtaskGatesEnabled: false,
  subtaskMaxLines: 100,
  taskMaxLines: 200,
  tmuxForLongTasks: false,
  tmuxTimeoutSeconds: 300,
  noProxyLocalhost: false,
  readmeDualLanguage: false,
  refactorAssessmentEnabled: true,
  refactorAssessmentOnStep0: false,
  agentTeamEnabled: false,
  agentTeamParallelExecution: false,
  agentTeamContractLayer: false,
  agentTeamFileOwnership: false,
  agentTeamAutoSync: false,
};

function createMockRuntime() {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
    subagent: {
      run: vi.fn().mockResolvedValue({ runId: "run-1" }),
      waitForRun: vi.fn().mockResolvedValue({ status: "ok" }),
      getSessionMessages: vi.fn().mockResolvedValue({ messages: [] }),
      deleteSession: vi.fn(),
    },
    system: {
      runCommandWithTimeout: vi.fn(),
    },
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-engine-team-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

// ── Tests ──

describe("DevWorkflowEngine executeAllTasks feature flag routing", () => {
  it("routes to serial when agentTeamEnabled is false", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime()) as any;

    // Stub persistContext to avoid disk writes
    vi.spyOn(engine, "persistContext").mockImplementation(() => {});

    // Set up internal context with agentTeamEnabled=false and 2 pending tasks
    engine.context = {
      projectId: "test",
      projectDir: testDir,
      mode: "standard",
      currentStep: "step7-development",
      spec: {
        proposal: "test",
        design: "test",
        tasks: [makeTask("t1"), makeTask("t2")],
        updatedAt: new Date().toISOString(),
      },
      activeTaskIndex: 0,
      brainstormNotes: [],
      decisions: [],
      trajectory: [],
      qaGateResults: [],
      startedAt: new Date().toISOString(),
      openSource: null,
      branchName: null,
      featureFlags: { ...BASE_FLAGS, agentTeamEnabled: false },
    };

    // Spy on the two routing targets
    const serialSpy = vi.spyOn(engine, "executeSerialTasks").mockImplementation(async () => {});
    const teamSpy = vi.spyOn(engine, "executeWithAgentTeam").mockImplementation(async () => {});

    await engine.executeAllTasks();

    expect(serialSpy).toHaveBeenCalledTimes(1);
    expect(teamSpy).not.toHaveBeenCalled();
  });

  it("routes to serial when only 1 task (even with agentTeamEnabled=true)", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime()) as any;

    vi.spyOn(engine, "persistContext").mockImplementation(() => {});

    engine.context = {
      projectId: "test",
      projectDir: testDir,
      mode: "standard",
      currentStep: "step7-development",
      spec: {
        proposal: "test",
        design: "test",
        tasks: [makeTask("t1")],
        updatedAt: new Date().toISOString(),
      },
      activeTaskIndex: 0,
      brainstormNotes: [],
      decisions: [],
      trajectory: [],
      qaGateResults: [],
      startedAt: new Date().toISOString(),
      openSource: null,
      branchName: null,
      featureFlags: { ...BASE_FLAGS, agentTeamEnabled: true },
    };

    const serialSpy = vi.spyOn(engine, "executeSerialTasks").mockImplementation(async () => {});
    const teamSpy = vi.spyOn(engine, "executeWithAgentTeam").mockImplementation(async () => {});

    await engine.executeAllTasks();

    expect(serialSpy).toHaveBeenCalledTimes(1);
    expect(teamSpy).not.toHaveBeenCalled();
  });

  it("routes to agent team when enabled and multiple tasks", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime()) as any;

    vi.spyOn(engine, "persistContext").mockImplementation(() => {});

    engine.context = {
      projectId: "test",
      projectDir: testDir,
      mode: "standard",
      currentStep: "step7-development",
      spec: {
        proposal: "test",
        design: "test",
        tasks: [makeTask("t1"), makeTask("t2")],
        updatedAt: new Date().toISOString(),
      },
      activeTaskIndex: 0,
      brainstormNotes: [],
      decisions: [],
      trajectory: [],
      qaGateResults: [],
      startedAt: new Date().toISOString(),
      openSource: null,
      branchName: null,
      featureFlags: { ...BASE_FLAGS, agentTeamEnabled: true },
    };

    const serialSpy = vi.spyOn(engine, "executeSerialTasks").mockImplementation(async () => {});
    const teamSpy = vi.spyOn(engine, "executeWithAgentTeam").mockImplementation(async () => {});

    await engine.executeAllTasks();

    expect(teamSpy).toHaveBeenCalledTimes(1);
    expect(serialSpy).not.toHaveBeenCalled();
  });

  it("falls back to serial on team execution failure", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const { AgentTeamOrchestrator } = await import("../src/agents/agent-team-orchestrator.js");

    // Make AgentTeamOrchestrator throw when execute() is called
    const mockExecute = vi.fn().mockRejectedValue(new Error("Team execution failed"));
    vi.mocked(AgentTeamOrchestrator).mockImplementation(() => ({
      execute: mockExecute,
    }) as any);

    const engine = new DevWorkflowEngine(createMockRuntime()) as any;

    vi.spyOn(engine, "persistContext").mockImplementation(() => {});

    const tasks = [makeTask("t1"), makeTask("t2")];

    engine.context = {
      projectId: "test",
      projectDir: testDir,
      mode: "standard",
      currentStep: "step7-development",
      spec: {
        proposal: "test",
        design: "test",
        tasks,
        updatedAt: new Date().toISOString(),
      },
      activeTaskIndex: 0,
      brainstormNotes: [],
      decisions: [],
      trajectory: [],
      qaGateResults: [],
      startedAt: new Date().toISOString(),
      openSource: null,
      branchName: null,
      featureFlags: { ...BASE_FLAGS, agentTeamEnabled: true },
    };

    // Only spy on executeSerialTasks — let executeWithAgentTeam run real code
    // so its internal try-catch fallback logic is exercised
    const serialSpy = vi.spyOn(engine, "executeSerialTasks").mockImplementation(async () => {});

    await engine.executeAllTasks();

    // Verify fallback: executeWithAgentTeam tried, caught error, then called executeSerialTasks
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(serialSpy).toHaveBeenCalledTimes(1);

    // Verify the decisions log records the fallback
    expect(engine.context.decisions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Agent Team failed"),
      ])
    );
  });
});
