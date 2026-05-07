import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  SymbolGraphBuilder,
  type SymbolGraph,
} from "../symbol-graph-builder.js";

// ─── Helpers ───

let tmpDir: string;

function makeDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function writeFile(p: string, content: string) {
  mkdirSync(join(p, "..").replace(/\/$/, ""), { recursive: true });
  writeFileSync(p, content, "utf-8");
}

// ─── Sample file contents ───

const TS_FUNCTIONS = `
export function add(a: number, b: number): number {
  return a + b;
}

async function fetchData(url: string): Promise<void> {
  const res = await fetch(url);
}

const multiply = (x: number, y: number) => x * y;
`;

const TS_CLASSES_INTERFACES = `
export interface Animal {
  name: string;
  speak(): string;
}

export interface Swimmer {
  swim(): void;
}

export class Dog implements Animal {
  name: string;
  constructor(name: string) { this.name = name; }
  speak() { return "woof"; }
}

export class Duck extends Dog implements Animal, Swimmer {
  speak() { return "quack"; }
  swim() { console.log("swimming"); }
}

abstract class BaseHandler {
  abstract handle(): void;
}
`;

const TS_TYPES_ENUMS = `
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export enum Status {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

export type Point = { x: number; y: number };
`;

const TS_IMPORTS = `
import { readFileSync } from 'fs';
import path from 'path';
import type { Animal } from './animal';
import * as utils from './utils';
const config = require('./config');
`;

const PYTHON_DEFS = `
import os
from typing import List

def greet(name: str) -> str:
    return "hello " + name

async def fetch_data(url):
    pass

class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        raise NotImplementedError
`;

const NO_SYMBOLS_FILE = `
// just a comment
/* block comment */
let x = 42;
const arr = [1, 2, 3];
`;

const LARGE_FILE_CONTENT = "x".repeat(101_000); // >100KB default maxFileSize

// ─── Test Suite ───

beforeEach(() => {
  const id = Math.random().toString(36).slice(2, 10);
  tmpDir = join(tmpdir(), `sgb-test-${id}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors on CI
  }
});

describe("SymbolGraphBuilder", () => {
  // ─── build() — TS definitions ───

  describe("build — TypeScript function definitions", () => {
    it("extracts named function definitions", () => {
      writeFile(join(tmpDir, "math.ts"), TS_FUNCTIONS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const fnDefs = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "function"
      );
      const names = fnDefs.map((t) => t.name);
      expect(names).toContain("add");
      expect(names).toContain("fetchData");
      expect(names).toContain("multiply");
    });

    it("marks exported function as exported", () => {
      writeFile(join(tmpDir, "math.ts"), TS_FUNCTIONS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const addDef = graph.tags.find(
        (t) => t.name === "add" && t.kind === "def"
      );
      expect(addDef).toBeDefined();
      expect(addDef!.exported).toBe(true);

      const fetchDef = graph.tags.find(
        (t) => t.name === "fetchData" && t.kind === "def"
      );
      expect(fetchDef).toBeDefined();
      expect(fetchDef!.exported).toBe(false);
    });
  });

  describe("build — TypeScript class and interface definitions", () => {
    it("extracts class definitions", () => {
      writeFile(join(tmpDir, "animals.ts"), TS_CLASSES_INTERFACES);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const classDefs = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "class"
      );
      const names = classDefs.map((t) => t.name);
      expect(names).toContain("Dog");
      expect(names).toContain("Duck");
      expect(names).toContain("BaseHandler");
    });

    it("extracts interface definitions", () => {
      writeFile(join(tmpDir, "animals.ts"), TS_CLASSES_INTERFACES);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const ifaceDefs = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "interface"
      );
      const names = ifaceDefs.map((t) => t.name);
      expect(names).toContain("Animal");
      expect(names).toContain("Swimmer");
    });
  });

  describe("build — TypeScript type and enum definitions", () => {
    it("extracts type aliases", () => {
      writeFile(join(tmpDir, "types.ts"), TS_TYPES_ENUMS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const typeDefs = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "type"
      );
      const names = typeDefs.map((t) => t.name);
      expect(names).toContain("Result");
      expect(names).toContain("Point");
    });

    it("extracts enum definitions", () => {
      writeFile(join(tmpDir, "types.ts"), TS_TYPES_ENUMS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const enumDefs = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "enum"
      );
      const names = enumDefs.map((t) => t.name);
      expect(names).toContain("Status");
    });
  });

  // ─── build() — Python definitions ───

  describe("build — Python definitions", () => {
    it("extracts Python function defs", () => {
      writeFile(join(tmpDir, "main.py"), PYTHON_DEFS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const fnDefs = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "function" && t.file === "main.py"
      );
      const names = fnDefs.map((t) => t.name);
      expect(names).toContain("greet");
      expect(names).toContain("fetch_data");
    });

    it("extracts Python class defs", () => {
      writeFile(join(tmpDir, "main.py"), PYTHON_DEFS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const classDefs = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "class" && t.file === "main.py"
      );
      const names = classDefs.map((t) => t.name);
      expect(names).toContain("Animal");
    });
  });

  // ─── Imports ───

  describe("build — TypeScript imports", () => {
    it("extracts import statements into import graph", () => {
      writeFile(join(tmpDir, "imports.ts"), TS_IMPORTS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const imports = graph.importGraph.get("imports.ts");
      expect(imports).toBeDefined();
      expect(imports!.has("fs")).toBe(true);
      expect(imports!.has("path")).toBe(true);
      expect(imports!.has("./animal")).toBe(true);
      expect(imports!.has("./utils")).toBe(true);
      expect(imports!.has("./config")).toBe(true);
    });

    it("counts import tags correctly in stats", () => {
      writeFile(join(tmpDir, "imports.ts"), TS_IMPORTS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // 5 import statements
      expect(graph.stats.totalImports).toBeGreaterThanOrEqual(5);
    });
  });

  describe("build — Python imports", () => {
    it("extracts Python import statements", () => {
      writeFile(join(tmpDir, "main.py"), PYTHON_DEFS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const imports = graph.importGraph.get("main.py");
      expect(imports).toBeDefined();
      expect(imports!.has("os")).toBe(true);
      expect(imports!.has("typing")).toBe(true);
    });
  });

  // ─── Inheritance ───

  describe("build — TypeScript inheritance", () => {
    it("builds inheritance map with implementors", () => {
      writeFile(join(tmpDir, "animals.ts"), TS_CLASSES_INTERFACES);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // Dog implements Animal is captured
      const animalImpls = graph.inheritanceMap.get("Animal");
      expect(animalImpls).toBeDefined();
      const childNames = animalImpls!.map((e) => e.child);
      expect(childNames).toContain("Dog");
    });

    it("tracks extends relationships", () => {
      writeFile(join(tmpDir, "animals.ts"), TS_CLASSES_INTERFACES);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // Duck extends Dog
      const dogImpls = graph.inheritanceMap.get("Dog");
      expect(dogImpls).toBeDefined();
      const childNames = dogImpls!.map((e) => e.child);
      expect(childNames).toContain("Duck");
    });
  });

  // ─── Reverse reference index ───

  describe("build — reverse reference index", () => {
    it("maps symbol name to files referencing it", () => {
      writeFile(
        join(tmpDir, "defs.ts"),
        `export function targetFunc() { return 1; }\n`
      );
      writeFile(
        join(tmpDir, "caller.ts"),
        `import { targetFunc } from './defs';\nconst r = targetFunc();\n`
      );

      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const refs = graph.reverseRefs.get("targetFunc");
      expect(refs).toBeDefined();
      const files = new Set(refs!.map((r) => r.file));
      expect(files.has("caller.ts")).toBe(true);
    });
  });

  // ─── Definitions index ───

  describe("build — definitions index", () => {
    it("maps symbol name to definition entries", () => {
      writeFile(join(tmpDir, "math.ts"), TS_FUNCTIONS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const addDefs = graph.definitions.get("add");
      expect(addDefs).toBeDefined();
      expect(addDefs!.length).toBeGreaterThanOrEqual(1);
      expect(addDefs![0].type).toBe("function");
      expect(addDefs![0].exported).toBe(true);
      expect(addDefs![0].file).toBe("math.ts");
    });
  });

  // ─── Method parent resolution ───

  describe("build — method parent resolution", () => {
    it("assigns parent class to methods inside a class", () => {
      const content = `
export class Service {
  initialize() {
    this.ready = true;
  }
  async process() {
    return 42;
  }
}
`;
      writeFile(join(tmpDir, "service.ts"), content);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const methods = graph.tags.filter(
        (t) => t.kind === "def" && t.type === "method"
      );
      for (const m of methods) {
        expect(m.parent).toBe("Service");
      }
    });
  });

  // ─── Empty directories ───

  describe("build — empty directory handling", () => {
    it("returns empty graph for empty directory", () => {
      makeDir(join(tmpDir, "empty"));
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(join(tmpDir, "empty"));

      expect(graph.tags).toEqual([]);
      expect(graph.stats.filesScanned).toBe(0);
      expect(graph.stats.totalTags).toBe(0);
      expect(graph.stats.totalDefs).toBe(0);
      expect(graph.stats.totalRefs).toBe(0);
    });
  });

  // ─── Skipped directories ───

  describe("build — skip unwanted directories", () => {
    it("skips node_modules, .git, dist, build directories", () => {
      // Real files in skipped dirs
      writeFile(
        join(tmpDir, "node_modules", "pkg", "index.ts"),
        `export function fromNodeModules() {}`
      );
      writeFile(
        join(tmpDir, ".git", "hooks.ts"),
        `function gitHook() {}`
      );
      writeFile(
        join(tmpDir, "dist", "bundle.ts"),
        `function bundled() {}`
      );
      writeFile(
        join(tmpDir, "build", "output.ts"),
        `function built() {}`
      );
      // Real file at root level
      writeFile(join(tmpDir, "src.ts"), `function root() {}`);

      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const allFiles = new Set(graph.tags.map((t) => t.file));
      expect(allFiles.has("src.ts")).toBe(true);
      // None of the skipped dirs' files should appear
      for (const f of allFiles) {
        expect(f).not.toContain("node_modules");
        expect(f).not.toContain(".git");
        expect(f).not.toContain("dist");
        expect(f).not.toContain("build");
      }
    });
  });

  // ─── Max file size ───

  describe("build — skip files exceeding maxFileSize", () => {
    it("skips files larger than maxFileSize", () => {
      writeFile(join(tmpDir, "big.ts"), LARGE_FILE_CONTENT);
      writeFile(join(tmpDir, "small.ts"), `function small() {}`);

      const builder = new SymbolGraphBuilder({ maxFileSize: 100_000 });
      const graph = builder.build(tmpDir);

      const files = new Set(graph.tags.map((t) => t.file));
      expect(files.has("small.ts")).toBe(true);
      expect(files.has("big.ts")).toBe(false);
    });
  });

  // ─── Files with no extractable symbols ───

  describe("build — files with no extractable symbols", () => {
    it("handles files with no symbols without error", () => {
      writeFile(join(tmpDir, "empty.ts"), NO_SYMBOLS_FILE);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // Should not throw; may have some refs but zero defs
      expect(graph.stats.totalDefs).toBe(0);
    });

    it("still produces refs for function calls even in files with no defs", () => {
      writeFile(join(tmpDir, "caller.ts"), `ParseInt("42");\nprocess();\n`);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // ParseInt matches PascalCase ref, process matches lowercase ref
      const hasRef = graph.tags.some(
        (t) => t.kind === "ref" && (t.name === "ParseInt" || t.name === "process")
      );
      expect(hasRef).toBe(true);
    });
  });

  // ─── Multiple file types ───

  describe("build — mixed file types", () => {
    it("processes both .ts and .py files in the same project", () => {
      writeFile(join(tmpDir, "app.ts"), TS_FUNCTIONS);
      writeFile(join(tmpDir, "app.py"), PYTHON_DEFS);

      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const files = new Set(graph.tags.map((t) => t.file));
      expect(files.has("app.ts")).toBe(true);
      expect(files.has("app.py")).toBe(true);
    });
  });

  // ─── Stats ───

  describe("build — graph stats", () => {
    it("counts filesScanned correctly", () => {
      writeFile(join(tmpDir, "a.ts"), `function a() {}`);
      writeFile(join(tmpDir, "b.ts"), `function b() {}`);
      writeFile(join(tmpDir, "c.py"), `def c(): pass`);

      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      expect(graph.stats.filesScanned).toBe(3);
    });

    it("counts totalDefs, totalRefs, totalTags consistently", () => {
      writeFile(join(tmpDir, "math.ts"), TS_FUNCTIONS);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const defs = graph.tags.filter((t) => t.kind === "def").length;
      const refs = graph.tags.filter((t) => t.kind === "ref").length;
      expect(graph.stats.totalDefs).toBe(defs);
      expect(graph.stats.totalRefs + graph.stats.totalImports + graph.stats.totalInheritance).toBe(refs);
      expect(graph.stats.totalTags).toBe(graph.tags.length);
    });

    it("counts totalInheritance correctly", () => {
      writeFile(join(tmpDir, "animals.ts"), TS_CLASSES_INTERFACES);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // Dog implements Animal, Duck extends Dog — regex captures first relationship per line
      expect(graph.stats.totalInheritance).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── toCompactString ───

  describe("toCompactString", () => {
    it("serializes definitions with their ref counts", () => {
      writeFile(join(tmpDir, "lib.ts"), `export function myFunc() { return 1; }`);
      writeFile(
        join(tmpDir, "app.ts"),
        `import { myFunc } from './lib';\nmyFunc();\n`
      );

      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);
      const str = builder.toCompactString(graph);

      expect(str).toContain("myFunc");
      expect(str).toContain("lib.ts");
      expect(str).toContain("function");
    });

    it("respects token budget", () => {
      // Create many symbols
      let content = "";
      for (let i = 0; i < 200; i++) {
        content += `export function func${i}() { return ${i}; }\n`;
      }
      writeFile(join(tmpDir, "many.ts"), content);

      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);
      const str = builder.toCompactString(graph, 100);

      // Should not be excessively long; token budget limits output
      // The line count should be less than the total number of defs
      const lineCount = str.split("\n").filter((l) => l.length > 0).length;
      const totalDefs = graph.stats.totalDefs;
      expect(lineCount).toBeLessThanOrEqual(totalDefs);
      // Should be reasonably short
      expect(str.length).toBeLessThan(10000);
    });

    it("returns empty string for empty graph", () => {
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);
      const str = builder.toCompactString(graph);
      expect(str).toBe("");
    });

    it("marks exported symbols in output", () => {
      writeFile(join(tmpDir, "lib.ts"), `export function exportedFunc() {}\nfunction privateFunc() {}\n`);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);
      const str = builder.toCompactString(graph);

      const exportedLine = str
        .split("\n")
        .find((l) => l.includes("exportedFunc"));
      expect(exportedLine).toBeDefined();
      expect(exportedLine!).toContain("exported");
    });
  });

  // ─── update() — incremental ───

  describe("update — incremental graph update", () => {
    it("adds tags from a new file", () => {
      writeFile(join(tmpDir, "existing.ts"), `function existing() {}`);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const newFile = join(tmpDir, "new.ts");
      writeFile(newFile, `function added() {}`);

      const updated = builder.update(graph, tmpDir, [newFile]);

      const names = updated.tags
        .filter((t) => t.kind === "def")
        .map((t) => t.name);
      expect(names).toContain("existing");
      expect(names).toContain("added");
    });

    it("replaces tags for a modified file", () => {
      writeFile(join(tmpDir, "mod.ts"), `function original() {}`);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // Overwrite the file
      writeFile(join(tmpDir, "mod.ts"), `function renamed() {}`);

      const updated = builder.update(graph, tmpDir, [
        join(tmpDir, "mod.ts"),
      ]);

      const names = updated.tags
        .filter((t) => t.kind === "def")
        .map((t) => t.name);
      expect(names).toContain("renamed");
      expect(names).not.toContain("original");
    });

    it("handles file removal by providing empty content", () => {
      writeFile(join(tmpDir, "a.ts"), `function a() {}`);
      writeFile(join(tmpDir, "b.ts"), `function b() {}`);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      // Remove b.ts — pass it as changed; since it won't be read, tags from it are dropped
      rmSync(join(tmpDir, "b.ts"));
      const updated = builder.update(graph, tmpDir, [
        join(tmpDir, "b.ts"),
      ]);

      const names = updated.tags
        .filter((t) => t.kind === "def")
        .map((t) => t.name);
      expect(names).toContain("a");
      expect(names).not.toContain("b");
    });

    it("preserves tags from unchanged files", () => {
      writeFile(join(tmpDir, "keep.ts"), `function keep() {}`);
      writeFile(join(tmpDir, "change.ts"), `function before() {}`);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      writeFile(join(tmpDir, "change.ts"), `function after() {}`);
      const updated = builder.update(graph, tmpDir, [
        join(tmpDir, "change.ts"),
      ]);

      const names = updated.tags
        .filter((t) => t.kind === "def")
        .map((t) => t.name);
      expect(names).toContain("keep");
      expect(names).toContain("after");
      expect(names).not.toContain("before");
    });
  });

  // ─── Custom config ───

  describe("custom config", () => {
    it("respects custom extensions filter", () => {
      writeFile(join(tmpDir, "app.ts"), `function tsFunc() {}`);
      writeFile(join(tmpDir, "app.py"), `def py_func(): pass`);

      const builder = new SymbolGraphBuilder({ extensions: [".py"] });
      const graph = builder.build(tmpDir);

      const files = new Set(graph.tags.map((t) => t.file));
      expect(files.has("app.py")).toBe(true);
      expect(files.has("app.ts")).toBe(false);
    });

    it("respects maxFiles limit", () => {
      for (let i = 0; i < 10; i++) {
        writeFile(join(tmpDir, `file${i}.ts`), `function f${i}() {}`);
      }

      const builder = new SymbolGraphBuilder({ maxFiles: 3 });
      const graph = builder.build(tmpDir);

      expect(graph.stats.filesScanned).toBeLessThanOrEqual(3);
    });

    it("respects custom skipDirs", () => {
      writeFile(join(tmpDir, "custom_skip", "inner.ts"), `function hidden() {}`);
      writeFile(join(tmpDir, "visible.ts"), `function visible() {}`);

      const builder = new SymbolGraphBuilder({
        skipDirs: ["node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv", "coverage", ".next", "custom_skip"],
      });
      const graph = builder.build(tmpDir);

      const files = new Set(graph.tags.map((t) => t.file));
      expect(files.has("visible.ts")).toBe(true);
      for (const f of files) {
        expect(f).not.toContain("custom_skip");
      }
    });
  });

  // ─── Import graph ───

  describe("build — import graph: file → imported files", () => {
    it("maps each source file to the modules it imports", () => {
      writeFile(
        join(tmpDir, "a.ts"),
        `import { b } from './b';\nimport { c } from './c';\n`
      );
      writeFile(join(tmpDir, "b.ts"), `export function b() {}`);
      writeFile(join(tmpDir, "c.ts"), `export function c() {}`);

      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const aImports = graph.importGraph.get("a.ts");
      expect(aImports).toBeDefined();
      expect(aImports!.has("./b")).toBe(true);
      expect(aImports!.has("./c")).toBe(true);

      // b.ts and c.ts have no imports
      expect(graph.importGraph.get("b.ts")).toBeUndefined();
    });
  });

  // ─── Edge cases ───

  describe("edge cases", () => {
    it("handles non-existent directory gracefully", () => {
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(join(tmpDir, "does_not_exist"));
      expect(graph.tags).toEqual([]);
      expect(graph.stats.filesScanned).toBe(0);
    });

    it("handles files with only comments", () => {
      writeFile(join(tmpDir, "comments.ts"), `// nothing here\n/* no code */\n`);
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);
      // Should not throw; 0 tags is fine for comment-only files
      expect(graph.stats.totalTags).toBe(0);
    });

    it("handles .tsx and .jsx extensions", () => {
      writeFile(
        join(tmpDir, "component.tsx"),
        `export function App() { return null; }\n`
      );
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const defs = graph.definitions.get("App");
      expect(defs).toBeDefined();
    });

    it("handles .mjs extension", () => {
      writeFile(
        join(tmpDir, "module.mjs"),
        `export function esmFunc() {}\n`
      );
      const builder = new SymbolGraphBuilder();
      const graph = builder.build(tmpDir);

      const defs = graph.definitions.get("esmFunc");
      expect(defs).toBeDefined();
    });
  });
});
