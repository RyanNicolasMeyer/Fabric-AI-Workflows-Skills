export interface ReportAuthoringSessionConfig {
  accessToken: string;
  tokenType: "Aad";
  workspaceId: string;
  workspaceName: string;
  semanticModelId: string;
  semanticModelName: string;
  reportId: string;
  reportName: string;
  reportEmbedUrl: string;
  createReportEmbedUrl: string;
  editHelperUrl: string;
  viewHelperUrl: string;
  generatedAtUtc: string;
}

export interface SessionCommandOptions {
  workspaceName: string;
  reportName: string;
  semanticModelName?: string;
  host: string;
  port: number;
}

export interface RuntimePaths {
  repoRoot: string;
  packageRoot: string;
  outputRoot: string;
  runtimeRoot: string;
  screenshotsRoot: string;
  exportsRoot: string;
  helperAssetRoot: string;
  runtimeHelperRoot: string;
  sessionConfigPath: string;
}

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 8765;
export const DEFAULT_PLAYWRIGHT_SESSION = "embedded-authoring";
