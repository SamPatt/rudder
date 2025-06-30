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

  // 2. Query Supabase for tasks due soon (within next 15 minutes)
  const now = new Date();
  const nowDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const nowTime = now.toISOString().slice(11, 16); // HH:MM
  
  // Calculate 15 minutes from now
  const futureTime = new Date(now.getTime() + 15 * 60 * 1000);
  const futureTimeStr = futureTime.toISOString().slice(11, 16); // HH:MM

  console.log(`Looking for tasks between ${nowTime} and ${futureTimeStr} on ${nowDate}`);

  // Query for tasks due within the next 15 minutes (completed_at is null for incomplete tasks)
  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks?date=eq.${nowDate}&start_time=gte.${nowTime}&start_time=lte.${futureTimeStr}&completed_at=is.null`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  console.log('Tasks fetch status:', taskRes.status);
  const tasks = await taskRes.json();
  console.log('Tasks fetch body:', tasks);

  // 3. Send a notification for each task to each subscription
  let sent = 0;
  if (Array.isArray(tasks) && Array.isArray(subscriptions)) {
    for (const task of tasks) {
      const payload = JSON.stringify({
        title: `Task Due Soon: ${task.title}`,
        body: `Your task "${task.title}" is due at ${task.start_time}.`,
      });
      for (const sub of subscriptions) {
        try {
          console.log(`Sending notification for task "${task.title}" to subscription ${sub.id}`);
          await webpush.sendNotification(sub.subscription, payload);
          sent++;
          console.log(`Successfully sent notification for task "${task.title}"`);
        } catch (err) {
          console.error('Push error for task', task.title, ':', err);
        }
      }
    }
    console.log(`Sent ${sent} notifications for ${tasks.length} tasks to ${subscriptions.length} subscriptions`);
  } else {
    console.error('Tasks or subscriptions are not arrays:', { tasks, subscriptions });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sent, tasks: Array.isArray(tasks) ? tasks.length : 'n/a', subscriptions: Array.isArray(subscriptions) ? subscriptions.length : 'n/a' })
  };
}; 