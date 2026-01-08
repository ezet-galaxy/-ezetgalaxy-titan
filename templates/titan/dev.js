import chokidar from "chokidar";
import { spawn, execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { bundle } from "./bundle.js";

// Required for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess = null;

async function killServer() {
    if (!serverProcess) return;

    const pid = serverProcess.pid;
    const killPromise = new Promise((resolve) => {
        if (serverProcess.exitCode !== null) return resolve();
        serverProcess.once("close", resolve);
    });

    if (process.platform === "win32") {
        try {
            execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
        } catch (e) {
            // Ignore errors if process is already dead
        }
    } else {
        serverProcess.kill();
    }

    try {
        await killPromise;
    } catch (e) { }
    serverProcess = null;
}

async function startRustServer() {
    await killServer();

    const serverPath = path.join(process.cwd(), "server");

    serverProcess = spawn("cargo", ["run"], {
        cwd: serverPath,
        stdio: "inherit",
        shell: true
    });

    serverProcess.on("close", (code) => {
        if (code !== null && code !== 0 && code !== 1) {
            // 1 is often just 'terminated' on windows if forced, but also error.
            // We just log it.
        }
        console.log(`[Titan] Rust server exited: ${code}`);
    });
}

async function rebuild() {
    console.log("[Titan] Regenerating routes.json & action_map.json...");
    execSync("node app/app.js", { stdio: "inherit" });

    console.log("[Titan] Bundling JS actions...");
    await bundle();
}

async function startDev() {
    console.log("[Titan] Dev mode starting...");

    if (fs.existsSync(path.join(process.cwd(), ".env"))) {
        console.log("\x1b[33m[Titan] Env Configured\x1b[0m");
    }

    // FIRST BUILD
    try {
        await rebuild();
        await startRustServer();
    } catch (e) {
        console.log("\x1b[31m[Titan] Initial build failed. Waiting for changes...\x1b[0m");
    }

    const watcher = chokidar.watch(["app", ".env"], {
        ignoreInitial: true
    });

    let timer = null;

    watcher.on("all", async (event, file) => {
        if (timer) clearTimeout(timer);

        timer = setTimeout(async () => {
            if (file.includes(".env")) {
                console.log("\x1b[33m[Titan] Env Refreshed\x1b[0m");
            } else {
                console.log(`[Titan] Change detected: ${file}`);
            }

            try {
                await rebuild();
                console.log("[Titan] Restarting Rust server...");
                await startRustServer();
            } catch (e) {
                console.log("\x1b[31m[Titan] Build failed -- waiting for changes...\x1b[0m");
            }

        }, 200);
    });
}

startDev();
