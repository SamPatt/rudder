-- Add project_id to task_templates table and update functions
-- This migration adds project support to recurring tasks

-- Add project_id column to task_templates table
ALTER TABLE task_templates 
ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_task_templates_project_id ON task_templates(project_id);

-- Update the generate_tasks_from_templates function to include project_id
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
                project_id,
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
                template_record.project_id,
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_tasks_from_templates(DATE) TO authenticated;

-- Verify the migration
SELECT 'project_id added to task_templates' as status;
SELECT 'generate_tasks_from_templates updated' as status; 