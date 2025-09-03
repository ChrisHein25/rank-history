-- Weeks 1–3 for the 2024 Regular Season (season_pk = 1, season_type_pk = 1)
INSERT INTO week (week_number, week_season_fk, week_season_type_fk) VALUES
  (1, 1, 1),
  (2, 1, 1),
  (3, 1, 1);

-- Week 1 Rankings (AP Poll)
INSERT INTO ranking (ranking_poll_fk, ranking_week_fk, ranking_team_fk, ranking_current_rank, ranking_points, ranking_first_place_votes, ranking_record_wins, ranking_record_losses, ranking_trend) VALUES
  (1, 1, 1, 1, 1636, 55, 1, 0, 0),   -- Ohio State
  (1, 1, 2, 2, 1558, 0, 1, 0, 0),    -- Penn State
  (1, 1, 3, 3, 1514, 0, 1, 0, 0),    -- LSU
  (1, 1, 4, 4, 1410, 0, 1, 0, 0),    -- Georgia
  (1, 1, 5, 5, 1360, 0, 1, 0, 0);    -- Miami

-- Week 2 Rankings (AP Poll)
INSERT INTO ranking (ranking_poll_fk, ranking_week_fk, ranking_team_fk, ranking_current_rank, ranking_points, ranking_first_place_votes, ranking_record_wins, ranking_record_losses, ranking_trend) VALUES
  (1, 2, 1, 1, 1600, 50, 2, 0, 0),   -- Ohio State
  (1, 2, 3, 2, 1480, 0, 2, 0, 1),    -- LSU rises
  (1, 2, 5, 3, 1440, 0, 2, 0, 2),    -- Miami rises
  (1, 2, 2, 4, 1500, 0, 2, 0, -2),   -- Penn State slips
  (1, 2, 11, 21, 360, 0, 1, 1, -20); -- Alabama drops hard

-- Week 3 Rankings (AP Poll)
INSERT INTO ranking (ranking_poll_fk, ranking_week_fk, ranking_team_fk, ranking_current_rank, ranking_points, ranking_first_place_votes, ranking_record_wins, ranking_record_losses, ranking_trend) VALUES
  (1, 3, 1, 1, 1580, 48, 3, 0, 0),   -- Ohio State steady
  (1, 3, 3, 2, 1490, 0, 3, 0, 0),    -- LSU steady
  (1, 3, 5, 3, 1450, 0, 3, 0, 0),    -- Miami steady
  (1, 3, 2, 4, 1480, 0, 3, 0, 0),    -- Penn State steady
  (1, 3, 12, 22, 339, 0, 2, 1, -1);  -- Tennessee hovers
