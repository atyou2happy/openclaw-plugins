// Context Injection Protocol — Principle #127
// Inspired by: MASFactory ContextBlock + Ruflo RAG memory
//
// Each context source declares: type, relevance_score, token_cost
// Injection sorts by relevance_score × (1/token_cost), truncates within budget

export type ContextType = 'memory' | 'doc' | 'search' | 'experience' | 'code' | 'test';

export interface ContextBlock {
  /** Unique block identifier */
  id: string;
  /** Source type */
  type: ContextType;
  /** Human-readable description */
  description: string;
  /** Relevance score 0-1 (higher = more relevant to current task) */
  relevanceScore: number;
  /** Estimated token cost of the content */
  tokenCost: number;
  /** The actual content (text) */
  content: string;
  /** Source metadata */
  source?: string;
  /** Creation timestamp */
  createdAt?: number;
}

export interface InjectionPlan {
  /** Blocks selected within budget, sorted by priority */
  selected: ContextBlock[];
  /** Total tokens used */
  totalTokens: number;
  /** Budget limit */
  budget: number;
  /** Blocks rejected due to budget (with reason) */
  rejected: Array<{ block: ContextBlock; reason: string }>;
}

export class ContextProtocol {
  private registry: Map<string, ContextBlock> = new Map();
  private defaultBudget: number;

  constructor(defaultBudget = 4000) {
    this.defaultBudget = defaultBudget;
  }

  /** Register a context block */
  register(block: ContextBlock): void {
    if (!block.id) throw new Error('ContextBlock must have an id');
    if (block.relevanceScore < 0 || block.relevanceScore > 1) {
      throw new Error('relevanceScore must be between 0 and 1');
    }
    if (block.tokenCost < 0) throw new Error('tokenCost must be non-negative');
    this.registry.set(block.id, block);
  }

  /** Unregister a context block */
  unregister(id: string): boolean {
    return this.registry.delete(id);
  }

  /** Get a registered block */
  get(id: string): ContextBlock | undefined {
    return this.registry.get(id);
  }

  /** List all registered blocks, optionally filtered by type */
  list(typeFilter?: ContextType): ContextBlock[] {
    const blocks = Array.from(this.registry.values());
    if (typeFilter) return blocks.filter(b => b.type === typeFilter);
    return blocks;
  }

  /**
   * Plan injection: select highest-priority blocks within token budget.
   * Priority = relevanceScore × (1 / tokenCost) — favors relevant + cheap blocks.
   */
  planInjection(budget?: number): InjectionPlan {
    const b = budget ?? this.defaultBudget;
    const blocks = Array.from(this.registry.values());

    // Sort by priority: relevanceScore / tokenCost (higher = better)
    // For zero-cost blocks, use a high effective priority
    const scored = blocks.map(block => {
      const effectiveCost = Math.max(block.tokenCost, 1);
      const priority = block.relevanceScore / effectiveCost;
      return { block, priority };
    });
    scored.sort((a, b) => b.priority - a.priority);

    const selected: ContextBlock[] = [];
    const rejected: Array<{ block: ContextBlock; reason: string }> = [];
    let totalTokens = 0;

    for (const { block, priority } of scored) {
      if (totalTokens + block.tokenCost <= b) {
        selected.push(block);
        totalTokens += block.tokenCost;
      } else {
        rejected.push({
          block,
          reason: `over budget (need ${block.tokenCost}, have ${b - totalTokens} remaining, priority=${priority.toFixed(3)})`,
        });
      }
    }

    return { selected, totalTokens, budget: b, rejected };
  }

  /**
   * Build the final injected context string from the injection plan.
   * Format: structured markdown blocks with metadata headers.
   */
  buildContextString(budget?: number): string {
    const plan = this.planInjection(budget);
    if (plan.selected.length === 0) return '';

    const sections = plan.selected.map(block => {
      const header = `[${block.type}] ${block.description} (relevance: ${(block.relevanceScore * 100).toFixed(0)}%, tokens: ${block.tokenCost})`;
      return `--- ${header} ---\n${block.content}`;
    });

    return sections.join('\n\n');
  }

  /** Get statistics about registered blocks */
  getStatistics(): {
    totalBlocks: number;
    totalTokens: number;
    byType: Record<string, number>;
    avgRelevance: number;
  } {
    const blocks = Array.from(this.registry.values());
    const byType: Record<string, number> = {};
    let totalTokens = 0;
    let totalRelevance = 0;

    for (const block of blocks) {
      byType[block.type] = (byType[block.type] ?? 0) + 1;
      totalTokens += block.tokenCost;
      totalRelevance += block.relevanceScore;
    }

    return {
      totalBlocks: blocks.length,
      totalTokens,
      byType,
      avgRelevance: blocks.length > 0 ? totalRelevance / blocks.length : 0,
    };
  }

  /** Clear all registered blocks */
  clear(): void {
    this.registry.clear();
  }
}
