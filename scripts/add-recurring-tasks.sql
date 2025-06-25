-- Add recurring task support to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recur_type VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_days INTEGER[] DEFAULT NULL;

-- Add comment to explain the new fields
COMMENT ON COLUMN tasks.is_recurring IS 'Whether this task should appear daily';
COMMENT ON COLUMN tasks.recur_type IS 'Type of recurrence: daily, weekdays, weekly, custom';
COMMENT ON COLUMN tasks.custom_days IS 'Array of day numbers (0-6) for custom recurrence';

-- Create index for better performance when querying recurring tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring);
CREATE INDEX IF NOT EXISTS idx_tasks_recur_type ON tasks(recur_type); 