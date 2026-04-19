import argparse
import json
import os
import shutil
import struct
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pyodbc

SQL_RESOURCE = "https://database.windows.net/"
ODBC_ACCESS_TOKEN_ATTR = 1256  # SQL_COPT_SS_ACCESS_TOKEN
CODEX_HOME = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
DEFAULT_TOKEN_FILE = CODEX_HOME / "tmp" / ".fabric_sql_tokens.json"

def _parse_conn_string(value: str) -> dict[str, str]:
    parts = [p.strip() for p in value.split(";") if p.strip()]
    items: dict[str, str] = {}
    for part in parts:
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        items[k.strip().lower()] = v.strip()
    return items

def _get_server_and_db(conn: dict[str, str], server: str | None, database: str | None) -> tuple[str, str]:
    srv = server or conn.get("data source") or conn.get("server")
    db = database or conn.get("initial catalog") or conn.get("database")
    if not srv or not db:
        raise ValueError("Provide --connection-string with Data Source/Initial Catalog, or provide --server and --database.")
    if "," in srv:
        srv = srv.split(",", 1)[0].strip()
    return srv, db

def _parse_expires_epoch(raw: str | int) -> datetime:
    return datetime.fromtimestamp(int(raw), tz=timezone.utc)

def _parse_expires_text(raw: str) -> datetime:
    raw = raw.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)

def _load_token_cache(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

def _save_token_cache(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

def _resolve_az_cmd(cli_arg: str | None) -> str:
    candidates: list[str] = []
    if cli_arg:
        candidates.append(cli_arg)

    env_cli = os.environ.get("AZ_CLI_CMD", "").strip()
    if env_cli:
        candidates.append(env_cli)

    for name in ("az", "az.cmd", "az.bat"):
        resolved = shutil.which(name)
        if resolved:
            candidates.append(resolved)

    home = Path.home()
    for p in (
        home / "Tools" / "azure-cli" / "bin" / "az.cmd",
        home / "AppData" / "Local" / "Azure-cli" / "Scripts" / "az.cmd",
        home / "AppData" / "Local" / "Azure-cli" / "Scripts" / "az.bat",
    ):
        candidates.append(str(p))

    seen: set[str] = set()
    for candidate in candidates:
        c = str(candidate).strip().strip('"')
        if not c or c in seen:
            continue
        seen.add(c)
        if Path(c).exists():
            return c
        if c.lower() in {"az", "az.cmd", "az.bat"} and shutil.which(c):
            return c

    raise FileNotFoundError(
        "Azure CLI executable was not found. Install Azure CLI or pass --az-cli <full-path>. "
        "You can also set AZ_CLI_CMD."
    )

def _refresh_token(az_cmd: str) -> tuple[str, datetime]:
    cmd = [
        az_cmd,
        "account",
        "get-access-token",
        "--resource",
        SQL_RESOURCE,
        "--output",
        "json",
    ]
    proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        msg = (
            f"Failed to acquire Azure SQL token via Azure CLI ({az_cmd}). "
            f"Exit code: {proc.returncode}. "
            "Run `az login` and verify Azure CLI can write to your profile session files."
        )
        if stderr:
            msg = f"{msg}\nAzure CLI error:\n{stderr}"
        raise RuntimeError(msg)

    payload = json.loads(proc.stdout)
    token = payload["accessToken"]
    if "expires_on" in payload:
        expires_at = _parse_expires_epoch(payload["expires_on"])
    else:
        expires_at = _parse_expires_text(payload["expiresOn"])
    return token, expires_at

def get_sql_token(token_file: Path, cache_key: str, az_cmd: str, skew_seconds: int = 120) -> tuple[str, datetime, bool]:
    now = datetime.now(timezone.utc)
    cache = _load_token_cache(token_file)
    entry = cache.get(cache_key, {})
    token = str(entry.get("access_token", "")).strip()
    expires_at = None

    if token:
        if "expires_at_epoch" in entry:
            expires_at = _parse_expires_epoch(entry["expires_at_epoch"])
        elif "expires_at_utc" in entry:
            expires_at = _parse_expires_text(entry["expires_at_utc"])

    if token and expires_at and (expires_at - now) > timedelta(seconds=skew_seconds):
        return token, expires_at, False

    token, expires_at = _refresh_token(az_cmd)
    cache[cache_key] = {
        "resource": SQL_RESOURCE,
        "access_token": token,
        "expires_at_epoch": int(expires_at.timestamp()),
        "expires_at_utc": expires_at.strftime("%Y-%m-%d %H:%M:%S"),
    }
    _save_token_cache(token_file, cache)
    return token, expires_at, True

def _token_attrs(token: str) -> dict[int, bytes]:
    token_bytes = token.encode("utf-16-le")
    blob = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)
    return {ODBC_ACCESS_TOKEN_ATTR: blob}

def _execute_sql(server: str, database: str, token: str, sql: str) -> tuple[list[str], list[tuple]]:
    conn_str = (
        "Driver={ODBC Driver 17 for SQL Server};"
        f"Server={server},1433;"
        f"Database={database};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )
    with pyodbc.connect(conn_str, attrs_before=_token_attrs(token)) as conn:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        if cur.description is None:
            return [], []
        headers = [c[0] for c in cur.description]
        rows = cur.fetchall()
        return headers, rows

def _print_result(headers: list[str], rows: list[tuple]) -> None:
    if not headers:
        print("Statement executed (no rowset).")
        return
    print("\t".join(headers))
    for row in rows:
        print("\t".join("" if v is None else str(v) for v in row))
    print(f"Row count: {len(rows)}")

def main() -> None:
    parser = argparse.ArgumentParser(description="Run Fabric SQL operations with cached OAuth tokens.")
    parser.add_argument("--connection-string", help="SQL connection string containing Data Source and Initial Catalog.")
    parser.add_argument("--server", help="Fabric SQL server host (without port).")
    parser.add_argument("--database", help="Database/catalog name.")
    parser.add_argument("--token-file", default=str(DEFAULT_TOKEN_FILE), help="Token cache JSON file path.")
    parser.add_argument("--az-cli", help="Optional Azure CLI path/command (default: auto-resolve from AZ_CLI_CMD/PATH).")
    parser.add_argument("--query", help="SQL query text to execute.")
    parser.add_argument("--sql-file", help="Path to SQL file to execute.")
    parser.add_argument("--list-schemas", action="store_true", help="Run schema listing query.")
    args = parser.parse_args()

    if not (args.list_schemas or args.query or args.sql_file):
        raise ValueError("Provide one operation: --list-schemas, --query, or --sql-file.")

    conn_map = _parse_conn_string(args.connection_string or "")
    server, database = _get_server_and_db(conn_map, args.server, args.database)
    token_file = Path(os.path.expanduser(os.path.expandvars(args.token_file)))
    cache_key = f"{server.lower()}|{database.lower()}"
    az_cmd = _resolve_az_cmd(args.az_cli)

    token, expires_at, refreshed = get_sql_token(token_file, cache_key, az_cmd)

    if args.list_schemas:
        sql_text = "SELECT name AS schema_name FROM sys.schemas ORDER BY name;"
    elif args.query:
        sql_text = args.query
    else:
        sql_text = Path(args.sql_file).read_text(encoding="utf-8")

    headers, rows = _execute_sql(server, database, token, sql_text)
    print(f"Connected DB: {database}")
    print(f"Token: {'refreshed' if refreshed else 'reused'}")
    print(f"Token expires (UTC): {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Token file: {token_file.resolve()}")
    print(f"Azure CLI: {az_cmd}")
    _print_result(headers, rows)

if __name__ == "__main__":
    main()
