import path from "node:path";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  DEFAULT_PLAYWRIGHT_SESSION,
  ReportAuthoringSessionConfig
} from "../contracts/session.js";
import { getRuntimePaths } from "../utils/paths.js";
import { BrowserSessionState, readBrowserSessionState } from "./session.js";

const DEFAULT_VISUAL_TYPES = [
  "card",
  "cardVisual",
  "slicer",
  "textbox",
  "clusteredColumnChart",
  "clusteredBarChart",
  "lineChart",
  "donutChart",
  "pieChart",
  "tableEx",
  "pivotTable"
];

export interface ProbeVisualReport {
  type: string;
  supported: boolean;
  capKeys?: string[];
  dataRoles?: Array<{ name: string; kind: number | string | undefined }>;
  hasObjects?: boolean;
  objectNames?: string[];
  error?: string;
}

export interface ProbeReport {
  availableVisualTypes: string[] | null;
  pages: Array<{ name: string; displayName: string; isActive: boolean }>;
  visuals: ProbeVisualReport[];
}

async function loadSessionConfig(cwd: string): Promise<ReportAuthoringSessionConfig> {
  const p = path.join(cwd, "output", "embedded-authoring", "runtime", "session-config.js");
  const source = await readFile(p, "utf8");
  const sandbox = { window: {} as { REPORT_AUTHORING_SESSION?: ReportAuthoringSessionConfig } };
  vm.runInNewContext(source, sandbox);
  if (!sandbox.window.REPORT_AUTHORING_SESSION) {
    throw new Error(`Unable to load REPORT_AUTHORING_SESSION from ${p}`);
  }
  return sandbox.window.REPORT_AUTHORING_SESSION;
}

async function ensureSessionOrThrow(
  cwd: string,
  sessionName: string
): Promise<BrowserSessionState> {
  const paths = getRuntimePaths(cwd);
  const state = await readBrowserSessionState(paths, sessionName);
  if (!state) {
    throw new Error(
      `No active browser session found. Run 'powerbi-embedded-authoring-cli open-edit' first.`
    );
  }
  return state;
}

async function sendEval(
  state: BrowserSessionState,
  source: string,
  ensureUrl: string
): Promise<unknown> {
  const response = await fetch(`http://127.0.0.1:${state.port}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      token: state.token,
      action: "eval",
      args: { source, ensureUrl, ensureMode: "edit" }
    })
  });
  const body = (await response.json()) as {
    ok: boolean;
    result?: { value?: unknown };
    error?: string;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `eval failed (${response.status})`);
  }
  return body.result?.value;
}

const PROBE_SCRIPT = `
const api = window.reportAuthoring;
if (!api || !api.report) {
  return { error: "window.reportAuthoring.report not available." };
}
const report = api.report;
const available = typeof report.getAvailableVisualTypes === "function"
  ? await report.getAvailableVisualTypes()
  : null;
const pages = await report.getPages();
const pagesSummary = pages.map(p => ({
  name: p.name, displayName: p.displayName, isActive: Boolean(p.isActive)
}));
const probeName = "_probe_" + Date.now();
let tmp = null;
if (typeof report.addPage === "function") {
  await report.addPage(probeName);
  const refreshed = await report.getPages();
  tmp = refreshed.find(p => p.displayName === probeName) || null;
  if (tmp) await tmp.setActive();
}
const out = [];
const types = __TYPES__;
for (const type of types) {
  if (!tmp) { out.push({ type, supported: false, error: "No probe page." }); continue; }
  try {
    const resp = await tmp.createVisual(type, { x: 0, y: 0, width: 200, height: 120, z: 0 }, false);
    const caps = await resp.visual.getCapabilities();
    out.push({
      type,
      supported: true,
      capKeys: Object.keys(caps || {}),
      dataRoles: (caps && caps.dataRoles ? caps.dataRoles : []).map(r => ({ name: r.name, kind: r.kind })),
      hasObjects: Boolean(caps && caps.objects),
      objectNames: caps && caps.objects ? Object.keys(caps.objects) : []
    });
  } catch (e) {
    out.push({ type, supported: false, error: String(e && e.message || e) });
  }
}
if (tmp) {
  try { await api.helpers.clearPage(tmp); } catch (e) {}
  try { await report.deletePage(tmp.name); } catch (e) {}
}
return { availableVisualTypes: available, pages: pagesSummary, visuals: out };
`;

export async function probeCapabilities(
  cwd: string,
  visualTypes: string[] | null,
  sessionName = DEFAULT_PLAYWRIGHT_SESSION
): Promise<ProbeReport> {
  const config = await loadSessionConfig(cwd);
  const state = await ensureSessionOrThrow(cwd, sessionName);
  const types = visualTypes && visualTypes.length > 0 ? visualTypes : DEFAULT_VISUAL_TYPES;
  const source = PROBE_SCRIPT.replace("__TYPES__", JSON.stringify(types));
  const value = (await sendEval(state, source, config.editHelperUrl)) as ProbeReport | {
    error: string;
  };
  if ("error" in value && typeof value.error === "string") {
    throw new Error(value.error);
  }
  return value as ProbeReport;
}

export function formatProbeReport(report: ProbeReport): string {
  const lines: string[] = [];
  lines.push(
    `Available visual types: ${
      report.availableVisualTypes === null
        ? "(API not exposed — all types allowed)"
        : report.availableVisualTypes.length + " types reported"
    }`
  );
  lines.push(`Pages: ${report.pages.map((p) => p.displayName).join(", ") || "(none)"}`);
  lines.push("");
  lines.push("Visual capability probe:");
  for (const v of report.visuals) {
    if (!v.supported) {
      lines.push(`  ${v.type.padEnd(24)} UNSUPPORTED  ${v.error ?? ""}`);
      continue;
    }
    const roles = (v.dataRoles || []).map((r) => r.name).join(", ") || "(none)";
    const objectsNote = v.hasObjects
      ? `${(v.objectNames || []).length} formatting objects`
      : "NO formatting objects (setProperty will silently fail)";
    lines.push(`  ${v.type.padEnd(24)} roles=[${roles}]`);
    lines.push(`  ${"".padEnd(24)} ${objectsNote}; capKeys=${(v.capKeys || []).join(",")}`);
  }
  const anyWithObjects = report.visuals.some((v) => v.hasObjects);
  if (!anyWithObjects) {
    lines.push("");
    lines.push(
      "Heads-up: no visual in this SDK build returns formatting `objects`. " +
        "Any safeSetProperty/setProperty call against title, background, data.mode, etc. " +
        "will silently fail. Use 'apply-style' to patch the PBIR definition after authoring."
    );
  }
  return lines.join("\n");
}
