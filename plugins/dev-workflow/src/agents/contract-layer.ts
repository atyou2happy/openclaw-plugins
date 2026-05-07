import type { Contract } from "../types.js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";

// ── ValidationResult ──

export interface ValidationResult {
  valid: boolean;
  mismatches: string[];
}

// ── ContractLayer ──

export class ContractLayer {
  private contractsDir: string;
  private contracts: Contract[];

  constructor(projectDir: string) {
    this.contractsDir = join(projectDir, ".dev-workflow", "contracts");
    this.contracts = [];

    // Load existing contracts from disk if directory exists
    if (existsSync(this.contractsDir)) {
      this.loadExistingContracts();
    }
  }

  // ── Private helpers ──

  private loadExistingContracts(): void {
    try {
      const taskDirs = readdirSync(this.contractsDir, { withFileTypes: true });
      for (const dir of taskDirs) {
        if (!dir.isDirectory()) continue;
        const taskDir = join(this.contractsDir, dir.name);
        const files = readdirSync(taskDir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const raw = readFileSync(join(taskDir, file), "utf-8");
            const contract: Contract = JSON.parse(raw);
            this.contracts.push(contract);
          } catch {
            // Skip malformed contract files
          }
        }
      }
    } catch {
      // Directory may be empty or unreadable
    }
  }

  /**
   * Extract definition context (current line ± 1 line) from source text.
   */
  private extractDefinition(lines: string[], lineIndex: number): string {
    const start = Math.max(0, lineIndex - 1);
    const end = Math.min(lines.length - 1, lineIndex + 1);
    const contextLines: string[] = [];
    for (let i = start; i <= end; i++) {
      contextLines.push(lines[i]);
    }
    return contextLines.join("\n");
  }

  // ── Public API ──

  /**
   * Publish interface contracts extracted from a completed task's files.
   * Scans the task's files for TypeScript interface/type exports,
   * API schema definitions, and function signatures.
   * Saves contracts to .dev-workflow/contracts/{taskId}/
   */
  publishContracts(taskId: string, taskFiles: string[]): Contract[] {
    // Ensure the task contract directory exists
    const taskContractDir = join(this.contractsDir, taskId);
    mkdirSync(taskContractDir, { recursive: true });

    const newContracts: Contract[] = [];

    // Regex patterns for extracting contracts
    const interfaceRe = /export\s+interface\s+(\w+)/g;
    const typeRe = /export\s+type\s+(\w+)/g;
    const functionRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;

    for (const filePath of taskFiles) {
      let content: string;
      try {
        content = readFileSync(filePath, "utf-8");
      } catch {
        // Skip unreadable files
        continue;
      }

      const lines = content.split("\n");

      // Helper to process a regex pattern and create contracts
      const processPattern = (
        re: RegExp,
        type: Contract["type"],
      ): void => {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          const name = match[1];
          // Find the line number where the match occurs
          const charIndex = match.index;
          let lineIndex = 0;
          let pos = 0;
          for (let i = 0; i < lines.length; i++) {
            if (pos + lines[i].length >= charIndex) {
              lineIndex = i;
              break;
            }
            pos += lines[i].length + 1; // +1 for the newline character
          }

          const definition = this.extractDefinition(lines, lineIndex);

          const contract: Contract = {
            id: `contract-${taskId}-${name}`,
            taskId,
            type,
            name,
            definition,
            filePath,
            publishedAt: new Date().toISOString(),
          };

          // Write JSON file
          const jsonPath = join(taskContractDir, `${name}.json`);
          writeFileSync(jsonPath, JSON.stringify(contract, null, 2), "utf-8");

          // Add to in-memory cache
          this.contracts.push(contract);
          newContracts.push(contract);
        }
      };

      processPattern(interfaceRe, "interface");
      processPattern(typeRe, "type");
      processPattern(functionRe, "function-sig");
    }

    return newContracts;
  }

  /**
   * Get all contracts published by agents other than the specified one.
   * Used by an agent to discover upstream interfaces.
   */
  getContracts(excludeTaskId?: string): Contract[] {
    if (excludeTaskId) {
      return this.contracts.filter((c) => c.taskId !== excludeTaskId);
    }
    return [...this.contracts];
  }

  /**
   * Generate a mock implementation string for a given contract.
   * Returns TypeScript code that satisfies the interface.
   */
  generateMock(contract: Contract): string {
    const name = contract.name;

    switch (contract.type) {
      case "interface":
        return `export class Mock${name} implements ${name} { /* TODO: implement */ }`;
      case "type":
        return `const mock${name}: ${name} = {} as ${name};`;
      case "function-sig":
        return `function mock${name}(...args: any[]): any { /* mock */ }`;
      case "api-schema":
        return `const mock${name} = { /* mock schema */ };`;
      default:
        return `const mock${name} = {};`;
    }
  }

  /**
   * Validate that an implementation matches a contract.
   * Basic structural validation (checks for matching function/type names).
   */
  validate(contract: Contract, implementation: string): ValidationResult {
    const mismatches: string[] = [];

    // Check that the contract name appears somewhere in the implementation
    if (!implementation.includes(contract.name)) {
      mismatches.push(
        `Contract name "${contract.name}" not found in implementation`,
      );
    }

    switch (contract.type) {
      case "interface": {
        // Check for `implements <name>` or type annotation referencing the name
        const hasImplements = implementation.includes(`implements ${contract.name}`);
        const hasTypeAnnotation =
          implementation.includes(`: ${contract.name}`) ||
          implementation.includes(`<${contract.name}>`);
        if (!hasImplements && !hasTypeAnnotation) {
          mismatches.push(
            `No "implements ${contract.name}" or type annotation found for interface contract`,
          );
        }
        break;
      }
      case "function-sig": {
        // Check that a function with the contract name exists
        const funcPattern = new RegExp(
          `(?:export\\s+)?(?:async\\s+)?function\\s+${contract.name}\\s*\\(`,
        );
        if (!funcPattern.test(implementation)) {
          mismatches.push(
            `Function "${contract.name}" not found in implementation`,
          );
        }
        break;
      }
      case "type": {
        // Type contracts: check the name is referenced as a type annotation
        const typeAnnotation = new RegExp(
          `[:<]\\s*${contract.name}|as\\s+${contract.name}`,
        );
        if (!typeAnnotation.test(implementation)) {
          mismatches.push(
            `Type "${contract.name}" not referenced in implementation`,
          );
        }
        break;
      }
      case "api-schema": {
        // Basic check: name should appear as a const/variable
        const varPattern = new RegExp(
          `(?:const|let|var)\\s+\\w*${contract.name}`,
        );
        if (!varPattern.test(implementation) && !implementation.includes(contract.name)) {
          mismatches.push(
            `API schema "${contract.name}" not found in implementation`,
          );
        }
        break;
      }
    }

    return {
      valid: mismatches.length === 0,
      mismatches,
    };
  }

  /**
   * Clear all contracts (for cleanup).
   */
  clear(): void {
    this.contracts = [];
    if (existsSync(this.contractsDir)) {
      rmSync(this.contractsDir, { recursive: true, force: true });
    }
  }
}
