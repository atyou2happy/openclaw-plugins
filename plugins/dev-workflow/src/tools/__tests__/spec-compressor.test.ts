import { describe, expect, it } from "vitest";
import { SpecCompressor } from "../spec-compressor.js";
import type { WorkflowSpec, WorkflowTask } from "../../types.js";

// ─── Helpers ───

function makeTask(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "t1",
    title: "Implement feature X",
    description: "Build the core feature with proper error handling and tests.",
    status: "pending",
    difficulty: "medium",
    estimatedMinutes: 30,
    dependencies: [],
    files: ["src/feature.ts"],
    shipCategory: "ship",
    granularity: "task",
    suggestedModel: "standard",
    maxLines: 200,
    subtasks: [],
    gates: [],
    ...overrides,
  };
}

function makeSpec(overrides: Partial<WorkflowSpec> = {}): WorkflowSpec {
  return {
    proposal: `# Project Overview

This is a long proposal document that describes the feature in great detail.

## Goals

- Build a fast and reliable system
- Ensure backwards compatibility with existing APIs
- Provide comprehensive documentation for all public interfaces

## Background

The current implementation has several limitations. Users have reported issues with
performance when processing large datasets. This proposal addresses those concerns
by introducing a new streaming architecture.

\`\`\`typescript
// Example code that should be stripped
function oldImplementation() {
  return fetch('/api/data');
}
\`\`\`

The new approach uses a pipeline pattern instead.
`,
    design: `# Architecture Overview

The system uses a microservices architecture with event-driven communication
between components. Each service owns its data and exposes a well-defined API.

## Patterns and Approach

- Event Sourcing for audit trail
- CQRS for read/write separation
- Repository Pattern for data access
- Strategy Pattern for algorithm selection

## Constraints and Limitations

- Must support Node.js 18+
- Maximum response time of 200ms for P99
- Backward compatible with v2 API surface
- No external database dependencies for core flow

## Interface / API Definitions

\`\`\`
createUser(name: string, email: string): Promise<User>
getUser(id: string): Promise<User | null>
deleteUser(id: string): Promise<void>
processOrder(order: Order): Promise<Receipt>
\`\`\`

## Data Flow

Data enters through the API gateway, gets validated by the middleware layer,
then dispatched to the appropriate handler. Results are cached in Redis with
a 5-minute TTL before being returned to the client.
`,
    tasks: [
      makeTask({ id: "t1", title: "Set up project structure", description: "Initialize the project with proper directory layout and configuration files.", difficulty: "easy", dependencies: [], files: ["src/index.ts", "tsconfig.json"] }),
      makeTask({ id: "t2", title: "Implement core pipeline", description: "Build the streaming pipeline with error handling and retry logic for resilience.", difficulty: "hard", dependencies: ["t1"], files: ["src/pipeline.ts", "src/retry.ts"] }),
      makeTask({ id: "t3", title: "Add API endpoints", description: "Expose REST endpoints for user management and order processing.", difficulty: "medium", dependencies: ["t2"], files: ["src/api/users.ts", "src/api/orders.ts"] }),
    ],
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── Tests ───

describe("SpecCompressor", () => {
  it("compress returns correct structure with compressionRatio < 1", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();
    const result = compressor.compress(spec);

    // Structure
    expect(result).toHaveProperty("proposal");
    expect(result).toHaveProperty("design");
    expect(result).toHaveProperty("tasks");
    expect(result).toHaveProperty("compressionRatio");
    expect(result).toHaveProperty("originalTokens");
    expect(result).toHaveProperty("compressedTokens");

    // Types
    expect(typeof result.proposal).toBe("string");
    expect(typeof result.design).toBe("object");
    expect(Array.isArray(result.tasks)).toBe(true);
    expect(typeof result.compressionRatio).toBe("number");
    expect(typeof result.originalTokens).toBe("number");
    expect(typeof result.compressedTokens).toBe("number");

    // Compression ratio should be less than 1 (meaningful compression)
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.compressionRatio).toBeLessThan(1);

    // Compressed should be smaller
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
  });

  it("compress handles empty tasks array", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec({ tasks: [] });
    const result = compressor.compress(spec);

    expect(result.tasks).toEqual([]);
    expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
    expect(result.originalTokens).toBeGreaterThan(0);
  });

  it("compressDelta returns null on first call", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();
    const result = compressor.compressDelta(spec);

    expect(result).toBeNull();
  });

  it("compressDelta returns {changed:'NO_CHANGE'} on identical spec", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();

    // First call stores the spec
    compressor.compressDelta(spec);

    // Second call with same spec
    const result = compressor.compressDelta(spec);

    expect(result).not.toBeNull();
    expect(result!.changed).toBe("NO_CHANGE");
    expect(result!.unchanged).toBe(1);
  });

  it("compressDelta detects changed tasks", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();

    // First call stores the spec
    compressor.compressDelta(spec);

    // Modify tasks
    const modifiedSpec = makeSpec({
      tasks: [
        makeTask({ id: "t1", title: "Set up project structure", description: "Initialize the project with proper directory layout and configuration files.", difficulty: "easy", dependencies: [], files: ["src/index.ts", "tsconfig.json"] }),
        makeTask({ id: "t2", title: "MODIFIED pipeline", description: "Build the streaming pipeline with CHANGED logic.", difficulty: "hard", dependencies: ["t1"], files: ["src/pipeline.ts", "src/retry.ts"] }),
        makeTask({ id: "t3", title: "Add API endpoints", description: "Expose REST endpoints for user management and order processing.", difficulty: "medium", dependencies: ["t2"], files: ["src/api/users.ts", "src/api/orders.ts"] }),
      ],
    });

    const result = compressor.compressDelta(modifiedSpec);

    expect(result).not.toBeNull();
    expect(result!.changed).not.toBe("NO_CHANGE");
    expect(result!.changed).toContain("t2");
    expect(result!.unchanged).toBe(2); // t1 and t3 unchanged
  });

  it("toFlatString includes pipe-delimited task format", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();
    const compressed = compressor.compress(spec);
    const flat = compressor.toFlatString(compressed);

    // Should contain proposal section
    expect(flat).toContain("## Proposal");

    // Should contain design section
    expect(flat).toContain("## Design");

    // Should contain tasks section
    expect(flat).toContain("## Tasks");

    // Each task should be pipe-delimited: id|title|diff|deps:...|files:...
    expect(flat).toContain("t1|");
    expect(flat).toContain("|easy|");
    expect(flat).toContain("|medium|");
    expect(flat).toContain("|hard|");
    expect(flat).toContain("deps:");
    expect(flat).toContain("files:");

    // Should contain compression metadata
    expect(flat).toContain("tok_");
  });

  it("toSummary contains task count and token count", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();
    const compressed = compressor.compress(spec);
    const summary = compressor.toSummary(compressed);

    // Should contain task count
    expect(summary).toContain(`${spec.tasks.length} tasks`);

    // Should contain token count (e.g., "123tok")
    expect(summary).toMatch(/\d+tok/);

    // Should contain compression percentage
    expect(summary).toMatch(/\d+%/);
  });

  it("proposal compression strips code blocks", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec({
      proposal: `# My Proposal

Some intro text.

\`\`\`typescript
function shouldNotExist() {
  return "this code should be removed";
}
\`\`\`

After the code block.
`,
      design: "# Architecture\nSimple design.\n",
      tasks: [],
    });
    const result = compressor.compress(spec);

    // Code block contents should NOT appear in compressed proposal
    expect(result.proposal).not.toContain("shouldNotExist");
    expect(result.proposal).not.toContain("this code should be removed");
    expect(result.proposal).not.toContain("```");

    // But headings and text should be preserved
    expect(result.proposal).toContain("My Proposal");
  });

  it("design compression extracts architecture", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();
    const result = compressor.compress(spec);

    const d = result.design;

    // Architecture should be extracted from the "Architecture Overview" section
    expect(d.architecture.length).toBeGreaterThan(0);
    expect(d.architecture.length).toBeLessThanOrEqual(100);

    // Patterns should be extracted
    expect(d.patterns.length).toBeGreaterThan(0);
    expect(d.patterns.length).toBeLessThanOrEqual(5);

    // Constraints should be extracted
    expect(d.constraints.length).toBeGreaterThan(0);
    expect(d.constraints.length).toBeLessThanOrEqual(5);

    // Interfaces should be extracted
    expect(d.interfaces.length).toBeGreaterThan(0);
    expect(d.interfaces.length).toBeLessThanOrEqual(10);

    // Data flow should be extracted
    expect(d.dataFlow.length).toBeGreaterThan(0);
  });

  it("compressDelta detects spec metadata changes when tasks are unchanged", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec();
    compressor.compressDelta(spec);

    // Change only proposal, keep tasks identical
    const modifiedSpec = makeSpec({
      proposal: "# Completely Different Proposal\n\nNew content here that is entirely different from before.",
    });

    const result = compressor.compressDelta(modifiedSpec);

    expect(result).not.toBeNull();
    expect(result!.changed).toContain("Spec metadata changed");
  });

  it("compressDelta detects added tasks", () => {
    const compressor = new SpecCompressor();
    const spec = makeSpec({ tasks: [makeTask({ id: "t1" })] });
    compressor.compressDelta(spec);

    const modifiedSpec = makeSpec({
      tasks: [
        makeTask({ id: "t1" }),
        makeTask({ id: "t2", title: "New task", dependencies: ["t1"] }),
      ],
    });

    const result = compressor.compressDelta(modifiedSpec);

    expect(result).not.toBeNull();
    expect(result!.changed).toContain("t2");
  });
});
