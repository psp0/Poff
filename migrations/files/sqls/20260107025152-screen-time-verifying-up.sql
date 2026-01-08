-- ==========================================
-- 주간 스크린타임 검증 시스템
-- ==========================================
-- 목적: 매주 일요일마다 사용자가 입력한 전주 평균과 DB 기록 평균을 비교하여 검증
-- 주 기준: 일요일(week_start_date) ~ 토요일(week_end_date)

ALTER TABLE screen_time_weekly_stats 
ADD COLUMN user_input_average INTEGER DEFAULT NULL 
  COMMENT '사용자가 입력한 주간 평균 스크린타임(분)',
  
ADD COLUMN verified BOOLEAN DEFAULT FALSE 
  COMMENT '검증 완료 여부. TRUE: 검증 완료, FALSE: 미검증',
  
ADD COLUMN warning_count INTEGER DEFAULT 0 
  COMMENT '경고 횟수 (0~3). 3회 도달 시 포켓몬 삭제 후 0으로 리셋',
  
ADD COLUMN penalty_applied BOOLEAN DEFAULT FALSE 
  COMMENT '페널티 적용 여부. TRUE: 해당 주 포켓몬 삭제됨',
  
ADD COLUMN verified_at TIMESTAMP NULL 
  COMMENT '검증 완료 시각',
  
ADD CONSTRAINT check_warning_count 
  CHECK (warning_count >= 0 AND warning_count <= 3);

-- 인덱스 추가: 검증 상태 조회 최적화
CREATE INDEX idx_screen_time_weekly_verified 
  ON screen_time_weekly_stats(user_id, verified, week_start_date DESC);
