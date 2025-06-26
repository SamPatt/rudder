-- Add date column to tasks table for per-day tracking
-- This allows recurring tasks to be tracked per day for analytics

-- Add date column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Add index for better performance when querying by date
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);

-- Add unique constraint on (title, date) to prevent duplicate tasks on the same day
-- This will be added after data cleanup to avoid conflicts
-- ALTER TABLE tasks ADD CONSTRAINT unique_task_title_date UNIQUE (title, date);

-- Add comment to explain the new field
COMMENT ON COLUMN tasks.date IS 'The date this task instance is scheduled for (for recurring tasks, this tracks each day separately)'; 