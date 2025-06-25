-- Add event_date column for one-time events

-- Add event_date column to time_blocks table
alter table time_blocks add column if not exists event_date date;

-- Add index for better performance when querying by date
create index if not exists idx_time_blocks_event_date on time_blocks(event_date); 