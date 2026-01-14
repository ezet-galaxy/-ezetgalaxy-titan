import fs from "fs";
import path from "path";
import esbuild from "esbuild";

/** @constant {string} */
const BUNDLE_EXTENSION = ".jsbundle";

/**
 * Builds the directory paths for actions source and output.
 * @param {string} root - The root directory of the project.
 * @returns {{ actionsDir: string, outDir: string }} Object containing source and output directory paths.
 */
function buildPaths(root) {
    return {
        actionsDir: path.join(root, "app", "actions"),
        outDir: path.join(root, "server", "actions"),
    };
}

/**
 * Removes all existing bundle files from the output directory.
 * @param {string} outDir - The output directory to clean.
 * @returns {void}
 */
function cleanOldBundles(outDir) {
    if (!fs.existsSync(outDir)) {
        return;
    }

    const bundleFiles = fs
        .readdirSync(outDir)
        .filter((file) => file.endsWith(BUNDLE_EXTENSION));

    for (const file of bundleFiles) {
        fs.unlinkSync(path.join(outDir, file));
    }
}

/**
 * Retrieves all valid action files from the actions directory.
 * Filters for .js and .ts files, excluding TypeScript declaration files (.d.ts).
 * @param {string} actionsDir - The directory containing action files.
 * @returns {string[]} Array of action filenames.
 */
function getActionFiles(actionsDir) {
    const isActionFile = (filename) =>
        /\.(js|ts)$/.test(filename) && !filename.endsWith(".d.ts");

    return fs.readdirSync(actionsDir).filter(isActionFile);
}

/**
 * Creates the esbuild configuration for bundling an action file.
 * Configures the build to output an IIFE format with TypeScript support.
 * @param {string} entry - The entry file path.
 * @param {string} outfile - The output bundle file path.
 * @param {string} actionName - The name of the action being bundled.
 * @returns {import('esbuild').BuildOptions} The esbuild configuration object.
 */
function createEsbuildConfig(entry, outfile, actionName) {
    return {
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: "iife",
        globalName: "__titan_exports",
        platform: "neutral",
        target: "es2020",
        loader: {
            ".ts": "ts",
            ".js": "js",
        },
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true,
                useDefineForClassFields: true,
            },
        },
        banner: {
            js: "const defineAction = (fn) => fn;",
        },
        footer: {
            js: createFooterScript(actionName),
        },
    };
}

/**
 * Generates the footer script that exposes the action to the global scope.
 * The script extracts the named export or default export and assigns it to globalThis.
 * @param {string} actionName - The name of the action to expose globally.
 * @returns {string} The footer JavaScript code.
 */
function createFooterScript(actionName) {
    return `
(function () {
  const fn =
    __titan_exports["${actionName}"] ||
    __titan_exports.default;

  if (typeof fn !== "function") {
    throw new Error("[Titan] Action '${actionName}' not found or not a function");
  }

  globalThis["${actionName}"] = fn;
})();
`;
}

/**
 * Bundles a single action file using esbuild.
 * @param {string} file - The filename of the action to bundle.
 * @param {string} actionsDir - The source directory containing the action file.
 * @param {string} outDir - The output directory for the bundle.
 * @returns {Promise<void>}
 */
async function bundleActionFile(file, actionsDir, outDir) {
    const actionName = path.basename(file, path.extname(file));
    const entry = path.join(actionsDir, file);
    const outfile = path.join(outDir, actionName + BUNDLE_EXTENSION);

    console.log(`[Titan] Bundling ${file} → ${actionName}.jsbundle`);

    const config = createEsbuildConfig(entry, outfile, actionName);
    await esbuild.build(config);
}

/**
 * Bundles all action files (JavaScript and TypeScript) from the actions directory.
 *
 * This function performs the following steps:
 * 1. Creates the output directory if it doesn't exist
 * 2. Cleans any existing bundle files
 * 3. Discovers all .js and .ts action files (excluding .d.ts)
 * 4. Bundles each action into an IIFE format using esbuild
 *
 * Each bundle is output as a .jsbundle file that exposes the action
 * function to the global scope for runtime execution.
 *
 * @param {string} [root=process.cwd()] - The root directory of the project.
 * @returns {Promise<void>}
 * @example
 * // Bundle actions from current working directory
 * await bundle();
 *
 * @example
 * // Bundle actions from a specific project root
 * await bundle('/path/to/project');
 */
export async function bundle(root = process.cwd()) {
    const { actionsDir, outDir } = buildPaths(root);

    console.log("[Titan] Bundling actions...");

    fs.mkdirSync(outDir, { recursive: true });
    cleanOldBundles(outDir);

    if (!fs.existsSync(actionsDir)) {
        console.log("[Titan] No actions directory found.");
        return;
    }

    const files = getActionFiles(actionsDir);

    if (files.length === 0) {
        console.log("[Titan] No actions found to bundle.");
        return;
    }

    for (const file of files) {
        await bundleActionFile(file, actionsDir, outDir);
    }

    console.log("[Titan] Bundling finished.");
}