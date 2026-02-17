// ProfileHeader component - React Island for profile header with editable bio and friend actions
import { useState, useCallback, useEffect } from 'react';
import { createClient } from '../../lib/supabase/client';
import type { Profile } from '../../types/database';
import FriendButton from './FriendButton';

interface ProfileHeaderProps {
  initialProfile: Profile | null;
  isOwnProfile: boolean;
}

export default function ProfileHeader({ initialProfile, isOwnProfile }: ProfileHeaderProps) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    website: profile?.website || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const supabase = createClient();

  // Load user stats
  useEffect(() => {
    async function loadStats() {
      if (!profile?.id) return;

      try {
        // Get posts count
        const { count: postsCount } = await (supabase as any)
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id);

        // Get friends count (both as requester and addressee)
        const { data: friendsData } = await (supabase as any)
          .from('friendships')
          .select('id')
          .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
          .eq('status', 'accepted');

        setStats({
          posts: postsCount || 0,
          followers: friendsData?.length || 0,
          following: friendsData?.length || 0,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }

    loadStats();
  }, [profile?.id]);

  const handleSave = useCallback(async () => {
    if (!profile) return;

    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsSaving(false);
      return;
    }

    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        display_name: editForm.display_name || null,
        bio: editForm.bio || null,
        location: editForm.location || null,
        website: editForm.website || null,
      })
      .eq('id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...editForm } : null);
      setIsEditing(false);
    }
    setIsSaving(false);
  }, [profile, editForm, supabase]);

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    await (supabase as any)
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
  }, [profile, supabase]);

  if (!profile) {
    return (
      <div className="profile-header glass">
        <div className="profile-cover skeleton"></div>
        <div className="profile-info">
          <div className="profile-avatar-container">
            <div className="profile-avatar skeleton"></div>
          </div>
          <div className="profile-details">
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-header glass">
      {/* Cover Image */}
      <div className="profile-cover">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="Cover" />
        ) : (
          <div className="cover-placeholder"></div>
        )}
        {isOwnProfile && isEditing && (
          <label className="cover-edit-btn">
            <input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !profile) return;

              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const fileExt = file.name.split('.').pop();
              const fileName = `${user.id}/cover.${fileExt}`;

              const { error: uploadError } = await supabase.storage
                .from('covers')
                .upload(fileName, file, { upsert: true });

              if (uploadError) {
                console.error('Upload error:', uploadError);
                return;
              }

              const { data: { publicUrl } } = supabase.storage
                .from('covers')
                .getPublicUrl(fileName);

              await (supabase as any)
                .from('profiles')
                .update({ cover_url: publicUrl })
                .eq('id', user.id);

              setProfile(prev => prev ? { ...prev, cover_url: publicUrl } : null);
            }} hidden />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </label>
        )}
      </div>

      <div className="profile-info">
        <div className="profile-avatar-container">
          <img
            src={profile.avatar_url || '/images/default-avatar.svg'}
            alt={profile.display_name || profile.username}
            className="profile-avatar"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/images/default-avatar.svg';
            }}
          />
          {isOwnProfile && isEditing && (
            <label className="avatar-edit-btn">
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </label>
          )}
        </div>

        <div className="profile-details">
          <div className="profile-name-row">
            <h1 className="profile-name">{profile.display_name || profile.username}</h1>
            {profile.verified && (
              <svg className="verified-badge" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </div>
          <p className="profile-username">@{profile.username}</p>

          {isEditing ? (
            <div className="edit-form">
              <input
                type="text"
                placeholder="Nombre"
                value={editForm.display_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                className="edit-input"
              />
              <textarea
                placeholder="Biografía"
                value={editForm.bio}
                onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                className="edit-textarea"
                rows={3}
              />
              <input
                type="text"
                placeholder="Ubicación"
                value={editForm.location}
                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                className="edit-input"
              />
              <input
                type="url"
                placeholder="Sitio web"
                value={editForm.website}
                onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                className="edit-input"
              />
              <div className="edit-actions">
                <button onClick={() => setIsEditing(false)} className="btn-secondary" disabled={isSaving}>
                  Cancelar
                </button>
                <button onClick={handleSave} className="btn-primary" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              <div className="profile-meta">
                {profile.location && (
                  <span className="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a href={profile.website} className="meta-item link" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    {profile.website}
                  </a>
                )}
              </div>
            </>
          )}

          {/* Stats */}
          <div className="profile-stats">
            <div className="stat">
              <span className="stat-value">{stats.posts}</span>
              <span className="stat-label">Publicaciones</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.followers}</span>
              <span className="stat-label">Amigos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isEditing && (
        <div className="profile-actions">
          {isOwnProfile ? (
            <button onClick={() => setIsEditing(true)} className="btn-secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar perfil
            </button>
          ) : (
            <FriendButton targetUserId={profile.id} />
          )}
        </div>
      )}

      <style>{`
        .profile-header {
          padding: 0;
          border-radius: 1rem;
          background: rgba(18, 18, 18, 0.6);
          border: 1px solid rgba(34, 197, 94, 0.15);
          backdrop-filter: blur(20px);
          overflow: hidden;
        }
        .profile-cover {
          height: 200px;
          position: relative;
          overflow: hidden;
        }
        .profile-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cover-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(13, 61, 43, 0.3) 100%);
        }
        .cover-edit-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cover-edit-btn:hover { 
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.1);
        }
        .cover-edit-btn svg { width: 18px; height: 18px; color: #fff; }
        .profile-info { 
          display: flex; 
          gap: 1.5rem; 
          align-items: flex-start; 
          padding: 1.5rem;
          margin-top: -60px;
        }
        @media (max-width: 767px) {
          .profile-info { flex-direction: column; align-items: center; text-align: center; }
        }
        .profile-avatar-container { position: relative; flex-shrink: 0; }
        .profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          object-position: center;
          border: 4px solid #0a0a0a;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
          background-color: rgba(34, 197, 94, 0.1);
          background-size: cover;
          background-position: center;
        }
        .profile-avatar.skeleton {
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .avatar-edit-btn {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #22c55e;
          border: 3px solid #0a0a0a;
          border-radius: 50%;
          cursor: pointer;
        }
        .avatar-edit-btn:hover { transform: scale(1.1); }
        .avatar-edit-btn svg { width: 16px; height: 16px; color: #fff; }
        .profile-details { flex: 1; padding-top: 60px; }
        .profile-name-row { display: flex; align-items: center; gap: 0.5rem; }
        .profile-name { margin: 0; font-size: 1.5rem; font-weight: 700; color: #fff; }
        .verified-badge { width: 20px; height: 20px; color: #22c55e; }
        .profile-username { margin: 0.25rem 0; font-size: 1rem; color: rgba(255, 255, 255, 0.6); }
        .profile-bio { margin: 0.75rem 0; color: rgba(255, 255, 255, 0.9); line-height: 1.5; }
        .profile-meta { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.75rem; }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
        }
        .meta-item.link { color: #22c55e; text-decoration: none; }
        .meta-item.link:hover { text-decoration: underline; }
        .meta-item svg { width: 16px; height: 16px; }
        .profile-stats {
          display: flex;
          gap: 1.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stat-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
        }
        .stat-label {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .edit-form { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
        .edit-input, .edit-textarea {
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: #fff;
          font-size: 0.9375rem;
          font-family: inherit;
        }
        .edit-input:focus, .edit-textarea:focus { outline: none; border-color: rgba(34, 197, 94, 0.5); }
        .edit-textarea { resize: vertical; min-height: 80px; }
        .edit-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
        .profile-actions { display: flex; justify-content: flex-end; padding: 0 1.5rem 1.5rem; margin-top: -1rem; }
        .btn-primary, .btn-secondary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary {
          background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
          border: none;
          color: #fff;
        }
        .btn-primary:hover:not(:disabled) { box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.05); }
        .btn-secondary svg { width: 16px; height: 16px; }
        .skeleton-line {
          height: 16px;
          border-radius: 8px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          margin-bottom: 0.5rem;
        }
        .skeleton-line.short { width: 60%; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
