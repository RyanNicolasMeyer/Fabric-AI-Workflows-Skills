# Contracts

## Session config contract

The companion CLI owns generation of the session config and helper-host lifecycle.

The generated `session-config.js` must assign:

```js
window.REPORT_AUTHORING_SESSION = {
  accessToken,
  tokenType,
  workspaceId,
  workspaceName,
  semanticModelId,
  semanticModelName,
  reportId,
  reportName,
  reportEmbedUrl,
  createReportEmbedUrl,
  editHelperUrl,
  viewHelperUrl,
  generatedAtUtc
}
```

### Field meanings

- `accessToken`: raw Power BI API bearer token generated locally at runtime; treat as sensitive
- `tokenType`: `"Aad"`
- `workspaceId`: Power BI workspace GUID
- `workspaceName`: resolved workspace display name
- `semanticModelId`: dataset / semantic model GUID
- `semanticModelName`: dataset / semantic model display name
- `reportId`: report GUID
- `reportName`: report display name
- `reportEmbedUrl`: embed URL for the saved report
- `createReportEmbedUrl`: dataset create-report URL from the Power BI API
- `editHelperUrl`: local authoring helper URL
- `viewHelperUrl`: local view helper URL
- `generatedAtUtc`: ISO timestamp for the generated config

## Helper page contract

Both helper pages must:

- load the generated session config
- fail loudly if the config is missing
- publish status/errors to the DOM and console
- disable caching on served assets

The edit helper must:

- embed in edit mode
- expose `window.reportAuthoring`
- include `helpers` for build scripts

The view helper must:

- embed in view mode
- expose `window.reportPreview`

## Build script contract

Build scripts are JavaScript or TypeScript files that must evaluate to a single Playwright function:

```js
async page => {
  await page.evaluate(async () => {
    // browser-context report authoring code
  });
}
```

The companion CLI executes that function through `playwright-cli`, automatically navigates the active session back to the edit helper, and waits for `window.reportAuthoring.report` before the build function runs.

Inside the `page.evaluate(...)` block, build scripts:

- do not run in Node
- do not import Node modules
- do have access to browser globals, the DOM, and `window.reportAuthoring`

### Required assumptions

- `window.reportAuthoring.report` is the live embedded report object
- `window.reportAuthoring.helpers` contains utility functions for:
  - waiting for readiness
  - creating property payloads
  - creating column and measure targets
  - resolving visual role names through capabilities
  - clearing a page
  - forcing a new visual into a visible display state

### Required behaviors

- fetch pages before mutating them
- activate the target page before creating or deleting visuals
- avoid hidden, implicit, or accidental visual state
- save explicitly when done
- be rerunnable without requiring manual cleanup of the target page

## Export contract

The export command must write the final report definition under:

- `output/embedded-authoring/exports/`

The export step is part of the implementation workflow and part of the validation workflow.
The export command depends on Microsoft Fabric CLI (`fab`) being installed and authenticated in the local environment.
