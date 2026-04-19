import { spawn } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "pipe" | "inherit";
}

function resolveCommand(command: string): string {
  if (process.platform !== "win32") {
    return command;
  }

  if (command === "az") {
    return "az.cmd";
  }

  if (command === "npx") {
    return "npx.cmd";
  }

  return command;
}

export async function execCommand(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const resolvedCommand = resolveCommand(command);

  return await new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.stdio === "inherit" ? "inherit" : "pipe",
      shell: process.platform === "win32"
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      const exitCode = code ?? 0;
      if (exitCode !== 0) {
        reject(
          new Error(
            `Command failed: ${resolvedCommand} ${args.join(" ")}\n${stderr || stdout}`
          )
        );
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });
  });
}
