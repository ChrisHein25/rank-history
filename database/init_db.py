import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent   # database/
DB_PATH = BASE_DIR / "data" / "college.db"
SQL_DIR = BASE_DIR / "sql"


def init_db(drop=True):
    # Ensure data dir exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Recreate DB if you want a fresh start each run
    if drop:
        if DB_PATH.exists():
            print(f"Dropping database at {DB_PATH}")
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

    ######
    YEAR_START = 2004
    YEAR_END = 2024
    POLL_IDS = [1, 2]
    ######

    YEARS = list(range(YEAR_START, YEAR_END + 1))

    import backfill
    import time

    start_time = time.perf_counter()

    print("Initiating Database:")
    init_db()
    print("DONE.")

    print("\nBackfilling DB from ESPN")
    backfill.main(years=YEARS, poll_ids=POLL_IDS)
    print("DONE.")

    end_time = time.perf_counter()
    elapsed = end_time - start_time
    print(f"\nTotal execution time: {elapsed:.2f} seconds")
