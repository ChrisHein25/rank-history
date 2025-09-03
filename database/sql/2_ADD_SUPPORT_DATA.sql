-- Insert polls in order of ESPN poll type
INSERT INTO poll (poll_pk, poll_name) VALUES
  (1, 'AP Top 25'),
  (2, 'AFCA Coaches Poll'),
  (11, 'AFCA Division II Coaches Poll'),
  (12, 'AFCA Division III Coaches Poll'),
  (20, 'FCS Coaches Poll'),
  (21, 'Playoff Committee Rankings'),
  (22, 'College Football Playoff Seedings');

-- Insert season types according to ESPN
INSERT INTO season_type (season_type_pk, season_type_name, season_type_description) VALUES
  (1, 'Preseason', 'Preseason games'),
  (2, 'Regular',   'Regular season games'),
  (3, 'Postseason','Bowls, playoff, or championships');
