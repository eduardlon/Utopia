-- Radio feature tables for Utopía
-- Run this SQL in your Supabase SQL Editor to update/create the radio tables.
-- NOTE: If tables already exist, you may need to ALTER them or DROP them first if you don't care about data.

-- Radio Channels
CREATE TABLE IF NOT EXISTS public.radio_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Radio Tracks
CREATE TABLE IF NOT EXISTS public.radio_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.radio_channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds REAL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued', -- 'queued', 'playing', 'history'
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Radio Messages (live chat)
CREATE TABLE IF NOT EXISTS public.radio_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.radio_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.radio_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for radio_channels
CREATE POLICY "Anyone can view radio channels" ON public.radio_channels
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create channels" ON public.radio_channels
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel creators can update their channels" ON public.radio_channels
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Channel creators can delete their channels" ON public.radio_channels
  FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for radio_tracks
CREATE POLICY "Anyone can view radio tracks" ON public.radio_tracks
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add tracks" ON public.radio_tracks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Track adders can update their tracks" ON public.radio_tracks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Track adders can delete their tracks" ON public.radio_tracks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for radio_messages
CREATE POLICY "Anyone can view radio messages" ON public.radio_messages
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send messages" ON public.radio_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_radio_tracks_channel ON public.radio_tracks(channel_id);
CREATE INDEX IF NOT EXISTS idx_radio_messages_channel ON public.radio_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_radio_channels_created_by ON public.radio_channels(created_by);

-- Enable realtime for radio tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.radio_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.radio_tracks;

-- Migration Helper (Uncomment if you need to migrate existing tables):
/*
ALTER TABLE radio_tracks RENAME COLUMN url TO audio_url;
ALTER TABLE radio_tracks RENAME COLUMN duration TO duration_seconds;
ALTER TABLE radio_tracks RENAME COLUMN added_by TO user_id;
ALTER TABLE radio_tracks DROP COLUMN is_playing;
ALTER TABLE radio_tracks ADD COLUMN status TEXT DEFAULT 'queued';
ALTER TABLE radio_tracks RENAME COLUMN played_at TO started_at;
ALTER TABLE radio_channels DROP COLUMN cover_url;
ALTER TABLE radio_channels DROP COLUMN is_live;
ALTER TABLE radio_channels DROP COLUMN listener_count;
*/
