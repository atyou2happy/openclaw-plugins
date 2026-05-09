/**
 * v24 Integration Bridge — wires 4 Pillar modules into AgentTeamOrchestrator
 *
 * This is a lightweight integration layer. It does NOT modify the existing
 * AgentTeamOrchestrator class. Instead it provides a facade that composes
 * the 4 v24 modules alongside the existing team orchestrator.
 *
 * Pillar 1: SwarmTopologySelector  → topology-aware task routing
 * Pillar 2: SelfLearningEngine     → experience capture & adaptive thresholds
 * Pillar 3: ADRManager             → architecture decision records
 * Pillar 4: GoalDecompositionEngine → recursive goal decomposition
 */

import type { FeatureFlags } from "../types.js";
import { ADRManager, type ADR } from "./adr-manager.js";
import { SwarmTopologySelector, DEFAULT_SWARM_CONFIG, type SwarmConfig, type AgentCapabilities, type TaskRequirements, type RoutingMatch } from "./swarm-topology.js";
import { SelfLearningEngine, type Experience, type Pattern } from "./self-learning.js";
import { GoalDecompositionEngine, DEFAULT_DECOMPOSITION_CONFIG, type DecompositionConfig, type Goal, type DecompositionResult } from "./goal-decomposition.js";

// ── Types ──

export interface V24Config {
  projectDir: string;
  featureFlags: FeatureFlags;
  swarmConfig?: Partial<SwarmConfig>;
  decompositionConfig?: Partial<DecompositionConfig>;
}

export interface V24Status {
  adrEnabled: boolean;
  swarmEnabled: boolean;
  learningEnabled: boolean;
  goalDecompEnabled: boolean;
  capabilityRoutingEnabled: boolean;
  activeTopology: string;
  adrCount: number;
  experienceCount: number;
  patternCount: number;
}

// ── V24 Integration Bridge ──

export class V24Bridge {
  private config: V24Config;
  private adr: ADRManager | null = null;
  private swarm: SwarmTopologySelector | null = null;
  private learning: SelfLearningEngine | null = null;
  private goalEngine: GoalDecompositionEngine | null = null;

  constructor(config: V24Config) {
    this.config = config;
  }

  // ── Initialize all enabled modules ──

  init(): void {
    const ff = this.config.featureFlags;

    if (ff.adrEnabled) {
      this.adr = new ADRManager(this.config.projectDir);
      this.adr.init();
    }

    if (ff.swarmTopology !== "hierarchical" || ff.capabilityRouting) {
      // Only create swarm selector if non-default topology or routing enabled
      this.swarm = new SwarmTopologySelector({
        ...DEFAULT_SWARM_CONFIG,
        topology: ff.swarmTopology,
        ...this.config.swarmConfig,
      });
    }

    if (ff.selfLearningEnabled) {
      this.learning = new SelfLearningEngine(this.config.projectDir);
      this.learning.init();
      // Register adaptive thresholds
      this.learning.registerThreshold("coverageThreshold", ff.coverageThreshold);
      this.learning.registerThreshold("maxFileLines", ff.maxFileLines);
      this.learning.registerThreshold("maxFunctionLines", ff.maxFunctionLines);
    }

    if (ff.goalDecomposition) {
      this.goalEngine = new GoalDecompositionEngine({
        ...DEFAULT_DECOMPOSITION_CONFIG,
        ...this.config.decompositionConfig,
      });
    }
  }

  // ── ADR Integration (Pillar 3) ──

  /** Create an ADR for a design decision */
  createADR(title: string, context: string, decision: string, consequences: string, level: "critical" | "standard" | "trivial" = "standard"): ADR | null {
    return this.adr?.create(title, context, decision, consequences, level) ?? null;
  }

  /** Accept an ADR (called at Plan Gate) */
  acceptADR(id: number, actor?: string, reason?: string): ADR | null {
    return this.adr?.accept(id, actor, reason) ?? null;
  }

  /** Check if all ADRs are accepted (Plan Gate) */
  adrGateCheck(): { passed: boolean; blocking: ADR[] } {
    if (!this.adr) return { passed: true, blocking: [] };
    return this.adr.gateCheck();
  }

  /** Get ADR export for Retro */
  adrExport() {
    return this.adr?.export() ?? null;
  }

  // ── Swarm Integration (Pillar 1) ──

  /** Register an agent for capability routing */
  registerAgent(agent: AgentCapabilities): void {
    this.swarm?.registerAgent(agent);
  }

  /** Route tasks to agents using capability matching */
  routeTasks(tasks: TaskRequirements[]): RoutingMatch[] {
    if (!this.swarm) return [];
    return this.swarm.routeTasks(tasks);
  }

  /** Record task completion for adaptive topology switching */
  recordTaskCompletion(success: boolean) {
    return this.swarm?.recordCompletion(success) ?? null;
  }

  /** Get current topology */
  getTopology(): string {
    return this.swarm?.getTopology() ?? this.config.featureFlags.swarmTopology;
  }

  // ── Self-Learning Integration (Pillar 2) ──

  /** Record a task experience */
  recordExperience(
    step: string,
    taskDescription: string,
    success: boolean,
    errorOutput?: string,
  ): Experience | null {
    return this.learning?.recordFromTask(step, taskDescription, success, errorOutput) ?? null;
  }

  /** Get recommendation for a step based on learned patterns */
  getRecommendation(step: string, tags?: string[]): string | null {
    return this.learning?.getRecommendation(step, tags) ?? null;
  }

  /** Get adaptive threshold value */
  getAdaptiveThreshold(name: string): number {
    return this.learning?.getThreshold(name) ?? 0;
  }

  /** Adjust threshold based on recent success rate */
  adjustThreshold(name: string, successRate: number, reason: string): number {
    return this.learning?.adjustThreshold(name, successRate, reason) ?? 0;
  }

  /** Get learning export for Retro */
  learningExport() {
    return this.learning?.export() ?? null;
  }

  // ── Goal Decomposition Integration (Pillar 4) ──

  /** Create a top-level goal */
  createGoal(title: string, description: string): Goal | null {
    return this.goalEngine?.createGoal(title, description) ?? null;
  }

  /** Decompose a goal into sub-goals */
  decomposeGoal(goalId: string, subGoals: Array<{ title: string; description: string; dependencies?: string[] }>): Goal[] {
    if (!this.goalEngine) return [];
    return this.goalEngine.decompose(goalId, subGoals);
  }

  /** Get full decomposition */
  getDecomposition(goalId: string): DecompositionResult | null {
    if (!this.goalEngine) return null;
    return this.goalEngine.getDecomposition(goalId);
  }

  /** Get leaf goals as task list */
  getLeafGoals(goalId: string): Goal[] {
    return this.goalEngine?.getLeafGoals(goalId) ?? [];
  }

  // ── Status ──

  /** Get v24 module status */
  getStatus(): V24Status {
    const ff = this.config.featureFlags;
    return {
      adrEnabled: ff.adrEnabled,
      swarmEnabled: ff.swarmTopology !== "hierarchical" || ff.capabilityRouting,
      learningEnabled: ff.selfLearningEnabled,
      goalDecompEnabled: ff.goalDecomposition,
      capabilityRoutingEnabled: ff.capabilityRouting,
      activeTopology: this.getTopology(),
      adrCount: this.adr?.list().length ?? 0,
      experienceCount: this.learning?.getExperiences().length ?? 0,
      patternCount: this.learning?.getPatterns().length ?? 0,
    };
  }

  // ── Module Accessors (for advanced usage) ──

  getADRManager(): ADRManager | null { return this.adr; }
  getSwarmSelector(): SwarmTopologySelector | null { return this.swarm; }
  getLearningEngine(): SelfLearningEngine | null { return this.learning; }
  getGoalEngine(): GoalDecompositionEngine | null { return this.goalEngine; }
}
