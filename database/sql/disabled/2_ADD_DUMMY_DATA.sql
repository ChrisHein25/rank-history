-- Insert schools
INSERT INTO school (school_name) VALUES
  ('Ohio State'),
  ('Penn State'),
  ('LSU'),
  ('Georgia'),
  ('Miami'),
  ('Oregon'),
  ('Texas'),
  ('Clemson'),
  ('Notre Dame'),
  ('South Carolina'),
  ('Alabama'),
  ('Tennessee');

-- Insert teams
INSERT INTO team (team_name, team_school_fk, team_abbreviation) VALUES
  ('Buckeyes', 1, 'OSU'),
  ('Nittany Lions', 2, 'PSU'),
  ('Tigers', 3, 'LSU'),
  ('Bulldogs', 4, 'UGA'),
  ('Hurricanes', 5, 'MIA'),
  ('Ducks', 6, 'ORE'),
  ('Longhorns', 7, 'TEX'),
  ('Tigers', 8, 'CLEM'),
  ('Fighting Irish', 9, 'ND'),
  ('Gamecocks', 10, 'SC'),
  ('Crimson Tide', 11, 'BAMA'),
  ('Volunteers', 12, 'TENN');

-- Insert polls
INSERT INTO poll (poll_name) VALUES
  ('AP'),
  ('Coaches');

-- Insert 2024 season
INSERT INTO season (season_year, season_description) VALUES
  (2024, '2024 Regular Season');

-- Insert season types
INSERT INTO season_type (season_type_name, season_type_description) VALUES
  ('Regular', 'Regular season games'),
  ('Postseason', 'Bowls and Playoff');
