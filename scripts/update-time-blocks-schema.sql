-- Update time_blocks table to use start_time and end_time instead of start_hour and duration_m

-- 1. Add new columns
alter table time_blocks add column if not exists start_time time;
alter table time_blocks add column if not exists end_time time;

-- 2. Convert existing data from start_hour and duration_m to start_time and end_time
update time_blocks 
set 
  start_time = (start_hour || ':00')::time,
  end_time = ((start_hour + (duration_m / 60)) || ':' || (duration_m % 60))::time
where start_time is null and start_hour is not null;

-- 3. Make new columns not null after data migration
alter table time_blocks alter column start_time set not null;
alter table time_blocks alter column end_time set not null;

-- 4. Drop old columns (optional - uncomment if you want to remove them)
-- alter table time_blocks drop column if exists start_hour;
-- alter table time_blocks drop column if exists duration_m; 