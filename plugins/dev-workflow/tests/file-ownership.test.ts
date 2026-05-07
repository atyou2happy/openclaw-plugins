import { describe, it, expect, beforeEach } from "vitest";
import { FileOwnershipManager } from "../src/agents/file-ownership.js";
import type { WorkflowTask } from "../src/types.js";

const makeTask = (id: string, files: string[] = []): WorkflowTask => ({
  id,
  title: `Task ${id}`,
  description: ``,
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

describe("FileOwnershipManager", () => {
  let mgr: FileOwnershipManager;

  beforeEach(() => {
    mgr = new FileOwnershipManager();
  });

  it("allocates files to agents", () => {
    const task1 = makeTask("t1", ["src/a.ts", "src/b.ts"]);
    const task2 = makeTask("t2", ["src/c.ts", "src/d.ts"]);

    const result = mgr.allocate([task1, task2], "batch");

    // allocations: each agent gets its files
    expect(result.allocations["batch-agent-0"]).toEqual(["src/a.ts", "src/b.ts"]);
    expect(result.allocations["batch-agent-1"]).toEqual(["src/c.ts", "src/d.ts"]);

    // ownership: each file maps to the correct agent
    expect(result.ownership["src/a.ts"]).toBe("batch-agent-0");
    expect(result.ownership["src/b.ts"]).toBe("batch-agent-0");
    expect(result.ownership["src/c.ts"]).toBe("batch-agent-1");
    expect(result.ownership["src/d.ts"]).toBe("batch-agent-1");
  });

  it("detects conflicts between tasks", () => {
    const task1 = makeTask("t1", ["src/shared.ts", "src/a.ts"]);
    const task2 = makeTask("t2", ["src/shared.ts", "src/b.ts"]);

    const conflicts = mgr.detectConflicts([task1, task2]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].file).toBe("src/shared.ts");
    expect(conflicts[0].taskIds).toContain("t1");
    expect(conflicts[0].taskIds).toContain("t2");
  });

  it("no conflicts for disjoint files", () => {
    const task1 = makeTask("t1", ["src/a.ts"]);
    const task2 = makeTask("t2", ["src/b.ts"]);

    const conflicts = mgr.detectConflicts([task1, task2]);

    expect(conflicts).toHaveLength(0);
  });

  it("checks file ownership correctly", () => {
    const task = makeTask("t1", ["src/auth.ts"]);
    mgr.allocate([task], "batch");

    expect(mgr.isOwnedBy("src/auth.ts", "batch-agent-0")).toBe(true);
    expect(mgr.isOwnedBy("src/auth.ts", "batch-agent-999")).toBe(false);
    expect(mgr.isOwnedBy("src/other.ts", "batch-agent-0")).toBe(false);
  });

  it("releases ownership", () => {
    const task = makeTask("t1", ["src/a.ts", "src/b.ts"]);
    mgr.allocate([task], "batch");

    mgr.release("batch-agent-0");

    const snapshot = mgr.getSnapshot();
    expect(snapshot.allocations["batch-agent-0"]).toBeUndefined();
    expect(snapshot.ownership["src/a.ts"]).toBeUndefined();
    expect(snapshot.ownership["src/b.ts"]).toBeUndefined();
  });

  it("clears all ownership", () => {
    const task1 = makeTask("t1", ["src/a.ts"]);
    const task2 = makeTask("t2", ["src/b.ts"]);
    mgr.allocate([task1, task2], "batch");

    mgr.clear();

    const snapshot = mgr.getSnapshot();
    expect(Object.keys(snapshot.allocations)).toHaveLength(0);
    expect(Object.keys(snapshot.ownership)).toHaveLength(0);
  });

  it("handles glob patterns", () => {
    const task = makeTask("t1", ["src/auth/*.ts"]);
    mgr.allocate([task], "batch");

    expect(mgr.isOwnedBy("src/auth/login.ts", "batch-agent-0")).toBe(true);
    expect(mgr.isOwnedBy("src/auth/logout.ts", "batch-agent-0")).toBe(true);
    expect(mgr.isOwnedBy("src/auth/sub/deep.ts", "batch-agent-0")).toBe(false);
  });

  it("normalizes paths", () => {
    const task = makeTask("t1", ["./src/auth/login.ts"]);
    mgr.allocate([task], "batch");

    const snapshot = mgr.getSnapshot();
    // The "./" prefix should be stripped, so ownership key is "src/auth/login.ts"
    expect(snapshot.ownership["src/auth/login.ts"]).toBe("batch-agent-0");
    expect(snapshot.ownership["./src/auth/login.ts"]).toBeUndefined();
  });

  it("getSnapshot returns plain objects", () => {
    const task = makeTask("t1", ["src/a.ts"]);
    mgr.allocate([task], "batch");

    const snapshot = mgr.getSnapshot();

    // allocations and ownership should be plain Records, not Map instances
    expect(snapshot.allocations).not.toBeInstanceOf(Map);
    expect(snapshot.ownership).not.toBeInstanceOf(Map);
    expect(typeof snapshot.allocations).toBe("object");
    expect(typeof snapshot.ownership).toBe("object");
  });
});
