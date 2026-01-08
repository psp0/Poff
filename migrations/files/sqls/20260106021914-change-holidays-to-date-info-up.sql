DROP TABLE IF EXISTS holidays;

CREATE TABLE date_info (
  id BIGINT AUTO_INCREMENT NOT NULL,
  date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('holiday', 'solar_term') NOT NULL COMMENT '기념일 타입',
  is_holiday BOOLEAN NOT NULL DEFAULT FALSE COMMENT '공휴일 여부',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY date_info_unique (date, name),
  INDEX idx_date_info_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
