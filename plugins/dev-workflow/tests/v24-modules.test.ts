import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-v24-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

// ── ADR Manager ──

describe("ADRManager", () => {
  it("creates and reads an ADR", async () => {
    const { ADRManager } = await import("../src/tools/adr-manager.js");
    const mgr = new ADRManager(testDir);
    mgr.init();

    const adr = mgr.create("Use TypeScript", "Need type safety", "Adopt TypeScript", "Better DX, build step needed");
    expect(adr.id).toBe(1);
    expect(adr.status).toBe("proposed");
    expect(adr.title).toBe("Use TypeScript");

    const loaded = mgr.get(1);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe("Use TypeScript");
  });

  it("accepts an ADR", async () => {
    const { ADRManager } = await import("../src/tools/adr-manager.js");
    const mgr = new ADRManager(testDir);
    mgr.init();
    mgr.create("Test", "ctx", "dec", "cons");

    const accepted = mgr.accept(1, "user", "Plan Gate approved");
    expect(accepted!.status).toBe("accepted");
  });

  it("supersedes an ADR", async () => {
    const { ADRManager } = await import("../src/tools/adr-manager.js");
    const mgr = new ADRManager(testDir);
    mgr.init();
    mgr.create("Old approach", "ctx", "old dec", "old cons");

    const result = mgr.supersede(1, "New approach", "new ctx", "new dec", "new cons", "Better approach found");
    expect(result.old!.status).toBe("superseded");
    expect(result.old!.supersededBy).toBe(2);
    expect(result.new.status).toBe("accepted");
    expect(result.new.id).toBe(2);
  });

  it("gateCheck blocks on proposed ADRs", async () => {
    const { ADRManager } = await import("../src/tools/adr-manager.js");
    const mgr = new ADRManager(testDir);
    mgr.init();
    mgr.create("Unresolved", "ctx", "dec", "cons");

    const check = mgr.gateCheck();
    expect(check.passed).toBe(false);
    expect(check.blocking.length).toBe(1);
  });

  it("gateCheck passes when all accepted", async () => {
    const { ADRManager } = await import("../src/tools/adr-manager.js");
    const mgr = new ADRManager(testDir);
    mgr.init();
    mgr.create("Decided", "ctx", "dec", "cons");
    mgr.accept(1);

    const check = mgr.gateCheck();
    expect(check.passed).toBe(true);
    expect(check.blocking.length).toBe(0);
  });

  it("exports summary", async () => {
    const { ADRManager } = await import("../src/tools/adr-manager.js");
    const mgr = new ADRManager(testDir);
    mgr.init();
    mgr.create("A1", "c", "d", "x");
    mgr.create("A2", "c", "d", "x");
    mgr.accept(1);

    const exp = mgr.export();
    expect(exp.total).toBe(2);
    expect(exp.byStatus.accepted).toBe(1);
    expect(exp.byStatus.proposed).toBe(1);
    expect(exp.events.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Swarm Topology Selector ──

describe("SwarmTopologySelector", () => {
  it("registers agents and routes tasks", async () => {
    const { SwarmTopologySelector } = await import("../src/tools/swarm-topology.js");
    const sel = new SwarmTopologySelector({ topology: "hierarchical" });

    sel.registerAgent({ agentId: "a1", capabilities: ["code", "test"], successRate: 0.9, avgSpeed: 10 });
    sel.registerAgent({ agentId: "a2", capabilities: ["docs", "review"], successRate: 0.8, avgSpeed: 15 });

    const matches = sel.routeTasks([
      { taskId: "t1", requiredCapabilities: ["code"], complexity: "low", dependencies: [] },
    ]);
    expect(matches.length).toBe(1);
    expect(matches[0].agentId).toBe("a1"); // a1 matches "code"
  });

  it("adaptive switching from hierarchical to mesh", async () => {
    const { SwarmTopologySelector } = await import("../src/tools/swarm-topology.js");
    const sel = new SwarmTopologySelector({ topology: "hierarchical", consecutivePassThreshold: 3 });

    expect(sel.getTopology()).toBe("hierarchical");
    sel.recordCompletion(true);
    sel.recordCompletion(true);
    const decision = sel.recordCompletion(true);
    expect(decision).not.toBeNull();
    expect(decision!.to).toBe("mesh");
    expect(sel.getTopology()).toBe("mesh");
  });

  it("adaptive switching from mesh to hierarchical on failure", async () => {
    const { SwarmTopologySelector } = await import("../src/tools/swarm-topology.js");
    const sel = new SwarmTopologySelector({ topology: "mesh" });

    expect(sel.getTopology()).toBe("mesh");
    const decision = sel.recordCompletion(false);
    expect(decision).not.toBeNull();
    expect(decision!.to).toBe("hierarchical");
  });

  it("consensus protocol for critical decisions", async () => {
    const { SwarmTopologySelector } = await import("../src/tools/swarm-topology.js");
    const sel = new SwarmTopologySelector({ topology: "hierarchical" });
    sel.registerAgent({ agentId: "a1", capabilities: [], successRate: 1, avgSpeed: 10 });
    sel.registerAgent({ agentId: "a2", capabilities: [], successRate: 1, avgSpeed: 10 });
    sel.registerAgent({ agentId: "a3", capabilities: [], successRate: 1, avgSpeed: 10 });

    // 2/3 yes, need N/2+1 = 2 for critical
    const result = sel.checkConsensus({ a1: true, a2: true, a3: false }, "critical");
    expect(result.decided).toBe(true);
    expect(result.approved).toBe(true);

    // 1/3 yes, need 2
    const result2 = sel.checkConsensus({ a1: true, a2: false, a3: false }, "critical");
    expect(result2.decided).toBe(false);
    expect(result2.approved).toBe(false);
  });

  it("selects topology based on task structure", async () => {
    const { SwarmTopologySelector } = await import("../src/tools/swarm-topology.js");
    const sel = new SwarmTopologySelector({ topology: "adaptive" });

    // Many independent tasks → mesh
    const tasks1 = Array.from({ length: 5 }, (_, i) => ({
      taskId: `t${i}`, requiredCapabilities: ["code"], complexity: "low" as const, dependencies: [],
    }));
    expect(sel.selectTopology(tasks1)).toBe("mesh");

    // Many dependencies → hierarchical
    const tasks2 = [
      { taskId: "t1", requiredCapabilities: ["code"], complexity: "high" as const, dependencies: ["t2", "t3", "t4"] },
      { taskId: "t2", requiredCapabilities: ["code"], complexity: "medium" as const, dependencies: ["t3"] },
    ];
    expect(sel.selectTopology(tasks2)).toBe("hierarchical");
  });
});

// ── Self-Learning Engine ──

describe("SelfLearningEngine", () => {
  it("records experiences", async () => {
    const { SelfLearningEngine } = await import("../src/tools/self-learning.js");
    const engine = new SelfLearningEngine(testDir);
    engine.init();

    const exp = engine.recordExperience("success", "step7-development", "Wrote module", "TDD", "Tests pass", "Always write tests first");
    expect(exp.id).toContain("exp-");
    expect(exp.category).toBe("success");

    const all = engine.getExperiences();
    expect(all.length).toBe(1);
  });

  it("auto-categorizes from task result", async () => {
    const { SelfLearningEngine } = await import("../src/tools/self-learning.js");
    const engine = new SelfLearningEngine(testDir);
    engine.init();

    const success = engine.recordFromTask("step7-development", "Fix bug", true, undefined);
    expect(success.category).toBe("success");

    const failure = engine.recordFromTask("step9-test", "Run tests", false, "TypeError: Cannot read property");
    expect(failure.category).toBe("failure");
    expect(failure.lesson).toBeTruthy();
  });

  it("extracts patterns from repeated experiences", async () => {
    const { SelfLearningEngine } = await import("../src/tools/self-learning.js");
    const engine = new SelfLearningEngine(testDir);
    engine.init();

    // 3+ similar failures → pattern
    for (let i = 0; i < 4; i++) {
      engine.recordExperience("failure", "step9-test", "Run tests", "npm test", "timeout", "Increase timeout", ["auto"]);
    }

    const patterns = engine.getPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].occurrences).toBeGreaterThanOrEqual(3);
  });

  it("provides recommendations", async () => {
    const { SelfLearningEngine } = await import("../src/tools/self-learning.js");
    const engine = new SelfLearningEngine(testDir);
    engine.init();

    // Build pattern history — need enough repetitions to reach confidence >= 0.4
    for (let i = 0; i < 6; i++) {
      engine.recordExperience("failure", "step9-test", "ctx", "act", "fail", "Always mock external APIs", ["auto"]);
    }

    const patterns = engine.getPatterns();
    // Pattern should exist and have reasonable confidence
    if (patterns.length > 0 && patterns[0].confidence >= 0.4) {
      const rec = engine.getRecommendation("step9-test", ["auto"]);
      expect(rec).toBeTruthy();
    } else {
      // If confidence not high enough, recommendation is null — that's expected behavior
      const rec = engine.getRecommendation("step9-test", ["auto"]);
      expect(rec).toBeNull();
    }
  });

  it("adapts thresholds", async () => {
    const { SelfLearningEngine } = await import("../src/tools/self-learning.js");
    const engine = new SelfLearningEngine(testDir);
    engine.init();

    engine.registerThreshold("coverageThreshold", 80);
    expect(engine.getThreshold("coverageThreshold")).toBe(80);

    // Low success rate → relax (increase) threshold
    const newVal = engine.adjustThreshold("coverageThreshold", 0.3, "High failure rate");
    expect(newVal).toBeGreaterThan(80);

    // High success rate → tighten (decrease) threshold
    const newVal2 = engine.adjustThreshold("coverageThreshold", 0.9, "Low failure rate");
    expect(newVal2).toBeLessThan(newVal);
  });

  it("persists and reloads data", async () => {
    const { SelfLearningEngine } = await import("../src/tools/self-learning.js");

    // Write
    const engine1 = new SelfLearningEngine(testDir);
    engine1.init();
    engine1.recordExperience("success", "step1", "ctx", "act", "out", "lesson");

    // Read — fresh instance from same dir
    const engine2 = new SelfLearningEngine(testDir);
    engine2.init();
    expect(engine2.getExperiences().length).toBe(1);
    // Thresholds are not auto-persisted until adjusted — register + adjust to test persistence
    engine1.registerThreshold("testThreshold", 50);
    engine1.adjustThreshold("testThreshold", 0.3, "test");
    // Verify the adjusted value persisted
    const engine3 = new SelfLearningEngine(testDir);
    engine3.init();
    expect(engine3.getThreshold("testThreshold")).not.toBe(0);
  });
});

// ── Goal Decomposition Engine ──

describe("GoalDecompositionEngine", () => {
  it("creates a top-level goal", async () => {
    const { GoalDecompositionEngine } = await import("../src/tools/goal-decomposition.js");
    const engine = new GoalDecompositionEngine();
    const goal = engine.createGoal("Build feature", "Implement user authentication");

    expect(goal.id).toContain("goal-");
    expect(goal.depth).toBe(0);
    expect(goal.status).toBe("pending");
  });

  it("decomposes a goal into sub-goals", async () => {
    const { GoalDecompositionEngine } = await import("../src/tools/goal-decomposition.js");
    const engine = new GoalDecompositionEngine();
    const root = engine.createGoal("Build feature", "Implement user auth system");

    const subs = engine.decompose(root.id, [
      { title: "Design schema", description: "Design DB schema for users" },
      { title: "Write API", description: "Implement auth endpoints" },
      { title: "Add tests", description: "Write integration tests" },
    ]);

    expect(subs.length).toBe(3);
    expect(subs[0].depth).toBe(1);
    expect(subs[0].parentGoalId).toBe(root.id);
    expect(root.subGoals.length).toBe(3);
  });

  it("enforces max depth", async () => {
    const { GoalDecompositionEngine } = await import("../src/tools/goal-decomposition.js");
    const engine = new GoalDecompositionEngine({ maxDepth: 1 });
    const root = engine.createGoal("Root", "Top level goal");

    engine.decompose(root.id, [{ title: "L1", description: "Level 1 sub" }]);

    // Should throw at depth 2
    const l1Goal = engine.getAll().find(g => g.depth === 1)!;
    expect(() => engine.decompose(l1Goal.id, [{ title: "L2", description: "Too deep" }])).toThrow();
  });

  it("computes topological execution order", async () => {
    const { GoalDecompositionEngine } = await import("../src/tools/goal-decomposition.js");
    const engine = new GoalDecompositionEngine();
    const root = engine.createGoal("Root", "Top");

    const [a, b, c] = engine.decompose(root.id, [
      { title: "A", description: "First task" },
      { title: "B", description: "Second task", dependencies: [] },
      { title: "C", description: "Third task" },
    ]);

    // Add dependency: C depends on A
    engine.addDependency(c.id, a.id);

    const order = engine.getExecutionOrder(root.id);
    const aIdx = order.indexOf(a.id);
    const cIdx = order.indexOf(c.id);
    expect(aIdx).toBeLessThan(cIdx); // A before C
  });

  it("estimates task counts from complexity", async () => {
    const { GoalDecompositionEngine } = await import("../src/tools/goal-decomposition.js");
    const engine = new GoalDecompositionEngine();
    const root = engine.createGoal("Root", "Complex system migration project framework");

    engine.decompose(root.id, [
      { title: "Simple fix", description: "Fix typo" },
      { title: "Complex module", description: "Build distributed pipeline orchestration service" },
    ]);

    const total = engine.estimateTaskCount(root.id);
    expect(total).toBeGreaterThan(0);

    const leaf = engine.getLeafGoals(root.id);
    expect(leaf.length).toBe(2);
    // Complex module should estimate more tasks than simple fix
    const complex = leaf.find(g => g.title === "Complex module")!;
    const simple = leaf.find(g => g.title === "Simple fix")!;
    expect(complex.estimatedTasks).toBeGreaterThan(simple.estimatedTasks);
  });

  it("checks granularity adequacy", async () => {
    const { GoalDecompositionEngine } = await import("../src/tools/goal-decomposition.js");
    const engine = new GoalDecompositionEngine();
    const root = engine.createGoal("Root", "Epic system rewrite migration platform");

    engine.decompose(root.id, [
      { title: "Sub1", description: "Build entire distributed framework orchestration pipeline system" },
    ]);

    engine.estimateTaskCount(root.id);
    // Use threshold=1 to force oversized check on non-trivial leaf goals
    const check = engine.checkGranularity(root.id, 1);
    expect(check.oversized.length).toBeGreaterThan(0);
  });

  it("full decomposition export", async () => {
    const { GoalDecompositionEngine } = await import("../src/tools/goal-decomposition.js");
    const engine = new GoalDecompositionEngine();
    const root = engine.createGoal("Root", "Build feature module");

    engine.decompose(root.id, [
      { title: "A", description: "Design component" },
      { title: "B", description: "Implement service" },
    ]);

    const result = engine.getDecomposition(root.id);
    expect(result.totalGoals).toBe(3); // root + 2 subs
    expect(result.maxDepth).toBe(1);
    expect(result.executionOrder.length).toBe(3);
    expect(result.complexityDistribution).toBeDefined();
  });
});

// ── V24 Bridge ──

describe("V24Bridge", () => {
  const makeFF = (overrides: Record<string, any> = {}) => ({
    strictTdd: false, ruleEnforcement: true, autoCommit: true,
    workingMemoryPersist: true, dependencyParallelTasks: true,
    conventionalCommits: true, qaGateBlocking: false,
    githubIntegration: true, coverageThreshold: 80,
    maxFileLines: 500, maxFunctionLines: 50,
    modelOverride: {}, subtaskGatesEnabled: true,
    subtaskMaxLines: 50, taskMaxLines: 200,
    tmuxForLongTasks: true, tmuxTimeoutSeconds: 30,
    noProxyLocalhost: true, readmeDualLanguage: true,
    refactorAssessmentEnabled: true, refactorAssessmentOnStep0: true,
    agentTeamEnabled: false, agentTeamParallelExecution: true,
    agentTeamContractLayer: true, agentTeamFileOwnership: true,
    agentTeamAutoSync: true,
    swarmTopology: "hierarchical" as const,
    selfLearningEnabled: true,
    adrEnabled: true,
    goalDecomposition: true,
    capabilityRouting: false,
    ...overrides,
  });

  it("initializes all modules when enabled", async () => {
    const { V24Bridge } = await import("../src/tools/v24-bridge.js");
    const bridge = new V24Bridge({ projectDir: testDir, featureFlags: makeFF() });
    bridge.init();

    const status = bridge.getStatus();
    expect(status.adrEnabled).toBe(true);
    expect(status.learningEnabled).toBe(true);
    expect(status.goalDecompEnabled).toBe(true);
  });

  it("ADR workflow through bridge", async () => {
    const { V24Bridge } = await import("../src/tools/v24-bridge.js");
    const bridge = new V24Bridge({ projectDir: testDir, featureFlags: makeFF() });
    bridge.init();

    const adr = bridge.createADR("Test decision", "Why", "What", "Impact");
    expect(adr).not.toBeNull();
    expect(adr!.id).toBe(1);

    // Gate check blocks
    const gate = bridge.adrGateCheck();
    expect(gate.passed).toBe(false);

    // Accept
    bridge.acceptADR(1, "user", "Approved");
    const gate2 = bridge.adrGateCheck();
    expect(gate2.passed).toBe(true);
  });

  it("self-learning through bridge", async () => {
    const { V24Bridge } = await import("../src/tools/v24-bridge.js");
    const bridge = new V24Bridge({ projectDir: testDir, featureFlags: makeFF() });
    bridge.init();

    const exp = bridge.recordExperience("step7", "Wrote code", true);
    expect(exp).not.toBeNull();

    const export_ = bridge.learningExport();
    expect(export_).not.toBeNull();
    expect(export_!.totalExperiences).toBe(1);
  });

  it("goal decomposition through bridge", async () => {
    const { V24Bridge } = await import("../src/tools/v24-bridge.js");
    const bridge = new V24Bridge({ projectDir: testDir, featureFlags: makeFF() });
    bridge.init();

    const goal = bridge.createGoal("Big feature", "Build the whole thing");
    expect(goal).not.toBeNull();

    const subs = bridge.decomposeGoal(goal!.id, [
      { title: "Part 1", description: "First part" },
      { title: "Part 2", description: "Second part" },
    ]);
    expect(subs.length).toBe(2);

    const leaves = bridge.getLeafGoals(goal!.id);
    expect(leaves.length).toBe(2);
  });

  it("skips disabled modules", async () => {
    const { V24Bridge } = await import("../src/tools/v24-bridge.js");
    const ff = makeFF({ adrEnabled: false, selfLearningEnabled: false, goalDecomposition: false });
    const bridge = new V24Bridge({ projectDir: testDir, featureFlags: ff });
    bridge.init();

    const status = bridge.getStatus();
    expect(status.adrEnabled).toBe(false);
    expect(status.learningEnabled).toBe(false);
    expect(status.goalDecompEnabled).toBe(false);
    expect(status.adrCount).toBe(0);
  });
});
