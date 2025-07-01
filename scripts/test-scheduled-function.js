import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestTasks() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDate = now.toISOString().split('T')[0];
  
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Current date: ${currentDate}`);
  console.log(`Current hour: ${currentHour}`);
  
  // First, get a user_id from existing tasks or create a test user
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('user_id')
    .limit(1);
  
  let userId = 'test-user-id'; // fallback
  if (existingTasks && existingTasks.length > 0) {
    userId = existingTasks[0].user_id;
    console.log(`Using existing user_id: ${userId}`);
  } else {
    console.log('No existing tasks found, using test user_id');
  }
  
  // Create test tasks for different scenarios
  const testTasks = [
    {
      title: 'Task starting in 30 minutes',
      date: currentDate,
      start_time: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // 30 min from now
      completed_at: null,
      user_id: userId
    },
    {
      title: 'Task starting in 45 minutes', 
      date: currentDate,
      start_time: new Date(now.getTime() + 45 * 60 * 1000).toISOString(), // 45 min from now
      completed_at: null,
      user_id: userId
    },
    {
      title: 'Task that started 10 minutes ago',
      date: currentDate,
      start_time: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 min ago
      completed_at: null,
      user_id: userId
    },
    {
      title: 'Task starting in 2 hours (should NOT be found)',
      date: currentDate,
      start_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      completed_at: null,
      user_id: userId
    },
    {
      title: 'Completed task (should NOT be found)',
      date: currentDate,
      start_time: new Date(now.getTime() + 15 * 60 * 1000).toISOString(), // 15 min from now
      completed_at: new Date().toISOString(), // Already completed
      user_id: userId
    }
  ];

  console.log('\nCreating test tasks...');
  
  for (const task of testTasks) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([task])
      .select();
    
    if (error) {
      console.error(`Error creating task "${task.title}":`, error);
    } else {
      console.log(`✅ Created: ${task.title} at ${task.start_time}`);
    }
  }
}

async function testFunctionQuery() {
  console.log('\n=== Testing Function Query Logic ===');
  
  const now = new Date();
  const nowUTC = now.toISOString();
  const localDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Detroit"})).toISOString().split('T')[0];
  
  // Add a 5-minute buffer to catch tasks that started just before the function triggered
  const bufferTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
  const bufferTimeUTC = bufferTime.toISOString();
  
  // Calculate 1 hour from now in UTC
  const futureTime = new Date(now.getTime() + 60 * 60 * 1000);
  const futureTimeUTC = futureTime.toISOString();

  console.log(`Function triggered at UTC time: ${nowUTC}`);
  console.log(`Current local date: ${localDate}`);
  console.log(`Looking for tasks between ${bufferTimeUTC} (5min ago) and ${futureTimeUTC} (1hr from now) on ${localDate} (local)`);

  // Query using the same logic as the function
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('date', localDate)
    .gte('start_time', bufferTimeUTC)
    .lt('start_time', futureTimeUTC)
    .is('completed_at', null)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Query error:', error);
    return;
  }

  console.log(`\nFound ${tasks.length} tasks in the window:`);
  
  if (tasks.length > 0) {
    tasks.forEach(task => {
      const taskStart = new Date(task.start_time);
      const isInWindow = taskStart >= new Date(bufferTimeUTC) && taskStart < new Date(futureTimeUTC);
      const hasStarted = taskStart <= new Date(nowUTC);
      const status = hasStarted ? 'STARTED' : 'UPCOMING';
      console.log(`  - ${task.title}: ${task.start_time} (${status}, in window: ${isInWindow})`);
    });
  } else {
    console.log('  No tasks found in the window');
  }
}

async function cleanupTestTasks() {
  console.log('\nCleaning up test tasks...');
  
  const { error } = await supabase
    .from('tasks')
    .delete()
    .like('title', 'Task %'); // Delete tasks that start with "Task "
  
  if (error) {
    console.error('Error cleaning up:', error);
  } else {
    console.log('✅ Test tasks cleaned up');
  }
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      await createTestTasks();
      break;
    case 'test':
      await testFunctionQuery();
      break;
    case 'cleanup':
      await cleanupTestTasks();
      break;
    case 'full':
      await createTestTasks();
      await testFunctionQuery();
      console.log('\nTo clean up test tasks, run: node scripts/test-scheduled-function.js cleanup');
      break;
    default:
      console.log('Usage:');
      console.log('  node scripts/test-scheduled-function.js create    - Create test tasks');
      console.log('  node scripts/test-scheduled-function.js test      - Test the query logic');
      console.log('  node scripts/test-scheduled-function.js cleanup   - Clean up test tasks');
      console.log('  node scripts/test-scheduled-function.js full      - Create tasks and test query');
  }
}

main().catch(console.error); 