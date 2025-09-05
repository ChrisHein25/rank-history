-- v_team_season_collapse_index
DROP VIEW IF EXISTS v_team_collapse_index;

CREATE VIEW v_team_collapse_index AS
WITH season_stats AS (
    SELECT
        season_year,
        poll_name,
        team_pk,
        team_name,
        team_abbreviation,
        MIN(ranking_current_rank) AS best_rank
    FROM v_team_rankings
    WHERE ranking_current_rank IS NOT NULL
    GROUP BY season_year, poll_name, team_pk, team_name, team_abbreviation
),
last_week_by_poll AS (
    SELECT
        season_year,
        poll_name,
        MAX(ranking_week_fk) AS last_week_fk
    FROM v_team_rankings
    GROUP BY season_year, poll_name
),
final_ranks AS (
    SELECT
        ss.season_year,
        ss.poll_name,
        ss.team_pk,
        COALESCE(r.ranking_current_rank, 26) AS final_rank
    FROM season_stats ss
    JOIN last_week_by_poll lw
      ON ss.season_year = lw.season_year
     AND ss.poll_name   = lw.poll_name
    LEFT JOIN v_team_rankings r
      ON r.season_year     = lw.season_year
     AND r.poll_name       = lw.poll_name
     AND r.ranking_week_fk = lw.last_week_fk
     AND r.team_pk         = ss.team_pk
)
SELECT
    ss.season_year,
    ss.poll_name,
    ss.team_pk,
    ss.team_name,
    ss.team_abbreviation,
    ss.best_rank,
    fr.final_rank,
    (fr.final_rank - ss.best_rank) AS collapse_index,
    CASE
        WHEN fr.final_rank = 26 THEN 'Unranked'
        ELSE 'Ranked'
    END AS final_status
FROM season_stats ss
JOIN final_ranks fr
  ON ss.season_year = fr.season_year
 AND ss.poll_name   = fr.poll_name
 AND ss.team_pk     = fr.team_pk
ORDER BY ss.poll_name DESC, ss.season_year, collapse_index DESC;
