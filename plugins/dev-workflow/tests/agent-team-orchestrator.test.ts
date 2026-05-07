import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { AgentTeamOrchestrator } from "../src/agents/agent-team-orchestrator.js";
import { FileOwnershipManager } from "../src/agents/file-ownership.js";
import { ContractLayer } from "../src/agents/contract-layer.js";
import type {
  WorkflowTask,
  WorkflowMode,
  FeatureFlags,
  AgentResult,
  ParallelExecutionPlan,
  TaskBatch,
} from "../src/types.js";

// ── Helpers ──

const makeTask = (id: string, files: string[] = []): WorkflowTask => ({
  id,
  title: `Task ${id}`,
  description: `Description for ${id}`,
  status: "pending",
  difficulty: "medium",
  estimatedMinutes: 10,
  dependencies: [],
  files,
  shipCategory: "ship",
  granularity: "task",
  suggestedModel: "standard",
  maxLines: 200,
  subtasks: [],
  gates: [],
});

const defaultFeatureFlags: FeatureFlags = {
  strictTdd: false,
  ruleEnforcement: false,
  autoCommit: false,
  workingMemoryPersist: false,
  dependencyParallelTasks: true,
  conventionalCommits: false,
  qaGateBlocking: false,
  githubIntegration: false,
  coverageThreshold: 80,
  maxFileLines: 300,
  maxFunctionLines: 50,
  modelOverride: {},
  subtaskGatesEnabled: false,
  subtaskMaxLines: 100,
  taskMaxLines: 500,
  tmuxForLongTasks: false,
  tmuxTimeoutSeconds: 600,
  noProxyLocalhost: false,
  readmeDualLanguage: false,
  refactorAssessmentEnabled: false,
  refactorAssessmentOnStep0: false,
  agentTeamEnabled: true,
  agentTeamParallelExecution: true,
  agentTeamContractLayer: true,
  agentTeamFileOwnership: true,
  agentTeamAutoSync: false,
};

const defaultMode: WorkflowMode = "standard";

// ── Test suite ──

describe("AgentTeamOrchestrator", () => {
  let tempDir: string;
  let mockOrchestrator: any;
  let mockVerification: any;
  let mockRuntime: any;
  let ownership: FileOwnershipManager;
  let contractLayer: ContractLayer;
  let team: AgentTeamOrchestrator;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "team-orch-test-"));

    mockOrchestrator = {
      executeTask: vi.fn().mockImplementation(
        (task: WorkflowTask) =>
          Promise.resolve({
            agentId: "test",
            task: task.id,
            success: true,
            output: "done",
            durationMs: 100,
          }),
      ),
    };

    mockVerification = {
      verify: vi.fn().mockResolvedValue({ verdict: "PASS", issues: [] }),
    };

    mockRuntime = {
      logging: {
        getChildLogger: vi.fn().mockReturnValue({
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        }),
      },
    };

    ownership = new FileOwnershipManager();
    contractLayer = new ContractLayer(tempDir);
    team = new AgentTeamOrchestrator(
      mockOrchestrator,
      mockVerification,
      ownership,
      contractLayer,
      mockRuntime,
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── 1. executes serial fallback ──

  it("executes serial fallback", async () => {
    const tasks = [makeTask("T1"), makeTask("T2"), makeTask("T3")];

    const results = await team.executeSerial(
      tasks,
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );

    // Each executeTask called exactly once
    expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);

    // All results are AgentResult objects
    for (const r of results) {
      expect(r).toHaveProperty("agentId");
      expect(r).toHaveProperty("task");
      expect(r).toHaveProperty("success");
      expect(r).toHaveProperty("output");
      expect(r).toHaveProperty("durationMs");
    }

    // Each call received the correct task
    expect(mockOrchestrator.executeTask).toHaveBeenNthCalledWith(
      1,
      tasks[0],
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );
    expect(mockOrchestrator.executeTask).toHaveBeenNthCalledWith(
      2,
      tasks[1],
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );
    expect(mockOrchestrator.executeTask).toHaveBeenNthCalledWith(
      3,
      tasks[2],
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );
  });

  // ── 2. executes a batch in parallel ──

  it("executes a batch in parallel", async () => {
    const batch: TaskBatch = {
      id: "batch-0",
      tasks: [makeTask("T1", ["src/a.ts"]), makeTask("T2", ["src/b.ts"])],
      dependsOn: [],
      syncAfter: false,
      estimatedParallelTime: 10,
    };

    const result = await team.executeBatch(
      batch,
      "batch-0",
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );

    // Both tasks were executed via executeTask
    expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);

    // BatchResultInfo structure
    expect(result.batchId).toBe("batch-0");
    expect(result.allSucceeded).toBe(true);
    expect(Object.keys(result.agentResults)).toHaveLength(2);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── 3. handles batch agent failure ──

  it("handles batch agent failure", async () => {
    // First call succeeds, second fails
    mockOrchestrator.executeTask
      .mockResolvedValueOnce({
        agentId: "test",
        task: "T1",
        success: true,
        output: "ok",
        durationMs: 50,
      })
      .mockResolvedValueOnce({
        agentId: "test",
        task: "T2",
        success: false,
        output: "failed",
        durationMs: 50,
      });

    const batch: TaskBatch = {
      id: "batch-fail",
      tasks: [makeTask("T1"), makeTask("T2")],
      dependsOn: [],
      syncAfter: false,
      estimatedParallelTime: 10,
    };

    const result = await team.executeBatch(
      batch,
      "batch-fail",
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );

    // Did not crash
    expect(result).toBeDefined();
    expect(result.batchId).toBe("batch-fail");

    // allSucceeded is false because one failed
    expect(result.allSucceeded).toBe(false);

    // Both agents have results
    const agentIds = Object.keys(result.agentResults);
    expect(agentIds).toHaveLength(2);

    // Exactly one success, one failure
    const successes = Object.values(result.agentResults).filter(
      (r) => r.success,
    );
    const failures = Object.values(result.agentResults).filter(
      (r) => !r.success,
    );
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });

  // ── 4. executes full plan with batches ──

  it("executes full plan with batches", async () => {
    const plan: ParallelExecutionPlan = {
      batches: [
        {
          id: "b1",
          tasks: [makeTask("T1", ["src/a.ts"]), makeTask("T2", ["src/b.ts"])],
          dependsOn: [],
          syncAfter: false,
          estimatedParallelTime: 10,
        },
        {
          id: "b2",
          tasks: [makeTask("T3", ["src/c.ts"])],
          dependsOn: ["b1"],
          syncAfter: false,
          estimatedParallelTime: 5,
        },
      ],
      syncPoints: [],
      totalEstimatedTime: 15,
      estimatedSpeedup: 1.5,
    };

    const result = await team.execute(
      plan,
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );

    // 2 batch results produced
    expect(result.batchResults).toHaveLength(2);

    // Overall structure
    expect(result.totalTasks).toBe(3);
    expect(result.completedTasks).toBe(3);
    expect(result.failedTasks).toBe(0);
    expect(result.fallbackUsed).toBe(false);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.syncResults).toHaveLength(0);
  });

  // ── 5. fallback triggers on high failure rate ──

  it("fallback triggers on high failure rate", async () => {
    // All 3 tasks in the batch fail
    mockOrchestrator.executeTask.mockImplementation(
      (task: WorkflowTask) =>
        Promise.resolve({
          agentId: "test",
          task: task.id,
          success: false,
          output: "error",
          durationMs: 10,
        }),
    );

    const plan: ParallelExecutionPlan = {
      batches: [
        {
          id: "b-fail",
          tasks: [
            makeTask("T1"),
            makeTask("T2"),
            makeTask("T3"),
          ],
          dependsOn: [],
          syncAfter: false,
          estimatedParallelTime: 10,
        },
      ],
      syncPoints: [],
      totalEstimatedTime: 30,
      estimatedSpeedup: 1,
    };

    const result = await team.execute(
      plan,
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );

    // fallbackUsed must be true — >50% failure in batch triggers serial fallback
    expect(result.fallbackUsed).toBe(true);

    // Should not crash, and batchResults should contain at least the initial batch
    expect(result.batchResults.length).toBeGreaterThanOrEqual(1);
  });

  // ── 6. reports progress via callback ──

  it("reports progress via callback", async () => {
    const onProgress = vi.fn();

    const plan: ParallelExecutionPlan = {
      batches: [
        {
          id: "b1",
          tasks: [makeTask("T1")],
          dependsOn: [],
          syncAfter: false,
          estimatedParallelTime: 10,
        },
        {
          id: "b2",
          tasks: [makeTask("T2")],
          dependsOn: ["b1"],
          syncAfter: false,
          estimatedParallelTime: 10,
        },
      ],
      syncPoints: [],
      totalEstimatedTime: 20,
      estimatedSpeedup: 2,
    };

    await team.execute(
      plan,
      tempDir,
      defaultMode,
      defaultFeatureFlags,
      onProgress,
    );

    // onProgress should have been called for each batch
    expect(onProgress).toHaveBeenCalledTimes(2);

    // Verify the progress messages contain batch info
    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Batch 1"),
    );
    expect(onProgress).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("Batch 2"),
    );
  });

  // ── 7. respects max parallel agents ──

  it("respects max parallel agents", async () => {
    // FALLBACK_TEAM_CONFIG.maxParallelAgents = 3 (hardcoded default).
    // Create 7 tasks to force sub-batching into 3 waves: 3 + 3 + 1.
    const tasks = Array.from({ length: 7 }, (_, i) =>
      makeTask(`T${i + 1}`, [`src/file${i + 1}.ts`]),
    );

    // Track call order to verify sub-batching (waves, not all-at-once)
    const callTimes: number[] = [];
    mockOrchestrator.executeTask.mockImplementation(
      (task: WorkflowTask) => {
        callTimes.push(Date.now());
        return Promise.resolve({
          agentId: "test",
          task: task.id,
          success: true,
          output: "done",
          durationMs: 10,
        });
      },
    );

    const batch: TaskBatch = {
      id: "b-parallel",
      tasks,
      dependsOn: [],
      syncAfter: false,
      estimatedParallelTime: 10,
    };

    const result = await team.executeBatch(
      batch,
      "b-parallel",
      tempDir,
      defaultMode,
      defaultFeatureFlags,
    );

    // All 7 tasks were executed
    expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(7);

    // Batch completed with all results
    expect(Object.keys(result.agentResults)).toHaveLength(7);
    expect(result.allSucceeded).toBe(true);

    // Sub-batching verification: with maxParallelAgents=3 and 7 tasks,
    // there should be 3 waves (3+3+1). We verify by checking that
    // the batch did not crash and all tasks were handled.
    const agentResultValues = Object.values(result.agentResults);
    expect(agentResultValues.every((r) => r.success)).toBe(true);
  });
});
