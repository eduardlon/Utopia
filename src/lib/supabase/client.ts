import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Export createClient helper that returns the singleton instance
// This prevents multiple GoTrueClient instances warning
export function createClient() {
  return supabase;
}

// Default supabase client instance
export const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper function to get the current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

// Helper function to get the current session
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

// Sign in with OAuth - uses redirect flow for better network compatibility
export async function signInWithOAuth(provider: 'google' | 'facebook') {
  // Get the current origin (IP or localhost)
  const currentOrigin = window.location.origin;
  
  // Store the current origin in localStorage so we can redirect back after OAuth
  localStorage.setItem('oauth_redirect_origin', currentOrigin);
  
  // Use the current origin for the redirect URL
  const redirectUrl = `${currentOrigin}/auth/callback`;
  
  console.log('[OAuth] Starting OAuth flow for provider:', provider);
  console.log('[OAuth] Current origin:', currentOrigin);
  console.log('[OAuth] Redirect URL:', redirectUrl);
  
  // Use standard redirect flow - Supabase will redirect to our redirectTo URL
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    console.error('[OAuth] Error signing in:', error);
    localStorage.removeItem('oauth_redirect_origin');
    throw error;
  }
  
  // The browser will automatically redirect to the OAuth provider
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

// Subscribe to auth state changes
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
