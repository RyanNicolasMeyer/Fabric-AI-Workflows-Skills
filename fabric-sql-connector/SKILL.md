---
name: fabric-sql-connector
description: Use this skill when Codex needs to connect to Microsoft Fabric SQL databases with Azure AD OAuth, run SQL queries, execute SQL files, or inspect metadata (such as schemas) while reusing cached access tokens to avoid repeated interactive logins.
---

# Fabric SQL Connector

Use `~/.codex/skills/fabric-sql-connector/scripts/fabric_sql_tool.py` for Fabric SQL operations.

## Prerequisites

- `python` on `PATH`.
- `az` on `PATH`, authenticated (`az login`).
- Microsoft ODBC Driver 17 or 18 for SQL Server.

## Setup (Run Once Per Machine)

```powershell
$CODEX_HOME = "$HOME/.codex"
$VENV_PATH = "$CODEX_HOME/venvs/fabric-sql-connector/.venv"
$VENV_PYTHON = "$VENV_PATH/Scripts/python.exe"
$REQUIREMENTS = "$CODEX_HOME/skills/fabric-sql-connector/requirements.txt"

if (-not (Test-Path $VENV_PYTHON)) {
  python -m venv $VENV_PATH
}

& $VENV_PYTHON -m pip install --upgrade pip
& $VENV_PYTHON -m pip install -r $REQUIREMENTS
```

If Azure CLI is not resolvable in the current execution context, set `AZ_CLI_CMD` or pass `--az-cli`.

## Workflow

1. Use the venv Python at `~/.codex/venvs/fabric-sql-connector/.venv/Scripts/python.exe`.
2. Accept either a full SQL connection string, or separate `--server` and `--database`.
3. Run one operation: `--list-schemas`, `--query`, or `--sql-file`.
4. Reuse token cache from `~/.codex/tmp/.fabric_sql_tokens.json`, refreshing only near expiry.
5. Return exact command output and query result summaries.

## Commands

List schemas:

```powershell
$CODEX_HOME = "$HOME/.codex"
$PY = "$CODEX_HOME/venvs/fabric-sql-connector/.venv/Scripts/python.exe"
$TOOL = "$CODEX_HOME/skills/fabric-sql-connector/scripts/fabric_sql_tool.py"
& $PY $TOOL --connection-string "<full-connection-string>" --list-schemas
```

Run query:

```powershell
$CODEX_HOME = "$HOME/.codex"
$PY = "$CODEX_HOME/venvs/fabric-sql-connector/.venv/Scripts/python.exe"
$TOOL = "$CODEX_HOME/skills/fabric-sql-connector/scripts/fabric_sql_tool.py"
& $PY $TOOL --connection-string "<full-connection-string>" --query "SELECT TOP 20 * FROM sys.tables"
```

Run SQL file:

```powershell
$CODEX_HOME = "$HOME/.codex"
$PY = "$CODEX_HOME/venvs/fabric-sql-connector/.venv/Scripts/python.exe"
$TOOL = "$CODEX_HOME/skills/fabric-sql-connector/scripts/fabric_sql_tool.py"
& $PY $TOOL --connection-string "<full-connection-string>" --sql-file ".\\migration.sql"
```

## Token Rules

- Resource audience: `https://database.windows.net/`.
- Cache file: `~/.codex/tmp/.fabric_sql_tokens.json`.
- Reuse cached token until within 120 seconds of expiry.
- Refresh token via `az account get-access-token` only when needed.
- On token acquisition failure, run `az login` and retry the original command.

## Error Recovery

- Azure CLI not found: confirm `az` is on PATH, set `AZ_CLI_CMD`, or pass `--az-cli`.
- Azure auth/session errors: run `az login`, then retry.
