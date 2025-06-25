-- Update schedule schema for custom days and completion tracking

-- 1. Add custom_days column to time_blocks table
alter table time_blocks add column if not exists custom_days integer[];

-- 2. Create schedule_completions table to track daily completions
create table if not exists schedule_completions (
  id            uuid         primary key default uuid_generate_v4(),
  time_block_id uuid         references time_blocks(id) on delete cascade,
  date          date         not null,
  status        text         not null check (status in ('completed', 'skipped', 'failed')),
  created_at    timestamptz  default now(),
  unique(time_block_id, date)
);

-- 3. Add indexes for better performance
create index if not exists idx_schedule_completions_time_block_id on schedule_completions(time_block_id);
create index if not exists idx_schedule_completions_date on schedule_completions(date);
create index if not exists idx_schedule_completions_status on schedule_completions(status);

-- 4. Enable realtime for the new table
alter publication supabase_realtime add table schedule_completions;

-- 5. Update existing time_blocks to have custom_days based on recur
update time_blocks set custom_days = 
  case 
    when recur = 'daily' then array[0,1,2,3,4,5,6]
    when recur = 'weekdays' then array[1,2,3,4,5]
    when recur = 'weekly' then array[1]
    else null
  end; 