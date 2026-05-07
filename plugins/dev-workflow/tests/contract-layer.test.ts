import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ContractLayer } from "../src/agents/contract-layer.js";
import type { Contract } from "../src/types.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "contract-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("ContractLayer", () => {
  // ── 1. publishes interface contracts ──

  it("publishes interface contracts", () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });

    const filePath = join(srcDir, "user-service.ts");
    writeFileSync(
      filePath,
      `export interface IUserService { getUser(): User; }\n`,
      "utf-8",
    );

    const layer = new ContractLayer(tempDir);
    const contracts = layer.publishContracts("task-1", [filePath]);

    expect(contracts).toHaveLength(1);
    expect(contracts[0].type).toBe("interface");
    expect(contracts[0].name).toBe("IUserService");
    expect(contracts[0].taskId).toBe("task-1");
    expect(contracts[0].definition).toContain("IUserService");
  });

  // ── 2. publishes type contracts ──

  it("publishes type contracts", () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });

    const filePath = join(srcDir, "types.ts");
    writeFileSync(filePath, `export type UserRole = "admin" | "user";\n`, "utf-8");

    const layer = new ContractLayer(tempDir);
    const contracts = layer.publishContracts("task-2", [filePath]);

    expect(contracts).toHaveLength(1);
    expect(contracts[0].type).toBe("type");
    expect(contracts[0].name).toBe("UserRole");
  });

  // ── 3. publishes function signature contracts ──

  it("publishes function signature contracts", () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });

    const filePath = join(srcDir, "users.ts");
    writeFileSync(
      filePath,
      `export async function createUser(data: CreateDTO): Promise<User>\n`,
      "utf-8",
    );

    const layer = new ContractLayer(tempDir);
    const contracts = layer.publishContracts("task-3", [filePath]);

    expect(contracts).toHaveLength(1);
    expect(contracts[0].type).toBe("function-sig");
    expect(contracts[0].name).toBe("createUser");
  });

  // ── 4. gets contracts excluding specific task ──

  it("gets contracts excluding specific task", () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });

    const fileA = join(srcDir, "a.ts");
    const fileB = join(srcDir, "b.ts");
    writeFileSync(fileA, `export interface ServiceA { run(): void; }\n`, "utf-8");
    writeFileSync(fileB, `export interface ServiceB { exec(): void; }\n`, "utf-8");

    const layer = new ContractLayer(tempDir);
    layer.publishContracts("task-1", [fileA]);
    layer.publishContracts("task-2", [fileB]);

    const filtered = layer.getContracts("task-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].taskId).toBe("task-2");
    expect(filtered[0].name).toBe("ServiceB");
  });

  // ── 5. generates mock for interface ──

  it("generates mock for interface", () => {
    const layer = new ContractLayer(tempDir);

    const contract: Contract = {
      id: "contract-task-5-IFoo",
      taskId: "task-5",
      type: "interface",
      name: "IFoo",
      definition: "export interface IFoo {}",
      filePath: "/tmp/foo.ts",
      publishedAt: new Date().toISOString(),
    };

    const mock = layer.generateMock(contract);
    expect(mock).toContain("implements");
    expect(mock).toContain("IFoo");
  });

  // ── 6. generates mock for function signature ──

  it("generates mock for function signature", () => {
    const layer = new ContractLayer(tempDir);

    const contract: Contract = {
      id: "contract-task-6-doWork",
      taskId: "task-6",
      type: "function-sig",
      name: "doWork",
      definition: "export function doWork(): void",
      filePath: "/tmp/work.ts",
      publishedAt: new Date().toISOString(),
    };

    const mock = layer.generateMock(contract);
    expect(mock).toContain("doWork");
  });

  // ── 7. validates matching implementation ──

  it("validates matching implementation", () => {
    const layer = new ContractLayer(tempDir);

    const contract: Contract = {
      id: "contract-task-7-IRepo",
      taskId: "task-7",
      type: "interface",
      name: "IRepo",
      definition: "export interface IRepo { find(): void; }",
      filePath: "/tmp/repo.ts",
      publishedAt: new Date().toISOString(),
    };

    const implementation = `export class Repo implements IRepo { find() {} }`;
    const result = layer.validate(contract, implementation);

    expect(result.valid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  // ── 8. validates mismatched implementation ──

  it("validates mismatched implementation", () => {
    const layer = new ContractLayer(tempDir);

    const contract: Contract = {
      id: "contract-task-8-ICache",
      taskId: "task-8",
      type: "interface",
      name: "ICache",
      definition: "export interface ICache { get(): string; }",
      filePath: "/tmp/cache.ts",
      publishedAt: new Date().toISOString(),
    };

    const implementation = `export class SomethingElse { doStuff() {} }`;
    const result = layer.validate(contract, implementation);

    expect(result.valid).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
  });

  // ── 9. clears all contracts ──

  it("clears all contracts", () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });

    const filePath = join(srcDir, "svc.ts");
    writeFileSync(filePath, `export interface ISvc { run(): void; }\n`, "utf-8");

    const layer = new ContractLayer(tempDir);
    layer.publishContracts("task-9", [filePath]);
    expect(layer.getContracts()).toHaveLength(1);

    layer.clear();
    expect(layer.getContracts()).toHaveLength(0);
  });

  // ── 10. loads existing contracts from disk ──

  it("loads existing contracts from disk", () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });

    const filePath = join(srcDir, "store.ts");
    writeFileSync(filePath, `export interface IStore { get(): string; }\n`, "utf-8");

    // First instance: publish and persist to disk
    const layer1 = new ContractLayer(tempDir);
    layer1.publishContracts("task-10", [filePath]);
    expect(layer1.getContracts()).toHaveLength(1);

    // Second instance: same projectDir → should load from disk
    const layer2 = new ContractLayer(tempDir);
    const loaded = layer2.getContracts();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("IStore");
    expect(loaded[0].type).toBe("interface");
    expect(loaded[0].taskId).toBe("task-10");
  });
});
