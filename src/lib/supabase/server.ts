// Server-side Supabase utilities for Astro
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { AstroGlobal } from 'astro';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

/**
 * Create a Supabase server client for use in Astro components and API routes
 */
export function createSupabaseServerClient(Astro: AstroGlobal) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = Astro.cookies;
        const allCookies: { name: string; value: string }[] = [];
        
        // Get all cookies from the request
        const cookieHeader = Astro.request.headers.get('cookie') || '';
        cookieHeader.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) {
            allCookies.push({ name, value });
          }
        });
        
        return allCookies;
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          Astro.cookies.set(name, value, {
            path: options?.path || '/',
            domain: options?.domain,
            expires: options?.expires,
            httpOnly: options?.httpOnly,
            maxAge: options?.maxAge,
            sameSite: options?.sameSite as 'lax' | 'strict' | 'none' | undefined,
            secure: options?.secure,
          });
        });
      },
    },
  });
}

/**
 * Get the current authenticated user from the server side
 */
export async function getCurrentUser(Astro: AstroGlobal): Promise<User | null> {
  const supabase = createSupabaseServerClient(Astro);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email || '',
      created_at: user.created_at,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get the current session from the server side
 */
export async function getSession(Astro: AstroGlobal) {
  const supabase = createSupabaseServerClient(Astro);
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Sign out the current user
 */
export async function signOut(Astro: AstroGlobal) {
  const supabase = createSupabaseServerClient(Astro);
  
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error signing out:', error);
    return false;
  }
}

/**
 * Get the user's profile from the database
 */
export async function getUserProfile(Astro: AstroGlobal) {
  const supabase = createSupabaseServerClient(Astro);
  const user = await getCurrentUser(Astro);
  
  if (!user) {
    return null;
  }
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    
    return profile;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Check if the user is authenticated, redirect to login if not
 */
export async function requireAuth(Astro: AstroGlobal, redirectTo: string = '/login') {
  const user = await getCurrentUser(Astro);
  
  if (!user) {
    return Astro.redirect(redirectTo);
  }
  
  return user;
}