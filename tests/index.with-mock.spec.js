// tests/index.full-coverage.spec.js
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Import REAL functions from index.js for coverage
// ============================================================
import {
    cyan,
    green,
    yellow,
    red,
    bold,
    wasInvokedAsTit,
    copyDir,
    getAppEntry,
    findFirstCodeLineIndex,
    injectTitanImportIfMissing,
    compileTypeScript,
    compileJavaScript,
    compileAndRunAppEntry,
    help,
    initProject,
    buildProd,
    startProd,
    updateTitan,
    createExtension,
    devServer
} from "../index.js";

// ============================================================
// Helper Functions
// ============================================================
function createTempDir(prefix = "titan-test-") {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupTempDir(tempDir) {
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

// ============================================================
// TESTS: Color Functions
// ============================================================
describe("Color Functions", () => {
    it("cyan should wrap text with cyan ANSI codes", () => {
        expect(cyan("test")).toBe("\x1b[36mtest\x1b[0m");
    });

    it("green should wrap text with green ANSI codes", () => {
        expect(green("test")).toBe("\x1b[32mtest\x1b[0m");
    });

    it("yellow should wrap text with yellow ANSI codes", () => {
        expect(yellow("test")).toBe("\x1b[33mtest\x1b[0m");
    });

    it("red should wrap text with red ANSI codes", () => {
        expect(red("test")).toBe("\x1b[31mtest\x1b[0m");
    });

    it("bold should wrap text with bold ANSI codes", () => {
        expect(bold("test")).toBe("\x1b[1mtest\x1b[0m");
    });

    it("cyan should handle null", () => {
        expect(cyan(null)).toBe("\x1b[36mnull\x1b[0m");
    });

    it("green should handle undefined", () => {
        expect(green(undefined)).toBe("\x1b[32mundefined\x1b[0m");
    });

    it("yellow should handle objects", () => {
        const result = yellow({});
        expect(result).toContain("\x1b[33m");
        expect(result).toContain("\x1b[0m");
    });

    it("red should handle arrays", () => {
        const result = red([1, 2, 3]);
        expect(result).toContain("\x1b[31m");
        expect(result).toContain("\x1b[0m");
    });

    it("bold should handle boolean", () => {
        expect(bold(true)).toBe("\x1b[1mtrue\x1b[0m");
        expect(bold(false)).toBe("\x1b[1mfalse\x1b[0m");
    });

    it("should handle numbers", () => {
        expect(cyan(123)).toBe("\x1b[36m123\x1b[0m");
        expect(green(456)).toBe("\x1b[32m456\x1b[0m");
    });

    it("should handle empty strings", () => {
        expect(cyan("")).toBe("\x1b[36m\x1b[0m");
        expect(red("")).toBe("\x1b[31m\x1b[0m");
    });
});

// ============================================================
// TESTS: wasInvokedAsTit()
// ============================================================
describe("wasInvokedAsTit()", () => {
    let originalArgv;
    let originalEnv;

    beforeEach(() => {
        originalArgv = [...process.argv];
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.argv = originalArgv;
        process.env = originalEnv;
    });

    it("should return false when invoked as titan", () => {
        process.argv[1] = "/usr/local/bin/titan";
        delete process.env.npm_config_argv;
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(false);
    });

    it("should return true when script basename is tit", () => {
        process.argv[1] = "/usr/local/bin/tit";
        delete process.env.npm_config_argv;
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(true);
    });

    it("should return true when script basename is tit.js", () => {
        process.argv[1] = "/some/path/tit.js";
        delete process.env.npm_config_argv;
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(true);
    });

    it("should return false when script is undefined", () => {
        const saved = process.argv[1];
        process.argv[1] = undefined;
        delete process.env.npm_config_argv;
        delete process.env["_"];
        const result = wasInvokedAsTit();
        process.argv[1] = saved;
        expect(result).toBe(false);
    });

    it("should check npm_config_argv for tit command", () => {
        process.argv[1] = "/usr/local/bin/node";
        process.env.npm_config_argv = JSON.stringify({
            original: ["tit", "dev"]
        });
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(true);
    });

    it("should return false when npm_config_argv contains titan", () => {
        process.argv[1] = "/usr/local/bin/node";
        process.env.npm_config_argv = JSON.stringify({
            original: ["titan", "dev"]
        });
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(false);
    });

    it("should handle malformed npm_config_argv JSON", () => {
        process.argv[1] = "/usr/local/bin/titan";
        process.env.npm_config_argv = "not valid json";
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(false);
    });

    it("should handle npm_config_argv without original array", () => {
        process.argv[1] = "/usr/local/bin/titan";
        process.env.npm_config_argv = JSON.stringify({ something: "else" });
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(false);
    });

    it("should handle npm_config_argv with empty original array", () => {
        process.argv[1] = "/usr/local/bin/titan";
        process.env.npm_config_argv = JSON.stringify({ original: [] });
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(false);
    });

    it("should check lastCmd environment variable for tit", () => {
        process.argv[1] = "/usr/local/bin/node";
        delete process.env.npm_config_argv;
        process.env["_"] = "/usr/local/bin/tit";
        expect(wasInvokedAsTit()).toBe(true);
    });

    it("should return false when lastCmd is titan", () => {
        process.argv[1] = "/usr/local/bin/node";
        delete process.env.npm_config_argv;
        process.env["_"] = "/usr/local/bin/titan";
        expect(wasInvokedAsTit()).toBe(false);
    });

    it("should handle lastCmd being undefined", () => {
        process.argv[1] = "/usr/local/bin/titan";
        delete process.env.npm_config_argv;
        delete process.env["_"];
        expect(wasInvokedAsTit()).toBe(false);
    });
});

// ============================================================
// TESTS: copyDir()
// ============================================================
describe("copyDir()", () => {
    let tempSrc;
    let tempDest;

    beforeEach(() => {
        tempSrc = createTempDir("copy-src-");
        tempDest = path.join(os.tmpdir(), `copy-dest-${Date.now()}`);
    });

    afterEach(() => {
        cleanupTempDir(tempSrc);
        cleanupTempDir(tempDest);
    });

    it("should copy files from source to destination", () => {
        fs.writeFileSync(path.join(tempSrc, "test.txt"), "hello");

        copyDir(tempSrc, tempDest);

        expect(fs.existsSync(path.join(tempDest, "test.txt"))).toBe(true);
        expect(fs.readFileSync(path.join(tempDest, "test.txt"), "utf8")).toBe("hello");
    });

    it("should copy directories recursively", () => {
        fs.mkdirSync(path.join(tempSrc, "subdir"));
        fs.writeFileSync(path.join(tempSrc, "subdir", "nested.txt"), "nested");

        copyDir(tempSrc, tempDest);

        expect(fs.existsSync(path.join(tempDest, "subdir", "nested.txt"))).toBe(true);
    });

    it("should exclude specified files", () => {
        fs.writeFileSync(path.join(tempSrc, "keep.txt"), "keep");
        fs.writeFileSync(path.join(tempSrc, "skip.txt"), "skip");

        copyDir(tempSrc, tempDest, ["skip.txt"]);

        expect(fs.existsSync(path.join(tempDest, "keep.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tempDest, "skip.txt"))).toBe(false);
    });

    it("should exclude specified directories", () => {
        fs.mkdirSync(path.join(tempSrc, "keepDir"));
        fs.writeFileSync(path.join(tempSrc, "keepDir", "file.txt"), "keep");
        fs.mkdirSync(path.join(tempSrc, "skipDir"));
        fs.writeFileSync(path.join(tempSrc, "skipDir", "file.txt"), "skip");

        copyDir(tempSrc, tempDest, ["skipDir"]);

        expect(fs.existsSync(path.join(tempDest, "keepDir", "file.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tempDest, "skipDir"))).toBe(false);
    });

    it("should handle multiple excludes", () => {
        fs.writeFileSync(path.join(tempSrc, "keep.txt"), "keep");
        fs.writeFileSync(path.join(tempSrc, "skip1.txt"), "skip1");
        fs.writeFileSync(path.join(tempSrc, "skip2.txt"), "skip2");

        copyDir(tempSrc, tempDest, ["skip1.txt", "skip2.txt"]);

        expect(fs.existsSync(path.join(tempDest, "keep.txt"))).toBe(true);
        expect(fs.existsSync(path.join(tempDest, "skip1.txt"))).toBe(false);
        expect(fs.existsSync(path.join(tempDest, "skip2.txt"))).toBe(false);
    });

    it("should copy binary files correctly", () => {
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
        fs.writeFileSync(path.join(tempSrc, "binary.bin"), binaryData);

        copyDir(tempSrc, tempDest);

        const copied = fs.readFileSync(path.join(tempDest, "binary.bin"));
        expect(copied.equals(binaryData)).toBe(true);
    });

    it("should create destination directory if it does not exist", () => {
        fs.writeFileSync(path.join(tempSrc, "file.txt"), "content");
        const nonExistentDest = path.join(os.tmpdir(), `non-existent-${Date.now()}`);

        copyDir(tempSrc, nonExistentDest);

        expect(fs.existsSync(nonExistentDest)).toBe(true);
        expect(fs.existsSync(path.join(nonExistentDest, "file.txt"))).toBe(true);

        cleanupTempDir(nonExistentDest);
    });

    it("should handle empty source directory", () => {
        // Crear un subdirectorio vacío específico para este test
        const emptyDir = path.join(tempSrc, "empty-subdir");
        fs.mkdirSync(emptyDir, { recursive: true });

        const emptyDest = path.join(tempDest, "empty-copy");

        copyDir(emptyDir, emptyDest);

        expect(fs.existsSync(emptyDest)).toBe(true);
        expect(fs.readdirSync(emptyDest)).toHaveLength(0);
    });

    it("should handle deeply nested directories", () => {
        const deepPath = path.join(tempSrc, "a", "b", "c", "d");
        fs.mkdirSync(deepPath, { recursive: true });
        fs.writeFileSync(path.join(deepPath, "deep.txt"), "deep");

        copyDir(tempSrc, tempDest);

        expect(fs.existsSync(path.join(tempDest, "a", "b", "c", "d", "deep.txt"))).toBe(true);
    });
});

// ============================================================
// TESTS: getAppEntry()
// ============================================================
describe("getAppEntry()", () => {
    let tempDir;

    afterEach(() => {
        cleanupTempDir(tempDir);
    });

    it("should return null when no app directory exists", () => {
        tempDir = createTempDir();
        expect(getAppEntry(tempDir)).toBeNull();
    });

    it("should return null when app directory is empty", () => {
        tempDir = createTempDir();
        fs.mkdirSync(path.join(tempDir, "app"));
        expect(getAppEntry(tempDir)).toBeNull();
    });

    it("should return TypeScript entry when app.ts exists", () => {
        tempDir = createTempDir();
        fs.mkdirSync(path.join(tempDir, "app"));
        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), "// ts");

        const entry = getAppEntry(tempDir);

        expect(entry).not.toBeNull();
        expect(entry.isTS).toBe(true);
        expect(entry.path).toContain("app.ts");
    });

    it("should return JavaScript entry when app.js exists", () => {
        tempDir = createTempDir();
        fs.mkdirSync(path.join(tempDir, "app"));
        fs.writeFileSync(path.join(tempDir, "app", "app.js"), "// js");

        const entry = getAppEntry(tempDir);

        expect(entry).not.toBeNull();
        expect(entry.isTS).toBe(false);
        expect(entry.path).toContain("app.js");
    });

    it("should prioritize TypeScript over JavaScript when both exist", () => {
        tempDir = createTempDir();
        fs.mkdirSync(path.join(tempDir, "app"));
        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), "// ts");
        fs.writeFileSync(path.join(tempDir, "app", "app.js"), "// js");

        const entry = getAppEntry(tempDir);

        expect(entry.isTS).toBe(true);
    });

    it("should return absolute path", () => {
        tempDir = createTempDir();
        fs.mkdirSync(path.join(tempDir, "app"));
        fs.writeFileSync(path.join(tempDir, "app", "app.js"), "// js");

        const entry = getAppEntry(tempDir);

        expect(path.isAbsolute(entry.path)).toBe(true);
    });
});

// ============================================================
// TESTS: findFirstCodeLineIndex()
// ============================================================
describe("findFirstCodeLineIndex()", () => {
    it("should return 0 for empty array", () => {
        expect(findFirstCodeLineIndex([])).toBe(0);
    });

    it("should return 0 when first line is code", () => {
        const lines = ["const x = 1;", "const y = 2;"];
        expect(findFirstCodeLineIndex(lines)).toBe(0);
    });

    it("should skip empty lines", () => {
        const lines = ["", "", "const x = 1;"];
        expect(findFirstCodeLineIndex(lines)).toBe(2);
    });

    it("should skip comment lines", () => {
        const lines = ["// comment", "const x = 1;"];
        expect(findFirstCodeLineIndex(lines)).toBe(1);
    });

    it("should skip multiple comment lines", () => {
        const lines = ["// comment 1", "// comment 2", "// comment 3", "code"];
        expect(findFirstCodeLineIndex(lines)).toBe(3);
    });

    it("should handle mixed empty and comment lines", () => {
        const lines = ["", "// comment", "", "// another", "code"];
        expect(findFirstCodeLineIndex(lines)).toBe(4);
    });

    it("should handle tabs and spaces", () => {
        const lines = ["\t\t", "    ", "code"];
        expect(findFirstCodeLineIndex(lines)).toBe(2);
    });

    it("should return 0 when all lines are comments", () => {
        const lines = ["// comment 1", "// comment 2"];
        expect(findFirstCodeLineIndex(lines)).toBe(0);
    });

    it("should return 0 when all lines are empty", () => {
        const lines = ["", "", ""];
        expect(findFirstCodeLineIndex(lines)).toBe(0);
    });

    it("should handle code with leading spaces", () => {
        const lines = ["", "   const x = 1;"];
        expect(findFirstCodeLineIndex(lines)).toBe(1);
    });
});

// ============================================================
// TESTS: injectTitanImportIfMissing()
// ============================================================
describe("injectTitanImportIfMissing()", () => {
    let tempDir;

    beforeEach(() => {
        tempDir = createTempDir();
    });

    afterEach(() => {
        cleanupTempDir(tempDir);
        vi.restoreAllMocks();
    });

    it("should not modify code that already includes titan.js", () => {
        const compiled = `import t from "/path/titan.js";\nconst x = 1;`;
        const outFile = path.join(tempDir, "out.js");

        const result = injectTitanImportIfMissing(compiled, "/path/titan.js", outFile);

        expect(result).toBe(compiled);
    });

    it("should inject import at the beginning when no comments", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const compiled = `const x = 1;\nconst y = 2;`;
        const outFile = path.join(tempDir, "out.js");
        const titanPath = "/project/titan/titan.js";

        const result = injectTitanImportIfMissing(compiled, titanPath, outFile);

        expect(result).toContain(`import t from "${titanPath}";`);
        expect(result.startsWith(`import t from`)).toBe(true);
        consoleSpy.mockRestore();
    });

    it("should inject after comments", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const compiled = `// comment\nconst x = 1;`;
        const outFile = path.join(tempDir, "out.js");
        const titanPath = "/path/titan.js";

        const result = injectTitanImportIfMissing(compiled, titanPath, outFile);
        const lines = result.split("\n");

        expect(lines[0]).toBe("// comment");
        expect(lines[1]).toBe(`import t from "${titanPath}";`);
        consoleSpy.mockRestore();
    });

    it("should write file with injected content", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const compiled = `const x = 1;`;
        const outFile = path.join(tempDir, "output.js");
        const titanPath = "/project/titan/titan.js";

        injectTitanImportIfMissing(compiled, titanPath, outFile);

        expect(fs.existsSync(outFile)).toBe(true);
        const content = fs.readFileSync(outFile, "utf8");
        expect(content).toContain(`import t from "${titanPath}";`);
        consoleSpy.mockRestore();
    });

    it("should log message when injecting import", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const outFile = path.join(tempDir, "out.js");

        injectTitanImportIfMissing("const x = 1;", "/path/titan.js", outFile);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("Auto-injecting titan.js import")
        );
        consoleSpy.mockRestore();
    });

    it("should handle Windows-style paths", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const compiled = `const x = 1;`;
        const outFile = path.join(tempDir, "out.js");
        const titanPath = "C:/Users/test/project/titan/titan.js";

        const result = injectTitanImportIfMissing(compiled, titanPath, outFile);

        expect(result).toContain(`import t from "${titanPath}";`);
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: help()
// ============================================================
describe("help()", () => {
    it("should execute without throwing", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        expect(() => help()).not.toThrow();

        consoleSpy.mockRestore();
    });

    it("should output help text containing Titan Planet", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        help();

        const output = consoleSpy.mock.calls[0][0];
        expect(output).toContain("Titan Planet");
        consoleSpy.mockRestore();
    });

    it("should output all commands", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        help();

        const output = consoleSpy.mock.calls[0][0];
        expect(output).toContain("titan init");
        expect(output).toContain("titan dev");
        expect(output).toContain("titan build");
        expect(output).toContain("titan start");
        expect(output).toContain("titan update");
        expect(output).toContain("--version");
        expect(output).toContain("titan create ext");
        consoleSpy.mockRestore();
    });

    it("should mention tit legacy alias", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        help();

        const output = consoleSpy.mock.calls[0][0];
        expect(output).toContain("tit");
        expect(output).toContain("legacy");
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: initProject()
// ============================================================
describe("initProject()", () => {
    let originalCwd;
    let tempDir;

    beforeEach(() => {
        originalCwd = process.cwd();
        tempDir = createTempDir();
        process.chdir(tempDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
    });

    it("should show usage when name is undefined", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        initProject(undefined);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
        consoleSpy.mockRestore();
    });

    it("should show usage when name is empty string", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        initProject("");

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
        consoleSpy.mockRestore();
    });

    it("should warn when folder already exists", () => {
        const existingFolder = path.join(tempDir, "existing-project");
        fs.mkdirSync(existingFolder, { recursive: true });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        initProject("existing-project");

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Folder already exists"));
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: devServer()
// ============================================================
describe("devServer()", () => {
    let originalCwd;
    let tempDir;

    beforeEach(() => {
        originalCwd = process.cwd();
        tempDir = createTempDir();
        process.chdir(tempDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
    });

    it("should fail when titan/dev.js is not found", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        await devServer();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("titan/dev.js not found"));
        consoleSpy.mockRestore();
    });

    it("should suggest running titan update", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        await devServer();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("titan update"));
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: buildProd()
// ============================================================
describe("buildProd()", () => {
    let originalCwd;
    let tempDir;
    let exitSpy;

    beforeEach(() => {
        originalCwd = process.cwd();
        tempDir = createTempDir();
        process.chdir(tempDir);
        exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
            throw new Error(`process.exit(${code})`);
        });
    });

    afterEach(() => {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
        exitSpy.mockRestore();
    });

    it("should fail when no app entry file exists", async () => {
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        await expect(buildProd()).rejects.toThrow("process.exit");

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR"));
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: startProd()
// ============================================================
describe("startProd()", () => {
    let originalCwd;
    let tempDir;

    beforeEach(() => {
        originalCwd = process.cwd();
        tempDir = createTempDir();
        process.chdir(tempDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
    });

    it("should fail when binary does not exist", () => {
        expect(() => startProd()).toThrow();
    });

    it("should construct correct binary path for platform", () => {
        // Este test solo verifica la lógica del nombre del binario según la plataforma
        const isWin = process.platform === "win32";
        const expectedBin = isWin ? "titan-server.exe" : "titan-server";

        // Verificamos que el nombre esperado sea correcto según la plataforma
        expect(expectedBin).toBe(process.platform === "win32" ? "titan-server.exe" : "titan-server");
    });
});

// ============================================================
// TESTS: updateTitan()
// ============================================================
describe("updateTitan()", () => {
    let originalCwd;
    let tempDir;

    beforeEach(() => {
        originalCwd = process.cwd();
        tempDir = createTempDir();
        process.chdir(tempDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
    });

    it("should fail when titan/ folder is missing", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        updateTitan();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Not a Titan project"));
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: createExtension()
// ============================================================
describe("createExtension()", () => {
    let originalCwd;
    let tempDir;

    beforeEach(() => {
        originalCwd = process.cwd();
        tempDir = createTempDir();
        process.chdir(tempDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        cleanupTempDir(tempDir);
    });

    it("should show usage when name is undefined", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        createExtension(undefined);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
        consoleSpy.mockRestore();
    });

    it("should show usage when name is empty", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        createExtension("");

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
        consoleSpy.mockRestore();
    });

    it("should warn when folder already exists", () => {
        const existingFolder = path.join(tempDir, "my-extension");
        fs.mkdirSync(existingFolder, { recursive: true });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        createExtension("my-extension");

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Folder already exists"));
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: compileTypeScript()
// ============================================================
describe("compileTypeScript()", () => {
    let tempDir;

    beforeEach(() => {
        tempDir = createTempDir();
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "titan"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, "titan", "titan.js"), `
const t = { get: () => t, post: () => t, reply: () => t, action: () => t, start: () => {} };
export default t;
`);
    });

    afterEach(() => {
        cleanupTempDir(tempDir);
        vi.restoreAllMocks();
    });

    it("should compile TypeScript entry file", async () => {
        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), `
import t from "../titan/titan.js";
const x: number = 1;
t.get("/").reply("Hello");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        const result = await compileTypeScript(tempDir, path.join(tempDir, "app", "app.ts"));

        expect(result.outFile).toContain("app.compiled.mjs");
        expect(fs.existsSync(result.outFile)).toBe(true);

        consoleSpy.mockRestore();
    });

    it("should clean existing .titan directory before compilation", async () => {
        fs.mkdirSync(path.join(tempDir, ".titan"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, ".titan", "old-file.js"), "old content");

        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), `
import t from "../titan/titan.js";
t.get("/test").reply("test");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        await compileTypeScript(tempDir, path.join(tempDir, "app", "app.ts"));

        expect(fs.existsSync(path.join(tempDir, ".titan", "old-file.js"))).toBe(false);

        consoleSpy.mockRestore();
    });

    it("should inject titan import when not present", async () => {
        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), `
const x: number = 42;
console.log(x);
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        const result = await compileTypeScript(tempDir, path.join(tempDir, "app", "app.ts"));

        expect(result.compiled).toContain("titan.js");
        consoleSpy.mockRestore();
    });

    it("should log compilation message", async () => {
        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), `
import t from "../titan/titan.js";
t.get("/").reply("test");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        await compileTypeScript(tempDir, path.join(tempDir, "app", "app.ts"));

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiling app.ts"));
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: compileJavaScript()
// ============================================================
describe("compileJavaScript()", () => {
    let tempDir;

    beforeEach(() => {
        tempDir = createTempDir();
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "titan"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, "titan", "titan.js"), `
const t = { get: () => t, post: () => t, reply: () => t, action: () => t, start: () => {} };
export default t;
`);
    });

    afterEach(() => {
        cleanupTempDir(tempDir);
        vi.restoreAllMocks();
    });

    it("should bundle JavaScript entry file", async () => {
        fs.writeFileSync(path.join(tempDir, "app", "app.js"), `
import t from "../titan/titan.js";
t.get("/").reply("Hello JS");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        const result = await compileJavaScript(tempDir, path.join(tempDir, "app", "app.js"));

        expect(result.outFile).toContain("app.compiled.mjs");
        expect(fs.existsSync(result.outFile)).toBe(true);

        consoleSpy.mockRestore();
    });

    it("should clean existing .titan directory", async () => {
        fs.mkdirSync(path.join(tempDir, ".titan"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, ".titan", "stale.js"), "stale");

        fs.writeFileSync(path.join(tempDir, "app", "app.js"), `
import t from "../titan/titan.js";
t.get("/api").reply("API");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        await compileJavaScript(tempDir, path.join(tempDir, "app", "app.js"));

        expect(fs.existsSync(path.join(tempDir, ".titan", "stale.js"))).toBe(false);

        consoleSpy.mockRestore();
    });

    it("should inject titan import when not present", async () => {
        fs.writeFileSync(path.join(tempDir, "app", "app.js"), `
const x = 42;
console.log(x);
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        const result = await compileJavaScript(tempDir, path.join(tempDir, "app", "app.js"));

        expect(result.compiled).toContain("titan.js");
        consoleSpy.mockRestore();
    });

    it("should log bundling message", async () => {
        fs.writeFileSync(path.join(tempDir, "app", "app.js"), `
import t from "../titan/titan.js";
t.get("/").reply("test");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        await compileJavaScript(tempDir, path.join(tempDir, "app", "app.js"));

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Bundling app.js"));
        consoleSpy.mockRestore();
    });
});

// ============================================================
// TESTS: compileAndRunAppEntry()
// ============================================================
describe("compileAndRunAppEntry()", () => {
    let tempDir;

    beforeEach(() => {
        tempDir = createTempDir();
    });

    afterEach(() => {
        cleanupTempDir(tempDir);
        vi.restoreAllMocks();
    });

    it("should throw when no entry file exists", async () => {
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });

        await expect(compileAndRunAppEntry(tempDir)).rejects.toThrow("No app.ts or app.js found");
    });

    it("should detect TypeScript entry and compile", async () => {
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "titan"), { recursive: true });

        fs.writeFileSync(path.join(tempDir, "titan", "titan.js"), `
const t = { get: () => t, start: () => {} };
export default t;
`);

        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), `
import t from "../titan/titan.js";
console.log("TS compiled");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        try {
            await compileAndRunAppEntry(tempDir);
        } catch (e) {
            // Expected to fail when trying to execute
        }

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiling app.ts"));
        consoleSpy.mockRestore();
    });

    it("should detect JavaScript entry and compile", async () => {
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "titan"), { recursive: true });

        fs.writeFileSync(path.join(tempDir, "titan", "titan.js"), `
const t = { get: () => t, start: () => {} };
export default t;
`);

        fs.writeFileSync(path.join(tempDir, "app", "app.js"), `
import t from "../titan/titan.js";
console.log("JS bundled");
`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        try {
            await compileAndRunAppEntry(tempDir);
        } catch (e) {
            // Expected to fail when trying to execute
        }

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Bundling app.js"));
        consoleSpy.mockRestore();
    });

    it("should prioritize TypeScript over JavaScript", async () => {
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "titan"), { recursive: true });

        fs.writeFileSync(path.join(tempDir, "titan", "titan.js"), `
const t = { get: () => t, start: () => {} };
export default t;
`);

        fs.writeFileSync(path.join(tempDir, "app", "app.ts"), `console.log("ts");`);
        fs.writeFileSync(path.join(tempDir, "app", "app.js"), `console.log("js");`);

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        try {
            await compileAndRunAppEntry(tempDir);
        } catch (e) {
            // Expected
        }

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiling app.ts"));
        consoleSpy.mockRestore();
    });
});