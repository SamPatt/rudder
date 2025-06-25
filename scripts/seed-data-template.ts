import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON!;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Example values - customize these for your own use
const values = [
  'Values'
];

// Example goals - customize these for your own use
const goals = [
  // Example goals - customize these for your own use
  { name: 'Build useful things', value: 'Values' },
  { name: 'Maintain & improve social relationships', value: 'Values' },
  { name: 'Have a clean, organized home', value: 'Values' },
  { name: 'Do meaningful work', value: 'Values' },
  { name: 'Get / stay fit', value: 'Values' }
];

async function seedData() {
  console.log('🌱 Starting data seeding...\n');

  try {
    // First, clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('time_blocks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('goals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('values').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Add values
    console.log('📝 Adding values...');
    const valueResults = await Promise.all(
      values.map(async (valueName) => {
        const { data, error } = await supabase
          .from('values')
          .insert({ name: valueName })
          .select()
          .single();
        
        if (error) {
          console.error(`❌ Error adding value "${valueName}":`, error);
          return null;
        }
        
        console.log(`✅ Added value: ${valueName}`);
        return data;
      })
    );

    const validValues = valueResults.filter(v => v !== null);
    console.log(`\n📊 Added ${validValues.length} values\n`);

    // Create a map of value names to IDs
    const valueMap = new Map();
    validValues.forEach(value => {
      if (value) {
        valueMap.set(value.name, value.id);
      }
    });

    // Add goals
    console.log('🎯 Adding goals...');
    const goalResults = await Promise.all(
      goals.map(async (goal) => {
        const valueId = valueMap.get(goal.value);
        if (!valueId) {
          console.error(`❌ Value "${goal.value}" not found for goal "${goal.name}"`);
          return null;
        }

        const { data, error } = await supabase
          .from('goals')
          .insert({
            name: goal.name,
            value_id: valueId
          })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error adding goal "${goal.name}":`, error);
          return null;
        }

        console.log(`✅ Added goal: ${goal.name} (${goal.value})`);
        return data;
      })
    );

    const validGoals = goalResults.filter(g => g !== null);
    console.log(`\n📊 Added ${validGoals.length} goals\n`);

    console.log('🎉 Data seeding completed successfully!');
    console.log(`\n📈 Summary:`);
    console.log(`   - Values: ${validValues.length}`);
    console.log(`   - Goals: ${validGoals.length}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

// Run the seeding
seedData(); 