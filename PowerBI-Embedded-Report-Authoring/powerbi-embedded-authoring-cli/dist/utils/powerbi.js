import { execCommand } from "./exec.js";
async function getJson(url, accessToken) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
    if (!response.ok) {
        throw new Error(`Power BI API request failed (${response.status}): ${url}`);
    }
    return (await response.json());
}
export async function getPowerBIToken() {
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
export async function resolveSessionResources(workspaceName, reportName, semanticModelName) {
    const accessToken = await getPowerBIToken();
    const workspaces = await getJson("https://api.powerbi.com/v1.0/myorg/groups", accessToken);
    const workspace = workspaces.value.find((candidate) => candidate.name === workspaceName);
    if (!workspace) {
        throw new Error(`Workspace '${workspaceName}' was not found.`);
    }
    const reports = await getJson(`https://api.powerbi.com/v1.0/myorg/groups/${workspace.id}/reports`, accessToken);
    const report = reports.value.find((candidate) => candidate.name === reportName);
    if (!report) {
        throw new Error(`Report '${reportName}' was not found in workspace '${workspaceName}'.`);
    }
    const datasets = await getJson(`https://api.powerbi.com/v1.0/myorg/groups/${workspace.id}/datasets`, accessToken);
    let dataset;
    if (semanticModelName) {
        dataset = datasets.value.find((candidate) => candidate.name === semanticModelName);
    }
    else if (report.datasetId) {
        dataset = datasets.value.find((candidate) => candidate.id === report.datasetId);
    }
    if (!dataset) {
        throw new Error(`Semantic model '${semanticModelName ?? report.datasetId ?? "unknown"}' was not found in workspace '${workspaceName}'.`);
    }
    if (!dataset.createReportEmbedURL) {
        throw new Error(`Dataset '${dataset.name}' does not expose createReportEmbedURL through the Power BI API.`);
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
