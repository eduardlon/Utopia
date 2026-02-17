import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase/client';

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

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function OnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageTarget, setMessageTarget] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messageTarget) {
      loadUserAndConversation(messageTarget.id);
    }
  }, [messageTarget]);

  async function loadOnlineUsers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

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

  async function loadUserAndConversation(recipientId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    try {
      const { data: existingConvos } = await (supabase as any)
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      let convId: string | null = null;

      if (existingConvos && existingConvos.length > 0) {
        const convoIds = existingConvos.map((c: any) => c.conversation_id);
        const { data: sharedConvos } = await (supabase as any)
          .from('conversation_participants')
          .select('conversation_id, conversations!inner(type)')
          .eq('user_id', recipientId)
          .in('conversation_id', convoIds)
          .eq('conversations.type', 'direct');

        if (sharedConvos && sharedConvos.length > 0) {
          convId = sharedConvos[0].conversation_id;
        }
      }

      if (!convId) {
        const { data: newConvo } = await (supabase as any)
          .from('conversations')
          .insert({ type: 'direct' })
          .select('id')
          .single();

        if (newConvo) {
          convId = newConvo.id;
          await (supabase as any)
            .from('conversation_participants')
            .insert([
              { conversation_id: convId, user_id: user.id },
              { conversation_id: convId, user_id: recipientId },
            ]);
        }
      }

      setConversationId(convId);

      if (convId) {
        loadMessages(convId);
        subscribeToMessages(convId);
      }
    } catch (e) {
      console.error('Error loading chat:', e);
    }
  }

  async function loadMessages(convId: string) {
    const { data } = await (supabase as any)
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) setMessages(data);
  }

  function subscribeToMessages(convId: string) {
    supabase
      .channel(`messages:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !userId) return;

    const content = newMessage.trim();
    setNewMessage('');

    await (supabase as any)
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
      });
  }

  function openChat(user: OnlineUser) {
    setMessageTarget({
      id: user.user_id,
      name: user.profile?.display_name || user.profile?.username || 'Usuario',
      avatar: user.profile?.avatar_url || undefined,
    });
    setIsMobileChatOpen(true);
  }

  function closeChat() {
    setIsMobileChatOpen(false);
    setMessageTarget(null);
    setMessages([]);
    setConversationId(null);
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
    <>
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
                    openChat(u);
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
      </div>

      {/* Mobile Chat Modal */}
      {isMobileChatOpen && messageTarget && typeof window !== 'undefined' && createPortal(
        <div className="mobile-chat-overlay" onClick={closeChat}>
          <div className="mobile-chat-container" onClick={e => e.stopPropagation()}>
            <div className="mobile-chat-header">
              <button className="mc-back-btn" onClick={closeChat}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <img 
                src={messageTarget.avatar || '/images/default-avatar.svg'} 
                alt={messageTarget.name}
                className="mc-avatar"
              />
              <div className="mc-user-info">
                <span className="mc-name">{messageTarget.name}</span>
                <span className="mc-status">En línea</span>
              </div>
              <a href={`/profile/${messageTarget.id}`} className="mc-profile-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </a>
            </div>
            
            <div className="mobile-chat-messages">
              {messages.length === 0 ? (
                <div className="mc-empty">
                  <p>No hay mensajes aún</p>
                  <p className="mc-empty-hint">¡Envía el primer mensaje!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`mc-message ${msg.sender_id === userId ? 'sent' : 'received'}`}
                  >
                    <div className="mc-bubble">
                      <p>{msg.content}</p>
                      <span className="mc-time">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="mobile-chat-input" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                autoFocus
              />
              <button type="submit" disabled={!newMessage.trim()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>,
        document.body
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

        .ou-status-dot.online { background: #22c55e; }
        .ou-status-dot.away { background: #f59e0b; }

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

        /* Mobile Chat Styles */
        .mobile-chat-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 9999;
          display: none;
        }

        .mobile-chat-container {
          position: fixed;
          inset: 0;
          background: linear-gradient(180deg, #0a0a0a 0%, #121212 100%);
          z-index: 10000;
          display: flex;
          flex-direction: column;
        }

        .mobile-chat-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .mc-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
        }

        .mc-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(34, 197, 94, 0.3);
        }

        .mc-user-info {
          flex: 1;
          min-width: 0;
        }

        .mc-name {
          display: block;
          font-size: 1rem;
          font-weight: 600;
          color: white;
        }

        .mc-status {
          font-size: 0.75rem;
          color: #22c55e;
        }

        .mc-profile-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.7);
        }

        .mobile-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mc-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.4);
        }

        .mc-empty p { margin: 0; }
        .mc-empty-hint { font-size: 0.85rem; margin-top: 0.5rem !important; }

        .mc-message {
          display: flex;
          max-width: 80%;
        }

        .mc-message.sent {
          margin-left: auto;
        }

        .mc-message.received {
          margin-right: auto;
        }

        .mc-bubble {
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          position: relative;
        }

        .mc-message.sent .mc-bubble {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          border-bottom-right-radius: 0.25rem;
        }

        .mc-message.received .mc-bubble {
          background: rgba(255, 255, 255, 0.08);
          border-bottom-left-radius: 0.25rem;
        }

        .mc-bubble p {
          margin: 0;
          color: white;
          font-size: 0.95rem;
          word-wrap: break-word;
        }

        .mc-time {
          display: block;
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 0.25rem;
          text-align: right;
        }

        .mc-message.received .mc-time {
          text-align: left;
        }

        .mobile-chat-input {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.5);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .mobile-chat-input input {
          flex: 1;
          padding: 0.875rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          color: white;
          font-size: 1rem;
          outline: none;
        }

        .mobile-chat-input input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .mobile-chat-input input:focus {
          border-color: rgba(34, 197, 94, 0.3);
        }

        .mobile-chat-input button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          transition: transform 0.2s, opacity 0.2s;
        }

        .mobile-chat-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mobile-chat-input button:not(:disabled):hover {
          transform: scale(1.05);
        }

        /* Show mobile chat on small screens */
        @media (max-width: 768px) {
          .mobile-chat-overlay {
            display: block;
          }
          
          .ou-msg-btn {
            opacity: 1 !important;
          }
        }

        /* Hide on desktop - use original modal */
        @media (min-width: 769px) {
          .mobile-chat-overlay {
            display: none !important;
          }
          
          .mobile-chat-container {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

import React from 'react';
