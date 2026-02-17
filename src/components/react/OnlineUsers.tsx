import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import MessageModal from './MessageModal';

interface OnlineUser {
  user_id: string;
  status: string;
  last_seen: string;
  profile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export default function OnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageTarget, setMessageTarget] = useState<{ id: string; name: string; rect?: DOMRect } | null>(null);

  useEffect(() => {
    loadOnlineUsers();
    const interval = setInterval(loadOnlineUsers, 30000);

    const channel = supabase
      .channel('online-presence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, () => {
        loadOnlineUsers();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadOnlineUsers() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Fetch accepted friendships to get friend IDs
      const { data: friendships } = await (supabase as any)
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const friendIds = (friendships || []).map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      if (friendIds.length === 0) {
        setOnlineUsers([]);
        setLoading(false);
        return;
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data, error } = await (supabase as any)
        .from('user_presence')
        .select(`
          user_id,
          status,
          last_seen,
          profile:profiles!user_presence_user_id_fkey(username, display_name, avatar_url)
        `)
        .gte('last_seen', fiveMinutesAgo)
        .in('status', ['online', 'away'])
        .in('user_id', friendIds)
        .order('last_seen', { ascending: false })
        .limit(20);

      if (!error && data) {
        setOnlineUsers(data);
      }
    } catch (err) {
      console.error('Error loading online users:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="online-users-widget">
        <div className="ou-header">
          <span className="ou-dot pulse" />
          <h3>En línea</h3>
        </div>
        <div className="ou-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="ou-skel-item">
              <div className="ou-skel-avatar" />
              <div className="ou-skel-name" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="online-users-widget">
      <div className="ou-header">
        <span className="ou-dot pulse" />
        <h3>En línea</h3>
        <span className="ou-count">{onlineUsers.length}</span>
      </div>

      {onlineUsers.length === 0 ? (
        <p className="ou-empty">Agrega amigos para ver quién está en línea</p>
      ) : (
        <div className="ou-list">
          {onlineUsers.map(u => (
            <div key={u.user_id} className="ou-item">
              <a href={`/profile/${u.profile?.username || ''}`} className="ou-item-link">
                <div className="ou-avatar-wrap">
                  <img
                    src={u.profile?.avatar_url || '/images/default-avatar.svg'}
                    alt={u.profile?.username || ''}
                    className="ou-avatar"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/default-avatar.svg';
                    }}
                  />
                  <span className={`ou-status-dot ${u.status}`} />
                </div>
                <div className="ou-info">
                  <span className="ou-name">
                    {u.profile?.display_name || u.profile?.username || 'Usuario'}
                  </span>
                  <span className="ou-status-text">
                    {u.status === 'online' ? 'Activo ahora' : 'Ausente'}
                  </span>
                </div>
              </a>
              <button
                className="ou-msg-btn"
                title="Enviar mensaje"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMessageTarget({
                    id: u.user_id,
                    name: u.profile?.display_name || u.profile?.username || 'Usuario',
                    rect: e.currentTarget.getBoundingClientRect()
                  });
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {messageTarget && (
        <MessageModal
          isOpen={true}
          onClose={() => setMessageTarget(null)}
          recipientId={messageTarget.id}
          recipientName={messageTarget.name}
          triggerRect={messageTarget.rect}
        />
      )}

      <style>{`
        .online-users-widget {
          padding: 1rem;
        }

        .ou-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.85rem;
        }

        .ou-header h3 {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          margin: 0;
        }

        .ou-count {
          margin-left: auto;
          font-size: 0.7rem;
          font-weight: 600;
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          padding: 0.15rem 0.5rem;
          border-radius: 10px;
        }

        .ou-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
        }

        .ou-dot.pulse {
          animation: dotPulse 2s ease-in-out infinite;
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }

        .ou-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .ou-item {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 0.35rem 0.4rem;
          border-radius: 12px;
          color: inherit;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
        }

        .ou-item:hover {
          background: rgba(255,255,255,0.04);
        }

        .ou-item-link {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          text-decoration: none;
          color: inherit;
          flex: 1;
          min-width: 0;
          padding: 0.15rem 0.2rem;
        }

        .ou-msg-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.15);
          border-radius: 8px;
          color: rgba(34,197,94,0.6);
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
          margin-left: auto;
          opacity: 0;
        }

        .ou-item:hover .ou-msg-btn {
          opacity: 1;
        }

        .ou-msg-btn:hover {
          background: rgba(34,197,94,0.18);
          border-color: rgba(34,197,94,0.35);
          color: #22c55e;
          transform: scale(1.08);
        }

        .ou-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .ou-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          object-position: center;
          border: 1.5px solid rgba(255,255,255,0.08);
          background-color: rgba(34, 197, 94, 0.1);
          background-size: cover;
          background-position: center;
        }

        .ou-status-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid #0b0f0e;
        }

        .ou-status-dot.online {
          background: #22c55e;
        }

        .ou-status-dot.away {
          background: #f59e0b;
        }

        .ou-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .ou-name {
          font-size: 0.82rem;
          font-weight: 500;
          color: rgba(255,255,255,0.85);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ou-status-text {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.35);
        }

        .ou-empty {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.3);
          text-align: center;
          padding: 1rem 0;
          margin: 0;
        }

        .ou-skeleton {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .ou-skel-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.4rem 0.6rem;
        }

        .ou-skel-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          animation: shimmer 1.5s infinite;
        }

        .ou-skel-name {
          height: 12px;
          width: 80px;
          border-radius: 6px;
          background: rgba(255,255,255,0.05);
          animation: shimmer 1.5s infinite 0.1s;
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
