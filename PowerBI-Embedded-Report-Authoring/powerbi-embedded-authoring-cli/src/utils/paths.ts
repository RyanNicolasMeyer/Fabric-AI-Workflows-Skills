import path from "node:path";
import { mkdir, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { RuntimePaths } from "../contracts/session.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function getRuntimePaths(repoRoot: string): RuntimePaths {
  const outputRoot = path.join(repoRoot, "output", "embedded-authoring");
  const runtimeRoot = path.join(outputRoot, "runtime");
  const helperAssetRoot = path.join(PACKAGE_ROOT, "assets", "helper-app");
  const runtimeHelperRoot = runtimeRoot;

  return {
    repoRoot,
    packageRoot: PACKAGE_ROOT,
    outputRoot,
    runtimeRoot,
    screenshotsRoot: path.join(outputRoot, "screenshots"),
    exportsRoot: path.join(outputRoot, "exports"),
    helperAssetRoot,
    runtimeHelperRoot,
    sessionConfigPath: path.join(runtimeRoot, "session-config.js")
  };
}

export async function ensureRuntimeLayout(paths: RuntimePaths): Promise<void> {
  await mkdir(paths.runtimeRoot, { recursive: true });
  await mkdir(paths.screenshotsRoot, { recursive: true });
  await mkdir(paths.exportsRoot, { recursive: true });
}

export async function syncHelperAssets(paths: RuntimePaths): Promise<void> {
  await ensureRuntimeLayout(paths);
  await cp(paths.helperAssetRoot, paths.runtimeHelperRoot, {
    recursive: true,
    force: true
  });
  await cp(
    path.join(paths.packageRoot, "node_modules", "powerbi-client", "dist", "powerbi.min.js"),
    path.join(paths.runtimeRoot, "vendor", "powerbi-client", "powerbi.min.js"),
    {
      force: true
    }
  );
  await cp(
    path.join(
      paths.packageRoot,
      "node_modules",
      "powerbi-report-authoring",
      "dist",
      "powerbi-report-authoring.js"
    ),
    path.join(
      paths.runtimeRoot,
      "vendor",
      "powerbi-report-authoring",
      "powerbi-report-authoring.js"
    ),
    {
      force: true
    }
  );
}
