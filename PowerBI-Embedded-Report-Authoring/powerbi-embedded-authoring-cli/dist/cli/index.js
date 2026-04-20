#!/usr/bin/env node
import path from "node:path";
import { DEFAULT_PLAYWRIGHT_SESSION, DEFAULT_HOST, DEFAULT_PORT } from "../contracts/session.js";
import { applyStyle } from "../export/applyStyle.js";
import { exportReportDefinition } from "../export/exportReport.js";
import { captureArtifacts, openEditPage, openViewPage, runBuildScriptInSession } from "../playwright/cli.js";
import { formatProbeReport, probeCapabilities } from "../playwright/probe.js";
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
  probe           Probe visual capabilities (data roles, formatting objects) in the
                  active session. Useful for discovering which setProperty calls
                  will actually land in this SDK build.
  export-report   Export the live Fabric report definition locally
  apply-style     Export the report, run a style transform against its PBIR, and
                  re-import it. Use this for formatting that setProperty cannot
                  reach (titles, backgrounds, dropdown slicer mode, etc.).

Common options:
  --repo-root <path>      Target project root. Defaults to the current directory.
  --host <host>           Helper host. Defaults to 127.0.0.1.
  --port <port>           Helper port. Defaults to 8765.
  --session-name <name>   Playwright session name. Defaults to embedded-authoring.

probe options:
  --visuals <list>        Comma-separated visual type names to probe. Defaults to
                          a built-in list of common types.
  --json                  Emit the raw probe JSON instead of the formatted report.

apply-style options:
  --workspace-name <name> Fabric workspace name. Required.
  --report-name <name>    Fabric report name. Required.
  --style-file <path>     Path to a .js/.mjs/.cjs module exporting a style function,
                          or a .json file with a visualPatches array. Required.
  --skip-export           Skip the initial 'fab export' (use an existing on-disk copy).
  --skip-import           Skip the final 'fab import' (leave patched PBIR on disk).

Examples:
  powerbi-embedded-authoring-cli session --repo-root . --workspace-name "My Workspace" --report-name "My Report"
  powerbi-embedded-authoring-cli host --repo-root .
  powerbi-embedded-authoring-cli run-build --repo-root . --file ./examples/my-report.build.js
  powerbi-embedded-authoring-cli probe --repo-root .
  powerbi-embedded-authoring-cli apply-style --repo-root . --workspace-name "My Workspace" \\
      --report-name "My Report" --style-file ./styles/executive.style.js
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
            await openEditPage(repoRoot, host, port, sessionName);
            return;
        }
        case "run-build": {
            const file = path.resolve(required(args, "file"));
            await runBuildScriptInSession(file, repoRoot, sessionName);
            return;
        }
        case "open-view": {
            await openViewPage(repoRoot, host, port, sessionName);
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
        case "probe": {
            const visualsArg = args.get("visuals");
            const types = visualsArg
                ? visualsArg
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0)
                : null;
            const report = await probeCapabilities(repoRoot, types, sessionName);
            if (args.get("json") === "true") {
                console.log(JSON.stringify(report, null, 2));
            }
            else {
                console.log(formatProbeReport(report));
            }
            return;
        }
        case "apply-style": {
            await applyStyle({
                paths,
                workspaceName: required(args, "workspace-name"),
                reportName: required(args, "report-name"),
                styleFilePath: required(args, "style-file"),
                skipExport: args.get("skip-export") === "true",
                skipImport: args.get("skip-import") === "true"
            });
            return;
        }
        default:
            throw new Error("Unknown command. Use one of: session, host, open-edit, run-build, open-view, capture, probe, export-report, apply-style");
    }
}
run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
