/**
 * LLMSelfRegulator — Token budget instructions injected into agent prompts
 * to guide LLMs to self-regulate output length.
 *
 * Inspired by:
 * - SWE-agent's self-regulation prompts ("be concise")
 * - Claude Code's output length control via system instructions
 * - OpenHands' observation truncation with hints
 *
 * Strategy:
 * 1. Append token budget instructions to every agent prompt
 * 2. Budget varies by step (spec needs more, review needs less)
 * 3. Instructions are concise themselves (no meta-waste)
 * 4. "Structured > prose" philosophy embedded
 *
 * Token savings: 20-30% on LLM outputs.
 */

// ─── Per-Step Budget Instructions ───

const STEP_BUDGETS: Record<string, string> = {
  analysis: `[Budget: 300 tokens] Respond with: complexity(low/med/high), files(N), hasOpenSpec(bool), summary(1 line). No explanation.`,
  brainstorm: `[Budget: 500 tokens] List 3-5 options. Each: label + 1 sentence + effort(S/M/L) + risk(low/med/high). No code.`,
  spec: `[Budget: 800 tokens] Output: proposal(max 200 words), design(max 300 words, structured sections), tasks(JSON array, max 15 items). Each task description max 50 words.`,
  "tech-selection": `[Budget: 200 tokens] Respond with: language, framework, architecture, patterns[]. One line each.`,
  review: `[Budget: 400 tokens] Only report issues. Format: [P0-P3] (confidence: N/10) file:line — description. Skip "looks good". No suggestions without severity.`,
  test: `[Budget: 300 tokens] Output: test code only. No comments explaining what the test does (test name should be self-documenting). Mock external deps.`,
  docs: `[Budget: 500 tokens] README: install(3 cmds), usage(2 examples), API reference(table). No filler sections like "Features" or "Philosophy".`,
  debug: `[Budget: 300 tokens] Root cause first (1 line). Then: evidence (max 3 lines). Then: fix (code only). No "let me explain" preamble.`,
  "task-execution": `[Budget: 500 tokens] Code changes only. Show diff context (3 lines before/after). No explanation unless change is non-obvious.`,
  security: `[Budget: 300 tokens] Only findings: [SEVERITY] type — location — impact(1 line). Skip "No issues found in..." items.`,
};

// ─── General Self-Regulation Instructions ───

const GENERAL_INSTRUCTION = `Token discipline:
- Structured data > prose. JSON > paragraphs.
- Skip preamble ("Sure!", "I'll help you...", "Let me analyze...").
- One summary line for non-critical items.
- Code: only changed lines + 3-line context.`;

// ─── Export ───

/**
 * Get the token budget instruction for a specific step.
 */
export function getStepBudget(step: string): string {
  return STEP_BUDGETS[step] ?? "[Budget: 500 tokens] Be concise.";
}

/**
 * Get the general self-regulation instruction (append to all prompts).
 */
export function getGeneralRegulation(): string {
  return GENERAL_INSTRUCTION;
}

/**
 * Build a complete regulation block for a prompt.
 * Combines general + step-specific instructions.
 */
export function buildRegulationBlock(step: string): string {
  return `${getGeneralRegulation()}\n\n${getStepBudget(step)}`;
}

/**
 * Estimate if an LLM response is within expected budget.
 * Returns a hint for re-prompting if over budget.
 */
export function checkResponseBudget(response: string, step: string): { withinBudget: boolean; estimatedTokens: number; hint: string } {
  // Token estimation
  let tokens = 0;
  for (const ch of response) {
    const cp = ch.codePointAt(0)!;
    tokens += (cp >= 0x4E00 && cp <= 0x9FFF) ||
              (cp >= 0x3040 && cp <= 0x30FF) ||
              (cp >= 0xAC00 && cp <= 0xD7AF) ? 1 : 0.25;
  }
  tokens = Math.ceil(tokens);

  // Extract budget from step instruction
  const budgetMatch = STEP_BUDGETS[step]?.match(/Budget:\s*(\d+)/);
  const budget = budgetMatch ? parseInt(budgetMatch[1]) : 500;

  // Allow 20% overshoot (LLMs aren't perfect)
  const withinBudget = tokens <= budget * 1.2;

  return {
    withinBudget,
    estimatedTokens: tokens,
    hint: withinBudget
      ? ""
      : `Response is ~${tokens} tokens (budget: ${budget}). Consider compressing.`,
  };
}
