import { useState, useEffect } from 'react';

export default function PushDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const checkCapabilities = async () => {
      const info: any = {
        userAgent: navigator.userAgent,
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: 'PushManager' in window,
        notification: 'Notification' in window,
        permission: Notification.permission,
        https: location.protocol === 'https:',
        hostname: location.hostname,
        vapidKeyExists: !!import.meta.env.VITE_VAPID_PUBLIC_KEY,
        vapidKeyLength: import.meta.env.VITE_VAPID_PUBLIC_KEY?.length || 0,
      };

      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          info.serviceWorkerRegistered = !!registration;
          info.serviceWorkerActive = registration?.active?.state === 'activated';
          
          if (registration?.pushManager) {
            const subscription = await registration.pushManager.getSubscription();
            info.hasPushSubscription = !!subscription;
          }
        } catch (error) {
          info.serviceWorkerError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      setDebugInfo(info);
    };

    checkCapabilities();
  }, []);

  return (
    <div className="bg-gray-100 p-4 rounded text-xs">
      <h3 className="font-bold mb-2 text-gray-800">Push Notification Debug Info:</h3>
      <pre className="whitespace-pre-wrap overflow-auto text-gray-800">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
} 