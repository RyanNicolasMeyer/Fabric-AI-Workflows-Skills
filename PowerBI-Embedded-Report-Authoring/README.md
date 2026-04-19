# Power BI Embedded Report Authoring Community Bundle

This bundle packages three things together for community sharing:

- the `powerbi-embedded-report-authoring` skill
- the `powerbi-embedded-authoring-cli` companion runtime
- the documentation needed to install and use both on a new machine

The goal is a portable, assistant-agnostic workflow for authoring a saved Microsoft Fabric / Power BI report through Power BI Embedded edit mode, validating the result in a separate view-mode loop, and exporting the finished report definition.

## Bundle Layout

After extraction, the shared bundle is expected to look like this:

```text
README.md
powerbi-embedded-authoring-cli/
powerbi-embedded-report-authoring/
```

## Prerequisites

- Node.js and npm
  Needed to install dependencies and run the local runtime.
- Azure CLI
  Needed because the `session` command acquires a Power BI API access token for the embedded session.
- Microsoft Fabric CLI (`fab`)
  Needed because the `export-report` command uses Fabric CLI to export the finished report definition.
- Valid Microsoft Fabric authentication
  Needed so Azure CLI and Fabric CLI can resolve workspaces, reports, semantic models, and exports in the current environment.
- A saved Fabric report and its backing semantic model
  Needed because the embedded authoring loop targets a real report item and binds visuals to an existing model.
- Playwright runtime dependencies installed through npm
  Needed because the helper pages, build script execution, and screenshot capture all run through headed Playwright.

## Install the Companion CLI

From the extracted `powerbi-embedded-authoring-cli` folder:

```bash
npm install
```

You can then run it locally with `npx`:

```bash
npx powerbi-embedded-authoring-cli --help
```

Or install it globally from that folder:

```bash
npm install -g .
powerbi-embedded-authoring-cli --help
```

## Install the Skill

Copy the extracted `powerbi-embedded-report-authoring` folder into your assistant's skills directory, library, or other supported import location.

If your assistant expects a different folder name or registration step, keep the folder contents intact and adapt only the surrounding installation step. The skill itself uses relative references internally and does not require machine-specific paths.

## Typical Workflow

Run the CLI from the target project root, or pass `--repo-root` explicitly.

1. Generate a session config for the target report:

```bash
powerbi-embedded-authoring-cli session --repo-root . --workspace-name "<workspace-name>" --report-name "<report-name>"
```

2. Start the local helper host:

```bash
powerbi-embedded-authoring-cli host --repo-root .
```

3. Open the edit helper in headed Playwright:

```bash
powerbi-embedded-authoring-cli open-edit --repo-root .
```

4. Run a build script against the live embedded report:

```bash
powerbi-embedded-authoring-cli run-build --repo-root . --file /path/to/sample-report.build.js
```

A neutral starter script is included in the bundle at `powerbi-embedded-authoring-cli/examples/sample-report.build.js`.

5. Open the view helper and capture QA artifacts:

```bash
powerbi-embedded-authoring-cli open-view --repo-root .
powerbi-embedded-authoring-cli capture --repo-root .
```

6. Export the finished report definition:

```bash
powerbi-embedded-authoring-cli export-report --repo-root . --workspace-name "<workspace-name>" --report-name "<report-name>"
```

## What the Skill References

Inside the skill folder:

- `SKILL.md` explains when to use the workflow.
- `references/spec.md` describes the architecture and control flow.
- `references/contracts.md` documents the session config, helper globals, and build script contract.
- `references/limitations.md` lists embedded-authoring constraints and when to switch methods.
- `references/test-loop.md` describes the iterative QA loop.
- `assets/templates/` contains neutral starter files you can adapt for a real report.

## Security Notes

- Generated `output/embedded-authoring/runtime/session-config.js` files can contain a live Power BI access token.
- Do not commit, upload, or redistribute generated runtime files, screenshots, exports, or cached build files.
- Share only the source skill, source companion CLI, and curated documentation, not a working directory after a live session has been run.
