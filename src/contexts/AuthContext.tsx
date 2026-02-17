/**
 * Authentication Context Provider
 * Provides global authentication state and methods
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';
import type { User, Session, AuthError } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false,
    error: null,
  });

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            setState({
              user: null,
              session: null,
              loading: false,
              initialized: true,
              error: error.message,
            });
          } else {
            setState({
              user: session?.user ?? null,
              session,
              loading: false,
              initialized: true,
              error: null,
            });
          }
        }
      } catch (err) {
        if (mounted) {
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
            error: err instanceof Error ? err.message : 'Authentication error',
          });
        }
      }
    }

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setState(prev => ({
            ...prev,
            user: session?.user ?? null,
            session,
            loading: false,
            error: null,
          }));

          // Handle specific auth events
          if (event === 'SIGNED_OUT') {
            // Clear any local storage data
            localStorage.removeItem('utopia_user_preferences');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }

    return { error };
  }, []);

  const signUp = useCallback(async (
    email: string, 
    password: string, 
    metadata?: Record<string, unknown>
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }

    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    await supabase.auth.signOut();
    
    // Clear local storage
    localStorage.clear();
    
    setState({
      user: null,
      session: null,
      loading: false,
      initialized: true,
      error: null,
    });
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }

    return { error };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }

    return { error };
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    
    setState(prev => ({
      ...prev,
      user: session?.user ?? null,
      session,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 * @returns Authentication context value
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Hook to check if user is authenticated
 * @returns Boolean indicating if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { user, initialized } = useAuth();
  return initialized && !!user;
}

/**
 * Hook to get current user ID
 * @returns User ID or null
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

/**
 * Hook to get current user email
 * @returns User email or null
 */
export function useUserEmail(): string | null {
  const { user } = useAuth();
  return user?.email ?? null;
}
