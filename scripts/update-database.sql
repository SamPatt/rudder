-- Update database schema for multiple goals per task

-- 1. Create junction table for task-goal relationships
create table if not exists task_goals (
  id        uuid         primary key default uuid_generate_v4(),
  task_id   uuid         references tasks(id) on delete cascade,
  goal_id   uuid         references goals(id) on delete cascade,
  created_at timestamptz default now(),
  unique(task_id, goal_id)
);

-- 2. Add indexes for better performance
create index if not exists idx_task_goals_task_id on task_goals(task_id);
create index if not exists idx_task_goals_goal_id on task_goals(goal_id);

-- 3. Migrate existing single goal relationships to the new table
insert into task_goals (task_id, goal_id)
select id as task_id, goal_id
from tasks
where goal_id is not null
on conflict (task_id, goal_id) do nothing;

-- 4. Remove the old goal_id column from tasks table
-- Note: This will fail if there are still tasks with goal_id, so run the migration first
alter table tasks drop column if exists goal_id;

-- 5. Enable realtime for the new table
alter publication supabase_realtime add table task_goals; 