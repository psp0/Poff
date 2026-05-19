-- Rollback sleep_logs table changes
ALTER TABLE sleep_logs
    DROP INDEX idx_user_sleep_date,
    DROP COLUMN rewarded,
    DROP COLUMN reward_percentage,
    DROP COLUMN sleep_date;
