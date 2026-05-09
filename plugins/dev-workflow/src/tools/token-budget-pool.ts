// P14 v27: Token Budget Pool — dynamic inter-step token budget reallocation.
// Steps can borrow/lend budget. Step 7 (Dev) has minimum 40% guarantee.
// Inspired by: 40x Cost Wall research (Sanket Sahu) + LSP token savings

export interface BudgetAllocation {
  step: string;
  allocated: number;
  used: number;
  borrowed: number; // positive = borrowed from pool, negative = lent to pool
}

export interface BudgetConfig {
  totalBudget: number;
  emergencyReserve: number; // 10% of total
  protectedSteps: string[]; // minimum allocation guaranteed
  protectedMinimum: number; // 40% default
}

const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  totalBudget: 200_000, // tokens
  emergencyReserve: 20_000, // 10%
  protectedSteps: ['step7-development'],
  protectedMinimum: 0.40, // 40% of total for protected steps
};

export class TokenBudgetPool {
  private allocations: BudgetAllocation[];
  private config: BudgetConfig;
  private pool: number; // unallocated / borrowable tokens
  private emergencyUsed: number;

  constructor(config?: Partial<BudgetConfig>) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
    this.allocations = [];
    this.pool = this.config.totalBudget * (1 - this.config.protectedMinimum);
    this.emergencyUsed = 0;
  }

  /** Register a step with initial allocation */
  registerStep(step: string, initialAllocation: number): BudgetAllocation {
    const alloc: BudgetAllocation = {
      step,
      allocated: initialAllocation,
      used: 0,
      borrowed: 0,
    };
    this.allocations.push(alloc);
    return alloc;
  }

  /** Record token usage for a step */
  recordUsage(step: string, tokens: number): void {
    const alloc = this._find(step);
    if (!alloc) return;
    alloc.used += tokens;

    // If over allocated, try borrowing from pool
    if (alloc.used > alloc.allocated) {
      this._autoBorrow(alloc);
    }
  }

  /** Borrow tokens from pool for a step */
  borrow(step: string, amount: number): boolean {
    const alloc = this._find(step);
    if (!alloc) return false;

    if (this.pool >= amount) {
      this.pool -= amount;
      alloc.allocated += amount;
      alloc.borrowed += amount;
      return true;
    }

    // Try emergency reserve
    const reserve = this.config.emergencyReserve - this.emergencyUsed;
    if (reserve >= amount && this._isProtected(step)) {
      this.emergencyUsed += amount;
      alloc.allocated += amount;
      alloc.borrowed += amount;
      return true;
    }

    return false;
  }

  /** Return unused tokens to pool */
  returnTokens(step: string, amount: number): void {
    const alloc = this._find(step);
    if (!alloc) return;
    alloc.allocated -= amount;
    this.pool += amount;
  }

  /** Get budget status for all steps */
  getStatus(): BudgetAllocation[] {
    return this.allocations.map(a => ({ ...a }));
  }

  /** Get remaining pool tokens */
  getPoolRemaining(): number {
    return this.pool;
  }

  getStatistics() {
    const totalUsed = this.allocations.reduce((sum, a) => sum + a.used, 0);
    const totalBorrowed = this.allocations.reduce((sum, a) => sum + Math.max(0, a.borrowed), 0);
    return {
      totalBudget: this.config.totalBudget,
      totalUsed,
      poolRemaining: this.pool,
      emergencyUsed: this.emergencyUsed,
      emergencyRemaining: this.config.emergencyReserve - this.emergencyUsed,
      totalBorrowed,
      stepCount: this.allocations.length,
      overBudget: totalUsed > this.config.totalBudget,
    };
  }

  private _find(step: string): BudgetAllocation | undefined {
    return this.allocations.find(a => a.step === step);
  }

  private _autoBorrow(alloc: BudgetAllocation): void {
    const deficit = alloc.used - alloc.allocated;
    this.borrow(alloc.step, deficit);
  }

  private _isProtected(step: string): boolean {
    return this.config.protectedSteps.includes(step);
  }
}
