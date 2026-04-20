import { openSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { DEFAULT_PLAYWRIGHT_SESSION } from "../contracts/session.js";
import { loadBuildScriptSource } from "./build.js";
import { deleteBrowserSessionState, readBrowserSessionState, sessionLogPath } from "./session.js";
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
async function readLogTail(logPath) {
    try {
        const content = await readFile(logPath, "utf8");
        return content.trim();
    }
    catch {
        return "";
    }
}
async function killSessionProcess(state) {
    try {
        process.kill(state.pid, "SIGTERM");
    }
    catch {
        return;
    }
}
async function sendCommand(state, action, args = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
        const response = await fetch(`http://127.0.0.1:${state.port}/command`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({
                token: state.token,
                action,
                args
            }),
            signal: controller.signal
        });
        const body = (await response.json());
        if (!response.ok || !body.ok) {
            throw new Error(body.error ?? `Command '${action}' failed.`);
        }
        return body.result;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function sessionIsHealthy(state) {
    try {
        await sendCommand(state, "health");
        return true;
    }
    catch {
        return false;
    }
}
async function startDaemon(paths, sessionName) {
    await mkdir(path.join(paths.runtimeRoot, "sessions"), { recursive: true });
    const daemonPath = path.join(paths.packageRoot, "dist", "playwright", "daemon.js");
    const logPath = sessionLogPath(paths, sessionName);
    const errFd = openSync(logPath, "a");
    const child = spawn(process.execPath, [daemonPath, "--repo-root", paths.repoRoot, "--session-name", sessionName], {
        cwd: paths.repoRoot,
        detached: true,
        stdio: ["ignore", "pipe", errFd]
    });
    return await new Promise((resolve, reject) => {
        let stdout = "";
        let settled = false;
        const finish = async (state) => {
            settled = true;
            child.stdout?.destroy();
            child.unref();
            resolve(state);
        };
        child.on("error", reject);
        child.on("close", async (code) => {
            if (settled) {
                return;
            }
            const details = await readLogTail(logPath);
            reject(new Error(`Browser session daemon exited with code ${code ?? 0}.${details ? `\n${details}` : ""}`));
        });
        child.stdout?.on("data", async (chunk) => {
            stdout += chunk.toString();
            const line = stdout.split(/\r?\n/).find((candidate) => candidate.startsWith("READY "));
            if (!line || settled) {
                return;
            }
            const state = JSON.parse(line.slice("READY ".length));
            await finish(state);
        });
    });
}
async function ensureSession(paths, sessionName) {
    const existing = await readBrowserSessionState(paths, sessionName);
    if (existing && (await sessionIsHealthy(existing))) {
        return existing;
    }
    if (existing) {
        await killSessionProcess(existing);
        await deleteBrowserSessionState(paths, sessionName);
    }
    return await startDaemon(paths, sessionName);
}
async function openPageForMode(url, cwd, mode, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    const runtimePaths = (await import("../utils/paths.js")).getRuntimePaths(cwd);
    const state = await ensureSession(runtimePaths, sessionName);
    await sendCommand(state, "open", { url, mode });
}
function isTokenExpirationError(message) {
    const lowered = message.toLowerCase();
    return (lowered.includes("powerbinotauthorizedexception") ||
        lowered.includes("tokenexpired") ||
        lowered.includes("lsr:401") ||
        lowered.includes("401 (unauthorized)") ||
        lowered.includes("accesstokenexpired"));
}
function isCapacityInactiveError(message) {
    return message.toLowerCase().includes("capacitynotactive");
}
export async function runBuildScriptInSession(filePath, cwd, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    await loadBuildScriptSource(filePath);
    const config = await loadRuntimeSessionConfig(cwd);
    const paths = (await import("../utils/paths.js")).getRuntimePaths(cwd);
    const state = await ensureSession(paths, sessionName);
    let result;
    try {
        result = await sendCommand(state, "run-build", {
            filePath,
            editHelperUrl: config.editHelperUrl
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isTokenExpirationError(message)) {
            throw new Error(`Run-build failed: the Power BI access token has expired.\n` +
                `Regenerate the session: powerbi-embedded-authoring-cli session --repo-root ${cwd} ` +
                `--workspace-name "<workspace>" --report-name "<report>"\n\n` +
                `Underlying error: ${message}`);
        }
        if (isCapacityInactiveError(message)) {
            throw new Error(`Run-build failed: the Fabric capacity is paused (CapacityNotActive). ` +
                `Start the capacity in Fabric and retry. If the token was minted before the pause, ` +
                `re-run the session command after resuming.\n\nUnderlying error: ${message}`);
        }
        throw error;
    }
    const summary = result.summary;
    const parts = [];
    parts.push(`visuals=${summary?.visualsCreated ?? "?"}`);
    parts.push(`warnings=${summary?.propertyWarningsTotal ?? 0}`);
    parts.push(`embedErrors=${result.embedErrors.length}`);
    parts.push(`saved=${summary?.lastSaveAt ?? "no"}`);
    parts.push(`duration=${result.durationMs}ms`);
    console.log(`run-build OK: ${parts.join(" ")}`);
    if (summary && summary.propertyWarnings.length > 0) {
        const top = summary.propertyWarnings
            .slice()
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((w) => `${w.selector}×${w.count}`)
            .join(", ");
        console.log(`  top unsupported setProperty selectors: ${top}`);
        console.log(`  (many formatting properties are unreachable via setProperty in this SDK. ` +
            `Use 'apply-style' to patch PBIR post-authoring.)`);
    }
    if (result.embedErrors.length > 0) {
        console.warn(`  embed surfaced ${result.embedErrors.length} error(s); check the session log.`);
    }
}
export async function captureArtifacts(paths, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    const config = await loadRuntimeSessionConfig(paths.repoRoot);
    const state = await ensureSession(paths, sessionName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = path.join(paths.screenshotsRoot, `capture-${timestamp}.png`);
    const snapshotPath = path.join(paths.screenshotsRoot, `capture-${timestamp}.json`);
    await sendCommand(state, "capture", {
        viewHelperUrl: config.viewHelperUrl,
        screenshotPath,
        snapshotPath
    });
}
export async function openEditPage(cwd, host, port, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    await openPageForMode(`http://${host}:${port}/embed-authoring.html`, cwd, "edit", sessionName);
}
export async function openViewPage(cwd, host, port, sessionName = DEFAULT_PLAYWRIGHT_SESSION) {
    await openPageForMode(`http://${host}:${port}/embed-view.html`, cwd, "view", sessionName);
}
