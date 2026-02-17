import { useState, useEffect } from 'react';
import {
  getFriends,
  getPendingRequests,
  getSentRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  type Friendship
} from '../../lib/friends';

type TabType = 'friends' | 'received' | 'sent';

interface FriendsListProps {
  userId?: string;
  showTabs?: boolean;
}

export default function FriendsList({ userId, showTabs = true }: FriendsListProps) {
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  async function loadData() {
    setLoading(true);
    try {
      const [friendsData, receivedData, sentData] = await Promise.all([
        getFriends(userId),
        userId ? Promise.resolve([]) : getPendingRequests(),
        userId ? Promise.resolve([]) : getSentRequests(),
      ]);
      setFriends(friendsData);
      setReceivedRequests(receivedData);
      setSentRequests(sentData);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptFriendRequest(id);
      await loadData();
    } catch (error) {
      console.error("Error accepting friend:", error);
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectFriendRequest(id);
      await loadData();
    } catch (error) {
      console.error("Error rejecting friend:", error);
    }
  }

  async function handleCancel(id: string) { // This actually deletes the request, same as removeFriend or reject?
    // removeFriend uses delete, which works for requests too
    try {
      // removeFriend takes userId, but here we have friendshipId.
      // removeFriend implementation: delete where ... req=me, addr=friend or req=friend, addr=me.
      // But rejectFriendRequest takes friendshipId and sets status=rejected.
      // Usually canceling a sent request implies DELETING it.
      // Let's check removeFriend implementation in lib.
      // It takes friendId (user ID), not friendshipId.
      // But here we have the friendship object.
      // Wait, removeFriend takes user ID.
      // rejectFriendRequest takes friendship ID.
      // I should probably use a delete function by ID.
      // For now, I'll use reject logic if status is pending?
      // Actually, let's look at the sent request cancellation logic.
      // dispatch was: cancelFriendRequest with friendshipId.
      // I need a function to delete a friendship by ID.
      // The lib doesn't seem to have "deleteFriendshipById".
      // removeFriend removes by user ID match.
      // reject updates status to rejected.
      // I will assume for now I can use rejectFriendRequest (which updates status) or I should implement a distinct delete.
      // But wait, "Cancelar" usually means "Delete".
      // Let's check if there is a delete function.
      // removeFriend deletes from DB. It takes friendId.
      // sentRequest has addressee.
      // So I can call removeFriend(request.addressee_id).
      const request = sentRequests.find(r => r.id === id);
      if (request && request.addressee) {
        await removeFriend(request.addressee.id);
        await loadData();
      }
    } catch (error) {
      console.error("Error canceling request:", error);
    }
  }

  function getOtherUser(friendship: Friendship) {
    // Return the other user in the friendship
    return friendship.requester || friendship.addressee;
  }

  if (loading) {
    return (
      <div className="friends-list loading">
        <div className="skeleton-card"></div>
        <div className="skeleton-card"></div>
        <div className="skeleton-card"></div>
      </div>
    );
  }

  return (
    <div className="friends-list">
      {showTabs && !userId && (
        <div className="friends-tabs">
          <button
            className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Amigos
            {friends.length > 0 && <span className="count">{friends.length}</span>}
          </button>
          <button
            className={`tab ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            Solicitudes
            {receivedRequests.length > 0 && <span className="count badge">{receivedRequests.length}</span>}
          </button>
          <button
            className={`tab ${activeTab === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            Enviadas
            {sentRequests.length > 0 && <span className="count">{sentRequests.length}</span>}
          </button>
        </div>
      )}

      <div className="friends-content">
        {activeTab === 'friends' && (
          <div className="friends-grid">
            {friends.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <p>No tienes amigos aún</p>
                <span>¡Comienza a agregar amigos!</span>
              </div>
            ) : (
              friends.map((friendship) => {
                const user = getOtherUser(friendship);
                if (!user) return null;
                return (
                  <div key={friendship.id} className="friend-card-container">
                    <a
                      href={`/profile/${user.username}`}
                      className="friend-card"
                    >
                      <div className="friend-avatar">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} />
                        ) : (
                          <div className="avatar-placeholder">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="friend-info">
                        <span className="friend-name">
                          {user.display_name || user.username}
                        </span>
                        <span className="friend-username">@{user.username}</span>
                      </div>
                    </a>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'received' && (
          <div className="friends-grid">
            {receivedRequests.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                <p>No hay solicitudes pendientes</p>
                <span>Cuando alguien te envíe una solicitud, aparecerá aquí</span>
              </div>
            ) : (
              receivedRequests.map((request) => {
                const user = request.requester;
                if (!user) return null;
                return (
                  <div key={request.id} className="friend-card request">
                    <a href={`/profile/${user.username}`} className="friend-link">
                      <div className="friend-avatar">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} />
                        ) : (
                          <div className="avatar-placeholder">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="friend-info">
                        <span className="friend-name">
                          {user.display_name || user.username}
                        </span>
                        <span className="friend-username">@{user.username}</span>
                      </div>
                    </a>
                    <div className="request-actions">
                      <button
                        className="btn-accept"
                        onClick={() => handleAccept(request.id)}
                      >
                        Aceptar
                      </button>
                      <button
                        className="btn-reject"
                        onClick={() => handleReject(request.id)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'sent' && (
          <div className="friends-grid">
            {sentRequests.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <p>No hay solicitudes enviadas</p>
                <span>Busca usuarios y envía solicitudes de amistad</span>
              </div>
            ) : (
              sentRequests.map((request) => {
                const user = request.addressee;
                if (!user) return null;
                return (
                  <div key={request.id} className="friend-card sent">
                    <a href={`/profile/${user.username}`} className="friend-link">
                      <div className="friend-avatar">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} />
                        ) : (
                          <div className="avatar-placeholder">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="friend-info">
                        <span className="friend-name">
                          {user.display_name || user.username}
                        </span>
                        <span className="friend-username">@{user.username}</span>
                      </div>
                    </a>
                    <button
                      className="btn-cancel"
                      onClick={() => handleCancel(request.id)}
                    >
                      Cancelar
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
