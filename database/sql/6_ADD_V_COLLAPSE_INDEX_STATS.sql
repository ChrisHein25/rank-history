DROP VIEW IF EXISTS v_team_collapse_index_stats;

CREATE VIEW v_team_collapse_index_stats AS
SELECT
    poll_name,
    team_name,
    AVG(collapse_index) AS avg_collapse_index,
--    POWER(AVG(collapse_index * collapse_index) - AVG(collapse_index) * AVG(collapse_index), 0.5) AS std_collapse_index,
    MIN(collapse_index) AS min_collapse_index,
    MAX(collapse_index) AS max_collapse_index,
    COUNT(*) AS seasons_counted
FROM v_team_collapse_index
GROUP BY poll_name, team_name
ORDER BY poll_name DESC, avg_collapse_index DESC;


DROP VIEW IF EXISTS v_team_collapse_index_stats_last10yrs;

CREATE VIEW v_team_collapse_index_stats_last10yrs AS
SELECT
    poll_name,
    team_name,
    AVG(collapse_index) AS avg_collapse_index,
--    POWER(AVG(collapse_index * collapse_index) - AVG(collapse_index) * AVG(collapse_index), 0.5) AS std_collapse_index,
    MIN(collapse_index) AS min_collapse_index,
    MAX(collapse_index) AS max_collapse_index,
    COUNT(*) AS seasons_counted
FROM v_team_collapse_index
WHERE season_year >= strftime('%Y', 'now') - 10
GROUP BY poll_name, team_name
ORDER BY poll_name DESC, avg_collapse_index DESC;


