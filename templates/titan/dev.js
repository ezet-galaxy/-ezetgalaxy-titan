import chokidar from "chokidar";
import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { bundle } from "./bundle.js";

// ============================================================
// Estado global del servidor
// ============================================================
let serverProcess = null;
let isKilling = false;

// ============================================================
// Constantes de configuración
// ============================================================
const RETRY_WAIT_TIME = 2000;
const STANDARD_WAIT_TIME = 1000;
const KILL_TIMEOUT = 3000;
const CRASH_DETECTION_WINDOW = 10000;
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 500;

// ============================================================
// Detección de entrada de aplicación
// ============================================================

/**
 * Detect if project uses TypeScript or JavaScript
 * @param {string} root - Project root directory
 * @returns {{ path: string, isTS: boolean } | null}
 */
export function getAppEntry(root = process.cwd()) {
    const tsEntry = path.join(root, "app", "app.ts");
    const jsEntry = path.join(root, "app", "app.js");

    if (fs.existsSync(tsEntry)) {
        return { path: tsEntry, isTS: true };
    }

    if (fs.existsSync(jsEntry)) {
        return { path: jsEntry, isTS: false };
    }

    return null;
}

// ============================================================
// Compilación de TypeScript
// ============================================================

/**
 * Create esbuild plugin to handle titan.js imports
 * @param {string} titanJsAbsolutePath - Absolute path to titan.js
 * @returns {object} esbuild plugin
 */
function createTitanExternalPlugin(titanJsAbsolutePath) {
    return {
        name: "titan-external",
        setup(build) {
            build.onResolve({ filter: /titan\/titan\.js$/ }, () => ({
                path: titanJsAbsolutePath,
                external: true,
            }));
        },
    };
}

/**
 * Get esbuild configuration
 * @param {string} entryPath - Entry file path
 * @param {string} outFile - Output file path
 * @param {object} titanPlugin - Titan external plugin
 * @returns {object} esbuild build options
 */
function getEsbuildConfig(entryPath, outFile, titanPlugin) {
    return {
        entryPoints: [entryPath],
        outfile: outFile,
        format: "esm",
        platform: "node",
        target: "node18",
        bundle: true,
        plugins: [titanPlugin],
        loader: { ".ts": "ts" },
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true,
                useDefineForClassFields: true,
            },
        },
    };
}

/**
 * Find the first non-comment line index in code
 * @param {string[]} lines - Array of code lines
 * @returns {number} Index of first non-comment line
 */
function findFirstCodeLineIndex(lines) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith("//")) {
            return i;
        }
    }
    return 0;
}

/**
 * Inject titan.js import into compiled code if missing
 * @param {string} compiled - Compiled code
 * @param {string} titanJsAbsolutePath - Path to titan.js
 * @param {string} outFile - Output file path
 * @returns {string} Modified compiled code
 */
function injectTitanImportIfMissing(compiled, titanJsAbsolutePath, outFile) {
    if (compiled.includes("titan.js")) {
        return compiled;
    }

    console.log("[Titan] Auto-injecting titan.js import (global t usage detected)...");

    const lines = compiled.split("\n");
    const insertIndex = findFirstCodeLineIndex(lines);
    const importStatement = `import t from "${titanJsAbsolutePath}";`;

    lines.splice(insertIndex, 0, importStatement);
    const modifiedCode = lines.join("\n");

    fs.writeFileSync(outFile, modifiedCode);

    return modifiedCode;
}

/**
 * Log preview of compiled output
 * @param {string} compiled - Compiled code
 */
function logCompiledPreview(compiled) {
    console.log("[Titan] Compiled output preview:");
    const lines = compiled.split("\n").slice(0, 5);
    lines.forEach((line, i) => console.log(`  ${i + 1}: ${line}`));
}

/**
 * Verify that import statement exists in compiled output
 * @param {string} compiled - Compiled code
 */
function verifyImportExists(compiled) {
    if (!compiled.includes("import") || !compiled.includes("titan.js")) {
        console.error("[Titan] WARNING: Import statement may be missing from compiled output!");
        console.error("[Titan] First 200 chars:", compiled.substring(0, 200));
    }
}

/**
 * Compile TypeScript entry file
 * @param {string} root - Project root
 * @param {string} entryPath - Entry file path
 * @param {boolean} skipExec - Whether to skip execution
 * @returns {Promise<{ outFile: string, compiled: string }>}
 */
async function compileTypeScript(root, entryPath, skipExec) {
    console.log("[Titan] Compiling app.ts with esbuild...");

    const esbuild = await import("esbuild");
    const titanDir = path.join(root, ".titan");
    const outFile = path.join(titanDir, "app.compiled.mjs");

    // Clean and recreate .titan directory to avoid cache issues
    if (fs.existsSync(titanDir)) {
        fs.rmSync(titanDir, { recursive: true, force: true });
    }
    fs.mkdirSync(titanDir, { recursive: true });

    // Calculate the absolute path to titan.js
    const titanJsAbsolutePath = path.join(root, "titan", "titan.js").replace(/\\/g, "/");

    // Compile TS to JS
    const titanPlugin = createTitanExternalPlugin(titanJsAbsolutePath);
    const buildConfig = getEsbuildConfig(entryPath, outFile, titanPlugin);
    await esbuild.build(buildConfig);

    // Read and process compiled output
    let compiled = fs.readFileSync(outFile, "utf8");
    compiled = injectTitanImportIfMissing(compiled, titanJsAbsolutePath, outFile);

    // Debug output
    logCompiledPreview(compiled);
    verifyImportExists(compiled);

    // Execute if not skipped
    if (!skipExec) {
        execSync(`node "${outFile}"`, { stdio: "inherit", cwd: root });
    }

    return { outFile, compiled };
}

/**
 * Process JavaScript entry file through esbuild (same as TypeScript)
 * @param {string} root - Project root
 * @param {string} entryPath - Entry file path
 * @param {boolean} skipExec - Whether to skip execution
 * @returns {Promise<{ outFile: string, compiled: string }>}
 */
async function processJavaScript(root, entryPath, skipExec) {
    console.log("[Titan] Bundling app.js with esbuild...");

    const esbuild = await import("esbuild");
    const titanDir = path.join(root, ".titan");
    const outFile = path.join(titanDir, "app.compiled.mjs");

    // Clean and recreate .titan directory to avoid cache issues
    if (fs.existsSync(titanDir)) {
        fs.rmSync(titanDir, { recursive: true, force: true });
    }
    fs.mkdirSync(titanDir, { recursive: true });

    // Calculate the absolute path to titan.js
    const titanJsAbsolutePath = path.join(root, "titan", "titan.js").replace(/\\/g, "/");

    // Bundle JS with esbuild
    const titanPlugin = createTitanExternalPlugin(titanJsAbsolutePath);

    await esbuild.build({
        entryPoints: [entryPath],
        outfile: outFile,
        format: "esm",
        platform: "node",
        target: "node18",
        bundle: true,
        plugins: [titanPlugin],
    });

    // Read and process compiled output
    let compiled = fs.readFileSync(outFile, "utf8");
    compiled = injectTitanImportIfMissing(compiled, titanJsAbsolutePath, outFile);

    // Debug output
    logCompiledPreview(compiled);
    verifyImportExists(compiled);

    // Execute if not skipped
    if (!skipExec) {
        execSync(`node "${outFile}"`, { stdio: "inherit", cwd: root });
    }

    return { outFile, compiled };
}

/**
 * Compile TypeScript app.ts to JavaScript using esbuild
 * @param {string} root - Project root directory
 * @param {object} options - Compilation options
 * @param {boolean} options.skipExec - Skip execution after compilation
 * @returns {Promise<{ outFile: string, compiled: string | null }>}
 */
export async function compileAndRunAppEntry(root = process.cwd(), options = { skipExec: false }) {
    const { skipExec = false } = options;
    const entry = getAppEntry(root);

    if (!entry) {
        throw new Error("[Titan] No app.ts or app.js found in app/");
    }

    if (entry.isTS) {
        return compileTypeScript(root, entry.path, skipExec);
    }

    return processJavaScript(root, entry.path, skipExec);
}

// ============================================================
// Gestión del servidor
// ============================================================

/**
 * Kill server process on Windows using taskkill
 * @param {number} pid - Process ID
 */
function killWindowsProcess(pid) {
    try {
        execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
    } catch (e) {
        // Ignore errors if process is already dead
    }
}

/**
 * Kill server process on Unix systems
 * @param {number} pid - Process ID
 * @param {object} serverProc - Server process object
 */
function killUnixProcess(pid, serverProc) {
    try {
        process.kill(-pid, 'SIGKILL');
    } catch (e) {
        // Fallback to regular kill
        try {
            serverProc.kill('SIGKILL');
        } catch (e2) { }
    }
}

/**
 * Wait for process to close with timeout
 * @param {Promise} killPromise - Promise that resolves when process closes
 */
async function waitForProcessClose(killPromise) {
    try {
        await Promise.race([
            killPromise,
            new Promise(r => setTimeout(r, KILL_TIMEOUT))
        ]);
    } catch (e) { }
}

/**
 * Kill the running server process
 * @returns {Promise<void>}
 */
export async function killServer() {
    if (!serverProcess) {
        return;
    }

    isKilling = true;
    const pid = serverProcess.pid;

    const killPromise = new Promise((resolve) => {
        if (serverProcess.exitCode !== null) {
            return resolve();
        }
        serverProcess.once("close", resolve);
    });

    if (process.platform === "win32") {
        killWindowsProcess(pid);
    } else {
        killUnixProcess(pid, serverProcess);
    }

    await waitForProcessClose(killPromise);

    serverProcess = null;
    isKilling = false;
}

/**
 * Handle server process close event
 * @param {number} code - Exit code
 * @param {number} startTime - Server start timestamp
 * @param {number} retryCount - Current retry count
 * @param {string} root - Project root
 */
async function handleServerClose(code, startTime, retryCount, root) {
    if (isKilling) {
        return;
    }

    console.log(`[Titan] Rust server exited: ${code}`);

    const runTime = Date.now() - startTime;
    const shouldRetry = code !== 0 &&
        code !== null &&
        runTime < CRASH_DETECTION_WINDOW &&
        retryCount < MAX_RETRY_ATTEMPTS;

    if (shouldRetry) {
        console.log(`\x1b[31m[Titan] Server crash detected (possibly file lock). Retrying automatically...\x1b[0m`);
        await startRustServer(retryCount + 1, root);
    }
}

/**
 * Get spawn options for cargo process
 * @param {string} serverPath - Path to server directory
 * @returns {object} Spawn options
 */
function getCargoSpawnOptions(serverPath) {
    return {
        cwd: serverPath,
        stdio: "inherit",
        shell: true,
        detached: true,
        env: { ...process.env, CARGO_INCREMENTAL: "0" }
    };
}

/**
 * Start the Rust server
 * @param {number} retryCount - Number of retry attempts
 * @param {string} root - Project root directory
 * @returns {Promise<object>} Spawned process
 */
export async function startRustServer(retryCount = 0, root = process.cwd()) {
    const waitTime = retryCount > 0 ? RETRY_WAIT_TIME : STANDARD_WAIT_TIME;

    // Ensure any previous instance is killed
    await killServer();

    // Give the OS a moment to release file locks on the binary
    await new Promise(r => setTimeout(r, waitTime));

    const serverPath = path.join(root, "server");
    const startTime = Date.now();

    if (retryCount > 0) {
        console.log(`\x1b[33m[Titan] Retrying Rust server (Attempt ${retryCount})...\x1b[0m`);
    }

    // Windows often has file locking issues during concurrent linking/metadata generation
    const spawnOptions = getCargoSpawnOptions(serverPath);
    serverProcess = spawn("cargo", ["run", "--jobs", "1"], spawnOptions);

    serverProcess.on("close", (code) => handleServerClose(code, startTime, retryCount, root));

    return serverProcess;
}

// ============================================================
// Build y recarga
// ============================================================

/**
 * Rebuild the project (compile and bundle)
 * @param {string} root - Project root directory
 * @returns {Promise<void>}
 */
export async function rebuild(root = process.cwd()) {
    console.log("[Titan] Regenerating routes.json & action_map.json...");
    await compileAndRunAppEntry(root);

    console.log("[Titan] Bundling JS actions...");
    await bundle(root);
}

// ============================================================
// Modo desarrollo
// ============================================================

/**
 * Log project detection info
 * @param {object} entry - App entry info
 */
function logProjectDetection(entry) {
    if (entry) {
        const projectType = entry.isTS ? "TypeScript" : "JavaScript";
        console.log(`[Titan] Detected ${projectType} project`);
    }
}

/**
 * Log environment configuration status
 * @param {string} root - Project root
 */
function logEnvStatus(root) {
    if (fs.existsSync(path.join(root, ".env"))) {
        console.log("\x1b[33m[Titan] Env Configured\x1b[0m");
    }
}

/**
 * Perform initial build
 * @param {string} root - Project root
 */
async function performInitialBuild(root) {
    try {
        await rebuild(root);
        await startRustServer(0, root);
    } catch (e) {
        console.log("\x1b[31m[Titan] Initial build failed. Waiting for changes...\x1b[0m");
        console.error(e.message);
    }
}

/**
 * Handle file change event
 * @param {string} file - Changed file path
 * @param {string} root - Project root
 */
async function handleFileChange(file, root) {
    if (file.includes(".env")) {
        console.log("\x1b[33m[Titan] Env Refreshed\x1b[0m");
    } else {
        console.log(`[Titan] Change detected: ${file}`);
    }

    try {
        await rebuild(root);
        console.log("[Titan] Restarting Rust server...");
        await startRustServer(0, root);
    } catch (e) {
        console.log("\x1b[31m[Titan] Build failed -- waiting for changes...\x1b[0m");
        console.error(e.message);
    }
}

/**
 * Create file watcher with debounced change handler
 * @param {string} root - Project root
 * @returns {object} Chokidar watcher instance
 */
function createFileWatcher(root) {
    const watcher = chokidar.watch(["app", ".env"], {
        ignoreInitial: true,
    });

    let timer = null;

    watcher.on("all", async (event, file) => {
        if (timer) {
            clearTimeout(timer);
        }

        timer = setTimeout(() => handleFileChange(file, root), DEBOUNCE_DELAY);
    });

    return watcher;
}

/**
 * Start development server with hot reload
 * @returns {Promise<object>} Chokidar watcher instance
 */
export async function startDev() {
    console.log("[Titan] Dev mode starting...");

    const root = process.cwd();
    const entry = getAppEntry(root);

    logProjectDetection(entry);
    logEnvStatus(root);

    await performInitialBuild(root);

    return createFileWatcher(root);
}

// ============================================================
// Manejo de señales de salida
// ============================================================

/**
 * Handle graceful exit on SIGINT/SIGTERM
 */
async function handleExit() {
    console.log("\n[Titan] Stopping server...");
    await killServer();
    process.exit(0);
}

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);

// ============================================================
// Auto-inicio en modo desarrollo
// ============================================================

const isMainModule = process.argv[1]?.endsWith('dev.js');
if (isMainModule && !process.env.VITEST) {
    startDev();
}

// ============================================================
// Exports para testing
// ============================================================

export { serverProcess, isKilling };