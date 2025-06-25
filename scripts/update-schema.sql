-- Create junction table for task-goal relationships
create table task_goals (
  id        uuid         primary key default uuid_generate_v4(),
  task_id   uuid         references tasks(id) on delete cascade,
  goal_id   uuid         references goals(id) on delete cascade,
  created_at timestamptz default now(),
  unique(task_id, goal_id)
);

-- Add indexes for better performance
create index idx_task_goals_task_id on task_goals(task_id);
create index idx_task_goals_goal_id on task_goals(goal_id);

-- Enable realtime for the new table
alter publication supabase_realtime add table task_goals; 