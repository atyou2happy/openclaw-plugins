import { describe, it, expect } from "vitest";
import { WorkflowStateMachine, type StepResult } from "../src/engine/state-machine.js";
import type { WorkflowStep } from "../src/types.js";

describe("WorkflowStateMachine", () => {
  it("executes linear path from step2 to step12 in standard mode", async () => {
    const visited: WorkflowStep[] = [];
    const sm = new WorkflowStateMachine("standard", 50);

    const steps: WorkflowStep[] = [
      "step2-handover", "step3-requirement", "step4-spec", "step5-tech-selection",
      "step6-plan-gate", "step7-development", "step8-review", "step9-test",
      "step10-security-audit", "step11-docs", "step12-delivery",
    ];

    for (const step of steps) {
      sm.addNode({
        step,
        execute: async () => { visited.push(step); return { status: "success" }; },
        transitions: step === "step12-delivery"
          ? []
          : [{ condition: (r) => r.status === "success", target: steps[steps.indexOf(step) + 1] }],
      });
    }

    const { finalStep } = await sm.run("step2-handover");
    expect(finalStep).toBe("step12-delivery");
    // Standard mode skips step5-tech-selection only
    expect(visited).not.toContain("step5-tech-selection");
    expect(visited).toContain("step2-handover");
    expect(visited).toContain("step10-security-audit");
    expect(visited).toContain("step12-delivery");
  });

  it("skips steps based on mode (ultra)", async () => {
    const visited: WorkflowStep[] = [];
    const sm = new WorkflowStateMachine("ultra", 50);

    const allSteps: WorkflowStep[] = [
      "step2-handover", "step3-requirement", "step4-spec", "step5-tech-selection",
      "step6-plan-gate", "step7-development", "step8-review", "step9-test",
      "step10-security-audit", "step11-docs", "step12-delivery",
    ];

    for (const step of allSteps) {
      sm.addNode({
        step,
        execute: async () => { visited.push(step); return { status: "success" }; },
        transitions: step === "step12-delivery"
          ? []
          : [{ condition: (r) => r.status === "success", target: allSteps[allSteps.indexOf(step) + 1] }],
      });
    }

    await sm.run("step2-handover");

    // Ultra mode skips: step2-handover, step4-spec, step5-tech-selection, step6-plan-gate,
    // step8-review, step9-test, step10-security-audit, step11-docs
    expect(visited).toContain("step3-requirement");
    expect(visited).toContain("step7-development");
    expect(visited).toContain("step12-delivery");
    expect(visited).not.toContain("step4-spec");
    expect(visited).not.toContain("step6-plan-gate");
  });

  it("follows fallback on failure", async () => {
    const visited: WorkflowStep[] = [];
    const sm = new WorkflowStateMachine("full", 50);

    sm.addNode({
      step: "step9-test",
      execute: async () => { visited.push("step9-test"); return { status: "failed" }; },
      transitions: [
        { condition: (r) => r.status === "success", target: "step10-security-audit" },
        { condition: (r) => r.status === "failed", target: "step7-development" },
      ],
      fallback: "step7-development",
    });

    sm.addNode({
      step: "step7-development",
      execute: async () => { visited.push("step7-development"); return { status: "success" }; },
      transitions: [
        { condition: (r) => r.status === "success", target: "step12-delivery" },
      ],
    });

    sm.addNode({
      step: "step12-delivery",
      execute: async () => { visited.push("step12-delivery"); return { status: "success" }; },
      transitions: [],
    });

    await sm.run("step9-test");

    // step9 failed -> transition to step7 -> step12
    expect(visited).toEqual(["step9-test", "step7-development", "step12-delivery"]);
  });

  it("stops when paused", async () => {
    const sm = new WorkflowStateMachine("standard", 50);

    sm.addNode({
      step: "step6-plan-gate",
      execute: async () => ({ status: "paused", data: { approved: false } }),
      transitions: [
        { condition: (r) => r.status === "paused", target: "step4-spec" },
      ],
    });

    const { finalStep, finalResult } = await sm.run("step6-plan-gate");
    expect(finalStep).toBe("step6-plan-gate");
    expect(finalResult.status).toBe("paused");
  });

  it("respects max iterations", async () => {
    const sm = new WorkflowStateMachine("standard", 3);

    sm.addNode({
      step: "step3-requirement",
      execute: async () => ({ status: "success" }),
      transitions: [
        { condition: (r) => r.status === "success", target: "step3-requirement" }, // loop!
      ],
    });

    const { finalStep } = await sm.run("step3-requirement");
    // Should stop at step3 after 3 iterations, not infinite loop
    expect(finalStep).toBe("step3-requirement");
    expect(sm.getIteration()).toBe(3);
  });

  it("supports abort", async () => {
    const sm = new WorkflowStateMachine("standard", 50);
    let calls = 0;

    sm.addNode({
      step: "step3-requirement",
      execute: async () => {
        calls++;
        if (calls === 1) sm.abort();
        return { status: "success" };
      },
      transitions: [
        { condition: (r) => r.status === "success", target: "step4-spec" },
      ],
    });

    sm.addNode({
      step: "step4-spec",
      execute: async () => { calls++; return { status: "success" }; },
      transitions: [],
    });

    await sm.run("step3-requirement");
    // First call aborts, so step4 never runs
    expect(calls).toBe(1);
    expect(sm.isAborted()).toBe(true);
  });

  it("invokes checkpoint callback after each step", async () => {
    const checkpoints: Array<{ step: WorkflowStep; iteration: number }> = [];
    const sm = new WorkflowStateMachine("standard", 50);

    sm.onCheckpoint((step, iteration) => {
      checkpoints.push({ step, iteration });
    });

    sm.addNode({
      step: "step3-requirement",
      execute: async () => ({ status: "success" }),
      transitions: [{ condition: (r) => r.status === "success", target: "step12-delivery" }],
    });

    sm.addNode({
      step: "step12-delivery",
      execute: async () => ({ status: "success" }),
      transitions: [],
    });

    await sm.run("step3-requirement");
    expect(checkpoints.length).toBe(2);
    expect(checkpoints[0].step).toBe("step3-requirement");
    expect(checkpoints[1].step).toBe("step12-delivery");
  });

  it("throws on missing node", async () => {
    const sm = new WorkflowStateMachine("standard", 50);
    // No nodes registered
    await expect(sm.run("step3-requirement")).rejects.toThrow('no node registered for step "step3-requirement"');
  });

  it("full mode visits all steps including step10-security-audit", async () => {
    const visited: WorkflowStep[] = [];
    const sm = new WorkflowStateMachine("full", 50);

    const allSteps: WorkflowStep[] = [
      "step2-handover", "step3-requirement", "step4-spec", "step5-tech-selection",
      "step6-plan-gate", "step7-development", "step8-review", "step9-test",
      "step10-security-audit", "step11-docs", "step12-delivery",
    ];

    for (const step of allSteps) {
      sm.addNode({
        step,
        execute: async () => { visited.push(step); return { status: "success" }; },
        transitions: step === "step12-delivery"
          ? []
          : [{ condition: (r) => r.status === "success", target: allSteps[allSteps.indexOf(step) + 1] }],
      });
    }

    await sm.run("step2-handover");
    // Full mode should visit ALL steps
    expect(visited).toEqual(allSteps);
  });
});
