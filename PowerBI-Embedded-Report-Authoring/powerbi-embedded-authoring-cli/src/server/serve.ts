import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { RuntimePaths } from "../contracts/session.js";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function vendorCandidates(paths: RuntimePaths, requestPath: string): string[] {
  if (requestPath === "/vendor/powerbi-client/powerbi.min.js") {
    return [path.join(paths.repoRoot, "node_modules", "powerbi-client", "dist", "powerbi.min.js")];
  }

  if (requestPath === "/vendor/powerbi-report-authoring/powerbi-report-authoring.js") {
    return [
      path.join(
        paths.repoRoot,
        "node_modules",
        "powerbi-report-authoring",
        "dist",
        "powerbi-report-authoring.js"
      ),
      path.join(
        paths.repoRoot,
        "node_modules",
        "powerbi-report-authoring",
        "dist",
        "powerbi-report-authoring.min.js"
      )
    ];
  }

  return [];
}

async function resolveRequestPath(
  paths: RuntimePaths,
  requestPath: string
): Promise<string | null> {
  if (requestPath === "/") {
    return path.join(paths.runtimeRoot, "embed-authoring.html");
  }

  const vendorPath = vendorCandidates(paths, requestPath).find((candidate) => existsSync(candidate));
  if (vendorPath) {
    return vendorPath;
  }

  const sanitized = requestPath.replace(/^\/+/, "");
  const candidate = path.join(paths.runtimeRoot, sanitized);

  if (!candidate.startsWith(paths.runtimeRoot)) {
    return null;
  }

  if (!existsSync(candidate)) {
    return null;
  }

  return candidate;
}

export async function startStaticHost(
  paths: RuntimePaths,
  host: string,
  port: number
): Promise<void> {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = request.url ? new URL(request.url, `http://${host}:${port}`).pathname : "/";
      const resolvedPath = await resolveRequestPath(paths, requestPath);

      if (!resolvedPath) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      response.setHeader("Content-Type", contentTypeFor(resolvedPath));
      response.setHeader("Cache-Control", "no-store");
      createReadStream(resolvedPath).pipe(response);
    } catch (error) {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      console.log(`Embedded authoring host running at http://${host}:${port}`);
      resolve();
    });
  });
}
