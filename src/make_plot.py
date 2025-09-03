import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from typing import List, Optional

# ---- Config ----
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "database" / "data" / "college.db"

MAX_RANK = 25
UNRANKED_VALUE = MAX_RANK + 1


# ---- Database Access ----
def get_rankings(poll_name: str = "AP Top 25", year: Optional[int] = None) -> pd.DataFrame:
    """Fetch rankings from the database view for a given poll (and year if specified)."""
    conn = sqlite3.connect(DB_PATH)

    query = f"""
    SELECT
        season_year,
        week_number,
        poll_name,
        team_abbreviation,
        ranking_current_rank
    FROM v_team_rankings
    WHERE poll_name = ?
    """

    params = [poll_name]
    if year:
        query += " AND season_year = ?"
        params.append(year)

    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df


# ---- Transformation ----
def transform_rankings(df: pd.DataFrame) -> pd.DataFrame:
    """Prepare rankings for plotting (invert ranks, add unranked value)."""
    df = df.copy()
    df["rank_for_plot"] = df["ranking_current_rank"].fillna(UNRANKED_VALUE)
    return df


# ---- Plotting ----
def plot_rankings(df: pd.DataFrame, poll_name: str, teams: Optional[List[str]] = None):
    """Plot rankings progression for all teams (or a filtered subset)."""
    plt.figure(figsize=(12, 8))

    grouped = df.groupby("team_abbreviation")

    for team, team_df in grouped:
        if teams and team not in teams:
            continue
        plt.plot(
            team_df["week_number"],
            team_df["rank_for_plot"],
            marker="o",
            label=team
        )

    plt.gca().invert_yaxis()  # 1 at top
    plt.yticks(
        range(1, UNRANKED_VALUE + 1),
        [str(i) if i <= MAX_RANK else "Unranked" for i in range(1, UNRANKED_VALUE + 1)]
    )
    plt.xlabel("Week Number")
    plt.ylabel("Rank")
    plt.title(f"{poll_name} Rankings Progression")
    if not teams or len(teams) <= 10:  # only show legend if not too cluttered
        plt.legend(bbox_to_anchor=(1.05, 1), loc="upper left", fontsize="small")
    plt.tight_layout()
    plt.show()


# ---- Main Entrypoint ----
def main():
    df = get_rankings(poll_name="AP Top 25", year=2024)
    df = transform_rankings(df)
    plot_rankings(df, poll_name="AP Top 25")


if __name__ == "__main__":
    main()
