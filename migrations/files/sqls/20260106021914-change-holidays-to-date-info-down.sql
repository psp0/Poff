DROP TABLE IF EXISTS date_info;

CREATE TABLE holidays (
  holiday_id BIGINT AUTO_INCREMENT NOT NULL,
  holiday_date DATE NOT NULL UNIQUE,
  name_ko VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (holiday_id),
  INDEX idx_holidays_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
