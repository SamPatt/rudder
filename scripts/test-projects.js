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

async function testProjects() {
  console.log('Testing Projects Feature...\n');

  // 1. Create a test project
  console.log('1. Creating a test project...');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert([{
      name: 'Test Project',
      description: 'A test project for development',
      color: '#3B82F6',
      user_id: '06d53cf1-0848-4db9-ba29-32d2d5a6924f' // Use existing user_id
    }])
    .select()
    .single();

  if (projectError) {
    console.error('Error creating project:', projectError);
    return;
  }
  console.log('✅ Project created:', project.name);

  // 2. Create a task with the project
  console.log('\n2. Creating a task with the project...');
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert([{
      title: 'Test Task with Project',
      date: new Date().toISOString().split('T')[0],
      project_id: project.id,
      user_id: '06d53cf1-0848-4db9-ba29-32d2d5a6924f'
    }])
    .select('*, project:projects(*)')
    .single();

  if (taskError) {
    console.error('Error creating task:', taskError);
    return;
  }
  console.log('✅ Task created with project:', task.title);
  console.log('   Project:', task.project?.name);

  // 3. Fetch tasks with projects
  console.log('\n3. Fetching tasks with projects...');
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', '06d53cf1-0848-4db9-ba29-32d2d5a6924f')
    .order('created_at', { ascending: false });

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
    return;
  }

  console.log('✅ Tasks with projects:');
  tasks.forEach(task => {
    console.log(`   - ${task.title} (Project: ${task.project?.name || 'None'})`);
  });

  // 4. Clean up test data
  console.log('\n4. Cleaning up test data...');
  const { error: deleteTaskError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', task.id);

  const { error: deleteProjectError } = await supabase
    .from('projects')
    .delete()
    .eq('id', project.id);

  if (deleteTaskError || deleteProjectError) {
    console.error('Error cleaning up:', deleteTaskError || deleteProjectError);
  } else {
    console.log('✅ Test data cleaned up');
  }

  console.log('\n🎉 Projects feature test completed successfully!');
}

testProjects().catch(console.error); 