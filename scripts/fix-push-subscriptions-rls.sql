-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;

-- Create more permissive policies for push_subscriptions
CREATE POLICY "Users can insert their own push subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own push subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Also add a policy that allows the service role to access all subscriptions
-- (needed for the Netlify function to send notifications)
CREATE POLICY "Service role can access all push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role'); 