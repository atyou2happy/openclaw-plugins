// Inspired by: ChatDev IER (Iterative Experience Refinement),
// CrewAI (Flows), AG2 (trajectory learning)
// v25 Enhancement: Experience Propagation

export interface ExperienceTemplate {
  id: string;
  name: string;
  techStack: string;
  taskType: string;
  complexity: 'simple' | 'moderate' | 'complex';
  steps: string[];
  backtracks: number;
  durationEstimate: number; // minutes
  successRate: number; // 0-1
  tags: string[];
  sourceProject: string;
  createdAt: number;
}

export interface PropagationQuery {
  techStack?: string;
  taskType?: string;
  complexity?: string;
  limit?: number;
}

export interface PropagationResult {
  templates: ExperienceTemplate[];
  totalIndexed: number;
  queryTimeMs: number;
}

export class ExperiencePropagator {
  private index: ExperienceTemplate[] = [];
  private maxIndexSize: number;

  constructor(maxIndexSize = 1000) {
    this.maxIndexSize = maxIndexSize;
  }

  // ─── Index Management ───

  indexTemplate(template: ExperienceTemplate): void {
    if (!template?.id) throw new Error('Template must have an id');
    // Remove existing with same id
    this.index = this.index.filter(t => t.id !== template.id);
    this.index.push(template);
    // Enforce max size (FIFO eviction)
    if (this.index.length > this.maxIndexSize) {
      this.index.shift();
    }
  }

  removeTemplate(id: string): boolean {
    const before = this.index.length;
    this.index = this.index.filter(t => t.id !== id);
    return this.index.length < before;
  }

  // ─── Query ───

  query(query: PropagationQuery): PropagationResult {
    const start = Date.now();
    let results = [...this.index];

    if (query.techStack) {
      const stack = query.techStack.toLowerCase();
      results = results.filter(t =>
        t.techStack.toLowerCase().includes(stack) ||
        t.tags.some(tag => tag.toLowerCase().includes(stack)),
      );
    }

    if (query.taskType) {
      const type = query.taskType.toLowerCase();
      results = results.filter(t => t.taskType.toLowerCase().includes(type));
    }

    if (query.complexity) {
      results = results.filter(t => t.complexity === query.complexity);
    }

    // Sort by: successRate desc, then backtracks asc
    results.sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      return a.backtracks - b.backtracks;
    });

    const limit = query.limit ?? 3;
    return {
      templates: results.slice(0, limit),
      totalIndexed: this.index.length,
      queryTimeMs: Date.now() - start,
    };
  }

  /** Convenience: query for a new project's Step 1 auto-recommendation */
  recommendForProject(techStack: string, taskType: string): ExperienceTemplate[] {
    return this.query({ techStack, taskType, limit: 3 }).templates;
  }

  // ─── Template Creation Helper ───

  static createTemplate(params: {
    id: string;
    name: string;
    techStack: string;
    taskType: string;
    complexity: 'simple' | 'moderate' | 'complex';
    steps: string[];
    backtracks: number;
    durationEstimate: number;
    sourceProject: string;
  }): ExperienceTemplate {
    return {
      ...params,
      successRate: 1, // new templates assumed successful
      tags: params.techStack.split(',').map(s => s.trim().toLowerCase()),
      createdAt: Date.now(),
    };
  }

  // ─── Statistics ───

  getStatistics(): {
    totalTemplates: number;
    byTechStack: Record<string, number>;
    byTaskType: Record<string, number>;
    avgSuccessRate: number;
    avgBacktracks: number;
  } {
    const byStack: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const t of this.index) {
      byStack[t.techStack] = (byStack[t.techStack] ?? 0) + 1;
      byType[t.taskType] = (byType[t.taskType] ?? 0) + 1;
    }
    const n = this.index.length;
    return {
      totalTemplates: n,
      byTechStack: byStack,
      byTaskType: byType,
      avgSuccessRate: n > 0 ? this.index.reduce((s, t) => s + t.successRate, 0) / n : 0,
      avgBacktracks: n > 0 ? this.index.reduce((s, t) => s + t.backtracks, 0) / n : 0,
    };
  }

  // ─── Serialization ───

  toJSON(): ExperienceTemplate[] {
    return [...this.index];
  }

  static fromJSON(templates: ExperienceTemplate[]): ExperiencePropagator {
    const ep = new ExperiencePropagator();
    ep.index = templates;
    return ep;
  }

  // ─── Reset ───

  clear(): void {
    this.index.length = 0;
  }
}
