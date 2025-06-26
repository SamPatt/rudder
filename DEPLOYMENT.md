# Deploying Rudder to Netlify

This guide will help you deploy the Rudder app to Netlify.

## Prerequisites

1. A Netlify account
2. Your Supabase project set up with the required database schema
3. Your Supabase URL and anon key

## Deployment Steps

### 1. Prepare Your Repository

Make sure your repository is pushed to GitHub, GitLab, or Bitbucket.

### 2. Deploy to Netlify

1. Go to [Netlify](https://netlify.com) and sign in
2. Click "New site from Git"
3. Choose your Git provider and select your repository
4. Configure the build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: `18`

### 3. Set Environment Variables

In your Netlify site settings, go to **Site settings > Environment variables** and add:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON=your-anon-key-here
```

Replace the values with your actual Supabase project URL and anon key.

### 4. Deploy

Netlify will automatically build and deploy your site. The first deployment may take a few minutes.

## Environment Variables

The app requires these environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON`: Your Supabase anonymous key

## Database Setup

Make sure your Supabase database has the required tables and schema. Run the SQL scripts in the `scripts/` directory in your Supabase SQL editor:

1. `update-schema.sql` - Creates task_goals junction table
2. `add-recurring-tasks.sql` - Adds recurring task support
3. `add-task-date.sql` - Adds date column for tasks
4. `add-event-date.sql` - Adds event_date for time blocks
5. `update-schedule-schema.sql` - Creates schedule_completions table
6. `update-time-blocks-schema.sql` - Updates time_blocks schema

## Troubleshooting

- If you see build errors, check that Node.js version 18 is being used
- If the app doesn't load, verify your environment variables are set correctly
- If you get CORS errors, make sure your Supabase project allows your Netlify domain

## Custom Domain (Optional)

You can set up a custom domain in Netlify:
1. Go to **Site settings > Domain management**
2. Click "Add custom domain"
3. Follow the DNS configuration instructions 