import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { DEFAULT_PLAYWRIGHT_SESSION } from "../contracts/session.js";
import { execCommand } from "../utils/exec.js";
async function runPlaywright(args, cwd) {
    await execCommand("npx", ["playwright-cli", ...args], {
        cwd,
        stdio: "inherit"
    });
}
async function loadBuildScript(filePath) {
    const source = await readFile(filePath, "utf8");
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".ts") {
        return ts.transpileModule(source, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.None
            }
        }).outputText;
    }
    return source;
}
async function loadRuntimeSessionConfig(cwd) {
    const sessionConfigPath = path.join(cwd, "output", "embedded-authoring", "runtime", "session-config.js");
    const source = await readFile(sessionConfigPath, "utf8");
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox);
    const config = sandbox.window.REPORT_AUTHORING_SESSION;
    if (!config) {
        throw new Error(`Unable to load REPORT_AUTHORING_SESSION from ${sessionConfigPath}`);
    }
    return config;
}
export async function openPlaywrightPage(url, cwd, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    await runPlaywright(["-s", sessionName, "open", url, "--headed"], cwd);
}
export async function runBuildScriptInSession(filePath, cwd, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    const source = await loadBuildScript(filePath);
    const config = await loadRuntimeSessionConfig(cwd);
    const tempDirectory = path.join(cwd, "output", "embedded-authoring", "runtime", ".build-cache");
    await mkdir(tempDirectory, { recursive: true });
    const tempFile = path.join(tempDirectory, "run-build.js");
    const wrappedSource = `async page => {
  await page.goto(${JSON.stringify(config.editHelperUrl)});
  await page.waitForFunction(() => {
    return Boolean(window.reportAuthoring && window.reportAuthoring.report);
  }, { timeout: 60000 });
  const build = ${source};
  return await build(page);
}\n`;
    await writeFile(tempFile, wrappedSource, "utf8");
    await runPlaywright(["-s", sessionName, "run-code", `--filename=${tempFile}`], cwd);
}
export async function captureArtifacts(paths, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    const config = await loadRuntimeSessionConfig(paths.repoRoot);
    const tempDirectory = path.join(paths.repoRoot, "output", "embedded-authoring", "runtime", ".build-cache");
    await mkdir(tempDirectory, { recursive: true });
    const waitFile = path.join(tempDirectory, "wait-for-preview.js");
    await writeFile(waitFile, `async page => {
  await page.waitForFunction(() => {
    return Boolean(window.reportPreview && window.reportPreview.status && window.reportPreview.status.rendered);
  }, { timeout: 60000 });
}\n`, "utf8");
    await openPlaywrightPage(config.viewHelperUrl, paths.repoRoot, sessionName);
    await runPlaywright(["-s", sessionName, "run-code", `--filename=${waitFile}`], paths.repoRoot);
    await runPlaywright(["-s", sessionName, "snapshot"], paths.screenshotsRoot);
    await runPlaywright(["-s", sessionName, "screenshot"], paths.screenshotsRoot);
}
