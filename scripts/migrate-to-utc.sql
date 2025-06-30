-- Migration script to convert time fields to UTC timestamps
-- This changes start_time and end_time from TIME to TIMESTAMP WITH TIME ZONE

-- First, let's add new UTC timestamp columns
ALTER TABLE tasks ADD COLUMN start_time_utc TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN end_time_utc TIMESTAMP WITH TIME ZONE;

ALTER TABLE task_templates ADD COLUMN start_time_utc TIMESTAMP WITH TIME ZONE;
ALTER TABLE task_templates ADD COLUMN end_time_utc TIMESTAMP WITH TIME ZONE;

-- Update existing data to convert local times to UTC
-- For now, we'll assume existing times are in Detroit timezone (UTC-4 or UTC-5)
-- This is a simplified conversion - in practice, you'd want to handle DST properly

-- Convert existing task times to UTC
UPDATE tasks 
SET 
  start_time_utc = CASE 
    WHEN start_time IS NOT NULL THEN 
      (date || ' ' || start_time)::timestamp AT TIME ZONE 'America/Detroit' AT TIME ZONE 'UTC'
    ELSE NULL 
  END,
  end_time_utc = CASE 
    WHEN end_time IS NOT NULL THEN 
      (date || ' ' || end_time)::timestamp AT TIME ZONE 'America/Detroit' AT TIME ZONE 'UTC'
    ELSE NULL 
  END
WHERE start_time IS NOT NULL OR end_time IS NOT NULL;

-- Convert existing template times to UTC
UPDATE task_templates 
SET 
  start_time_utc = CASE 
    WHEN start_time IS NOT NULL THEN 
      ('2000-01-01 ' || start_time)::timestamp AT TIME ZONE 'America/Detroit' AT TIME ZONE 'UTC'
    ELSE NULL 
  END,
  end_time_utc = CASE 
    WHEN end_time IS NOT NULL THEN 
      ('2000-01-01 ' || end_time)::timestamp AT TIME ZONE 'America/Detroit' AT TIME ZONE 'UTC'
    ELSE NULL 
  END
WHERE start_time IS NOT NULL OR end_time IS NOT NULL;

-- Drop the old time columns
ALTER TABLE tasks DROP COLUMN start_time;
ALTER TABLE tasks DROP COLUMN end_time;

ALTER TABLE task_templates DROP COLUMN start_time;
ALTER TABLE task_templates DROP COLUMN end_time;

-- Rename the new columns to the original names
ALTER TABLE tasks RENAME COLUMN start_time_utc TO start_time;
ALTER TABLE tasks RENAME COLUMN end_time_utc TO end_time;

ALTER TABLE task_templates RENAME COLUMN start_time_utc TO start_time;
ALTER TABLE task_templates RENAME COLUMN end_time_utc TO end_time;

-- Update indexes
DROP INDEX IF EXISTS idx_tasks_start_time;
CREATE INDEX idx_tasks_start_time ON tasks(start_time);
CREATE INDEX idx_tasks_end_time ON tasks(end_time);

-- Add comments
COMMENT ON COLUMN tasks.start_time IS 'Start time in UTC';
COMMENT ON COLUMN tasks.end_time IS 'End time in UTC';
COMMENT ON COLUMN task_templates.start_time IS 'Start time in UTC';
COMMENT ON COLUMN task_templates.end_time IS 'End time in UTC';

-- Verify the migration
SELECT 'Migration completed. Sample data:' as info;
SELECT id, title, start_time, end_time, date FROM tasks LIMIT 5; 