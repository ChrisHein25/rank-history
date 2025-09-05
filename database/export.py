"""
Export data as JSON for use in frontend/data
"""
import sqlite3
import json
from pathlib import Path

# Resolve paths relative to this script
BASE_DIR = Path(__file__).resolve().parent.parent   # project root
DB_PATH = BASE_DIR / "database" / "data" / "college.db"
OUT_DIR = BASE_DIR / "frontend" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Views to export: (sqlite view name, output filename)
EXPORTS = [
    ("v_team_rankings", "rankings.json"),
    ("v_team_alltime_summary", "alltime_summary.json"),
    ("v_team_overrated_index", "overrated.json"),
    ("v_team_overrated_index_stats", "overrated_stats.json"),
    ("v_team_collapse_index", "collapse.json"),
    ("v_team_collapse_index_stats", "collapse_stats.json"),
]


def query_view(conn, view_name: str):
    """Return rows from a SQLite view as list of dicts."""
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {view_name}")
    cols = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    return [dict(zip(cols, row)) for row in rows]


def export_view(conn, view_name: str, filename: str):
    print(f"Exporting {view_name} → {filename}")
    rows = query_view(conn, view_name)

    out_path = OUT_DIR / filename
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=True, indent=2)  # pretty JSON, UTF-8


def main():
    conn = sqlite3.connect(DB_PATH)
    for view, fname in EXPORTS:
        export_view(conn, view, fname)
    conn.close()
    print("✅ All exports complete.")


if __name__ == "__main__":
    main()
