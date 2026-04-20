import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export async function loadBuildScriptSource(filePath: string): Promise<string> {
  const source = await readFile(filePath, "utf8");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".ts") {
    return ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None
      }
    }).outputText;
  }

  return source;
}
