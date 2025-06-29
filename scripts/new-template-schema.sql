-- New Template-Based Task System Schema
-- This creates the task_templates and tasks tables with proper relationships

-- Create task_templates table
CREATE TABLE task_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Recurrence settings
    recur_type TEXT NOT NULL CHECK (recur_type IN ('daily', 'weekdays', 'custom')),
    custom_days INTEGER[],
    
    -- Time settings (optional)
    start_time TIME,
    end_time TIME,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Template relationship (for recurring tasks)
    template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
    
    -- Scheduling fields (for one-time tasks)
    start_time TIME,
    end_time TIME,
    recur TEXT CHECK (recur IN ('once')), -- Only 'once' for one-time tasks
    
    -- Completion tracking
    is_done BOOLEAN DEFAULT false,
    completion_status TEXT CHECK (completion_status IN ('completed', 'skipped', 'failed')),
    
    -- Relationships
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    
    -- Metadata
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_task_templates_user_id ON task_templates(user_id);
CREATE INDEX idx_task_templates_goal_id ON task_templates(goal_id);
CREATE INDEX idx_task_templates_active ON task_templates(is_active);
CREATE INDEX idx_tasks_template_id ON tasks(template_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_date ON tasks(date);
CREATE INDEX idx_tasks_goal_id ON tasks(goal_id);

-- Create function to generate tasks from templates
CREATE OR REPLACE FUNCTION generate_tasks_from_templates(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    template_record RECORD;
    day_of_week INTEGER;
    should_create BOOLEAN := false;
BEGIN
    -- Loop through all active templates
    FOR template_record IN 
        SELECT * FROM task_templates 
        WHERE is_active = true
    LOOP
        should_create := false;
        
        -- Determine if we should create a task for this template on the target date
        CASE template_record.recur_type
            WHEN 'daily' THEN
                should_create := true;
            WHEN 'weekdays' THEN
                day_of_week := EXTRACT(DOW FROM target_date);
                should_create := day_of_week BETWEEN 1 AND 5; -- Monday = 1, Friday = 5
            WHEN 'custom' THEN
                day_of_week := EXTRACT(DOW FROM target_date);
                should_create := day_of_week = ANY(template_record.custom_days);
        END CASE;
        
        -- Create task if needed and doesn't already exist
        IF should_create THEN
            INSERT INTO tasks (
                title,
                description,
                goal_id,
                user_id,
                date,
                start_time,
                end_time,
                template_id,
                is_done,
                recur
            )
            SELECT 
                template_record.title,
                template_record.description,
                template_record.goal_id,
                template_record.user_id,
                target_date,
                template_record.start_time,
                template_record.end_time,
                template_record.id,
                false,
                NULL -- Individual tasks are not recurring
            WHERE NOT EXISTS (
                SELECT 1 FROM tasks 
                WHERE template_id = template_record.id 
                AND date = target_date
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate tasks for a date range
CREATE OR REPLACE FUNCTION generate_tasks_for_range(start_date DATE, end_date DATE)
RETURNS VOID AS $$
DECLARE
    current_date_var DATE := start_date;
BEGIN
    WHILE current_date_var <= end_date LOOP
        PERFORM generate_tasks_from_templates(current_date_var);
        current_date_var := current_date_var + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_templates_updated_at
    BEFORE UPDATE ON task_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_task_templates_updated_at();

-- Grant necessary permissions
GRANT ALL ON task_templates TO authenticated;
GRANT ALL ON tasks TO authenticated;
GRANT EXECUTE ON FUNCTION generate_tasks_from_templates(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_tasks_for_range(DATE, DATE) TO authenticated;

-- Verify the tables were created
SELECT 'task_templates created' as status;
SELECT 'tasks created' as status; 