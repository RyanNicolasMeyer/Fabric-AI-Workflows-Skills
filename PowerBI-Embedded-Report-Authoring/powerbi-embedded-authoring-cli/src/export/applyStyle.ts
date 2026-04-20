import path from "node:path";
import { access, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { RuntimePaths } from "../contracts/session.js";
import { execCommand } from "../utils/exec.js";

export interface ApplyStyleOptions {
  paths: RuntimePaths;
  workspaceName: string;
  reportName: string;
  styleFilePath: string;
  skipExport?: boolean;
  skipImport?: boolean;
}

export interface StyleContext {
  reportRootDir: string;
  readJson: (relativePath: string) => Promise<unknown>;
  writeJson: (relativePath: string, value: unknown) => Promise<void>;
  listVisualFiles: () => Promise<string[]>;
  listPageFiles: () => Promise<string[]>;
}

export type StyleFunction = (context: StyleContext) => Promise<void> | void;

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function walk(dir: string, predicate: (file: string) => boolean): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(full, predicate)));
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

async function loadStyleFunction(styleFilePath: string): Promise<StyleFunction> {
  const resolved = path.resolve(styleFilePath);
  await access(resolved);
  const ext = path.extname(resolved).toLowerCase();
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    const imported = (await import(pathToFileURL(resolved).href)) as {
      default?: StyleFunction;
      applyStyle?: StyleFunction;
    };
    const fn = imported.default ?? imported.applyStyle;
    if (typeof fn !== "function") {
      throw new Error(
        `Style file '${resolved}' must export a default function or a named export 'applyStyle'.`
      );
    }
    return fn;
  }
  if (ext === ".json") {
    const raw = JSON.parse(await readFile(resolved, "utf8")) as {
      visualPatches?: Array<{
        pageDisplayName?: string;
        visualName?: string;
        visualType?: string;
        match?: { visualType?: string; titleText?: string };
        patch: Record<string, unknown>;
      }>;
    };
    return async (ctx: StyleContext) => {
      if (!raw.visualPatches || raw.visualPatches.length === 0) {
        return;
      }
      const files = await ctx.listVisualFiles();
      for (const absFile of files) {
        const rel = path.relative(ctx.reportRootDir, absFile);
        const visualJson = (await readJsonFile(absFile)) as Record<string, unknown>;
        for (const p of raw.visualPatches) {
          if (p.match?.visualType) {
            const currentType =
              typeof (visualJson as { visual?: { visualType?: string } }).visual?.visualType ===
              "string"
                ? (visualJson as { visual?: { visualType?: string } }).visual!.visualType
                : undefined;
            if (currentType !== p.match.visualType) {
              continue;
            }
          }
          mergeDeep(visualJson, p.patch);
        }
        await writeJsonFile(absFile, visualJson);
        void rel;
      }
    };
  }
  throw new Error(`Unsupported style file extension '${ext}'. Use .js, .mjs, .cjs, or .json.`);
}

function mergeDeep(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      mergeDeep(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export async function applyStyle(options: ApplyStyleOptions): Promise<void> {
  const { paths, workspaceName, reportName, styleFilePath, skipExport, skipImport } = options;
  const reportRootDir = path.join(paths.exportsRoot, `${reportName}.Report`);

  if (!skipExport) {
    const itemPath = `${workspaceName}.Workspace/${reportName}.Report`;
    console.log(`Exporting ${itemPath} to ${paths.exportsRoot}...`);
    await execCommand("fab", ["export", itemPath, "-o", paths.exportsRoot, "-f"], {
      cwd: paths.repoRoot,
      stdio: "inherit"
    });
  }

  if (!existsSync(reportRootDir)) {
    throw new Error(
      `Expected exported report at '${reportRootDir}' but it does not exist. ` +
        `Run without --skip-export, or check that the workspace/report names are correct.`
    );
  }

  const styleFn = await loadStyleFunction(styleFilePath);
  const context: StyleContext = {
    reportRootDir,
    readJson: async (relativePath: string) =>
      readJsonFile(path.join(reportRootDir, relativePath)),
    writeJson: async (relativePath: string, value: unknown) =>
      writeJsonFile(path.join(reportRootDir, relativePath), value),
    listVisualFiles: async () => {
      return await walk(reportRootDir, (file) => {
        const lower = file.toLowerCase();
        return (
          lower.endsWith("visual.json") ||
          lower.includes(`${path.sep}visuals${path.sep}`) ||
          (lower.endsWith(".json") && path.basename(file).toLowerCase().startsWith("visual"))
        );
      });
    },
    listPageFiles: async () => {
      return await walk(reportRootDir, (file) => {
        const lower = file.toLowerCase();
        return lower.endsWith("page.json");
      });
    }
  };

  console.log(`Applying style transform from ${path.resolve(styleFilePath)}...`);
  await styleFn(context);

  if (skipImport) {
    console.log(
      `Style applied to ${reportRootDir}. Skipping import (--skip-import). ` +
        `Use 'fab import' manually, or re-run without --skip-import to push changes back.`
    );
    return;
  }

  const itemPath = `${workspaceName}.Workspace/${reportName}.Report`;
  console.log(`Importing patched definition back to ${itemPath}...`);
  try {
    await execCommand(
      "fab",
      ["import", itemPath, "-i", reportRootDir, "-f"],
      { cwd: paths.repoRoot, stdio: "inherit" }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `'fab import' failed. The patched PBIR remains on disk at ${reportRootDir}. ` +
        `Underlying error: ${message}`
    );
  }
  console.log("apply-style complete.");
}
