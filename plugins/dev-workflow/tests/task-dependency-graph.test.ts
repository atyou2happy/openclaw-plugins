import { describe, it, expect } from "vitest";
import { TaskDependencyGraph } from "../src/agents/task-dependency-graph.js";
import type { WorkflowTask } from "../src/types.js";

// ── Helper ──

const makeTask = (
  id: string,
  deps: string[] = [],
  files: string[] = [],
  estMin = 10,
): WorkflowTask => ({
  id,
  title: `Task ${id}`,
  description: `Description for ${id}`,
  status: "pending",
  difficulty: "medium",
  estimatedMinutes: estMin,
  dependencies: deps,
  files,
  shipCategory: "ship",
  granularity: "task",
  suggestedModel: "standard",
  maxLines: 200,
  subtasks: [],
  gates: [],
});

describe("TaskDependencyGraph", () => {
  const graph = new TaskDependencyGraph();

  // ── 1. builds graph from tasks ──
  it("builds graph from tasks", () => {
    // A is independent, B depends on A, C depends on A
    const tasks = [
      makeTask("A"),
      makeTask("B", ["A"]),
      makeTask("C", ["A"]),
    ];

    const nodes = graph.buildGraph(tasks);
    const nodeMap = new Map(nodes.map((n) => [n.task.id, n]));

    // 3 nodes total
    expect(nodes).toHaveLength(3);

    // A has inDegree 0 (independent)
    expect(nodeMap.get("A")!.inDegree).toBe(0);
    // B has inDegree 1 (depends on A)
    expect(nodeMap.get("B")!.inDegree).toBe(1);
    // C has inDegree 1 (depends on A)
    expect(nodeMap.get("C")!.inDegree).toBe(1);

    // A's dependents should include B and C
    const aDependents = nodeMap.get("A")!.dependents;
    expect(aDependents).toContain("B");
    expect(aDependents).toContain("C");
  });

  // ── 2. detects no cycles in valid tasks ──
  it("detects no cycles in valid tasks", () => {
    const tasks = [
      makeTask("A"),
      makeTask("B", ["A"]),
      makeTask("C", ["B"]),
    ];

    const cycles = graph.detectCycles(tasks);
    expect(cycles).toEqual([]);
  });

  // ── 3. detects circular dependencies ──
  it("detects circular dependencies", () => {
    // A → B → C → A cycle
    const tasks = [
      makeTask("A", ["C"]),
      makeTask("B", ["A"]),
      makeTask("C", ["B"]),
    ];

    const cycles = graph.detectCycles(tasks);
    expect(cycles.length).toBeGreaterThan(0);
  });

  // ── 4. generates execution plan with batches ──
  it("generates execution plan with batches", () => {
    // A independent, B depends on A, C independent, D depends on B and C
    const tasks = [
      makeTask("A"),
      makeTask("B", ["A"]),
      makeTask("C"),
      makeTask("D", ["B", "C"]),
    ];

    const plan = graph.generateExecutionPlan(tasks);

    // Batch 1: A + C (parallel, both independent)
    // Batch 2: B (depends on A)
    // Batch 3: D (depends on B + C)
    expect(plan.batches).toHaveLength(3);

    const batch1Ids = plan.batches[0].tasks.map((t) => t.id).sort();
    expect(batch1Ids).toEqual(["A", "C"]);

    const batch2Ids = plan.batches[1].tasks.map((t) => t.id);
    expect(batch2Ids).toEqual(["B"]);

    const batch3Ids = plan.batches[2].tasks.map((t) => t.id);
    expect(batch3Ids).toEqual(["D"]);
  });

  // ── 5. calculates estimated speedup ──
  it("calculates estimated speedup", () => {
    // A=10min, B=20min, C=30min — A independent, B depends on A, C depends on A
    const tasks = [
      makeTask("A", [], [], 10),
      makeTask("B", ["A"], [], 20),
      makeTask("C", ["A"], [], 30),
    ];

    const plan = graph.generateExecutionPlan(tasks);

    // Serial time = 10 + 20 + 30 = 60
    // Parallel time:
    //   batch 1: max(10) = 10
    //   batch 2: max(20, 30) = 30
    //   total = 40
    // speedup = 60 / 40 = 1.5
    const totalSerial = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
    expect(totalSerial).toBe(60);
    expect(plan.totalEstimatedTime).toBe(40);
    expect(plan.estimatedSpeedup).toBe(1.5);
  });

  // ── 6. handles single task ──
  it("handles single task", () => {
    const tasks = [makeTask("A")];

    const plan = graph.generateExecutionPlan(tasks);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks).toHaveLength(1);
    expect(plan.batches[0].tasks[0].id).toBe("A");
  });

  // ── 7. handles empty tasks ──
  it("handles empty tasks", () => {
    const plan = graph.generateExecutionPlan([]);
    expect(plan.batches).toHaveLength(0);
    expect(plan.syncPoints).toHaveLength(0);
    expect(plan.totalEstimatedTime).toBe(0);
    expect(plan.estimatedSpeedup).toBe(1); // no parallel work, speedup defaults to 1
  });

  // ── 8. handles all independent tasks ──
  it("handles all independent tasks", () => {
    const tasks = [
      makeTask("A"),
      makeTask("B"),
      makeTask("C"),
      makeTask("D"),
      makeTask("E"),
    ];

    const plan = graph.generateExecutionPlan(tasks);
    // All 5 tasks are independent → 1 batch
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].tasks).toHaveLength(5);
  });

  // ── 9. inserts sync points ──
  it("inserts sync points", () => {
    // Build a chain of 6 tasks: A → B → C → D → E → F
    // This produces 6 batches.
    // Default syncConfig: syncAfterBatches = 2, syncAfterTasks = 5
    // With syncAfterBatches=2, sync after batch 2, 4, 6
    const tasks = [
      makeTask("A"),
      makeTask("B", ["A"]),
      makeTask("C", ["B"]),
      makeTask("D", ["C"]),
      makeTask("E", ["D"]),
      makeTask("F", ["E"]),
    ];

    const plan = graph.generateExecutionPlan(tasks);
    expect(plan.batches.length).toBeGreaterThanOrEqual(6);
    expect(plan.syncPoints.length).toBeGreaterThanOrEqual(1);
  });

  // ── 10. resolves file conflicts by serialization ──
  it("resolves file conflicts by serialization", () => {
    // Two independent tasks that share the same file — one should be demoted
    const tasks = [
      makeTask("A", [], ["src/utils.ts"], 10),
      makeTask("B", [], ["src/utils.ts"], 10),
    ];

    const plan = graph.generateExecutionPlan(tasks);

    // Without file conflict resolution: 1 batch with both A and B
    // With resolution: A in batch 1, B demoted to batch 2
    expect(plan.batches.length).toBeGreaterThanOrEqual(2);
    // First batch has A
    const batch1Ids = plan.batches[0].tasks.map((t) => t.id);
    expect(batch1Ids).toContain("A");
    // Second batch has B
    const batch2Ids = plan.batches[1].tasks.map((t) => t.id);
    expect(batch2Ids).toContain("B");
  });
});
