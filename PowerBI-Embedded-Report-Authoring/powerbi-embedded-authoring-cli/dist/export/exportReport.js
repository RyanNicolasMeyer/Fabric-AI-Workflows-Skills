import { execCommand } from "../utils/exec.js";
export async function exportReportDefinition(paths, workspaceName, reportName) {
    const itemPath = `${workspaceName}.Workspace/${reportName}.Report`;
    await execCommand("fab", ["export", itemPath, "-o", paths.exportsRoot, "-f"], {
        cwd: paths.repoRoot,
        stdio: "inherit"
    });
}
