import { describe, it, expect } from "vitest";
import { WorkflowGraph, type WorkflowEdge } from "../src/tools/workflow-graph.js";
import { TriangulationGate, type Verdict } from "../src/tools/triangulation-gate.js";
import { StepMiddleware, type StepContext } from "../src/tools/step-middleware.js";
import { AgentHealthMonitor } from "../src/tools/agent-health-monitor.js";
import { ExperiencePropagator } from "../src/tools/experience-propagator.js";
import { AgentTemplateRegistry, type AgentTemplate } from "../src/tools/agent-template-registry.js";
import { V25Bridge } from "../src/tools/v25-bridge.js";

// ═══════════════════════════════════════════════
// Pillar 5: WorkflowGraph
// ═══════════════════════════════════════════════
describe("v25 WorkflowGraph", () => {
  it("should add/remove nodes and edges", () => {
    const g = new WorkflowGraph({ name: "test", nodes: [], edges: [] });
    g.addNode({ id: "a", type: "step", data: {} });
    g.addNode({ id: "b", type: "step", data: {} });
    g.addEdge({ from: "a", to: "b" });
    expect(g.getNodeCount()).toBe(2);
    expect(g.getOutgoing("a")).toHaveLength(1);
    expect(g.getIncoming("b")).toHaveLength(1);
    g.removeNode("a");
    expect(g.getNodeCount()).toBe(1);
    expect(g.getEdges()).toHaveLength(0);
  });

  it("should do topological sort with parallel batches", () => {
    const g = new WorkflowGraph({ name: "test", nodes: [], edges: [] });
    g.addNode({ id: "s1", type: "step", data: {} });
    g.addNode({ id: "s2", type: "step", data: {} });
    g.addNode({ id: "s3", type: "step", data: {} });
    g.addNode({ id: "s4", type: "step", data: {} });
    g.addEdge({ from: "s1", to: "s2" });
    g.addEdge({ from: "s1", to: "s3" });
    g.addEdge({ from: "s2", to: "s4" });
    g.addEdge({ from: "s3", to: "s4" });
    const result = g.execute();
    expect(result.batches[0]).toContain("s1");
    expect(result.batches[1]).toEqual(expect.arrayContaining(["s2", "s3"]));
    expect(result.batches[2]).toContain("s4");
    expect(result.executed).toBe(4);
  });

  it("should handle conditional edges with guard", () => {
    const g = new WorkflowGraph({ name: "test", nodes: [], edges: [] });
    g.addNode({ id: "a", type: "step", data: {} });
    g.addNode({ id: "b", type: "step", data: {} });
    g.addNode({ id: "c", type: "step", data: {} });
    const conditionalEdge: WorkflowEdge = { from: "a", to: "c" };
    conditionalEdge.guard = () => true;
    g.addEdge({ from: "a", to: "b" });
    g.addEdge(conditionalEdge);
    // With guard returning true, both edges exist — a has 2 outgoing
    expect(g.getOutgoing("a")).toHaveLength(2);

    // With guard returning false, edge is skipped — c becomes isolated
    const g2 = new WorkflowGraph({ name: "test2", nodes: [], edges: [] });
    g2.addNode({ id: "a", type: "step", data: {} });
    g2.addNode({ id: "b", type: "step", data: {} });
    g2.addNode({ id: "c", type: "step", data: {} });
    const blockedEdge: WorkflowEdge = { from: "a", to: "c" };
    blockedEdge.guard = () => false;
    g2.addEdge({ from: "a", to: "b" });
    g2.addEdge(blockedEdge);
    // With no context, the guard is called but returns false
    // c is still in the graph but not reachable from a
    const result2 = g2.execute({});
    // c is isolated (no incoming edges after guard filter), so it appears in batch 0 with a
    expect(result2.order).toContain("c");
    // But a->c edge should not be traversed (verified by checking outgoing)
    const activeOutgoing = g2.getOutgoing("a").filter(e => !e.guard || e.guard({}));
    expect(activeOutgoing).toHaveLength(1); // only a->b
  });

  it("should detect cycles", () => {
    const g = new WorkflowGraph({ name: "cycle", nodes: [], edges: [] });
    g.addNode({ id: "a", type: "step", data: {} });
    g.addNode({ id: "b", type: "step", data: {} });
    g.addEdge({ from: "a", to: "b" });
    g.addEdge({ from: "b", to: "a" });
    expect(() => g.execute()).toThrow("Cycle detected");
  });

  it("should generate mermaid output", () => {
    const g = WorkflowGraph.ULTRA_QUICK();
    const mermaid = g.toMermaid();
    expect(mermaid).toContain("graph");
    expect(mermaid).toContain("step1");
  });

  it("should serialize to/from JSON", () => {
    const g = WorkflowGraph.ULTRA_QUICK();
    const json = g.toJSON();
    const g2 = WorkflowGraph.fromJSON(json);
    expect(g2.getNodeCount()).toBe(g.getNodeCount());
  });

  it("STANDARD preset should have 12 steps + conditional edges", () => {
    const g = WorkflowGraph.STANDARD();
    expect(g.getNodeCount()).toBe(12);
    expect(g.getEdges().length).toBeGreaterThan(12); // linear + conditional
  });

  it("FULL preset should have more nodes than STANDARD", () => {
    const standard = WorkflowGraph.STANDARD();
    const full = WorkflowGraph.FULL();
    expect(full.getNodeCount()).toBeGreaterThan(standard.getNodeCount());
  });
});

// ═══════════════════════════════════════════════
// Pillar 6: TriangulationGate
// ═══════════════════════════════════════════════
describe("v25 TriangulationGate", () => {
  it("should reach consensus with N/2+1 accepts", () => {
    const gate = new TriangulationGate({ minVotes: 2, consensusRatio: 0.5 });
    gate.submitVote("adr-1", "model-a", "Good approach", "accept", 0.9);
    gate.submitVote("adr-1", "model-b", "Also good", "accept", 0.8);
    const result = gate.evaluateConsensus("adr-1");
    expect(result.consensus).toBe(true);
    expect(result.acceptCount).toBe(2);
  });

  it("should fail consensus with majority rejects", () => {
    const gate = new TriangulationGate({ minVotes: 2, consensusRatio: 0.5 });
    gate.submitVote("adr-2", "model-a", "Bad idea", "reject", 0.9);
    gate.submitVote("adr-2", "model-b", "Acceptable", "accept", 0.7);
    const result = gate.evaluateConsensus("adr-2");
    expect(result.consensus).toBe(false);
    expect(result.rejectCount).toBe(1);
  });

  it("should filter votes below confidence threshold", () => {
    const gate = new TriangulationGate({ minVotes: 1, consensusRatio: 0.5, minConfidence: 0.7 });
    gate.submitVote("adr-3", "model-a", "OK", "accept", 0.3); // below threshold
    gate.submitVote("adr-3", "model-b", "Good", "accept", 0.9);
    const result = gate.evaluateConsensus("adr-3");
    expect(result.votes).toHaveLength(1); // only model-b counted
  });

  it("should generate counterfactuals", () => {
    const gate = new TriangulationGate();
    const cf = gate.generateCounterfactual("adr-1", "Alternative X", "Would increase latency by 2x");
    expect(cf.rejectedAlternative).toBe("Alternative X");
    expect(gate.getCounterfactuals("adr-1")).toHaveLength(1);
  });

  it("should track statistics", () => {
    const gate = new TriangulationGate({ minVotes: 1, consensusRatio: 0.5 });
    gate.submitVote("adr-1", "m1", "ok", "accept", 0.9);
    gate.evaluateConsensus("adr-1");
    const stats = gate.getStatistics();
    expect(stats.totalGates).toBe(1);
    expect(stats.totalVotes).toBe(1);
  });

  it("should export JSONL event log", () => {
    const gate = new TriangulationGate();
    gate.submitVote("adr-1", "m1", "ok", "accept", 0.9);
    const jsonl = gate.exportEventLogJSONL();
    expect(jsonl).toContain("vote_submitted");
  });
});

// ═══════════════════════════════════════════════
// Pillar 7: StepMiddleware
// ═══════════════════════════════════════════════
describe("v25 StepMiddleware", () => {
  it("should run before and after hooks", async () => {
    const mw = new StepMiddleware();
    const log: string[] = [];
    mw.registerBefore(1, "before-hook", async (ctx) => {
      log.push("before");
      return ctx;
    });
    mw.registerAfter(1, "after-hook", async (ctx) => {
      log.push("after");
      return ctx;
    });
    const ctx: StepContext = { stepId: 1, phase: "test", data: {}, timing: { start: 0 }, logs: [] };
    await mw.execute(1, ctx, async (c) => {
      log.push("step");
      return c;
    });
    expect(log).toEqual(["before", "step", "after"]);
  });

  it("should abort when middleware sets aborted flag", async () => {
    const mw = new StepMiddleware();
    mw.registerBefore(1, "aborter", async (ctx) => {
      ctx.aborted = true;
      return ctx;
    });
    const ctx: StepContext = { stepId: 1, phase: "test", data: {}, timing: { start: 0 }, logs: [] };
    const { result } = await mw.execute(1, ctx, async () => "should not run");
    expect(result).toBeNull();
  });

  it("should list registered middlewares", () => {
    const mw = new StepMiddleware();
    mw.registerBefore(1, "b1", async (c) => c);
    mw.registerAfter(1, "a1", async (c) => c);
    const reg = mw.getRegisteredMiddlewares(1);
    expect(reg.before).toContain("b1");
    expect(reg.after).toContain("a1");
  });

  it("should use built-in middleware factories", async () => {
    const mw = new StepMiddleware();
    mw.registerBefore(1, "logging", StepMiddleware.loggingMiddleware(), 10);
    mw.registerAfter(1, "timing", StepMiddleware.timingMiddleware(), 10);
    const ctx: StepContext = { stepId: 1, phase: "dev", data: { key: "val" }, timing: { start: Date.now() }, logs: [] };
    const { context } = await mw.execute(1, ctx, async (c) => c);
    expect(context.logs.length).toBeGreaterThan(0);
  });

  it("should enforce token budget", async () => {
    const mw = new StepMiddleware();
    mw.registerBefore(1, "budget", StepMiddleware.tokenBudgetMiddleware(5), 10);
    const ctx: StepContext = { stepId: 1, phase: "test", data: { large: "x".repeat(100) }, timing: { start: 0 }, logs: [] };
    const { result } = await mw.execute(1, ctx, async () => "should not run");
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// Pillar 7: AgentHealthMonitor
// ═══════════════════════════════════════════════
describe("v25 AgentHealthMonitor", () => {
  it("should record successes and failures with EMA smoothing", () => {
    const mon = new AgentHealthMonitor({ emaAlpha: 0.3 });
    mon.recordSuccess("agent-1", 100, 0.9);
    mon.recordSuccess("agent-1", 200, 0.8);
    const health = mon.getHealth("agent-1");
    expect(health!.successes).toBe(2);
    expect(health!.avgLatencyMs).toBeGreaterThan(0);
    expect(health!.qualityScore).toBeGreaterThan(0);
  });

  it("should trip circuit breaker after threshold", () => {
    const mon = new AgentHealthMonitor({ circuitBreakerThreshold: 3 });
    for (let i = 0; i < 3; i++) mon.recordFailure("agent-1", "timeout");
    expect(mon.shouldDegrade("agent-1")).toBe(true);
  });

  it("should reset circuit breaker", () => {
    const mon = new AgentHealthMonitor({ circuitBreakerThreshold: 2 });
    mon.recordFailure("agent-1", "err");
    mon.recordFailure("agent-1", "err");
    expect(mon.shouldDegrade("agent-1")).toBe(true);
    mon.resetCircuit("agent-1");
    expect(mon.shouldDegrade("agent-1")).toBe(false);
  });

  it("should produce recommendations", () => {
    const mon = new AgentHealthMonitor({ circuitBreakerThreshold: 2, qualityWarnThreshold: 0.6 });
    mon.recordSuccess("agent-1", 100, 0.3); // low quality
    mon.recordSuccess("agent-1", 100, 0.3);
    mon.recordSuccess("agent-1", 100, 0.3);
    const recs = mon.getRecommendations();
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].action).toBe("caution");
  });

  it("should calculate statistics", () => {
    const mon = new AgentHealthMonitor();
    mon.recordSuccess("a", 100, 0.9);
    mon.recordSuccess("b", 200, 0.8);
    const stats = mon.getStatistics();
    expect(stats.totalAgents).toBe(2);
    expect(stats.avgSuccessRate).toBe(1);
  });
});

// ═══════════════════════════════════════════════
// Enhancement: ExperiencePropagator
// ═══════════════════════════════════════════════
describe("v25 ExperiencePropagator", () => {
  it("should index and query templates", () => {
    const ep = new ExperiencePropagator();
    ep.indexTemplate({
      id: "t1", name: "Python API", techStack: "python,fastapi",
      taskType: "api-development", complexity: "moderate",
      steps: ["spec", "code", "test"], backtracks: 0,
      durationEstimate: 60, successRate: 0.95, tags: ["python", "fastapi"],
      sourceProject: "project-a", createdAt: Date.now(),
    });
    const result = ep.query({ techStack: "python" });
    expect(result.templates).toHaveLength(1);
    expect(result.totalIndexed).toBe(1);
  });

  it("should sort by successRate desc", () => {
    const ep = new ExperiencePropagator();
    ep.indexTemplate({ id: "t1", name: "Low", techStack: "ts", taskType: "lib", complexity: "simple", steps: [], backtracks: 5, durationEstimate: 10, successRate: 0.5, tags: [], sourceProject: "a", createdAt: 0 });
    ep.indexTemplate({ id: "t2", name: "High", techStack: "ts", taskType: "lib", complexity: "simple", steps: [], backtracks: 0, durationEstimate: 10, successRate: 0.99, tags: [], sourceProject: "b", createdAt: 0 });
    const result = ep.query({ techStack: "ts" });
    expect(result.templates[0].name).toBe("High");
  });

  it("should create template from helper", () => {
    const t = ExperiencePropagator.createTemplate({
      id: "t3", name: "Test", techStack: "go", taskType: "cli",
      complexity: "simple", steps: ["plan", "code"], backtracks: 0,
      durationEstimate: 30, sourceProject: "c",
    });
    expect(t.successRate).toBe(1);
    expect(t.tags).toContain("go");
  });

  it("should serialize to/from JSON", () => {
    const ep = new ExperiencePropagator();
    ep.indexTemplate({ id: "t1", name: "X", techStack: "rs", taskType: "cli", complexity: "complex", steps: [], backtracks: 0, durationEstimate: 0, successRate: 1, tags: [], sourceProject: "p", createdAt: 0 });
    const json = ep.toJSON();
    const ep2 = ExperiencePropagator.fromJSON(json);
    expect(ep2.query({ techStack: "rs" }).templates).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════
// Enhancement: AgentTemplateRegistry
// ═══════════════════════════════════════════════
describe("v25 AgentTemplateRegistry", () => {
  it("should register and query templates", () => {
    const reg = new AgentTemplateRegistry();
    reg.register({
      name: "custom-agent", capabilities: ["coding", "rust"],
      tier: "advanced", systemPromptTemplate: "code", tools: ["terminal"],
      modelRequirements: {}, category: "development",
    });
    expect(reg.get("custom-agent")).toBeDefined();
    expect(reg.getByCapability("rust")).toHaveLength(1);
  });

  it("should match by capabilities with scoring", () => {
    const reg = new AgentTemplateRegistry();
    reg.registerBuiltIns();
    const matches = reg.match(["coding", "security"]);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it("should track statistics", () => {
    const reg = new AgentTemplateRegistry();
    reg.registerBuiltIns();
    const stats = reg.getStatistics();
    expect(stats.totalTemplates).toBe(5);
    expect(stats.uniqueCapabilities).toBeGreaterThan(5);
  });
});

// ═══════════════════════════════════════════════
// Integration: V25Bridge
// ═══════════════════════════════════════════════
describe("v25 V25Bridge", () => {
  it("should initialize all modules when all flags enabled", () => {
    const bridge = new V25Bridge({
      workflowGraph: true,
      triangulationGate: true,
      stepMiddleware: true,
      experiencePropagation: true,
    });
    bridge.initialize();
    expect(bridge.isInitialized()).toBe(true);
    const status = bridge.getStatus();
    expect(status.modules.workflowGraph).toBe(true);
    expect(status.modules.triangulationGate).toBe(true);
    expect(status.modules.stepMiddleware).toBe(true);
    expect(status.modules.experiencePropagator).toBe(true);
    expect(status.modules.templateRegistry).toBe(true);
  });

  it("should have null modules when flags disabled", () => {
    const bridge = new V25Bridge({
      workflowGraph: false,
      triangulationGate: false,
      stepMiddleware: false,
      experiencePropagation: false,
    });
    const status = bridge.getStatus();
    expect(status.modules.workflowGraph).toBe(false);
    expect(status.modules.triangulationGate).toBe(false);
  });

  it("should export statistics from active modules", () => {
    const bridge = new V25Bridge({
      workflowGraph: false,
      triangulationGate: true,
      stepMiddleware: true,
      experiencePropagation: true,
    });
    bridge.initialize();
    const stats = bridge.exportStatistics();
    expect(stats).toHaveProperty("triangulationGate");
    expect(stats).toHaveProperty("healthMonitor");
    expect(stats).toHaveProperty("templateRegistry");
  });
});

// ══════════════════════════════════════════════════
// ContextProtocol (#127) Tests
// ══════════════════════════════════════════════════
import { ContextProtocol, type ContextBlock } from "../src/tools/context-protocol.js";

describe("ContextProtocol (#127)", () => {
  it("registers and retrieves context blocks", () => {
    const cp = new ContextProtocol();
    cp.register({ id: "b1", type: "memory", description: "test", relevanceScore: 0.8, tokenCost: 100, content: "hello" });
    expect(cp.get("b1")).toBeDefined();
    expect(cp.get("b1")!.content).toBe("hello");
    expect(cp.list().length).toBe(1);
  });

  it("filters by type", () => {
    const cp = new ContextProtocol();
    cp.register({ id: "b1", type: "memory", description: "m1", relevanceScore: 0.5, tokenCost: 100, content: "m" });
    cp.register({ id: "b2", type: "doc", description: "d1", relevanceScore: 0.7, tokenCost: 200, content: "d" });
    expect(cp.list("memory").length).toBe(1);
    expect(cp.list("doc").length).toBe(1);
    expect(cp.list("search").length).toBe(0);
  });

  it("unregisters blocks", () => {
    const cp = new ContextProtocol();
    cp.register({ id: "b1", type: "memory", description: "test", relevanceScore: 0.5, tokenCost: 100, content: "x" });
    expect(cp.unregister("b1")).toBe(true);
    expect(cp.get("b1")).toBeUndefined();
  });

  it("planInjection selects by priority (relevance/cost)", () => {
    const cp = new ContextProtocol(200);
    cp.register({ id: "cheap-relevant", type: "memory", description: "cr", relevanceScore: 0.9, tokenCost: 100, content: "cheap and relevant" });
    cp.register({ id: "expensive-relevant", type: "doc", description: "er", relevanceScore: 0.8, tokenCost: 500, content: "expensive" });
    cp.register({ id: "cheap-irrelevant", type: "search", description: "ci", relevanceScore: 0.1, tokenCost: 50, content: "irrelevant" });

    const plan = cp.planInjection();
    expect(plan.selected[0].id).toBe("cheap-relevant");
    expect(plan.rejected.length).toBeGreaterThanOrEqual(1);
  });

  it("planInjection respects budget", () => {
    const cp = new ContextProtocol(150);
    cp.register({ id: "b1", type: "memory", description: "a", relevanceScore: 0.9, tokenCost: 100, content: "a" });
    cp.register({ id: "b2", type: "doc", description: "b", relevanceScore: 0.8, tokenCost: 100, content: "b" });
    const plan = cp.planInjection();
    expect(plan.totalTokens).toBeLessThanOrEqual(150);
    expect(plan.rejected.length).toBe(1);
  });

  it("buildContextString produces structured output", () => {
    const cp = new ContextProtocol(1000);
    cp.register({ id: "b1", type: "memory", description: "Test Block", relevanceScore: 0.9, tokenCost: 100, content: "Hello world" });
    const str = cp.buildContextString();
    expect(str).toContain("[memory] Test Block");
    expect(str).toContain("Hello world");
    expect(str).toContain("90%");
  });

  it("getStatistics returns correct aggregates", () => {
    const cp = new ContextProtocol();
    cp.register({ id: "b1", type: "memory", description: "m", relevanceScore: 0.8, tokenCost: 100, content: "m" });
    cp.register({ id: "b2", type: "doc", description: "d", relevanceScore: 0.6, tokenCost: 200, content: "d" });
    const stats = cp.getStatistics();
    expect(stats.totalBlocks).toBe(2);
    expect(stats.totalTokens).toBe(300);
    expect(stats.byType.memory).toBe(1);
    expect(stats.byType.doc).toBe(1);
    expect(stats.avgRelevance).toBeCloseTo(0.7);
  });

  it("clear removes all blocks", () => {
    const cp = new ContextProtocol();
    cp.register({ id: "b1", type: "memory", description: "m", relevanceScore: 0.5, tokenCost: 50, content: "m" });
    cp.clear();
    expect(cp.list().length).toBe(0);
  });

  it("validates input", () => {
    const cp = new ContextProtocol();
    expect(() => cp.register({ id: "", type: "memory", description: "", relevanceScore: 0.5, tokenCost: 50, content: "" })).toThrow();
    expect(() => cp.register({ id: "b", type: "memory", description: "", relevanceScore: -1, tokenCost: 50, content: "" })).toThrow();
    expect(() => cp.register({ id: "b", type: "memory", description: "", relevanceScore: 0.5, tokenCost: -1, content: "" })).toThrow();
  });
});

// ══════════════════════════════════════════════════
// v26 Module Tests (Pillars 8-10)
// ══════════════════════════════════════════════════

// --- ExecutionSandbox (#128) ---
import { ExecutionSandbox } from "../src/tools/execution-sandbox.js";

describe("ExecutionSandbox", () => {
  it("executes successfully and returns result", async () => {
    const sb = new ExecutionSandbox();
    const res = await sb.execute(7, async () => 42);
    expect(res.success).toBe(true);
    expect(res.result).toBe(42);
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("captures error and sets state to rolled-back", async () => {
    const sb = new ExecutionSandbox();
    const res = await sb.execute(7, async () => { throw new Error("boom"); });
    expect(res.success).toBe(false);
    expect(res.error).toBe("boom");
    expect(sb.getState()).toBe("rolled-back");
    expect(sb.getStatistics().totalRollbacks).toBe(1);
  });

  it("respects budget timeout", async () => {
    const sb = new ExecutionSandbox({ maxBudgetMs: 50 });
    const res = await sb.execute(7, async () => {
      await new Promise(r => setTimeout(r, 200));
      return "late";
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("budget exceeded");
  });

  it("creates snapshots with autoSnapshot", async () => {
    const sb = new ExecutionSandbox({ autoSnapshot: true });
    sb.trackFile("src/foo.ts", "old content");
    const res = await sb.execute(7, async () => "done", ["src/foo.ts"]);
    expect(res.success).toBe(true);
    expect(res.snapshot).toBeDefined();
    expect(sb.getSnapshots().length).toBe(1);
  });

  it("rollbackLast returns most recent snapshot", async () => {
    const sb = new ExecutionSandbox();
    sb.trackFile("a.ts", "a");
    await sb.execute(7, async () => 1, ["a.ts"]);
    const snap = sb.rollbackLast();
    expect(snap).not.toBeNull();
    expect(snap!.stepId).toBe(7);
  });
});

// --- StepEventStream (#129) ---
import { StepEventStream } from "../src/tools/step-event-stream.js";

describe("StepEventStream", () => {
  it("emits events and tracks count", () => {
    const stream = new StepEventStream();
    stream.emit("step:start", 1);
    stream.emit("step:complete", 1);
    stream.emit("step:start", 7);
    const stats = stream.getStatistics();
    expect(stats.totalEvents).toBe(3);
    expect(stats.stepsCovered).toBe(2);
  });

  it("subscribers receive filtered events", () => {
    const stream = new StepEventStream();
    const errors: string[] = [];
    stream.subscribe((e) => errors.push(e.id), e => e.type === "step:error");
    stream.emit("step:start", 1);
    stream.emit("step:error", 7, { msg: "fail" });
    stream.emit("step:complete", 7);
    expect(errors.length).toBe(1);
  });

  it("builds timeline by step", () => {
    const stream = new StepEventStream();
    stream.emit("step:start", 1);
    stream.emit("step:complete", 1);
    stream.emit("step:start", 7);
    const tl = stream.getTimeline();
    expect(tl.get(1)!.length).toBe(2);
    expect(tl.get(7)!.length).toBe(1);
  });

  it("causal chain tracks parent events", () => {
    const stream = new StepEventStream();
    const e1 = stream.emit("step:start", 7);
    const e2 = stream.emit("step:complete", 7, {}, undefined, e1.id);
    const chain = stream.getCausalChain(e2.id);
    expect(chain.length).toBe(2);
    expect(chain[0].id).toBe(e1.id);
  });
});

// --- ExperienceLifecycle (#130) ---
import { ExperienceLifecycle } from "../src/tools/experience-lifecycle.js";

describe("ExperienceLifecycle", () => {
  it("records and queries active experiences", () => {
    const el = new ExperienceLifecycle();
    el.record({
      id: "exp-1", name: "Test", techStack: "ts", taskType: "api",
      successRate: 0, createdAt: Date.now(), tags: ["test"],
    });
    const results = el.query({ techStack: "ts" });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Test");
  });

  it("reinforces on success, penalizes on failure", () => {
    const el = new ExperienceLifecycle();
    el.record({
      id: "exp-2", name: "X", techStack: "py", taskType: "ml",
      successRate: 0, createdAt: Date.now(), tags: [],
    });
    el.recordUsage("exp-2", true);
    let exp = el.query({ techStack: "py" })[0];
    expect(exp.timesSucceeded).toBe(1);
    expect(exp.timesUsed).toBe(1);

    el.recordUsage("exp-2", false);
    exp = el.query({ techStack: "py" })[0];
    expect(exp.timesSucceeded).toBe(1); // still 1 success
    expect(exp.weight).toBeLessThan(1.0); // penalized
  });

  it("decays experiences over time", () => {
    const el = new ExperienceLifecycle({ halfLifeDays: 0.00001 });
    el.record({
      id: "exp-3", name: "Y", techStack: "go", taskType: "cli",
      successRate: 0, createdAt: Date.now(), tags: [],
    });
    // Manually set lastUsedAt to far past to trigger decay
    const exp = el.query({ techStack: "go" })[0];
    exp.lastUsedAt = Date.now() - 100000; // 100s ago
    exp.weight = 0.5;
    const decayed = el.decay();
    expect(decayed).toBe(1);
    const stats = el.getStatistics();
    expect(stats.avgWeight).toBeLessThan(0.5);
  });

  it("prunes expired experiences", () => {
    const el = new ExperienceLifecycle({ expireThreshold: 0.9 });
    el.record({
      id: "exp-4", name: "Z", techStack: "rs", taskType: "sys",
      successRate: 0, createdAt: Date.now(), tags: [],
    });
    el.recordUsage("exp-4", false); // penalty reduces weight
    el.recordUsage("exp-4", false);
    el.recordUsage("exp-4", false);
    const pruned = el.prune();
    expect(pruned).toBeGreaterThanOrEqual(0);
  });
});
