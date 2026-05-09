// P15 v27: Workflow Fitness — fitness scoring for completed workflow runs.
// Tracks 5 dimensions: completion rate, backtracks, satisfaction, time, defects.
// Feeds into Meta-Optimization engine.
// Inspired by: GSD iterative philosophy + v26 ExperienceLifecycle

export interface FitnessScore {
  runId: string;
  taskCompletionRate: number;   // 0-1
  backtracksCount: number;       // lower is better
  userSatisfaction: number;      // 0-1 (explicit or implicit)
  timeToDelivery: number;        // minutes, lower is better
  defectDensity: number;         // defects per 1000 lines
  compositeScore: number;        // weighted composite 0-100
  scoredAt: string;
  mode: string;
  techStack: string[];
}

export interface FitnessConfig {
  weights: {
    completion: number;
    backtracks: number;
    satisfaction: number;
    time: number;
    defects: number;
  };
}

const DEFAULT_FITNESS_CONFIG: FitnessConfig = {
  weights: {
    completion: 0.30,
    backtracks: 0.20,
    satisfaction: 0.20,
    time: 0.15,
    defects: 0.15,
  },
};

export class WorkflowFitness {
  private scores: FitnessScore[] = [];
  private config: FitnessConfig;
  private stats = { runs: 0, avgScore: 0 };

  constructor(config?: Partial<FitnessConfig>) {
    this.config = { ...DEFAULT_FITNESS_CONFIG, ...config };
  }

  /** Score a completed workflow run */
  score(params: {
    runId: string;
    taskCompletionRate: number;
    backtracksCount: number;
    userSatisfaction: number;
    timeToDelivery: number;
    defectDensity: number;
    mode: string;
    techStack: string[];
  }): FitnessScore {
    const w = this.config.weights;

    // Normalize backtracks: 0 = perfect, 5+ = worst
    const backtrackScore = Math.max(0, 1 - params.backtracksCount / 5);

    // Normalize time: <10min = perfect, >240min = worst
    const timeScore = Math.max(0, 1 - params.timeToDelivery / 240);

    // Normalize defects: 0 = perfect, 10+ = worst
    const defectScore = Math.max(0, 1 - params.defectDensity / 10);

    const composite = Math.round(
      (params.taskCompletionRate * w.completion +
       backtrackScore * w.backtracks +
       params.userSatisfaction * w.satisfaction +
       timeScore * w.time +
       defectScore * w.defects) * 100
    );

    const score: FitnessScore = {
      runId: params.runId,
      taskCompletionRate: params.taskCompletionRate,
      backtracksCount: params.backtracksCount,
      userSatisfaction: params.userSatisfaction,
      timeToDelivery: params.timeToDelivery,
      defectDensity: params.defectDensity,
      compositeScore: composite,
      scoredAt: new Date().toISOString(),
      mode: params.mode,
      techStack: params.techStack,
    };

    this.scores.push(score);
    this.stats.runs++;
    this.stats.avgScore = this.scores.reduce((s, sc) => s + sc.compositeScore, 0) / this.scores.length;

    return score;
  }

  /** Get top N best performing runs */
  getTopRuns(n: number = 10): FitnessScore[] {
    return [...this.scores]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, n);
  }

  /** Get fitness by tech stack */
  getByTechStack(stack: string): FitnessScore[] {
    return this.scores.filter(s => s.techStack.includes(stack));
  }

  /** Get fitness by mode */
  getByMode(mode: string): FitnessScore[] {
    return this.scores.filter(s => s.mode === mode);
  }

  /** Compare two workflow configurations by their fitness scores */
  compare(ids: string[]): { winner: string | null; scores: Record<string, number> } {
    const scoreMap: Record<string, number> = {};
    ids.forEach(id => {
      const score = this.scores.find(s => s.runId === id);
      if (score) scoreMap[id] = score.compositeScore;
    });

    const entries = Object.entries(scoreMap);
    if (entries.length === 0) return { winner: null, scores: scoreMap };

    entries.sort((a, b) => b[1] - a[1]);
    return { winner: entries[0][0], scores: scoreMap };
  }

  getStatistics() {
    return {
      runs: this.stats.runs,
      avgScore: Math.round(this.stats.avgScore),
      bestScore: this.scores.length > 0 ? Math.max(...this.scores.map(s => s.compositeScore)) : 0,
      worstScore: this.scores.length > 0 ? Math.min(...this.scores.map(s => s.compositeScore)) : 0,
    };
  }
}
