/**
 * T-E1: Plan Gate 等待机制集成测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

function createMockRuntime() {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      }),
    },
    subagent: {
      run: vi.fn().mockResolvedValue({ runId: "run-1" }),
      waitForRun: vi.fn().mockResolvedValue({ status: "ok" }),
      getSessionMessages: vi.fn().mockResolvedValue({ messages: [] }),
      deleteSession: vi.fn(),
    },
    system: { runCommandWithTimeout: vi.fn() },
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-plan-gate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe("plan-gate-wait (T-E1)", () => {
  it("without pending gate, waitForPlanGateConfirmation returns true immediately", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "standard");
    const result = await engine.waitForPlanGateConfirmation(10_000);
    expect(result).toBe(true); // no gate pending → returns true
  });

  it("with pending gate, calling resolvePlanGate returns true from wait", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "standard");

    // Simulate what executeWorkflow does: create the wait, then wait
    engine.createPlanGateWait();
    const waitPromise = engine.waitForPlanGateConfirmation(10_000);

    // resolve the gate (simulates user calling plan_gate tool with action=confirm)
    engine.resolvePlanGate();

    const result = await waitPromise;
    expect(result).toBe(true);
    expect(engine.getContext()?.planGateConfirmed).toBe(true);
  });

  it("timeout returns false and clears the gate", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "standard");

    engine.createPlanGateWait();
    const result = await engine.waitForPlanGateConfirmation(50);

    expect(result).toBe(false);
    expect(engine.isPlanGateWaiting()).toBe(false);
  });

  it("isPlanGateWaiting reflects gate state", async () => {
    const { DevWorkflowEngine } = await import("../src/engine/index.js");
    const engine = new DevWorkflowEngine(createMockRuntime());
    await engine.initialize(testDir, "standard");

    expect(engine.isPlanGateWaiting()).toBe(false);

    engine.createPlanGateWait();
    expect(engine.isPlanGateWaiting()).toBe(true);

    engine.resolvePlanGate();
    await engine.waitForPlanGateConfirmation(10_000);
    expect(engine.isPlanGateWaiting()).toBe(false);
  });
});
