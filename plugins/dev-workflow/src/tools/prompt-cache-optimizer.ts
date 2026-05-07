/**
 * PromptCacheOptimizer — Structures prompts for maximum LLM API cache hit rates.
 *
 * Inspired by:
 * - Anthropic prompt caching (cache_control, system prompt prefix stability)
 * - OpenAI automatic prompt caching (prefix-match based)
 *
 * Strategy:
 * 1. Separate static prefix (system instructions, role definitions) from dynamic suffix
 * 2. Ensure system prompt blocks are ordered identically across calls
 * 3. Mark cacheable blocks with cache_control hints for supported APIs
 * 4. Minimize "churn" — only the last dynamic block changes between calls
 *
 * Token savings: 30-50% cost reduction via cache hits on repeated prefixes.
 */

// ─── Types ───

export interface PromptBlock {
  /** Content of this block */
  content: string;
  /** Whether this block is static across calls (eligible for caching) */
  isStatic: boolean;
  /** Optional cache TTL hint (for APIs that support it, e.g., Anthropic) */
  cacheTTL?: number;  // seconds
  /** Block identifier for deduplication */
  id: string;
}

export interface OptimizedPrompt {
  /** Ordered blocks — static first, dynamic last */
  blocks: PromptBlock[];
  /** Total estimated tokens */
  estimatedTokens: number;
  /** Number of static (cacheable) blocks */
  cacheableBlocks: number;
  /** Cache hit potential: ratio of static to total tokens */
  cacheHitPotential: number;
}

// ─── Token estimation ───

function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // CJK: ~1 token/char, ASCII: ~1 token/4 chars
    tokens += (cp >= 0x4E00 && cp <= 0x9FFF) ||
              (cp >= 0x3040 && cp <= 0x30FF) ||
              (cp >= 0xAC00 && cp <= 0xD7AF) ? 1 : 0.25;
  }
  return Math.ceil(tokens);
}

// ─── Static prompt templates (shared across all steps) ───

const STATIC_SYSTEM_BLOCKS: PromptBlock[] = [
  {
    id: "role-definition",
    content: `You are an expert software developer following the dev-workflow methodology.
Key principles:
- Spec first, code follows
- Fix root causes, not symptoms
- Test before commit
- Keep functions under 50 lines`,
    isStatic: true,
    cacheTTL: 3600,
  },
  {
    id: "output-format",
    content: `Output format rules:
- Be concise. No filler text.
- Use structured JSON when requested.
- Code: only show changed lines with context (3 lines before/after).
- Reviews: use [P0-P3] severity + confidence N/10 + file:line format.
- Max response: 2000 tokens unless explicitly asked for more.`,
    isStatic: true,
    cacheTTL: 3600,
  },
  {
    id: "token-budget-awareness",
    content: `Token budget awareness:
- Every token costs money. Minimize output.
- Prefer structured data over prose.
- Skip explanations for obvious changes.
- One-line summaries for non-critical findings.`,
    isStatic: true,
    cacheTTL: 3600,
  },
];

// ─── Per-step static context blocks ───

const STEP_STATIC_BLOCKS: Record<string, PromptBlock> = {
  "brainstorm": {
    id: "brainstorm-context",
    content: `Brainstorm mode: Generate 3-5 implementation approaches.
For each: label, 1-sentence description, estimated effort (S/M/L), risk level (low/med/high).
No code in this phase.`,
    isStatic: true,
    cacheTTL: 1800,
  },
  "spec": {
    id: "spec-context",
    content: `Spec mode: Generate structured specification.
Output: proposal (max 200 words), design (max 500 words), tasks (JSON array, max 15 tasks).
Each task: {id, title, description (max 50 words), difficulty, dependencies[], files[]}.`,
    isStatic: true,
    cacheTTL: 1800,
  },
  "review": {
    id: "review-context",
    content: `Review mode: Analyze code changes with 6-role perspective (CEO, Eng, Design, QA, Security, Release).
Format: [P0-P3] (confidence: N/10) file:line — description.
Only report issues. Skip "looks good" comments.`,
    isStatic: true,
    cacheTTL: 1800,
  },
  "test": {
    id: "test-context",
    content: `Test mode: Write tests following the pyramid (Unit > Business > Integration).
Coverage target: 60%+ overall, 100% for critical paths.
Mock external dependencies. Test edge cases.`,
    isStatic: true,
    cacheTTL: 1800,
  },
  "docs": {
    id: "docs-context",
    content: `Docs mode: Generate README (English) + README_CN (Chinese).
Include: description, install, usage, API reference, contributing, license.
Keep under 200 lines total.`,
    isStatic: true,
    cacheTTL: 1800,
  },
};

// ─── Cache Optimizer ───

export class PromptCacheOptimizer {
  private blockCache = new Map<string, string>();
  private totalCalls = 0;
  private cacheHits = 0;

  /**
   * Build an optimized prompt with static blocks first (cache-friendly).
   * Static blocks are always identical → API-level caching will hit them.
   * Dynamic blocks go last → only the tail of the prompt changes.
   */
  buildOptimizedPrompt(
    step: string,
    dynamicContext: string,
    projectContext?: string,
  ): OptimizedPrompt {
    const blocks: PromptBlock[] = [];

    // 1. Global static blocks (always first, always cached)
    for (const block of STATIC_SYSTEM_BLOCKS) {
      blocks.push(block);
    }

    // 2. Step-specific static block
    const stepBlock = STEP_STATIC_BLOCKS[step];
    if (stepBlock) {
      blocks.push(stepBlock);
    }

    // 3. Project context (semi-static — changes rarely)
    if (projectContext) {
      blocks.push({
        id: "project-context",
        content: projectContext,
        isStatic: false, // Changes per project, not cacheable across projects
        cacheTTL: 600,
      });
    }

    // 4. Dynamic context (changes every call — always last)
    blocks.push({
      id: "dynamic-context",
      content: dynamicContext,
      isStatic: false,
    });

    // Calculate metrics
    const totalTokens = blocks.reduce((sum, b) => sum + estimateTokens(b.content), 0);
    const staticTokens = blocks
      .filter(b => b.isStatic)
      .reduce((sum, b) => sum + estimateTokens(b.content), 0);

    return {
      blocks,
      estimatedTokens: totalTokens,
      cacheableBlocks: blocks.filter(b => b.isStatic).length,
      cacheHitPotential: totalTokens > 0 ? staticTokens / totalTokens : 0,
    };
  }

  /**
   * Convert optimized prompt to a flat string for APIs that don't support block-level caching.
   */
  toFlatString(optimized: OptimizedPrompt): string {
    return optimized.blocks.map(b => b.content).join("\n\n---\n\n");
  }

  /**
   * Get Anthropic-style content blocks with cache_control markers.
   * Only the last static block gets cache_control (Anthropic's "mark the boundary" approach).
   */
  toAnthropicBlocks(optimized: OptimizedPrompt): Array<{ type: string; text: string; cache_control?: { type: string } }> {
    let lastStaticIdx = -1;
    for (let i = optimized.blocks.length - 1; i >= 0; i--) {
      if (optimized.blocks[i].isStatic) {
        lastStaticIdx = i;
        break;
      }
    }

    return optimized.blocks.map((block, idx) => ({
      type: "text",
      text: block.content,
      ...(idx === lastStaticIdx ? { cache_control: { type: "ephemeral" } } : {}),
    }));
  }

  /**
   * Check if content is identical to previous call (for deduplication).
   */
  isCacheHit(blockId: string, content: string): boolean {
    this.totalCalls++;
    const prev = this.blockCache.get(blockId);
    if (prev === content) {
      this.cacheHits++;
      return true;
    }
    this.blockCache.set(blockId, content);
    return false;
  }

  /**
   * Get cache statistics.
   */
  getStats(): { totalCalls: number; cacheHits: number; hitRate: number } {
    return {
      totalCalls: this.totalCalls,
      cacheHits: this.cacheHits,
      hitRate: this.totalCalls > 0 ? this.cacheHits / this.totalCalls : 0,
    };
  }

  /**
   * Reset cache state (call between workflows).
   */
  reset(): void {
    this.blockCache.clear();
    this.totalCalls = 0;
    this.cacheHits = 0;
  }
}
