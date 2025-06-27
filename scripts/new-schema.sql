-- New clean schema for Rudder app
-- This consolidates tasks, time_blocks, and schedule_completions into a single tasks table

-- 1. Create values table (unchanged - this is already clean)
CREATE TABLE IF NOT EXISTS values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Create goals table (simplified)
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  value_id UUID REFERENCES values(id) ON DELETE CASCADE,
  target_by DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. Create unified tasks table (this replaces tasks, time_blocks, and schedule_completions)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Scheduling fields (from time_blocks)
  start_time TIME,
  end_time TIME,
  recur TEXT CHECK (recur IN ('once', 'daily', 'weekdays', 'custom')),
  custom_days INTEGER[], -- [0,1,2,3,4,5,6] where 0=Sunday
  event_date DATE, -- for one-time events
  
  -- Completion tracking (unified)
  is_done BOOLEAN DEFAULT FALSE,
  completion_status TEXT CHECK (completion_status IN ('completed', 'skipped', 'failed')),
  
  -- Relationships
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  
  -- Metadata
  date DATE NOT NULL, -- the specific date this task instance is for
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recur ON tasks(recur);
CREATE INDEX IF NOT EXISTS idx_tasks_is_done ON tasks(is_done);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_value_id ON goals(value_id);

CREATE INDEX IF NOT EXISTS idx_values_user_id ON values(user_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE values ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Values policies
CREATE POLICY "Users can view their own values" ON values
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own values" ON values
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own values" ON values
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own values" ON values
  FOR DELETE USING (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can view their own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can view their own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE values;
ALTER PUBLICATION supabase_realtime ADD TABLE goals;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- 8. Add comments for documentation
COMMENT ON TABLE values IS 'Core values that guide user behavior and goal setting';
COMMENT ON TABLE goals IS 'Goals that align with user values and drive task creation';
COMMENT ON TABLE tasks IS 'Unified table for all tasks - both scheduled and unscheduled, with completion tracking';
COMMENT ON COLUMN tasks.date IS 'The specific date this task instance is for (for recurring tasks, each day gets its own record)';
COMMENT ON COLUMN tasks.start_time IS 'Start time for scheduled tasks (NULL for unscheduled tasks)';
COMMENT ON COLUMN tasks.end_time IS 'End time for scheduled tasks (NULL for unscheduled tasks)';
COMMENT ON COLUMN tasks.recur IS 'Recurrence pattern: once, daily, weekdays, or custom';
COMMENT ON COLUMN tasks.custom_days IS 'Array of day numbers (0=Sunday, 1=Monday, etc.) for custom recurrence';
COMMENT ON COLUMN tasks.event_date IS 'Specific date for one-time scheduled events'; 