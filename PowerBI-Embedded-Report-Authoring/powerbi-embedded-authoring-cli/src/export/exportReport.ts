import { RuntimePaths } from "../contracts/session.js";
import { execCommand } from "../utils/exec.js";

export async function exportReportDefinition(
  paths: RuntimePaths,
  workspaceName: string,
  reportName: string
): Promise<void> {
  const itemPath = `${workspaceName}.Workspace/${reportName}.Report`;
  await execCommand("fab", ["export", itemPath, "-o", paths.exportsRoot, "-f"], {
    cwd: paths.repoRoot,
    stdio: "inherit"
  });
}
