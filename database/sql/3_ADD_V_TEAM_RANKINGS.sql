-- Create a holistic view of rankings across all metadata
DROP VIEW IF EXISTS v_team_rankings;

CREATE VIEW v_team_rankings AS
SELECT
    r.ranking_pk,
    s.season_year,
    st.season_type_name,
    w.week_number,
    p.poll_name,
    sc.school_name,
    t.team_name,
    t.team_abbreviation,
    r.ranking_current_rank,
    r.ranking_points,
    r.ranking_first_place_votes,
    r.ranking_record_wins,
    r.ranking_record_losses,
    r.ranking_trend
FROM ranking r
JOIN poll p ON r.ranking_poll_fk = p.poll_pk
JOIN week w ON r.ranking_week_fk = w.week_pk
JOIN season s ON w.week_season_fk = s.season_pk
JOIN season_type st ON w.week_season_type_fk = st.season_type_pk
JOIN team t ON r.ranking_team_fk = t.team_pk
JOIN school sc ON t.team_school_fk = sc.school_pk;
