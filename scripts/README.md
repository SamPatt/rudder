# Database Scripts

This directory contains SQL migration scripts and data seeding templates for setting up the Rudder database.

## Migration Scripts (Run in order)

### 1. `update-schema.sql`
Initial schema setup for basic tables (values, goals, tasks).

### 2. `update-database.sql`
Adds support for multiple goals per task by creating the `task_goals` junction table.

### 3. `update-schedule-schema.sql`
Adds schedule-related tables and functionality.

### 4. `update-time-blocks-schema.sql`
Updates time blocks to use start_time/end_time instead of start_hour/duration_m.

### 5. `fix-time-blocks-schema.sql`
Fixes any issues with the time blocks schema migration.

### 6. `add-event-date.sql`
Adds support for one-time events in the schedule.

### 7. `add-recurring-tasks.sql`
Adds support for recurring tasks (daily, weekly, custom days).

## Data Seeding

### `seed-data-template.ts`
Template file for seeding initial values and goals. **Important: Customize this file** with your own values and goals before running.

The template currently contains:
- A single example value: "Values"
- Five example goals linked to that value

You should replace these with your own meaningful values and goals.

## Usage

1. **Set up your database** by running the migration scripts in order (in your Supabase SQL editor)
2. **Customize** `seed-data-template.ts` with your own values and goals
3. **Run the seed script** to populate your database with initial data

## Running the Seed Script

```bash
# First, customize the seed-data-template.ts file with your own values and goals
# Then run it with Node.js:
npx tsx scripts/seed-data-template.ts

# Or if you have TypeScript set up:
npx ts-node scripts/seed-data-template.ts
```

## Environment Setup

Make sure you have a `.env` file with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON=your_supabase_anon_key
```

## Note

The original `seed-data.ts` file contained personal data and has been removed. Use the template file instead and customize it for your own needs. 