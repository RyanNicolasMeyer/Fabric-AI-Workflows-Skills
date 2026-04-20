import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
const CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
};
function contentTypeFor(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return CONTENT_TYPES[extension] ?? "application/octet-stream";
}
async function resolveRequestPath(paths, requestPath) {
    if (requestPath === "/") {
        return path.join(paths.runtimeRoot, "embed-authoring.html");
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
async function probeExistingHost(host, port) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const response = await fetch(`http://${host}:${port}/embed-authoring.html`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            return false;
        }
        const body = await response.text();
        return body.includes("REPORT_AUTHORING_SESSION") || body.includes("embed-authoring");
    }
    catch {
        return false;
    }
}
export async function startStaticHost(paths, host, port) {
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
        }
        catch (error) {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
        }
    });
    try {
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(port, host, () => {
                console.log(`Embedded authoring host running at http://${host}:${port}`);
                resolve();
            });
        });
    }
    catch (error) {
        const code = error?.code;
        if (code === "EADDRINUSE") {
            const isOurs = await probeExistingHost(host, port);
            if (isOurs) {
                console.log(`Reusing existing embedded authoring host at http://${host}:${port} ` +
                    `(another process is already serving the helper assets).`);
                return;
            }
            throw new Error(`Port ${port} on ${host} is in use, and the responder does not look like the ` +
                `embedded-authoring helper host. Stop whatever is listening on ${host}:${port} ` +
                `(or pass --port <other>) and retry.`);
        }
        throw error;
    }
}
