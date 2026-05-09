// P15 v27: Workflow Experiment — A/B testing for workflow configurations.
// Runs two workflow configs on same project and compares fitness scores.
// Inspired by: GSD iterative philosophy + scientific method

import type { FeatureFlags } from '../types.js';
import { WorkflowFitness, type FitnessScore } from './workflow-fitness.js';

export interface ExperimentConfig {
  name: string;
  variantA: Partial<FeatureFlags>;
  variantB: Partial<FeatureFlags>;
  minRunsPerVariant: number; // for statistical significance (default 3)
}

export interface ExperimentResult {
  config: ExperimentConfig;
  variantA: { runs: FitnessScore[]; avgScore: number };
  variantB: { runs: FitnessScore[]; avgScore: number };
  winner: 'A' | 'B' | 'tie' | 'insufficient_data';
  confidence: number; // 0-1
  startedAt: string;
  completedAt?: string;
}

export class WorkflowExperiment {
  private experiments: Map<string, ExperimentResult> = new Map();
  private fitness: WorkflowFitness;

  constructor() {
    this.fitness = new WorkflowFitness();
  }

  /** Start a new experiment */
  start(name: string, variantA: Partial<FeatureFlags>, variantB: Partial<FeatureFlags>): ExperimentConfig {
    const config: ExperimentConfig = {
      name,
      variantA,
      variantB,
      minRunsPerVariant: 3,
    };

    this.experiments.set(name, {
      config,
      variantA: { runs: [], avgScore: 0 },
      variantB: { runs: [], avgScore: 0 },
      winner: 'insufficient_data',
      confidence: 0,
      startedAt: new Date().toISOString(),
    });

    return config;
  }

  /** Record a run result for an experiment variant */
  recordRun(experimentName: string, variant: 'A' | 'B', runId: string, scoreData: {
    taskCompletionRate: number;
    backtracksCount: number;
    userSatisfaction: number;
    timeToDelivery: number;
    defectDensity: number;
    mode: string;
    techStack: string[];
  }): FitnessScore {
    const score = this.fitness.score({
      runId,
      ...scoreData,
    });

    const exp = this.experiments.get(experimentName);
    if (!exp) return score;

    const target = variant === 'A' ? exp.variantA : exp.variantB;
    target.runs.push(score);
    target.avgScore = target.runs.reduce((s, r) => s + r.compositeScore, 0) / target.runs.length;

    // Evaluate winner
    this._evaluate(exp);

    return score;
  }

  /** Get experiment result */
  getResult(name: string): ExperimentResult | null {
    return this.experiments.get(name) ?? null;
  }

  /** Get all experiment results */
  getAllResults(): ExperimentResult[] {
    const results: ExperimentResult[] = [];
    this.experiments.forEach(r => { results.push(r); });
    return results;
  }

  getStatistics() {
    let totalExperiments = 0;
    let completedExperiments = 0;
    let winners: Record<string, string> = {};

    this.experiments.forEach((exp, name) => {
      totalExperiments++;
      if (exp.winner !== 'insufficient_data') {
        completedExperiments++;
        winners[name] = exp.winner;
      }
    });

    return {
      totalExperiments,
      completedExperiments,
      winners,
    };
  }

  private _evaluate(exp: ExperimentResult): void {
    const minRuns = exp.config.minRunsPerVariant;
    if (exp.variantA.runs.length < minRuns || exp.variantB.runs.length < minRuns) {
      exp.winner = 'insufficient_data';
      exp.confidence = Math.min(
        exp.variantA.runs.length / minRuns,
        exp.variantB.runs.length / minRuns
      );
      return;
    }

    const aScore = exp.variantA.avgScore;
    const bScore = exp.variantB.avgScore;
    const diff = aScore - bScore;

    if (Math.abs(diff) < 2) {
      exp.winner = 'tie';
      exp.confidence = 1 - Math.abs(diff) / 2;
    } else if (diff > 0) {
      exp.winner = 'A';
      exp.confidence = Math.min(1, Math.abs(diff) / 10);
    } else {
      exp.winner = 'B';
      exp.confidence = Math.min(1, Math.abs(diff) / 10);
    }
  }
}
