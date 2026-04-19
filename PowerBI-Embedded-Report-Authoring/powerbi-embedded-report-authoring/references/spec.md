# Power BI Embedded Authoring + Playwright Report Development

## Purpose

Use this pattern to author and refine a **live Fabric report item** through Power BI Embedded edit mode, then validate the result in a separate consumer-style view loop driven by headed Playwright.

Use it when you need:

- repeatable report scaffolding
- deterministic page and visual creation
- scripted mutation of a saved Fabric report
- screenshot-driven visual QA
- a clean export step after the report is polished

Do **not** use this pattern for semantic-model authoring. Treat the semantic model as a prerequisite dependency.

## Choose the right method

- Choose **embedded authoring** when the goal is repeatable page/visual generation and iterative visual QA.
- Choose **direct PBIR editing** when the report definition already exists locally and the change is small, targeted, and definition-safe.
- Choose **manual Fabric/Desktop UI work** when the task depends on rich formatting and ad hoc visual styling that is awkward through authoring APIs.

Embedded authoring is powerful, but it is not a full Power BI Desktop replacement.

## Architecture

The pattern has eight moving parts:

1. **Live Fabric report item**
   A real saved report in a Fabric workspace. This is the mutable authoring target.
2. **Semantic model dependency**
   The existing semantic model that provides tables, columns, and measures for the report.
3. **Companion CLI**
   A local Node/TypeScript runtime package that exposes stable commands for session bootstrap, helper hosting, Playwright orchestration, and export.
4. **Edit-mode helper app**
   A local wrapper page that embeds the report in edit mode and exposes the report object on a stable global.
5. **View-mode helper app**
   A local wrapper page that embeds the same report in read mode for realistic QA and screenshots.
6. **Playwright runner**
   The headed browser driver that opens the helper pages, runs build scripts, and captures screenshots/snapshots.
7. **Build script**
   A deterministic Playwright function that runs browser-context report mutations against the embedded report object, binds fields, and saves.
8. **Export step**
   A local command that exports the authored report definition after QA succeeds.

## Control flow

1. Confirm Fabric auth through the external environment guidance.
2. Run the companion CLI.
3. Acquire a Power BI access token through Azure CLI.
4. Resolve workspace, report, and semantic model metadata.
5. Write `output/embedded-authoring/runtime/session-config.js`.
6. Serve the helper app locally.
7. Open `embed-authoring.html` in headed Playwright.
8. Run the report build script against the edit helper, which exposes `window.reportAuthoring.report`.
9. Save the report.
10. Open `embed-view.html` in headed Playwright.
11. Review and capture screenshots.
12. Iterate until the rendered report is clean.
13. Export the final report definition locally.

## Required setup

- A real saved report item in Fabric
- An existing semantic model backing that report
- Azure CLI installed and authenticated well enough to mint a Power BI API token
- Microsoft Fabric CLI (`fab`) installed for report export
- Fabric authentication already working in the local environment
- Node/npm installed
- The companion CLI installed and built
- A local static host started through the companion CLI

The default helper host is:

- `http://127.0.0.1:8765/embed-authoring.html`
- `http://127.0.0.1:8765/embed-view.html`

## Runtime layout

The companion CLI is distributed separately from the skill. In a shared bundle it is typically provided as a sibling folder such as:

- `powerbi-embedded-authoring-cli/`

Generated runtime state lives under:

- `output/embedded-authoring/runtime/`
- `output/embedded-authoring/screenshots/`
- `output/embedded-authoring/exports/`

Never treat generated session files or exported artifacts as canonical skill assets.
Generated session files can contain live access tokens and should never be redistributed.

## Helper app design

### `embed-authoring.html`

This page must:

- load `powerbi-client`
- load `powerbi-report-authoring`
- load `session-config.js`
- embed the report in edit mode
- use `Permissions.All`
- expose `window.reportAuthoring`
- render visible status text
- log `loaded`, `rendered`, `saved`, and `error`

### `embed-view.html`

This page must:

- load the same libraries and session config
- embed the same report in read mode
- use `Permissions.Read`
- expose `window.reportPreview`
- render visible status text
- be used for QA and screenshot review only

### Stable globals

The edit page must expose:

```js
window.reportAuthoring = {
  report,
  powerbi,
  models,
  config,
  status,
  errors,
  lastSaveAt,
  helpers
}
```

The view page must expose:

```js
window.reportPreview = {
  report,
  powerbi,
  models,
  config,
  status,
  errors
}
```

## Build script workflow

The build script is a Playwright function executed through headed Playwright against the edit-mode helper page. The runtime first navigates the current Playwright session to `embed-authoring.html`, waits for `window.reportAuthoring.report`, and then runs the build function.

A build file should evaluate to:

```js
async page => {
  await page.evaluate(async () => {
    // browser-context report authoring code
  });
}
```

Every build script must:

- wait for `window.reportAuthoring.report`
- fetch pages before mutating
- activate the target page before page-level changes
- clear or intentionally recreate the target page
- create visuals with explicit layout
- bind fields explicitly to data roles
- set title visibility/text explicitly
- show newly created visuals explicitly when needed
- call `report.save()` at the end

## Example validation scenario

The shared sample build script creates or rebuilds a page named `Executive Summary` using placeholder tables and measures such as:

- measures from `_Measures`
- dimensions from `Sales`
- dimensions from `Products`

The sample page can include:

- total revenue KPI
- gross margin KPI
- category slicer
- revenue by region chart
- product detail table

Replace those placeholders with names from the target semantic model before running the sample in a real workspace.

## Companion CLI shape

The runtime should present a CLI like:

```bash
powerbi-embedded-authoring-cli session --workspace-name "<workspace-name>" --report-name "<report-name>"
powerbi-embedded-authoring-cli host
powerbi-embedded-authoring-cli open-edit
powerbi-embedded-authoring-cli run-build --file ./examples/my-report.build.js
powerbi-embedded-authoring-cli open-view
powerbi-embedded-authoring-cli capture
powerbi-embedded-authoring-cli export-report --workspace-name "<workspace-name>" --report-name "<report-name>"
```

## Finalization

The v1 finalization step is:

1. save the report
2. validate it in view mode
3. capture screenshots
4. export the final report definition locally

Git and Fabric Git are intentionally out of scope for v1.
