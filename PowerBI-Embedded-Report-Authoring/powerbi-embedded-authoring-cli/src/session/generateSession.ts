import { writeFile } from "node:fs/promises";
import {
  ReportAuthoringSessionConfig,
  SessionCommandOptions
} from "../contracts/session.js";
import { resolveSessionResources } from "../utils/powerbi.js";
import { getRuntimePaths, syncHelperAssets } from "../utils/paths.js";

export async function generateSessionConfig(
  repoRoot: string,
  options: SessionCommandOptions
): Promise<ReportAuthoringSessionConfig> {
  const paths = getRuntimePaths(repoRoot);
  await syncHelperAssets(paths);

  const resolved = await resolveSessionResources(
    options.workspaceName,
    options.reportName,
    options.semanticModelName
  );

  const baseUrl = `http://${options.host}:${options.port}`;
  const config: ReportAuthoringSessionConfig = {
    accessToken: resolved.accessToken,
    tokenType: "Aad",
    workspaceId: resolved.workspaceId,
    workspaceName: resolved.workspaceName,
    semanticModelId: resolved.semanticModelId,
    semanticModelName: resolved.semanticModelName,
    reportId: resolved.reportId,
    reportName: resolved.reportName,
    reportEmbedUrl: resolved.reportEmbedUrl,
    createReportEmbedUrl: resolved.createReportEmbedUrl,
    editHelperUrl: `${baseUrl}/embed-authoring.html`,
    viewHelperUrl: `${baseUrl}/embed-view.html`,
    generatedAtUtc: new Date().toISOString()
  };

  const assignment = `window.REPORT_AUTHORING_SESSION = ${JSON.stringify(config, null, 2)};\n`;
  await writeFile(paths.sessionConfigPath, assignment, "utf8");
  return config;
}
