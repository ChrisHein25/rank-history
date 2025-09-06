# College Football Rankings Tracker


### Backend

The python scripts in `database` build a **SQLite database** of college football poll rankings (AP, Coaches, FCS, AFCA Div II/III, Playoff, etc.) using the **ESPN public API**.

* Database schema and migration scripts are in `database/sql/`.
* A single Python script (`database/init_db.py`) creates the database, runs all schema/seed scripts, and backfills real poll data automatically. Database is created in `database/data`.
* A view (`v_team_rankings`) flattens rankings with poll, week, team, and season metadata for easy analytics and plotting.
* `export.py` exports this data in JSON format to `frontend/data` which is used in a static web page, since the data is small. As the data grows the app architecture can be reimagined.

### Frontend

A lightweight web app (HTML/CSS/JavaScript + Chart.js) provides an interactive way to explore the data.  
It includes tables and charts for all-time summaries, overrated team analysis, top overrated/underrated rankings, and a season-by-season ranking visualizer.  
The app runs entirely in the browser and loads prebuilt JSON exports from the database.
It is hosted on [GitHub Pages](https://chrishein25.github.io/rank-history/)


### Getting Started

1. Run the init script:

   ```bash
   python database/init_db.py
   ```

   This creates `database/data/college.db` and backfills it with ESPN poll data for configurable year/poll types.

2. Query the view for analytics:

   ```sql
   SELECT *
   FROM v_team_rankings
   WHERE poll_name = 'AP Top 25'
   ORDER BY week_number, ranking_current_rank;
   ```


### Notes

* The `.db` file itself is **not tracked in GitHub** — only schema and scripts are versioned.
* Poll IDs and season types follow ESPN’s API conventions (e.g., poll\_id `1` = AP Top 25, `2` = AFCA Coaches Poll, etc.).
