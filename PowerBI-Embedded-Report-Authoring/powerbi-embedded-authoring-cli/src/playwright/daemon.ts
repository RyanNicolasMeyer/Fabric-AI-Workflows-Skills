import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import path from "node:path";
import playwright from "playwright";
import { DEFAULT_PLAYWRIGHT_SESSION } from "../contracts/session.js";
import { getRuntimePaths } from "../utils/paths.js";
import { loadBuildScriptSource } from "./build.js";
import {
  BrowserSessionState,
  deleteBrowserSessionState,
  sessionLogPath,
  writeBrowserSessionState
} from "./session.js";

const { chromium } = playwright;

type SessionMode = "edit" | "view";

interface CommandEnvelope {
  token: string;
  action: "health" | "open" | "run-build" | "capture" | "eval" | "shutdown";
  args?: Record<string, unknown>;
}

interface OpenArgs {
  url: string;
  mode: SessionMode;
}

interface RunBuildArgs {
  filePath: string;
  editHelperUrl: string;
}

interface CaptureArgs {
  viewHelperUrl: string;
  screenshotPath: string;
  snapshotPath: string;
}

function parseArgs(argv: string[]): Map<string, string> {
  const values = new Map<string, string>();

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

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

async function readJson(request: IncomingMessage): Promise<CommandEnvelope> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as CommandEnvelope;
}

function reply(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function waitForHelperReady(page: playwright.Page, mode: SessionMode): Promise<void> {
  await page.waitForFunction(
    (activeMode) => {
      const globalWindow = window as typeof window & {
        reportAuthoring?: {
          status?: { rendered?: boolean };
          errors?: unknown[];
        };
        reportPreview?: {
          status?: { rendered?: boolean };
          errors?: unknown[];
        };
      };
      const api =
        activeMode === "edit" ? globalWindow.reportAuthoring : globalWindow.reportPreview;

      if (!api) {
        return false;
      }

      return Boolean(
        (api.status && api.status.rendered) || (Array.isArray(api.errors) && api.errors.length > 0)
      );
    },
    mode,
    { timeout: 120000 }
  );

  const helperState = await page.evaluate((activeMode) => {
    const globalWindow = window as typeof window & {
      reportAuthoring?: {
        status?: { rendered?: boolean };
        errors?: unknown[];
      };
      reportPreview?: {
        status?: { rendered?: boolean };
        errors?: unknown[];
      };
    };
    const api =
      activeMode === "edit" ? globalWindow.reportAuthoring : globalWindow.reportPreview;

    return {
      rendered: Boolean(api && api.status && api.status.rendered),
      errors: Array.isArray(api?.errors) ? api?.errors : [],
      statusLine: document.querySelector("#statusLine")?.textContent ?? null
    };
  }, mode);

  if (!helperState.rendered) {
    const detail =
      helperState.errors.length > 0
        ? JSON.stringify(helperState.errors[helperState.errors.length - 1])
        : helperState.statusLine ?? `The ${mode} helper did not render successfully.`;
    throw new Error(detail);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(required(args, "repo-root"));
  const sessionName = args.get("session-name") ?? DEFAULT_PLAYWRIGHT_SESSION;
  const paths = getRuntimePaths(repoRoot);
  const token = randomBytes(24).toString("hex");
  const logPath = sessionLogPath(paths, sessionName);

  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, "", "utf8");

  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext({
    viewport: null
  });
  const page = await context.newPage();

  const log = async (message: string): Promise<void> => {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    await appendFile(logPath, line, "utf8").catch(() => {});
  };

  page.on("console", (entry) => {
    void log(`[console:${entry.type()}] ${entry.text()}`);
  });
  page.on("pageerror", (error) => {
    void log(`[pageerror] ${error.message}`);
  });

  let shuttingDown = false;

  const cleanup = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await deleteBrowserSessionState(paths, sessionName);
    await browser.close().catch(() => {});
    server.close();
  };

  browser.on("disconnected", () => {
    void cleanup().finally(() => {
      process.exit(0);
    });
  });

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      reply(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST" || request.url !== "/command") {
      reply(response, 404, { ok: false, error: "Not found" });
      return;
    }

    try {
      const payload = await readJson(request);
      if (payload.token !== token) {
        reply(response, 403, { ok: false, error: "Invalid session token" });
        return;
      }

      const ensureVisiblePage = async (): Promise<playwright.Page> => {
        if (page.isClosed()) {
          throw new Error("The managed Playwright page is closed.");
        }
        await page.bringToFront();
        return page;
      };

      if (payload.action === "health") {
        reply(response, 200, {
          ok: true,
          result: {
            url: page.isClosed() ? null : page.url()
          }
        });
        return;
      }

      if (payload.action === "shutdown") {
        reply(response, 200, { ok: true, result: "shutting-down" });
        await cleanup();
        process.exit(0);
      }

      if (payload.action === "open") {
        const { url, mode } = payload.args as unknown as OpenArgs;
        const managedPage = await ensureVisiblePage();
        await managedPage.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000
        });
        await waitForHelperReady(managedPage, mode);
        reply(response, 200, {
          ok: true,
          result: {
            url: managedPage.url(),
            mode
          }
        });
        return;
      }

      if (payload.action === "run-build") {
        const { filePath, editHelperUrl } = payload.args as unknown as RunBuildArgs;
        const managedPage = await ensureVisiblePage();
        await managedPage.goto(editHelperUrl, {
          waitUntil: "domcontentloaded",
          timeout: 120000
        });
        await waitForHelperReady(managedPage, "edit");
        const source = await loadBuildScriptSource(filePath);
        const build = (0, eval)(`(${source})`) as (page: playwright.Page) => Promise<unknown>;
        if (typeof build !== "function") {
          throw new Error("Build script did not evaluate to a function.");
        }
        await managedPage.evaluate(() => {
          const globalWindow = window as typeof window & {
            reportAuthoring?: { startBuild?: () => void };
          };
          if (globalWindow.reportAuthoring && typeof globalWindow.reportAuthoring.startBuild === "function") {
            globalWindow.reportAuthoring.startBuild();
          }
        });
        const startedAt = Date.now();
        await build(managedPage);
        const summary = await managedPage.evaluate(() => {
          const globalWindow = window as typeof window & {
            reportAuthoring?: {
              finishBuild?: () => void;
              buildSummary?: () => unknown;
              errors?: unknown[];
            };
          };
          const api = globalWindow.reportAuthoring;
          if (api && typeof api.finishBuild === "function") {
            api.finishBuild();
          }
          const summary =
            api && typeof api.buildSummary === "function" ? api.buildSummary() : null;
          const embedErrors = Array.isArray(api?.errors) ? api?.errors : [];
          return { summary, embedErrors };
        });
        reply(response, 200, {
          ok: true,
          result: {
            url: managedPage.url(),
            durationMs: Date.now() - startedAt,
            summary: summary.summary,
            embedErrors: summary.embedErrors
          }
        });
        return;
      }

      if (payload.action === "eval") {
        const { source, ensureUrl, ensureMode } = payload.args as unknown as {
          source: string;
          ensureUrl?: string;
          ensureMode?: SessionMode;
        };
        const managedPage = await ensureVisiblePage();
        if (ensureUrl) {
          if (!managedPage.url().startsWith(ensureUrl)) {
            await managedPage.goto(ensureUrl, {
              waitUntil: "domcontentloaded",
              timeout: 120000
            });
            await waitForHelperReady(managedPage, ensureMode ?? "edit");
          }
        }
        const value = await managedPage.evaluate(async (script: string) => {
          const fn = new Function("return (async () => {" + script + "})();");
          return await (fn as () => Promise<unknown>)();
        }, source);
        reply(response, 200, { ok: true, result: { value } });
        return;
      }

      if (payload.action === "capture") {
        const { viewHelperUrl, screenshotPath, snapshotPath } = payload.args as unknown as CaptureArgs;
        const managedPage = await ensureVisiblePage();
        await managedPage.goto(viewHelperUrl, {
          waitUntil: "domcontentloaded",
          timeout: 120000
        });
        await waitForHelperReady(managedPage, "view");
        await managedPage.screenshot({
          path: screenshotPath,
          fullPage: true
        });

        const snapshot = await managedPage.evaluate(() => {
          return {
            title: document.title,
            statusLine: document.querySelector("#statusLine")?.textContent ?? null,
            reportName: document.querySelector("#reportName")?.textContent ?? null,
            url: window.location.href
          };
        });
        await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");

        reply(response, 200, {
          ok: true,
          result: {
            screenshotPath,
            snapshotPath
          }
        });
        return;
      }

      reply(response, 400, { ok: false, error: `Unknown action '${payload.action}'` });
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      await log(`[command-error] ${message}`);
      reply(response, 500, {
        ok: false,
        error: message
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine daemon server address.");
  }

  const state: BrowserSessionState = {
    version: 1,
    sessionName,
    pid: process.pid,
    port: address.port,
    token,
    createdAtUtc: new Date().toISOString(),
    repoRoot,
    logPath
  };
  await writeBrowserSessionState(paths, state);
  process.stdout.write(`READY ${JSON.stringify(state)}\n`);

  const shutdown = async (): Promise<void> => {
    await cleanup();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
