// Inspired by: Houmao (fault-isolated processes),
// unified-search v2.0 PerformanceTracker (EMA + circuit breaker)
// v25 Pillar 7: Agent Health Monitor

export interface HealthRecord {
  agentId: string;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  qualityScore: number;
  lastSeen: number;
  /** Consecutive failure count for circuit breaker */
  consecutiveFailures: number;
  /** Circuit breaker state */
  circuitOpen: boolean;
  /** Total invocations */
  totalInvocations: number;
}

export interface HealthConfig {
  /** EMA alpha for latency smoothing (default: 0.3) */
  emaAlpha: number;
  /** Consecutive failures to trip circuit breaker (default: 5) */
  circuitBreakerThreshold: number;
  /** Quality score threshold below which to warn (default: 0.5) */
  qualityWarnThreshold: number;
}

const DEFAULT_CONFIG: HealthConfig = {
  emaAlpha: 0.3,
  circuitBreakerThreshold: 5,
  qualityWarnThreshold: 0.5,
};

export class AgentHealthMonitor {
  private health: Map<string, HealthRecord> = new Map();
  private config: HealthConfig;

  constructor(config?: Partial<HealthConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private ensureRecord(agentId: string): HealthRecord {
    if (!this.health.has(agentId)) {
      this.health.set(agentId, {
        agentId,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
        qualityScore: 0,
        lastSeen: Date.now(),
        consecutiveFailures: 0,
        circuitOpen: false,
        totalInvocations: 0,
      });
    }
    return this.health.get(agentId)!;
  }

  // ─── Recording ───

  recordSuccess(agentId: string, latencyMs: number, qualityScore: number): void {
    const rec = this.ensureRecord(agentId);
    rec.successes++;
    rec.totalInvocations++;
    rec.lastSeen = Date.now();
    rec.consecutiveFailures = 0;
    // If circuit was open and we got a success, close it
    rec.circuitOpen = false;

    // EMA update for latency
    rec.avgLatencyMs = rec.avgLatencyMs === 0
      ? latencyMs
      : rec.avgLatencyMs * (1 - this.config.emaAlpha) + latencyMs * this.config.emaAlpha;

    // EMA update for quality
    rec.qualityScore = rec.qualityScore === 0
      ? qualityScore
      : rec.qualityScore * (1 - this.config.emaAlpha) + qualityScore * this.config.emaAlpha;
  }

  recordFailure(agentId: string, _errorType: string): void {
    const rec = this.ensureRecord(agentId);
    rec.failures++;
    rec.totalInvocations++;
    rec.lastSeen = Date.now();
    rec.consecutiveFailures++;

    // Trip circuit breaker if threshold reached
    if (rec.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      rec.circuitOpen = true;
    }
  }

  // ─── Query ───

  getHealth(agentId: string): HealthRecord | undefined {
    return this.health.get(agentId);
  }

  getAllHealth(): HealthRecord[] {
    return Array.from(this.health.values());
  }

  /** Check if circuit breaker is tripped — agent should be degraded */
  shouldDegrade(agentId: string): boolean {
    const rec = this.health.get(agentId);
    return rec?.circuitOpen ?? false;
  }

  /** Get success rate for an agent */
  getSuccessRate(agentId: string): number {
    const rec = this.health.get(agentId);
    if (!rec || rec.totalInvocations === 0) return 1; // unknown agents assumed OK
    return rec.successes / rec.totalInvocations;
  }

  // ─── Circuit Breaker Control ───

  resetCircuit(agentId: string): boolean {
    const rec = this.health.get(agentId);
    if (!rec) return false;
    rec.circuitOpen = false;
    rec.consecutiveFailures = 0;
    return true;
  }

  // ─── Recommendations ───

  getRecommendations(): Array<{ agentId: string; action: string; reason: string }> {
    const recs: Array<{ agentId: string; action: string; reason: string }> = [];
    for (const rec of this.health.values()) {
      if (rec.circuitOpen) {
        recs.push({
          agentId: rec.agentId,
          action: 'avoid',
          reason: `Circuit breaker tripped: ${rec.consecutiveFailures} consecutive failures`,
        });
      } else if (rec.qualityScore < this.config.qualityWarnThreshold && rec.totalInvocations >= 3) {
        recs.push({
          agentId: rec.agentId,
          action: 'caution',
          reason: `Low quality score: ${rec.qualityScore.toFixed(2)} (threshold: ${this.config.qualityWarnThreshold})`,
        });
      } else if (rec.avgLatencyMs > 5000 && rec.totalInvocations >= 3) {
        recs.push({
          agentId: rec.agentId,
          action: 'timeout_increase',
          reason: `High avg latency: ${rec.avgLatencyMs.toFixed(0)}ms`,
        });
      }
    }
    return recs;
  }

  // ─── Statistics ───

  getStatistics(): {
    totalAgents: number;
    degradedAgents: number;
    avgSuccessRate: number;
    avgQuality: number;
    avgLatency: number;
  } {
    const records = Array.from(this.health.values());
    const n = records.length;
    return {
      totalAgents: n,
      degradedAgents: records.filter(r => r.circuitOpen).length,
      avgSuccessRate: n > 0 ? records.reduce((s, r) => s + (r.totalInvocations > 0 ? r.successes / r.totalInvocations : 1), 0) / n : 1,
      avgQuality: n > 0 ? records.reduce((s, r) => s + r.qualityScore, 0) / n : 0,
      avgLatency: n > 0 ? records.reduce((s, r) => s + r.avgLatencyMs, 0) / n : 0,
    };
  }

  // ─── Reset ───

  clear(agentId?: string): void {
    if (agentId) {
      this.health.delete(agentId);
    } else {
      this.health.clear();
    }
  }
}
