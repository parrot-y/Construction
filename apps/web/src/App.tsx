import React, { useState } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { AuthSession } from './types/auth';

export default function App(): React.JSX.Element {
  const [session, setSession] = useState<AuthSession | null>(null);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    }
    setSession(null);
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
      {!session ? (
        <LoginForm onLoginSuccess={(newSession) => setSession(newSession)} />
      ) : (
        <Dashboard session={session} onLogout={handleLogout} />
      )}
    </main>
  );
}
