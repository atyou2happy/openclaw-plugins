/**
 * Integration tests for v24+v25 bridge cross-module interactions
 * Covers: V24Bridge, V25Bridge, and their collaborative behaviors
 */
import { describe, it, expect } from "vitest";
import { V24Bridge } from "../src/tools/v24-bridge.js";
import { V25Bridge } from "../src/tools/v25-bridge.js";
import { WorkflowGraph } from "../src/tools/workflow-graph.js";
import { DEFAULT_FEATURE_FLAGS } from "../src/constants.js";

const makeV24 = (overrides: Record<string, unknown> = {}): V24Bridge => {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...overrides };
  return new V24Bridge({ projectDir: "/tmp/test", featureFlags: flags });
};

describe("V24+V25 Bridge Integration", () => {
  // ── V24 Bridge ──
  it("V24Bridge initializes with all pillars", () => {
    const bridge = makeV24({ adrEnabled: true, selfLearningEnabled: true });
    const status = bridge.getStatus();
    expect(status.adrEnabled).toBe(true);
    expect(status.learningEnabled).toBe(true);
  });

  it("V24Bridge ADR gate check passes after auto-accept", () => {
    const bridge = makeV24({ adrEnabled: true });
    bridge.createADR("Tech Stack", "Use TypeScript", "system", "critical");
    bridge.acceptADR(1, "system", "Plan Gate approved");
    const gate = bridge.adrGateCheck();
    expect(gate.passed).toBe(true);
  });

  it("V24Bridge records experience and captures learning", () => {
    const bridge = makeV24({ selfLearningEnabled: true });
    bridge.init();
    for (let i = 0; i < 12; i++) {
      bridge.recordExperience("step7", "task-" + i, i % 3 !== 0);
    }
    const exp = bridge.learningExport();
    expect(exp).not.toBeNull();
    expect(exp!.totalExperiences).toBeGreaterThanOrEqual(12);
  });

  // ── V25 Bridge ──
  it("V25Bridge initializes with all modules enabled", () => {
    const bridge = new V25Bridge({
      workflowGraph: true,
      triangulationGate: true,
      stepMiddleware: true,
      experiencePropagation: true,
    });
    bridge.initialize();
    const status = bridge.getStatus();
    expect(status.modules.workflowGraph).toBe(true);
    expect(status.modules.triangulationGate).toBe(true);
    expect(status.modules.stepMiddleware).toBe(true);
    expect(status.modules.healthMonitor).toBe(true);
    expect(status.modules.experiencePropagator).toBe(true);
    expect(status.modules.templateRegistry).toBe(true);
  });

  it("V25Bridge skips optional modules when FF disabled", () => {
    const bridge = new V25Bridge({
      workflowGraph: false,
      triangulationGate: false,
      stepMiddleware: false,
      experiencePropagation: false,
    });
    const status = bridge.getStatus();
    expect(status.modules.workflowGraph).toBe(false);
    expect(status.modules.triangulationGate).toBe(false);
    expect(status.modules.stepMiddleware).toBe(false);
    expect(status.modules.experiencePropagator).toBe(false);
    // contextProtocol is always available (lightweight)
    expect(status.modules.contextProtocol).toBe(true);
  });

  it("V25Bridge templateRegistry has 5 built-in templates after init", () => {
    const bridge = new V25Bridge({
      workflowGraph: false,
      triangulationGate: false,
      stepMiddleware: false,
      experiencePropagation: true,
    });
    bridge.initialize();
    const templates = bridge.templateRegistry!.getAll();
    expect(templates.length).toBe(5);
    const names = templates.map(t => t.name);
    expect(names).toContain("coder");
    expect(names).toContain("security-architect");
    expect(names).toContain("tester");
  });

  it("V25Bridge exportStatistics returns module stats", () => {
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
    expect(stats).toHaveProperty("experiencePropagator");
    expect(stats).toHaveProperty("templateRegistry");
  });

  // ── Cross-module: V24 ADR + V25 TriangulationGate ──
  it("cross-module: V24 ADR + V25 TriangulationGate voting", () => {
    const v24 = makeV24({ adrEnabled: true });
    const v25 = new V25Bridge({
      workflowGraph: false,
      triangulationGate: true,
      stepMiddleware: false,
      experiencePropagation: false,
    });
    v25.initialize();

    // Create and accept a critical ADR via v24
    v24.createADR("Auth", "Use JWT", "system", "critical");
    v24.acceptADR(1, "system", "Approved");

    // Simulate triangulation vote via v25
    v25.triangulationGate!.submitVote("adr-1", "validator-1", "JWT is standard", "accept", 0.9);
    v25.triangulationGate!.submitVote("adr-1", "validator-2", "Well established", "accept", 0.85);
    const result = v25.triangulationGate!.evaluateConsensus("adr-1", "Plan Gate auto-validated");
    expect(result.consensus).toBe(true);
    expect(result.acceptCount).toBe(2);
  });

  // ── Cross-module: HealthMonitor tracking ──
  it("cross-module: HealthMonitor records and recommends", () => {
    const bridge = new V25Bridge({
      workflowGraph: false,
      triangulationGate: false,
      stepMiddleware: true,
      experiencePropagation: false,
    });
    bridge.initialize();

    // Record enough health data to generate recommendations
    const monitor = bridge.healthMonitor!;
    for (let i = 0; i < 10; i++) {
      monitor.recordSuccess("agent-1", 100 + i * 10, 0.8);
    }
    monitor.recordFailure("agent-2", "timeout");
    monitor.recordFailure("agent-2", "timeout");
    monitor.recordFailure("agent-2", "timeout");
    monitor.recordFailure("agent-2", "timeout");
    monitor.recordFailure("agent-2", "timeout");

    const recs = monitor.getRecommendations();
    // agent-2 with 5 consecutive failures should trigger circuit breaker recommendation
    expect(recs.length).toBeGreaterThanOrEqual(1);
  });

  // ── Cross-module: ExperiencePropagator + AgentTemplateRegistry ──
  it("cross-module: ExperiencePropagator indexing + TemplateRegistry matching", () => {
    const bridge = new V25Bridge({
      workflowGraph: false,
      triangulationGate: false,
      stepMiddleware: false,
      experiencePropagation: true,
    });
    bridge.initialize();

    // Index experience
    bridge.experiencePropagator!.indexTemplate({
      id: "exp-1",
      name: "TypeScript API",
      techStack: "typescript",
      taskType: "api-development",
      complexity: "moderate",
      steps: ["design", "implement", "test"],
      backtracks: 0,
      durationEstimate: 120,
      successRate: 0.95,
      tags: ["api", "typescript"],
      sourceProject: "test-project",
      createdAt: Date.now(),
    });

    // Query by tech stack
    const result = bridge.experiencePropagator!.query({ techStack: "typescript" });
    expect(result.templates.length).toBe(1);
    expect(result.templates[0].name).toBe("TypeScript API");

    // Find matching templates
    const matches = bridge.templateRegistry!.match(["coding", "testing"]);
    expect(matches.length).toBeGreaterThan(0);
  });

  // ── Full v24+v25 collaboration ──
  it("full pipeline: v24 learning + v25 experience propagation", () => {
    const v24 = makeV24({ selfLearningEnabled: true });
    v24.init();
    const v25 = new V25Bridge({
      workflowGraph: false,
      triangulationGate: false,
      stepMiddleware: false,
      experiencePropagation: true,
    });
    v25.initialize();

    // Simulate v24 learning from tasks
    for (let i = 0; i < 5; i++) {
      v24.recordExperience("step7", "feature-" + i, true);
    }
    const learning = v24.learningExport();
    expect(learning).not.toBeNull();
    expect(learning!.totalExperiences).toBeGreaterThanOrEqual(5);

    // v25 indexes the project experience for future use
    v25.experiencePropagator!.indexTemplate({
      id: "project-1",
      name: "Dev Workflow Plugin",
      techStack: "typescript",
      taskType: "plugin-development",
      complexity: "complex",
      steps: ["spec", "implement", "test", "review"],
      backtracks: 2,
      durationEstimate: 240,
      successRate: 0.85,
      tags: ["plugin", "dev-workflow"],
      sourceProject: "dev-workflow-plugin",
      createdAt: Date.now(),
    });

    // Future projects can query this experience
    const future = v25.experiencePropagator!.query({ techStack: "typescript", taskType: "plugin-development" });
    expect(future.templates.length).toBe(1);
    expect(future.templates[0].sourceProject).toBe("dev-workflow-plugin");
  });

  // ── WorkflowGraph presets ──
  it("WorkflowGraph ULTRA_QUICK has 2 nodes and 1 edge", () => {
    const graph = WorkflowGraph.ULTRA_QUICK();
    const order = graph.executionOrder();
    expect(order.length).toBe(2);
    expect(order[0]).toBe("step1");
    expect(order[1]).toBe("step7");
  });

  it("WorkflowGraph STANDARD has 12 base steps with conditional branches", () => {
    const graph = WorkflowGraph.STANDARD();
    const order = graph.executionOrder();
    expect(order.length).toBe(12);
    expect(order[0]).toBe("step1");
    expect(order[11]).toBe("step12");
    const mermaid = graph.toMermaid();
    expect(mermaid).toContain("step6");
  });

  it("WorkflowGraph FULL adds v24/v25 enhancement nodes", () => {
    const graph = WorkflowGraph.FULL();
    const order = graph.executionOrder();
    expect(order.length).toBe(18);
    const mermaid = graph.toMermaid();
    expect(mermaid).toContain("adr_create");
    expect(mermaid).toContain("triangulate");
  });

  // ── ContextProtocol integration ──
  it("cross-module: ContextProtocol + ExperiencePropagator context injection", () => {
    const bridge = new V25Bridge({
      workflowGraph: false,
      triangulationGate: false,
      stepMiddleware: false,
      experiencePropagation: true,
    });
    bridge.initialize();

    // Index some experience
    bridge.experiencePropagator!.indexTemplate({
      id: "exp-test",
      name: "Test Exp",
      techStack: "python",
      taskType: "data-pipeline",
      complexity: "simple",
      steps: ["extract", "transform", "load"],
      backtracks: 0,
      durationEstimate: 60,
      successRate: 0.99,
      tags: ["etl"],
      sourceProject: "test",
      createdAt: Date.now(),
    });

    // Register context blocks via ContextProtocol
    bridge.contextProtocol!.register({
      id: "project-meta",
      type: "doc",
      description: "Test project",
      relevanceScore: 1.0,
      tokenCost: 50,
      content: "Project: test-project",
    });

    // Plan injection
    const plan = bridge.contextProtocol!.planInjection(2000);
    expect(plan.selected.length).toBeGreaterThanOrEqual(1);
    expect(plan.totalTokens).toBeGreaterThan(0);

    // Build context string
    const ctx = bridge.contextProtocol!.buildContextString(2000);
    expect(ctx).toContain("Test project");
  });
});
