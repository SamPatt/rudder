# Data Seeding Guide

This guide will help you mass-add your values and goals to the Rudder app.

## Prerequisites

1. **Supabase Setup**: Make sure you have:
   - Created a Supabase project
   - Run the SQL schema from the README
   - Enabled Realtime for all tables

2. **Environment Variables**: Create a `.env` file in the root directory with:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON=your-anon-key-here
   ```

## Running the Seeding Script

1. **Make sure you're using Node.js 18**:
   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   nvm use 18
   ```

2. **Run the seeding script**:
   ```bash
   npm run seed
   ```

## What the Script Does

The seeding script will:

1. **Clear existing data** (optional - you can comment this out if you want to keep existing data)
2. **Add values**:


3. **Add goals** organized by value:


## Expected Output

You should see output like:
```
🌱 Starting data seeding...

🗑️  Clearing existing data...
📝 Adding values...
✅ Added value: 
...
📊 Added 7 values

🎯 Adding goals...
✅ Added goal: 
...
📊 Added 28 goals

🎉 Data seeding completed successfully!

📈 Summary:
   - Values: 7
   - Goals: 28
```

## After Seeding

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Visit the app** at `http://localhost:3000`

3. **Navigate to the Goals page** to see your organized values and goals

4. **Start adding tasks** and linking them to your goals

5. **Set up time blocks** for your daily routine

## Customizing the Data

If you want to modify the values or goals:

1. Edit `scripts/seed-data.ts`
2. Modify the `values` and `goals` arrays
3. Run `npm run seed` again

## Troubleshooting

- **"Missing Supabase environment variables"**: Check your `.env` file
- **"Value not found"**: Make sure the value name in the goals array matches exactly
- **Database errors**: Verify your Supabase setup and table schema 