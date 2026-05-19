-- Drop tables in reverse order of dependency
DROP TABLE IF EXISTS exercise_motivation_logs;
DROP TABLE IF EXISTS exercise_sessions;
DROP TABLE IF EXISTS user_exercise_defaults;
DROP TABLE IF EXISTS user_exercises;
DROP TABLE IF EXISTS muscle_groups;

-- Update view to remove exercise related columns
CREATE OR REPLACE VIEW v_weekly_activity_summary AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(DISTINCT st.date) as screen_time_days_logged,
  COUNT(upc.collection_id) as pokemon_obtained_this_week
FROM users u
LEFT JOIN screen_time st ON u.id = st.user_id 
  AND st.date >= CURDATE() - INTERVAL 7 DAY
LEFT JOIN user_pokemon_collection upc ON u.id = upc.user_id 
  AND upc.obtained_date >= CURDATE() - INTERVAL 7 DAY
GROUP BY u.id, u.email;
