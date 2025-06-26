# Rudder - Goal & Task Scheduler

A goal-oriented task and scheduling app that helps you stay focused on what matters most.

## Features

- **Goal Management**: Create values and goals to guide your daily actions
- **Task Management**: Add tasks and link them to your goals
- **Time Blocking**: Schedule recurring time blocks for focused work
- **Real-time Updates**: Changes sync instantly across devices
- **PWA Support**: Install as a mobile app for easy access
- **Responsive Design**: Works great on both desktop and mobile

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Real-time subscriptions)
- **Deployment**: Netlify (recommended)

## Quick Start

### 1. Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON=your-anon-key-here
```

### 4. Supabase Setup

1. Create a new Supabase project
2. Run the SQL scripts in the `scripts/` directory in order:
   - `update-schema.sql` - Creates task_goals junction table
   - `add-recurring-tasks.sql` - Adds recurring task support
   - `add-task-date.sql` - Adds date column for tasks
   - `add-event-date.sql` - Adds event_date for time blocks
   - `update-schedule-schema.sql` - Creates schedule_completions table
   - `update-time-blocks-schema.sql` - Updates time_blocks schema
3. Enable Realtime for all tables in the Supabase dashboard
4. Copy your project URL and anon key to the `.env` file

### 5. Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 6. Test Production Build

```bash
./scripts/build-test.sh
```

## Usage

### Getting Started

1. **Add Values**: Start by defining your core values (e.g., Health, Learning, Relationships)
2. **Create Goals**: Add specific goals under each value
3. **Set Up Time Blocks**: Schedule recurring time blocks for focused work
4. **Add Tasks**: Create tasks and link them to your goals
5. **Track Progress**: Check off completed tasks and time blocks

### Key Features

- **Dashboard**: See your current time block and quick-add tasks
- **Tasks**: Manage all your tasks with filtering and goal assignment
- **Schedule**: View and manage your time blocks
- **Goals**: Organize your goals by values

## Deployment

### Netlify (Recommended)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick steps:
1. Push your code to GitHub
2. Connect to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables
6. Deploy!

### Other Platforms

The app can be deployed to any static hosting platform that supports SPAs (Vercel, GitHub Pages, etc.).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your own goals! 