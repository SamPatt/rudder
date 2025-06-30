const webpush = require('web-push');
// No need to import node-fetch in Node 18+

webpush.setVapidDetails(
  'mailto:git@sampatt.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async function(event, context) {
  console.log('send-task-notifications function triggered');
  console.log('Event:', event);
  console.log('Context:', context);
  
  // Handle scheduled function invocation
  let nextRun = null;
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      nextRun = body.next_run;
      console.log('Next scheduled run:', nextRun);
    } catch (err) {
      console.log('Not a scheduled invocation or invalid JSON body');
    }
  }

  // 1. Fetch your push subscription(s) from Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // Get all subscriptions (or filter by user_id if needed)
  const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  console.log('Subscriptions fetch status:', subRes.status);
  const subscriptions = await subRes.json();
  console.log('Subscriptions fetch body:', subscriptions);

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    console.log('No subscriptions found');
    return {
      statusCode: 200,
      body: JSON.stringify({ sent: 0, tasks: 0, subscriptions: 0, message: 'No subscriptions found' })
    };
  }

  // 2. Query Supabase for all tasks in the next hour (using UTC)
  const now = new Date();
  const nowUTC = now.toISOString();
  const nowDate = now.toISOString().split('T')[0]; // YYYY-MM-DD in UTC
  
  // Add a 5-minute buffer to catch tasks that started just before the function triggered
  const bufferTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
  const bufferTimeUTC = bufferTime.toISOString();
  
  // Calculate 1 hour from now in UTC
  const futureTime = new Date(now.getTime() + 60 * 60 * 1000);
  const futureTimeUTC = futureTime.toISOString();

  console.log(`Function triggered at UTC time: ${nowUTC}`);
  console.log(`Looking for tasks between ${bufferTimeUTC} (5min ago) and ${futureTimeUTC} (1hr from now) on ${nowDate} (UTC)`);
  console.log(`Query URL will be: ${supabaseUrl}/rest/v1/tasks?date=eq.${nowDate}&start_time=gte.${bufferTimeUTC}&start_time=lt.${futureTimeUTC}&completed_at=is.null&order=start_time.asc`);

  // Query for all tasks in the next hour (completed_at is null for incomplete tasks)
  // Use buffer to catch tasks that started just before function triggered
  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks?date=eq.${nowDate}&start_time=gte.${bufferTimeUTC}&start_time=lt.${futureTimeUTC}&completed_at=is.null&order=start_time.asc`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  console.log('Tasks fetch status:', taskRes.status);
  const tasks = await taskRes.json();
  console.log('Tasks fetch body:', tasks);

  // Debug: Log each task's start time to verify the window
  if (Array.isArray(tasks) && tasks.length > 0) {
    console.log('Task start times in window:');
    tasks.forEach(task => {
      const taskStart = new Date(task.start_time);
      const isInWindow = taskStart >= new Date(bufferTimeUTC) && taskStart < new Date(futureTimeUTC);
      const hasStarted = taskStart <= new Date(nowUTC);
      const status = hasStarted ? 'STARTED' : 'UPCOMING';
      console.log(`  - ${task.title}: ${task.start_time} (${status}, in window: ${isInWindow})`);
    });
  }

  // 3. Send a comprehensive notification for all tasks
  let sent = 0;
  if (Array.isArray(tasks) && tasks.length > 0) {
    // Create a comprehensive message
    const taskList = tasks.map(task => `• ${task.title} at ${task.start_time}`).join('\n');
    const taskCount = tasks.length;
    
    const payload = JSON.stringify({
      title: `You have ${taskCount} task${taskCount > 1 ? 's' : ''} in the next hour`,
      body: taskList,
    });
    
    for (const sub of subscriptions) {
      try {
        console.log(`Sending comprehensive notification for ${taskCount} tasks to subscription ${sub.id}`);
        await webpush.sendNotification(sub.subscription, payload);
        sent++;
        console.log(`Successfully sent comprehensive notification for ${taskCount} tasks`);
      } catch (err) {
        console.error('Push error:', err);
      }
    }
    console.log(`Sent ${sent} comprehensive notifications for ${tasks.length} tasks to ${subscriptions.length} subscriptions`);
  } else if (Array.isArray(tasks) && tasks.length === 0) {
    console.log('No tasks found in the next hour');
  } else {
    console.error('Tasks is not an array:', tasks);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      sent, 
      tasks: Array.isArray(tasks) ? tasks.length : 'n/a', 
      subscriptions: Array.isArray(subscriptions) ? subscriptions.length : 'n/a',
      queryTime: `${bufferTimeUTC}-${futureTimeUTC}`,
      queryDate: nowDate
    })
  };
}; 