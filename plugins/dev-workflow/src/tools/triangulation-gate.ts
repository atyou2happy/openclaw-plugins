// Inspired by: CoReason-MACO (Architectural Triangulation / Council of Models),
// Ruflo (Swarm Consensus N/2+1),
// ChatDev (CEO+CTO seminars)
// v25 Pillar 6: Council Gate

export type Verdict = 'accept' | 'reject' | 'abstain';

export interface VoteRecord {
  voter: string;
  opinion: string;
  verdict: Verdict;
  confidence: number; // 0-1
  timestamp: number;
}

export interface GateResult {
  consensus: boolean;
  votes: VoteRecord[];
  judgeSummary: string;
  alternatives: string[];
  /** N/2+1 threshold */
  threshold: number;
  /** Accept count */
  acceptCount: number;
  /** Reject count */
  rejectCount: number;
}

export interface Counterfactual {
  adrId: string;
  rejectedAlternative: string;
  analysis: string;
  timestamp: number;
}

export interface TriangulationConfig {
  /** Minimum votes required (default: 2) */
  minVotes: number;
  /** Consensus threshold: accept count must be > totalVotes * ratio (default: 0.5) */
  consensusRatio: number;
  /** Minimum confidence to count a vote (default: 0.5) */
  minConfidence: number;
}

const DEFAULT_CONFIG: TriangulationConfig = {
  minVotes: 2,
  consensusRatio: 0.5,
  minConfidence: 0.5,
};

export class TriangulationGate {
  private votes: Map<string, VoteRecord[]> = new Map();
  private counterfactuals: Counterfactual[] = [];
  private eventLog: Array<{adrId: string; action: string; timestamp: number; data: unknown}> = [];
  private config: TriangulationConfig;

  constructor(config?: Partial<TriangulationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Voting ───

  submitVote(adrId: string, voterId: string, opinion: string, verdict: Verdict, confidence: number): void {
    if (!adrId || !voterId) throw new Error('adrId and voterId are required');
    if (!this.votes.has(adrId)) this.votes.set(adrId, []);
    const record: VoteRecord = {
      voter: voterId,
      opinion,
      verdict,
      confidence: Math.max(0, Math.min(1, confidence)),
      timestamp: Date.now(),
    };
    this.votes.get(adrId)!.push(record);
    this.eventLog.push({
      adrId,
      action: 'vote_submitted',
      timestamp: record.timestamp,
      data: { voter: voterId, verdict },
    });
  }

  evaluateConsensus(adrId: string, judgeSummary?: string): GateResult {
    const votes = this.votes.get(adrId) ?? [];
    const validVotes = votes.filter(v => v.confidence >= this.config.minConfidence);
    const acceptCount = validVotes.filter(v => v.verdict === 'accept').length;
    const rejectCount = validVotes.filter(v => v.verdict === 'reject').length;
    const totalValid = validVotes.length;
    const threshold = Math.floor(totalValid * this.config.consensusRatio) + 1;
    const consensus = totalValid >= this.config.minVotes && acceptCount >= threshold;

    const result: GateResult = {
      consensus,
      votes: validVotes,
      judgeSummary: judgeSummary ?? (consensus ? 'Consensus reached' : 'No consensus'),
      alternatives: [],
      threshold,
      acceptCount,
      rejectCount,
    };

    this.eventLog.push({
      adrId,
      action: consensus ? 'consensus_reached' : 'no_consensus',
      timestamp: Date.now(),
      data: result,
    });

    return result;
  }

  // ─── Counterfactual ───

  generateCounterfactual(adrId: string, rejectedAlt: string, analysis: string): Counterfactual {
    const cf: Counterfactual = {
      adrId,
      rejectedAlternative: rejectedAlt,
      analysis,
      timestamp: Date.now(),
    };
    this.counterfactuals.push(cf);
    this.eventLog.push({
      adrId,
      action: 'counterfactual_generated',
      timestamp: cf.timestamp,
      data: { alternative: rejectedAlt },
    });
    return cf;
  }

  getCounterfactuals(adrId: string): Counterfactual[] {
    return this.counterfactuals.filter(cf => cf.adrId === adrId);
  }

  // ─── Event Log ───

  getEventLog(adrId?: string): Array<{adrId: string; action: string; timestamp: number; data: unknown}> {
    if (adrId) return this.eventLog.filter(e => e.adrId === adrId);
    return [...this.eventLog];
  }

  /** Export event log as JSONL string */
  exportEventLogJSONL(): string {
    return this.eventLog.map(e => JSON.stringify(e)).join('\n');
  }

  // ─── Statistics ───

  getStatistics(): {
    totalGates: number;
    consensusRate: number;
    avgConfidence: number;
    totalVotes: number;
    totalCounterfactuals: number;
  } {
    const allVotes = Array.from(this.votes.values()).flat();
    const validVotes = allVotes.filter(v => v.confidence >= this.config.minConfidence);
    const adrIds = Array.from(this.votes.keys());
    let consensusCount = 0;
    for (const id of adrIds) {
      const result = this.evaluateConsensus(id);
      if (result.consensus) consensusCount++;
    }
    return {
      totalGates: adrIds.length,
      consensusRate: adrIds.length > 0 ? consensusCount / adrIds.length : 0,
      avgConfidence: validVotes.length > 0
        ? validVotes.reduce((sum, v) => sum + v.confidence, 0) / validVotes.length
        : 0,
      totalVotes: allVotes.length,
      totalCounterfactuals: this.counterfactuals.length,
    };
  }

  // ─── Reset ───

  clear(adrId?: string): void {
    if (adrId) {
      this.votes.delete(adrId);
    } else {
      this.votes.clear();
      this.counterfactuals.length = 0;
      this.eventLog.length = 0;
    }
  }
}
