import { useState, useEffect } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  user: User;
}

// Simple state management for auth
let sessionCache: Session | null = null;
const listeners: Array<(session: Session | null) => void> = [];

export const useSession = () => {
  const [data, setData] = useState<Session | null>(sessionCache);
  const [isPending, setIsPending] = useState(sessionCache === null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse session response:', text);
          return;
        }
        
        if (json.session) {
          sessionCache = json.session;
          setData(json.session);
        } else {
          sessionCache = null;
          setData(null);
        }
      } catch (err) {
        console.error('Failed to fetch session', err);
        sessionCache = null;
        setData(null);
      } finally {
        setIsPending(false);
      }
    };

    if (isPending) {
        fetchSession();
    }

    const listener = (newSession: Session | null) => {
      setData(newSession);
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return { data, isPending };
};

export const signIn = {
  email: async ({ email, password }: any) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response as JSON. Response text:', text);
        return { error: { message: 'Server returned non-JSON response' } };
      }

      if (!res.ok) return { error: { message: data.error || 'Server error' } };
      
      sessionCache = { user: data.user };
      listeners.forEach(l => l(sessionCache));
      return { data: sessionCache, shouldChangePassword: data.shouldChangePassword };
    } catch (err) {
      console.error('Sign-in fetch error:', err);
      return { error: { message: 'Network error' } };
    }
  }
};

export const signOut = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  sessionCache = null;
  listeners.forEach(l => l(null));
};
