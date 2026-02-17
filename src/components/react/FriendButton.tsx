import { useState, useEffect } from 'react';
import { 
  getFriendshipStatus, 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest,
  removeFriend 
} from '../../lib/friends';

interface FriendButtonProps {
  targetUserId: string;
  onStatusChange?: (status: string) => void;
}

export default function FriendButton({ targetUserId, onStatusChange }: FriendButtonProps) {
  const [status, setStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected'>('none');
  const [friendshipId, setFriendshipId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [targetUserId]);

  async function loadStatus() {
    setLoading(true);
    try {
      const result = await getFriendshipStatus(targetUserId);
      setStatus(result.status);
      setFriendshipId(result.friendshipId);
    } catch (error) {
      console.error('Error loading friendship status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest() {
    setActionLoading(true);
    try {
      await sendFriendRequest(targetUserId);
      setStatus('pending_sent');
      onStatusChange?.('pending_sent');
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Error al enviar la solicitud de amistad');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptRequest() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await acceptFriendRequest(friendshipId);
      setStatus('accepted');
      onStatusChange?.('accepted');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Error al aceptar la solicitud');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectRequest() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await rejectFriendRequest(friendshipId);
      setStatus('none');
      setFriendshipId(undefined);
      onStatusChange?.('none');
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      alert('Error al rechazar la solicitud');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveFriend() {
    if (!confirm('¿Estás seguro de que quieres eliminar este amigo?')) return;
    setActionLoading(true);
    try {
      await removeFriend(targetUserId);
      setStatus('none');
      setFriendshipId(undefined);
      onStatusChange?.('none');
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Error al eliminar amigo');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelRequest() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await removeFriend(targetUserId);
      setStatus('none');
      setFriendshipId(undefined);
      onStatusChange?.('none');
    } catch (error) {
      console.error('Error canceling friend request:', error);
      alert('Error al cancelar la solicitud');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <button className="friend-btn loading" disabled>
        <span className="spinner"></span>
      </button>
    );
  }

  // Not friends - show "Add Friend" button
  if (status === 'none') {
    return (
      <button 
        className="friend-btn add-friend" 
        onClick={handleSendRequest}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <span className="spinner"></span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Agregar amigo
          </>
        )}
      </button>
    );
  }

  // Request sent - show "Cancel Request" button
  if (status === 'pending_sent') {
    return (
      <button 
        className="friend-btn pending" 
        onClick={handleCancelRequest}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <span className="spinner"></span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Solicitud enviada
          </>
        )}
      </button>
    );
  }

  // Request received - show Accept/Reject buttons
  if (status === 'pending_received') {
    return (
      <div className="friend-request-actions">
        <button 
          className="friend-btn accept" 
          onClick={handleAcceptRequest}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <span className="spinner"></span>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Aceptar
            </>
          )}
        </button>
        <button 
          className="friend-btn reject" 
          onClick={handleRejectRequest}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <span className="spinner"></span>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Rechazar
            </>
          )}
        </button>
      </div>
    );
  }

  // Already friends - show "Friends" button with remove option
  if (status === 'accepted') {
    return (
      <button 
        className="friend-btn friends" 
        onClick={handleRemoveFriend}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <span className="spinner"></span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
            Amigos
          </>
        )}
      </button>
    );
  }

  // Rejected - show "Add Friend" button again
  if (status === 'rejected') {
    return (
      <button 
        className="friend-btn add-friend" 
        onClick={handleSendRequest}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <span className="spinner"></span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Agregar amigo
          </>
        )}
      </button>
    );
  }

  return null;
}
