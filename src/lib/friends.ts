// Friend system API functions
import { supabase } from './supabase/client';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  requester?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  addressee?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Send a friend request
export async function sendFriendRequest(addresseeId: string): Promise<Friendship | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const result = await (supabase as any)
    .from('friendships')
    .insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: 'pending'
    })
    .select(`
      *,
      requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
      addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
    `)
    .single();

  if (result.error) {
    console.error('Error sending friend request:', result.error);
    throw result.error;
  }

  // Create notification for addressee
  const requester = (result.data as any).requester;
  if (requester) {
    await (supabase as any).from('notifications').insert({
      user_id: addresseeId,
      type: 'friend_request',
      title: 'Solicitud de amistad',
      content: 'te envió una solicitud de amistad',
      data: {
        actor_id: user.id,
        actor_username: requester.username,
        actor_avatar: requester.avatar_url,
        reference_id: user.id,
        reference_type: 'profile'
      },
      read: false
    });
  }

  return result.data as Friendship;
}

// Accept a friend request
export async function acceptFriendRequest(friendshipId: string): Promise<Friendship | null> {
  const result = await (supabase as any)
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select()
    .single();

  if (result.error) {
    console.error('Error accepting friend request:', result.error);
    throw result.error;
  }

  // Notify the requester
  const friendship = result.data as Friendship;
  const { data: { user } } = await supabase.auth.getUser();

  if (friendship && user) {
    // Get current user profile for notification details
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    if (profile) {
      await (supabase as any).from('notifications').insert({
        user_id: friendship.requester_id,
        type: 'follow', // Using 'follow' icon for accepted request or maybe a new type
        title: 'Solicitud aceptada',
        content: 'aceptó tu solicitud de amistad',
        data: {
          actor_id: user.id,
          actor_username: profile.username,
          actor_avatar: profile.avatar_url,
          reference_id: user.id,
          reference_type: 'profile'
        },
        read: false
      });
    }
  }

  return result.data as Friendship;
}

// Reject a friend request
export async function rejectFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('friendships')
    .update({ status: 'rejected' })
    .eq('id', friendshipId);

  if (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
}

// Remove a friend (delete friendship)
export async function removeFriend(friendId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await (supabase as any)
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);

  if (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
}

// Get friends list
export async function getFriends(userId?: string): Promise<Friendship[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const targetUserId = userId || user.id;

  const { data, error } = await (supabase as any)
    .from('friendships')
    .select(`
      *,
      requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
      addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
    `)
    .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`)
    .eq('status', 'accepted');

  if (error) {
    console.error('Error getting friends:', error);
    return [];
  }

  return (data || []) as Friendship[];
}

// Get pending friend requests (received)
export async function getPendingRequests(): Promise<Friendship[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('friendships')
    .select(`
      *,
      requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('addressee_id', user.id)
    .eq('status', 'pending');

  if (error) {
    console.error('Error getting pending requests:', error);
    return [];
  }

  return (data || []) as Friendship[];
}

// Get sent friend requests
export async function getSentRequests(): Promise<Friendship[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('friendships')
    .select(`
      *,
      addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('requester_id', user.id)
    .eq('status', 'pending');

  if (error) {
    console.error('Error getting sent requests:', error);
    return [];
  }

  return (data || []) as Friendship[];
}

// Check friendship status with another user
export async function getFriendshipStatus(otherUserId: string): Promise<{
  status: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected';
  friendshipId?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'none' };

  const { data, error } = await (supabase as any)
    .from('friendships')
    .select('id, status, requester_id')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { status: 'none' };
    }
    console.error('Error checking friendship status:', error);
    return { status: 'none' };
  }

  if (!data) return { status: 'none' };

  if (data.status === 'accepted') {
    return { status: 'accepted', friendshipId: data.id };
  }

  if (data.status === 'rejected') {
    return { status: 'rejected', friendshipId: data.id };
  }

  if (data.status === 'pending') {
    if (data.requester_id === user.id) {
      return { status: 'pending_sent', friendshipId: data.id };
    } else {
      return { status: 'pending_received', friendshipId: data.id };
    }
  }

  return { status: 'none' };
}

// Get friend suggestions (users with mutual friends)
export async function getFriendSuggestions(limit: number = 5): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get users that are not friends and have no pending requests
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .neq('id', user.id)
    .limit(limit);

  if (error) {
    console.error('Error getting friend suggestions:', error);
    return [];
  }

  // Filter out existing friends and pending requests
  const existingStatuses = await Promise.all(
    (data || []).map(async (profile: any) => {
      const status = await getFriendshipStatus(profile.id);
      return { ...profile, friendshipStatus: status.status };
    })
  );

  return existingStatuses.filter(
    (p: any) => p.friendshipStatus === 'none'
  ).map(({ friendshipStatus, ...profile }: any) => profile);
}

// Get mutual friends count
export async function getMutualFriendsCount(otherUserId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get user's friends
  const { data: userFriends } = await (supabase as any)
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted');

  // Get other user's friends
  const { data: otherFriends } = await (supabase as any)
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${otherUserId},addressee_id.eq.${otherUserId}`)
    .eq('status', 'accepted');

  if (!userFriends || !otherFriends) return 0;

  // Extract friend IDs
  const userFriendIds = userFriends.map((f: any) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  const otherFriendIds = otherFriends.map((f: any) =>
    f.requester_id === otherUserId ? f.addressee_id : f.requester_id
  );

  // Count mutual friends
  const mutualFriends = userFriendIds.filter((id: string) => otherFriendIds.includes(id));
  return mutualFriends.length;
}
