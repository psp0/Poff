-- 1. 사용자 서식지 테이블 (현재 위치 및 이동 제한)
CREATE TABLE IF NOT EXISTS user_habitats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  -- 현재 대분류 서식지 (cave, forest, grassland, mountain, roughterrain, sea, urban, watersedge, random)
  current_habitat VARCHAR(50) NOT NULL DEFAULT 'random',
  -- 현재 세부 서식지 (habitat + type 조합, 예: grassland_bug, cave_dark)
  current_sub_habitat VARCHAR(100) DEFAULT NULL,
  -- 마지막 대분류 서식지 이동 시각 (04:00에 리셋)
  last_habitat_change_at TIMESTAMP NULL,
  -- 생성/수정 시각
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_current_habitat (current_habitat)
);

-- 2. 기존 사용자들에게 기본 서식지 할당
INSERT INTO user_habitats (user_id, current_habitat)
SELECT id, 'random' FROM users
ON DUPLICATE KEY UPDATE user_id = user_id;
