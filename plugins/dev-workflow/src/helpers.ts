// ─── Dev-Workflow Helper Functions ───
// Extracted from types.ts for separation of concerns.
// All helpers are re-exported from types.ts for backward compatibility.

import type { RefactorHealthLevel, WorkflowTask } from "./types.js";

export function healthLevelFromScore(score: number): RefactorHealthLevel {
  if (score >= 90) return "healthy";
  if (score >= 70) return "acceptable";
  if (score >= 50) return "needs-attention";
  return "technical-debt";
}

export function healthEmoji(level: RefactorHealthLevel): string {
  const map: Record<RefactorHealthLevel, string> = {
    healthy: "🟢",
    acceptable: "🟡",
    "needs-attention": "🟠",
    "technical-debt": "🔴",
  };
  return map[level];
}

export function normalizeTask(task: Partial<WorkflowTask> & Pick<WorkflowTask, "id" | "title" | "description">): WorkflowTask {
  return {
    status: "pending",
    difficulty: "medium",
    estimatedMinutes: 30,
    dependencies: [],
    files: [],
    shipCategory: "ship",
    granularity: "task",
    suggestedModel: "minimax/MiniMax-M2.7",
    maxLines: 200,
    subtasks: [],
    gates: [],
    ...task,
  };
}
