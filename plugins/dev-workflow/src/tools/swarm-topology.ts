/**
 * Swarm Topology Selector — v24 Pillar 1 module
 *
 * Selects and manages swarm topology for multi-agent coordination.
 * Principles #102-105: topology matching task structure,
 * capability-driven roles, adaptive switching, consensus protocol.
 *
 * Inspired by: Ruflo swarm topology + ClawTeam adaptive + CrewAI role-based
 */

// ── Types ──

export type SwarmTopology = "hierarchical" | "mesh" | "adaptive";

export interface AgentCapabilities {
  agentId: string;
  capabilities: string[];
  successRate: number; // 0-1
  avgSpeed: number;    // seconds per task
}

export interface TaskRequirements {
  taskId: string;
  requiredCapabilities: string[];
  complexity: "low" | "medium" | "high";
  dependencies: string[]; // task IDs this depends on
}

export interface SwarmConfig {
  topology: SwarmTopology;
  maxParallelAgents: number;
  failureRateThreshold: number;    // >0.5 → switch to hierarchical
  consecutivePassThreshold: number; // >3 → switch to mesh
}

export interface RoutingMatch {
  taskId: string;
  agentId: string;
  score: number;
  matchedCapabilities: string[];
}

export interface TopologyDecision {
  from: SwarmTopology;
  to: SwarmTopology;
  reason: string;
  timestamp: string;
}

// ── Defaults ──

export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  topology: "hierarchical",
  maxParallelAgents: 3,
  failureRateThreshold: 0.5,
  consecutivePassThreshold: 3,
};

// ── SwarmTopologySelector ──

export class SwarmTopologySelector {
  private config: SwarmConfig;
  private agents: Map<string, AgentCapabilities> = new Map();
  private consecutivePasses = 0;
  private decisionLog: TopologyDecision[] = [];
  private currentTopology: SwarmTopology;

  constructor(config?: Partial<SwarmConfig>) {
    this.config = { ...DEFAULT_SWARM_CONFIG, ...config };
    this.currentTopology = this.config.topology;
  }

  // ── Agent Registration (Principle #103) ──

  /** Register an agent with its capabilities */
  registerAgent(agent: AgentCapabilities): void {
    this.agents.set(agent.agentId, agent);
  }

  /** Unregister an agent */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /** Get all registered agents */
  getAgents(): AgentCapabilities[] {
    return [...this.agents.values()];
  }

  // ── Topology Selection (Principle #102) ──

  /** Get current topology */
  getTopology(): SwarmTopology {
    return this.currentTopology;
  }

  /** Select best topology for a set of tasks */
  selectTopology(tasks: TaskRequirements[]): SwarmTopology {
    if (this.config.topology !== "adaptive") {
      return this.config.topology;
    }

    // Heuristic: tasks with many dependencies → hierarchical
    const avgDeps = tasks.reduce((s, t) => s + t.dependencies.length, 0) / Math.max(tasks.length, 1);
    // Heuristic: many independent tasks → mesh (more parallelism)
    const independentRatio = tasks.filter(t => t.dependencies.length === 0).length / Math.max(tasks.length, 1);

    if (avgDeps > 2 || independentRatio < 0.3) {
      return "hierarchical";
    }
    if (independentRatio > 0.7 && tasks.length >= 3) {
      return "mesh";
    }
    return "hierarchical"; // safe default
  }

  // ── Adaptive Switching (Principle #104) ──

  /** Record a task completion for adaptive switching */
  recordCompletion(success: boolean): TopologyDecision | null {
    let decision: TopologyDecision | null = null;

    if (success) {
      this.consecutivePasses++;
    } else {
      this.consecutivePasses = 0;
    }

    // Check failure rate in current batch → switch to hierarchical
    if (this.currentTopology === "mesh" && !success) {
      // Simple: any failure in mesh mode → suggest hierarchical
      decision = this.switchTopology("hierarchical", "Failure detected in mesh mode, switching to controlled hierarchical");
    }

    // Check consecutive passes → switch to mesh
    if (this.currentTopology === "hierarchical" &&
        this.consecutivePasses >= this.config.consecutivePassThreshold) {
      decision = this.switchTopology("mesh", `${this.consecutivePasses} consecutive passes, switching to parallel mesh`);
      this.consecutivePasses = 0;
    }

    return decision;
  }

  /** Explicit topology switch */
  switchTopology(to: SwarmTopology, reason: string): TopologyDecision {
    const decision: TopologyDecision = {
      from: this.currentTopology,
      to,
      reason,
      timestamp: new Date().toISOString(),
    };
    this.currentTopology = to;
    this.decisionLog.push(decision);
    return decision;
  }

  // ── Capability Routing (Principle #114) ──

  /** Route tasks to best-matching agents based on capabilities */
  routeTasks(tasks: TaskRequirements[]): RoutingMatch[] {
    const matches: RoutingMatch[] = [];
    const assignedAgents = new Set<string>();

    for (const task of tasks) {
      const candidates = this.findCandidates(task);

      // Sort by score descending, pick first unassigned
      for (const candidate of candidates) {
        if (!assignedAgents.has(candidate.agentId) || this.currentTopology === "mesh") {
          matches.push(candidate);
          assignedAgents.add(candidate.agentId);
          break;
        }
      }
    }

    return matches;
  }

  /** Find candidate agents for a task */
  private findCandidates(task: TaskRequirements): RoutingMatch[] {
    const candidates: RoutingMatch[] = [];

    for (const agent of this.agents.values()) {
      const matchedCaps = task.requiredCapabilities.filter(c => agent.capabilities.includes(c));
      if (matchedCaps.length === 0) continue;

      // Score: capability overlap × success rate × speed factor
      const overlapRatio = matchedCaps.length / Math.max(task.requiredCapabilities.length, 1);
      const speedFactor = Math.min(1, 30 / Math.max(agent.avgSpeed, 1)); // faster = higher
      const score = overlapRatio * 0.6 + agent.successRate * 0.3 + speedFactor * 0.1;

      candidates.push({
        taskId: task.taskId,
        agentId: agent.agentId,
        score,
        matchedCapabilities: matchedCaps,
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  // ── Consensus Protocol (Principle #105) ──

  /**
   * Check if a critical decision has consensus.
   * Requires N/2 + 1 agents to agree.
   */
  checkConsensus(agentVotes: Record<string, boolean>, level: "critical" | "standard" | "trivial"): { decided: boolean; approved: boolean; votes: { yes: number; no: number; total: number } } {
    const votes = Object.values(agentVotes);
    const yes = votes.filter(v => v).length;
    const no = votes.length - yes;
    const total = this.agents.size;
    const required = Math.floor(total / 2) + 1;

    if (level === "trivial") {
      // Trivial: any single agent can decide
      return { decided: true, approved: yes > 0, votes: { yes, no, total } };
    }

    if (level === "standard") {
      // Standard: simple majority of voting agents
      return { decided: votes.length > 0, approved: yes > no, votes: { yes, no, total } };
    }

    // Critical: N/2+1 of ALL agents must agree (Principle #105)
    return { decided: yes >= required, approved: yes >= required, votes: { yes, no, total } };
  }

  // ── Query ──

  /** Get topology decision history */
  getDecisionLog(): TopologyDecision[] {
    return [...this.decisionLog];
  }

  /** Get current config */
  getConfig(): SwarmConfig {
    return { ...this.config };
  }

  /** Update config */
  updateConfig(update: Partial<SwarmConfig>): void {
    this.config = { ...this.config, ...update };
    if (update.topology) {
      this.currentTopology = update.topology;
    }
  }
}
