-- Insert a test recurring event created yesterday
INSERT INTO time_blocks (
  title,
  start_time,
  end_time,
  recur,
  custom_days,
  event_date,
  goal_id,
  created_at
) VALUES (
  'test recurring from yesterday',
  '14:00:00',
  '15:00:00',
  'daily',
  NULL,
  NULL,
  NULL,
  (CURRENT_DATE - INTERVAL '1 day')::timestamp
);

-- Verify the insertion
SELECT 
  title,
  start_time,
  end_time,
  recur,
  created_at,
  DATE(created_at) as creation_date
FROM time_blocks 
WHERE title = 'test recurring from yesterday'; 