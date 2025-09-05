DROP VIEW IF EXISTS v_team_overrated_index_stats;

CREATE VIEW v_team_overrated_index_stats AS
SELECT
    poll_name,
    team_name,
    AVG(overrated_index) AS avg_overrated_index,
--    SQRT(AVG(overrated_index * overrated_index) - AVG(overrated_index) * AVG(overrated_index)) AS std_overrated_index,
    MIN(overrated_index) AS min_overrated_index,
    MAX(overrated_index) AS max_overrated_index,
    COUNT(*) AS seasons_counted
FROM v_team_overrated_index
GROUP BY poll_name, team_name
ORDER BY poll_name DESC, avg_overrated_index DESC;


DROP VIEW IF EXISTS v_team_overrated_index_stats_last10yrs;

--CREATE VIEW v_team_overrated_index_stats_last10yrs AS
--SELECT
--    poll_name,
--    team_name,
--    AVG(overrated_index) AS avg_overrated_index,
----    SQRT(AVG(overrated_index * overrated_index) - AVG(overrated_index) * AVG(overrated_index)) AS std_overrated_index,
--    MIN(overrated_index) AS min_overrated_index,
--    MAX(overrated_index) AS max_overrated_index,
--    COUNT(*) AS seasons_counted
--FROM v_team_overrated_index
--WHERE season_year >= strftime('%Y', 'now') - 10
--GROUP BY poll_name, team_name
--ORDER BY poll_name DESC, avg_overrated_index DESC;

