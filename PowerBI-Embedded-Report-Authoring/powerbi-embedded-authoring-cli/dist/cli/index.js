#!/usr/bin/env node
import path from "node:path";
import { DEFAULT_HOST, DEFAULT_PLAYWRIGHT_SESSION, DEFAULT_PORT } from "../contracts/session.js";
import { exportReportDefinition } from "../export/exportReport.js";
import { captureArtifacts, openPlaywrightPage, runBuildScriptInSession } from "../playwright/cli.js";
import { startStaticHost } from "../server/serve.js";
import { generateSessionConfig } from "../session/generateSession.js";
import { getRuntimePaths, syncHelperAssets } from "../utils/paths.js";
function parseArgs(argv) {
    const values = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (!current.startsWith("--")) {
            continue;
        }
        const next = argv[index + 1];
        if (!next || next.startsWith("--")) {
            values.set(current.slice(2), "true");
            continue;
        }
        values.set(current.slice(2), next);
        index += 1;
    }
    return values;
}
function required(args, key) {
    const value = args.get(key);
    if (!value) {
        throw new Error(`Missing required argument --${key}`);
    }
    return value;
}
function numberArg(args, key, defaultValue) {
    const value = args.get(key);
    return value ? Number(value) : defaultValue;
}
function printHelp() {
    console.log(`powerbi-embedded-authoring-cli

Usage:
  powerbi-embedded-authoring-cli <command> [options]

Commands:
  session         Generate session-config.js for a report authoring session
  host            Start the local helper host
  open-edit       Open the edit-mode helper in headed Playwright
  run-build       Run a report build script in the active Playwright session
  open-view       Open the view-mode helper in headed Playwright
  capture         Capture view-mode screenshots and snapshots
  export-report   Export the live Fabric report definition locally

Common options:
  --repo-root <path>      Target project root. Defaults to the current directory.
  --host <host>           Helper host. Defaults to 127.0.0.1.
  --port <port>           Helper port. Defaults to 8765.
  --session-name <name>   Playwright session name. Defaults to embedded-authoring.

Examples:
  powerbi-embedded-authoring-cli session --repo-root . --workspace-name "My Workspace" --report-name "My Report"
  powerbi-embedded-authoring-cli host --repo-root .
  powerbi-embedded-authoring-cli run-build --repo-root . --file ./examples/my-report.build.js
`);
}
async function run() {
    const [, , command, ...rest] = process.argv;
    const args = parseArgs(rest);
    if (!command || command === "--help" || command === "-h" || command === "help") {
        printHelp();
        return;
    }
    const repoRoot = args.get("repo-root") ? path.resolve(required(args, "repo-root")) : process.cwd();
    const paths = getRuntimePaths(repoRoot);
    const host = args.get("host") ?? DEFAULT_HOST;
    const port = numberArg(args, "port", DEFAULT_PORT);
    const sessionName = args.get("session-name") ?? DEFAULT_PLAYWRIGHT_SESSION;
    switch (command) {
        case "session": {
            const options = {
                workspaceName: required(args, "workspace-name"),
                reportName: required(args, "report-name"),
                semanticModelName: args.get("semantic-model-name"),
                host,
                port
            };
            const config = await generateSessionConfig(repoRoot, options);
            console.log(`Session config written to ${paths.sessionConfigPath}`);
            console.log(`Edit helper: ${config.editHelperUrl}`);
            console.log(`View helper: ${config.viewHelperUrl}`);
            return;
        }
        case "host": {
            await syncHelperAssets(paths);
            await startStaticHost(paths, host, port);
            return;
        }
        case "open-edit": {
            await openPlaywrightPage(`http://${host}:${port}/embed-authoring.html`, repoRoot, sessionName);
            return;
        }
        case "run-build": {
            const file = path.resolve(required(args, "file"));
            await runBuildScriptInSession(file, repoRoot, sessionName);
            return;
        }
        case "open-view": {
            await openPlaywrightPage(`http://${host}:${port}/embed-view.html`, repoRoot, sessionName);
            return;
        }
        case "capture": {
            await captureArtifacts(paths, sessionName);
            return;
        }
        case "export-report": {
            await exportReportDefinition(paths, required(args, "workspace-name"), required(args, "report-name"));
            return;
        }
        default:
            throw new Error("Unknown command. Use one of: session, host, open-edit, run-build, open-view, capture, export-report");
    }
}
run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
