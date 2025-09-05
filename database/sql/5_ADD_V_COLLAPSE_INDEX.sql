DROP VIEW IF EXISTS v_team_season_collapse_index;

CREATE VIEW v_team_season_collapse_index AS
WITH ranks_in_poll AS (
    SELECT
        s.season_year,
        p.poll_pk,
        p.poll_name,
        t.team_pk,
        t.team_name,
        t.team_abbreviation,
        w.week_pk,
        w.week_number,
        r.ranking_current_rank
    FROM ranking r
    JOIN team t   ON r.ranking_team_fk = t.team_pk
    JOIN week w   ON r.ranking_week_fk = w.week_pk
    JOIN season s ON w.week_season_fk  = s.season_pk
    JOIN poll p   ON r.ranking_poll_fk = p.poll_pk
),
season_stats AS (  -- best rank across ALL season types
    SELECT
        season_year,
        poll_pk,
        poll_name,
        team_pk,
        team_name,
        team_abbreviation,
        MIN(ranking_current_rank) AS best_rank
    FROM ranks_in_poll
    WHERE ranking_current_rank IS NOT NULL
    GROUP BY season_year, poll_pk, poll_name, team_pk, team_name, team_abbreviation
),
last_week_by_poll AS (  -- absolute latest week across ALL types
    SELECT
        season_year,
        poll_pk,
        poll_name,
        MAX(week_pk) AS last_week_pk
    FROM ranks_in_poll
    GROUP BY season_year, poll_pk, poll_name
),
-- Deduplicate any duplicate ranking rows per (team, poll, week)
rank_rows_dedup AS (
    SELECT
        r.ranking_team_fk AS team_pk,
        r.ranking_poll_fk AS poll_pk,
        r.ranking_week_fk AS week_pk,
        r.ranking_current_rank,
        r.ranking_pk,
        ROW_NUMBER() OVER (
            PARTITION BY r.ranking_team_fk, r.ranking_poll_fk, r.ranking_week_fk
            ORDER BY r.ranking_pk DESC
        ) AS rn
    FROM ranking r
),
final_week_info AS (  -- season type + week number of the final week
    SELECT
        lw.season_year,
        lw.poll_pk,
        lw.poll_name,
        lw.last_week_pk,
        st.season_type_name AS final_season_type_name,
        w.week_number       AS final_week_number
    FROM last_week_by_poll lw
    JOIN week w         ON w.week_pk = lw.last_week_pk
    JOIN season_type st ON st.season_type_pk = w.week_season_type_fk
),
final_ranks AS (  -- one final rank per team (or 26 if unranked)
    SELECT
        ss.season_year,
        ss.poll_pk,
        ss.poll_name,
        ss.team_pk,
        COALESCE(rr.ranking_current_rank, 26) AS final_rank
    FROM season_stats ss
    JOIN last_week_by_poll lw
      ON ss.season_year = lw.season_year
     AND ss.poll_pk     = lw.poll_pk
    LEFT JOIN rank_rows_dedup rr
      ON rr.poll_pk = ss.poll_pk
     AND rr.week_pk = lw.last_week_pk
     AND rr.team_pk = ss.team_pk
     AND rr.rn = 1
),
best_weeks AS (  -- earliest week where best_rank occurred
    SELECT
        ss.season_year,
        ss.poll_pk,
        ss.team_pk,
        MIN(ri.week_number) AS best_week_number
    FROM season_stats ss
    JOIN ranks_in_poll ri
      ON ri.season_year = ss.season_year
     AND ri.poll_pk     = ss.poll_pk
     AND ri.team_pk     = ss.team_pk
    JOIN rank_rows_dedup rr
      ON rr.team_pk = ri.team_pk
     AND rr.poll_pk = ri.poll_pk
     AND rr.week_pk = ri.week_pk
     AND rr.rn = 1
    WHERE ri.ranking_current_rank = ss.best_rank
    GROUP BY ss.season_year, ss.poll_pk, ss.team_pk
),
last_ranked_weeks AS (  -- last week they were still ranked
    SELECT
        ss.season_year,
        ss.poll_pk,
        ss.team_pk,
        MAX(ri.week_number) AS last_ranked_week_number
    FROM season_stats ss
    JOIN ranks_in_poll ri
      ON ri.season_year = ss.season_year
     AND ri.poll_pk     = ss.poll_pk
     AND ri.team_pk     = ss.team_pk
    JOIN rank_rows_dedup rr
      ON rr.team_pk = ri.team_pk
     AND rr.poll_pk = ri.poll_pk
     AND rr.week_pk = ri.week_pk
     AND rr.rn = 1
    WHERE ri.ranking_current_rank IS NOT NULL
    GROUP BY ss.season_year, ss.poll_pk, ss.team_pk
)
SELECT
    ss.season_year,
    ss.poll_name,
    ss.team_pk,
    ss.team_name,
    ss.team_abbreviation,
    ss.best_rank,
    bw.best_week_number,
    fr.final_rank,
    (fr.final_rank - ss.best_rank) AS collapse_index,
    CASE WHEN fr.final_rank = 26 THEN 'Unranked' ELSE 'Ranked' END AS final_status,
    fwi.final_season_type_name,
    fwi.final_week_number,
    CASE
        WHEN fr.final_rank = 26 THEN lrw.last_ranked_week_number + 1
        ELSE fwi.final_week_number
    END AS bottom_week_number
FROM season_stats ss
JOIN final_ranks fr
  ON ss.season_year = fr.season_year
 AND ss.poll_pk     = fr.poll_pk
 AND ss.team_pk     = fr.team_pk
JOIN final_week_info fwi
  ON ss.season_year = fwi.season_year
 AND ss.poll_pk     = fwi.poll_pk
JOIN best_weeks bw
  ON ss.season_year = bw.season_year
 AND ss.poll_pk     = bw.poll_pk
 AND ss.team_pk     = bw.team_pk
JOIN last_ranked_weeks lrw
  ON ss.season_year = lrw.season_year
 AND ss.poll_pk     = lrw.poll_pk
 AND ss.team_pk     = lrw.team_pk
ORDER BY ss.poll_name DESC, ss.season_year, collapse_index DESC;
