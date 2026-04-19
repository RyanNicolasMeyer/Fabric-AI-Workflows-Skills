import { execCommand } from "./exec.js";

interface PowerBICollection<T> {
  value: T[];
}

interface Workspace {
  id: string;
  name: string;
}

interface Report {
  id: string;
  name: string;
  datasetId?: string;
  embedUrl: string;
}

interface Dataset {
  id: string;
  name: string;
  createReportEmbedURL?: string;
}

export interface ResolvedSessionResources {
  accessToken: string;
  workspaceId: string;
  workspaceName: string;
  semanticModelId: string;
  semanticModelName: string;
  reportId: string;
  reportName: string;
  reportEmbedUrl: string;
  createReportEmbedUrl: string;
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Power BI API request failed (${response.status}): ${url}`);
  }

  return (await response.json()) as T;
}

export async function getPowerBIToken(): Promise<string> {
  const result = await execCommand("az", [
    "account",
    "get-access-token",
    "--resource",
    "https://analysis.windows.net/powerbi/api",
    "--query",
    "accessToken",
    "-o",
    "tsv"
  ]);

  const token = result.stdout.trim();
  if (!token) {
    throw new Error("Unable to acquire a Power BI access token from Azure CLI.");
  }

  return token;
}

export async function resolveSessionResources(
  workspaceName: string,
  reportName: string,
  semanticModelName?: string
): Promise<ResolvedSessionResources> {
  const accessToken = await getPowerBIToken();

  const workspaces = await getJson<PowerBICollection<Workspace>>(
    "https://api.powerbi.com/v1.0/myorg/groups",
    accessToken
  );
  const workspace = workspaces.value.find((candidate) => candidate.name === workspaceName);

  if (!workspace) {
    throw new Error(`Workspace '${workspaceName}' was not found.`);
  }

  const reports = await getJson<PowerBICollection<Report>>(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspace.id}/reports`,
    accessToken
  );
  const report = reports.value.find((candidate) => candidate.name === reportName);

  if (!report) {
    throw new Error(`Report '${reportName}' was not found in workspace '${workspaceName}'.`);
  }

  const datasets = await getJson<PowerBICollection<Dataset>>(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspace.id}/datasets`,
    accessToken
  );

  let dataset: Dataset | undefined;
  if (semanticModelName) {
    dataset = datasets.value.find((candidate) => candidate.name === semanticModelName);
  } else if (report.datasetId) {
    dataset = datasets.value.find((candidate) => candidate.id === report.datasetId);
  }

  if (!dataset) {
    throw new Error(
      `Semantic model '${semanticModelName ?? report.datasetId ?? "unknown"}' was not found in workspace '${workspaceName}'.`
    );
  }

  if (!dataset.createReportEmbedURL) {
    throw new Error(
      `Dataset '${dataset.name}' does not expose createReportEmbedURL through the Power BI API.`
    );
  }

  return {
    accessToken,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    semanticModelId: dataset.id,
    semanticModelName: dataset.name,
    reportId: report.id,
    reportName: report.name,
    reportEmbedUrl: report.embedUrl,
    createReportEmbedUrl: dataset.createReportEmbedURL
  };
}
