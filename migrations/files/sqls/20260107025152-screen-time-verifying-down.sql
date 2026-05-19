-- ==========================================
-- 주간 스크린타임 검증 시스템 롤백
-- ==========================================

-- 인덱스 삭제
DROP INDEX idx_screen_time_weekly_verified ON screen_time_weekly_stats;

-- 제약조건 삭제
ALTER TABLE screen_time_weekly_stats
DROP CONSTRAINT check_warning_count;

-- 컬럼 삭제 (역순)
ALTER TABLE screen_time_weekly_stats
DROP COLUMN verified_at,
DROP COLUMN penalty_applied,
DROP COLUMN warning_count,
DROP COLUMN verified,
DROP COLUMN user_input_average;
