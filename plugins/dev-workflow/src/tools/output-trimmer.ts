/**
 * OutputTrimmer — reduces verbose shell output before injecting into LLM context.
 * Inspired by Claude Code's Hooks preprocessing pipeline and SWE-agent's
 * observation truncation with self-regulation prompts.
 *
 * Keeps only actionable information, strips noise.
 */

/** Maximum chars for each output type */
const LIMITS = {
  lint: 800,       // Only errors matter
  test: 1000,      // Failing tests + summary
  typeCheck: 600,  // First 20 unique errors
  generic: 1500,   // General purpose
} as const;

/** Trim lint output — keep only error-level lines */
export function trimLintOutput(output: string, maxChars = LIMITS.lint): string {
  const lines = output.split("\n");
  const errorLines = lines.filter((l) =>
    /error|Error|ERROR|warning|Warning/.test(l) && !/node_modules/.test(l)
  );
  const trimmed = errorLines.length > 0 ? errorLines.join("\n") : lines.slice(-5).join("\n");
  return truncateWithHint(trimmed, maxChars, "lint");
}

/** Trim test output — keep failing tests and summary */
export function trimTestOutput(output: string, maxChars = LIMITS.test): string {
  const lines = output.split("\n");
  // Keep: FAIL, Error, assert lines, summary
  const relevant = lines.filter((l) =>
    /FAIL|✗|✕|Error|assert|expected|received|Tests:|Suites:|Snapshots:|Time:/i.test(l)
  );
  const trimmed = relevant.length > 0 ? relevant.join("\n") : lines.slice(-10).join("\n");
  return truncateWithHint(trimmed, maxChars, "test results");
}

/** Trim typeCheck output — first 20 unique error files */
export function trimTypeCheckOutput(output: string, maxChars = LIMITS.typeCheck): string {
  const lines = output.split("\n").filter((l) => l.trim().length > 0 && !/node_modules/.test(l));
  // Deduplicate by file — keep first error per file
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const file = line.split(":")[0];
    if (file && !seen.has(file)) {
      seen.add(file);
      unique.push(line);
      if (seen.size >= 20) break;
    }
  }
  const trimmed = unique.length > 0 ? unique.join("\n") : lines.slice(-5).join("\n");
  return truncateWithHint(trimmed, maxChars, "type errors");
}

/** Generic trim — keep tail of output */
export function trimGenericOutput(output: string, maxChars = LIMITS.generic): string {
  return truncateWithHint(output, maxChars, "output");
}

function truncateWithHint(text: string, maxChars: number, context: string): string {
  if (text.length <= maxChars) return text;
  const hint = `\n... [${context} truncated: ${text.length} → ${maxChars} chars. Use grep/head/tail for full output]`;
  return text.slice(0, maxChars - hint.length) + hint;
}
