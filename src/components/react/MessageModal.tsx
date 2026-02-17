import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../../lib/supabase/client';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  triggerRect?: DOMRect;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function MessageModal({ isOpen, onClose, recipientId, recipientName, triggerRect }: MessageModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadUserAndConversation();
  }, [recipientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, remoteIsTyping]);

  // ... (rest of the file until input)

  // Inside the return JSX, in chat-body:
  /*
            {messages.map(msg => (
                // ... existing message rendering
            ))}
            {remoteIsTyping && (
                <div className="chat-message received">
                   <img src="/images/default-avatar.svg" className="msg-avatar" alt=""/>
                   <div className="msg-bubble typing-bubble">
                       <span className="dot"></span>
                       <span className="dot"></span>
                       <span className="dot"></span>
                   </div>
                </div>
            )}
            <div ref={messagesEndRef} />
  */

  // Inside form:
  /*
            <input 
                // ...
                onChange={e => {
                    setNewMessage(e.target.value);
                    handleTyping();
                }}
            />
  */

  async function loadUserAndConversation() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    try {
      // 1. Find conversation
      // We first try to fetch conversations the user is part of.
      // If this fails with 403, it's likely an RLS issue.
      const { data: existingConvos, error: fetchError } = await (supabase as any)
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (fetchError) {
        console.warn('Could not fetch existing conversations (RLS?):', fetchError);
        // If we can't create, we are stuck.
        // But maybe we can try creating anyway if we are sure?
        // No, if we can't read, we might duplicate.
        // Let's assume empty.
      }

      let convId: string | null = null;

      if (existingConvos && existingConvos.length > 0) {
        // ... (existing logic)
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

      // If not exists, create
      if (!convId) {
        const { data: newConvo, error } = await (supabase as any)
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
    } finally {
      setLoading(false);
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
    const channel = supabase
      .channel(`chat-${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        // If we receive a message, they stopped typing
        setRemoteIsTyping(false);
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== userId) {
          setRemoteIsTyping(true);
          // Clear any existing timeout
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          // Set new timeout to hide typing indicator
          typingTimeoutRef.current = setTimeout(() => {
            setRemoteIsTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  const handleTyping = async () => {
    if (!conversationId || !userId) return;

    // Broadcast typing event
    await supabase.channel(`chat-${conversationId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId }
    });
  };

  // ... inside MessageModal component

  const createConversation = async (userId: string): Promise<string | null> => {
    try {
      // Use RPC to create conversation and add participants in one atomic transaction, 
      // bypassing client-side RLS limitations for new unowned rows.
      const { data, error } = await (supabase as any).rpc('create_new_conversation', {
        recipient_id: recipientId
      });

      if (error) {
        console.error('Error creating conversation via RPC:', error);
        throw error;
      }

      const convId = data as string;

      if (convId) {
        return convId;
      }
      return null;
    } catch (e: any) {
      console.error('Error creating conversation:', e);
      alert('Error al iniciar la conversación. Inténtalo de nuevo.');
      return null;
    }
  };

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;

    let targetConvId = conversationId;

    if (!targetConvId) {
      // Try to create it now if it doesn't exist
      targetConvId = await createConversation(userId);
      if (targetConvId) {
        setConversationId(targetConvId);
        subscribeToMessages(targetConvId);
      } else {
        return; // Failed to create
      }
    }

    const content = newMessage.trim();
    setNewMessage('');

    // Set remote typing to false immediately on send
    setRemoteIsTyping(false);

    const { error } = await (supabase as any).from('messages').insert({
      conversation_id: targetConvId,
      sender_id: userId,
      content
    });

    if (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje. Inténtalo de nuevo.');
      setNewMessage(content); // Restore message
    }
  }

  // Calculate position
  const getStyle = () => {
    if (!triggerRect) return {
      position: 'fixed' as const,
      bottom: '20px',
      right: '20px',
      zIndex: 9999
    };

    const width = 320;
    const height = 400;
    const gap = 8;

    // Position below the button
    let top = triggerRect.bottom + gap;

    // Align right edge of modal with right edge of button (assuming button is on the right side)
    let left = triggerRect.right - width;

    // If aligning right pushes it off-screen to the left, align left instead
    if (left < 10) {
      left = triggerRect.left;
      // If aligning left pushes it off-screen to the right, adjust
      if (left + width > window.innerWidth) {
        left = window.innerWidth - width - 10;
      }
    }

    // Check vertical overflow
    if (top + height > window.innerHeight) {
      // If not enough space below, place above
      top = triggerRect.top - height - gap;
      if (top < 10) top = 10; // Cap at top
    }

    if (window.innerWidth < 768) {
      return {
        position: 'fixed' as const,
        bottom: '0',
        left: '0',
        width: '100%',
        height: '60%',
        zIndex: 9999,
        borderRadius: '16px 16px 0 0',
        borderBottom: 'none'
      };
    }

    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: 9999
    };
  };

  const style = getStyle();

  const handlePlaceholderClick = (feature: string) => {
    alert(`La función de ${feature} estará disponible pronto.`);
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="chat-window" style={style} onClick={e => e.stopPropagation()}>
        <div className="chat-header">
          <div className="chat-user-info">
            <div className="chat-avatar-container">
              <img src="/images/default-avatar.svg" alt="" className="chat-avatar-img" />
              <span className="chat-status-dot online"></span>
            </div>
            <div className="chat-details">
              <span className="chat-username">{recipientName}</span>
              <span className="chat-status-text">En línea</span>
            </div>
          </div>
          <div className="chat-header-actions">
            <button className="chat-action-btn" onClick={() => handlePlaceholderClick('llamada de voz')} title="Llamada de voz">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.2-.5-2.3-.5-3.6 0-.5-.4-1-1-1H4c-.5 0-1 .4-1 1 0 9.4 7.6 17 17 17 .5 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1zM19 12h2a9 9 0 0 0-9-9v2a7 7 0 0 1 7 7z" /></svg>
            </button>
            <button className="chat-action-btn" onClick={() => handlePlaceholderClick('videollamada')} title="Videollamada">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
            </button>
            <button className="chat-action-btn" onClick={() => window.location.href = '/messages'} title="Ver conversación completa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" />
              </svg>
            </button>
            <button className="chat-action-btn close-btn" onClick={onClose} title="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div className="chat-body">
          {loading ? (
            <div className="chat-loading"><div className="spinner"></div></div>
          ) : (
            <>
              {messages.length === 0 && <div className="chat-empty">Envía un mensaje para comenzar</div>}
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.sender_id === userId ? 'sent' : 'received'}`}>
                  {msg.sender_id !== userId && <img src="/images/default-avatar.svg" className="msg-avatar" alt="" />}
                  <div className="msg-bubble">
                    {msg.content}
                  </div>
                </div>
              ))}
              {remoteIsTyping && (
                <div className="chat-message received">
                  <img src="/images/default-avatar.svg" className="msg-avatar" alt="" />
                  <div className="msg-bubble typing-bubble">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <form className="chat-footer" onSubmit={sendMessage}>
          <div className="chat-input-actions">
            <button type="button" className="chat-icon-btn" onClick={() => handlePlaceholderClick('adjuntar archivo')} title="Adjuntar archivo">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" /><path d="M11 7h2v10h-2zM7 11h10v2H7z" fill="currentColor" /></svg>
            </button>
            <button type="button" className="chat-icon-btn" onClick={() => handlePlaceholderClick('enviar imagen')} title="Enviar imagen">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </button>
          </div>
          <div className="chat-input-wrapper">
            <input
              type="text"
              className="chat-input"
              placeholder="Aa"
              value={newMessage}
              onChange={e => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
            />
            <button type="button" className="chat-emoji-btn" onClick={() => handlePlaceholderClick('emojis')}>😊</button>
          </div>
          <button type="submit" className="chat-send-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </form>

        <style>{`
            /* ... existing styles ... */
            .typing-bubble {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 12px 14px;
                min-height: 36px;
            }
            
            .dot {
                width: 6px;
                height: 6px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 50%;
                animation: typing 1.4s infinite ease-in-out both;
            }
            
            .dot:nth-child(1) { animation-delay: -0.32s; }
            .dot:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes typing {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }

            .chat-window {
                background: rgba(10, 14, 12, 0.85); /* Semi-transparent dark background */
                backdrop-filter: blur(12px); /* Glass effect */
                -webkit-backdrop-filter: blur(12px);
                border-radius: 12px;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.1);
                animation: popIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
            }


            @keyframes popIn {
                from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .chat-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                background: rgba(255, 255, 255, 0.03);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }

            .chat-user-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .chat-avatar-container {
                position: relative;
            }

            .chat-avatar-img {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                object-fit: cover;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .chat-status-dot {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 10px;
                height: 10px;
                background: #22c55e;
                border: 2px solid rgba(10, 14, 12, 0.9);
                border-radius: 50%;
            }

            .chat-details {
                display: flex;
                flex-direction: column;
                line-height: 1.2;
            }

            .chat-username {
                font-weight: 600;
                font-size: 0.95rem;
                color: rgba(255, 255, 255, 0.95);
            }

            .chat-status-text {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.6);
            }

            .chat-header-actions {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .chat-action-btn {
                background: transparent;
                border: none;
                color: #22c55e;
                cursor: pointer;
                padding: 6px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            
            .chat-action-btn:hover {
                background: rgba(34, 197, 94, 0.15);
            }

            .close-btn {
                color: rgba(255, 255, 255, 0.6);
            }
            .close-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }

            .chat-body {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                /* Scrollbar styling */
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
            }
            
            .chat-body::-webkit-scrollbar {
                width: 4px;
            }
            .chat-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
            }
            
            .chat-loading, .chat-empty {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.9rem;
            }
            
            .spinner {
                width: 24px;
                height: 24px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-top-color: #22c55e;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            .chat-message {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                max-width: 85%;
            }

            .chat-message.sent {
                align-self: flex-end;
                flex-direction: row-reverse;
            }

            .msg-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                margin-bottom: 4px;
            }

            .msg-bubble {
                padding: 8px 14px;
                border-radius: 18px;
                font-size: 0.9rem;
                line-height: 1.4;
                word-wrap: break-word;
            }

            .received .msg-bubble {
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.9);
                border-bottom-left-radius: 4px;
            }

            .sent .msg-bubble {
                background: #22c55e;
                color: white;
                border-bottom-right-radius: 4px;
                box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
            }

            .chat-footer {
                padding: 10px 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(0, 0, 0, 0.2);
                flex-shrink: 0;
            }

            .chat-input-actions {
                display: flex;
                gap: 4px;
            }

            .chat-icon-btn {
                background: transparent;
                border: none;
                color: #22c55e;
                cursor: pointer;
                padding: 6px;
                border-radius: 50%;
                transition: background 0.2s;
            }
            .chat-icon-btn:hover {
                background: rgba(34, 197, 94, 0.1);
            }

            .chat-input-wrapper {
                flex: 1;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                display: flex;
                align-items: center;
                padding: 0 12px;
                height: 38px;
                transition: border-color 0.2s, background 0.2s;
                min-width: 0; /* Important for flex shrinking */
            }
            .chat-input-wrapper:focus-within {
                border-color: rgba(34, 197, 94, 0.4);
                background: rgba(255, 255, 255, 0.08);
            }

            .chat-input {
                flex: 1;
                background: transparent;
                border: none;
                color: white;
                font-size: 0.9rem;
                outline: none;
                font-family: inherit;
            }

            .chat-input::placeholder {
                color: rgba(255, 255, 255, 0.3);
            }

            .chat-emoji-btn {
                background: transparent;
                border: none;
                cursor: pointer;
                font-size: 1.1rem;
                opacity: 0.6;
                transition: opacity 0.2s;
            }
            .chat-emoji-btn:hover {
                opacity: 1;
            }

            .chat-send-btn {
                background: #22c55e;
                border: none;
                color: white;
                cursor: pointer;
                padding: 0;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
                border-radius: 50%;
                margin-left: 8px;
                z-index: 10;
                box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
            }
            
            .chat-send-btn:hover:not(:disabled) {
                background: #16a34a;
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
            }

            .chat-send-btn:disabled {
                background: #3f3f46;
                color: rgba(255, 255, 255, 0.3);
                cursor: not-allowed;
                box-shadow: none;
            }
        `}</style>
      </div>
    </>,
    document.body
  );
}
