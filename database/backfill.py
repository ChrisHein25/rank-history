import sqlite3
import requests
import re
import logging
from pathlib import Path
from typing import Dict, Any, List

# ---------------- Config ----------------
YEARS = [2024]  # extend as needed
POLL_IDS = [1, 2]


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "database" / "data" / "college.db"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# ---------------- ESPN Client ----------------
class ESPNClient:
    BASE_URL = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"

    @staticmethod
    def get_json(url: str) -> Dict[str, Any]:
        resp = requests.get(url)
        resp.raise_for_status()
        return resp.json()

    def get_weeks(self, year: int, poll_id: int) -> List[Dict[str, Any]]:
        """Fetch all weeks for a given year & poll."""
        listing_url = f"{self.BASE_URL}/seasons/{year}/rankings/{poll_id}?lang=en&region=us"
        listing = self.get_json(listing_url)

        weeks = []
        for r in listing.get("rankings", []):
            ref = r.get("$ref", "")
            m = re.search(r"/types/(\d+)/weeks/(\d+)/", ref)
            if m:
                weeks.append({
                    "seasonType": int(m.group(1)),
                    "week": int(m.group(2)),
                    "url": ref
                })
        return weeks

    def get_poll_data(self, url: str) -> Dict[str, Any]:
        return self.get_json(url)

    def get_team_data(self, ref: str) -> Dict[str, Any]:
        return self.get_json(ref)


# ---------------- Database Wrapper ----------------
class Database:
    def __init__(self, db_path: Path):
        self.conn = sqlite3.connect(db_path)

    def close(self):
        self.conn.close()

    def get_or_create(self, table: str, unique_field: str, unique_value: Any, insert_dict: Dict[str, Any]) -> int:
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT {table}_pk FROM {table} WHERE {unique_field} = ?", (unique_value,))
        row = cursor.fetchone()
        if row:
            return row[0]

        fields = ", ".join(insert_dict.keys())
        placeholders = ", ".join("?" * len(insert_dict))
        values = tuple(insert_dict.values())
        cursor.execute(f"INSERT INTO {table} ({fields}) VALUES ({placeholders})", values)
        self.conn.commit()
        return cursor.lastrowid

    def insert_ranking(self, poll_pk: int, week_pk: int, team_pk: int, entry: Dict[str, Any]):
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO ranking (
                ranking_poll_fk, ranking_week_fk, ranking_team_fk,
                ranking_current_rank, ranking_points, ranking_first_place_votes,
                ranking_record_wins, ranking_record_losses, ranking_trend
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            poll_pk, week_pk, team_pk,
            entry["current"],
            entry["points"],
            entry["firstPlaceVotes"],
            int(entry["record"]["stats"][0]["value"]),
            int(entry["record"]["stats"][1]["value"]),
            entry["trend"]
        ))
        self.conn.commit()


# ---------------- Backfiller ----------------
class Backfiller:
    def __init__(self, db: Database, client: ESPNClient):
        self.db = db
        self.client = client

    def backfill_poll(self, year: int, poll_id: int):
        logging.info(f"Backfilling poll id {poll_id} for {year}")
        weeks = self.client.get_weeks(year, poll_id)
        if not weeks:
            logging.warning(f"No weeks found for poll id {poll_id} {year}")
            return

        for w in weeks:
            poll_data = self.client.get_poll_data(w["url"])
            headline = poll_data.get("headline", f"Week {w['week']}")
            logging.info(f"Processing {headline}")

            for entry in poll_data.get("ranks", []):
                print(f'  Inserting record for the team ranked {entry["current"]}')
                self.insert_full_record(year, poll_id, w, entry)

    def insert_full_record(self, year: int, poll_id: int, week_info: Dict[str, Any], entry: Dict[str, Any]):
        # We already have poll pk and also assume season types are fixed

        # Season
        season_pk = self.db.get_or_create(
            "season", "season_year", year,
            {"season_year": year, "season_description": f"{year} season"}
        )

        # Week (composite uniqueness simplified to just week_number here)
        week_pk = self.db.get_or_create(
            "week", "week_number", week_info["week"],
            {"week_number": week_info["week"],
             "week_season_fk": season_pk, "week_season_type_fk": week_info['seasonType']}
        )

        # School & Team
        team_json = self.client.get_team_data(entry["team"]["$ref"])
        school_name = team_json.get("displayName")
        team_name = team_json.get("nickname") or team_json.get("shortDisplayName") or school_name
        abbreviation = team_json.get("abbreviation") or school_name[:4].upper()

        school_pk = self.db.get_or_create("school", "school_name", school_name, {"school_name": school_name})
        team_pk = self.db.get_or_create(
            "team", "team_name", team_name,
            {"team_name": team_name, "team_school_fk": school_pk, "team_abbreviation": abbreviation}
        )

        # Ranking
        self.db.insert_ranking(poll_id, week_pk, team_pk, entry)
        print(f'      Successfully added rank for {team_name}')


# ---------------- Main ----------------
def main():
    client = ESPNClient()
    db = Database(DB_PATH)
    backfiller = Backfiller(db, client)

    for year in YEARS:
        for poll_id in POLL_IDS:
            backfiller.backfill_poll(year, poll_id)

    db.close()


