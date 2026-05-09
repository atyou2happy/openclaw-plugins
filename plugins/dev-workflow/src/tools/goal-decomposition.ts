/**
 * Goal Decomposition Engine — v24 Pillar 4 module
 *
 * Recursively decomposes high-level goals into executable subtasks
 * with dependency ordering and complexity estimation.
 * Principles #113-115: recursive decomposition, dependency DAG,
 * complexity-adaptive granularity.
 *
 * Inspired by: Ruflo Goals + ClawTeam task decomposition + DevAll waterfall
 */

// ── Types ──

export type GoalComplexity = "trivial" | "moderate" | "complex" | "epic";
export type DecompositionStrategy = "horizontal" | "vertical" | "hybrid";

export interface Goal {
  id: string;
  title: string;
  description: string;
  complexity: GoalComplexity;
  parentGoalId?: string;
  subGoals: string[];        // child goal IDs
  dependencies: string[];    // goal IDs this depends on
  estimatedTasks: number;
  depth: number;             // nesting level (0 = top-level)
  status: "pending" | "in_progress" | "completed" | "blocked";
  createdAt: string;
}

export interface DecompositionResult {
  rootGoal: Goal;
  allGoals: Map<string, Goal>;
  executionOrder: string[];  // topologically sorted goal IDs
  maxDepth: number;
  totalGoals: number;
  complexityDistribution: Record<GoalComplexity, number>;
}

export interface DecompositionConfig {
  maxDepth: number;          // max recursion depth (default: 3)
  maxSubGoals: number;       // max children per goal (default: 5)
  minEstimatedTasks: number; // leaf goals must estimate >= this many tasks
  strategy: DecompositionStrategy;
}

// ── Defaults ──

export const DEFAULT_DECOMPOSITION_CONFIG: DecompositionConfig = {
  maxDepth: 3,
  maxSubGoals: 5,
  minEstimatedTasks: 1,
  strategy: "hybrid",
};

// ── GoalDecompositionEngine ──

export class GoalDecompositionEngine {
  private config: DecompositionConfig;
  private goals: Map<string, Goal> = new Map();
  private nextId = 1;

  constructor(config?: Partial<DecompositionConfig>) {
    this.config = { ...DEFAULT_DECOMPOSITION_CONFIG, ...config };
  }

  // ── Create Goal ──

  /** Create a top-level goal */
  createGoal(title: string, description: string, complexity?: GoalComplexity): Goal {
    const id = `goal-${this.nextId++}`;
    const goal: Goal = {
      id,
      title,
      description,
      complexity: complexity || this.estimateComplexity(description),
      subGoals: [],
      dependencies: [],
      estimatedTasks: 0,
      depth: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.goals.set(id, goal);
    return goal;
  }

  /** Decompose a goal into sub-goals (Principle #113) */
  decompose(
    goalId: string,
    subGoalDefs: Array<{ title: string; description: string; dependencies?: string[] }>,
  ): Goal[] {
    const parent = this.goals.get(goalId);
    if (!parent) throw new Error(`Goal ${goalId} not found`);
    if (parent.depth >= this.config.maxDepth) {
      throw new Error(`Max decomposition depth (${this.config.maxDepth}) reached for ${goalId}`);
    }

    const subGoals: Goal[] = [];
    const limit = Math.min(subGoalDefs.length, this.config.maxSubGoals);

    for (let i = 0; i < limit; i++) {
      const def = subGoalDefs[i];
      const id = `goal-${this.nextId++}`;
      const subGoal: Goal = {
        id,
        title: def.title,
        description: def.description,
        complexity: this.estimateComplexity(def.description),
        parentGoalId: goalId,
        subGoals: [],
        dependencies: def.dependencies || [],
        estimatedTasks: 0,
        depth: parent.depth + 1,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      this.goals.set(id, subGoal);
      parent.subGoals.push(id);
      subGoals.push(subGoal);
    }

    return subGoals;
  }

  // ── Dependency DAG (Principle #114) ──

  /** Add dependency between two goals */
  addDependency(goalId: string, dependsOnGoalId: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) return;
    if (!goal.dependencies.includes(dependsOnGoalId)) {
      goal.dependencies.push(dependsOnGoalId);
    }
  }

  /** Compute topological execution order */
  getExecutionOrder(rootGoalId: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visiting = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) return; // cycle guard
      visiting.add(id);

      const goal = this.goals.get(id);
      if (!goal) return;

      // Visit dependencies first
      for (const depId of goal.dependencies) {
        visit(depId);
      }
      // Visit sub-goals in order
      for (const subId of goal.subGoals) {
        visit(subId);
      }

      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    visit(rootGoalId);
    return order;
  }

  // ── Complexity Estimation (Principle #115) ──

  /** Estimate complexity from description heuristics */
  estimateComplexity(description: string): GoalComplexity {
    const lower = description.toLowerCase();
    const wordCount = description.split(/\s+/).length;

    // Signal words for complexity levels
    const epicSignals = ["system", "platform", "framework", "migration", "rewrite", "architecture"];
    const complexSignals = ["integrate", "pipeline", "workflow", "orchestrat", "multi-agent", "distributed"];
    const moderateSignals = ["feature", "module", "component", "service", "endpoint", "refactor"];

    const hasSignals = (signals: string[]) => signals.some(s => lower.includes(s));

    if (hasSignals(epicSignals) && wordCount > 50) return "epic";
    if (hasSignals(complexSignals) || wordCount > 30) return "complex";
    if (hasSignals(moderateSignals) || wordCount > 15) return "moderate";
    return "trivial";
  }

  /** Estimate task count for a goal (recursive) */
  estimateTaskCount(goalId: string): number {
    const goal = this.goals.get(goalId);
    if (!goal) return 0;

    if (goal.subGoals.length === 0) {
      // Leaf goal: estimate based on complexity
      const baseEstimates: Record<GoalComplexity, number> = {
        trivial: 1,
        moderate: 3,
        complex: 5,
        epic: 8,
      };
      goal.estimatedTasks = baseEstimates[goal.complexity];
      return goal.estimatedTasks;
    }

    // Non-leaf: sum of children
    let total = 0;
    for (const subId of goal.subGoals) {
      total += this.estimateTaskCount(subId);
    }
    goal.estimatedTasks = total;
    return total;
  }

  // ── Adaptive Granularity (Principle #115) ──

  /**
   * Check if decomposition is fine-grained enough.
   * Leaf goals should have estimatedTasks <= threshold.
   */
  checkGranularity(rootGoalId: string, maxTasksPerLeaf: number = 3): { adequate: boolean; oversized: Goal[] } {
    const oversized: Goal[] = [];
    const check = (id: string) => {
      const goal = this.goals.get(id);
      if (!goal) return;
      if (goal.subGoals.length === 0 && goal.estimatedTasks > maxTasksPerLeaf) {
        oversized.push(goal);
      }
      for (const subId of goal.subGoals) check(subId);
    };
    check(rootGoalId);
    return { adequate: oversized.length === 0, oversized };
  }

  // ── Full Decomposition ──

  /** Get full decomposition result for a root goal */
  getDecomposition(rootGoalId: string): DecompositionResult {
    const root = this.goals.get(rootGoalId);
    if (!root) throw new Error(`Goal ${rootGoalId} not found`);

    this.estimateTaskCount(rootGoalId);
    const order = this.getExecutionOrder(rootGoalId);

    // Collect all reachable goals
    const allGoals = new Map<string, Goal>();
    const collect = (id: string) => {
      const g = this.goals.get(id);
      if (!g || allGoals.has(id)) return;
      allGoals.set(id, g);
      for (const subId of g.subGoals) collect(subId);
    };
    collect(rootGoalId);

    let maxDepth = 0;
    const dist: Record<GoalComplexity, number> = { trivial: 0, moderate: 0, complex: 0, epic: 0 };
    for (const g of allGoals.values()) {
      if (g.depth > maxDepth) maxDepth = g.depth;
      dist[g.complexity]++;
    }

    return {
      rootGoal: root,
      allGoals,
      executionOrder: order,
      maxDepth,
      totalGoals: allGoals.size,
      complexityDistribution: dist,
    };
  }

  // ── Query ──

  /** Get goal by ID */
  get(goalId: string): Goal | undefined {
    return this.goals.get(goalId);
  }

  /** Get all goals */
  getAll(): Goal[] {
    return [...this.goals.values()];
  }

  /** Get leaf goals (no sub-goals) */
  getLeafGoals(rootGoalId: string): Goal[] {
    const leaves: Goal[] = [];
    const collect = (id: string) => {
      const g = this.goals.get(id);
      if (!g) return;
      if (g.subGoals.length === 0) leaves.push(g);
      for (const subId of g.subGoals) collect(subId);
    };
    collect(rootGoalId);
    return leaves;
  }

  /** Get config */
  getConfig(): DecompositionConfig {
    return { ...this.config };
  }
}
