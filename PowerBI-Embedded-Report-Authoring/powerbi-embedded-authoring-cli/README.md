# powerbi-embedded-authoring-cli

Companion CLI for the `powerbi-embedded-report-authoring` skill.

This package provides the executable runtime for the embedded authoring loop:

- generate a Power BI embed session config
- host the local edit/view helper pages
- open the helper pages in headed Playwright
- run a report build script
- capture screenshots
- export the finished report

## Prerequisites

- Node.js and npm to install dependencies and run the CLI.
- Azure CLI to mint the Power BI API access token used in the generated session config.
- Microsoft Fabric CLI (`fab`) to export the finished report definition with `export-report`.
- Valid Fabric authentication in the current environment for workspace/report access and export operations.
- A saved Fabric report and its backing semantic model so the embedded authoring session has a real target.

## Install From This Folder

From this folder:

```bash
npm install
```

That installs the Playwright-based runtime dependencies for the prebuilt CLI bundle.

Example:

```bash
npx powerbi-embedded-authoring-cli session --repo-root /path/to/project --workspace-name "My Workspace" --report-name "My Report"
```

## Global Install

To install it globally from this local folder:

```bash
npm install -g .
```

After that, the command should be available as:

```bash
powerbi-embedded-authoring-cli --help
```

If you are installing from a different directory, point npm at this package folder:

```bash
npm install -g /path/to/powerbi-embedded-authoring-cli
```

## Put It On User Path

In most environments, `npm install -g` already puts npm's global bin directory on your user `PATH`.

You can verify the command is available with:

```bash
powerbi-embedded-authoring-cli --help
```

If you prefer not to install globally, stay in this folder and run the CLI with `npx powerbi-embedded-authoring-cli ...`.

If that fails, find npm's global bin directory:

```bash
npm bin -g
```

Add that directory to your user `PATH`.

Typical examples:

- Windows: something under `%AppData%\npm`
- macOS/Linux: depends on your Node installation, often something under your home directory

After updating `PATH`, open a new terminal and verify:

```bash
powerbi-embedded-authoring-cli --help
```

## Typical Usage

Run the CLI from inside the target project, or pass `--repo-root` explicitly.

Example:

```bash
powerbi-embedded-authoring-cli session --repo-root /path/to/project --workspace-name "My Workspace" --report-name "My Report"
powerbi-embedded-authoring-cli host --repo-root /path/to/project
powerbi-embedded-authoring-cli open-edit --repo-root /path/to/project
powerbi-embedded-authoring-cli run-build --repo-root /path/to/project --file /path/to/build-script.js
powerbi-embedded-authoring-cli open-view --repo-root /path/to/project
powerbi-embedded-authoring-cli capture --repo-root /path/to/project
powerbi-embedded-authoring-cli export-report --repo-root /path/to/project --workspace-name "My Workspace" --report-name "My Report"
```

## Notes

- The CLI writes runtime state under `output/embedded-authoring/` in the target project.
- Generated `session-config.js` files can contain a live access token and should not be committed or shared.
- The CLI expects Azure CLI and Fabric auth to already be working in the current environment.
- On a new machine, reinstall dependencies after copying or updating this package.
