// PostCard component - React Island for displaying individual posts
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../../lib/supabase/client';
import type { Post, Profile, InteractionInsert } from '../../types/database';

interface PostWithAuthor extends Post {
  profiles: Profile;
  interactions?: { count: number }[];
  comments?: { count: number }[];
  post_comments?: {
    id: string;
    content: string;
    created_at: string;
    user: Profile;
  }[];
}

interface PostCardProps {
  post: PostWithAuthor;
  onUpdate: (post: PostWithAuthor) => void;
  onDelete: (postId: string) => void;
}

export default function PostCard({ post, onUpdate, onDelete }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.interactions?.[0]?.count || 0);
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count || 0);
  const [showComments, setShowComments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [comments, setComments] = useState(post.post_comments || []);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const supabase = createClient();

  // Check initial like state on mount
  useEffect(() => {
    async function checkLikeStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('interactions')
        .select('id')
        .match({ user_id: user.id, post_id: post.id, interaction_type: 'like' })
        .maybeSingle();

      if (data) setIsLiked(true);
    }
    checkLikeStatus();
  }, [post.id]);

  // Load comments from DB when comments section is opened
  useEffect(() => {
    if (showComments && !commentsLoaded) {
      loadComments();
    }
  }, [showComments]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const { data, error } = await (supabase as any)
        .from('post_comments')
        .select('*, user:profiles!post_comments_user_id_fkey(username, display_name, avatar_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setComments(data);
        setCommentCount(data.length);
      }
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoadingComments(false);
      setCommentsLoaded(true);
    }
  }, [post.id, supabase]);

  const handleLike = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isLiked) {
      await supabase
        .from('interactions')
        .delete()
        .match({ user_id: user.id, post_id: post.id, interaction_type: 'like' });
      setLikeCount(prev => prev - 1);
      setIsLiked(false);
    } else {
      const interactionData: InteractionInsert = {
        user_id: user.id,
        post_id: post.id,
        interaction_type: 'like'
      };
      await supabase
        .from('interactions')
        .insert(interactionData as any);
      setLikeCount(prev => prev + 1);
      setIsLiked(true);
    }
  }, [isLiked, post.id, supabase]);

  const confirmDelete = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setShowDeleteModal(false);
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id);

    if (!error) {
      onDelete(post.id);
    }
    setIsDeleting(false);
  }, [post.id, supabase, onDelete]);

  const handleSubmitComment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSubmittingComment(true);

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: post.id,
        user_id: user.id,
        content: newComment.trim()
      })
      .select('*, user:profiles!post_comments_user_id_fkey(username, display_name, avatar_url)')
      .single();

    if (!error && data) {
      setComments(prev => [...prev, data]);
      setCommentCount(prev => prev + 1);
      setNewComment('');
    }

    setIsSubmittingComment(false);
  }, [newComment, isSubmittingComment, post.id, supabase]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Desconocido';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `hace ${minutes}m`;
    if (hours < 24) return `hace ${hours}h`;
    if (days < 7) return `hace ${days}d`;
    return date.toLocaleDateString('es');
  };

  return (
    <article className="post-card glass">
      <header className="post-header">
        <a href={`/profile/${post.profiles.username}`} className="author-info">
          <img
            src={post.profiles.avatar_url && post.profiles.avatar_url !== '' ? post.profiles.avatar_url : '/images/default-avatar.svg'}
            alt={post.profiles.display_name || post.profiles.username}
            className="author-avatar"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/images/default-avatar.svg';
            }}
          />
          <div className="author-details">
            <span className="author-name">
              {post.profiles.display_name || post.profiles.username}
            </span>
            {post.profiles.verified && (
              <svg className="verified-badge" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
            <span className="post-time">{formatDate(post.created_at)}</span>
          </div>
        </a>
        <div className="post-actions-menu">
          <button className="action-menu-btn" aria-label="Más opciones">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          <div className="action-dropdown">
            <button onClick={confirmDelete} disabled={isDeleting} className="dropdown-item delete">
              Eliminar publicación
            </button>
          </div>
        </div>
      </header>

      <div className="post-content">
        {post.content && <p className="post-text">{post.content}</p>}

        {post.media_urls && post.media_urls.length > 0 && (
          <div className={`post-media ${post.media_urls.length > 1 ? 'grid' : 'single'}`}>
            {post.media_urls.map((url, index) => (
              <div key={index} className="media-item">
                {post.post_type === 'video' ? (
                  <video src={url} controls className="post-video" preload="metadata" />
                ) : (
                  <img src={url} alt={`Media ${index + 1}`} className="post-image" loading="lazy" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="post-footer">
        <div className="interaction-buttons">
          <button className={`interaction-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
            <svg viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{likeCount}</span>
          </button>

          <button className="interaction-btn" onClick={() => setShowComments(!showComments)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span>{commentCount}</span>
          </button>

          <button className="interaction-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Compartir</span>
          </button>
        </div>
      </footer>

      {/* Comments Section */}
      {showComments && (
        <div className="comments-section">
          <div className="comments-list">
            {loadingComments && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Cargando comentarios...</div>
            )}
            {!loadingComments && comments.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>No hay comentarios aún. ¡Sé el primero!</div>
            )}
            {comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <img
                  src={comment.user?.avatar_url && comment.user.avatar_url !== '' ? comment.user.avatar_url : '/images/default-avatar.svg'}
                  alt={comment.user?.display_name || comment.user?.username}
                  className="comment-avatar"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/default-avatar.svg';
                  }}
                />
                <div className="comment-content">
                  <div className="comment-header">
                    <span className="comment-author">{comment.user?.display_name || comment.user?.username}</span>
                    <span className="comment-time">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="comment-text">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmitComment} className="comment-form">
            <input
              type="text"
              placeholder="Escribe un comentario..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="comment-input"
              disabled={isSubmittingComment}
            />
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={!newComment.trim() || isSubmittingComment}
            >
              {isSubmittingComment ? (
                <div className="spinner-small" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal - rendered via portal to avoid overflow clipping */}
      {showDeleteModal && createPortal(
        <div className="delete-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h4>¿Eliminar publicación?</h4>
            <p>Esta acción no se puede deshacer.</p>
            <div className="delete-modal-actions">
              <button className="modal-btn modal-cancel" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button className="modal-btn modal-confirm" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .post-card {
          padding: 1.25rem;
          border-radius: 1.25rem;
          background: linear-gradient(145deg, rgba(19, 25, 23, 0.8) 0%, rgba(14, 20, 18, 0.7) 100%);
          border: 1px solid rgba(34, 197, 94, 0.1);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          animation: postFadeIn 0.5s ease both;
          position: relative;
          overflow: hidden;
        }
        .post-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.15), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .post-card:hover {
          border-color: rgba(34, 197, 94, 0.25);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 24px rgba(34, 197, 94, 0.06);
          transform: translateY(-2px);
        }
        .post-card:hover::before { opacity: 1; }

        @keyframes postFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .post-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.85rem;
        }
        .author-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .author-info:hover { opacity: 0.85; }
        .author-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          object-position: center;
          border: 2px solid rgba(34, 197, 94, 0.25);
          transition: border-color 0.2s, transform 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          background-color: rgba(34, 197, 94, 0.1);
          background-size: cover;
          background-position: center;
        }
        .author-info:hover .author-avatar {
          border-color: #22c55e;
          transform: scale(1.05);
        }
        .author-details {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .author-name {
          font-weight: 600;
          color: #fff;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .verified-badge { width: 16px; height: 16px; color: #22c55e; }
        .post-time {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 400;
        }
        .post-actions-menu { position: relative; }
        .action-menu-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-menu-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.8);
        }
        .action-menu-btn svg { width: 18px; height: 18px; }
        .action-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          background: rgba(14, 20, 18, 0.96);
          border: 1px solid rgba(34, 197, 94, 0.15);
          border-radius: 12px;
          padding: 0.35rem;
          display: none;
          min-width: 140px;
          z-index: 10;
          backdrop-filter: blur(20px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
          animation: dropIn 0.15s ease;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .post-actions-menu:hover .action-dropdown { display: block; }
        .dropdown-item {
          display: block;
          width: 100%;
          padding: 0.55rem 0.85rem;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.75);
          font-size: 0.82rem;
          text-align: left;
          cursor: pointer;
          border-radius: 8px;
          font-family: inherit;
          transition: all 0.15s;
        }
        .dropdown-item:hover { background: rgba(255, 255, 255, 0.08); }
        .dropdown-item.delete { color: #f87171; }
        .dropdown-item.delete:hover { background: rgba(239, 68, 68, 0.12); }

        .post-content { margin-bottom: 0.85rem; }
        .post-text {
          margin: 0 0 0.85rem;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.6;
          white-space: pre-wrap;
          font-size: 0.925rem;
        }
        .post-media {
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.04);
        }
        .post-media.single { max-height: 500px; }
        .post-media.grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 3px;
        }
        .media-item {
          position: relative;
          overflow: hidden;
        }
        .post-media.single .media-item { aspect-ratio: auto; }
        .post-media.grid .media-item { aspect-ratio: 1; }
        .post-image, .post-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .media-item:hover .post-image {
          transform: scale(1.03);
        }

        .post-footer {
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }
        .interaction-buttons {
          display: flex;
          gap: 0.25rem;
        }
        .interaction-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.85rem;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.84rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          font-weight: 500;
        }
        .interaction-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.85);
        }
        .interaction-btn:active {
          transform: scale(0.94);
        }
        .interaction-btn.liked {
          color: #f87171;
          background: rgba(248, 113, 113, 0.08);
        }
        .interaction-btn.liked:hover {
          background: rgba(248, 113, 113, 0.14);
        }
        .interaction-btn svg { width: 19px; height: 19px; }

        .comments-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          animation: slideDownComments 0.3s ease both;
        }
        @keyframes slideDownComments {
          from { opacity: 0; transform: translateY(-10px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 1000px; }
        }
        .comments-list {
          margin-bottom: 1rem;
          max-height: 300px;
          overflow-y: auto;
        }
        .comment-item {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 0.85rem;
          animation: commentFadeIn 0.3s ease both;
        }
        .comment-item:last-child { margin-bottom: 0; }
        @keyframes commentFadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .comment-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          object-position: center;
          border: 2px solid rgba(34, 197, 94, 0.2);
          flex-shrink: 0;
          background-color: rgba(34, 197, 94, 0.1);
          background-size: cover;
          background-position: center;
        }
        .comment-content {
          flex: 1;
          min-width: 0;
        }
        .comment-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .comment-author {
          font-weight: 600;
          font-size: 0.8rem;
          color: #fff;
        }
        .comment-time {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.4);
        }
        .comment-text {
          margin: 0;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.4;
          word-break: break-word;
        }
        .comment-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }
        .comment-input {
          flex: 1;
          padding: 0.6rem 0.9rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          color: #fff;
          font-size: 0.85rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .comment-input:focus {
          border-color: rgba(34, 197, 94, 0.4);
        }
        .comment-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .comment-submit-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #22c55e, #15803d);
          border: none;
          border-radius: 50%;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .comment-submit-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        }
        .comment-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .delete-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: modalFadeIn 0.2s ease;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .delete-modal {
          background: rgba(14, 20, 18, 0.98);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 1rem;
          padding: 2rem;
          text-align: center;
          max-width: 340px;
          width: 90%;
          backdrop-filter: blur(20px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          animation: modalSlideIn 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .delete-modal-icon {
          width: 48px; height: 48px;
          margin: 0 auto 1rem;
          display: flex; align-items: center; justify-content: center;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 50%;
          color: #f87171;
        }
        .delete-modal-icon svg { width: 24px; height: 24px; }
        .delete-modal h4 {
          margin: 0 0 0.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          color: #fff;
        }
        .delete-modal p {
          margin: 0 0 1.5rem;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
        }
        .delete-modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
        }
        .modal-btn {
          padding: 0.6rem 1.5rem;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          font-family: inherit;
          transition: all 0.2s;
        }
        .modal-cancel {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .modal-cancel:hover { background: rgba(255,255,255,0.12); }
        .modal-confirm {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
        }
        .modal-confirm:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
      `}</style>
    </article>
  );
}