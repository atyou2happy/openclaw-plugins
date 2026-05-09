// Execution Sandbox — Principle #128 (v26 Pillar 8: Safe Execution)
// Inspired by: E2B isolated sandbox + ChatDev Docker execution
// Pattern: snapshot-on-write, rollback-on-failure, budget-gated execution
export type SandboxState = 'idle' | 'running' | 'snapshotting' | 'rolled-back';

export interface Snapshot {
  readonly id: string;
  readonly stepId: number;
  readonly timestamp: number;
  readonly filesChanged: string[];
  readonly checksum: string;
}

export interface SandboxConfig {
  readonly maxSnapshots: number;
  readonly maxBudgetMs: number;
  readonly autoSnapshot: boolean;
  readonly trackFiles: boolean;
}

export interface SandboxResult {
  readonly success: boolean;
  readonly durationMs: number;
  readonly snapshot?: Snapshot;
  readonly error?: string;
  readonly filesChanged: string[];
}

const DEFAULT_CONFIG: SandboxConfig = {
  maxSnapshots: 10,
  maxBudgetMs: 30000,
  autoSnapshot: true,
  trackFiles: true,
};

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash).toString(36);
}

export class ExecutionSandbox {
  private readonly snapshots: Snapshot[] = [];
  private state: SandboxState = 'idle';
  private readonly filesBefore = new Map<string, string>();
  private readonly config: SandboxConfig;
  private totalExecutions = 0;
  private totalRollbacks = 0;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): SandboxState { return this.state; }

  trackFile(path: string, content: string): void {
    if (!this.config.trackFiles) return;
    this.filesBefore.set(path, content);
  }

  createSnapshot(stepId: number, filesChanged: string[]): Snapshot {
    this.state = 'snapshotting';
    const checksum = simpleHash(
      filesChanged.map(f => `${f}:${this.filesBefore.get(f) || ''}`).join('|')
    );
    const snapshot: Snapshot = {
      id: `snap-${Date.now()}-${stepId}`,
      stepId,
      timestamp: Date.now(),
      filesChanged: [...filesChanged],
      checksum,
    };
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }
    this.state = 'idle';
    return snapshot;
  }

  async execute<T>(
    stepId: number,
    fn: () => Promise<T>,
    filesInScope: string[] = [],
  ): Promise<SandboxResult & { result?: T }> {
    this.state = 'running';
    this.totalExecutions++;
    const start = Date.now();
    const filesChanged: string[] = [];

    try {
      let snapshot: Snapshot | undefined;
      if (this.config.autoSnapshot && filesInScope.length > 0) {
        snapshot = this.createSnapshot(stepId, filesInScope);
      }

      const result = await this.executeWithBudget(fn);

      for (const f of filesInScope) {
        if (this.filesBefore.has(f)) {
          filesChanged.push(f);
        }
      }

      this.state = 'idle';
      return { success: true, durationMs: Date.now() - start, snapshot, filesChanged, result };
    } catch (error) {
      this.state = 'rolled-back';
      this.totalRollbacks++;
      return {
        success: false,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
        filesChanged,
      };
    }
  }

  rollbackTo(snapshotId: string): Snapshot | null {
    const idx = this.snapshots.findIndex(s => s.id === snapshotId);
    if (idx === -1) return null;
    this.state = 'rolled-back';
    this.totalRollbacks++;
    return this.snapshots[idx];
  }

  rollbackLast(): Snapshot | null {
    if (this.snapshots.length === 0) return null;
    this.state = 'rolled-back';
    this.totalRollbacks++;
    return this.snapshots[this.snapshots.length - 1];
  }

  getSnapshots(): Snapshot[] { return [...this.snapshots]; }
  getStatistics() {
    return {
      totalExecutions: this.totalExecutions,
      totalRollbacks: this.totalRollbacks,
      snapshotCount: this.snapshots.length,
      currentState: this.state,
      rollbackRate: this.totalExecutions > 0 ? this.totalRollbacks / this.totalExecutions : 0,
    };
  }

  reset(): void {
    this.snapshots.length = 0;
    this.filesBefore.clear();
    this.state = 'idle';
  }

  private async executeWithBudget<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Sandbox budget exceeded (${this.config.maxBudgetMs}ms)`)),
        this.config.maxBudgetMs,
      );
      fn().then(
        (r) => { clearTimeout(timer); resolve(r); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });
  }
}
