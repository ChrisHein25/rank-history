# Export database views as JSON. Run from top level dir.

# All time ranking stats
sqlite3 database/data/college.db -json "SELECT * FROM v_team_alltime_summary;" > frontend/data/alltime_summary.json

# Overrated Index
sqlite3 database/data/college.db -json "SELECT * FROM v_team_overrated_index;" > frontend/data/overrated.json
sqlite3 database/data/college.db -json "SELECT * FROM v_team_overrated_index_stats;" > frontend/data/overrated_stats.json

# Collapse Index
sqlite3 database/data/college.db -json "SELECT * FROM v_team_collapse_index;" > frontend/data/collapse.json
sqlite3 database/data/college.db -json "SELECT * FROM v_team_collapse_index_stats;" > frontend/data/collapse_stats.json
