-- Re-create tables
CREATE TABLE muscle_groups (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(50) NOT NULL UNIQUE,
  name_ko VARCHAR(50) NOT NULL,
  mv_sets INTEGER NOT NULL,
  mev_sets INTEGER NOT NULL,
  mav_min_sets INTEGER NOT NULL,
  mav_max_sets INTEGER NOT NULL,
  mrv_sets INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_muscle_groups_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_exercises (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  muscle_group_id CHAR(36) NOT NULL,
  exercise_name VARCHAR(100) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  intensity_type ENUM('reps', 'rpe') DEFAULT 'reps',
  reps INTEGER NULL,
  rpe DECIMAL(3,1) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT user_exercises_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_exercises_muscle_group_id_fkey FOREIGN KEY (muscle_group_id) 
    REFERENCES muscle_groups (id) ON DELETE CASCADE,
  INDEX idx_user_exercises_user_id (user_id),
  INDEX idx_user_exercises_muscle_group (muscle_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_exercise_defaults (
  default_id BIGINT AUTO_INCREMENT NOT NULL,
  user_id CHAR(36) NOT NULL,
  exercise_id CHAR(36) NOT NULL,
  default_weight_kg DECIMAL(5,2),
  default_intensity_type ENUM('reps', 'rpe') DEFAULT 'reps',
  default_reps INTEGER NULL,
  default_rpe DECIMAL(3,1) NULL,
  default_sets INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (default_id),
  UNIQUE KEY user_exercise_defaults_user_exercise_key (user_id, exercise_id),
  CONSTRAINT user_exercise_defaults_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_exercise_defaults_exercise_id_fkey FOREIGN KEY (exercise_id) 
    REFERENCES user_exercises (id) ON DELETE CASCADE,
  INDEX idx_user_exercise_defaults_user_id (user_id),
  INDEX idx_user_exercise_defaults_exercise_id (exercise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exercise_sessions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  exercise_id CHAR(36) NOT NULL,
  sets_completed INTEGER NOT NULL,
  session_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exercise_sessions_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT exercise_sessions_exercise_id_fkey FOREIGN KEY (exercise_id) 
    REFERENCES user_exercises (id) ON DELETE CASCADE,
  CONSTRAINT exercise_sessions_sets_check CHECK (sets_completed > 0),
  INDEX idx_exercise_sessions_user_date (user_id, session_date),
  INDEX idx_exercise_sessions_exercise_id (exercise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exercise_motivation_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  muscle_group_id CHAR(36) NOT NULL,
  motivation_type VARCHAR(50) NOT NULL,
  current_sets INTEGER NOT NULL,
  target_sets INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exercise_motivation_logs_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT exercise_motivation_logs_muscle_group_id_fkey FOREIGN KEY (muscle_group_id) 
    REFERENCES muscle_groups (id) ON DELETE CASCADE,
  INDEX idx_exercise_motivation_logs_user_id (user_id),
  INDEX idx_exercise_motivation_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Restore initial data
INSERT INTO muscle_groups (name, name_ko, mv_sets, mev_sets, mav_min_sets, mav_max_sets, mrv_sets) VALUES
('abs', '복근', 0, 0, 16, 20, 25),
('calves', '종아리', 0, 8, 12, 16, 20),
('biceps', '이두', 0, 8, 14, 20, 26),
('triceps', '삼두', 0, 6, 10, 14, 18),
('chest', '가슴', 0, 10, 12, 20, 22),
('back', '등', 8, 10, 14, 22, 25),
('front_delt', '전면 삼각근', 0, 0, 6, 8, 12),
('side_delt', '측면 삼각근', 6, 8, 16, 22, 26),
('rear_delt', '후면 삼각근', 0, 8, 16, 22, 26),
('traps', '승모근', 0, 0, 12, 20, 26),
('quad', '대퇴사두근', 6, 8, 12, 18, 20),
('hamstring', '햄스트링', 4, 6, 10, 16, 20),
('glutes', '둔근', 0, 0, 4, 12, 16)
ON DUPLICATE KEY UPDATE name = name;

-- Restore view
CREATE OR REPLACE VIEW v_weekly_activity_summary AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(DISTINCT st.date) as screen_time_days_logged,
  COUNT(DISTINCT es.session_date) as exercise_days_logged,
  COUNT(upc.collection_id) as pokemon_obtained_this_week
FROM users u
LEFT JOIN screen_time st ON u.id = st.user_id 
  AND st.date >= CURDATE() - INTERVAL 7 DAY
LEFT JOIN exercise_sessions es ON u.id = es.user_id 
  AND es.session_date >= CURDATE() - INTERVAL 7 DAY
LEFT JOIN user_pokemon_collection upc ON u.id = upc.user_id 
  AND upc.obtained_date >= CURDATE() - INTERVAL 7 DAY
GROUP BY u.id, u.email;
