-- Clean Tasks and Templates for Fresh Start
-- This will drop all task-related data while preserving values and goals

-- Drop the trigger first (only if it exists)
DROP TRIGGER IF EXISTS trigger_update_task_templates_updated_at ON task_templates;

-- Drop the functions we created (only if they exist)
DROP FUNCTION IF EXISTS generate_tasks_from_templates(DATE);
DROP FUNCTION IF EXISTS generate_tasks_for_range(DATE, DATE);
DROP FUNCTION IF EXISTS update_task_templates_updated_at();

-- Drop the tasks table (this is the only table that definitely exists)
DROP TABLE IF EXISTS tasks CASCADE;

-- Drop task_templates table (only if it exists)
DROP TABLE IF EXISTS task_templates CASCADE;

-- Verify that values and goals are still intact
SELECT 'Values count:' as info, COUNT(*) as count FROM values;
SELECT 'Goals count:' as info, COUNT(*) as count FROM goals;

-- Note: values and goals tables should remain completely unaffected 