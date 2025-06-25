-- Fix time_blocks table schema to support both old and new formats

-- 1. Make start_hour and duration_m nullable to allow new format
alter table time_blocks alter column start_hour drop not null;
alter table time_blocks alter column duration_m drop not null;

-- 2. Ensure start_time and end_time columns exist and are not null
alter table time_blocks add column if not exists start_time time;
alter table time_blocks add column if not exists end_time time;

-- 3. Convert existing data from start_hour and duration_m to start_time and end_time
update time_blocks 
set 
  start_time = (start_hour || ':00')::time,
  end_time = ((start_hour + (duration_m / 60)) || ':' || (duration_m % 60))::time
where start_time is null and start_hour is not null;

-- 4. Make new columns not null after data migration
alter table time_blocks alter column start_time set not null;
alter table time_blocks alter column end_time set not null;

-- 5. Add custom_days column if it doesn't exist
alter table time_blocks add column if not exists custom_days integer[];

-- 6. Update existing time_blocks to have custom_days based on recur
update time_blocks set custom_days = 
  case 
    when recur = 'daily' then array[0,1,2,3,4,5,6]
    when recur = 'weekdays' then array[1,2,3,4,5]
    when recur = 'weekly' then array[1]
    else null
  end
where custom_days is null; 