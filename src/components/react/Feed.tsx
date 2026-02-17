// Feed component with infinite scroll - Shows friends' posts by default
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../../lib/supabase/client';
import type { Post, Profile } from '../../types/database';
import PostCard from './PostCard';
import PostSkeleton from './PostSkeleton';

interface PostWithAuthor extends Post {
  profiles: Profile;
  interactions?: { count: number }[];
  comments?: { count: number }[];
}

interface FeedProps {
  initialPosts?: PostWithAuthor[];
  userId?: string;
}

const emptyFeedStyles = `
  .empty-feed {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 2rem;
    text-align: center;
    border-radius: 1.25rem;
    background: linear-gradient(145deg, rgba(19, 25, 23, 0.8) 0%, rgba(14, 20, 18, 0.7) 100%);
    border: 1px solid rgba(34, 197, 94, 0.12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    animation: emptyFadeIn 0.5s ease both;
  }
  @keyframes emptyFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .empty-feed-icon-wrap {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(34, 197, 94, 0.08);
    border-radius: 50%;
    margin-bottom: 1.25rem;
  }
  .empty-icon {
    width: 36px;
    height: 36px;
    color: rgba(34, 197, 94, 0.6);
  }
  .empty-feed h3 {
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
    font-weight: 600;
    color: #fff;
  }
  .empty-feed p {
    margin: 0 0 1.25rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.88rem;
    line-height: 1.5;
    max-width: 300px;
  }
  .empty-feed-actions {
    display: flex;
    gap: 0.75rem;
  }
  .explore-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.4rem;
    background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
    border-radius: 12px;
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.85rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.2);
  }
  .explore-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.35);
  }
`;

export default function Feed({ initialPosts = [], userId }: FeedProps) {
  const [posts, setPosts] = useState<PostWithAuthor[]>(initialPosts);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const POSTS_PER_PAGE = 10;

  // Load friend IDs for filtering
  useEffect(() => {
    async function loadFriends() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFriendsLoaded(true);
        setLoading(false);
        return;
      }

      const { data } = await (supabase as any)
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');

      const ids: string[] = [];
      if (data) {
        data.forEach((f: any) => {
          ids.push(f.requester_id === user.id ? f.addressee_id : f.requester_id);
        });
      }
      // Always include user's own posts
      ids.push(user.id);
      setFriendIds(ids);
      setFriendsLoaded(true);
    }

    loadFriends();
  }, []);

  const fetchPosts = useCallback(async (pageNum: number) => {
    setLoading(true);
    const supabase = createClient();

    try {
      let query = (supabase as any)
        .from('posts')
        .select(`
          *,
          profiles:user_id (*),
          interactions (count),
          comments (count)
        `)
        .order('created_at', { ascending: false })
        .range(pageNum * POSTS_PER_PAGE, (pageNum + 1) * POSTS_PER_PAGE - 1);

      // Show posts from friends and self
      if (friendIds.length > 0) {
        query = query.in('user_id', friendIds);
      }

      // If viewing a specific user's profile
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        setPosts(prev => pageNum === 0 ? [...data as PostWithAuthor[]] : [...prev, ...data as PostWithAuthor[]]);
        if (data.length < POSTS_PER_PAGE) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [userId, friendIds]);

  // Initial fetch when friendIds are loaded
  useEffect(() => {
    if (friendsLoaded && friendIds.length > 0) {
      setPosts([]);
      setPage(0);
      setHasMore(true);
      fetchPosts(0);
    } else if (friendsLoaded && friendIds.length === 0) {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [friendsLoaded, friendIds, fetchPosts]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPosts(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, page, fetchPosts]);

  // Subscribe to new posts in real-time
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('public:posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          const { new: newPost } = payload;
          
          // Only add if from a friend
          if (!friendIds.includes(newPost.user_id)) return;
          
          // Fetch the complete post with author
          const { data } = await (supabase as any)
            .from('posts')
            .select(`
              *,
              profiles:user_id (*),
              interactions (count),
              comments (count)
            `)
            .eq('id', newPost.id)
            .single();

          if (data) {
            setPosts(prev => [data as PostWithAuthor, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [friendIds]);

  // Listen for new-post-created event from the inline post form
  useEffect(() => {
    const handleNewPost = () => {
      // Refresh posts from page 0
      setPosts([]);
      setPage(0);
      setHasMore(true);
      fetchPosts(0);
    };

    window.addEventListener('new-post-created', handleNewPost);
    return () => window.removeEventListener('new-post-created', handleNewPost);
  }, [fetchPosts]);

  const handlePostUpdate = useCallback((updatedPost: PostWithAuthor) => {
    setPosts(prev => 
      prev.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  }, []);

  const handlePostDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
  }, []);

  // Show skeleton while still loading friends or initial posts
  if (!initialLoadDone) {
    return (
      <div className="feed-container">
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  // Only show "add friends" after we confirmed no friends AND no posts
  if (friendsLoaded && friendIds.length <= 1 && posts.length === 0) {
    return (
      <div className="feed-container">
        <div className="empty-feed glass">
          <div className="empty-feed-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-icon">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h3>Tu feed está vacío</h3>
          <p>Agrega amigos o publica algo para empezar a llenar tu feed</p>
          <div className="empty-feed-actions">
            <a href="/explore" className="explore-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 16, height: 16}}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              Explorar usuarios
            </a>
          </div>
        </div>
        <style>{emptyFeedStyles}</style>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {posts.length === 0 && !loading && initialLoadDone && (
        <div className="empty-feed glass">
          <div className="empty-feed-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-icon">
              <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3>No hay publicaciones aún</h3>
          <p>Tus amigos aún no han publicado nada. ¡Sé el primero!</p>
        </div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onUpdate={handlePostUpdate}
          onDelete={handlePostDelete}
        />
      ))}

      {loading && (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      )}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="load-more-trigger">
        {loading && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            <span>Cargando más publicaciones...</span>
          </div>
        )}
      </div>

      {!hasMore && posts.length > 0 && (
        <div className="end-of-feed">
          <div className="end-line"></div>
          <span>Has llegado al final</span>
          <div className="end-line"></div>
        </div>
      )}

      <style>{`
        .feed-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        ${emptyFeedStyles}

        .load-more-trigger {
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.875rem;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(34, 197, 94, 0.3);
          border-top-color: #22c55e;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .end-of-feed {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 2rem 0;
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.875rem;
        }

        .end-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(34, 197, 94, 0.3),
            transparent
          );
        }
      `}</style>
    </div>
  );
}
