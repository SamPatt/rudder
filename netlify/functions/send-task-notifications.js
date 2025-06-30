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
  
  // Calculate 1 hour from now in UTC
  const futureTime = new Date(now.getTime() + 60 * 60 * 1000);
  const futureTimeUTC = futureTime.toISOString();

  console.log(`Function triggered at UTC time: ${nowUTC}`);
  console.log(`Looking for tasks between ${nowUTC} and ${futureTimeUTC} on ${nowDate} (UTC)`);
  console.log(`Query URL will be: ${supabaseUrl}/rest/v1/tasks?date=eq.${nowDate}&start_time=gte.${nowUTC}&start_time=lte.${futureTimeUTC}&completed_at=is.null&order=start_time.asc`);

  // Query for all tasks in the next hour (completed_at is null for incomplete tasks)
  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks?date=eq.${nowDate}&start_time=gte.${nowUTC}&start_time=lte.${futureTimeUTC}&completed_at=is.null&order=start_time.asc`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  console.log('Tasks fetch status:', taskRes.status);
  const tasks = await taskRes.json();
  console.log('Tasks fetch body:', tasks);

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
      queryTime: `${nowUTC}-${futureTimeUTC}`,
      queryDate: nowDate
    })
  };
}; 