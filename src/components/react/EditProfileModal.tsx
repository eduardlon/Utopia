import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase/client';
import { uploadAvatar, uploadCover, updateProfile, getCurrentProfile } from '../../lib/profile';
import type { Profile } from '../../lib/profile';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate?: (profile: Profile) => void;
}

export default function EditProfileModal({ isOpen, onClose, onProfileUpdate }: EditProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  
  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  
  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // File input refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Load profile on mount
  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    setLoading(true);
    const profileData = await getCurrentProfile();
    if (profileData) {
      setProfile(profileData);
      setDisplayName(profileData.display_name || '');
      setUsername(profileData.username);
      setBio(profileData.bio || '');
      setLocation(profileData.location || '');
      setWebsite(profileData.website || '');
      setAvatarUrl(profileData.avatar_url || '/images/default-avatar.svg');
      setCoverUrl(profileData.cover_url || '');
    }
    setLoading(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setErrors({ ...errors, avatar: 'Por favor selecciona una imagen' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, avatar: 'La imagen debe ser menor a 5MB' });
      return;
    }

    setUploadingAvatar(true);
    setErrors({ ...errors, avatar: '' });

    try {
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      const url = await uploadAvatar(file);
      if (url) {
        setAvatarUrl(url);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setErrors({ ...errors, avatar: 'Error al subir la imagen' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setErrors({ ...errors, cover: 'Por favor selecciona una imagen' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors({ ...errors, cover: 'La imagen debe ser menor a 10MB' });
      return;
    }

    setUploadingCover(true);
    setErrors({ ...errors, cover: '' });

    try {
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      const url = await uploadCover(file);
      if (url) {
        setCoverUrl(url);
      }
    } catch (error) {
      console.error('Error uploading cover:', error);
      setErrors({ ...errors, cover: 'Error al subir la imagen' });
    } finally {
      setUploadingCover(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = 'El nombre de usuario es requerido';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = 'Solo letras, números y guiones bajos';
    }

    if (website && !/^https?:\/\/.+/.test(website)) {
      newErrors.website = 'URL inválida (debe comenzar con http:// o https://)';
    }

    if (bio.length > 160) {
      newErrors.bio = 'La biografía debe tener máximo 160 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const updatedProfile = await updateProfile({
        display_name: displayName,
        username,
        bio,
        location,
        website
      });

      if (updatedProfile && onProfileUpdate) {
        onProfileUpdate(updatedProfile);
      }

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ ...errors, submit: 'Error al actualizar el perfil' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Editar Perfil</h2>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {loading && !profile ? (
          <div className="modal-loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="edit-form">
            {/* Cover Photo */}
            <div className="cover-section">
              <div 
                className="cover-preview" 
                style={{ backgroundImage: coverUrl ? `url(${coverUrl})` : 'none' }}
              >
                <button 
                  type="button" 
                  className="change-cover-btn"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                >
                  {uploadingCover ? (
                    <div className="btn-spinner"></div>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      <span>Cambiar portada</span>
                    </>
                  )}
                </button>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                style={{ display: 'none' }}
              />
              {errors.cover && <span className="error-text">{errors.cover}</span>}
            </div>

            {/* Avatar */}
            <div className="avatar-section">
              <div className="avatar-preview">
                <img src={avatarUrl || '/images/default-avatar.svg'} alt="Avatar" />
                <button 
                  type="button" 
                  className="change-avatar-btn"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <div className="btn-spinner small"></div>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  )}
                </button>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              {errors.avatar && <span className="error-text">{errors.avatar}</span>}
            </div>

            {/* Form Fields */}
            <div className="form-group">
              <label htmlFor="display-name">Nombre</label>
              <input
                type="text"
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tu nombre"
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="username">Nombre de usuario *</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@usuario"
                maxLength={50}
                required
              />
              {errors.username && <span className="error-text">{errors.username}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="bio">Biografía</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Cuéntanos sobre ti..."
                maxLength={160}
                rows={3}
              />
              <span className="char-count">{bio.length}/160</span>
              {errors.bio && <span className="error-text">{errors.bio}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="location">Ubicación</label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ciudad, País"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="website">Sitio web</label>
              <input
                type="url"
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://tusitio.com"
                maxLength={255}
              />
              {errors.website && <span className="error-text">{errors.website}</span>}
            </div>

            {errors.submit && (
              <div className="error-message">{errors.submit}</div>
            )}

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <div className="btn-spinner"></div> : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}

        <style>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            padding: 1rem;
          }

          .modal {
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            background: rgba(18, 18, 18, 0.98);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: 1rem;
            overflow-y: auto;
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            position: sticky;
            top: 0;
            background: rgba(18, 18, 18, 0.98);
            z-index: 10;
          }

          .modal-header h2 {
            font-size: 1.125rem;
            font-weight: 600;
            color: white;
          }

          .modal-close {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.05);
            border: none;
            border-radius: 50%;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .modal-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }

          .modal-close svg {
            width: 18px;
            height: 18px;
          }

          .modal-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3rem;
          }

          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(34, 197, 94, 0.2);
            border-top-color: #22c55e;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .edit-form {
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }

          .cover-section {
            margin: -1.25rem -1.25rem 0;
          }

          .cover-preview {
            height: 120px;
            background: rgba(255, 255, 255, 0.05);
            background-size: cover;
            background-position: center;
            position: relative;
            border-radius: 1rem 1rem 0 0;
          }

          .change-cover-btn {
            position: absolute;
            bottom: 0.75rem;
            right: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 0.5rem;
            color: white;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .change-cover-btn:hover {
            background: rgba(0, 0, 0, 0.9);
          }

          .change-cover-btn svg {
            width: 16px;
            height: 16px;
          }

          .avatar-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: -2rem;
          }

          .avatar-preview {
            position: relative;
            width: 80px;
            height: 80px;
          }

          .avatar-preview img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid #0a0a0a;
          }

          .change-avatar-btn {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #22c55e;
            border: 2px solid #0a0a0a;
            border-radius: 50%;
            color: white;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .change-avatar-btn:hover {
            background: #4ade80;
          }

          .change-avatar-btn svg {
            width: 14px;
            height: 14px;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 0.375rem;
            position: relative;
          }

          .form-group label {
            font-size: 0.8125rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.7);
          }

          .form-group input,
          .form-group textarea {
            padding: 0.75rem;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.5rem;
            color: white;
            font-size: 0.875rem;
            outline: none;
            transition: border-color 0.2s ease;
            font-family: inherit;
          }

          .form-group input:focus,
          .form-group textarea:focus {
            border-color: rgba(34, 197, 94, 0.5);
          }

          .form-group textarea {
            resize: vertical;
            min-height: 80px;
          }

          .char-count {
            position: absolute;
            right: 0.75rem;
            bottom: 0.5rem;
            font-size: 0.6875rem;
            color: rgba(255, 255, 255, 0.4);
          }

          .error-text {
            font-size: 0.75rem;
            color: #ef4444;
          }

          .error-message {
            padding: 0.75rem;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 0.5rem;
            color: #ef4444;
            font-size: 0.875rem;
            text-align: center;
          }

          .form-actions {
            display: flex;
            gap: 0.75rem;
            margin-top: 0.5rem;
          }

          .form-actions .btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }

          .btn {
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
          }

          .btn-primary {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
          }

          .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }

          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }

          .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
          }

          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }

          .btn-spinner {
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          .btn-spinner.small {
            width: 14px;
            height: 14px;
          }
        `}</style>
      </div>
    </div>
  );
}
