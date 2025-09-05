DROP VIEW IF EXISTS v_team_overrated_index;

CREATE VIEW v_team_overrated_index AS
WITH first_and_last_weeks AS (
    SELECT
        poll_name,
        season_year,
        MIN(ranking_week_fk) AS first_week_pk,
        MAX(ranking_week_fk) AS last_week_pk
    FROM v_team_rankings
    GROUP BY poll_name, season_year
),
teams_in_season AS (
    SELECT DISTINCT
        poll_name,
        season_year,
        team_pk,
        team_name
    FROM v_team_rankings
),
start_ranks AS (
    SELECT
        t.poll_name,
        t.season_year,
        t.team_pk,
        t.team_name,
        COALESCE(r.ranking_current_rank, 26) AS start_rank
    FROM teams_in_season t
    JOIN first_and_last_weeks flw
      ON t.poll_name = flw.poll_name
     AND t.season_year = flw.season_year
    LEFT JOIN v_team_rankings r
      ON r.poll_name = t.poll_name
     AND r.season_year = t.season_year
     AND r.team_pk = t.team_pk
     AND r.ranking_week_fk = flw.first_week_pk
),
end_ranks AS (
    SELECT
        t.poll_name,
        t.season_year,
        t.team_pk,
        COALESCE(r.ranking_current_rank, 26) AS end_rank
    FROM teams_in_season t
    JOIN first_and_last_weeks flw
      ON t.poll_name = flw.poll_name
     AND t.season_year = flw.season_year
    LEFT JOIN v_team_rankings r
      ON r.poll_name = t.poll_name
     AND r.season_year = t.season_year
     AND r.team_pk = t.team_pk
     AND r.ranking_week_fk = flw.last_week_pk
)
SELECT
    s.poll_name,
    s.season_year,
    s.team_pk,
    s.team_name,
    s.start_rank,
    CASE WHEN s.start_rank = 26 THEN 'Unranked' ELSE 'Ranked' END AS starting_status,
    e.end_rank,
    CASE WHEN e.end_rank = 26 THEN 'Unranked' ELSE 'Ranked' END AS ending_status,
    (e.end_rank - s.start_rank) AS overrated_index
FROM start_ranks s
JOIN end_ranks e
  ON s.poll_name = e.poll_name
 AND s.season_year = e.season_year
 AND s.team_pk = e.team_pk
ORDER BY s.poll_name, s.season_year, s.start_rank;
