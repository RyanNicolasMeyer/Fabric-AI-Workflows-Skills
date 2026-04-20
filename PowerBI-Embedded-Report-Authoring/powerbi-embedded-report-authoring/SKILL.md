---
name: powerbi-embedded-report-authoring
description: >
  Build and iteratively refine Microsoft Fabric / Power BI reports through a repeatable Power BI Embedded authoring loop with a local helper app and headed Playwright review. Use when a coding assistant needs to: (1) generate a browser-readable session config with report metadata and a Power BI token, (2) open a local edit-mode wrapper page that exposes the embedded report object, (3) run scripted report-authoring changes against that live report, (4) open a separate view-mode wrapper page for screenshot-driven QA, or (5) export the final authored report artifact after validation. Prefer this skill for repeatable report scaffolding and visual iteration, not semantic-model authoring.
---

# PowerBI Embedded Report Authoring

Use this skill when the task is primarily about building or reshaping a live Fabric report through embedded edit mode and validating the result in a consumer-style view loop.

## Choose the right approach

- Use **embedded authoring** for repeatable page construction, scripted visual creation, and screenshot-driven QA.
- Use **direct PBIR editing** when the report definition already exists locally and the change is small, targeted, and definition-safe.
- Use **manual Fabric/Desktop authoring** when the task depends on rich formatting interactions that are not worth scripting.

This pattern is for **report authoring**, not semantic-model authoring.

## Prerequisites

- Node.js and npm are available locally.
- Azure CLI is available and can mint a Power BI API token.
- Microsoft Fabric CLI (`fab`) is available for export workflows.
- Fabric authentication is valid in the current environment.
- The companion CLI is installed.
- A real saved report item already exists in Fabric before the embedded loop begins.

## Installation

- Copy this skill folder into your assistant's skills location, library, or equivalent import path.
- Keep the companion CLI package available alongside your work, or install it globally with npm.
- Read [references/spec.md](./references/spec.md) for the full workflow before starting a new authoring loop.
- Read [design.md](./design.md) before laying out a new dashboard page or revising an existing dashboard for polish.

## Companion runtime

This skill is paired with a companion runtime package that exposes the command shape:

```bash
powerbi-embedded-authoring-cli <subcommand>
```

Install the companion CLI dependencies from its package folder:

```bash
npm install
```

## Local runtime bootstrap

Generate a session config:

```bash
powerbi-embedded-authoring-cli session --repo-root . --workspace-name "<workspace-name>" --report-name "<report-name>"
```

Start the local helper host:

```bash
powerbi-embedded-authoring-cli host --repo-root .
```

## Standard loop

1. Read [references/spec.md](./references/spec.md) for the full workflow and architecture.
2. Read [references/contracts.md](./references/contracts.md) before creating or changing session/build/helper interfaces.
3. Read [design.md](./design.md) and use it as the editable visual standard for dashboard layout, spacing, slicers, KPI treatment, and QA expectations.
4. Open the edit helper and run a build script against the embedded report object.
5. Open the view helper and validate the report visually in headed Playwright against the design guide, not just for technical correctness.
6. Repeat until the report is clean.
7. Export the finished report artifact.

## Runtime commands

```bash
powerbi-embedded-authoring-cli open-edit --repo-root .
powerbi-embedded-authoring-cli run-build --repo-root . --file /path/to/sample-report.build.js
powerbi-embedded-authoring-cli open-view --repo-root .
powerbi-embedded-authoring-cli capture --repo-root .
powerbi-embedded-authoring-cli export-report --repo-root . --workspace-name "<workspace-name>" --report-name "<report-name>"
```

The companion bundle includes a starter example at `powerbi-embedded-authoring-cli/examples/sample-report.build.js`.

## Load these references when needed

- Main architecture and workflow: [references/spec.md](./references/spec.md)
- Session config, helper globals, and build script contract: [references/contracts.md](./references/contracts.md)
- Embedded-authoring limits and gotchas: [references/limitations.md](./references/limitations.md)
- The exact iteration loop for QA and refinement: [references/test-loop.md](./references/test-loop.md)
- Editable dashboard design standard: [design.md](./design.md)
