/**
 * HistoryCondenser — Multi-tier conversation history compression.
 *
 * Inspired by:
 * - OpenHands' Condenser system (LLM-powered summarization)
 * - Aider's context rot detection
 * - LangGraph's checkpoint serialization
 *
 * Strategy (3 tiers):
 * - L0 (Raw): Full text, kept for last 5 decisions
 * - L1 (Summary): LLM-generated summary, kept for last 20 decisions
 * - L2 (Keywords): Extracted keywords/tags, kept indefinitely
 *
 * Token savings: 50-70% history tokens over time.
 */

// ─── Types ───

export interface CondensedEntry {
  /** Original index in decisions array */
  index: number;
  /** Condensation tier */
  tier: "L0" | "L1" | "L2";
  /** Content at this tier */
  content: string;
  /** Timestamp from original */
  timestamp?: string;
  /** Tags extracted for L2 */
  tags: string[];
}

export interface CondensationResult {
  /** Condensed entries */
  entries: CondensedEntry[];
  /** Original total tokens */
  originalTokens: number;
  /** Condensed total tokens */
  condensedTokens: number;
  /** Compression ratio */
  compressionRatio: number;
}

export interface CondensationConfig {
  /** Max entries to keep at L0 (full text) */
  l0MaxEntries: number;
  /** Max entries to keep at L1 (summary) */
  l1MaxEntries: number;
  /** All entries get L2 (keywords) */
  l2Always: boolean;
  /** Trigger condensation when decisions exceed this count */
  triggerThreshold: number;
}

const DEFAULT_CONFIG: CondensationConfig = {
  l0MaxEntries: 5,
  l1MaxEntries: 20,
  l2Always: true,
  triggerThreshold: 15,
};

// ─── Token estimation ───

function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    tokens += (cp >= 0x4E00 && cp <= 0x9FFF) ||
              (cp >= 0x3040 && cp <= 0x30FF) ||
              (cp >= 0xAC00 && cp <= 0xD7AF) ? 1 : 0.25;
  }
  return Math.ceil(tokens);
}

// ─── Keyword extraction (rule-based, no LLM needed) ───

function extractKeywords(text: string): string[] {
  const tags: string[] = [];

  // Step indicators
  const stepMatch = text.match(/step(\d+)/i);
  if (stepMatch) tags.push(`s${stepMatch[1]}`);

  // Task IDs
  const taskMatch = text.match(/(?:task|T)(\d+(?:\.\d+)?)/i);
  if (taskMatch) tags.push(`T${taskMatch[1]}`);

  // Status
  if (/pass/i.test(text)) tags.push("pass");
  if (/fail/i.test(text)) tags.push("fail");
  if (/skip/i.test(text)) tags.push("skip");

  // File names
  let fileMatch: RegExpExecArray | null;
  const fileRe = /[\w-]+\.(?:ts|js|py|tsx|jsx|json)/g;
  while ((fileMatch = fileRe.exec(text)) !== null) {
    tags.push(fileMatch[0]);
  }

  // Module names (camelCase/PascalCase words > 3 chars)
  const moduleRe = /\b[A-Z][a-zA-Z]{3,}\b/g;
  let moduleMatch: RegExpExecArray | null;
  while ((moduleMatch = moduleRe.exec(text)) !== null) {
    tags.push(moduleMatch[0]);
  }

  const uniqueTags: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    if (!seen.has(t)) { seen.add(t); uniqueTags.push(t); }
  }
  return uniqueTags.slice(0, 10);
}

// ─── L1 Summary (rule-based, fast) ───

function summarizeL1(text: string): string {
  // Strategy: keep first sentence + any important markers
  const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] ?? text.slice(0, 100);

  // Extract key data points
  const numbers = text.match(/\d+(?:\.\d+)?%/g);
  const extra = numbers ? ` [${numbers.join(", ")}]` : "";

  return (firstSentence + extra).slice(0, 120);
}

// ─── Main Condenser ───

export class HistoryCondenser {
  private config: CondensationConfig;

  constructor(config?: Partial<CondensationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Condense an array of decision strings into tiered entries.
   * Recent decisions stay L0, older ones get summarized to L1/L2.
   */
  condense(decisions: string[]): CondensationResult {
    if (decisions.length <= this.config.l0MaxEntries) {
      // No condensation needed
      const entries = decisions.map((d, i) => ({
        index: i,
        tier: "L0" as const,
        content: d,
        tags: extractKeywords(d),
      }));
      const totalTokens = entries.reduce((s, e) => s + estimateTokens(e.content), 0);
      return {
        entries,
        originalTokens: totalTokens,
        condensedTokens: totalTokens,
        compressionRatio: 1,
      };
    }

    const total = decisions.length;
    const entries: CondensedEntry[] = [];

    // Calculate tier boundaries (from end of array = most recent)
    const l0Start = Math.max(0, total - this.config.l0MaxEntries);
    const l1Start = Math.max(0, total - this.config.l1MaxEntries);

    for (let i = 0; i < total; i++) {
      const decision = decisions[i];
      const tags = extractKeywords(decision);

      if (i >= l0Start) {
        // Recent: keep full text (L0)
        entries.push({ index: i, tier: "L0", content: decision, tags });
      } else if (i >= l1Start) {
        // Medium age: summarize (L1)
        entries.push({ index: i, tier: "L1", content: summarizeL1(decision), tags });
      } else {
        // Old: keywords only (L2)
        entries.push({
          index: i,
          tier: "L2",
          content: tags.length > 0 ? tags.join(",") : decision.slice(0, 50),
          tags,
        });
      }
    }

    const originalTokens = decisions.reduce((s, d) => s + estimateTokens(d), 0);
    const condensedTokens = entries.reduce((s, e) => s + estimateTokens(e.content), 0);

    return {
      entries,
      originalTokens,
      condensedTokens,
      compressionRatio: originalTokens > 0 ? condensedTokens / originalTokens : 0,
    };
  }

  /**
   * Convert condensed history to a flat string for LLM injection.
   * Most token-efficient format.
   */
  toFlatString(result: CondensationResult): string {
    return result.entries.map(e => {
      if (e.tier === "L0") return e.content;
      if (e.tier === "L1") return `[${e.tier}] ${e.content}`;
      return `[${e.tier}] ${e.content}`;
    }).join("\n");
  }

  /**
   * Check if condensation should be triggered.
   */
  shouldCondense(decisionCount: number): boolean {
    return decisionCount >= this.config.triggerThreshold;
  }

  /**
   * Get stats about condensation efficiency.
   */
  getStats(result: CondensationResult): string {
    const l0 = result.entries.filter(e => e.tier === "L0").length;
    const l1 = result.entries.filter(e => e.tier === "L1").length;
    const l2 = result.entries.filter(e => e.tier === "L2").length;
    return `Condensed: ${l0}L0 + ${l1}L1 + ${l2}L2 = ${Math.round(result.compressionRatio * 100)}% (${result.condensedTokens}/${result.originalTokens} tok)`;
  }
}
