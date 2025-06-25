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

## Setup

### 1. Prerequisites

- Node.js 16+ (you may need to upgrade from v12)
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
2. Run the following SQL in the SQL editor:

```sql
-- 1. Values  
create table values (
  id        uuid         primary key default uuid_generate_v4(),
  name      text         not null,
  created_at timestamptz default now()
);

-- 2. Goals  
create table goals (
  id         uuid         primary key default uuid_generate_v4(),
  value_id   uuid         references values(id) on delete cascade,
  name       text         not null,
  target_by  date,
  created_at timestamptz  default now()
);

-- 3. Tasks  
create table tasks (
  id         uuid         primary key default uuid_generate_v4(),
  goal_id    uuid         references goals(id) on delete cascade,
  title      text         not null,
  due_at     timestamptz,
  is_done    boolean      default false,
  created_at timestamptz  default now()
);

-- 4. Time_blocks  
create table time_blocks (
  id         uuid         primary key default uuid_generate_v4(),
  goal_id    uuid         references goals(id),
  title      text         not null,
  start_hour int          not null,  -- 0–23
  duration_m int          not null,  -- minutes
  recur      text         not null,  -- e.g. 'daily', 'weekdays'
  created_at timestamptz  default now()
);
```

3. Enable Realtime for all tables in the Supabase dashboard
4. Copy your project URL and anon key to the `.env` file

### 5. Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 6. Build for Production

```bash
npm run build
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

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

### Other Platforms

The app can be deployed to any static hosting platform that supports SPAs (Vercel, GitHub Pages, etc.).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your own goals! 