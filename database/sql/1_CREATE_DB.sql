-- Schools
CREATE TABLE school (
    school_pk INTEGER PRIMARY KEY AUTOINCREMENT,
    school_name TEXT NOT NULL
);

-- Teams
CREATE TABLE team (
    team_pk INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    team_school_fk INTEGER NOT NULL,
    team_abbreviation TEXT NOT NULL,
    FOREIGN KEY (team_school_fk) REFERENCES school(school_pk)
);

-- Polls
CREATE TABLE poll (
    poll_pk INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_name TEXT NOT NULL
);

-- Seasons (e.g., 2024, 2025)
CREATE TABLE season (
    season_pk INTEGER PRIMARY KEY AUTOINCREMENT,
    season_year INTEGER NOT NULL,
    season_description TEXT
);

-- Season Type (e.g., 2024, 2025)
CREATE TABLE season_type (
    season_type_pk INTEGER PRIMARY KEY AUTOINCREMENT,
    season_type_name TEXT NOT NULL,
    season_type_description TEXT
);

-- Weeks (linked to season)
CREATE TABLE week (
    week_pk INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number INTEGER NOT NULL,
    week_season_fk INTEGER NOT NULL,
    week_season_type_fk INTEGER NOT NULL,
--    start_date DATE,
--    end_date DATE,
    FOREIGN KEY (week_season_fk) REFERENCES season(season_pk),
    FOREIGN KEY (week_season_type_fk) REFERENCES season_type(season_type_pk)
);

-- Rankings (AP, Coaches, CFP, etc.)
CREATE TABLE ranking (
    ranking_pk INTEGER PRIMARY KEY AUTOINCREMENT,
    ranking_poll_fk INTEGER NOT NULL,
    ranking_week_fk INTEGER NOT NULL,
    ranking_team_fk INTEGER NOT NULL,
    ranking_current_rank INTEGER NOT NULL,
    ranking_points INTEGER,
    ranking_first_place_votes INTEGER,
    ranking_record_wins INTEGER,
    ranking_record_losses INTEGER,
    ranking_trend INTEGER,
    FOREIGN KEY (ranking_poll_fk) REFERENCES poll(poll_pk),
    FOREIGN KEY (ranking_week_fk) REFERENCES week(week_pk),
    FOREIGN KEY (ranking_team_fk) REFERENCES team(team_pk)
);
