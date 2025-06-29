# Database Scripts

This directory contains SQL scripts for setting up and managing the Rudder task management system.

## Scripts Overview

### `new-template-schema.sql`
**Purpose**: Creates the new template-based task system from scratch
**When to use**: 
- Setting up a fresh database
- Migrating from the old system to the new template-based system
- After running `clean-tasks.sql`

**What it creates**:
- `task_templates` table - Stores recurring task definitions
- `tasks` table - Stores individual task instances
- Database functions for automatic task generation
- Proper indexes for performance
- Triggers for automatic timestamp updates

### `clean-tasks.sql`
**Purpose**: Removes all task-related data while preserving values and goals
**When to use**:
- Starting fresh with the new template system
- Clearing test data
- Before running `new-template-schema.sql`

**What it removes**:
- All task data
- All task templates
- Related functions and triggers
- **Preserves**: values and goals tables

## Setup Instructions

### For New Users (Fresh Setup)
1. Ensure you have `values` and `goals` tables set up
2. Run `new-template-schema.sql` to create the task system
3. Start using the application

### For Existing Users (Migration)
1. **Backup your data** (recommended)
2. Run `clean-tasks.sql` to remove old task data
3. Run `new-template-schema.sql` to create the new system
4. Update your application code to use the new template-based system

## Database Schema

### Task Templates Table
```sql
task_templates (
  id, title, description, goal_id, user_id,
  recur_type, custom_days, start_time, end_time,
  is_active, created_at, updated_at
)
```

### Tasks Table
```sql
tasks (
  id, title, description, template_id,
  start_time, end_time, recur,
  is_done, completion_status, goal_id,
  date, created_at, completed_at, user_id
)
```

## Key Features

- **Template-based recurring tasks**: Create once, generate instances automatically
- **Individual task instances**: Each day gets its own completion tracking
- **Automatic task generation**: Functions create tasks based on templates
- **Historical data**: Track completion patterns over time
- **Performance optimized**: Proper indexes for fast queries

## Functions

- `generate_tasks_from_templates(date)`: Creates tasks for a specific date
- `generate_tasks_for_range(start, end)`: Creates tasks for a date range

## Notes

- The new system separates recurring task definitions (templates) from individual instances
- Each recurring task creates a template + daily instances
- One-time tasks are created directly as individual tasks
- All existing values and goals are preserved during migration 