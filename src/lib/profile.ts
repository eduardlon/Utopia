// Profile-related API functions
import { supabase } from './supabase/client';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  location?: string;
  website?: string;
}

// Get a user's profile
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data as Profile;
}

// Get current user's profile
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile(user.id);
}

// Update profile
export async function updateProfile(updates: ProfileUpdate): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Use type assertion to bypass strict typing
  const result = await (supabase as any)
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (result.error) {
    console.error('Error updating profile:', result.error);
    throw result.error;
  }

  return result.data as Profile;
}

// Upload avatar image
export async function uploadAvatar(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/avatar.${fileExt}`;

  // Delete old avatar if exists
  await supabase.storage.from('avatars').remove([fileName]);

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      upsert: true,
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('Error uploading avatar:', uploadError);
    throw uploadError;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  // Update profile with new avatar URL
  await updateProfile({ avatar_url: publicUrl });

  return publicUrl;
}

// Upload cover image
export async function uploadCover(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/cover.${fileExt}`;

  // Delete old cover if exists
  await supabase.storage.from('covers').remove([fileName]);

  const { error: uploadError } = await supabase.storage
    .from('covers')
    .upload(fileName, file, {
      upsert: true,
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('Error uploading cover:', uploadError);
    throw uploadError;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('covers')
    .getPublicUrl(fileName);

  // Update profile with new cover URL
  await updateProfile({ cover_url: publicUrl });

  return publicUrl;
}

// Check if username is available
export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
  let query = supabase
    .from('profiles')
    .select('id')
    .eq('username', username);

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { data, error } = await query.single();

  if (error && error.code === 'PGRST116') {
    // No rows found, username is available
    return true;
  }

  return !data;
}

// Get user stats (posts count, followers, following)
export async function getUserStats(userId: string): Promise<{
  postsCount: number;
  followersCount: number;
  followingCount: number;
}> {
  // Get posts count
  const { count: postsCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Get followers count (people who follow this user)
  const { count: followersCount } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('addressee_id', userId)
    .eq('status', 'accepted');

  // Get following count (people this user follows)
  const { count: followingCount } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('requester_id', userId)
    .eq('status', 'accepted');

  return {
    postsCount: postsCount || 0,
    followersCount: followersCount || 0,
    followingCount: followingCount || 0
  };
}

// Search profiles by username or display name
export async function searchProfiles(query: string, limit: number = 10): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    console.error('Error searching profiles:', error);
    return [];
  }

  return (data || []) as Profile[];
}
