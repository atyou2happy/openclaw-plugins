// Experience Lifecycle Manager — Principle #130 (v26 Pillar 10: Experience Evolution)
// Inspired by: ChatDev Iterative Experience Refinement (IER)
// Pattern: acquire → utilize → propagate → expire, with decay and reinforcement
export interface LifecycleExperience {
  readonly id: string;
  readonly name: string;
  readonly techStack: string;
  readonly taskType: string;
  successRate: number;
  timesUsed: number;
  timesSucceeded: number;
  readonly createdAt: number;
  lastUsedAt: number;
  tags: string[];
  weight: number;
  status: 'active' | 'dormant' | 'expired';
}

export interface LifecycleConfig {
  readonly halfLifeDays: number;     // default 30 — weight halves every 30 days
  readonly dormantThreshold: number; // default 0.3 — below this, mark dormant
  readonly expireThreshold: number;  // default 0.1 — below this, expire
  readonly maxExperiences: number;   // default 100
  readonly reinforcementBonus: number; // default 0.15 — add on success
  readonly penaltyMalus: number;     // default 0.1 — subtract on failure
}

const DEFAULT_CONFIG: LifecycleConfig = {
  halfLifeDays: 30,
  dormantThreshold: 0.3,
  expireThreshold: 0.1,
  maxExperiences: 100,
  reinforcementBonus: 0.15,
  penaltyMalus: 0.1,
};

export class ExperienceLifecycle {
  private readonly experiences = new Map<string, LifecycleExperience>();
  private readonly config: LifecycleConfig;

  constructor(config: Partial<LifecycleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Record a new experience
  record(exp: Omit<LifecycleExperience, 'timesUsed' | 'timesSucceeded' | 'weight' | 'status' | 'lastUsedAt'>): LifecycleExperience {
    const entry: LifecycleExperience = {
      ...exp,
      timesUsed: 0,
      timesSucceeded: 0,
      lastUsedAt: Date.now(),
      weight: 1.0,
      status: 'active',
    };
    this.experiences.set(exp.id, entry);
    this.evictIfNeeded();
    return entry;
  }

  // Mark experience as used (success or failure)
  recordUsage(id: string, success: boolean): LifecycleExperience | null {
    const exp = this.experiences.get(id);
    if (!exp) return null;

    exp.timesUsed++;
    exp.lastUsedAt = Date.now();
    if (success) {
      exp.timesSucceeded++;
      exp.weight = Math.min(1.0, exp.weight + this.config.reinforcementBonus);
    } else {
      exp.weight = Math.max(0, exp.weight - this.config.penaltyMalus);
    }
    exp.successRate = exp.timesUsed > 0 ? exp.timesSucceeded / exp.timesUsed : 0;

    // Update status
    if (exp.weight < this.config.expireThreshold) {
      exp.status = 'expired';
    } else if (exp.weight < this.config.dormantThreshold) {
      exp.status = 'dormant';
    } else {
      exp.status = 'active';
    }

    return exp;
  }

  // Apply time-based decay to all experiences
  decay(): number {
    const now = Date.now();
    const halfLifeMs = this.config.halfLifeDays * 24 * 60 * 60 * 1000;
    let decayedCount = 0;

    for (const exp of this.experiences.values()) {
      if (exp.status === 'expired') continue;
      const age = now - exp.lastUsedAt;
      const decayFactor = Math.pow(0.5, age / halfLifeMs);
      exp.weight *= decayFactor;
      decayedCount++;

      if (exp.weight < this.config.expireThreshold) {
        exp.status = 'expired';
      } else if (exp.weight < this.config.dormantThreshold) {
        exp.status = 'dormant';
      }
    }
    return decayedCount;
  }

  // Query active experiences sorted by weight
  query(filter?: { techStack?: string; taskType?: string; tags?: string[] }): LifecycleExperience[] {
    let results = Array.from(this.experiences.values())
      .filter(e => e.status === 'active');

    if (filter?.techStack) {
      results = results.filter(e => e.techStack === filter.techStack);
    }
    if (filter?.taskType) {
      results = results.filter(e => e.taskType === filter.taskType);
    }
    if (filter?.tags && filter.tags.length > 0) {
      results = results.filter(e =>
        filter.tags!.some(t => e.tags.includes(t))
      );
    }

    return results.sort((a, b) => b.weight - a.weight);
  }

  // Prune expired experiences
  prune(): number {
    let pruned = 0;
    for (const [id, exp] of this.experiences) {
      if (exp.status === 'expired') {
        this.experiences.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  getStatistics() {
    const all = Array.from(this.experiences.values());
    return {
      total: all.length,
      active: all.filter(e => e.status === 'active').length,
      dormant: all.filter(e => e.status === 'dormant').length,
      expired: all.filter(e => e.status === 'expired').length,
      avgWeight: all.length > 0 ? all.reduce((s, e) => s + e.weight, 0) / all.length : 0,
    };
  }

  private evictIfNeeded(): void {
    if (this.experiences.size <= this.config.maxExperiences) return;
    // Remove lowest weight expired first, then dormant
    const sorted = Array.from(this.experiences.entries())
      .sort((a, b) => a[1].weight - b[1].weight);
    while (this.experiences.size > this.config.maxExperiences && sorted.length > 0) {
      const [id] = sorted.shift()!;
      this.experiences.delete(id);
    }
  }
}
