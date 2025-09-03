import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent   # database/
DB_PATH = BASE_DIR / "data" / "college.db"
SQL_DIR = BASE_DIR / "sql"


def init_db():
    # Ensure data dir exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Recreate DB if you want a fresh start each run
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Run .sql files in numeric order (1_, 2_, 3_, …)
    for sql_file in sorted(SQL_DIR.glob("*.sql")):
        print(f"Running {sql_file.name}...")
        with open(sql_file, "r") as f:
            cursor.executescript(f.read())

    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {DB_PATH}")


if __name__ == "__main__":
    import backfill

    print('Initiating Database:')
    init_db()
    print('DONE.')
    print('\nBackfilling DB from ESPN')
    backfill.main()
    print('DONE.')
