-- sleep_logs 테이블에 보상 관련 컬럼 추가
-- sleep_date: 새벽 4시 기준으로 계산된 수면 날짜 (하루 1회 제한용)
-- reward_percentage: 계산된 보상 퍼센트 (0-100)
-- rewarded: 보상 지급 여부

ALTER TABLE sleep_logs
    ADD COLUMN sleep_date DATE NULL COMMENT '수면 날짜 (4AM 기준, 하루 1회 제한용)',
    ADD COLUMN reward_percentage DECIMAL(5,2) NULL COMMENT '보상 퍼센트 (0-100)',
    ADD COLUMN rewarded BOOLEAN DEFAULT FALSE COMMENT '보상 지급 여부',
    ADD UNIQUE INDEX idx_user_sleep_date (user_id, sleep_date);
