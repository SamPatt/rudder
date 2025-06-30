import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface PushRegisterButtonProps {
  user: User;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export default function PushRegisterButton({ user }: PushRegisterButtonProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState<string>('');

  const checkNotificationStatus = () => {
    if (!('Notification' in window)) {
      setStatus('Notifications not supported in this browser');
      return;
    }

    switch (Notification.permission) {
      case 'granted':
        setStatus('✅ Notifications enabled');
        break;
      case 'denied':
        setStatus('❌ Notifications blocked - please enable in browser settings');
        break;
      case 'default':
        setStatus('⏳ Notifications not yet requested');
        break;
    }
  };

  const checkExistingSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error checking subscription:', error);
        setStatus(`Error checking subscription: ${error.message}`);
        return;
      }

      if (data) {
        setStatus(`✅ Subscription found! Endpoint: ${data.subscription.endpoint.substring(0, 50)}...`);
      } else {
        setStatus('No existing subscription found');
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setStatus('Error checking subscription');
    }
  };

  const registerForPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('Push notifications not supported in this browser');
      return;
    }

    setIsRegistering(true);
    setStatus('Registering...');

    try {
      // Check authentication status
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        console.error('Authentication error:', authError);
        setStatus('Authentication error - please log in again');
        return;
      }
      
      console.log('Current user:', currentUser.id);
      console.log('User session:', await supabase.auth.getSession());

      // Check if service worker is registered
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setStatus('Service worker not registered. Please refresh the page.');
        return;
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('Notification permission denied');
        return;
      }

      // Convert VAPID key
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      // Get push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      // Save subscription to database
      console.log('Saving subscription for user:', user.id);
      console.log('Subscription data:', subscription.toJSON());
      
      // First try to delete any existing subscription for this user
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting existing subscription:', deleteError);
      }

      // Then insert the new subscription
      const { data, error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          subscription: subscription.toJSON()
        })
        .select();

      if (error) {
        console.error('Error saving subscription:', error);
        console.error('Error details:', error.message, error.details, error.hint);
        setStatus(`Error saving subscription: ${error.message}`);
        return;
      }

      console.log('Subscription saved successfully:', data);
      setStatus('✅ Push notifications registered successfully!');
      
      // Test notification
      setTimeout(() => {
        new Notification('Test Notification', {
          body: 'If you see this, push notifications are working!',
          icon: '/icon-192.png'
        });
      }, 1000);

    } catch (error) {
      console.error('Error registering for push notifications:', error);
      setStatus('Error registering for push notifications');
    } finally {
      setIsRegistering(false);
    }
  };

  const testNotification = async () => {
    try {
      setStatus('Testing notification...');
      
      // Test if service worker is registered
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setStatus('❌ No service worker found');
        return;
      }
      
      // Test if we can show notifications
      if (Notification.permission !== 'granted') {
        setStatus('❌ Notification permission not granted');
        return;
      }
      
      // Show a test notification using the service worker
      await registration.showNotification('Test Notification', {
        body: 'This is a direct test notification via service worker',
        icon: 'https://ruddertasks.netlify.app/icon-192.png',
        badge: 'https://ruddertasks.netlify.app/icon-192.png',
        tag: 'test-direct',
        requireInteraction: true
      });
      
      setStatus('✅ Direct notification sent! Check if you see it.');
      
      // Also try to send a push notification to test the service worker
      setTimeout(async () => {
        try {
          const response = await fetch('/.netlify/functions/test-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ test: true })
          });
          
          const result = await response.json();
          console.log('Test push result:', result);
          setStatus(`✅ Test push sent! Result: ${JSON.stringify(result)}`);
        } catch (error) {
          console.error('Test push error:', error);
          setStatus(`❌ Test push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Test notification error:', error);
      setStatus(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  function urlBase64ToUint8Array(base64String: string) {
    if (!base64String || typeof base64String !== 'string') {
      throw new Error('VAPID key is not a valid string');
    }
    
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    try {
      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    } catch (error) {
      throw new Error(`Failed to decode VAPID key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={checkNotificationStatus}
        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
      >
        Check Notification Status
      </button>
      
      <button
        onClick={checkExistingSubscription}
        className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
      >
        Check Existing Subscription
      </button>
      
      <button
        onClick={registerForPushNotifications}
        disabled={isRegistering}
        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
      >
        {isRegistering ? 'Registering...' : 'Register for Push Notifications'}
      </button>
      
      <button
        onClick={testNotification}
        className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
      >
        Test Notification
      </button>
      
      {status && (
        <div className="text-xs text-gray-300 mt-2 p-2 bg-gray-800 rounded">
          {status}
        </div>
      )}
    </div>
  );
} 