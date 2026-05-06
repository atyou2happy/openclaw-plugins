import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowMode } from "../../types.js";

/** ACPX 智能路由 - 模型池 */
export const ACPX_MODEL_POOL = {
  kilocode: {
    code: "minimax/MiniMax-M2.7",
    orchestrator: "minimax/MiniMax-M2.7",
    architect: "minimax/MiniMax-M2.7",
    debug: "minimax/MiniMax-M2.7",
    review: "kilo/meta-llama/llama-3.3-70b-instruct",
    test: "minimax/MiniMax-M2.7",
    fast: "kilo/qwen/qwen3-coder:free",
    smart: "kilo/google/gemma-3-27b-it:free",
    multi: "kilo/moonshotai/kimi-k2:free",
  },
  opencode: {
    code: "minimax/MiniMax-M2.7",
    review: "minimax/MiniMax-M2.7",
    fast: "opencode/qwen3-coder-free",
    smart: "opencode/gemma-3-27b-free",
    test: "opencode/step-3.5-flash-free",
  },
} as const;

export const MODE_MODELS: Record<WorkflowMode, Record<string, string>> = {
  quick: { brainstorm: "llama-3.3-70b", spec: "minimax-m2.5", tech: "minimax-m2.5", coder: "minimax-m2.7", reviewer: "glm-5.1", test: "minimax-m2.5", docs: "llama-3.3-70b", qa: "glm-5.1" },
  standard: { brainstorm: "llama-3.3-70b", spec: "minimax-m2.5", tech: "minimax-m2.5", coder: "minimax-m2.7", reviewer: "glm-5.1", test: "minimax-m2.5", docs: "llama-3.3-70b", qa: "glm-5.1" },
  debug: { brainstorm: "llama-3.3-70b", spec: "glm-5.1", tech: "glm-5.1", coder: "glm-5.1", reviewer: "glm-5.1", test: "glm-5.1", docs: "minimax-m2.5", qa: "glm-5.1" },
  full: { brainstorm: "llama-3.3-70b", spec: "glm-5.1", tech: "glm-5.1", coder: "glm-5.1", reviewer: "glm-5.1", test: "glm-5.1", docs: "llama-3.3-70b", qa: "glm-5.1" },
  ultra: { brainstorm: "llama-3.3-70b", spec: "minimax-m2.5", tech: "minimax-m2.5", coder: "minimax-m2.7", reviewer: "glm-5.1", test: "minimax-m2.5", docs: "llama-3.3-70b", qa: "glm-5.1" },
};

export function routeByComplexity(complexity: string): { tool: string; model: string } {
  const routes: Record<string, { tool: string; model: string }> = {
    L1: { tool: "direct", model: "direct" },
    L2: { tool: "acpx-opencode", model: "minimax/MiniMax-M2.7" },
    L3: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7" },
    L4: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7" },
    L5: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7" },
  };
  return routes[complexity] ?? routes.L3;
}

export function routeByGranularity(granularity: "feature" | "task" | "subtask"): { tool: string; model: string; maxLines: number } {
  const granularityRoutes = {
    feature: { tool: "acpx-kilocode", model: "zai/GLM-5.1", maxLines: 999 },
    task: { tool: "acpx-kilocode", model: "minimax/MiniMax-M2.7", maxLines: 200 },
    subtask: { tool: "acpx-opencode", model: "minimax/MiniMax-M2.7", maxLines: 50 },
  };
  return granularityRoutes[granularity];
}

export function selectAgent(difficulty: string): string {
  const modelMapping: Record<string, string> = { easy: "minimax-m2.5", medium: "minimax-m2.5", hard: "glm-5.1", extreme: "qwen3" };
  return modelMapping[difficulty] ?? "minimax-m2.7";
}

export function selectModel(role: string, mode: WorkflowMode, difficulty?: string, modelOverride?: Record<string, string>): string {
  if (modelOverride && modelOverride[role]) return modelOverride[role];
  if (role === "coder" && difficulty) {
    const difficultyUpgrade: Record<string, string> = { hard: "glm-5.1", extreme: "glm-5.1" };
    if (difficultyUpgrade[difficulty]) return difficultyUpgrade[difficulty];
  }
  return MODE_MODELS[mode]?.[role] ?? "minimax-m2.7";
}
