// P13 v27: Phase Memory Manager — scoped shared memory per development phase.
// Each phase (Analysis/Plan/Build/Deliver) has isolated memory blocks.
// Inspired by: ChatDev ChatChain phase-level memory sharing

export type DevPhase = 'analysis' | 'plan' | 'build' | 'deliver';

export interface PhaseMemoryBlock {
  phase: DevPhase;
  entries: MemoryEntry[];
  createdAt: string;
  ttl: number; // milliseconds
}

export interface MemoryEntry {
  key: string;
  value: unknown;
  agentId: string;
  timestamp: string;
  ttl?: number;
}

export interface CompressedMemory {
  phase: DevPhase;
  summary: string;
  keyCount: number;
  compressedAt: string;
}

export class PhaseMemoryManager {
  private blocks: Map<DevPhase, PhaseMemoryBlock> = new Map();
  private defaultTTL = 3600_000; // 1 hour

  constructor() {
    this._initBlocks();
  }

  /** Write a memory entry for a phase */
  write(phase: DevPhase, key: string, value: unknown, agentId: string, ttl?: number): MemoryEntry {
    const block = this._getBlock(phase);
    const entry: MemoryEntry = {
      key,
      value,
      agentId,
      timestamp: new Date().toISOString(),
      ttl: ttl ?? this.defaultTTL,
    };

    // Replace existing entry with same key
    const existingIdx = block.entries.findIndex(e => e.key === key);
    if (existingIdx >= 0) {
      block.entries[existingIdx] = entry;
    } else {
      block.entries.push(entry);
    }

    return entry;
  }

  /** Read a memory entry from a phase */
  read(phase: DevPhase, key: string): unknown | null {
    const block = this._getBlock(phase);
    const entry = block.entries.find(e => e.key === key);
    if (!entry) return null;
    if (this._isExpired(entry)) {
      this._removeEntry(block, key);
      return null;
    }
    return entry.value;
  }

  /** Get all entries for a phase */
  getAll(phase: DevPhase): MemoryEntry[] {
    const block = this._getBlock(phase);
    this._cleanExpired(block);
    return [...block.entries];
  }

  /** Compress phase memory for handoff to next phase */
  compress(phase: DevPhase): CompressedMemory {
    const block = this._getBlock(phase);
    this._cleanExpired(block);

    const keys = block.entries.map(e => e.key);
    return {
      phase,
      summary: `Phase ${phase}: ${keys.length} entries — ${keys.join(', ')}`,
      keyCount: keys.length,
      compressedAt: new Date().toISOString(),
    };
  }

  /** Clear all entries for a phase */
  clear(phase: DevPhase): void {
    const block = this._getBlock(phase);
    block.entries = [];
  }

  /** Clear all phases */
  clearAll(): void {
    this.blocks.forEach(block => { block.entries = []; });
  }

  getStatistics() {
    const phaseStats: Record<string, number> = {};
    this.blocks.forEach((block, phase) => {
      phaseStats[phase] = block.entries.length;
    });
    return { phaseStats, totalEntries: Object.values(phaseStats).reduce((a, b) => a + b, 0) };
  }

  private _initBlocks(): void {
    const now = new Date().toISOString();
    const phases: DevPhase[] = ['analysis', 'plan', 'build', 'deliver'];
    phases.forEach(p => {
      this.blocks.set(p, { phase: p, entries: [], createdAt: now, ttl: this.defaultTTL });
    });
  }

  private _getBlock(phase: DevPhase): PhaseMemoryBlock {
    const block = this.blocks.get(phase);
    if (!block) throw new Error(`Unknown phase: ${phase}`);
    return block;
  }

  private _isExpired(entry: MemoryEntry): boolean {
    if (!entry.ttl) return false;
    return Date.now() - new Date(entry.timestamp).getTime() > entry.ttl;
  }

  private _cleanExpired(block: PhaseMemoryBlock): void {
    block.entries = block.entries.filter(e => !this._isExpired(e));
  }

  private _removeEntry(block: PhaseMemoryBlock, key: string): void {
    block.entries = block.entries.filter(e => e.key !== key);
  }
}
