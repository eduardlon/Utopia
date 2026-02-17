// ReelsViewer component - Vertical video player with scroll navigation
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { Profile } from '../../types/database';

interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  audio_name: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  profiles: Profile;
  liked?: boolean;
  saved?: boolean;
}

export default function ReelsViewer() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  // const supabase = createClient(); (Already imported singleton)

  // Load reels from database
  useEffect(() => {
    loadReels();
  }, []);

  async function loadReels() {
    try {
      const { data, error } = await (supabase as any)
        .from('reels')
        .select(`
          *,
          profiles:user_id (id, username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (data && data.length > 0) {
        setReels(data);
        // Auto-play first reel
        if (data[0]) {
          setPlaying(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading reels:', error);
    } finally {
      setLoading(false);
    }
  }

  // Handle scroll to determine current reel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const height = container.clientHeight;
      const newIndex = Math.round(scrollTop / height);

      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < reels.length) {
        setCurrentIndex(newIndex);

        // Pause all videos and play current
        videoRefs.current.forEach((video, id) => {
          if (id === reels[newIndex]?.id) {
            video.play().catch(() => { });
            setPlaying(id);
          } else {
            video.pause();
          }
        });
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentIndex, reels]);

  // Toggle play/pause
  const togglePlay = useCallback((reelId: string) => {
    const video = videoRefs.current.get(reelId);
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => { });
      setPlaying(reelId);
    } else {
      video.pause();
      setPlaying(null);
    }
  }, []);

  // Handle like
  const handleLike = useCallback(async (reelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setReels(prev => prev.map(reel => {
      if (reel.id === reelId) {
        return {
          ...reel,
          liked: !reel.liked,
          likes_count: reel.liked ? reel.likes_count - 1 : reel.likes_count + 1
        };
      }
      return reel;
    }));

    // Toggle like in database
    await (supabase as any)
      .from('reel_likes')
      .upsert({ user_id: user.id, reel_id: reelId });
  }, [supabase]);

  // Handle save
  const handleSave = useCallback(async (reelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setReels(prev => prev.map(reel => {
      if (reel.id === reelId) {
        return { ...reel, saved: !reel.saved };
      }
      return reel;
    }));

    // Toggle save in database
    await (supabase as any)
      .from('reel_saves')
      .upsert({ user_id: user.id, reel_id: reelId });
  }, [supabase]);

  // Format count
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Styles
  const styles = (
    <style>{`
      .reels-container {
        position: relative;
        height: calc(100vh - 64px);
        height: calc(100dvh - 64px);
        overflow-y: scroll;
        scroll-snap-type: y mandatory;
        scroll-behavior: smooth;
        background: #000;
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      @media (min-width: 768px) {
        .reels-container {
          max-width: 480px;
          margin: 0 auto;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
        }
      }

      @media (max-width: 767px) {
        .reels-container {
          height: calc(100vh - 64px - 64px);
          height: calc(100dvh - 64px - 64px);
        }
      }

      .reels-container::-webkit-scrollbar { display: none; }

      .reels-loading, .empty-reels {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: calc(100vh - 64px);
        height: calc(100dvh - 64px);
        background: linear-gradient(180deg, rgba(10,14,12,0.95) 0%, rgba(5,8,6,0.98) 100%);
        color: white;
        text-align: center;
        padding: 2rem;
        gap: 1rem;
        overflow: hidden;
        position: relative;
      }

      @media (max-width: 767px) {
        .reels-loading, .empty-reels {
          height: calc(100vh - 64px - 64px);
          height: calc(100dvh - 64px - 64px);
        }
      }

      .empty-reels-bg {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }

      .floating-particle {
        position: absolute;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(34,197,94,0.15), transparent 70%);
        animation: floatParticle 8s ease-in-out infinite;
      }
      .floating-particle.p1 { width: 200px; height: 200px; top: 10%; left: -5%; animation-delay: 0s; }
      .floating-particle.p2 { width: 150px; height: 150px; top: 60%; right: -5%; animation-delay: 2s; }
      .floating-particle.p3 { width: 100px; height: 100px; bottom: 15%; left: 20%; animation-delay: 4s; }
      .floating-particle.p4 { width: 120px; height: 120px; top: 25%; right: 15%; animation-delay: 6s; }

      @keyframes floatParticle {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
        50% { transform: translate(20px, -20px) scale(1.1); opacity: 0.6; }
      }

      .loading-spinner {
        width: 44px;
        height: 44px;
        border: 3px solid rgba(34, 197, 94, 0.2);
        border-top-color: #22c55e;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }

      @keyframes spin { to { transform: rotate(360deg); } }

      .empty-reels-content {
        max-width: 400px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
        animation: emptyStateFadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) both;
      }

      @keyframes emptyStateFadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .empty-reels-icon {
        position: relative;
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05));
        border: 2px solid rgba(34, 197, 94, 0.2);
        border-radius: 50%;
        animation: iconPulse 3s ease-in-out infinite;
      }

      .icon-glow {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        background: linear-gradient(45deg, rgba(34, 197, 94, 0.3), transparent, rgba(16, 185, 129, 0.3));
        opacity: 0;
        animation: glowPulse 3s ease-in-out infinite;
      }

      @keyframes iconPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      @keyframes glowPulse {
        0%, 100% { opacity: 0; }
        50% { opacity: 0.6; }
      }

      .empty-reels-icon svg {
        width: 48px;
        height: 48px;
        color: rgba(34, 197, 94, 0.7);
        z-index: 1;
        position: relative;
      }

      .empty-reels-text {
        text-align: center;
      }

      .empty-reels h3 { 
        margin: 0 0 0.5rem; 
        font-size: 1.5rem; 
        font-weight: 700; 
        color: rgba(255,255,255,0.95);
        background: linear-gradient(135deg, #fff, rgba(255,255,255,0.8));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .empty-reels p { 
        margin: 0; 
        color: rgba(255, 255, 255, 0.6); 
        font-size: 1rem; 
        max-width: 320px; 
        line-height: 1.6; 
        font-weight: 400;
      }

      .empty-reels-actions {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
        width: 100%;
      }

      .empty-reels-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.8rem 1.5rem;
        border-radius: 16px;
        color: white;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
        font-family: inherit;
        border: none;
        min-width: 180px;
        justify-content: center;
      }

      .empty-reels-btn.primary {
        background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
        box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 1rem;
        padding: 1rem 2rem;
        letter-spacing: 0.5px;
      }

      .empty-reels-btn.primary:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 32px rgba(34, 197, 94, 0.6);
        background: linear-gradient(135deg, #2ce674 0%, #1ea04d 100%);
      }

      .empty-reels-btn.secondary {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        color: rgba(255, 255, 255, 0.9);
      }

      .empty-reels-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.25);
        transform: translateY(-1px);
      }

      .reel-item {
        position: relative;
        height: calc(100vh - 64px);
        scroll-snap-align: start;
        scroll-snap-stop: always;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #050505;
        cursor: pointer;
        overflow: hidden;
      }

      @media (max-width: 767px) {
        .reel-item {
          height: calc(100dvh - 64px - 64px);
        }
      }

      .reel-video-container {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .reel-video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: opacity 0.4s ease;
      }

      .video-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to bottom,
          rgba(0,0,0,0.15) 0%,
          transparent 20%,
          transparent 50%,
          rgba(0, 0, 0, 0.75) 100%
        );
        pointer-events: none;
      }

      .reel-info {
        position: absolute;
        bottom: 72px;
        left: 16px;
        right: 72px;
        z-index: 10;
        animation: infoSlideUp 0.5s cubic-bezier(0.4,0,0.2,1) both;
      }

      @keyframes infoSlideUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .reel-user {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .user-avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.25);
        object-fit: cover;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
        transition: border-color 0.2s;
      }
      .user-avatar:hover { border-color: #22c55e; }

      .user-details {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .username {
        font-weight: 600;
        color: white;
        font-size: 0.9rem;
        text-shadow: 0 1px 4px rgba(0,0,0,0.5);
      }

      .follow-btn {
        padding: 5px 14px;
        background: rgba(34,197,94,0.9);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        backdrop-filter: blur(8px);
        letter-spacing: 0.02em;
      }
      .follow-btn:hover { background: #22c55e; transform: scale(1.05); }
      .follow-btn:active { transform: scale(0.96); }

      .reel-caption {
        color: rgba(255,255,255,0.92);
        font-size: 0.85rem;
        margin: 0 0 8px;
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }

      .reel-audio {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(12px);
        border-radius: 20px;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.72rem;
        font-weight: 500;
      }

      .reel-audio svg { width: 13px; height: 13px; }

      .reel-actions {
        position: absolute;
        bottom: 90px;
        right: 12px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        z-index: 10;
        animation: actionsSlideIn 0.5s cubic-bezier(0.4,0,0.2,1) 0.1s both;
      }

      @keyframes actionsSlideIn {
        from { opacity: 0; transform: translateX(12px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .action-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.4,0,0.2,1);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      .action-btn:hover { transform: scale(1.12); }
      .action-btn:active { transform: scale(0.9); }

      .action-btn svg { width: 28px; height: 28px; }

      .action-btn.liked svg {
        color: #f87171;
        animation: likeHeart 0.4s cubic-bezier(0.4,0,0.2,1);
      }
      .action-btn.saved svg { color: #fbbf24; }

      @keyframes likeHeart {
        0% { transform: scale(1); }
        30% { transform: scale(1.3); }
        60% { transform: scale(0.9); }
        100% { transform: scale(1); }
      }

      .action-count {
        font-size: 0.7rem;
        font-weight: 500;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }

      .play-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 72px;
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 50%;
        pointer-events: none;
        animation: playFade 0.3s ease both;
      }

      @keyframes playFade {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      .play-indicator svg {
        width: 32px;
        height: 32px;
        color: white;
        margin-left: 3px;
      }

      .reel-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.15);
        z-index: 20;
      }

      .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #22c55e, #4ade80);
        border-radius: 0 2px 2px 0;
        transition: width 0.1s linear;
      }

      .scroll-hint {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.7rem;
        font-weight: 500;
        animation: hintBounce 2.5s ease-in-out infinite;
        z-index: 100;
        pointer-events: none;
        text-shadow: 0 1px 4px rgba(0,0,0,0.6);
      }

      .scroll-hint svg { width: 18px; height: 18px; }

      @keyframes hintBounce {
        0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.5; }
        50% { transform: translateX(-50%) translateY(6px); opacity: 1; }
      }
    `}</style>
  );

  if (loading) {
    return (
      <>
        <div className="reels-loading">
          <div className="loading-spinner"></div>
          <p>Cargando reels...</p>
        </div>
        {styles}
      </>
    );
  }

  if (reels.length === 0) {
    return (
      <>
        <div className="empty-reels">
          <div className="empty-reels-bg">
            <div className="floating-particle p1" />
            <div className="floating-particle p2" />
            <div className="floating-particle p3" />
            <div className="floating-particle p4" />
          </div>
          <div className="empty-reels-content">
            <div className="empty-reels-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              <div className="icon-glow"></div>
            </div>

            <div className="empty-reels-text">
              <h3>No hay reels todavía</h3>
              <p>Sé el primero en compartir un momento con la comunidad de Utopía</p>
            </div>

            <div className="empty-reels-actions">
              <button className="empty-reels-btn primary" onClick={() => window.location.href = '/feed'}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
        {styles}
      </>
    );
  }

  return (
    <div className="reels-container" ref={containerRef}>
      {reels.map((reel) => (
        <div
          key={reel.id}
          className="reel-item"
          onClick={() => togglePlay(reel.id)}
        >
          {/* Video */}
          <div className="reel-video-container">
            <video
              ref={(el) => {
                if (el) videoRefs.current.set(reel.id, el);
              }}
              className="reel-video"
              src={reel.video_url}
              loop
              muted
              playsInline
              poster="/images/reel-placeholder.jpg"
            />
            <div className="video-overlay"></div>
          </div>

          {/* Info */}
          <div className="reel-info">
            <div className="reel-user">
              <img
                src={reel.profiles.avatar_url || '/images/default-avatar.svg'}
                alt={reel.profiles.username}
                className="user-avatar"
              />
              <div className="user-details">
                <span className="username">@{reel.profiles.username}</span>
                <button className="follow-btn">Seguir</button>
              </div>
            </div>
            {reel.caption && <p className="reel-caption">{reel.caption}</p>}
            {reel.audio_name && (
              <div className="reel-audio">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <span>{reel.audio_name}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="reel-actions">
            <button
              className={`action-btn ${reel.liked ? 'liked' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleLike(reel.id);
              }}
            >
              <svg viewBox="0 0 24 24" fill={reel.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span className="action-count">{formatCount(reel.likes_count)}</span>
            </button>
            <button className="action-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span className="action-count">{formatCount(reel.comments_count)}</span>
            </button>
            <button className="action-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span className="action-count">Compartir</span>
            </button>
            <button
              className={`action-btn ${reel.saved ? 'saved' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSave(reel.id);
              }}
            >
              <svg viewBox="0 0 24 24" fill={reel.saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span className="action-count">Guardar</span>
            </button>
          </div>

          {/* Play/Pause Indicator */}
          {playing !== reel.id && (
            <div className="play-indicator">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          )}

          {/* Progress Bar */}
          <div className="reel-progress">
            <div className="progress-bar"></div>
          </div>
        </div>
      ))}

      {/* Scroll Hint */}
      <div className="scroll-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span>Desliza para más</span>
      </div>

      {styles}
    </div>
  );
}
