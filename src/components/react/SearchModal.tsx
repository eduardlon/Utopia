// SearchModal component - Search for people and content
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import type { Profile } from '../../types/database';

interface SearchResult {
  type: 'user' | 'post' | 'hashtag';
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  content?: string;
  count?: number;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<Profile[]>([]);
  const supabase = createClient();

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  async function loadRecentSearches() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get recent interactions to show as suggestions
      const { data } = await (supabase as any)
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .limit(5);

      if (data) {
        setRecentSearches(data);
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }

  async function search(searchQuery: string) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Search users
      const { data: users } = await (supabase as any)
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .neq('id', user?.id || '')
        .limit(10);

      const userResults: SearchResult[] = (users || []).map((u: Profile) => ({
        type: 'user' as const,
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        bio: u.bio,
      }));

      // Search hashtags (from posts)
      const { data: posts } = await (supabase as any)
        .from('posts')
        .select('content')
        .ilike('content', `%#${searchQuery}%`)
        .limit(5);

      const hashtagResults: SearchResult[] = [];
      if (posts) {
        const hashtags = new Map<string, number>();
        posts.forEach((p: any) => {
          const matches = p.content?.match(/#\w+/g) || [];
          matches.forEach((tag: string) => {
            if (tag.toLowerCase().includes(searchQuery.toLowerCase())) {
              hashtags.set(tag, (hashtags.get(tag) || 0) + 1);
            }
          });
        });
        
        hashtags.forEach((count, tag) => {
          hashtagResults.push({
            type: 'hashtag',
            id: tag,
            content: tag,
            count,
          });
        });
      }

      setResults([...userResults, ...hashtagResults]);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleResultClick = useCallback((result: SearchResult) => {
    if (result.type === 'user') {
      window.location.href = `/profile/${result.username}`;
    } else if (result.type === 'hashtag') {
      window.location.href = `/explore?tag=${result.content?.replace('#', '')}`;
    }
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className="search-header">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Buscar personas, hashtags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button className="clear-btn" onClick={() => setQuery('')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>

        {/* Results */}
        <div className="search-results">
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Buscando...</p>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <p>No se encontraron resultados</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="results-list">
              {results.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="result-item"
                  onClick={() => handleResultClick(result)}
                >
                  {result.type === 'user' && (
                    <>
                      <div className="result-avatar">
                        {result.avatar_url ? (
                          <img 
                            src={result.avatar_url} 
                            alt={result.username}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="avatar-placeholder" style={result.avatar_url ? { display: 'none' } : {}}>
                          {result.username?.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="result-info">
                        <span className="result-name">
                          {result.display_name || result.username}
                        </span>
                        <span className="result-username">@{result.username}</span>
                      </div>
                      <svg className="result-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </>
                  )}
                  {result.type === 'hashtag' && (
                    <>
                      <div className="hashtag-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="4" y1="9" x2="20" y2="9"></line>
                          <line x1="4" y1="15" x2="20" y2="15"></line>
                          <line x1="10" y1="3" x2="8" y2="21"></line>
                          <line x1="16" y1="3" x2="14" y2="21"></line>
                        </svg>
                      </div>
                      <div className="result-info">
                        <span className="result-name">{result.content}</span>
                        <span className="result-count">
                          {result.count} publicaciones
                        </span>
                      </div>
                      <svg className="result-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recent/Suggested */}
          {!loading && query.length < 2 && (
            <div className="recent-section">
              <h3>Personas sugeridas</h3>
              <div className="results-list">
                {recentSearches.map((user) => (
                  <div
                    key={user.id}
                    className="result-item"
                    onClick={() => handleResultClick({
                      type: 'user',
                      id: user.id,
                      username: user.username,
                      display_name: user.display_name || undefined,
                      avatar_url: user.avatar_url || undefined,
                    })}
                  >
                    <div className="result-avatar">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.username}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="avatar-placeholder" style={user.avatar_url ? { display: 'none' } : {}}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="result-info">
                      <span className="result-name">
                        {user.display_name || user.username}
                      </span>
                      <span className="result-username">@{user.username}</span>
                    </div>
                    <svg className="result-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      <style>{`
        .search-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 10vh;
        }

        .search-modal {
          width: 100%;
          max-width: 500px;
          background: #121212;
          border-radius: 1rem;
          border: 1px solid rgba(34, 197, 94, 0.2);
          overflow: hidden;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .search-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .search-input-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.75rem;
        }

        .search-input-wrapper svg {
          width: 20px;
          height: 20px;
          color: rgba(255, 255, 255, 0.4);
          flex-shrink: 0;
        }

        .search-input-wrapper input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 1rem;
          outline: none;
        }

        .search-input-wrapper input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .clear-btn {
          padding: 0.25rem;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
        }

        .clear-btn svg {
          width: 18px;
          height: 18px;
        }

        .close-btn {
          padding: 0.5rem 1rem;
          background: transparent;
          border: none;
          color: #22c55e;
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
        }

        .search-results {
          max-height: 60vh;
          overflow-y: auto;
        }

        .loading-state, .empty-state {
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

        .empty-state svg {
          width: 48px;
          height: 48px;
          color: rgba(255, 255, 255, 0.3);
          margin-bottom: 1rem;
        }

        .empty-state p, .loading-state p {
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        .recent-section {
          padding: 1rem;
        }

        .recent-section h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 0.75rem;
        }

        .results-list {
          display: flex;
          flex-direction: column;
        }

        .result-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .result-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .result-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background-color: rgba(34, 197, 94, 0.1);
        }

        .result-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          border-radius: 50%;
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #22c55e, #15803d);
          color: white;
          font-weight: 600;
          font-size: 1.125rem;
        }

        .hashtag-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .hashtag-icon svg {
          width: 22px;
          height: 22px;
          color: #22c55e;
        }

        .result-info {
          flex: 1;
          min-width: 0;
        }

        .result-name {
          display: block;
          font-weight: 600;
          color: white;
          font-size: 0.9375rem;
        }

        .result-username, .result-count {
          display: block;
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .result-arrow {
          width: 18px;
          height: 18px;
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
