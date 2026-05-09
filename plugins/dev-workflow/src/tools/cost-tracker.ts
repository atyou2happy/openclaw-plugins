// P14 v27: Cost Tracker — real-time token cost monitoring per step and agent.
// Integrates with v26 StepEventStream for per-event token metrics.
// Inspired by: 40x Cost Wall research + Gas Town concept

export type CostTier = 'economy' | 'standard' | 'premium';

export interface CostConfig {
  stepCostTiers: Record<string, CostTier>;
}

export interface StepCost {
  step: string;
  tier: CostTier;
  tokensUsed: number;
  estimatedCost: number;
  budgetRemaining: number;
}

export interface AgentCost {
  agentId: string;
  step: string;
  tokensUsed: number;
  modelUsed: string;
  timestamp: string;
}

const TIER_COST_PER_1K: Record<CostTier, number> = {
  economy: 0.0001,   // ~$0.10 per 1M tokens
  standard: 0.001,   // ~$1 per 1M tokens
  premium: 0.01,     // ~$10 per 1M tokens
};

export class CostTracker {
  private stepCosts: Map<string, StepCost> = new Map();
  private agentCosts: AgentCost[] = [];
  private config: CostConfig;
  private totalTokens = 0;
  private totalEstimatedCost = 0;

  constructor(config?: Partial<CostConfig>) {
    this.config = { stepCostTiers: {}, ...config };
  }

  /** Register a step with a cost tier */
  registerStep(step: string, tier?: CostTier): StepCost {
    const effectiveTier = tier ?? this.config.stepCostTiers[step] ?? 'standard';
    const cost: StepCost = {
      step,
      tier: effectiveTier,
      tokensUsed: 0,
      estimatedCost: 0,
      budgetRemaining: 0,
    };
    this.stepCosts.set(step, cost);
    return cost;
  }

  /** Record token usage for a step */
  recordTokens(step: string, tokens: number): void {
    const cost = this.stepCosts.get(step);
    if (!cost) {
      const newCost = this.registerStep(step);
      newCost.tokensUsed += tokens;
      newCost.estimatedCost = this._calcCost(tokens, newCost.tier);
    } else {
      cost.tokensUsed += tokens;
      cost.estimatedCost += this._calcCost(tokens, cost.tier);
    }

    this.totalTokens += tokens;
    this.totalEstimatedCost += this._calcCost(tokens, cost?.tier ?? 'standard');
  }

  /** Record agent-level cost */
  recordAgentCost(agentId: string, step: string, tokensUsed: number, modelUsed: string): AgentCost {
    const cost: AgentCost = {
      agentId,
      step,
      tokensUsed,
      modelUsed,
      timestamp: new Date().toISOString(),
    };
    this.agentCosts.push(cost);
    this.recordTokens(step, tokensUsed);
    return cost;
  }

  /** Get cost summary for all steps */
  getStepCosts(): StepCost[] {
    const result: StepCost[] = [];
    this.stepCosts.forEach(cost => { result.push({ ...cost }); });
    return result;
  }

  /** Get agent cost history */
  getAgentCosts(agentId?: string): AgentCost[] {
    if (!agentId) return [...this.agentCosts];
    return this.agentCosts.filter(c => c.agentId === agentId);
  }

  /** Check if budget exceeded */
  isOverBudget(budget: number): boolean {
    return this.totalTokens > budget;
  }

  /** Get warning if approaching budget */
  getBudgetWarning(budget: number): string | null {
    const ratio = this.totalTokens / budget;
    if (ratio > 0.95) return `CRITICAL: ${Math.round(ratio * 100)}% of budget used`;
    if (ratio > 0.80) return `WARNING: ${Math.round(ratio * 100)}% of budget used`;
    if (ratio > 0.60) return `Notice: ${Math.round(ratio * 100)}% of budget used`;
    return null;
  }

  getStatistics() {
    const stepBreakdown: Record<string, { tokens: number; cost: number; tier: CostTier }> = {};
    this.stepCosts.forEach((cost, step) => {
      stepBreakdown[step] = { tokens: cost.tokensUsed, cost: cost.estimatedCost, tier: cost.tier };
    });

    return {
      totalTokens: this.totalTokens,
      totalEstimatedCost: this.totalEstimatedCost,
      stepBreakdown,
      agentCount: this.agentCosts.length,
    };
  }

  private _calcCost(tokens: number, tier: CostTier): number {
    return (tokens / 1000) * TIER_COST_PER_1K[tier];
  }
}
