import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

export default function Login() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-palette3">
      <div className="mb-8 flex flex-col items-center">
        <div className="text-5xl mb-2">☸</div>
        <h1 className="text-3xl font-bold text-palette4 mb-2">Rudder</h
      </div>
      <div className="w-full max-w-md bg-palette2 rounded-lg shadow-lg p-6">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          theme="dark"
        />
      </div>
    </div>
  );
} 