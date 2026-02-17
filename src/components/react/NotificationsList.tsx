// NotificationsList component - Real-time notifications
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';

interface NotificationData {
  actor_id?: string;
  actor_username?: string;
  actor_avatar?: string;
  reference_id?: string;
  reference_type?: string;
}

interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string | null;
  data: NotificationData | null;
  read: boolean;
  created_at: string;
}

interface NotificationsListProps {
  filter?: 'all' | 'mentions' | 'follows' | 'likes';
}

export default function NotificationsList({ filter = 'all' }: NotificationsListProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Load notifications
  useEffect(() => {
    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotification = payload.new as NotificationItem;
          setNotifications(prev => [newNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = (supabase as any)
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply filter
      if (filter === 'mentions') {
        query = query.eq('type', 'mention');
      } else if (filter === 'follows') {
        query = query.in('type', ['follow', 'friend_request']);
      } else if (filter === 'likes') {
        query = query.in('type', ['like', 'reel_like']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, [supabase]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  }, [supabase]);

  // Format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es');
  };

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
      case 'reel_like':
        return (
          <span className="notification-icon like">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </span>
        );
      case 'follow':
      case 'friend_request':
        return (
          <span className="notification-icon follow">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2" fill="none"></line>
              <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2" fill="none"></line>
            </svg>
          </span>
        );
      case 'comment':
        return (
          <span className="notification-icon comment">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </span>
        );
      case 'mention':
        return (
          <span className="notification-icon mention">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
            </svg>
          </span>
        );
      default:
        return (
          <span className="notification-icon default">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </span>
        );
    }
  };

  // Get notification link
  const getNotificationLink = (notification: NotificationItem): string => {
    const data = notification.data;
    if (!data) return '#';
    switch (data.reference_type) {
      case 'post':
        return `/feed?post=${data.reference_id}`;
      case 'reel':
        return `/reels?reel=${data.reference_id}`;
      case 'profile':
        return `/profile/${data.actor_username}`;
      default:
        return '#';
    }
  };

  if (loading) {
    return (
      <div className="notifications-loading">
        <div className="loading-spinner"></div>
        <p>Cargando notificaciones...</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="empty-notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <h3>No hay notificaciones</h3>
        <p>Cuando alguien interactúe contigo, lo verás aquí</p>
      </div>
    );
  }

  // Group notifications by date
  const groupedNotifications = notifications.reduce((groups, notification) => {
    const date = new Date(notification.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Ayer';
    } else if (today.getTime() - date.getTime() < 7 * 86400000) {
      key = 'Esta semana';
    } else {
      key = 'Anteriores';
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notification);
    return groups;
  }, {} as Record<string, NotificationItem[]>);

  return (
    <div className="notifications-list">
      {/* Mark all as read button */}
      {notifications.some(n => !n.read) && (
        <button className="mark-all-btn" onClick={markAllAsRead}>
          Marcar todas como leídas
        </button>
      )}

      {/* Grouped notifications */}
      {Object.entries(groupedNotifications).map(([section, items]) => (
        <div key={section} className="notification-section">
          <h3 className="section-title">{section}</h3>
          {items.map(notification => (
            <a
              key={notification.id}
              href={getNotificationLink(notification)}
              className={`notification-item ${!notification.read ? 'unread' : ''}`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="notification-avatar">
                <img
                  src={notification.data?.actor_avatar || '/images/default-avatar.svg'}
                  alt={notification.data?.actor_username || 'Usuario'}
                />
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <p>
                  {notification.data?.actor_username && (
                    <strong>@{notification.data.actor_username}</strong>
                  )}{' '}
                  {notification.content || notification.title}
                </p>
                <span className="notification-time">
                  {formatTimeAgo(notification.created_at)}
                </span>
              </div>
            </a>
          ))}
        </div>
      ))}

      <style>{`
        .notifications-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .mark-all-btn {
          align-self: flex-end;
          padding: 0.5rem 1rem;
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 0.5rem;
          color: #22c55e;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mark-all-btn:hover {
          background: rgba(34, 197, 94, 0.25);
        }

        .notifications-loading, .empty-notifications {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(34, 197, 94, 0.3);
          border-top-color: #22c55e;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-notifications svg {
          width: 64px;
          height: 64px;
          color: rgba(34, 197, 94, 0.5);
          margin-bottom: 1rem;
        }

        .empty-notifications h3 {
          margin: 0 0 0.5rem;
          font-size: 1.125rem;
          color: #fff;
        }

        .empty-notifications p {
          margin: 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.875rem;
        }

        .notification-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .notification-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(18, 18, 18, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0.75rem;
          text-decoration: none;
          transition: all 0.2s;
        }

        .notification-item:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateX(4px);
        }

        .notification-item.unread {
          background: rgba(34, 197, 94, 0.08);
          border-color: rgba(34, 197, 94, 0.2);
        }

        .notification-avatar {
          position: relative;
          flex-shrink: 0;
        }

        .notification-avatar img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
        }

        .notification-icon {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 2px solid #0a0a0a;
        }

        .notification-icon svg {
          width: 12px;
          height: 12px;
        }

        .notification-icon.like {
          background: #ef4444;
          color: white;
        }

        .notification-icon.follow {
          background: #22c55e;
          color: white;
        }

        .notification-icon.comment {
          background: #3b82f6;
          color: white;
        }

        .notification-icon.mention {
          background: #8b5cf6;
          color: white;
        }

        .notification-icon.default {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-content p {
          margin: 0;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.4;
        }

        .notification-content strong {
          color: #fff;
          font-weight: 600;
        }

        .notification-time {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
