import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';

interface RadioChannel {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  created_by: string;
  created_at: string;
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface RadioTrack {
  id: string;
  channel_id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  duration_seconds: number | null;
  user_id: string;
  status: 'queued' | 'playing' | 'history' | '';
  started_at: string | null;
  created_at: string;
  user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface RadioMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Listener {
  user_id: string;
  username: string;
  avatar_url: string | null;
  online_at: string;
}

// WebRTC configuration for real-time voice
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function RadioPlayer() {
  const [channels, setChannels] = useState<RadioChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<RadioChannel | null>(null);
  const [tracks, setTracks] = useState<RadioTrack[]>([]);
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [currentTrack, setCurrentTrack] = useState<RadioTrack | null>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: '', description: '', genre: '' });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const playlistRef = useRef<HTMLDivElement | null>(null);
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceOver, setIsVoiceOver] = useState(false);
  const [audioContextEnabled, setAudioContextEnabled] = useState(false);
  
  // WebRTC refs for real-time voice
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const voiceChannelRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Admin audio monitoring
  const [adminMonitoringEnabled, setAdminMonitoringEnabled] = useState(true);
  const monitorAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Delete confirmation state
  const [trackToDelete, setTrackToDelete] = useState<RadioTrack | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [toast, setToast] = useState<{ msg: string, type: 'error' | 'success' | 'info' } | null>(null);

  const isAdmin = selectedChannel?.created_by === userId;

  function showToast(msg: string, type: 'error' | 'success' | 'info' = 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    loadUser();
    loadChannels();
    return () => {
      cleanupResources();
    };
  }, []);

  const cleanupResources = useCallback(() => {
    // Stop mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
    }
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    // Remove voice channel
    if (voiceChannelRef.current) {
      supabase.removeChannel(voiceChannelRef.current);
    }
  }, []);

  // Realtime & Presence
  useEffect(() => {
    if (selectedChannel) {
      loadTracks(selectedChannel.id);
      loadMessages(selectedChannel.id);

      const channel = supabase.channel(`radio-${selectedChannel.id}`, {
        config: { presence: { key: userId || 'anon' } },
      });

      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'radio_messages', filter: `channel_id=eq.${selectedChannel.id}` },
          async (payload: any) => {
            const { data: msg } = await (supabase as any).from('radio_messages').select(`*, user:profiles(username, display_name, avatar_url)`).eq('id', payload.new.id).single();
            if (msg) setMessages(prev => [...prev, msg]);
          }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_tracks', filter: `channel_id=eq.${selectedChannel.id}` },
          () => { loadTracks(selectedChannel.id); }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const users: Listener[] = [];
          for (const key in state) {
            const presence = state[key][0] as unknown as Listener;
            if (presence && presence.user_id) {
              users.push(presence);
            }
          }
          setListeners(users);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && userProfile && userId) {
            await channel.track({
              user_id: userId,
              username: userProfile.username,
              avatar_url: userProfile.avatar_url,
              online_at: new Date().toISOString(),
            });
          }
        });

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedChannel, userId, userProfile]);

  // Setup WebRTC voice channel for real-time communication
  useEffect(() => {
    if (selectedChannel && isAdmin) {
      setupVoiceChannel();
    }
    return () => {
      if (voiceChannelRef.current) {
        supabase.removeChannel(voiceChannelRef.current);
      }
    };
  }, [selectedChannel, isAdmin]);

  // Setup listener voice reception
  useEffect(() => {
    if (selectedChannel && !isAdmin) {
      setupVoiceReceiver();
    }
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [selectedChannel, isAdmin]);

  // Messages Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Audio Sync Logic
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    if (currentTrack.status === 'playing' && currentTrack.started_at) {
      const startTime = new Date(currentTrack.started_at).getTime();
      const now = Date.now();
      let seekTime = (now - startTime) / 1000;

      if (seekTime < 0) seekTime = 0;

      if (currentTrack.duration_seconds && seekTime > currentTrack.duration_seconds) {
        if (isAdmin) playNextTrack();
        return;
      }

      const player = audioRef.current;
      if (Math.abs(player.currentTime - seekTime) > 2) {
        player.currentTime = seekTime;
      }

      if (player.paused && audioContextEnabled) {
        player.play().catch(e => console.warn("Autoplay blocked", e));
      }
    }
  }, [currentTrack, isAdmin, audioContextEnabled]);

  // Volume Ducking for voice-over
  useEffect(() => {
    if (audioRef.current) {
      const targetVol = isVoiceOver ? volume * 0.2 : volume;
      const step = 0.05;
      const currentVol = audioRef.current.volume;

      if (Math.abs(currentVol - targetVol) > 0.01) {
        const fade = setInterval(() => {
          if (!audioRef.current) { clearInterval(fade); return; }
          const v = audioRef.current.volume;
          if (Math.abs(v - targetVol) < step) {
            audioRef.current.volume = targetVol;
            clearInterval(fade);
          } else {
            audioRef.current.volume = v > targetVol ? v - step : v + step;
          }
        }, 50);
      }
    }
  }, [isVoiceOver, volume]);

  // Admin monitoring - play audio for admin too
  useEffect(() => {
    if (isAdmin && adminMonitoringEnabled && audioRef.current && currentTrack?.audio_url) {
      audioRef.current.play().catch(e => console.warn("Admin audio monitoring blocked", e));
    }
  }, [isAdmin, adminMonitoringEnabled, currentTrack]);

  // Auto-play for listeners when track changes (non-admin users)
  useEffect(() => {
    if (!isAdmin && audioRef.current && currentTrack?.audio_url && isPlaying) {
      console.log('[Radio] Auto-playing track for listener:', currentTrack.title);
      audioRef.current.play().catch(e => console.warn("Auto-play blocked for listener:", e));
    }
  }, [currentTrack?.id, isPlaying, isAdmin]);


  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single();
      if (data) setUserProfile(data);
    }
  }

  async function loadChannels() {
    setLoading(true);
    try {
      const { data } = await (supabase as any).from('radio_channels')
        .select(`*, creator:profiles(username, display_name, avatar_url)`).order('created_at', { ascending: false });
      if (data) setChannels(data);
    } catch (e) { console.warn('Error loading channels', e); }
    setLoading(false);
  }

  async function loadTracks(channelId: string) {
    const { data } = await (supabase as any).from('radio_tracks')
      .select(`*, user:profiles(username, display_name, avatar_url)`).eq('channel_id', channelId).order('created_at', { ascending: true });

    if (data) {
      setTracks(data);
      const playing = data.find((t: RadioTrack) => t.status === 'playing');

      if (playlistRef.current && playing) {
        const idx = data.findIndex((t: RadioTrack) => t.id === playing.id);
        if (idx !== -1) {
          const rowHeight = 60;
          playlistRef.current.scrollTop = idx * rowHeight - 100;
        }
      }

      if (playing) {
        if (playing.id !== currentTrack?.id || playing.status !== currentTrack?.status) {
          setCurrentTrack(playing);
          setIsPlaying(true);
        }
      } else {
        if (currentTrack?.status === 'playing') {
          setIsPlaying(false);
          setCurrentTrack(null);
        }
      }
    }
  }

  async function loadMessages(channelId: string) {
    const { data } = await (supabase as any).from('radio_messages')
      .select(`*, user:profiles(username, display_name, avatar_url)`).eq('channel_id', channelId).order('created_at', { ascending: true }).limit(50);
    if (data) setMessages(data);
  }

  async function playTrack(track: RadioTrack) {
    if (!isAdmin) return;
    
    console.log('[Radio] Playing track:', track.title);
    
    // Update previous track to history
    if (currentTrack) {
      await (supabase as any).from('radio_tracks').update({ status: 'history' }).eq('id', currentTrack.id);
      // Update local state
      setTracks(prev => prev.map(t => t.id === currentTrack.id ? { ...t, status: 'history' } : t));
    }
    
    // Update new track to playing
    await (supabase as any).from('radio_tracks').update({
      status: 'playing',
      started_at: new Date().toISOString()
    }).eq('id', track.id);

    // Update local state
    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, status: 'playing' } : t));
    setCurrentTrack({ ...track, status: 'playing', started_at: new Date().toISOString() });
    setIsPlaying(true);
  }

  async function pauseTrack() {
    if (!isAdmin || !currentTrack) return;
    await (supabase as any).from('radio_tracks').update({ status: 'queued', started_at: null }).eq('id', currentTrack.id);
    setIsPlaying(false);
    setCurrentTrack(null);
  }

  // Improved delete with confirmation
  function confirmDeleteTrack(track: RadioTrack) {
    setTrackToDelete(track);
    setShowDeleteConfirm(true);
  }

  async function deleteTrack() {
    if (!isAdmin || !trackToDelete) return;
    
    try {
      // If track is currently playing, stop it first
      if (currentTrack?.id === trackToDelete.id) {
        await pauseTrack();
      }
      
      // Delete from storage if it's a local file
      if (trackToDelete.audio_url.includes('supabase.co/storage')) {
        try {
          const url = new URL(trackToDelete.audio_url);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex(p => p === 'media');
          if (bucketIndex !== -1) {
            const filePath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from('media').remove([filePath]);
          }
        } catch (e) {
          console.warn('Could not delete file from storage', e);
        }
      }
      
      const { error } = await (supabase as any).from('radio_tracks').delete().eq('id', trackToDelete.id);
      
      if (error) {
        console.error('Error deleting track:', error);
        showToast(`Error al eliminar: ${error.message}`, "error");
        return;
      }
      
      showToast("Pista eliminada correctamente", "success");
      
      // Update local state immediately
      setTracks(prev => prev.filter(t => t.id !== trackToDelete.id));
      
      // Also reload from server to ensure sync
      if (selectedChannel) {
        loadTracks(selectedChannel.id);
      }
    } catch (e: any) {
      console.error('Exception deleting track:', e);
      showToast(`Error al eliminar la pista: ${e.message || 'Unknown error'}`, "error");
    } finally {
      setShowDeleteConfirm(false);
      setTrackToDelete(null);
    }
  }

  async function playNextTrack() {
    if (!isAdmin) return;
    
    // Get fresh list of available tracks (not history)
    const availableTracks = tracks.filter(t => t.status !== 'history');
    console.log('[Radio] playNextTrack - available tracks:', availableTracks.length);
    
    if (availableTracks.length === 0) {
      console.log('[Radio] No available tracks');
      setIsPlaying(false);
      setCurrentTrack(null);
      return;
    }
    
    // Find current track index in available tracks
    const currentAvailableIdx = availableTracks.findIndex(t => t.id === currentTrack?.id);
    
    // Calculate next index (loop if at end)
    let nextIdx = currentAvailableIdx + 1;
    if (nextIdx >= availableTracks.length) {
      nextIdx = 0;
    }
    
    // If only one track and it's current, restart it
    if (availableTracks.length === 1 && currentAvailableIdx === 0) {
      nextIdx = 0;
    }
    
    const nextTrack = availableTracks[nextIdx];
    
    if (nextTrack) {
      console.log('[Radio] Advancing to track:', nextTrack.title);
      playTrack(nextTrack);
    }
  }

  async function playPreviousTrack() {
    if (!isAdmin) return;
    
    // Get fresh list of available tracks (not history)
    const availableTracks = tracks.filter(t => t.status !== 'history');
    console.log('[Radio] playPreviousTrack - available tracks:', availableTracks.length);
    
    if (availableTracks.length === 0) {
      console.log('[Radio] No available tracks');
      return;
    }
    
    // Find current track index in available tracks
    const currentAvailableIdx = availableTracks.findIndex(t => t.id === currentTrack?.id);
    
    // Calculate previous index (loop if at beginning)
    let prevIdx = currentAvailableIdx - 1;
    if (prevIdx < 0) {
      prevIdx = availableTracks.length - 1;
    }
    
    const prevTrack = availableTracks[prevIdx];
    
    if (prevTrack) {
      console.log('[Radio] Going back to track:', prevTrack.title);
      playTrack(prevTrack);
    }
  }

  // Setup WebRTC voice channel for admin (broadcaster)
  const setupVoiceChannel = async () => {
    if (!selectedChannel) return;

    const voiceChannel = supabase.channel(`voice-${selectedChannel.id}`, {
      config: { broadcast: { ack: true } },
    });

    voiceChannelRef.current = voiceChannel;

    voiceChannel
      .on('broadcast', { event: 'voice-answer' }, async ({ payload }) => {
        // Handle answer from listener
        if (peerConnectionRef.current && payload.answer) {
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          } catch (e) {
            console.warn('Error setting remote description', e);
          }
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (peerConnectionRef.current && payload.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate', e);
          }
        }
      })
      .subscribe();
  };

  // Setup voice receiver for listeners
  const setupVoiceReceiver = async () => {
    if (!selectedChannel) return;

    const voiceChannel = supabase.channel(`voice-${selectedChannel.id}`, {
      config: { broadcast: { ack: true } },
    });

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      // Play received audio
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(e => console.warn('Remote audio play blocked', e));
        setIsVoiceOver(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        voiceChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };

    voiceChannel
      .on('broadcast', { event: 'voice-offer' }, async ({ payload }) => {
        if (pc && payload.offer) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            voiceChannel.send({
              type: 'broadcast',
              event: 'voice-answer',
              payload: { answer: { type: answer.type, sdp: answer.sdp } },
            });
          } catch (e) {
            console.warn('Error handling voice offer', e);
          }
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (pc && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate', e);
          }
        }
      })
      .on('broadcast', { event: 'voice-stop' }, () => {
        setIsVoiceOver(false);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = null;
        }
      })
      .subscribe();
  };

  // Real-time voice transmission using WebRTC
  const startRealTimeVoice = async () => {
    if (!isAdmin || !selectedChannel) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      localStreamRef.current = stream;
      micStreamRef.current = stream;

      // Create peer connection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;

      // Add audio tracks
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && voiceChannelRef.current) {
          voiceChannelRef.current.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: event.candidate.toJSON() },
          });
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (voiceChannelRef.current) {
        voiceChannelRef.current.send({
          type: 'broadcast',
          event: 'voice-offer',
          payload: { offer: { type: offer.type, sdp: offer.sdp } },
        });
      }

      setIsRecording(true);
      setIsVoiceOver(true);
      showToast("🎙️ Transmitiendo en vivo...", "success");

    } catch (e) {
      console.error("Mic error", e);
      showToast("No se pudo acceder al micrófono", 'error');
    }
  };

  const stopRealTimeVoice = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Notify listeners that voice stopped
    if (voiceChannelRef.current) {
      voiceChannelRef.current.send({
        type: 'broadcast',
        event: 'voice-stop',
        payload: {},
      });
    }

    setIsRecording(false);
    setIsVoiceOver(false);
    showToast("Transmisión de voz detenida", "info");
  };

  const toggleRecording = async () => {
    if (!isAdmin) return;
    if (isRecording) {
      stopRealTimeVoice();
    } else {
      await startRealTimeVoice();
    }
  };

  async function addTrackToChannel(file: File) {
    if (!isAdmin || !selectedChannel) return;
    showToast("Subiendo pista...", "info");
    const ext = file.name.split('.').pop();
    const fileName = `radio/${selectedChannel.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
    if (uploadError) { showToast('Error al subir', 'error'); return; }

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
    const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    // Get actual duration
    const audio = new Audio(publicUrl);
    const duration = await new Promise<number>((resolve) => {
      audio.onloadedmetadata = () => resolve(Math.floor(audio.duration));
      audio.onerror = () => resolve(180);
    });

    await (supabase as any).from('radio_tracks').insert({
      channel_id: selectedChannel.id,
      title,
      artist: null,
      audio_url: publicUrl,
      duration_seconds: duration,
      user_id: userId,
      status: 'queued'
    });
    showToast("Pista agregada", "success");
    loadTracks(selectedChannel.id);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChannel || !userId) return;
    await (supabase as any).from('radio_messages').insert({ channel_id: selectedChannel.id, user_id: userId, content: newMessage.trim() });
    setNewMessage('');
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!channelForm.name.trim() || !userId) return;
    const { data, error } = await (supabase as any).from('radio_channels').insert({
      name: channelForm.name, description: channelForm.description, genre: channelForm.genre, created_by: userId
    }).select().single();
    if (error) { showToast('Error al crear canal', 'error'); return; }
    if (data) {
      setChannels(prev => [data, ...prev]);
      setSelectedChannel(data);
      setShowCreateChannel(false);
      setChannelForm({ name: '', description: '', genre: '' });
    }
  }

  const joinAudio = () => {
    setAudioContextEnabled(true);
    if (audioRef.current) audioRef.current.play().catch(() => { });
  }

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) return (
    <div className="radio-loading glass">
      <div className="radio-loader">
        <span className="eq-bar" />
        <span className="eq-bar" />
        <span className="eq-bar" />
        <span className="eq-bar" />
        <span className="eq-bar" />
      </div>
      <p>Conectando con las frecuencias...</p>
    </div>
  );

  const currentIdx = currentTrack ? tracks.findIndex(t => t.id === currentTrack.id) : 0;
  const visibleTracks = isAdmin ? tracks : tracks.filter((_, i) => i >= currentIdx && i < currentIdx + 5);

  return (
    <div className="radio-container full-height">
      {/* Main audio element for music */}
      {currentTrack?.audio_url && (
        <audio
          ref={audioRef}
          src={currentTrack.audio_url}
          onTimeUpdate={() => { if (audioRef.current) { setProgress(audioRef.current.currentTime); setDuration(audioRef.current.duration || 0); } }}
          onEnded={() => { if (isAdmin) playNextTrack(); }}
        />
      )}
      
      {/* Remote audio element for receiving voice */}
      <audio ref={remoteAudioRef} autoPlay />

      {toast && <div className={`radio-toast radio-toast-${toast.type}`}>{toast.msg}</div>}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && trackToDelete && (
        <div className="radio-modal-backdrop">
          <div className="radio-modal glass" style={{ maxWidth: '400px' }}>
            <div className="radio-modal-header">
              <h3>Confirmar eliminación</h3>
              <p>¿Estás seguro de que deseas eliminar "{trackToDelete.title}"?</p>
            </div>
            <div className="radio-modal-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowDeleteConfirm(false); setTrackToDelete(null); }}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-danger" 
                onClick={deleteTrack}
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedChannel ? (
        <div className="channels-view fade-in">
          <div className="radio-hero glass">
            <div className="radio-hero-text">
              <h1>Radio Utopía</h1>
              <p>Explora frecuencias y comunidades en vivo</p>
            </div>
            <div className="radio-hero-actions">
              <button className="btn btn-primary" onClick={() => setShowCreateChannel(true)}>
                Crear Estación
              </button>
            </div>
          </div>
          {showCreateChannel && (
            <div className="radio-modal-backdrop">
              <form onSubmit={createChannel} className="radio-modal glass">
                <div className="radio-modal-header">
                  <h3>Nueva Estación</h3>
                  <p>Configura el espacio de tu comunidad</p>
                </div>
                <div className="radio-modal-fields">
                  <input className="input" placeholder="Nombre de la estación" value={channelForm.name} onChange={e => setChannelForm({ ...channelForm, name: e.target.value })} required />
                  <input className="input" placeholder="Descripción corta" value={channelForm.description} onChange={e => setChannelForm({ ...channelForm, description: e.target.value })} />
                  <input className="input" placeholder="Género (ej: Synthwave)" value={channelForm.genre} onChange={e => setChannelForm({ ...channelForm, genre: e.target.value })} />
                </div>
                <div className="radio-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateChannel(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Crear</button>
                </div>
              </form>
            </div>
          )}
          <div className="channels-grid">
            {channels.map(c => (
              <div key={c.id} className="channel-card glass" onClick={() => setSelectedChannel(c)}>
                <div className="channel-card-media">
                  <span className="channel-genre">{c.genre || 'Variado'}</span>
                </div>
                <div className="channel-card-body">
                  <h3>{c.name}</h3>
                  <p>{c.description || 'Sin descripción'}</p>
                  <div className="channel-card-meta">
                    <span>@{c.creator?.username || 'utopia'}</span>
                    <span className="channel-card-status">En vivo</span>
                  </div>
                </div>
              </div>
            ))}
            {channels.length === 0 && (
              <div className="radio-empty-state glass">
                <h3>No hay estaciones activas</h3>
                <p>Crea la primera frecuencia para tu comunidad</p>
                <button className="btn btn-primary" onClick={() => setShowCreateChannel(true)}>Crear Estación</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="radio-station glass">
          {!audioContextEnabled && !isAdmin && (
            <div className="radio-join-overlay">
              <button className="btn btn-primary btn-lg" onClick={joinAudio}>
                Conectar Audio en Vivo
              </button>
            </div>
          )}

          <div className="radio-station-header">
            <button className="btn btn-ghost btn-icon radio-back-btn" onClick={() => setSelectedChannel(null)}>
              ←
            </button>
            <div className="radio-station-info">
              <h2>{selectedChannel.name}</h2>
              <div className="radio-station-tags">
                <span className="badge">En vivo</span>
                {isAdmin && <span className="badge badge-admin">Admin</span>}
              </div>
            </div>
            <div className="radio-listeners">
              <div className="radio-listener-avatars">
                {listeners.slice(0, 5).map(l => (
                  <img 
                    key={l.user_id} 
                    src={l.avatar_url || '/images/default-avatar.svg'} 
                    className="avatar radio-avatar" 
                    title={l.username}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/default-avatar.svg';
                    }}
                  />
                ))}
              </div>
              <span className="radio-listener-count">{listeners.length || 0}</span>
            </div>
          </div>

          <div className="radio-station-body">
            <section className="radio-panel radio-chat">
              <header className="radio-panel-header">
                <h3>Chat en vivo</h3>
                <span className="radio-panel-meta">{messages.length} mensajes</span>
              </header>
              <div className="radio-chat-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`radio-chat-row ${msg.user_id === userId ? 'is-mine' : ''}`}>
                    {msg.user_id !== userId && (
                      <img 
                        src={msg.user?.avatar_url || '/images/default-avatar.svg'} 
                        className="avatar radio-avatar-sm"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/default-avatar.svg';
                        }}
                      />
                    )}
                    <div className="radio-chat-bubble">
                      <span className="radio-chat-name">{msg.user?.username}</span>
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="radio-chat-input">
                <input className="input" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Comenta..." />
                <button type="submit" className="btn btn-primary btn-icon">➤</button>
              </form>
            </section>

            <section className="radio-panel radio-playlist" ref={playlistRef}>
              <header className="radio-panel-header">
                <h3>Cola de reproducción</h3>
                {isAdmin && (
                  <label className="btn btn-secondary btn-sm radio-upload">
                    + Añadir
                    <input type="file" accept="audio/*" hidden onChange={e => e.target.files && addTrackToChannel(e.target.files[0])} />
                  </label>
                )}
              </header>
              <div className="radio-playlist-list">
                {visibleTracks.length === 0 && <p className="radio-muted">Cola vacía</p>}
                {visibleTracks.map((t, idx) => (
                  <div key={t.id} className={`radio-track ${t.id === currentTrack?.id ? 'is-active' : ''}`}>
                    <div className="radio-track-left">
                      <span className="radio-track-idx">{isAdmin ? tracks.findIndex(tr => tr.id === t.id) + 1 : idx + 1}</span>
                      <div className="radio-track-details">
                        <span className="radio-track-title">{t.title}</span>
                        {t.status === 'playing' && <span className="radio-track-status">Sonando</span>}
                        {t.duration_seconds && <span className="radio-track-duration">{formatTime(t.duration_seconds)}</span>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="radio-track-actions">
                        <button 
                          onClick={() => playTrack(t)} 
                          className="btn btn-ghost btn-icon" 
                          title={t.status === 'playing' ? 'Reiniciar' : 'Reproducir'}
                        >
                          {t.status === 'playing' ? '↺' : '▶'}
                        </button>
                        <button 
                          onClick={() => confirmDeleteTrack(t)} 
                          className="btn btn-ghost btn-icon btn-delete" 
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="radio-footer">
            <div className="radio-now-playing">
              <div className={`radio-vinyl ${isPlaying ? 'spinning' : ''}`}></div>
              <div className="radio-now-meta">
                <h4>{currentTrack?.title || 'Radio Utopía'}</h4>
                <p>{currentTrack?.artist || 'Selecciona una estación'}</p>
                <div className="radio-progress">
                  <div className="radio-progress-fill" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
                </div>
                <div className="radio-progress-meta">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="radio-admin">
                <div className="radio-transport">
                  <button className="btn btn-ghost btn-icon" onClick={playPreviousTrack}>⏮</button>
                  <button className="btn btn-primary btn-icon" onClick={currentTrack ? (isPlaying ? pauseTrack : () => setIsPlaying(true)) : playNextTrack}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={playNextTrack}>⏭</button>
                </div>
                
                {/* Real-time voice button */}
                <button 
                  className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'} radio-ptt`} 
                  onClick={toggleRecording}
                  style={{ 
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isRecording && <span className="live-pulse" />}
                  {isRecording ? '🔴 Detener voz' : '🎙️ Hablar'}
                </button>
                
                {/* Admin monitoring toggle */}
                <label className="radio-monitor-toggle">
                  <input 
                    type="checkbox" 
                    checked={adminMonitoringEnabled} 
                    onChange={(e) => setAdminMonitoringEnabled(e.target.checked)}
                  />
                  <span>Escuchar música</span>
                </label>
              </div>
            )}

            <div className="radio-volume">
              <span>🔊</span>
              <input 
                className="radio-volume-slider" 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={volume} 
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = isVoiceOver ? v * 0.2 : v;
                }} 
              />
            </div>
          </div>
          
          {/* Voice indicator */}
          {isVoiceOver && (
            <div className="voice-indicator">
              <span className="voice-dot"></span>
              <span>En vivo</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
