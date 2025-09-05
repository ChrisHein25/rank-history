DROP VIEW IF EXISTS v_team_alltime_summary;

CREATE VIEW v_team_alltime_summary AS
SELECT
    p.poll_name,
    t.team_pk,
    t.team_name,
    t.team_abbreviation,

    -- Total weeks ranked
    COUNT(DISTINCT s.season_year || '-' || st.season_type_name || '-' || w.week_number) AS total_weeks_ranked,

    -- Weeks ranked #1
    COUNT(DISTINCT CASE
        WHEN r.ranking_current_rank = 1
        THEN s.season_year || '-' || st.season_type_name || '-' || w.week_number
    END) AS weeks_at_number_one,

    -- Weeks ranked Top 3
    COUNT(DISTINCT CASE
        WHEN r.ranking_current_rank <= 3
        THEN s.season_year || '-' || st.season_type_name || '-' || w.week_number
    END) AS weeks_in_top_3,

    -- Weeks ranked Top 10
    COUNT(DISTINCT CASE
        WHEN r.ranking_current_rank <= 10
        THEN s.season_year || '-' || st.season_type_name || '-' || w.week_number
    END) AS weeks_in_top_10

FROM ranking r
JOIN poll p
  ON r.ranking_poll_fk = p.poll_pk
JOIN team t
  ON r.ranking_team_fk = t.team_pk
JOIN week w
  ON r.ranking_week_fk = w.week_pk
JOIN season s
  ON w.week_season_fk = s.season_pk
JOIN season_type st
  ON w.week_season_type_fk = st.season_type_pk
WHERE r.ranking_current_rank IS NOT NULL
GROUP BY p.poll_name, t.team_pk, t.team_name, t.team_abbreviation
ORDER BY p.poll_name, total_weeks_ranked DESC;
