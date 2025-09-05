import sqlite3
import sys

import requests
import re
import logging
from pathlib import Path
from typing import Dict, Any, List
import time

from concurrent.futures import ThreadPoolExecutor, as_completed

from mappings import TEAM_ABBREVIATION_MAP

# ---------------- Config ----------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "database" / "data" / "college.db"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# ---------------- ESPN Client ----------------
class ESPNClient:
    BASE_URL = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"

    def get_request(self, url, sleep_time=1, tries=0):
        if tries > 10:
            print("Tries exceeded 10.")
            sys.exit(1)

        try:
            resp = requests.get(url)
            resp.raise_for_status()
            return resp
        except requests.exceptions.HTTPError as e:
            print(f"HTTP Error Occured: {e}")
            print("Sleeping")
            time.sleep(sleep_time)
            print("Done")
            return self.get_request(url, sleep_time=sleep_time*2, tries=tries+1)

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


def normalize_trend(t: str) -> int:
    if t == "-":
        return 0
    else:
        return int(t)


# ---------------- Database Wrapper ----------------
class Database:
    def __init__(self, db_path: Path):
        self.conn = sqlite3.connect(db_path)

    def close(self):
        self.conn.close()

    def add_entry(self, table: str, insert_dict: Dict[str, Any], cursor=None) -> int:
        if cursor is None:
            cursor = self.conn.cursor()

        fields = ", ".join(insert_dict.keys())
        placeholders = ", ".join("?" * len(insert_dict))
        values = tuple(insert_dict.values())
        cursor.execute(f"INSERT INTO {table} ({fields}) VALUES ({placeholders})", values)
        self.conn.commit()
        return cursor.lastrowid

    def get_or_create(self, table: str, insert_dict: Dict[str, Any]) -> int:
        cursor = self.conn.cursor()

        # Exclude PK column if it's auto-increment (e.g. "{table}_pk")
        filtered_dict = {
            k: v for k, v in insert_dict.items() if k != f"{table}_pk"
        }

        # Build WHERE clause: col1 = ? AND col2 = ? ...
        where_clause = " AND ".join([f"{col} = ?" for col in filtered_dict.keys()])
        values = list(filtered_dict.values())

        cursor.execute(f"SELECT {table}_pk FROM {table} WHERE {where_clause}", values)
        row = cursor.fetchone()

        if row:
            # Found an existing row with exact same values
            return row[0]

        # Otherwise, insert new row
        cursor_last_row_id = self.add_entry(table=table, insert_dict=insert_dict)
        return cursor_last_row_id

    def ___get_or_create_old___(self, table: str, unique_field: str, unique_value: Any, insert_dict: Dict[str, Any]) -> int:
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT {table}_pk FROM {table} WHERE {unique_field} = ?", (unique_value,))
        row = cursor.fetchone()
        if row:
            return row[0]

        cursor_last_row_id = self.add_entry(table=table, insert_dict=insert_dict)

        return cursor_last_row_id

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
            normalize_trend(entry["trend"])
        ))
        self.conn.commit()


# ---------------- Backfiller ----------------

def get_corrected_team_data(team_name, abbreviation, school_name) -> (str, str):

    ret = TEAM_ABBREVIATION_MAP.get(abbreviation, None)

    # check for special cases
    if "MIA" in abbreviation:
        if "Hurricanes" in school_name:
            ret = {"abbrev": "MIA",  "name": "Miami (FL)"}
        else:
            ret = None
    elif "USC" in abbreviation:
        if "Trojan" in school_name:
            ret = {"abbrev": "USC",  "name": "USC"}
        else:
            ret = None

    if ret is None:
        raise ValueError(f"No team code mapping found for {abbreviation}, {team_name}, {school_name}. Please add to mappings.py")
    return ret['name'], ret['abbrev']


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
                team_json = self.client.get_team_data(entry["team"]["$ref"])
                self._insert_full_record(year, poll_id, w, entry, team_json)

    def backfill_poll_parallel(self, year: int, poll_id: int):
        logging.info(f"(parallel) Backfilling poll id {poll_id} for {year}")
        weeks = self.client.get_weeks(year, poll_id)
        if not weeks:
            logging.warning(f"No weeks found for poll id {poll_id} {year}")
            return

        for w in weeks:
            poll_data = self.client.get_poll_data(w["url"])
            headline = poll_data.get("headline", f"Week {w['week']}")
            logging.info(f"Processing {headline}")

            ranks = poll_data.get("ranks", [])
            if not ranks:
                continue

            # ---- parallel fetch team data (no DB writes here) ----
            def fetch_team(entry):
                team_json = self.client.get_team_data(entry["team"]["$ref"])
                return entry, team_json

            results = []
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(fetch_team, entry) for entry in ranks]
                for f in as_completed(futures):
                    try:
                        results.append(f.result())
                    except Exception as e:
                        logging.error(f"Failed fetching team: {e}")

            # ---- serial DB inserts (safe for SQLite) ----
            for entry, team_json in results:
                self._insert_full_record(year, poll_id, w, entry, team_json)

    def _insert_full_record(self, year: int, poll_id: int, week_info: Dict[str, Any],
                            entry: Dict[str, Any], team_json: Dict[str, Any]):
        """Shared insert logic (requires team_json)."""

        # Season
        season_pk = self.db.get_or_create(
            "season",
            {"season_year": year, "season_description": f"{year} season"}
        )

        # Week
        week_pk = self.db.get_or_create(
            "week",
            {"week_number": week_info["week"],
             "week_season_fk": season_pk,
             "week_season_type_fk": week_info['seasonType']}
        )

        # School & Team
        school_name = team_json.get("displayName")
        team_name = team_json.get("nickname") or team_json.get("shortDisplayName") or school_name
        abbreviation = team_json.get("abbreviation") or school_name[:4].upper()

        # special cases of multiple 'school' names
        if abbreviation == "SJSU":
            abbreviation_corr = abbreviation
            team_name_corr = "San Jose State"  # no é
            school_name = "San Jose State Spartans"
        elif abbreviation == "USM":
            abbreviation_corr = abbreviation
            team_name_corr = "Southern Mississippi"
            school_name = "Southern Mississippi Golden Eagles"
        else:
            try:
                team_name_corr, abbreviation_corr = get_corrected_team_data(team_name, abbreviation, school_name)
            except Exception as e:
                print(f"Failed on team abbreviation: {team_name, school_name, abbreviation}")
                raise e
        school_pk = self.db.get_or_create("school", {"school_name": school_name})
        team_pk = self.db.get_or_create(
            "team",
            {"team_name": team_name_corr,
             "team_school_fk": school_pk,
             "team_abbreviation": abbreviation_corr}
        )

        # Ranking
        self.db.insert_ranking(poll_id, week_pk, team_pk, entry)
        logging.info(f'      Added rank for {team_name_corr}')


# ---------------- Main ----------------
def main(years: list, poll_ids: list):
    client = ESPNClient()
    db = Database(DB_PATH)
    backfiller = Backfiller(db, client)

    for year in years:
        for poll_id in poll_ids:
            # backfiller.backfill_poll(year, poll_id)
            backfiller.backfill_poll_parallel(year, poll_id)

    db.close()


