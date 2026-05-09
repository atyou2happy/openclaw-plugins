// Inspired by: Microsoft Agent Framework (Middleware system),
// aixgo (structured output validation with auto-retry),
// Ruflo (Hooks system)
// v25 Pillar 7: Step Middleware Pipeline

export interface StepContext {
  stepId: number;
  phase: string;
  data: Record<string, unknown>;
  timing: { start: number; end?: number; durationMs?: number };
  /** Set to true to abort step execution */
  aborted?: boolean;
  /** Accumulated logs from middleware */
  logs: string[];
}

export type MiddlewareFn = (ctx: StepContext) => Promise<StepContext>;

export interface MiddlewareEntry {
  name: string;
  fn: MiddlewareFn;
  priority: number; // lower = runs first
}

export class StepMiddleware {
  private before: Map<number, MiddlewareEntry[]> = new Map();
  private after: Map<number, MiddlewareEntry[]> = new Map();

  // ─── Registration ───

  registerBefore(stepId: number, name: string, fn: MiddlewareFn, priority = 100): this {
    if (!this.before.has(stepId)) this.before.set(stepId, []);
    this.before.get(stepId)!.push({ name, fn, priority });
    this.before.get(stepId)!.sort((a, b) => a.priority - b.priority);
    return this;
  }

  registerAfter(stepId: number, name: string, fn: MiddlewareFn, priority = 100): this {
    if (!this.after.has(stepId)) this.after.set(stepId, []);
    this.after.get(stepId)!.push({ name, fn, priority });
    this.after.get(stepId)!.sort((a, b) => a.priority - b.priority);
    return this;
  }

  /** Register a global middleware for all steps */
  registerGlobalBefore(name: string, fn: MiddlewareFn, priority = 100): this {
    for (let i = 1; i <= 12; i++) this.registerBefore(i, name, fn, priority);
    return this;
  }

  /** Register a global middleware for all steps */
  registerGlobalAfter(name: string, fn: MiddlewareFn, priority = 100): this {
    for (let i = 1; i <= 12; i++) this.registerAfter(i, name, fn, priority);
    return this;
  }

  // ─── Execution ───

  async execute<T>(
    stepId: number,
    context: StepContext,
    stepFn: (ctx: StepContext) => Promise<T>,
  ): Promise<{ result: T | null; context: StepContext }> {
    // Run before hooks
    let ctx = { ...context, timing: { ...context.timing, start: Date.now() } };
    const beforeMiddlewares = this.before.get(stepId) ?? [];
    for (const entry of beforeMiddlewares) {
      try {
        ctx = await entry.fn(ctx);
        if (ctx.aborted) {
          ctx.logs.push(`[middleware] Step ${stepId} aborted by ${entry.name}`);
          return { result: null, context: ctx };
        }
      } catch (err) {
        ctx.logs.push(`[middleware] Before hook ${entry.name} error: ${err}`);
      }
    }

    // Run step
    let result: T | null = null;
    try {
      result = await stepFn(ctx);
    } catch (err) {
      ctx.logs.push(`[middleware] Step ${stepId} execution error: ${err}`);
    }

    // Run after hooks
    ctx.timing.end = Date.now();
    ctx.timing.durationMs = ctx.timing.end - ctx.timing.start;
    const afterMiddlewares = this.after.get(stepId) ?? [];
    for (const entry of afterMiddlewares) {
      try {
        ctx = await entry.fn(ctx);
      } catch (err) {
        ctx.logs.push(`[middleware] After hook ${entry.name} error: ${err}`);
      }
    }

    return { result, context: ctx };
  }

  // ─── Query ───

  getRegisteredMiddlewares(stepId: number): { before: string[]; after: string[] } {
    return {
      before: (this.before.get(stepId) ?? []).map(m => m.name),
      after: (this.after.get(stepId) ?? []).map(m => m.name),
    };
  }

  // ─── Built-in Middleware Factories ───

  static loggingMiddleware(): MiddlewareFn {
    return async (ctx: StepContext) => {
      ctx.logs.push(`[step ${ctx.stepId}] Phase: ${ctx.phase}, Data keys: ${Object.keys(ctx.data).join(',')}`);
      return ctx;
    };
  }

  static timingMiddleware(): MiddlewareFn {
    return async (ctx: StepContext) => {
      if (ctx.timing.durationMs !== undefined) {
        ctx.logs.push(`[step ${ctx.stepId}] Duration: ${ctx.timing.durationMs}ms`);
      }
      return ctx;
    };
  }

  static tokenBudgetMiddleware(maxTokens: number): MiddlewareFn {
    return async (ctx: StepContext) => {
      const estimated = JSON.stringify(ctx.data).length; // rough estimate
      if (estimated > maxTokens) {
        ctx.logs.push(`[step ${ctx.stepId}] Token budget exceeded: ${estimated} > ${maxTokens}`);
        ctx.aborted = true;
      }
      return ctx;
    };
  }

  static schemaValidatorMiddleware(requiredKeys: string[]): MiddlewareFn {
    return async (ctx: StepContext) => {
      const missing = requiredKeys.filter(k => !(k in ctx.data));
      if (missing.length > 0) {
        ctx.logs.push(`[step ${ctx.stepId}] Schema validation failed, missing: ${missing.join(',')}`);
        // Don't abort, just log — allows retry
      }
      return ctx;
    };
  }

  // ─── Reset ───

  clear(stepId?: number): void {
    if (stepId !== undefined) {
      this.before.delete(stepId);
      this.after.delete(stepId);
    } else {
      this.before.clear();
      this.after.clear();
    }
  }
}
