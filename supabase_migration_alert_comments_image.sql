-- Add image_url column to alert_comments table for image attachments in comments
ALTER TABLE public.alert_comments 
ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;

-- If the alert_comments table doesn't exist yet, create it:
-- CREATE TABLE IF NOT EXISTS public.alert_comments (
--   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
--   alert_id uuid NOT NULL REFERENCES public.map_alerts(id) ON DELETE CASCADE,
--   user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
--   content text NOT NULL,
--   image_url text DEFAULT NULL,
--   parent_id uuid REFERENCES public.alert_comments(id) ON DELETE CASCADE,
--   created_at timestamptz DEFAULT now()
-- );

-- Enable RLS
ALTER TABLE public.alert_comments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all comments
CREATE POLICY IF NOT EXISTS "Anyone can read alert comments" 
  ON public.alert_comments FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow authenticated users to insert their own comments
CREATE POLICY IF NOT EXISTS "Users can create comments" 
  ON public.alert_comments FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own comments
CREATE POLICY IF NOT EXISTS "Users can delete own comments" 
  ON public.alert_comments FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Enable realtime for alert_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_comments;
