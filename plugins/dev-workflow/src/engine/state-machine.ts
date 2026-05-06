/**
 * State Machine for Dev-Workflow v11
 *
 * Driven by a directed graph of StateNodes with conditional transitions.
 * Inspired by LangGraph's StateGraph pattern:
 * - Nodes are step executors
 * - Edges are conditional transitions (success/fail/skip paths)
 * - Checkpoint after every node for crash recovery
 * - MAX_ITERATIONS guard prevents infinite loops
 *
 * Key improvements over v10 linear execution:
 * - Step 2 (handover) and Step 10 (security-audit) are now reachable
 * - All 6 fallback paths from SKILL.md are executable in code
 * - Resume from any checkpoint after crash
 * - Skip conditions are declarative per-node
 */

import type { WorkflowStep, WorkflowMode } from "../types.js";

// ─── Result Types ───

export type StepStatus = "success" | "failed" | "paused" | "skipped";

export interface StepResult {
  status: StepStatus;
  data?: Record<string, unknown>;
  error?: string;
  /** Token usage tracking for this step */
  tokenUsage?: number;
}

// ─── Transition ───

export interface Transition {
  /** Condition that must be true to take this edge */
  condition: (result: StepResult) => boolean;
  /** Target step to transition to */
  target: WorkflowStep;
}

// ─── State Node ───

export interface StateNode {
  /** The workflow step this node represents */
  step: WorkflowStep;
  /** Execute this step — receives engine context and returns result */
  execute: () => Promise<StepResult>;
  /** Conditional edges — evaluated in order, first match wins */
  transitions: Transition[];
  /** Fallback step when no transition matches (for error recovery) */
  fallback?: WorkflowStep;
  /** Skip this node entirely when condition is true */
  skipWhen?: () => boolean;
  /** Step to skip to when skipWhen is true (defaults to first transition target) */
  skipTarget?: WorkflowStep;
}

// ─── Checkpoint ───

export interface WorkflowCheckpoint {
  currentStep: WorkflowStep;
  iteration: number;
  timestamp: number;
  aborted: boolean;
}

// ─── Mode-based skip maps ───
// Defines which steps are skipped per mode (ultra/debug have different paths)

const SKIP_MAP: Record<WorkflowMode, WorkflowStep[]> = {
  ultra: [
    "step2-handover",
    "step4-spec",
    "step5-tech-selection",
    "step6-plan-gate",
    "step8-review",
    "step9-test",
    "step10-security-audit",
    "step11-docs",
  ],
  quick: [
    "step5-tech-selection",
    "step8-review",
    "step9-test",
    "step10-security-audit",
  ],
  standard: [
    "step5-tech-selection",
  ],
  full: [] as WorkflowStep[],
  debug: [
    "step4-spec",
    "step5-tech-selection",
    "step6-plan-gate",
    "step8-review",
    "step10-security-audit",
    "step11-docs",
  ],
};

// ─── State Machine ───

export class WorkflowStateMachine {
  private nodes: Map<WorkflowStep, StateNode> = new Map();
  private mode: WorkflowMode;
  private maxIterations: number;
  private iteration = 0;
  private aborted = false;
  private checkpointCallback?: (step: WorkflowStep, iteration: number) => void;

  constructor(mode: WorkflowMode, maxIterations = 50) {
    this.mode = mode;
    this.maxIterations = maxIterations;
  }

  /** Register a state node */
  addNode(node: StateNode): this {
    this.nodes.set(node.step, node);
    return this;
  }

  /** Set callback invoked after each successful step (for checkpoint persistence) */
  onCheckpoint(cb: (step: WorkflowStep, iteration: number) => void): this {
    this.checkpointCallback = cb;
    return this;
  }

  /** Abort the state machine (stops at next iteration) */
  abort(): void {
    this.aborted = true;
  }

  /** Check if aborted */
  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * Run the state machine from startStep until terminal condition.
   * Returns the final step and result.
   */
  async run(startStep: WorkflowStep): Promise<{ finalStep: WorkflowStep; finalResult: StepResult }> {
    let current = startStep;
    let lastResult: StepResult = { status: "success" };

    while (this.iteration < this.maxIterations && !this.aborted) {
      const node = this.nodes.get(current);
      if (!node) {
        throw new Error(`State machine: no node registered for step "${current}"`);
      }

      this.iteration++;

      // ── Skip check ──
      if (this.shouldSkip(current)) {
        const skipTarget = node.skipTarget ?? this.firstTransitionTarget(node);
        if (!skipTarget) {
          throw new Error(`State machine: skip target undefined for "${current}"`);
        }
        lastResult = { status: "skipped", data: { skippedReason: `${this.mode} mode` } };
        current = skipTarget;
        continue;
      }

      // ── Execute node ──
      try {
        lastResult = await node.execute();
      } catch (e) {
        lastResult = {
          status: "failed",
          error: String(e),
        };
      }

      // ── Checkpoint ──
      this.checkpointCallback?.(current, this.iteration);

      // ── Handle paused ──
      if (lastResult.status === "paused") {
        return { finalStep: current, finalResult: lastResult };
      }

      // ── Terminal node (no transitions) ──
      if (node.transitions.length === 0) {
        return { finalStep: current, finalResult: lastResult };
      }

      // ── Find next step via transitions ──
      const transition = node.transitions.find((t) => t.condition(lastResult));
      if (!transition) {
        // No transition matched — use fallback or throw
        if (node.fallback && lastResult.status === "failed") {
          current = node.fallback;
          continue;
        }
        if (lastResult.status === "skipped") {
          // Skip -> proceed to first transition target
          current = this.firstTransitionTarget(node) ?? "step12-delivery";
          continue;
        }
        // Truly stuck
        throw new Error(
          `State machine stuck at "${current}": no transition matched for status="${lastResult.status}"${lastResult.error ? ` error="${lastResult.error}"` : ""}`
        );
      }

      current = transition.target;
    }

    return { finalStep: current, finalResult: lastResult };
  }

  /** Get current iteration count */
  getIteration(): number {
    return this.iteration;
  }

  /** Whether a step should be skipped based on mode */
  private shouldSkip(step: WorkflowStep): boolean {
    return SKIP_MAP[this.mode]?.includes(step) ?? false;
  }

  /** Get the target of the first transition (used as default skip target) */
  private firstTransitionTarget(node: StateNode): WorkflowStep | undefined {
    return node.transitions[0]?.target;
  }
}
