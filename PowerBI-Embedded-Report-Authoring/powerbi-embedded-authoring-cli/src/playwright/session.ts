import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { RuntimePaths } from "../contracts/session.js";

export interface BrowserSessionState {
  version: 1;
  sessionName: string;
  pid: number;
  port: number;
  token: string;
  createdAtUtc: string;
  repoRoot: string;
  logPath: string;
}

export function sessionDirectory(paths: RuntimePaths): string {
  return path.join(paths.runtimeRoot, "sessions");
}

export function sessionStatePath(paths: RuntimePaths, sessionName: string): string {
  return path.join(sessionDirectory(paths), `${sessionName}.json`);
}

export function sessionLogPath(paths: RuntimePaths, sessionName: string): string {
  return path.join(sessionDirectory(paths), `${sessionName}.log`);
}

export async function writeBrowserSessionState(
  paths: RuntimePaths,
  state: BrowserSessionState
): Promise<void> {
  await mkdir(sessionDirectory(paths), { recursive: true });
  await writeFile(sessionStatePath(paths, state.sessionName), JSON.stringify(state, null, 2), "utf8");
}

export async function readBrowserSessionState(
  paths: RuntimePaths,
  sessionName: string
): Promise<BrowserSessionState | null> {
  try {
    const source = await readFile(sessionStatePath(paths, sessionName), "utf8");
    return JSON.parse(source) as BrowserSessionState;
  } catch {
    return null;
  }
}

export async function deleteBrowserSessionState(
  paths: RuntimePaths,
  sessionName: string
): Promise<void> {
  await rm(sessionStatePath(paths, sessionName), { force: true }).catch(() => {});
}
