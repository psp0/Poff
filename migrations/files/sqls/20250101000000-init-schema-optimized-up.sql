-- ==========================================
-- 1. 사용자 관련 테이블
-- ==========================================

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  firebase_uid VARCHAR(255) UNIQUE NULL,
  terms_agreed_at TIMESTAMP NULL DEFAULT NULL COMMENT '약관 동의 일시',
  INDEX idx_users_email (email),
  INDEX idx_users_active (is_active),
  INDEX idx_users_firebase_uid (firebase_uid),
  INDEX idx_users_terms_agreed (terms_agreed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 2. 포켓몬 관련 테이블
-- ==========================================

CREATE TABLE pokemon (
  pokemon_id BIGINT AUTO_INCREMENT NOT NULL,
  name VARCHAR(255),
  category VARCHAR(255),
  type1 VARCHAR(50),
  type2 VARCHAR(50),
  type1_en VARCHAR(50),
  type2_en VARCHAR(50),
  pokedex TEXT,
  generation SMALLINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  habitat VARCHAR(255),
  habitat_en VARCHAR(100),
  height DECIMAL(5,2),
  weight DECIMAL(6,2),
  base_hp SMALLINT,
  base_attack SMALLINT,
  base_defense SMALLINT,
  base_sp_attack SMALLINT,
  base_sp_defense SMALLINT,
  base_speed SMALLINT,
  base_stat_total SMALLINT,
  image_name VARCHAR(255) NOT NULL DEFAULT '',
  form_suffix VARCHAR(50),
  asset_source ENUM('base', 'external') NOT NULL DEFAULT 'base',
  has_icon BOOLEAN NOT NULL DEFAULT FALSE,
  has_icon_shiny BOOLEAN NOT NULL DEFAULT FALSE,
  has_front BOOLEAN NOT NULL DEFAULT FALSE,
  has_front_shiny BOOLEAN NOT NULL DEFAULT FALSE,
  has_back BOOLEAN NOT NULL DEFAULT FALSE,
  has_back_shiny BOOLEAN NOT NULL DEFAULT FALSE,
  has_cry BOOLEAN NOT NULL DEFAULT FALSE,
  back_animation_speed TINYINT DEFAULT 2,
  front_animation_speed TINYINT DEFAULT 2,
  stable_id VARCHAR(255) GENERATED ALWAYS AS (
    CASE 
      WHEN form_suffix IS NULL THEN image_name
      ELSE CONCAT(image_name, form_suffix)
    END
  ) STORED NOT NULL,
  PRIMARY KEY (pokemon_id),
  UNIQUE KEY pokemon_stable_id_unique (stable_id),
  INDEX idx_pokemon_image_name (image_name),
  INDEX idx_pokemon_stable_id (stable_id),
  INDEX idx_pokemon_generation (generation),
  FULLTEXT INDEX idx_pokemon_name_fulltext (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pokemon_flags (
  flag_id BIGINT AUTO_INCREMENT NOT NULL,
  name VARCHAR(255) NOT NULL UNIQUE,
  name_ko VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (flag_id),
  UNIQUE KEY pokemon_flags_name_unique (name),
  INDEX idx_pokemon_flags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pokemon_flag_relations (
  pokemon_stable_id VARCHAR(255) NOT NULL,
  flag_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pokemon_stable_id, flag_name),
  CONSTRAINT pokemon_flag_relations_stable_id_fkey FOREIGN KEY (pokemon_stable_id) 
    REFERENCES pokemon (stable_id) ON DELETE CASCADE,
  CONSTRAINT pokemon_flag_relations_flag_name_fkey FOREIGN KEY (flag_name) 
    REFERENCES pokemon_flags (name) ON DELETE CASCADE,
  INDEX idx_pokemon_flag_relations_stable_id (pokemon_stable_id),
  INDEX idx_pokemon_flag_relations_flag_name (flag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pokemon_evolutions (
  evolution_id BIGINT AUTO_INCREMENT NOT NULL,
  from_pokemon VARCHAR(255) NOT NULL,
  to_pokemon VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (evolution_id),
  UNIQUE KEY pokemon_evolutions_unique (from_pokemon, to_pokemon),
  INDEX idx_pokemon_evolutions_from (from_pokemon),
  INDEX idx_pokemon_evolutions_to (to_pokemon)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 3. 사용자 포켓몬 컬렉션
-- ==========================================

CREATE TABLE user_pokemon_collection (
  collection_id BIGINT AUTO_INCREMENT NOT NULL,
  user_id CHAR(36) NOT NULL,
  pokemon_stable_id VARCHAR(255) NOT NULL,
  is_shiny BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  favorited_at TIMESTAMP NULL DEFAULT NULL,
  obtained_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  obtained_reason TEXT,
  PRIMARY KEY (collection_id),
  UNIQUE KEY user_pokemon_collection_user_stable_shiny_key (user_id, pokemon_stable_id, is_shiny),
  CONSTRAINT user_pokemon_collection_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_pokemon_collection_stable_id_fkey FOREIGN KEY (pokemon_stable_id) 
    REFERENCES pokemon (stable_id) ON DELETE CASCADE,
  INDEX idx_user_pokemon_collection_user_id (user_id),
  INDEX idx_user_pokemon_collection_pokemon_id (pokemon_stable_id),
  INDEX idx_user_pokemon_collection_user_favorite (user_id, is_favorite),
  INDEX idx_user_pokemon_collection_user_obtained (user_id, obtained_date DESC),
  INDEX idx_user_pokemon_favorite_sorted (user_id, is_favorite DESC, favorited_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 4. 스크린타임 관련 테이블
-- ==========================================

CREATE TABLE screen_time (
  id BIGINT AUTO_INCREMENT NOT NULL,
  user_id CHAR(36) NOT NULL,
  date DATE NOT NULL,
  usage_hours INTEGER NOT NULL,
  usage_minutes INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY screen_time_user_date_key (user_id, date),
  CONSTRAINT screen_time_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT screen_time_usage_minutes_check CHECK (usage_minutes >= 0 AND usage_minutes < 60),
  CONSTRAINT screen_time_usage_hours_check CHECK (usage_hours >= 0 AND usage_hours <= 24),
  INDEX idx_screen_time_user_date (user_id, date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE screen_time_weekly_stats (
  stat_id BIGINT AUTO_INCREMENT NOT NULL,
  user_id CHAR(36) NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  avg_daily_minutes DECIMAL(10,2) NOT NULL,
  total_days_logged INTEGER NOT NULL,
  total_minutes INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (stat_id),
  UNIQUE KEY screen_time_weekly_stats_user_week_key (user_id, week_start_date),
  CONSTRAINT screen_time_weekly_stats_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT screen_time_weekly_stats_days_check CHECK (total_days_logged >= 1 AND total_days_logged <= 7),
  INDEX idx_screen_time_weekly_stats_user_date (user_id, week_start_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 5. 운동 관련 테이블
-- ==========================================

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

-- ==========================================
-- 6. 보상 관련 테이블
-- ==========================================

CREATE TABLE reward_logs (
  log_id BIGINT AUTO_INCREMENT NOT NULL,
  user_id CHAR(36) NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  reward_date DATE NOT NULL,
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  CONSTRAINT reward_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_reward_logs_user_date (user_id, reward_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 7. 알(Egg) 시스템
-- ==========================================

CREATE TABLE user_eggs (
  egg_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  pokemon_stable_id VARCHAR(255) NOT NULL,
  slot_index INTEGER NOT NULL,
  obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hatch_at TIMESTAMP NOT NULL,
  is_hatched BOOLEAN DEFAULT FALSE,
  UNIQUE KEY user_eggs_user_slot_unique (user_id, slot_index),
  CONSTRAINT user_eggs_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_eggs_pokemon_fkey FOREIGN KEY (pokemon_stable_id) 
    REFERENCES pokemon (stable_id) ON DELETE CASCADE,
  CONSTRAINT user_eggs_slot_check CHECK (slot_index >= 0 AND slot_index <= 2),
  INDEX idx_user_eggs_user_id (user_id),
  INDEX idx_user_eggs_hatch_at (hatch_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 8. 아이템 시스템
-- ==========================================

CREATE TABLE items (
  item_id BIGINT AUTO_INCREMENT NOT NULL,
  name VARCHAR(255) NOT NULL UNIQUE,
  name_ko VARCHAR(255),
  description TEXT,
  image_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  UNIQUE KEY items_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_items (
  user_item_id BIGINT AUTO_INCREMENT NOT NULL,
  user_id CHAR(36) NOT NULL,
  item_id BIGINT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_item_id),
  UNIQUE KEY user_items_user_item_key (user_id, item_id),
  CONSTRAINT user_items_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_items_item_id_fkey FOREIGN KEY (item_id) 
    REFERENCES items (item_id) ON DELETE CASCADE,
  INDEX idx_user_items_user_id (user_id),
  INDEX idx_user_items_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 9. 공휴일 테이블
-- ==========================================

CREATE TABLE holidays (
  holiday_id BIGINT AUTO_INCREMENT NOT NULL,
  holiday_date DATE NOT NULL UNIQUE,
  name_ko VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (holiday_id),
  INDEX idx_holidays_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 10. 뷰 (Views)
-- ==========================================

CREATE VIEW v_user_collection_summary AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(upc.collection_id) as total_pokemon,
  SUM(CASE WHEN upc.is_shiny THEN 1 ELSE 0 END) as shiny_pokemon,
  SUM(CASE WHEN upc.is_favorite THEN 1 ELSE 0 END) as favorite_pokemon,
  MAX(upc.obtained_date) as last_obtained
FROM users u
LEFT JOIN user_pokemon_collection upc ON u.id = upc.user_id
GROUP BY u.id, u.email;

CREATE VIEW v_weekly_activity_summary AS
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

-- ==========================================
-- 11. Stored Procedures
-- ==========================================

CREATE PROCEDURE sync_user_by_firebase(
  IN p_firebase_uid VARCHAR(255),
  IN p_email VARCHAR(255),
  IN p_username VARCHAR(100),
  OUT p_user_id CHAR(36)
)
BEGIN
  DECLARE v_user_id CHAR(36);
  
  SELECT id INTO v_user_id
  FROM users
  WHERE firebase_uid = p_firebase_uid
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    INSERT INTO users (firebase_uid, email, username, password_hash, is_active)
    VALUES (p_firebase_uid, p_email, p_username, '', TRUE);
    
    SET v_user_id = LAST_INSERT_ID();
    
    INSERT INTO user_items (user_id, item_id, quantity)
    SELECT v_user_id, item_id, 5
    FROM items
    WHERE name = 'Round Charm';
  ELSE
    UPDATE users
    SET email = p_email,
        username = COALESCE(p_username, username),
        last_login = CURRENT_TIMESTAMP
    WHERE id = v_user_id;
  END IF;
  
  SET p_user_id = v_user_id;
END;

-- ==========================================
-- 12. 초기 데이터 삽입
-- ==========================================

-- 근육 그룹 초기 데이터
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

-- 아이템 초기 데이터 삽입
INSERT INTO items (name, name_ko, description, image_name) VALUES
('Rare Candy', '이상한 사탕', '포켓몬 진화를 돕는 이상한 사탕', 'RARECANDY'),
('Oval Charm', '둥근부적', '포켓몬 알을 찾아내는 부적', 'OVALCHARM'),
('Shiny Charm', '빛나는 부적', '이로치 포켓몬을 얻는 부적', 'SHINYCHARM'),
('Brilliance Charm', '광휘의 부적', '희귀한 이로치 포켓몬을 얻는 부적', 'BRILLIANCECHARM'),
('Mystic Charm', '신비의 부적', '다른 폼으로 변화시키는 부적', 'MYSTICCHARM'),
('Awakening Charm', '각성의 부적', '희귀한 포켓몬을 다른 폼으로 변환하는 부적', 'AWAKENINGCHARM')
ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko), description = VALUES(description);

-- ==========================================
-- 13. 게스트 유저 (읽기 전용 데모 계정)
-- ==========================================
INSERT INTO users (id, email, password_hash, username, is_active, terms_agreed_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'guest@pokehabit.local',
  '',
  '체험모드',
  TRUE,
  CURRENT_TIMESTAMP
) ON DUPLICATE KEY UPDATE username = '체험모드';
