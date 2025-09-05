DROP VIEW IF EXISTS v_team_avg_collapse_last10yrs;

CREATE VIEW v_team_avg_collapse_index_last10yrs AS
SELECT
    poll_name,
    team_name,
    AVG(collapse_index) AS avg_collapse_index,
    COUNT(*) AS seasons_counted
FROM v_team_season_collapse_index
WHERE season_year >= strftime('%Y', 'now') - 10
GROUP BY poll_name, team_name
ORDER BY poll_name DESC, avg_collapse_index DESC;

DROP VIEW IF EXISTS v_team_avg_collapse;

CREATE VIEW v_team_avg_collapse_index AS
SELECT
    poll_name,
    team_name,
    AVG(collapse_index) AS avg_collapse_index,
    COUNT(*) AS seasons_counted
FROM v_team_season_collapse_index
GROUP BY poll_name, team_name
ORDER BY poll_name DESC, avg_collapse_index DESC;

